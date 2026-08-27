import "server-only";

/**
 * Central place that reads the Razorpay environment variables — mirrors
 * src/lib/supabase/env.ts's role for Supabase, but deliberately does NOT
 * throw when missing. Spec requirement: "The application should still
 * build without real production gateway credentials. Payment actions
 * should show a safe 'Payment gateway is not configured' state rather than
 * crashing unrelated pages." Every payment server action checks
 * isPaymentGatewayConfigured() (or calls getRazorpayServerConfig() and
 * handles null) before doing anything gateway-related; pages that don't
 * touch payments never call any of this and are completely unaffected.
 *
 * RAZORPAY_KEY_SECRET never leaves this module except into the
 * RazorpayGateway provider (src/lib/payments/providers/razorpay.ts) — it is
 * never sent to the browser, never logged, and never included in an audit
 * log entry (src/lib/admin/audit.ts's redaction pattern would also strip
 * it if it were ever accidentally passed in, as defense in depth).
 */

export interface RazorpayServerConfig {
  keyId: string;
  keySecret: string;
}

export function getRazorpayServerConfig(): RazorpayServerConfig | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return { keyId, keySecret };
}

export function getRazorpayWebhookSecret(): string | null {
  return process.env.RAZORPAY_WEBHOOK_SECRET || null;
}

export function isPaymentGatewayConfigured(): boolean {
  return getRazorpayServerConfig() !== null;
}

export function isWebhookConfigured(): boolean {
  return !!getRazorpayWebhookSecret();
}

/** Used to build the absolute URL a copyable payment link points to. Falls back to a relative path (still usable within the app) when unset, same "never crash, degrade gracefully" convention as the rest of this file. */
export function getPublicAppUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "");
}
