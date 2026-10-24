import { describe, expect, it } from "vitest";
import {
  ABROAD_PRICING_CATEGORIES,
  CAREER_PRICING_CATEGORIES,
  classifyPurchaseEntitlements,
  productForCategory,
} from "./entitlements";
import { PRICING_CATEGORIES, type PricingCategory, type PricingPurchase } from "@/types/pricing";

function makePurchase(overrides: Partial<PricingPurchase> & { id: string }): PricingPurchase {
  return {
    studentUserId: "student-1",
    planId: "plan-1",
    planVersionId: "version-1",
    planNameAtPurchase: "Test Plan",
    includedServicesAtPurchase: [],
    originalAmountMinorUnits: 100000,
    discountMinorUnits: 0,
    taxMinorUnits: 0,
    finalAmountMinorUnits: 100000,
    currency: "INR",
    offerId: null,
    couponCodeUsed: null,
    invoiceId: null,
    purchasedAt: "2026-01-01T00:00:00.000Z",
    sessionCountAtPurchase: null,
    inclusionsAtPurchase: [],
    presentationLimitsAtPurchase: null,
    ...overrides,
  };
}

describe("productForCategory", () => {
  it("maps every PricingCategory to exactly one product, with no category left unclassified", () => {
    for (const category of PRICING_CATEGORIES) {
      expect(["career", "abroad"]).toContain(productForCategory(category));
    }
  });

  it("maps bachelor_abroad and master_abroad to abroad", () => {
    expect(productForCategory("bachelor_abroad")).toBe("abroad");
    expect(productForCategory("master_abroad")).toBe("abroad");
  });

  it("maps the three counselling categories to career", () => {
    expect(productForCategory("school_counselling")).toBe("career");
    expect(productForCategory("class_11_counselling")).toBe("career");
    expect(productForCategory("class_12_counselling")).toBe("career");
  });

  it("CAREER_PRICING_CATEGORIES and ABROAD_PRICING_CATEGORIES partition PRICING_CATEGORIES exactly, with no overlap and nothing missing", () => {
    const union = new Set<PricingCategory>([...CAREER_PRICING_CATEGORIES, ...ABROAD_PRICING_CATEGORIES]);
    expect(union.size).toBe(PRICING_CATEGORIES.length);
    for (const category of PRICING_CATEGORIES) expect(union.has(category)).toBe(true);
    const overlap = CAREER_PRICING_CATEGORIES.filter((c) => (ABROAD_PRICING_CATEGORIES as readonly string[]).includes(c));
    expect(overlap).toEqual([]);
  });
});

describe("classifyPurchaseEntitlements", () => {
  it("returns all-false/empty for no purchases", () => {
    const result = classifyPurchaseEntitlements([], new Map());
    expect(result).toEqual({
      hasCareerEntitlement: false,
      hasAbroadEntitlement: false,
      careerPurchases: [],
      abroadPurchases: [],
    });
  });

  it("classifies a career purchase as career-only, never abroad", () => {
    const purchase = makePurchase({ id: "p1", planId: "plan-career" });
    const result = classifyPurchaseEntitlements([purchase], new Map([["plan-career", "school_counselling"]]));
    expect(result.hasCareerEntitlement).toBe(true);
    expect(result.hasAbroadEntitlement).toBe(false);
    expect(result.careerPurchases).toEqual([purchase]);
    expect(result.abroadPurchases).toEqual([]);
  });

  it("classifies an abroad purchase as abroad-only, never career", () => {
    const purchase = makePurchase({ id: "p1", planId: "plan-abroad" });
    const result = classifyPurchaseEntitlements([purchase], new Map([["plan-abroad", "master_abroad"]]));
    expect(result.hasCareerEntitlement).toBe(false);
    expect(result.hasAbroadEntitlement).toBe(true);
    expect(result.abroadPurchases).toEqual([purchase]);
    expect(result.careerPurchases).toEqual([]);
  });

  it("a student with both a career and an abroad purchase gets both entitlements, never leaking into one list", () => {
    const careerPurchase = makePurchase({ id: "p1", planId: "plan-career" });
    const abroadPurchase = makePurchase({ id: "p2", planId: "plan-abroad" });
    const result = classifyPurchaseEntitlements(
      [careerPurchase, abroadPurchase],
      new Map([
        ["plan-career", "class_12_counselling"],
        ["plan-abroad", "bachelor_abroad"],
      ])
    );
    expect(result.hasCareerEntitlement).toBe(true);
    expect(result.hasAbroadEntitlement).toBe(true);
    expect(result.careerPurchases).toEqual([careerPurchase]);
    expect(result.abroadPurchases).toEqual([abroadPurchase]);
  });

  it("never fabricates a classification for a purchase with a null planId (e.g. a legacy/manually-recorded purchase)", () => {
    const purchase = makePurchase({ id: "p1", planId: null });
    const result = classifyPurchaseEntitlements([purchase], new Map());
    expect(result.hasCareerEntitlement).toBe(false);
    expect(result.hasAbroadEntitlement).toBe(false);
    expect(result.careerPurchases).toEqual([]);
    expect(result.abroadPurchases).toEqual([]);
  });

  it("never fabricates a classification for a purchase whose plan id isn't in the lookup", () => {
    const purchase = makePurchase({ id: "p1", planId: "plan-unknown" });
    const result = classifyPurchaseEntitlements([purchase], new Map());
    expect(result.hasCareerEntitlement).toBe(false);
    expect(result.hasAbroadEntitlement).toBe(false);
  });
});
