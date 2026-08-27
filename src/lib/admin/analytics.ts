/**
 * Pure analytics math shared by the /admin/analytics dashboard and the
 * admin dashboard's summary cards. Every function here takes plain counts
 * (already fetched via small, targeted `count: "exact", head: true`
 * queries — see src/lib/supabase/admin/analytics.ts) rather than raw rows,
 * so nothing in this file loads a whole table into memory, and nothing
 * here talks to Supabase at all — it is pure and unit-testable.
 */

/**
 * A percentage a denominator is too small to make meaningful is worse than
 * useless — it looks precise while being noise. Below this many
 * observations, computeRate() reports `isReliable: false` and the caller
 * (docs/admin-system-guide.md §11 documents the exact wording) should
 * show something like "Not enough data yet" instead of e.g. "100%" off of
 * a single record.
 */
export const MIN_RELIABLE_SAMPLE_SIZE = 5;

export interface RateResult {
  /** 0-100, rounded to one decimal place. Null when the denominator is 0 (undefined, not "0%"). */
  percent: number | null;
  numerator: number;
  denominator: number;
  /** False when denominator > 0 but below MIN_RELIABLE_SAMPLE_SIZE — the percent is still computed but should be shown with a caveat, not as a confident figure. */
  isReliable: boolean;
}

/** Zero-denominator-safe percentage. Never divides by zero, never returns NaN/Infinity. */
export function computeRate(numerator: number, denominator: number): RateResult {
  if (denominator <= 0) {
    return { percent: null, numerator, denominator, isReliable: false };
  }
  const percent = Math.round((numerator / denominator) * 1000) / 10;
  return { percent, numerator, denominator, isReliable: denominator >= MIN_RELIABLE_SAMPLE_SIZE };
}

export interface FunnelStageCount {
  stage: string;
  count: number;
}

/** Attaches a share-of-total percentage (safe at 0 total) to each funnel stage's raw count — used for the lead-stage and application-stage distribution views. */
export function withShareOfTotal(stages: FunnelStageCount[]): (FunnelStageCount & { sharePercent: number | null })[] {
  const total = stages.reduce((sum, s) => sum + s.count, 0);
  return stages.map((s) => ({
    ...s,
    sharePercent: total > 0 ? Math.round((s.count / total) * 1000) / 10 : null,
  }));
}

/** Sums minor-units amounts by a status filter — a thin, testable wrapper the payments analytics view uses so the "revenue" definition (which statuses count) lives in exactly one place. See docs/admin-system-guide.md §11 for the exact definition. */
export function sumRecordedRevenue(payments: { amountMinorUnits: number; status: string }[]): number {
  return payments.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amountMinorUnits, 0);
}
