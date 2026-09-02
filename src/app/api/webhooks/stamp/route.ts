import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStampProvider } from "@/lib/stamping/get-provider";
import { isStampWebhookConfigured } from "@/lib/stamping/config";
import { uploadStampedDocument, buildStampedDocumentStoragePath } from "@/lib/storage/stamped-documents";
import { trackEvent } from "@/lib/supabase/analytics/track";
import type { ImplementedEventName } from "@/lib/analytics/events";

const WEBHOOK_STATUS_TO_PRODUCT_EVENT: Partial<Record<string, ImplementedEventName>> = {
  completed: "agreement_stamp_completed",
  failed: "agreement_stamp_failed",
};

/**
 * Stamp-provider webhook delivery endpoint. Mirrors
 * src/app/api/webhooks/signature/route.ts's exact structure (which itself
 * mirrors src/app/api/webhooks/razorpay/route.ts).
 *
 * Header convention: `X-Signature: <hex HMAC-SHA256 of the raw body>` —
 * same "NextWise webhook envelope" scheme as the signature/payment
 * webhooks.
 *
 * SECURITY: raw body read via request.text() and passed UNTOUCHED to both
 * the local pre-check and the database — never request.json() first. No
 * Supabase session — the authoritative check is
 * public.apply_stamp_webhook_event() (SECURITY DEFINER), which
 * independently re-derives the HMAC signature before trusting anything in
 * the body. Never trust a client-reported stamp status anywhere in this
 * route.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const rawBody = await request.text();
  const signature = request.headers.get("x-signature");

  if (!rawBody || !signature) {
    console.error("[webhooks/stamp] Missing body or X-Signature header.");
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  if (!isStampWebhookConfigured()) {
    console.error("[webhooks/stamp] Webhook secret is not configured — rejecting delivery.");
    return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  }

  const provider = getStampProvider();
  if (!provider.verifyWebhook({ rawBody, signature })) {
    console.error("[webhooks/stamp] Local signature pre-check failed.");
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_stamp_webhook_event", { p_raw_body: rawBody, p_signature: signature });

  if (error) {
    console.error("[webhooks/stamp] apply_stamp_webhook_event failed:", error.message);
    return NextResponse.json({ error: "Could not process webhook." }, { status: 500 });
  }

  const result = data as {
    valid?: boolean;
    reason?: string;
    duplicate?: boolean;
    event_type?: string;
    processing_status?: string;
    stamp_request_id?: string;
    agreement_id?: string;
    status?: string;
    provider?: string;
    provider_request_id?: string;
  } | null;

  if (result?.valid === false) {
    const status = result.reason === "not_configured" ? 503 : 400;
    console.error(`[webhooks/stamp] Rejected by apply_stamp_webhook_event: ${result.reason}`);
    return NextResponse.json({ error: "Invalid webhook delivery." }, { status });
  }

  if (result?.duplicate) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  if (result?.processing_status === "processed" && result.status && result.agreement_id) {
    const productEventName = WEBHOOK_STATUS_TO_PRODUCT_EVENT[result.status];
    if (productEventName) {
      void trackEvent({ eventName: productEventName, entityType: "agreement", entityId: result.agreement_id, source: "stamp_webhook" });
    }
  }

  // Best-effort enrichment (caching the stamped document bytes in Storage)
  // — must never cause this webhook delivery to be treated as failed if it
  // doesn't succeed, same discipline as the signature webhook route.
  if (result?.status === "completed" && result.provider && result.provider_request_id && result.agreement_id && result.stamp_request_id) {
    try {
      const document = await provider.retrieveStampedDocument(result.provider_request_id);
      const storagePath = buildStampedDocumentStoragePath(result.agreement_id, result.stamp_request_id, document.fileName);
      const uploadResult = await uploadStampedDocument({ storagePath, bytes: document.bytes, contentType: document.contentType });
      if (uploadResult.ok) {
        const { error: pathError } = await supabase.rpc("set_stamp_document_path", {
          p_provider: result.provider,
          p_provider_request_id: result.provider_request_id,
          p_storage_path: storagePath,
        });
        if (pathError) console.error("[webhooks/stamp] set_stamp_document_path failed:", pathError.message);
      } else {
        console.warn("[webhooks/stamp] Stamped document upload skipped/failed:", uploadResult.error);
      }
    } catch (captureError) {
      console.error("[webhooks/stamp] Stamped document capture threw:", captureError);
    }
  }

  return NextResponse.json({ received: true, eventType: result?.event_type ?? null, processingStatus: result?.processing_status ?? null });
}
