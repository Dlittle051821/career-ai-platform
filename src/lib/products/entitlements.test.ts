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

// NW05.6 (P0 security fix) — classifyPurchaseEntitlements() now takes a
// third argument, paidInvoiceIds, and a purchase only ever counts toward
// an entitlement when its invoiceId is in that set. These tests cover the
// NW05 brief's own SECURITY CASES list as far as they apply to this PURE
// function (ownership/anon/role checks happen earlier, in
// getMyProductEntitlements()'s RLS-scoped listMyPurchases() call and are
// exercised instead by entitlements-io.test.ts).
describe("classifyPurchaseEntitlements", () => {
  it("returns all-false/empty for no purchases", () => {
    const result = classifyPurchaseEntitlements([], new Map(), new Set());
    expect(result).toEqual({
      hasCareerEntitlement: false,
      hasAbroadEntitlement: false,
      careerPurchases: [],
      abroadPurchases: [],
    });
  });

  it("classifies a career purchase as career-only, never abroad, when its invoice is paid", () => {
    const purchase = makePurchase({ id: "p1", planId: "plan-career", invoiceId: "inv-1" });
    const result = classifyPurchaseEntitlements([purchase], new Map([["plan-career", "school_counselling"]]), new Set(["inv-1"]));
    expect(result.hasCareerEntitlement).toBe(true);
    expect(result.hasAbroadEntitlement).toBe(false);
    expect(result.careerPurchases).toEqual([purchase]);
    expect(result.abroadPurchases).toEqual([]);
  });

  it("classifies an abroad purchase as abroad-only, never career, when its invoice is paid", () => {
    const purchase = makePurchase({ id: "p1", planId: "plan-abroad", invoiceId: "inv-1" });
    const result = classifyPurchaseEntitlements([purchase], new Map([["plan-abroad", "master_abroad"]]), new Set(["inv-1"]));
    expect(result.hasCareerEntitlement).toBe(false);
    expect(result.hasAbroadEntitlement).toBe(true);
    expect(result.abroadPurchases).toEqual([purchase]);
    expect(result.careerPurchases).toEqual([]);
  });

  it("a student with both a paid career and a paid abroad purchase gets both entitlements, never leaking into one list", () => {
    const careerPurchase = makePurchase({ id: "p1", planId: "plan-career", invoiceId: "inv-1" });
    const abroadPurchase = makePurchase({ id: "p2", planId: "plan-abroad", invoiceId: "inv-2" });
    const result = classifyPurchaseEntitlements(
      [careerPurchase, abroadPurchase],
      new Map([
        ["plan-career", "class_12_counselling"],
        ["plan-abroad", "bachelor_abroad"],
      ]),
      new Set(["inv-1", "inv-2"])
    );
    expect(result.hasCareerEntitlement).toBe(true);
    expect(result.hasAbroadEntitlement).toBe(true);
    expect(result.careerPurchases).toEqual([careerPurchase]);
    expect(result.abroadPurchases).toEqual([abroadPurchase]);
  });

  it("never fabricates a classification for a purchase with a null planId (e.g. a legacy/manually-recorded purchase)", () => {
    const purchase = makePurchase({ id: "p1", planId: null, invoiceId: "inv-1" });
    const result = classifyPurchaseEntitlements([purchase], new Map(), new Set(["inv-1"]));
    expect(result.hasCareerEntitlement).toBe(false);
    expect(result.hasAbroadEntitlement).toBe(false);
    expect(result.careerPurchases).toEqual([]);
    expect(result.abroadPurchases).toEqual([]);
  });

  it("never fabricates a classification for a purchase whose plan id isn't in the lookup", () => {
    const purchase = makePurchase({ id: "p1", planId: "plan-unknown", invoiceId: "inv-1" });
    const result = classifyPurchaseEntitlements([purchase], new Map(), new Set(["inv-1"]));
    expect(result.hasCareerEntitlement).toBe(false);
    expect(result.hasAbroadEntitlement).toBe(false);
  });

  // --- P0 security cases: a purchase row existing is NOT proof of entitlement ---

  it('SECURITY: a purchase with a resolvable category but NO linked invoice grants nothing ("started checkout, never paid")', () => {
    const purchase = makePurchase({ id: "p1", planId: "plan-career", invoiceId: null });
    const result = classifyPurchaseEntitlements([purchase], new Map([["plan-career", "school_counselling"]]), new Set());
    expect(result.hasCareerEntitlement).toBe(false);
    expect(result.careerPurchases).toEqual([]);
  });

  it('SECURITY: a purchase whose invoice exists but is still "issued" (pending payment) grants nothing', () => {
    const purchase = makePurchase({ id: "p1", planId: "plan-career", invoiceId: "inv-pending" });
    // paidInvoiceIds deliberately does NOT contain "inv-pending" — exactly
    // what getMyProductEntitlements() would pass for an invoice whose
    // live status is 'issued'/'partially_paid'/'overdue'/'void'.
    const result = classifyPurchaseEntitlements([purchase], new Map([["plan-career", "school_counselling"]]), new Set());
    expect(result.hasCareerEntitlement).toBe(false);
  });

  it('SECURITY: a purchase whose invoice was refunded (not in paidInvoiceIds) grants nothing, even though the purchase row still exists', () => {
    const purchase = makePurchase({ id: "p1", planId: "plan-abroad", invoiceId: "inv-refunded" });
    // Represents getMyProductEntitlements() having found invoices.status
    // === 'refunded' for this invoice — it is therefore absent from
    // paidInvoiceIds, same as the pending case above. The pure classifier
    // deliberately cannot distinguish "never paid" from "paid, then
    // refunded" — both simply fail the one gate that matters: "is this
    // invoice paid RIGHT NOW". That is exactly correct per ENTITLEMENT
    // RULE 4 ("refunded... must not grant paid access").
    const result = classifyPurchaseEntitlements([purchase], new Map([["plan-abroad", "master_abroad"]]), new Set());
    expect(result.hasAbroadEntitlement).toBe(false);
    expect(result.abroadPurchases).toEqual([]);
  });

  it("SECURITY: a mix of one paid and one pending purchase grants only the paid one's entitlement", () => {
    const paidAbroad = makePurchase({ id: "p1", planId: "plan-abroad", invoiceId: "inv-paid" });
    const pendingCareer = makePurchase({ id: "p2", planId: "plan-career", invoiceId: "inv-pending" });
    const result = classifyPurchaseEntitlements(
      [paidAbroad, pendingCareer],
      new Map([
        ["plan-abroad", "master_abroad"],
        ["plan-career", "school_counselling"],
      ]),
      new Set(["inv-paid"])
    );
    expect(result.hasAbroadEntitlement).toBe(true);
    expect(result.hasCareerEntitlement).toBe(false);
    expect(result.abroadPurchases).toEqual([paidAbroad]);
    expect(result.careerPurchases).toEqual([]);
  });

  it("SECURITY: an unresolvable category never grants entitlement, even if the invoice IS paid (missing entitlement config fails closed)", () => {
    const purchase = makePurchase({ id: "p1", planId: "plan-unknown", invoiceId: "inv-paid" });
    const result = classifyPurchaseEntitlements([purchase], new Map(), new Set(["inv-paid"]));
    expect(result.hasCareerEntitlement).toBe(false);
    expect(result.hasAbroadEntitlement).toBe(false);
  });
});
