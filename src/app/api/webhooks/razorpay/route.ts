import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPaymentGateway } from "@/lib/payments/get-gateway";
import { isWebhookConfigured } from "@/lib/payments/env";

/**
 * Razorpay webhook delivery endpoint. Configure this URL (https://<your
 * domain>/api/webhooks/razorpay) in the Razorpay Dashboard under Settings ->
 * Webhooks, subscribed to at minimum: payment.authorized, payment.captured,
 * payment.failed, refund.processed, refund.failed. See
 * docs/payments-billing-guide.md §9 for the full setup + local-testing
 * walkthrough (Razorpay CLI / ngrok).
 *
 * Deliberately outside the `(site)` route group and outside `/admin` — this
 * is a machine-to-machine endpoint with no page, matching the existing
 * `src/app/auth/callback/route.ts` precedent of a bare Route Handler living
 * directly under `src/app` for infrastructure that isn't a page.
 *
 * SECURITY: the raw request body is read via `request.text()` and passed
 * UNTOUCHED to both the local pre-check and the database — never
 * `request.json()` first, which would re-serialize the body and silently
 * break signature verification (a re-serialized JSON string is not
 * guaranteed to be byte-identical to what Razorpay actually signed).
 *
 * This route carries no Supabase session — the Supabase client created here
 * is an anonymous client. That is intentional and safe: the authoritative
 * check is public.apply_webhook_event() (SECURITY DEFINER), which
 * independently re-derives Razorpay's HMAC signature from the secret in
 * payment_gateway_config before trusting anything in the body. See
 * 0005_payments_billing.sql PART 8 for the full rationale.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!rawBody || !signature) {
    console.error("[webhooks/razorpay] Missing body or X-Razorpay-Signature header.");
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  if (!isWebhookConfigured()) {
    // Fails closed — Razorpay will retry deliveries until this returns a
    // non-error status, which won't happen until an admin populates
    // RAZORPAY_WEBHOOK_SECRET and the payment_gateway_config bootstrap row
    // (see the migration's BOOTSTRAP section). That's the intended
    // behavior: no event is ever silently accepted while unconfigured.
    console.error("[webhooks/razorpay] Webhook secret is not configured — rejecting delivery.");
    return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  }

  // Fast local pre-check (Node-side HMAC) — avoids a database round trip
  // for obviously-invalid deliveries. NOT the authoritative check; see the
  // RPC call below, which re-verifies independently regardless of this
  // result.
  const gateway = getPaymentGateway();
  if (gateway && !gateway.verifyWebhookSignature({ rawBody, signature })) {
    console.error("[webhooks/razorpay] Local signature pre-check failed.");
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_webhook_event", { p_raw_body: rawBody, p_signature: signature });

  if (error) {
    // A rejected/invalid signature at the database layer (the authoritative
    // check) also lands here. Never leak the raw Postgres error message —
    // log it server-side only.
    const message = error.message ?? "";
    if (message.toLowerCase().includes("invalid webhook signature")) {
      console.error("[webhooks/razorpay] Database-layer signature verification failed.");
      return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
    }
    console.error("[webhooks/razorpay] apply_webhook_event failed:", message);
    // Anything else (transient DB error, gateway config race) — a 500 tells
    // Razorpay to retry, which is the correct behavior for a genuinely
    // transient failure.
    return NextResponse.json({ error: "Could not process webhook." }, { status: 500 });
  }

  const result = data as { duplicate?: boolean; event_type?: string; processing_status?: string } | null;
  if (result?.duplicate) {
    // Already recorded from an earlier delivery — acknowledge with 200 so
    // Razorpay stops retrying; no other table is touched for a duplicate.
    return NextResponse.json({ received: true, duplicate: true });
  }

  return NextResponse.json({ received: true, eventType: result?.event_type ?? null, processingStatus: result?.processing_status ?? null });
}
