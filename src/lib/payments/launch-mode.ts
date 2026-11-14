import "server-only";
import { isPublicMarketingMode } from "@/lib/launch/launch-mode";

/**
 * CC-22B — the launch payment mode. Paid online checkout is OFF unless all
 * three of these are true at the same time:
 *
 *   1. NEXTWISE_PAID_CHECKOUT is exactly "enabled" (an explicit business
 *      approval to take payments online);
 *   2. NEXTWISE_PAID_CHECKOUT_PREREQUISITES is exactly "CC19-CC20-APPROVED"
 *      (the operator confirms the CC-19/CC-20 migrations — NW01 GST-inclusive
 *      pricing and the nw-f01-s3 05/06 payment-integrity SQL — are applied
 *      and signed off; without them a GST-registered configuration can
 *      charge more than the advertised GST-inclusive price);
 *   3. Razorpay server credentials are configured.
 *
 * Anything else — unset, a typo, a different casing — keeps payments off.
 * Nothing in this repository sets either variable, so the default build is
 * "payments off".
 *
 * While payments are off:
 *   - prices stay visible for information only;
 *   - no purchase or invoice is created from the pricing journey (including
 *     a ₹0 Explore "purchase") — the checks run before
 *     public.purchase_pricing_plan() is called;
 *   - no Razorpay order is created for any invoice (the "Pay" server action
 *     refuses before createOrReuseCheckoutSession());
 *   - an invoice that genuinely already exists is still shown honestly as
 *     open — it is never hidden — but it is not offered for online payment.
 */

export const PAID_CHECKOUT_FLAG_ENV = "NEXTWISE_PAID_CHECKOUT";
export const PAID_CHECKOUT_FLAG_ENABLED_VALUE = "enabled";
export const PAID_CHECKOUT_PREREQUISITES_ENV = "NEXTWISE_PAID_CHECKOUT_PREREQUISITES";
export const PAID_CHECKOUT_PREREQUISITES_VALUE = "CC19-CC20-APPROVED";

export type PaidCheckoutBlockReason =
  | "public_marketing_launch"
  | "flag_off"
  | "prerequisites_not_confirmed"
  | "gateway_not_configured";

export interface PaymentLaunchMode {
  paidCheckoutEnabled: boolean;
  /** Why paid checkout is off (operator-facing; never shown to students). Null when enabled. */
  blockReason: PaidCheckoutBlockReason | null;
}

type EnvLike = Readonly<Record<string, string | undefined>>;

/** Pure and side-effect free so it can be unit-tested with any environment. */
export function resolvePaymentLaunchMode(env: EnvLike = process.env): PaymentLaunchMode {
  // V5.6.2 public launch: no payments of any kind in public-marketing mode,
  // whatever the payment variables say.
  if (isPublicMarketingMode(env)) {
    return { paidCheckoutEnabled: false, blockReason: "public_marketing_launch" };
  }
  if (env[PAID_CHECKOUT_FLAG_ENV] !== PAID_CHECKOUT_FLAG_ENABLED_VALUE) {
    return { paidCheckoutEnabled: false, blockReason: "flag_off" };
  }
  if (env[PAID_CHECKOUT_PREREQUISITES_ENV] !== PAID_CHECKOUT_PREREQUISITES_VALUE) {
    return { paidCheckoutEnabled: false, blockReason: "prerequisites_not_confirmed" };
  }
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    return { paidCheckoutEnabled: false, blockReason: "gateway_not_configured" };
  }
  return { paidCheckoutEnabled: true, blockReason: null };
}

export function isPaidCheckoutEnabled(env: EnvLike = process.env): boolean {
  return resolvePaymentLaunchMode(env).paidCheckoutEnabled;
}

export {
  PAID_CHECKOUT_PAUSED_TITLE,
  PAID_CHECKOUT_PAUSED_MESSAGE,
  OPEN_INVOICE_PAYMENT_PAUSED_MESSAGE,
  DISCOVERY_SESSION_BOOKING_PATH,
} from "./launch-mode-shared";
