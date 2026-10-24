import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { computePlanPurchaseTax } from "./plan-purchase-tax";

describe("computePlanPurchaseTax", () => {
  it("no tax at all when GST is not configured at the business level, regardless of taxStatus", () => {
    for (const taxStatus of ["unconfigured", "tax_exclusive", "tax_inclusive"] as const) {
      const result = computePlanPurchaseTax({ amountMinorUnits: 199900, discountMinorUnits: 0, taxStatus, taxRateBps: null });
      expect(result).toEqual({ taxMinorUnits: 0, totalMinorUnits: 199900 });
    }
  });

  it("NW01 Part H — reproduces, then fixes, the reported ₹1,999 -> ₹2,358.82 defect for tax_exclusive (where adding tax on top IS correct)", () => {
    // 199900 paise (₹1,999) * 18% = 35982 paise tax -> 235882 paise (₹2,358.82) total. This IS the
    // right answer for a plan explicitly marked tax_exclusive (its own public card says "tax will be added").
    const result = computePlanPurchaseTax({ amountMinorUnits: 199900, discountMinorUnits: 0, taxStatus: "tax_exclusive", taxRateBps: 1800 });
    expect(result.taxMinorUnits).toBe(35982);
    expect(result.totalMinorUnits).toBe(235882);
  });

  it("NW01 Part H — tax_inclusive never charges more than the displayed ₹1,999, even with GST configured (the actual bug fix)", () => {
    const result = computePlanPurchaseTax({ amountMinorUnits: 199900, discountMinorUnits: 0, taxStatus: "tax_inclusive", taxRateBps: 1800 });
    expect(result.totalMinorUnits).toBe(199900);
    // Backed-out tax is informational only: round(199900 * 1800 / 11800) = 30493.
    expect(result.taxMinorUnits).toBe(30493);
    expect(result.totalMinorUnits).toBeLessThan(199900 + result.taxMinorUnits); // never additive
  });

  it("NW01 Part H — unconfigured (the real seeded 'Nextwise Verified' plan's actual state) ALSO never charges more than displayed, matching the public page's 'no hidden fees' promise", () => {
    const result = computePlanPurchaseTax({ amountMinorUnits: 199900, discountMinorUnits: 0, taxStatus: "unconfigured", taxRateBps: 1800 });
    expect(result.totalMinorUnits).toBe(199900);
  });

  it("a discount reduces the taxable base before either tax treatment applies", () => {
    const exclusive = computePlanPurchaseTax({ amountMinorUnits: 100000, discountMinorUnits: 20000, taxStatus: "tax_exclusive", taxRateBps: 1800 });
    expect(exclusive.totalMinorUnits).toBe(80000 + 14400); // 80000 * 1.18
    const inclusive = computePlanPurchaseTax({ amountMinorUnits: 100000, discountMinorUnits: 20000, taxStatus: "tax_inclusive", taxRateBps: 1800 });
    expect(inclusive.totalMinorUnits).toBe(80000); // never exceeds the post-discount displayed amount
  });

  it("a FREE (₹0) plan never ends up with a non-zero charge under any tax status", () => {
    for (const taxStatus of ["unconfigured", "tax_exclusive", "tax_inclusive"] as const) {
      const result = computePlanPurchaseTax({ amountMinorUnits: 0, discountMinorUnits: 0, taxStatus, taxRateBps: 1800 });
      expect(result.totalMinorUnits).toBe(0);
    }
  });
});

describe("NW01 Part H — proposed purchase_pricing_plan() migration is staged for review, not auto-applied", () => {
  const PROPOSED_PATH = join(process.cwd(), "supabase/migrations-proposed/NW01_fix_purchase_pricing_plan_tax_handling.sql");

  it("the proposed fix exists outside supabase/migrations/, so ordinary migration tooling never picks it up automatically", () => {
    expect(existsSync(PROPOSED_PATH)).toBe(true);
    expect(PROPOSED_PATH).not.toMatch(/\/supabase\/migrations\//);
  });

  it("the proposed fix's tax branch matches this file's own tested formula (same bps back-calculation, same tax_exclusive-unchanged branch)", () => {
    const sql = readFileSync(PROPOSED_PATH, "utf8");
    expect(sql).toContain("v_tax_rate_bps / (10000.0 + v_tax_rate_bps)");
    expect(sql).toContain("v_version.tax_status = 'tax_exclusive'");
  });
});
