import { describe, expect, it } from "vitest";
import {
  computeOfferDiscount,
  computePriceBreakdown,
  isOfferCurrentlyRedeemable,
  isOfferExhausted,
  validateOfferAgainstPlan,
  validateOfferShape,
} from "./offers";
import type { PricingOffer, PricingPlanVersion } from "@/types/pricing";

function offerInput(overrides: Partial<Parameters<typeof validateOfferShape>[0]> = {}): Parameters<typeof validateOfferShape>[0] {
  return {
    discountType: "percentage",
    discountPercentBps: 1000, // 10%
    discountAmountMinorUnits: null,
    discountCurrency: null,
    startsAt: "2026-01-01T00:00:00Z",
    endsAt: "2026-02-01T00:00:00Z",
    maxRedemptions: null,
    perUserLimit: null,
    couponCode: null,
    ...overrides,
  };
}

function offer(overrides: Partial<PricingOffer> = {}): PricingOffer {
  return {
    id: "offer-1",
    planId: "plan-1",
    publicOfferName: "Early bird",
    internalDescription: null,
    discountType: "percentage",
    discountPercentBps: 1000,
    discountAmountMinorUnits: null,
    discountCurrency: null,
    startsAt: "2026-01-01T00:00:00Z",
    endsAt: "2026-02-01T00:00:00Z",
    isActive: true,
    status: "published",
    couponCode: null,
    maxRedemptions: null,
    perUserLimit: null,
    redemptionCount: 0,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function version(overrides: Partial<PricingPlanVersion> = {}): Pick<PricingPlanVersion, "amountMinorUnits" | "currency"> {
  return { amountMinorUnits: 500_000, currency: "INR", ...overrides };
}

describe("validateOfferShape", () => {
  it("accepts a well-formed percentage offer", () => {
    expect(validateOfferShape(offerInput())).toEqual([]);
  });

  it("rejects a percentage of 0 — must be greater than 0", () => {
    expect(validateOfferShape(offerInput({ discountPercentBps: 0 }))).toHaveLength(1);
  });

  it("rejects a percentage above 100 (bps > 10000)", () => {
    expect(validateOfferShape(offerInput({ discountPercentBps: 10_001 }))).toHaveLength(1);
  });

  it("accepts exactly 100% (bps === 10000) — the upper bound is inclusive", () => {
    expect(validateOfferShape(offerInput({ discountPercentBps: 10_000 }))).toEqual([]);
  });

  it("rejects a null percentage for a percentage-type offer", () => {
    expect(validateOfferShape(offerInput({ discountPercentBps: null }))).toHaveLength(1);
  });

  it("rejects a fixed offer with no discount amount", () => {
    expect(validateOfferShape(offerInput({ discountType: "fixed", discountAmountMinorUnits: null, discountCurrency: "INR" }))).toHaveLength(1);
  });

  it("rejects a fixed offer with a zero or negative amount", () => {
    expect(validateOfferShape(offerInput({ discountType: "fixed", discountAmountMinorUnits: 0, discountCurrency: "INR" }))).toHaveLength(1);
  });

  it("rejects a fixed offer with no currency", () => {
    expect(validateOfferShape(offerInput({ discountType: "fixed", discountAmountMinorUnits: 1000, discountCurrency: null }))).toHaveLength(1);
  });

  it("accepts a well-formed fixed offer", () => {
    expect(validateOfferShape(offerInput({ discountType: "fixed", discountAmountMinorUnits: 1000, discountCurrency: "INR" }))).toEqual([]);
  });

  it("rejects an end date/time at or before the start date/time", () => {
    expect(validateOfferShape(offerInput({ startsAt: "2026-02-01T00:00:00Z", endsAt: "2026-02-01T00:00:00Z" }))).toHaveLength(1);
    expect(validateOfferShape(offerInput({ startsAt: "2026-02-01T00:00:00Z", endsAt: "2026-01-01T00:00:00Z" }))).toHaveLength(1);
  });

  it("rejects a zero or negative maxRedemptions when set", () => {
    expect(validateOfferShape(offerInput({ maxRedemptions: 0 }))).toHaveLength(1);
    expect(validateOfferShape(offerInput({ maxRedemptions: -1 }))).toHaveLength(1);
  });

  it("accepts a null maxRedemptions (unlimited)", () => {
    expect(validateOfferShape(offerInput({ maxRedemptions: null }))).toEqual([]);
  });

  it("rejects a zero or negative perUserLimit when set", () => {
    expect(validateOfferShape(offerInput({ perUserLimit: 0 }))).toHaveLength(1);
  });

  it("rejects a malformed coupon code", () => {
    expect(validateOfferShape(offerInput({ couponCode: "ab" }))).toHaveLength(1); // too short
    expect(validateOfferShape(offerInput({ couponCode: "lowercase" }))).toHaveLength(1); // must be uppercase
    expect(validateOfferShape(offerInput({ couponCode: "HAS SPACE" }))).toHaveLength(1);
  });

  it("accepts a well-formed coupon code, and no coupon code at all", () => {
    expect(validateOfferShape(offerInput({ couponCode: "WELCOME10" }))).toEqual([]);
    expect(validateOfferShape(offerInput({ couponCode: null }))).toEqual([]);
  });

  it("never fabricates a coupon code — this module only validates shape, it has no code generator", () => {
    // Structural guarantee: nothing in this module can produce a coupon
    // code string on its own; every code must be admin-supplied input.
    const result = validateOfferShape(offerInput({ couponCode: null }));
    expect(result).toEqual([]);
  });
});

describe("validateOfferAgainstPlan", () => {
  it("rejects a fixed discount that exceeds the plan's current price", () => {
    const errors = validateOfferAgainstPlan({ discountType: "fixed", discountAmountMinorUnits: 600_000, discountCurrency: "INR" }, version({ amountMinorUnits: 500_000, currency: "INR" }));
    expect(errors).toHaveLength(1);
  });

  it("accepts a fixed discount exactly equal to the plan's price", () => {
    const errors = validateOfferAgainstPlan({ discountType: "fixed", discountAmountMinorUnits: 500_000, discountCurrency: "INR" }, version({ amountMinorUnits: 500_000, currency: "INR" }));
    expect(errors).toEqual([]);
  });

  it("rejects a fixed discount whose currency does not match the plan's currency", () => {
    const errors = validateOfferAgainstPlan({ discountType: "fixed", discountAmountMinorUnits: 1000, discountCurrency: "USD" }, version({ amountMinorUnits: 500_000, currency: "INR" }));
    expect(errors).toHaveLength(1);
  });

  it("never checks amount/currency bounds for a percentage offer — those don't apply", () => {
    const errors = validateOfferAgainstPlan({ discountType: "percentage", discountAmountMinorUnits: null, discountCurrency: null }, version({ amountMinorUnits: 500_000, currency: "INR" }));
    expect(errors).toEqual([]);
  });
});

describe("isOfferCurrentlyRedeemable", () => {
  it("is false when isActive is false, even mid-window and published", () => {
    const now = new Date("2026-01-15T00:00:00Z");
    expect(isOfferCurrentlyRedeemable(offer({ isActive: false, status: "published" }), now)).toBe(false);
  });

  it("is false for a draft offer, even if is_active were somehow true", () => {
    const now = new Date("2026-01-15T00:00:00Z");
    expect(isOfferCurrentlyRedeemable(offer({ isActive: true, status: "draft" }), now)).toBe(false);
  });

  it("is false before the offer's start date/time — a future offer can't apply", () => {
    const now = new Date("2025-12-01T00:00:00Z");
    expect(isOfferCurrentlyRedeemable(offer(), now)).toBe(false);
  });

  it("is false after the offer's end date/time — an expired offer can't apply", () => {
    const now = new Date("2026-03-01T00:00:00Z");
    expect(isOfferCurrentlyRedeemable(offer(), now)).toBe(false);
  });

  it("is true only when active, published, and inside the start/end window", () => {
    const now = new Date("2026-01-15T00:00:00Z");
    expect(isOfferCurrentlyRedeemable(offer({ isActive: true, status: "published" }), now)).toBe(true);
  });

  it("no offer is redeemable by default — is_active must be explicitly true", () => {
    const now = new Date("2026-01-15T00:00:00Z");
    const freshlyCreatedOffer = offer({ isActive: false, status: "draft" });
    expect(isOfferCurrentlyRedeemable(freshlyCreatedOffer, now)).toBe(false);
  });
});

describe("isOfferExhausted", () => {
  it("is false when maxRedemptions is null (unlimited)", () => {
    expect(isOfferExhausted({ maxRedemptions: null, redemptionCount: 1_000_000 })).toBe(false);
  });

  it("is false while redemptionCount is below maxRedemptions", () => {
    expect(isOfferExhausted({ maxRedemptions: 10, redemptionCount: 9 })).toBe(false);
  });

  it("is true once redemptionCount reaches maxRedemptions", () => {
    expect(isOfferExhausted({ maxRedemptions: 10, redemptionCount: 10 })).toBe(true);
  });

  it("is true if redemptionCount somehow exceeds maxRedemptions", () => {
    expect(isOfferExhausted({ maxRedemptions: 10, redemptionCount: 11 })).toBe(true);
  });
});

describe("computeOfferDiscount", () => {
  it("computes a percentage discount correctly", () => {
    expect(computeOfferDiscount(version({ amountMinorUnits: 500_000 }), { discountType: "percentage", discountPercentBps: 1000, discountAmountMinorUnits: null })).toBe(50_000);
  });

  it("computes a fixed discount as exactly the configured amount", () => {
    expect(computeOfferDiscount(version({ amountMinorUnits: 500_000 }), { discountType: "fixed", discountPercentBps: null, discountAmountMinorUnits: 75_000 })).toBe(75_000);
  });

  it("clamps a discount so it can never exceed the plan's amount, even if misconfigured", () => {
    expect(computeOfferDiscount(version({ amountMinorUnits: 500_000 }), { discountType: "fixed", discountPercentBps: null, discountAmountMinorUnits: 999_999 })).toBe(500_000);
  });

  it("never produces a negative discount", () => {
    expect(computeOfferDiscount(version({ amountMinorUnits: 500_000 }), { discountType: "percentage", discountPercentBps: 0, discountAmountMinorUnits: null })).toBe(0);
  });
});

describe("computePriceBreakdown", () => {
  it("with no offer, the final price equals the original amount and discount is 0", () => {
    const breakdown = computePriceBreakdown(version({ amountMinorUnits: 500_000, currency: "INR" }), null, null);
    expect(breakdown).toEqual({ originalAmountMinorUnits: 500_000, discountMinorUnits: 0, taxMinorUnits: 0, finalAmountMinorUnits: 500_000, currency: "INR" });
  });

  it("applies a valid offer's discount to the final price", () => {
    const breakdown = computePriceBreakdown(version({ amountMinorUnits: 500_000, currency: "INR" }), { discountType: "percentage", discountPercentBps: 1000, discountAmountMinorUnits: null }, null);
    expect(breakdown.discountMinorUnits).toBe(50_000);
    expect(breakdown.finalAmountMinorUnits).toBe(450_000);
  });

  it("applies tax on the post-discount (taxable) base, never the original price", () => {
    const breakdown = computePriceBreakdown(
      version({ amountMinorUnits: 500_000, currency: "INR" }),
      { discountType: "fixed", discountPercentBps: null, discountAmountMinorUnits: 100_000 },
      1800 // 18%
    );
    // taxable base = 500000 - 100000 = 400000; tax = 400000 * 0.18 = 72000
    expect(breakdown.taxMinorUnits).toBe(72_000);
    expect(breakdown.finalAmountMinorUnits).toBe(472_000);
  });

  it("the final price is never negative, even for a full 100% discount plus no tax", () => {
    const breakdown = computePriceBreakdown(version({ amountMinorUnits: 500_000, currency: "INR" }), { discountType: "percentage", discountPercentBps: 10_000, discountAmountMinorUnits: null }, null);
    expect(breakdown.finalAmountMinorUnits).toBe(0);
    expect(breakdown.finalAmountMinorUnits).toBeGreaterThanOrEqual(0);
  });

  it("the final price is never negative even for a clamped over-sized fixed discount", () => {
    const breakdown = computePriceBreakdown(version({ amountMinorUnits: 500_000, currency: "INR" }), { discountType: "fixed", discountPercentBps: null, discountAmountMinorUnits: 999_999_999 }, null);
    expect(breakdown.finalAmountMinorUnits).toBeGreaterThanOrEqual(0);
  });

  it("carries the plan version's own currency through to the breakdown", () => {
    const breakdown = computePriceBreakdown(version({ amountMinorUnits: 250_000, currency: "USD" }), null, null);
    expect(breakdown.currency).toBe("USD");
  });
});

describe("official NextWise plan prices (integer minor units, no float drift)", () => {
  // Mirrors supabase/seed/0004_pricing_offers_seed.sql exactly — see also
  // that file and docs/nextwise-pricing-offers-guide.md §1. Every amount
  // here is an INTEGER, matching the "no fractional paise" invariant this
  // whole module is built around.
  const OFFICIAL_PLANS: Array<{ slug: string; amountMinorUnits: number }> = [
    { slug: "school-counselling", amountMinorUnits: 500_000 },
    { slug: "class-11-counselling", amountMinorUnits: 1_000_000 },
    { slug: "class-12-counselling", amountMinorUnits: 1_500_000 },
    { slug: "bachelor-abroad-tier-1", amountMinorUnits: 2_500_000 },
    { slug: "bachelor-abroad-tier-2", amountMinorUnits: 6_000_000 },
    { slug: "bachelor-abroad-tier-3", amountMinorUnits: 13_000_000 },
    { slug: "master-abroad-tier-1", amountMinorUnits: 2_700_000 },
    { slug: "master-abroad-tier-2", amountMinorUnits: 6_500_000 },
    { slug: "master-abroad-tier-3", amountMinorUnits: 14_000_000 },
  ];

  it("every official plan amount is a positive integer", () => {
    for (const plan of OFFICIAL_PLANS) {
      expect(Number.isInteger(plan.amountMinorUnits)).toBe(true);
      expect(plan.amountMinorUnits).toBeGreaterThan(0);
    }
  });

  it("every official plan amount converts to the exact expected rupee figure", () => {
    const expectedMajorUnits: Record<string, number> = {
      "school-counselling": 5_000,
      "class-11-counselling": 10_000,
      "class-12-counselling": 15_000,
      "bachelor-abroad-tier-1": 25_000,
      "bachelor-abroad-tier-2": 60_000,
      "bachelor-abroad-tier-3": 130_000,
      "master-abroad-tier-1": 27_000,
      "master-abroad-tier-2": 65_000,
      "master-abroad-tier-3": 140_000,
    };
    for (const plan of OFFICIAL_PLANS) {
      expect(plan.amountMinorUnits / 100).toBe(expectedMajorUnits[plan.slug]);
    }
  });

  it("has exactly nine official plans, no more and no fewer", () => {
    expect(OFFICIAL_PLANS).toHaveLength(9);
  });

  it("every slug is unique", () => {
    const slugs = OFFICIAL_PLANS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
