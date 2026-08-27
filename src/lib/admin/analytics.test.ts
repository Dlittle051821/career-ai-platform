import { describe, expect, it } from "vitest";
import { computeRate, MIN_RELIABLE_SAMPLE_SIZE, sumRecordedRevenue, withShareOfTotal } from "./analytics";

describe("computeRate", () => {
  it("returns null percent (not 0 or NaN) for a zero denominator", () => {
    const result = computeRate(0, 0);
    expect(result.percent).toBeNull();
    expect(result.isReliable).toBe(false);
  });

  it("never divides by zero even when numerator is nonzero", () => {
    expect(() => computeRate(5, 0)).not.toThrow();
    expect(computeRate(5, 0).percent).toBeNull();
  });

  it("computes a correct percentage for a normal case", () => {
    const result = computeRate(1, 4);
    expect(result.percent).toBe(25);
  });

  it("rounds to one decimal place", () => {
    const result = computeRate(1, 3);
    expect(result.percent).toBe(33.3);
  });

  it("flags a small denominator as unreliable even though the percent is still computed", () => {
    const result = computeRate(1, 2);
    expect(result.percent).toBe(50);
    expect(result.denominator).toBeLessThan(MIN_RELIABLE_SAMPLE_SIZE);
    expect(result.isReliable).toBe(false);
  });

  it("flags a denominator at or above the threshold as reliable", () => {
    const result = computeRate(2, MIN_RELIABLE_SAMPLE_SIZE);
    expect(result.isReliable).toBe(true);
  });
});

describe("withShareOfTotal", () => {
  it("returns null shares (not 0%) when every stage count is zero", () => {
    const result = withShareOfTotal([
      { stage: "new", count: 0 },
      { stage: "contacted", count: 0 },
    ]);
    expect(result.every((r) => r.sharePercent === null)).toBe(true);
  });

  it("computes shares that reflect proportion of the total", () => {
    const result = withShareOfTotal([
      { stage: "new", count: 3 },
      { stage: "contacted", count: 1 },
    ]);
    expect(result.find((r) => r.stage === "new")?.sharePercent).toBe(75);
    expect(result.find((r) => r.stage === "contacted")?.sharePercent).toBe(25);
  });
});

describe("sumRecordedRevenue", () => {
  it("only counts status = paid — pending/failed/refunded are excluded from 'revenue'", () => {
    const total = sumRecordedRevenue([
      { amountMinorUnits: 1000, status: "paid" },
      { amountMinorUnits: 5000, status: "pending" },
      { amountMinorUnits: 2000, status: "failed" },
      { amountMinorUnits: 3000, status: "refunded" },
      { amountMinorUnits: 500, status: "paid" },
    ]);
    expect(total).toBe(1500);
  });

  it("returns 0 for an empty list, not an error", () => {
    expect(sumRecordedRevenue([])).toBe(0);
  });
});
