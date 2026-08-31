/**
 * Milestone 11 — a plain-data fixture of the nine official NextWise plans,
 * sourced verbatim from the authoritative client specification (prices,
 * minor-unit values, session counts, and comparison-table limits). This is
 * NOT read by any runtime code path — supabase/seed/0004_pricing_offers_seed.sql
 * and 0005_pricing_inclusions_seed.sql are the actual source of truth that
 * gets written to the database. This module exists purely so
 * official-catalog.test.ts has one place to assert "all nine official
 * prices, minor units, and session allowances are exactly right" as a
 * regression fixture — same "fixture regression" convention referenced by
 * vitest.config.mts's own docblock for src/lib/pricing/. If a price or
 * session count ever needs to change, it must change in the spec, then
 * here, then in a new pricing_plan_versions row via a real admin-published
 * version — never the other way around.
 */

export type OfficialPricingCategory = "school_counselling" | "class_11_counselling" | "class_12_counselling" | "bachelor_abroad" | "master_abroad";

export interface OfficialPlanFixture {
  slug: string;
  category: OfficialPricingCategory;
  publicTitle: string;
  amountMinorUnits: number;
  currency: "INR";
  sessionCount: number;
  audienceLabel: string | null;
  universityShortlistLimit: number | null;
  applicationSupportLimit: number | null;
  sopReviewRounds: number | null;
  mockInterviewCount: number | null;
  counsellorTier: string | null;
}

export const OFFICIAL_PRICING_CATALOG: OfficialPlanFixture[] = [
  {
    slug: "school-counselling",
    category: "school_counselling",
    publicTitle: "School Counselling",
    amountMinorUnits: 500_000,
    currency: "INR",
    sessionCount: 2,
    audienceLabel: "Classes 8–10",
    universityShortlistLimit: null,
    applicationSupportLimit: null,
    sopReviewRounds: null,
    mockInterviewCount: null,
    counsellorTier: null,
  },
  {
    slug: "class-11-counselling",
    category: "class_11_counselling",
    publicTitle: "Class 11 Counselling",
    amountMinorUnits: 1_000_000,
    currency: "INR",
    sessionCount: 4,
    audienceLabel: null,
    universityShortlistLimit: null,
    applicationSupportLimit: null,
    sopReviewRounds: null,
    mockInterviewCount: null,
    counsellorTier: null,
  },
  {
    slug: "class-12-counselling",
    category: "class_12_counselling",
    publicTitle: "Class 12 Counselling",
    amountMinorUnits: 1_500_000,
    currency: "INR",
    sessionCount: 6,
    audienceLabel: null,
    universityShortlistLimit: 12,
    applicationSupportLimit: null,
    sopReviewRounds: null,
    mockInterviewCount: null,
    counsellorTier: null,
  },
  {
    slug: "bachelor-abroad-tier-1",
    category: "bachelor_abroad",
    publicTitle: "Bachelor Abroad Essential",
    amountMinorUnits: 2_500_000,
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
    slug: "bachelor-abroad-tier-2",
    category: "bachelor_abroad",
    publicTitle: "Bachelor Abroad Plus",
    amountMinorUnits: 6_000_000,
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
    slug: "bachelor-abroad-tier-3",
    category: "bachelor_abroad",
    publicTitle: "Bachelor Abroad Premium",
    amountMinorUnits: 13_000_000,
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
    slug: "master-abroad-tier-1",
    category: "master_abroad",
    publicTitle: "Master Abroad Essential",
    amountMinorUnits: 2_700_000,
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
    slug: "master-abroad-tier-2",
    category: "master_abroad",
    publicTitle: "Master Abroad Plus",
    amountMinorUnits: 6_500_000,
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
    slug: "master-abroad-tier-3",
    category: "master_abroad",
    publicTitle: "Master Abroad Premium",
    amountMinorUnits: 14_000_000,
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
