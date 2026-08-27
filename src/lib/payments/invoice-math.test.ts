import { describe, expect, it } from "vitest";
import { computeLineItem, computeInvoiceTotals, isInvoiceIssuable } from "./invoice-math";

describe("computeLineItem", () => {
  it("computes a simple line with no discount or tax", () => {
    const result = computeLineItem({ quantity: 2, unitAmountMinorUnits: 50000, discountMinorUnits: 0, taxRateBps: null });
    expect(result).toEqual({ grossMinorUnits: 100000, discountMinorUnits: 0, taxMinorUnits: 0, lineTotalMinorUnits: 100000 });
  });

  it("applies a discount before tax", () => {
    const result = computeLineItem({ quantity: 1, unitAmountMinorUnits: 100000, discountMinorUnits: 10000, taxRateBps: 1800 });
    // taxable base = 100000 - 10000 = 90000; tax = 90000 * 0.18 = 16200
    expect(result.discountMinorUnits).toBe(10000);
    expect(result.taxMinorUnits).toBe(16200);
    expect(result.lineTotalMinorUnits).toBe(106200);
  });

  it("clamps a discount larger than the gross amount to the gross amount — never a negative taxable base", () => {
    const result = computeLineItem({ quantity: 1, unitAmountMinorUnits: 1000, discountMinorUnits: 5000, taxRateBps: null });
    expect(result.discountMinorUnits).toBe(1000);
    expect(result.lineTotalMinorUnits).toBe(0);
  });

  it("rounds a fractional quantity to the nearest minor unit exactly once", () => {
    const result = computeLineItem({ quantity: 2.5, unitAmountMinorUnits: 333, discountMinorUnits: 0, taxRateBps: null });
    expect(result.grossMinorUnits).toBe(Math.round(2.5 * 333));
  });

  it("applies null taxRateBps as no tax", () => {
    const result = computeLineItem({ quantity: 1, unitAmountMinorUnits: 10000, discountMinorUnits: 0, taxRateBps: null });
    expect(result.taxMinorUnits).toBe(0);
  });

  it("a 0 taxRateBps also produces zero tax", () => {
    const result = computeLineItem({ quantity: 1, unitAmountMinorUnits: 10000, discountMinorUnits: 0, taxRateBps: 0 });
    expect(result.taxMinorUnits).toBe(0);
  });
});

describe("computeInvoiceTotals", () => {
  it("sums subtotal/discount/tax/total across multiple lines", () => {
    const lines = [
      computeLineItem({ quantity: 1, unitAmountMinorUnits: 100000, discountMinorUnits: 0, taxRateBps: 1800 }),
      computeLineItem({ quantity: 2, unitAmountMinorUnits: 25000, discountMinorUnits: 5000, taxRateBps: null }),
    ];
    const totals = computeInvoiceTotals(lines);
    expect(totals.subtotalMinorUnits).toBe(100000 + 50000);
    expect(totals.discountMinorUnits).toBe(0 + 5000);
    expect(totals.taxMinorUnits).toBe(18000 + 0);
    expect(totals.totalMinorUnits).toBe(118000 + 45000);
  });

  it("returns all zeros for an empty line list", () => {
    expect(computeInvoiceTotals([])).toEqual({ subtotalMinorUnits: 0, discountMinorUnits: 0, taxMinorUnits: 0, totalMinorUnits: 0 });
  });
});

describe("isInvoiceIssuable", () => {
  it("is false for zero line items", () => {
    expect(isInvoiceIssuable([])).toBe(false);
  });

  it("is false when every line totals to zero (e.g. a 100% discount)", () => {
    const lines = [computeLineItem({ quantity: 1, unitAmountMinorUnits: 1000, discountMinorUnits: 1000, taxRateBps: null })];
    expect(isInvoiceIssuable(lines)).toBe(false);
  });

  it("is true when at least one line has a positive total", () => {
    const lines = [computeLineItem({ quantity: 1, unitAmountMinorUnits: 1000, discountMinorUnits: 0, taxRateBps: null })];
    expect(isInvoiceIssuable(lines)).toBe(true);
  });
});
