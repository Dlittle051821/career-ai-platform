import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSignatureProvider } from "@/lib/signatures/get-provider";
import { isSignatureWebhookConfigured } from "@/lib/signatures/config";
import { uploadSignedDocument, buildSignedDocumentStoragePath } from "@/lib/storage/signed-documents";
import { trackEvent } from "@/lib/supabase/analytics/track";
import type { ImplementedEventName } from "@/lib/analytics/events";

const WEBHOOK_STATUS_TO_PRODUCT_EVENT: Partial<Record<string, ImplementedEventName>> = {
  viewed: "agreement_signature_viewed",
  signed: "agreement_signature_completed",
  declined: "agreement_signature_declined",
};

/**
 * Signature-provider webhook delivery endpoint. Mirrors
 * src/app/api/webhooks/razorpay/route.ts's exact structure. Configure this
 * URL (https://<your domain>/api/webhooks/signature) with whichever real
 * provider is eventually wired up (see docs/milestones/
 * M10-electronic-signature.md "Future provider integration"); for the
 * built-in mock provider, deliveries are simulated directly by
 * MockSignatureProvider.simulateEvent() in tests/manual QA — see that
 * file and the docs' manual verification appendix.
 *
 * Header convention: `X-Signature: <hex HMAC-SHA256 of the raw body>`
 * ("the NextWise webhook envelope" — see 0011_electronic_signature.sql
 * PART 6's own comment for why a real provider integration needs to
 * either configure that provider to sign with this scheme, or bridge a
 * verified provider-native payload into it).
 *
 * Deliberately outside the `(site)` route group and outside `/admin` —
 * same "bare Route Handler for infrastructure that isn't a page"
 * precedent as src/app/auth/callback/route.ts and the Razorpay webhook.
 *
 * SECURITY: the raw request body is read via `request.text()` and passed
 * UNTOUCHED to both the local pre-check and the database — never
 * `request.json()` first (would re-serialize the body and silently break
 * signature verification). This route carries no Supabase session — the
 * Supabase client here is anonymous. That is intentional and safe: the
 * authoritative check is public.apply_signature_webhook_event() (SECURITY
 * DEFINER), which independently re-derives the HMAC signature from the
 * secret in signature_provider_config before trusting anything in the
 * body — see 0011_electronic_signature.sql PART 6 for the full rationale.
 * Never trust a client-reported signature status anywhere in this route —
 * every status write happens only inside that database function.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const rawBody = await request.text();
  const signature = request.headers.get("x-signature");

  if (!rawBody || !signature) {
    console.error("[webhooks/signature] Missing body or X-Signature header.");
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  if (!isSignatureWebhookConfigured()) {
    // Fails closed — a real provider will retry deliveries until this
    // returns a non-error status, which won't happen until
    // SIGNATURE_WEBHOOK_SECRET (and the matching database bootstrap step)
    // are populated. Same intended behavior as the Razorpay webhook route.
    console.error("[webhooks/signature] Webhook secret is not configured — rejecting delivery.");
    return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  }

  // Fast local pre-check — avoids a database round trip for obviously
  // invalid deliveries. NOT the authoritative check; the RPC below
  // re-verifies independently regardless of this result.
  const provider = getSignatureProvider();
  if (!provider.verifyWebhook({ rawBody, signature })) {
    console.error("[webhooks/signature] Local signature pre-check failed.");
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_signature_webhook_event", { p_raw_body: rawBody, p_signature: signature });

  if (error) {
    console.error("[webhooks/signature] apply_signature_webhook_event failed:", error.message);
    // A transient DB error — a 500 tells the provider to retry, which is
    // correct behavior here (there is no invalid-signature branch left to
    // handle at this layer; the RPC reports that via `valid: false` in a
    // normal, non-error response — see below — precisely so its own
    // SIGNATURE_WEBHOOK_FAILED audit-log write is not rolled back by a
    // raised exception; see that function's own leading comment).
    return NextResponse.json({ error: "Could not process webhook." }, { status: 500 });
  }

  const result = data as {
    valid?: boolean;
    reason?: string;
    duplicate?: boolean;
    event_type?: string;
    processing_status?: string;
    signature_request_id?: string;
    agreement_id?: string;
    status?: string;
    provider?: string;
    provider_request_id?: string;
  } | null;

  if (result?.valid === false) {
    const status = result.reason === "not_configured" ? 503 : 400;
    console.error(`[webhooks/signature] Rejected by apply_signature_webhook_event: ${result.reason}`);
    return NextResponse.json({ error: "Invalid webhook delivery." }, { status });
  }

  if (result?.duplicate) {
    // Already recorded from an earlier delivery — acknowledge with 200 so
    // the provider stops retrying; no other table is touched (including
    // analytics — a duplicate delivery must never double-count a funnel
    // event).
    return NextResponse.json({ received: true, duplicate: true });
  }

  if (result?.processing_status === "processed" && result.status && result.agreement_id) {
    const productEventName = WEBHOOK_STATUS_TO_PRODUCT_EVENT[result.status];
    if (productEventName) {
      void trackEvent({ eventName: productEventName, entityType: "agreement", entityId: result.agreement_id, source: "signature_webhook" });
    }
  }

  // The database write for the status transition already happened,
  // successfully, above — everything from here on is a best-effort
  // enrichment step (caching the signed document bytes in Storage) that
  // must NEVER cause this webhook delivery to be treated as failed if it
  // doesn't succeed. A provider retrying a delivery this route already
  // returns 200 for would only ever produce a harmless duplicate (caught
  // by signature_webhook_events' idempotency guard above), never a second
  // attempt at this step from THIS delivery.
  if (result?.status === "signed" && result.provider && result.provider_request_id && result.agreement_id && result.signature_request_id) {
    try {
      const document = await provider.getSignedDocument(result.provider_request_id);
      // agreement_id MUST be the real, first path segment — storage.objects'
      // own RLS policy (0011_electronic_signature.sql PART 8) resolves
      // read access by joining that segment back to public.agreements.
      const storagePath = buildSignedDocumentStoragePath(result.agreement_id, result.signature_request_id, document.fileName);
      const uploadResult = await uploadSignedDocument({ storagePath, bytes: document.bytes, contentType: document.contentType });
      if (uploadResult.ok) {
        const { error: pathError } = await supabase.rpc("set_signature_document_path", {
          p_provider: result.provider,
          p_provider_request_id: result.provider_request_id,
          p_storage_path: storagePath,
        });
        if (pathError) console.error("[webhooks/signature] set_signature_document_path failed:", pathError.message);
      } else {
        console.warn("[webhooks/signature] Signed document upload skipped/failed:", uploadResult.error);
      }
    } catch (captureError) {
      // Never let a document-capture failure turn a successfully-processed
      // status transition into a failed webhook response.
      console.error("[webhooks/signature] Signed document capture threw:", captureError);
    }
  }

  return NextResponse.json({ received: true, eventType: result?.event_type ?? null, processingStatus: result?.processing_status ?? null });
}
