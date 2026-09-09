import { describe, expect, it } from "vitest";
import { formatMoney } from "@/lib/admin/money";
import { OFFICIAL_PRICING_CATALOG } from "./official-catalog";

/**
 * Fixture regression covering all eight current official plan prices in
 * integer minor units, their session allowances, and their category
 * placement — see official-catalog.ts's own docblock for why this fixture
 * exists separately from the seed SQL it mirrors. If any of these numbers
 * ever changes without a corresponding spec change, this test is the
 * tripwire.
 */
describe("OFFICIAL_PRICING_CATALOG", () => {
  it("has exactly eight plans", () => {
    expect(OFFICIAL_PRICING_CATALOG).toHaveLength(8);
  });

  it("every slug is unique", () => {
    const slugs = OFFICIAL_PRICING_CATALOG.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("every plan is priced in INR with a positive integer minor-units amount", () => {
    for (const plan of OFFICIAL_PRICING_CATALOG) {
      expect(plan.currency).toBe("INR");
      expect(Number.isInteger(plan.amountMinorUnits)).toBe(true);
      expect(plan.amountMinorUnits).toBeGreaterThan(0);
    }
  });

  it("matches the exact official price list (minor units)", () => {
    const bySlug = Object.fromEntries(OFFICIAL_PRICING_CATALOG.map((p) => [p.slug, p.amountMinorUnits]));
    expect(bySlug).toEqual({
      "launch-essential": 500_000,
      "launch-pro": 1_000_000,
      "bachelor-abroad-essential": 1_500_000,
      "bachelor-abroad-plus": 7_000_000,
      "bachelor-abroad-premium": 12_000_000,
      "master-abroad-essential": 1_600_000,
      "master-abroad-plus": 7_500_000,
      "master-abroad-premium": 12_500_000,
    });
  });

  it("matches the exact official major-unit (rupee) price list via formatMoney", () => {
    const bySlug = Object.fromEntries(OFFICIAL_PRICING_CATALOG.map((p) => [p.slug, formatMoney(p.amountMinorUnits, p.currency)]));
    expect(bySlug).toEqual({
      "launch-essential": "₹5,000.00",
      "launch-pro": "₹10,000.00",
      "bachelor-abroad-essential": "₹15,000.00",
      "bachelor-abroad-plus": "₹70,000.00",
      "bachelor-abroad-premium": "₹1,20,000.00",
      "master-abroad-essential": "₹16,000.00",
      "master-abroad-plus": "₹75,000.00",
      "master-abroad-premium": "₹1,25,000.00",
    });
  });

  it("matches the exact official counselling-session allowances, honestly null for Launch plans", () => {
    const bySlug = Object.fromEntries(OFFICIAL_PRICING_CATALOG.map((p) => [p.slug, p.sessionCount]));
    expect(bySlug).toEqual({
      "launch-essential": null,
      "launch-pro": null,
      "bachelor-abroad-essential": 5,
      "bachelor-abroad-plus": 9,
      "bachelor-abroad-premium": 15,
      "master-abroad-essential": 5,
      "master-abroad-plus": 9,
      "master-abroad-premium": 15,
    });
  });

  it("assigns two India Guidance (Launch) plans, three Bachelor Abroad plans, and three Master Abroad plans", () => {
    const indiaGuidance = OFFICIAL_PRICING_CATALOG.filter((p) => p.category === "school_counselling" || p.category === "class_11_counselling" || p.category === "class_12_counselling");
    const bachelorAbroad = OFFICIAL_PRICING_CATALOG.filter((p) => p.category === "bachelor_abroad");
    const masterAbroad = OFFICIAL_PRICING_CATALOG.filter((p) => p.category === "master_abroad");
    expect(indiaGuidance).toHaveLength(2);
    expect(bachelorAbroad).toHaveLength(3);
    expect(masterAbroad).toHaveLength(3);
  });

  it("Launch Essential and Launch Pro carry no fabricated session/limit data — a genuinely new package with no prior authoritative service scope", () => {
    const launchPlans = OFFICIAL_PRICING_CATALOG.filter((p) => p.slug === "launch-essential" || p.slug === "launch-pro");
    expect(launchPlans).toHaveLength(2);
    for (const plan of launchPlans) {
      expect(plan.sessionCount).toBeNull();
      expect(plan.audienceLabel).toBeNull();
      expect(plan.universityShortlistLimit).toBeNull();
      expect(plan.applicationSupportLimit).toBeNull();
      expect(plan.sopReviewRounds).toBeNull();
      expect(plan.mockInterviewCount).toBeNull();
      expect(plan.counsellorTier).toBeNull();
    }
  });

  it("no plan carries a recommended-audience label — never invented for the current catalogue", () => {
    for (const plan of OFFICIAL_PRICING_CATALOG) {
      expect(plan.audienceLabel).toBeNull();
    }
  });

  it("Bachelor/Master Abroad Essential tiers have no dedicated/senior counsellor phrase — never invented", () => {
    const essentials = OFFICIAL_PRICING_CATALOG.filter((p) => p.slug.endsWith("-essential"));
    expect(essentials.length).toBeGreaterThan(0);
    for (const plan of essentials) {
      expect(plan.counsellorTier).toBeNull();
    }
  });

  it("Premium tiers include exactly 3 mock interviews and a senior counsellor", () => {
    const premiums = OFFICIAL_PRICING_CATALOG.filter((p) => p.slug.endsWith("-premium"));
    expect(premiums.length).toBeGreaterThan(0);
    for (const plan of premiums) {
      expect(plan.mockInterviewCount).toBe(3);
      expect(plan.counsellorTier).toMatch(/^Senior/);
    }
  });

  it("Bachelor Abroad Plus has no fixed mock-interview count — the spec gives only 'where applicable' wording, never a number", () => {
    const plusBachelor = OFFICIAL_PRICING_CATALOG.find((p) => p.slug === "bachelor-abroad-plus");
    expect(plusBachelor?.mockInterviewCount).toBeNull();
  });

  it("Master Abroad Plus includes exactly one mock interview", () => {
    const plusMaster = OFFICIAL_PRICING_CATALOG.find((p) => p.slug === "master-abroad-plus");
    expect(plusMaster?.mockInterviewCount).toBe(1);
  });
});
