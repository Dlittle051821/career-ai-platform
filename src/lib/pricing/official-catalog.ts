/**
 * Milestone 12 — a plain-data fixture of the eight current official NextWise
 * pricing packages, sourced verbatim from the M12 commercial specification
 * (prices, minor-unit values, session counts, and comparison-table limits).
 * This is NOT read by any runtime code path —
 * supabase/seed/0007_m12_current_pricing_catalogue_seed.sql is the actual
 * source of truth that gets written to the database. This module exists
 * purely so official-catalog.test.ts has one place to assert "all eight
 * official prices, minor units, and session allowances are exactly right"
 * as a regression fixture — same "fixture regression" convention referenced
 * by vitest.config.mts's own docblock for src/lib/pricing/. If a price or
 * session count ever needs to change, it must change in the spec, then
 * here, then in a new pricing_plan_versions row via a real admin-published
 * version — never the other way around.
 *
 * History: the previous nine-plan catalogue (School/Class 11/Class 12
 * Counselling, Bachelor/Master Abroad Tier 1/2/3) was superseded by this
 * eight-plan catalogue in Milestone 12. The old catalogue's seed rows
 * (supabase/seed/0004_pricing_offers_seed.sql, 0005_pricing_inclusions_seed.sql)
 * were never run against the live/staging database and are kept only as a
 * historical record — see 0007_m12_current_pricing_catalogue_seed.sql's own
 * header for the full reasoning.
 *
 * Launch Essential and Launch Pro are a genuinely new product concept with
 * no prior authoritative session/limit data, so their presentation fields
 * are honestly `null` rather than invented — the public pricing card falls
 * back to NEUTRAL_SCOPE_FALLBACK text for these two plans.
 */

export type OfficialPricingCategory = "school_counselling" | "class_11_counselling" | "class_12_counselling" | "bachelor_abroad" | "master_abroad";

export interface OfficialPlanFixture {
  slug: string;
  category: OfficialPricingCategory;
  publicTitle: string;
  amountMinorUnits: number;
  currency: "INR";
  sessionCount: number | null;
  audienceLabel: string | null;
  universityShortlistLimit: number | null;
  applicationSupportLimit: number | null;
  sopReviewRounds: number | null;
  mockInterviewCount: number | null;
  counsellorTier: string | null;
}

export const OFFICIAL_PRICING_CATALOG: OfficialPlanFixture[] = [
  {
    slug: "launch-essential",
    category: "school_counselling",
    publicTitle: "Launch Essential",
    amountMinorUnits: 500_000,
    currency: "INR",
    sessionCount: null,
    audienceLabel: null,
    universityShortlistLimit: null,
    applicationSupportLimit: null,
    sopReviewRounds: null,
    mockInterviewCount: null,
    counsellorTier: null,
  },
  {
    slug: "launch-pro",
    category: "school_counselling",
    publicTitle: "Launch Pro",
    amountMinorUnits: 1_000_000,
    currency: "INR",
    sessionCount: null,
    audienceLabel: null,
    universityShortlistLimit: null,
    applicationSupportLimit: null,
    sopReviewRounds: null,
    mockInterviewCount: null,
    counsellorTier: null,
  },
  {
    slug: "bachelor-abroad-essential",
    category: "bachelor_abroad",
    publicTitle: "Bachelor Abroad Essential",
    amountMinorUnits: 1_500_000,
    currency: "INR",
    sessionCount: 5,
    audienceLabel: null,
    universityShortlistLimit: 8,
    applicationSupportLimit: 3,
    sopReviewRounds: 1,
    mockInterviewCount: null,
    counsellorTier: null,
  },
  {
    slug: "bachelor-abroad-plus",
    category: "bachelor_abroad",
    publicTitle: "Bachelor Abroad Plus",
    amountMinorUnits: 7_000_000,
    currency: "INR",
    sessionCount: 9,
    audienceLabel: null,
    universityShortlistLimit: 12,
    applicationSupportLimit: 6,
    sopReviewRounds: 2,
    mockInterviewCount: null,
    counsellorTier: "Dedicated counsellor",
  },
  {
    slug: "bachelor-abroad-premium",
    category: "bachelor_abroad",
    publicTitle: "Bachelor Abroad Premium",
    amountMinorUnits: 12_000_000,
    currency: "INR",
    sessionCount: 15,
    audienceLabel: null,
    universityShortlistLimit: 18,
    applicationSupportLimit: 10,
    sopReviewRounds: 3,
    mockInterviewCount: 3,
    counsellorTier: "Senior dedicated counsellor",
  },
  {
    slug: "master-abroad-essential",
    category: "master_abroad",
    publicTitle: "Master Abroad Essential",
    amountMinorUnits: 1_600_000,
    currency: "INR",
    sessionCount: 5,
    audienceLabel: null,
    universityShortlistLimit: 8,
    applicationSupportLimit: 3,
    sopReviewRounds: 1,
    mockInterviewCount: null,
    counsellorTier: null,
  },
  {
    slug: "master-abroad-plus",
    category: "master_abroad",
    publicTitle: "Master Abroad Plus",
    amountMinorUnits: 7_500_000,
    currency: "INR",
    sessionCount: 9,
    audienceLabel: null,
    universityShortlistLimit: 12,
    applicationSupportLimit: 6,
    sopReviewRounds: 2,
    mockInterviewCount: 1,
    counsellorTier: "Dedicated postgraduate counsellor",
  },
  {
    slug: "master-abroad-premium",
    category: "master_abroad",
    publicTitle: "Master Abroad Premium",
    amountMinorUnits: 12_500_000,
    currency: "INR",
    sessionCount: 15,
    audienceLabel: null,
    universityShortlistLimit: 18,
    applicationSupportLimit: 10,
    sopReviewRounds: 3,
    mockInterviewCount: 3,
    counsellorTier: "Senior postgraduate admissions counsellor",
  },
];
