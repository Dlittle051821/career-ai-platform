import { isPaidCheckoutEnabled } from "../launch-mode";

/**
 * NW-PAYMENT-V1 — whether online UPI checkout is open, and against which
 * Razorpay environment. Pure (reads only the env object it is given) so every
 * branch is unit-tested in config.test.ts.
 *
 * All of these must hold, in addition to the database switch
 * (payment_upi_settings.upi_checkout_enabled, checked by every checkout RPC):
 *   1. the existing paid-checkout gate is open (not public-launch mode,
 *      NEXTWISE_PAID_CHECKOUT=enabled, prerequisites confirmed, keys present);
 *   2. NEXTWISE_UPI_CHECKOUT=enabled;
 *   3. NEXTWISE_PAYMENT_MODE is `test` or `live`, and the key id matches it
 *      (rzp_test_… for test, rzp_live_… for live) — a live key can never be
 *      used by a deployment that believes it is in test mode, or the reverse;
 *   4. live mode additionally needs NEXTWISE_UPI_LIVE_APPROVED to equal the
 *      approval phrase below, set only after the release gates in
 *      PAYMENT-READINESS-REPORT.md are signed off.
 *
 * RAZORPAY_API_BASE_URL_FOR_TESTS points the SDK at the local Razorpay test
 * double. It is honoured only in test mode with a rzp_test_ key and never on a
 * Vercel production deployment.
 */

export const UPI_CHECKOUT_FLAG_ENV = "NEXTWISE_UPI_CHECKOUT";
export const UPI_PAYMENT_MODE_ENV = "NEXTWISE_PAYMENT_MODE";
export const UPI_LIVE_APPROVAL_ENV = "NEXTWISE_UPI_LIVE_APPROVED";
export const UPI_LIVE_APPROVAL_VALUE = "GST-ISSUER-MERCHANT-APPROVED";
export const UPI_TEST_API_BASE_ENV = "RAZORPAY_API_BASE_URL_FOR_TESTS";
export const UPI_TEST_CHECKOUT_SCRIPT_ENV = "RAZORPAY_CHECKOUT_SCRIPT_URL_FOR_TESTS";

export const RAZORPAY_API_BASE_URL = "https://api.razorpay.com";
export const RAZORPAY_CHECKOUT_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

export type UpiMode = "test" | "live";
export type UpiClosedReason =
  | "paid_checkout_off"
  | "upi_flag_off"
  | "mode_not_set"
  | "key_mode_mismatch"
  | "live_not_approved"
  | "test_double_not_allowed";

export type UpiCheckoutConfig =
  | { open: true; mode: UpiMode; keyId: string; apiBaseUrl: string; checkoutScriptUrl: string; usesTestDouble: boolean }
  | { open: false; reason: UpiClosedReason };

type EnvLike = Readonly<Record<string, string | undefined>>;

function isLocalTestUrl(raw: string | undefined): raw is string {
  if (!raw) return false;
  try {
    const url = new URL(raw);
    return (url.protocol === "http:" || url.protocol === "https:") && (url.hostname === "127.0.0.1" || url.hostname === "localhost");
  } catch {
    return false;
  }
}

export function resolveUpiCheckout(env: EnvLike = process.env): UpiCheckoutConfig {
  if (!isPaidCheckoutEnabled(env)) return { open: false, reason: "paid_checkout_off" };
  if (env[UPI_CHECKOUT_FLAG_ENV] !== "enabled") return { open: false, reason: "upi_flag_off" };
  const mode = env[UPI_PAYMENT_MODE_ENV];
  if (mode !== "test" && mode !== "live") return { open: false, reason: "mode_not_set" };
  const keyId = env.RAZORPAY_KEY_ID ?? "";
  if (!keyId.startsWith(mode === "test" ? "rzp_test_" : "rzp_live_")) return { open: false, reason: "key_mode_mismatch" };
  if (mode === "live" && env[UPI_LIVE_APPROVAL_ENV] !== UPI_LIVE_APPROVAL_VALUE) return { open: false, reason: "live_not_approved" };

  const testApi = env[UPI_TEST_API_BASE_ENV];
  if (testApi) {
    if (mode !== "test" || env.VERCEL_ENV === "production" || !isLocalTestUrl(testApi)) return { open: false, reason: "test_double_not_allowed" };
    const testScript = env[UPI_TEST_CHECKOUT_SCRIPT_ENV];
    return {
      open: true,
      mode,
      keyId,
      apiBaseUrl: testApi.replace(/\/+$/, ""),
      checkoutScriptUrl: isLocalTestUrl(testScript) ? testScript : RAZORPAY_CHECKOUT_SCRIPT_URL,
      usesTestDouble: true,
    };
  }
  return { open: true, mode, keyId, apiBaseUrl: RAZORPAY_API_BASE_URL, checkoutScriptUrl: RAZORPAY_CHECKOUT_SCRIPT_URL, usesTestDouble: false };
}

export function isUpiCheckoutOpen(env: EnvLike = process.env): boolean {
  return resolveUpiCheckout(env).open;
}
