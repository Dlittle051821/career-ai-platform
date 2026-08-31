import { createClient } from "../server";
import type { PricingCategory, PricingInclusion, PricingOffer, PricingPlan, PricingPlanVersion, PricingPlanWithVersion, PricingServiceItem } from "@/types/pricing";

/**
 * PUBLIC pricing reads — used by /pricing (src/app/(site)/pricing/page.tsx)
 * and the homepage pricing teaser. Deliberately does NOT check any admin
 * permission and works for a signed-out visitor: gated purely by
 * pricing_plans/pricing_plan_versions/pricing_offers' own "Anyone can
 * read..." RLS policies (0007_nextwise_pricing_offers.sql PARTs 1/2/3),
 * which already restrict results to active plans, published+currently-
 * effective versions, and active+published+currently-running offers. This
 * file adds no additional filtering on top of what RLS already guarantees
 * — it exists only to shape rows into the app's camelCase types, same
 * convention as src/lib/supabase/payments/student-invoices.ts is to
 * src/lib/supabase/admin/invoices.ts.
 */

function logDbError(context: string, error: unknown) {
  console.error(`[pricing/public-plans] ${context}:`, error);
}

interface PlanRow {
  id: string;
  slug: string;
  category: string;
  internal_name: string;
  display_order: number;
  is_recommended: boolean;
  is_active: boolean;
  current_version_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

interface VersionRow {
  id: string;
  plan_id: string;
  version_number: number;
  public_title: string;
  short_description: string | null;
  detailed_description: string | null;
  currency: string;
  amount_minor_units: number;
  payment_type: string;
  billing_interval: string | null;
  included_services: unknown;
  exclusions: unknown;
  cta_text: string | null;
  tax_status: string;
  status: string;
  effective_from: string | null;
  effective_until: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  session_count: number | null;
  session_duration_note: string | null;
  audience_label: string | null;
  university_shortlist_limit: number | null;
  application_support_limit: number | null;
  sop_review_rounds: number | null;
  scholarship_support_note: string | null;
  mock_interview_count: number | null;
  counsellor_tier: string | null;
  support_duration_note: string | null;
}

interface InclusionRow {
  id: string;
  plan_version_id: string;
  display_order: number;
  title: string;
  explanation: string | null;
  category: string | null;
  numeric_allowance: number | null;
  unit: string | null;
  is_highlight: boolean;
  is_active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

interface OfferRow {
  id: string;
  plan_id: string;
  public_offer_name: string;
  internal_description: string | null;
  discount_type: string;
  discount_percent_bps: number | null;
  discount_amount_minor_units: number | null;
  discount_currency: string | null;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  status: string;
  coupon_code: string | null;
  max_redemptions: number | null;
  per_user_limit: number | null;
  redemption_count: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

function toServiceItems(value: unknown): PricingServiceItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is PricingServiceItem => typeof v === "object" && v !== null && typeof (v as PricingServiceItem).label === "string");
}

export function toPricingPlan(row: PlanRow): PricingPlan {
  return {
    id: row.id,
    slug: row.slug,
    category: row.category as PricingCategory,
    internalName: row.internal_name,
    displayOrder: row.display_order,
    isRecommended: row.is_recommended,
    isActive: row.is_active,
    currentVersionId: row.current_version_id,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toPricingPlanVersion(row: VersionRow): PricingPlanVersion {
  return {
    id: row.id,
    planId: row.plan_id,
    versionNumber: row.version_number,
    publicTitle: row.public_title,
    shortDescription: row.short_description,
    detailedDescription: row.detailed_description,
    currency: row.currency,
    amountMinorUnits: row.amount_minor_units,
    paymentType: "one_time",
    billingInterval: null,
    includedServices: toServiceItems(row.included_services),
    exclusions: toServiceItems(row.exclusions),
    ctaText: row.cta_text,
    taxStatus: row.tax_status as PricingPlanVersion["taxStatus"],
    status: row.status as PricingPlanVersion["status"],
    effectiveFrom: row.effective_from,
    effectiveUntil: row.effective_until,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sessionCount: row.session_count,
    sessionDurationNote: row.session_duration_note,
    audienceLabel: row.audience_label,
    universityShortlistLimit: row.university_shortlist_limit,
    applicationSupportLimit: row.application_support_limit,
    sopReviewRounds: row.sop_review_rounds,
    scholarshipSupportNote: row.scholarship_support_note,
    mockInterviewCount: row.mock_interview_count,
    counsellorTier: row.counsellor_tier,
    supportDurationNote: row.support_duration_note,
  };
}

export function toPricingInclusion(row: InclusionRow): PricingInclusion {
  return {
    id: row.id,
    planVersionId: row.plan_version_id,
    displayOrder: row.display_order,
    title: row.title,
    explanation: row.explanation,
    category: row.category,
    numericAllowance: row.numeric_allowance,
    unit: row.unit,
    isHighlight: row.is_highlight,
    isActive: row.is_active,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toPricingOffer(row: OfferRow): PricingOffer {
  return {
    id: row.id,
    planId: row.plan_id,
    publicOfferName: row.public_offer_name,
    internalDescription: row.internal_description,
    discountType: row.discount_type as PricingOffer["discountType"],
    discountPercentBps: row.discount_percent_bps,
    discountAmountMinorUnits: row.discount_amount_minor_units,
    discountCurrency: row.discount_currency,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    isActive: row.is_active,
    status: row.status as PricingOffer["status"],
    couponCode: row.coupon_code,
    maxRedemptions: row.max_redemptions,
    perUserLimit: row.per_user_limit,
    redemptionCount: row.redemption_count,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Every active plan, each joined with its current live version (if any)
 * and any currently-running offer for that plan (if any) — exactly what
 * the public pricing page needs to render its five sections. A plan with
 * no live version yet simply renders with `version: null` (see the public
 * pricing page's empty-state handling); this is not an error.
 */
export async function listPublicPricingPlans(): Promise<PricingPlanWithVersion[]> {
  const supabase = await createClient();

  const { data: planRows, error: planError } = await supabase.from("pricing_plans").select("*").order("display_order", { ascending: true });
  if (planError) {
    logDbError("listPublicPricingPlans:plans", planError);
    return [];
  }
  const plans = (planRows ?? []) as PlanRow[];
  if (plans.length === 0) return [];
  const planIds = plans.map((p) => p.id);

  const [{ data: versionRows, error: versionError }, { data: offerRows, error: offerError }] = await Promise.all([
    supabase.from("pricing_plan_versions").select("*").in("plan_id", planIds).order("version_number", { ascending: false }),
    supabase.from("pricing_offers").select("*").in("plan_id", planIds),
  ]);
  if (versionError) logDbError("listPublicPricingPlans:versions", versionError);
  if (offerError) logDbError("listPublicPricingPlans:offers", offerError);

  // RLS already restricts these rows to published+currently-effective
  // versions and active+published+currently-running offers — this file
  // just picks, per plan, the highest version_number (in case more than
  // one happens to be simultaneously visible; see
  // src/lib/supabase/admin/pricing.ts's publishPricingPlanVersion for why
  // that should not normally happen) and the first visible offer.
  const versionsByPlan = new Map<string, VersionRow>();
  for (const row of (versionRows ?? []) as VersionRow[]) {
    if (!versionsByPlan.has(row.plan_id)) versionsByPlan.set(row.plan_id, row);
  }
  const offerByPlan = new Map<string, OfferRow>();
  for (const row of (offerRows ?? []) as OfferRow[]) {
    if (!offerByPlan.has(row.plan_id)) offerByPlan.set(row.plan_id, row);
  }

  const versionIds = [...versionsByPlan.values()].map((v) => v.id);
  const inclusionsByVersion = await fetchInclusionsByVersion(supabase, versionIds);

  return plans.map((row) => {
    const versionRow = versionsByPlan.get(row.id);
    const offerRow = offerByPlan.get(row.id);
    return {
      plan: toPricingPlan(row),
      version: versionRow ? toPricingPlanVersion(versionRow) : null,
      offer: offerRow ? toPricingOffer(offerRow) : null,
      inclusions: versionRow ? (inclusionsByVersion.get(versionRow.id) ?? []) : [],
    };
  });
}

/** Fetches every visible pricing_plan_inclusions row for the given version ids and groups them by plan_version_id, sorted by display_order — RLS already restricts rows to active inclusions of a published+currently-effective+active-plan version (0008 PART 1.1), so this is a plain fetch-and-group. */
async function fetchInclusionsByVersion(supabase: Awaited<ReturnType<typeof createClient>>, versionIds: string[]): Promise<Map<string, PricingInclusion[]>> {
  const byVersion = new Map<string, PricingInclusion[]>();
  if (versionIds.length === 0) return byVersion;

  const { data, error } = await supabase.from("pricing_plan_inclusions").select("*").in("plan_version_id", versionIds).order("display_order", { ascending: true });
  if (error) {
    logDbError("fetchInclusionsByVersion", error);
    return byVersion;
  }
  for (const row of (data ?? []) as InclusionRow[]) {
    const inclusion = toPricingInclusion(row);
    const list = byVersion.get(inclusion.planVersionId) ?? [];
    list.push(inclusion);
    byVersion.set(inclusion.planVersionId, list);
  }
  return byVersion;
}

/** One active plan by slug, for a plan-detail/checkout-summary page. Returns null if the plan doesn't exist, isn't active, or (via RLS) has no visible version. */
export async function getPublicPricingPlanBySlug(slug: string): Promise<PricingPlanWithVersion | null> {
  const supabase = await createClient();

  const { data: planRow, error: planError } = await supabase.from("pricing_plans").select("*").eq("slug", slug).eq("is_active", true).maybeSingle();
  if (planError) {
    logDbError("getPublicPricingPlanBySlug:plan", planError);
    return null;
  }
  if (!planRow) return null;
  const plan = planRow as PlanRow;

  const [{ data: versionRows }, { data: offerRows }] = await Promise.all([
    supabase.from("pricing_plan_versions").select("*").eq("plan_id", plan.id).order("version_number", { ascending: false }).limit(1),
    supabase.from("pricing_offers").select("*").eq("plan_id", plan.id).limit(1),
  ]);
  const versionRow = ((versionRows ?? []) as VersionRow[])[0];
  const offerRow = ((offerRows ?? []) as OfferRow[])[0];
  const inclusionsByVersion = versionRow ? await fetchInclusionsByVersion(supabase, [versionRow.id]) : new Map<string, PricingInclusion[]>();

  return {
    plan: toPricingPlan(plan),
    version: versionRow ? toPricingPlanVersion(versionRow) : null,
    offer: offerRow ? toPricingOffer(offerRow) : null,
    inclusions: versionRow ? (inclusionsByVersion.get(versionRow.id) ?? []) : [],
  };
}
