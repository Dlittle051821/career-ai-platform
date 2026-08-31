import { describe, expect, it } from "vitest";
import { formatMoney } from "@/lib/admin/money";
import { OFFICIAL_PRICING_CATALOG } from "./official-catalog";

/**
 * Fixture regression covering all nine official plan prices in integer
 * minor units, their session allowances, and their category placement —
 * see official-catalog.ts's own docblock for why this fixture exists
 * separately from the seed SQL it mirrors. If any of these numbers ever
 * changes without a corresponding spec change, this test is the tripwire.
 */
describe("OFFICIAL_PRICING_CATALOG", () => {
  it("has exactly nine plans", () => {
    expect(OFFICIAL_PRICING_CATALOG).toHaveLength(9);
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
      "school-counselling": 500_000,
      "class-11-counselling": 1_000_000,
      "class-12-counselling": 1_500_000,
      "bachelor-abroad-tier-1": 2_500_000,
      "bachelor-abroad-tier-2": 6_000_000,
      "bachelor-abroad-tier-3": 13_000_000,
      "master-abroad-tier-1": 2_700_000,
      "master-abroad-tier-2": 6_500_000,
      "master-abroad-tier-3": 14_000_000,
    });
  });

  it("matches the exact official major-unit (rupee) price list via formatMoney", () => {
    const bySlug = Object.fromEntries(OFFICIAL_PRICING_CATALOG.map((p) => [p.slug, formatMoney(p.amountMinorUnits, p.currency)]));
    expect(bySlug).toEqual({
      "school-counselling": "₹5,000.00",
      "class-11-counselling": "₹10,000.00",
      "class-12-counselling": "₹15,000.00",
      "bachelor-abroad-tier-1": "₹25,000.00",
      "bachelor-abroad-tier-2": "₹60,000.00",
      "bachelor-abroad-tier-3": "₹1,30,000.00",
      "master-abroad-tier-1": "₹27,000.00",
      "master-abroad-tier-2": "₹65,000.00",
      "master-abroad-tier-3": "₹1,40,000.00",
    });
  });

  it("matches the exact official counselling-session allowances", () => {
    const bySlug = Object.fromEntries(OFFICIAL_PRICING_CATALOG.map((p) => [p.slug, p.sessionCount]));
    expect(bySlug).toEqual({
      "school-counselling": 2,
      "class-11-counselling": 4,
      "class-12-counselling": 6,
      "bachelor-abroad-tier-1": 5,
      "bachelor-abroad-tier-2": 9,
      "bachelor-abroad-tier-3": 15,
      "master-abroad-tier-1": 5,
      "master-abroad-tier-2": 9,
      "master-abroad-tier-3": 15,
    });
  });

  it("assigns exactly three plans to each of school/bachelor/master abroad category groupings", () => {
    const schoolGuidance = OFFICIAL_PRICING_CATALOG.filter((p) => p.category === "school_counselling" || p.category === "class_11_counselling" || p.category === "class_12_counselling");
    const bachelorAbroad = OFFICIAL_PRICING_CATALOG.filter((p) => p.category === "bachelor_abroad");
    const masterAbroad = OFFICIAL_PRICING_CATALOG.filter((p) => p.category === "master_abroad");
    expect(schoolGuidance).toHaveLength(3);
    expect(bachelorAbroad).toHaveLength(3);
    expect(masterAbroad).toHaveLength(3);
  });

  it("only School Counselling carries a recommended-audience label — never invented for another plan", () => {
    for (const plan of OFFICIAL_PRICING_CATALOG) {
      if (plan.slug === "school-counselling") {
        expect(plan.audienceLabel).toBe("Classes 8–10");
      } else {
        expect(plan.audienceLabel).toBeNull();
      }
    }
  });

  it("Bachelor/Master Abroad Essential tiers have no dedicated/senior counsellor phrase — never invented", () => {
    const essentials = OFFICIAL_PRICING_CATALOG.filter((p) => p.slug.endsWith("tier-1"));
    for (const plan of essentials) {
      expect(plan.counsellorTier).toBeNull();
    }
  });

  it("Premium tiers include exactly 3 mock interviews and a senior counsellor", () => {
    const premiums = OFFICIAL_PRICING_CATALOG.filter((p) => p.slug.endsWith("tier-3"));
    for (const plan of premiums) {
      expect(plan.mockInterviewCount).toBe(3);
      expect(plan.counsellorTier).toMatch(/^Senior/);
    }
  });

  it("Bachelor Abroad Plus has no fixed mock-interview count — the spec gives only 'where applicable' wording, never a number", () => {
    const plusBachelor = OFFICIAL_PRICING_CATALOG.find((p) => p.slug === "bachelor-abroad-tier-2");
    expect(plusBachelor?.mockInterviewCount).toBeNull();
  });

  it("Master Abroad Plus includes exactly one mock interview", () => {
    const plusMaster = OFFICIAL_PRICING_CATALOG.find((p) => p.slug === "master-abroad-tier-2");
    expect(plusMaster?.mockInterviewCount).toBe(1);
  });
});
