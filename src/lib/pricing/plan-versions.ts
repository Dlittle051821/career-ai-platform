import type { PricingInclusion, PricingPlanVersion } from "@/types/pricing";

/**
 * Pure, framework-free pricing-plan-version logic — no Supabase import, no
 * React import, same "pure, dependency-free" convention as
 * src/lib/payments/invoice-math.ts and src/lib/payments/tax.ts. Every
 * function here is mirrored (not called — SQL cannot import TypeScript) by
 * the equivalent logic inside public.purchase_pricing_plan() and the RLS
 * policies in supabase/migrations/0007_nextwise_pricing_offers.sql; the SQL
 * is the actually-authoritative copy for a real purchase, this module is
 * what the UI uses to decide what to render/enable without a network
 * round trip, and what src/config/pricing.ts's tests check against fixed
 * examples.
 */

/**
 * Neutral fallback copy shown for a plan whose current version has no
 * admin-entered included services yet — never invent a benefit, session
 * count, or scope on the plan's behalf. See docs/nextwise-pricing-offers-guide.md §2.
 */
export const NEUTRAL_SCOPE_FALLBACK = "Contact NextWise for the detailed service scope.";

/** True when `version` is published AND its effective window (if any) currently includes `now` — the exact condition PART 2's public RLS SELECT policy and purchase_pricing_plan() both apply. */
export function isVersionCurrentlyEffective(version: Pick<PricingPlanVersion, "status" | "effectiveFrom" | "effectiveUntil">, now: Date = new Date()): boolean {
  if (version.status !== "published") return false;
  if (version.effectiveFrom && new Date(version.effectiveFrom) > now) return false;
  if (version.effectiveUntil && new Date(version.effectiveUntil) < now) return false;
  return true;
}

/** True when a version has at least one admin-entered included service — gates whether the public page shows real scope copy or NEUTRAL_SCOPE_FALLBACK. */
export function hasApprovedBenefits(version: Pick<PricingPlanVersion, "includedServices">): boolean {
  return version.includedServices.length > 0;
}

/** A short, honest label for how a version should be described in the UI — never claims "One-time payment" is anything but literal, and never emits "monthly"/"yearly" wording (spec: instalments/subscriptions are explicitly not implemented). */
export function paymentTypeLabel(version: Pick<PricingPlanVersion, "paymentType">): string {
  return version.paymentType === "one_time" ? "One-time payment" : version.paymentType;
}

// ---------------------------------------------------------------------------
// Milestone 11 — inclusions & comparison-table helpers
// (0008_pricing_inclusions_and_presentation.sql). Same "pure, framework-free"
// convention as everything above — the actually-authoritative ordering/
// filtering happens in public.purchase_pricing_plan()'s own inclusions query
// and in the RLS policy on pricing_plan_inclusions (both in 0008); this
// module is what the UI uses to render what the server already returned.
// ---------------------------------------------------------------------------

/** Inclusions in display order — ascending by displayOrder, ties broken by id for a stable sort. Never mutates the input array. */
export function sortInclusionsByDisplayOrder<T extends Pick<PricingInclusion, "displayOrder" | "id">>(inclusions: T[]): T[] {
  return [...inclusions].sort((a, b) => a.displayOrder - b.displayOrder || a.id.localeCompare(b.id));
}

/** Only the inclusions an admin has left active — matches pricing_plan_inclusions' own public RLS SELECT policy's `is_active = true` condition. */
export function activeInclusions<T extends Pick<PricingInclusion, "isActive">>(inclusions: T[]): T[] {
  return inclusions.filter((i) => i.isActive);
}

/** Active inclusions, in display order — the exact list the public pricing page's "included services" section should render. */
export function visibleInclusionsInOrder<T extends Pick<PricingInclusion, "displayOrder" | "id" | "isActive">>(inclusions: T[]): T[] {
  return sortInclusionsByDisplayOrder(activeInclusions(inclusions));
}

/** Only the inclusions marked as highlights — for a short "what stands out" summary distinct from the full list, e.g. on a compact card before the "View all services" disclosure is opened. */
export function highlightedInclusions<T extends Pick<PricingInclusion, "isHighlight" | "isActive" | "displayOrder" | "id">>(inclusions: T[]): T[] {
  return visibleInclusionsInOrder(inclusions).filter((i) => i.isHighlight);
}

/** The Bachelor/Master Abroad comparison-table row derived from one plan version's presentation fields — spec: "Counselling sessions, University shortlisting limit, Application-support limit, SOP review rounds, Scholarship support, Mock interviews, Dedicated or senior counsellor, Support duration". Every field may be null (not yet configured, or not applicable for this tier) — see formatComparisonCell for how the UI renders a null cell. */
export interface PricingComparisonRow {
  planId: string;
  publicTitle: string;
  sessionCount: number | null;
  universityShortlistLimit: number | null;
  applicationSupportLimit: number | null;
  sopReviewRounds: number | null;
  scholarshipSupportNote: string | null;
  mockInterviewCount: number | null;
  counsellorTier: string | null;
  supportDurationNote: string | null;
}

export function buildComparisonRow(
  planId: string,
  version: Pick<
    PricingPlanVersion,
    "publicTitle" | "sessionCount" | "universityShortlistLimit" | "applicationSupportLimit" | "sopReviewRounds" | "scholarshipSupportNote" | "mockInterviewCount" | "counsellorTier" | "supportDurationNote"
  >
): PricingComparisonRow {
  return {
    planId,
    publicTitle: version.publicTitle,
    sessionCount: version.sessionCount,
    universityShortlistLimit: version.universityShortlistLimit,
    applicationSupportLimit: version.applicationSupportLimit,
    sopReviewRounds: version.sopReviewRounds,
    scholarshipSupportNote: version.scholarshipSupportNote,
    mockInterviewCount: version.mockInterviewCount,
    counsellorTier: version.counsellorTier,
    supportDurationNote: version.supportDurationNote,
  };
}

/**
 * Renders one comparison-table cell value for display — a null/undefined
 * field becomes an em dash ("not applicable"/"not yet configured"), never a
 * fabricated number or guess. A number becomes its plain string form; text
 * fields pass through unchanged. Spec: "Do not hide important service
 * limitations in tooltips" / "never fabricate data to fill a box" — this is
 * the one place that rule is enforced for the comparison table specifically.
 */
export function formatComparisonCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return String(value);
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "—";
}
