import "server-only";
import { CAREER_INTELLIGENCE_MINIMUM_PLAN_SLUG, planHasCapability } from "@/config/plan-capabilities";
import { formatMoney } from "@/lib/admin/money";
import { arePaidFeaturesForcedOff } from "@/lib/launch/launch-mode";
import { isPaidCheckoutEnabled } from "@/lib/payments/launch-mode";
import { NEXTWISE_VERIFIED } from "@/lib/payments/checkout-charge-guard";
import { isVersionCurrentlyEffective, visibleInclusionsInOrder } from "@/lib/pricing/plan-versions";
import { listPublicPricingPlans } from "@/lib/supabase/pricing/public-plans";

/**
 * Career Intelligence V2 — the plans that include Career Intelligence, read
 * from the live public catalogue and filtered by the capability map
 * (src/config/plan-capabilities.ts). Nothing here is hard-coded except the
 * one approved figure for Nextwise Verified (₹1,999, the final amount with
 * GST included), which comes from the same constant the checkout's charge
 * guard enforces.
 *
 * Choosing a plan grants nothing. Checkout is offered only when this
 * deployment allows paid checkout; otherwise the honest path is the free
 * Discovery Session.
 */

export interface CiPlan {
  slug: string;
  name: string;
  price: string;
  priceNote: string;
  description: string | null;
  inclusions: string[];
}

export interface CiAbroadPlans {
  bachelor: { plus: CiPlan | null; premium: CiPlan | null };
  master: { plus: CiPlan | null; premium: CiPlan | null };
}

export interface CiPlanCatalogue {
  verified: CiPlan;
  essential: CiPlan | null;
  abroad: CiAbroadPlans;
  /** False when the live catalogue could not be read; only the approved Verified figures are shown then. */
  catalogueAvailable: boolean;
  /** True only when this deployment takes online payments (and paid features are not forced off). */
  purchasesOpen: boolean;
}

/** Whole rupees, no decimals; Indian digit grouping. */
export const wholeMoney = (minor: number, currency: string) => formatMoney(minor, currency).replace(/\.00$/, "");

export const VERIFIED_PRICE_TEXT = wholeMoney(NEXTWISE_VERIFIED.payableMinorUnits, NEXTWISE_VERIFIED.currency);

const ABROAD_SLUG = /^(bachelor|master)-abroad-(plus|premium)$/;

export function purchasesAreOpen(): boolean {
  return !arePaidFeaturesForcedOff() && isPaidCheckoutEnabled();
}

export async function getCareerIntelligencePlans(): Promise<CiPlanCatalogue> {
  const items = await listPublicPricingPlans().catch(() => []);
  const eligible = items.filter((i) => i.version && isVersionCurrentlyEffective(i.version) && planHasCapability(i.plan.slug, "career_intelligence"));

  const toPlan = (slug: string): CiPlan | null => {
    const item = eligible.find((i) => i.plan.slug === slug);
    if (!item || !item.version) return null;
    const v = item.version;
    return {
      slug,
      name: v.publicTitle,
      price: slug === NEXTWISE_VERIFIED.slug ? VERIFIED_PRICE_TEXT : wholeMoney(v.amountMinorUnits, v.currency),
      priceNote: slug === NEXTWISE_VERIFIED.slug ? "final price, GST included" : "one-time payment",
      description: v.shortDescription,
      inclusions: visibleInclusionsInOrder(item.inclusions)
        .map((inc) => inc.title)
        .slice(0, 4),
    };
  };

  const verified: CiPlan = toPlan(CAREER_INTELLIGENCE_MINIMUM_PLAN_SLUG) ?? {
    slug: NEXTWISE_VERIFIED.slug,
    name: NEXTWISE_VERIFIED.name,
    price: VERIFIED_PRICE_TEXT,
    priceNote: "final price, GST included",
    description: null,
    inclusions: [],
  };

  const abroad: CiAbroadPlans = { bachelor: { plus: null, premium: null }, master: { plus: null, premium: null } };
  for (const item of eligible) {
    const m = ABROAD_SLUG.exec(item.plan.slug);
    if (m) abroad[m[1] as "bachelor" | "master"][m[2] as "plus" | "premium"] = toPlan(item.plan.slug);
  }

  return {
    verified,
    essential: toPlan("nextwise-essential"),
    abroad,
    catalogueAvailable: eligible.length > 0,
    purchasesOpen: purchasesAreOpen(),
  };
}
