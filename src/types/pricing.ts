/**
 * Milestone 10 — domain types for NextWise Pricing & Offers. Mirrors the
 * convention established in src/types/payments.ts: these are the camelCase
 * app-level shapes; the snake_case <-> camelCase mapping lives only in
 * src/lib/supabase/pricing/*.ts and src/lib/supabase/admin/pricing.ts (see
 * those files' docblocks).
 */

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export const PRICING_CATEGORIES = [
  "school_counselling",
  "class_11_counselling",
  "class_12_counselling",
  "bachelor_abroad",
  "master_abroad",
] as const;
export type PricingCategory = (typeof PRICING_CATEGORIES)[number];

export const PRICING_CATEGORY_LABELS: Record<PricingCategory, string> = {
  school_counselling: "School Counselling",
  class_11_counselling: "Class 11 Counselling",
  class_12_counselling: "Class 12 Counselling",
  bachelor_abroad: "Bachelor Abroad",
  master_abroad: "Master Abroad",
};

export interface PricingPlan {
  id: string;
  slug: string;
  category: PricingCategory;
  internalName: string;
  displayOrder: number;
  isRecommended: boolean;
  isActive: boolean;
  currentVersionId: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Plan versions
// ---------------------------------------------------------------------------

export const PRICING_PLAN_VERSION_STATUSES = ["draft", "published", "archived"] as const;
export type PricingPlanVersionStatus = (typeof PRICING_PLAN_VERSION_STATUSES)[number];

export const PRICING_TAX_STATUSES = ["unconfigured", "tax_exclusive", "tax_inclusive"] as const;
export type PricingTaxStatus = (typeof PRICING_TAX_STATUSES)[number];

export const PRICING_TAX_STATUS_LABELS: Record<PricingTaxStatus, string> = {
  unconfigured: "Not configured",
  tax_exclusive: "Tax added on top",
  tax_inclusive: "Tax included in price",
};

/** One included-service or exclusion line, always admin-entered — never fabricated by application code. */
export interface PricingServiceItem {
  label: string;
  description?: string;
}

export interface PricingPlanVersion {
  id: string;
  planId: string;
  versionNumber: number;
  publicTitle: string;
  shortDescription: string | null;
  detailedDescription: string | null;
  currency: string;
  amountMinorUnits: number;
  /** Always "one_time" — see 0007's pricing_plan_versions_payment_type_check. Kept as a string (not a boolean) for forward compatibility with a future, separately reviewed subscription feature. */
  paymentType: "one_time";
  billingInterval: null;
  includedServices: PricingServiceItem[];
  exclusions: PricingServiceItem[];
  ctaText: string | null;
  taxStatus: PricingTaxStatus;
  status: PricingPlanVersionStatus;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;

