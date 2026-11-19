import "server-only";
import { isVersionCurrentlyEffective, visibleInclusionsInOrder } from "@/lib/pricing/plan-versions";
import { createClient } from "@/lib/supabase/server";
import { listPublicPricingPlans } from "@/lib/supabase/pricing/public-plans";
import { V3_PLAN_ORDER, V3_PLAN_SLUGS, type UniversityAddonTerms, type V3PlanSlug } from "./quote";

/**
 * NW-PRICING-V3 — the public projection of the three-plan catalogue.
 *
 * The ONLY source of names, prices, inclusions and add-on terms is the live
 * database (pricing_plans → published pricing_plan_versions →
 * pricing_plan_inclusions / pricing_plan_addons), read under the existing
 * public RLS. Nothing about a price is typed into a component.
 *
 * `available` is true only when all three plans are active and published and
 * both Study Abroad plans carry their university add-on, i.e. after the
 * NW-PRICING-V3 catalogue migration has been applied. Until then the pricing
 * page keeps showing the existing catalogue exactly as before, so deploying
 * this code ahead of the migration changes nothing for students.
 */

export interface V3Inclusion {
  title: string;
  group: string;
  highlight: boolean;
}

export interface V3PublicPlan {
  planId: string;
  slug: V3PlanSlug;
  name: string;
  description: string | null;
  amountMinorUnits: number;
  currency: string;
  taxStatus: "unconfigured" | "tax_exclusive" | "tax_inclusive";
  ctaText: string | null;
  inclusions: V3Inclusion[];
  /** Lite and Premium only. Verified is not an application package. */
  universityAddon: UniversityAddonTerms | null;
}

export interface V3Catalogue {
  available: boolean;
  plans: V3PublicPlan[];
}

interface AddonRow {
  plan_version_id: string;
  included_quantity: number;
  unit_amount_minor_units: number | string;
  currency: string;
  max_additional_quantity: number | null;
}

export async function getV3Catalogue(): Promise<V3Catalogue> {
  const items = await listPublicPricingPlans().catch(() => []);
  const bySlug = new Map(items.filter((i) => i.plan.isActive && i.version && isVersionCurrentlyEffective(i.version)).map((i) => [i.plan.slug, i]));
  const chosen = V3_PLAN_ORDER.map((slug) => bySlug.get(slug)).filter((i): i is NonNullable<typeof i> => Boolean(i));
  if (chosen.length !== V3_PLAN_ORDER.length) return { available: false, plans: [] };

  const supabase = await createClient();
  const versionIds = chosen.map((i) => i.version!.id);
  const { data, error } = await supabase
    .from("pricing_plan_addons")
    .select("plan_version_id, included_quantity, unit_amount_minor_units, currency, max_additional_quantity")
    .eq("addon_key", "additional_university")
    .in("plan_version_id", versionIds);
  if (error) {
    // the add-on table does not exist until the V3 migration is applied
    return { available: false, plans: [] };
  }
  const addonByVersion = new Map(((data ?? []) as AddonRow[]).map((r) => [r.plan_version_id, r]));

  const plans: V3PublicPlan[] = chosen.map((item) => {
    const v = item.version!;
    const addon = addonByVersion.get(v.id);
    return {
      planId: item.plan.id,
      slug: item.plan.slug as V3PlanSlug,
      name: v.publicTitle,
      description: v.shortDescription,
      amountMinorUnits: v.amountMinorUnits,
      currency: v.currency,
      taxStatus: v.taxStatus,
      ctaText: v.ctaText,
      inclusions: visibleInclusionsInOrder(item.inclusions).map((inc) => ({ title: inc.title, group: inc.category ?? "Included", highlight: inc.isHighlight })),
      universityAddon: addon
        ? {
            includedQuantity: addon.included_quantity,
            unitAmountMinorUnits: Number(addon.unit_amount_minor_units),
            currency: addon.currency,
            maxAdditionalQuantity: addon.max_additional_quantity,
          }
        : null,
    };
  });

  const abroadOk = plans.filter((p) => p.slug !== V3_PLAN_SLUGS.verified).every((p) => p.universityAddon !== null);
  const verifiedOk = plans.find((p) => p.slug === V3_PLAN_SLUGS.verified)?.universityAddon === null;
  return { available: abroadOk && verifiedOk, plans: abroadOk && verifiedOk ? plans : [] };
}

export async function getV3Plan(slug: V3PlanSlug): Promise<V3PublicPlan | null> {
  const catalogue = await getV3Catalogue();
  return catalogue.plans.find((p) => p.slug === slug) ?? null;
}
