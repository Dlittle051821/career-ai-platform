import { describe, expect, it } from "vitest";
import {
  bucketRevenueByMonth,
  computeRate,
  MIN_RELIABLE_SAMPLE_SIZE,
  rankOperationalAlerts,
  resolveAnalyticsWindow,
  sumRecordedRevenue,
  tallyByKey,
  withShareOfTotal,
} from "./analytics";

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

describe("tallyByKey", () => {
  it("counts occurrences of each non-null value, dropping null/undefined", () => {
    const result = tallyByKey(["a", "b", "a", null, undefined, "a"]);
    expect(result.find((r) => r.stage === "a")?.count).toBe(3);
    expect(result.find((r) => r.stage === "b")?.count).toBe(1);
  });

  it("returns an empty array for an empty/all-null input, never an error", () => {
    expect(tallyByKey([])).toEqual([]);
    expect(tallyByKey([null, undefined])).toEqual([]);
  });
});

describe("bucketRevenueByMonth", () => {
  const now = new Date(Date.UTC(2026, 2, 15)); // 15 Mar 2026

  it("groups by currency and never sums across currencies", () => {
    const result = bucketRevenueByMonth(
      [
        { amountMinorUnits: 1000, currency: "INR", status: "paid", createdAt: "2026-03-01T00:00:00Z" },
        { amountMinorUnits: 2000, currency: "USD", status: "paid", createdAt: "2026-03-01T00:00:00Z" },
      ],
      3,
      now
    );
    const inr = result.find((r) => r.currency === "INR");
    const usd = result.find((r) => r.currency === "USD");
    expect(inr?.points.find((p) => p.periodLabel === "Mar 2026")?.amountMinorUnits).toBe(1000);
    expect(usd?.points.find((p) => p.periodLabel === "Mar 2026")?.amountMinorUnits).toBe(2000);
  });

  it("excludes non-paid payments from the trend", () => {
    const result = bucketRevenueByMonth(
      [{ amountMinorUnits: 9999, currency: "INR", status: "pending", createdAt: "2026-03-01T00:00:00Z" }],
      3,
      now
    );
    expect(result).toEqual([]);
  });

  it("zero-fills a trailing month with no revenue instead of omitting it", () => {
    const result = bucketRevenueByMonth(
      [{ amountMinorUnits: 500, currency: "INR", status: "paid", createdAt: "2026-03-01T00:00:00Z" }],
      3,
      now
    );
    const inr = result.find((r) => r.currency === "INR");
    expect(inr?.points).toHaveLength(3);
    expect(inr?.points.map((p) => p.amountMinorUnits)).toEqual([0, 0, 500]);
    expect(inr?.points.map((p) => p.periodLabel)).toEqual(["Jan 2026", "Feb 2026", "Mar 2026"]);
  });

  it("buckets amounts within the same calendar month together", () => {
    const result = bucketRevenueByMonth(
      [
        { amountMinorUnits: 100, currency: "INR", status: "paid", createdAt: "2026-03-01T00:00:00Z" },
        { amountMinorUnits: 200, currency: "INR", status: "paid", createdAt: "2026-03-28T00:00:00Z" },
      ],
      1,
      now
    );
    expect(result[0]?.points[0]?.amountMinorUnits).toBe(300);
  });
});

describe("rankOperationalAlerts", () => {
  it("drops any candidate with a zero count", () => {
    const result = rankOperationalAlerts([
      { id: "a", label: "A", count: 0, href: "/a", severity: "critical" },
      { id: "b", label: "B", count: 1, href: "/b", severity: "info" },
    ]);
    expect(result.map((r) => r.id)).toEqual(["b"]);
  });

  it("orders critical before warning before info", () => {
    const result = rankOperationalAlerts([
      { id: "info", label: "I", count: 1, href: "/i", severity: "info" },
      { id: "warning", label: "W", count: 1, href: "/w", severity: "warning" },
      { id: "critical", label: "C", count: 1, href: "/c", severity: "critical" },
    ]);
    expect(result.map((r) => r.id)).toEqual(["critical", "warning", "info"]);
  });

  it("within the same severity, orders by count descending", () => {
    const result = rankOperationalAlerts([
      { id: "low", label: "L", count: 2, href: "/l", severity: "warning" },
      { id: "high", label: "H", count: 9, href: "/h", severity: "warning" },
    ]);
    expect(result.map((r) => r.id)).toEqual(["high", "low"]);
  });
});

describe("resolveAnalyticsWindow", () => {
  const now = new Date(Date.UTC(2026, 2, 15, 12, 0, 0)); // 15 Mar 2026, 12:00 UTC

  it("defaults to all time (no bounds) when nothing is given", () => {
    const result = resolveAnalyticsWindow({}, now);
    expect(result.sinceIso).toBeUndefined();
    expect(result.untilIso).toBeUndefined();
    expect(result.rangeLabel).toBe("all time");
  });

  it("resolves a trailing-days range relative to now", () => {
    const result = resolveAnalyticsWindow({ range: "30" }, now);
    expect(result.sinceIso).toBe(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString());
    expect(result.untilIso).toBeUndefined();
  });

  it("resolves 'this_month' to the first instant of the current UTC month, with no upper bound", () => {
    const result = resolveAnalyticsWindow({ range: "this_month" }, now);
    expect(result.sinceIso).toBe("2026-03-01T00:00:00.000Z");
    expect(result.untilIso).toBeUndefined();
  });

  it("resolves 'last_month' to a closed [start of last month, start of this month) window", () => {
    const result = resolveAnalyticsWindow({ range: "last_month" }, now);
    expect(result.sinceIso).toBe("2026-02-01T00:00:00.000Z");
    expect(result.untilIso).toBe("2026-03-01T00:00:00.000Z");
  });

  it("'last_month' correctly rolls back across a year boundary", () => {
    const january = new Date(Date.UTC(2026, 0, 15));
    const result = resolveAnalyticsWindow({ range: "last_month" }, january);
    expect(result.sinceIso).toBe("2025-12-01T00:00:00.000Z");
    expect(result.untilIso).toBe("2026-01-01T00:00:00.000Z");
  });

  it("an explicit from/to pair takes precedence over the range dropdown, and 'to' is inclusive of that whole day", () => {
    const result = resolveAnalyticsWindow({ range: "90", from: "2026-03-01", to: "2026-03-10" }, now);
    expect(result.sinceIso).toBe("2026-03-01T00:00:00.000Z");
    expect(result.untilIso).toBe("2026-03-11T00:00:00.000Z");
  });

  it("supports an open-ended 'from' with no 'to'", () => {
    const result = resolveAnalyticsWindow({ from: "2026-01-01" }, now);
    expect(result.sinceIso).toBe("2026-01-01T00:00:00.000Z");
    expect(result.untilIso).toBeUndefined();
  });

  it("ignores a malformed date string rather than throwing", () => {
    const result = resolveAnalyticsWindow({ from: "not-a-date" }, now);
    expect(result.sinceIso).toBeUndefined();
    expect(result.rangeLabel).toBe("all time");
  });
});