  // -------------------------------------------------------------------------
  // Milestone 11 — presentation settings / comparison-table fields
  // (0008_pricing_inclusions_and_presentation.sql PART 2). Distinct from the
  // structured inclusions list (PricingInclusion below) — these are the
  // specific facts shown prominently near the top of a pricing card and in
  // the Bachelor/Master Abroad comparison table. All nullable: null means
  // "not yet configured by an admin", rendered as "—" (formatComparisonCell
  // in src/lib/pricing/plan-versions.ts), never a fabricated value.
  // -------------------------------------------------------------------------
  /** Number of individual counselling sessions included. */
  sessionCount: number | null;
  /** e.g. "Each session lasts approximately 45–60 minutes". */
  sessionDurationNote: string | null;
  /** e.g. "Classes 8–10" — School Counselling only in the official catalog, but generic on every plan. */
  audienceLabel: string | null;
  /** Comparison-table field: "up to N universities" shortlisted. */
  universityShortlistLimit: number | null;
  /** Comparison-table field: "support for up to N university applications". */
  applicationSupportLimit: number | null;
  /** Comparison-table field: number of SOP/personal-statement review rounds. */
  sopReviewRounds: number | null;
  /** Free-text scholarship-support description — kept as a note, not a number, because the source copy does not reduce to one comparable integer across every tier. */
  scholarshipSupportNote: string | null;
  /** Comparison-table field: number of mock interviews included. Null when the source copy mentions interview prep without a fixed count. */
  mockInterviewCount: number | null;
  /** e.g. "Dedicated counsellor", "Senior dedicated counsellor". Null when the tier's copy does not mention a dedicated/senior counsellor. */
  counsellorTier: string | null;
  /** e.g. "90 days of email or WhatsApp support", "Up to 12 months". */
  supportDurationNote: string | null;
}

// ---------------------------------------------------------------------------
// Inclusions (Milestone 11 — 0008_pricing_inclusions_and_presentation.sql PART 1)
// ---------------------------------------------------------------------------

/** One structured, ordered included-service line under a pricing_plan_versions row. Always admin-entered — never fabricated by application code, same discipline as PricingServiceItem above. */
export interface PricingInclusion {
  id: string;
  planVersionId: string;
  displayOrder: number;
  title: string;
  explanation: string | null;
  category: string | null;
  numericAllowance: number | null;
  unit: string | null;
  isHighlight: boolean;
  isActive: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** The jsonb shape frozen into pricing_purchases.inclusions_at_purchase and public.purchase_pricing_plan()'s snapshot — a trimmed-down copy of PricingInclusion with no id/timestamps, since a purchase snapshot is a point-in-time copy, not a live row. */
export interface PricingInclusionSnapshot {
  title: string;
  explanation: string | null;
  category: string | null;
  numericAllowance: number | null;
  unit: string | null;
  isHighlight: boolean;
}

/** The jsonb shape frozen into pricing_purchases.presentation_limits_at_purchase. */
export interface PricingPresentationLimitsSnapshot {
  sessionDurationNote: string | null;
  audienceLabel: string | null;
  universityShortlistLimit: number | null;
  applicationSupportLimit: number | null;
  sopReviewRounds: number | null;
  scholarshipSupportNote: string | null;
  mockInterviewCount: number | null;
  counsellorTier: string | null;
  supportDurationNote: string | null;
}

/** A plan joined with its currently live (published + effective) version, if it has one — what the public pricing page actually renders one of. `inclusions` is always the active, display-ordered list for `version` (empty when `version` is null or has none yet). */
export interface PricingPlanWithVersion {
  plan: PricingPlan;
  version: PricingPlanVersion | null;
  offer: PricingOffer | null;
  inclusions: PricingInclusion[];
}

// ---------------------------------------------------------------------------
// Offers
// ---------------------------------------------------------------------------

export const PRICING_OFFER_STATUSES = ["draft", "published", "archived"] as const;
export type PricingOfferStatus = (typeof PRICING_OFFER_STATUSES)[number];

export type PricingDiscountType = "fixed" | "percentage";

export interface PricingOffer {
  id: string;
  planId: string;
  publicOfferName: string;
  internalDescription: string | null;
  discountType: PricingDiscountType;
  /** Basis points, e.g. 1000 = 10.00%. Only set when discountType === "percentage". */
  discountPercentBps: number | null;
  /** Integer minor units. Only set when discountType === "fixed". */
  discountAmountMinorUnits: number | null;
  discountCurrency: string | null;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  status: PricingOfferStatus;
  couponCode: string | null;
  maxRedemptions: number | null;
  perUserLimit: number | null;
  redemptionCount: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Purchases
// ---------------------------------------------------------------------------

export interface PricingPurchase {
  id: string;
  studentUserId: string | null;
  planId: string | null;
  planVersionId: string | null;
  planNameAtPurchase: string;
  includedServicesAtPurchase: PricingServiceItem[];
  originalAmountMinorUnits: number;
  discountMinorUnits: number;
  taxMinorUnits: number;
  finalAmountMinorUnits: number;
  currency: string;
  offerId: string | null;
  couponCodeUsed: string | null;
  invoiceId: string | null;
  purchasedAt: string;
  /** Milestone 11 — session allowance frozen at purchase (0008 PART 4). Null for a purchase made before this column existed. */
  sessionCountAtPurchase: number | null;
  /** Milestone 11 — ordered, active inclusions frozen at purchase. Empty for a purchase made before this column existed. */
  inclusionsAtPurchase: PricingInclusionSnapshot[];
  /** Milestone 11 — comparison-limit fields frozen at purchase. */
  presentationLimitsAtPurchase: PricingPresentationLimitsSnapshot | null;
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export const PRICING_ANALYTICS_EVENT_TYPES = ["plan_view", "plan_selected", "checkout_started"] as const;
export type PricingAnalyticsEventType = (typeof PRICING_ANALYTICS_EVENT_TYPES)[number];

// ---------------------------------------------------------------------------
// Shared list-page shape (mirrors src/types/admin.ts's AdminListResult)
// ---------------------------------------------------------------------------

export interface PricingListResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
