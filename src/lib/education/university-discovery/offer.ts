import { PR01_ACTIVE_CATALOG } from "@/lib/pricing/pr01-catalog";
import { isPaidCheckoutEnabled } from "@/lib/payments/launch-mode";

export const VERIFIED_PLAN_SLUG = "nextwise-verified";

export interface VerifiedOfferData {
  planTitle: string;
  priceLabel: string;
  checkoutHref: string;
  purchaseAvailable: boolean;
}

/**
 * The single Nextwise Verified offer shown by University Discovery V3. The
 * title and amount come from the approved commercial catalogue (never typed
 * into a component), and the purchase action is only offered while the
 * site-wide paid-checkout switch is on. There is no other paid plan in this
 * flow.
 */
export function getVerifiedOffer(env: Record<string, string | undefined> = process.env): VerifiedOfferData {
  const plan = PR01_ACTIVE_CATALOG.find((entry) => entry.slug === VERIFIED_PLAN_SLUG);
  if (!plan) throw new Error("University Discovery V3 expects the nextwise-verified plan in the approved catalogue");
  const priceLabel = new Intl.NumberFormat("en-IN", { style: "currency", currency: plan.currency, maximumFractionDigits: 0 }).format(plan.amountMinorUnits / 100);
  return {
    planTitle: plan.publicTitle,
    priceLabel,
    checkoutHref: `/pricing/checkout/${VERIFIED_PLAN_SLUG}`,
    purchaseAvailable: isPaidCheckoutEnabled(env),
  };
}
