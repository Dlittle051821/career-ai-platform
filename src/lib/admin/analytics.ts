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

/**
 * NW08.2 — a generic, pure "count occurrences of a string key" tally, used
 * for any stage/status distribution computed in-memory from a bounded
 * single-column select (the same in-memory-tally pattern
 * src/lib/supabase/admin/analytics.ts's topCountsFromValues() already uses
 * for lead sources/universities, generalized here so other callers — e.g.
 * the Command Centre's service-delivery breakdown — don't re-derive it).
 * Keys with a zero count are never fabricated into the result; callers that
 * need every known key represented (even at 0) should zero-fill against
 * their own fixed key list after calling this, exactly as withShareOfTotal
 * expects a complete FunnelStageCount[] going in.
 */
export function tallyByKey(values: (string | null | undefined)[]): FunnelStageCount[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([stage, count]) => ({ stage, count }));
}

/** One point in a per-currency revenue trend series — see bucketRevenueByMonth(). periodStart is the first day of the bucket's calendar month (UTC), as an ISO date string, so callers can sort/format without re-deriving month boundaries. */
export interface RevenueTrendPoint {
  periodStart: string;
  periodLabel: string;
  amountMinorUnits: number;
}

export interface CurrencyRevenueTrend {
  currency: string;
  points: RevenueTrendPoint[];
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Buckets already-fetched PAID payments into trailing calendar-month
 * totals, grouped by currency first (never summed across currencies — the
 * same rule sumRecordedRevenue()/getAnalyticsSummary() already enforce).
 * `monthsBack` trailing months are always present in the output for every
 * currency that has at least one paid payment anywhere in the window, each
 * zero-filled when that specific month had no paid revenue — a month is
 * never silently omitted just because its total is 0, so a UI reading this
 * can distinguish "no revenue that month" from "we didn't ask about that
 * month." `now` is injectable so this stays a pure, deterministically
 * testable function — the caller (dashboard.ts) passes the real current
 * time; it is never read from inside this module.
 */
export function bucketRevenueByMonth(
  payments: { amountMinorUnits: number; currency: string; status: string; createdAt: string }[],
  monthsBack: number,
  now: Date
): CurrencyRevenueTrend[] {
  const paid = payments.filter((p) => p.status === "paid");

  const monthStarts: Date[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    monthStarts.push(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)));
  }
  const keyFor = (d: Date) => `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
  const labelFor = (d: Date) => `${MONTH_LABELS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;

  const currencies = new Set(paid.map((p) => p.currency));
  const result: CurrencyRevenueTrend[] = [];
  for (const currency of currencies) {
    const totalsByMonthKey = new Map<string, number>();
    for (const p of paid) {
      if (p.currency !== currency) continue;
      const created = new Date(p.createdAt);
      const bucket = new Date(Date.UTC(created.getUTCFullYear(), created.getUTCMonth(), 1));
      const key = keyFor(bucket);
      totalsByMonthKey.set(key, (totalsByMonthKey.get(key) ?? 0) + p.amountMinorUnits);
    }
    const points: RevenueTrendPoint[] = monthStarts.map((d) => ({
      periodStart: d.toISOString().slice(0, 10),
      periodLabel: labelFor(d),
      amountMinorUnits: totalsByMonthKey.get(keyFor(d)) ?? 0,
    }));
    result.push({ currency, points });
  }
  return result.sort((a, b) => a.currency.localeCompare(b.currency));
}

/** NW08.7 — first instant (UTC) of the month containing `d`. */
function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export interface ResolvedAnalyticsWindow {
  sinceIso?: string;
  untilIso?: string;
  rangeLabel: string;
}

/**
 * Resolves the /admin/analytics page's own querystring into an explicit
 * {sinceIso, untilIso} window (both undefined for "all time") BEFORE
 * calling getAnalyticsSummary() (src/lib/supabase/admin/analytics.ts) —
 * pure and deterministic given `now`, so it is unit-testable without a
 * Supabase mock, same "pure logic lives here, the thin DB-calling wrapper
 * lives in src/lib/supabase/admin/" split as every other function in this
 * file. All boundaries are computed in UTC (see NW08_METRIC_DICTIONARY.md
 * for why — "today" is otherwise ambiguous across time zones).
 *
 * An explicit from/to date pair (type="date" inputs, YYYY-MM-DD) always
 * takes precedence over the range dropdown. `to` is treated as inclusive
 * of that whole day (the resolved untilIso is the START of the NEXT day)
 * — matching how a person reads a date-range picker, not a half-open
 * technicality they'd have to account for themselves.
 */
export function resolveAnalyticsWindow(params: { range?: string; from?: string; to?: string }, now: Date): ResolvedAnalyticsWindow {
  const fromDate = params.from && /^\d{4}-\d{2}-\d{2}$/.test(params.from) ? new Date(`${params.from}T00:00:00.000Z`) : null;
  const toDate = params.to && /^\d{4}-\d{2}-\d{2}$/.test(params.to) ? new Date(`${params.to}T00:00:00.000Z`) : null;
  if (fromDate || toDate) {
    const untilIso = toDate ? new Date(toDate.getTime() + 24 * 60 * 60 * 1000).toISOString() : undefined;
    return {
      sinceIso: fromDate?.toISOString(),
      untilIso,
      rangeLabel: `${params.from ?? "the beginning"} to ${params.to ?? "now"}`,
    };
  }

  const range = params.range ?? "";
  if (range === "this_month") {
    return { sinceIso: startOfUtcMonth(now).toISOString(), untilIso: undefined, rangeLabel: "this month" };
  }
  if (range === "last_month") {
    const startThis = startOfUtcMonth(now);
    const startLast = new Date(Date.UTC(startThis.getUTCFullYear(), startThis.getUTCMonth() - 1, 1));
    return { sinceIso: startLast.toISOString(), untilIso: startThis.toISOString(), rangeLabel: "last month" };
  }
  const days = Number.parseInt(range, 10);
  if (Number.isInteger(days) && days > 0) {
    return { sinceIso: new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString(), untilIso: undefined, rangeLabel: `the last ${days} days` };
  }
  return { sinceIso: undefined, untilIso: undefined, rangeLabel: "all time" };
}

export type AlertSeverity = "critical" | "warning" | "info";

export interface OperationalAlertInput {
  id: string;
  label: string;
  count: number;
  href: string;
  severity: AlertSeverity;
}

/**
 * Filters a fixed, caller-supplied list of candidate alerts down to the
 * ones that actually have something to show (count > 0), then orders by
 * severity (critical first) and, within a severity, by count descending —
 * so the Command Centre's alert list always leads with what needs
 * attention most, never an arbitrary insertion order. Pure and
 * unit-testable: every count is computed by the caller from a real bounded
 * query, never fabricated here.
 */
export function rankOperationalAlerts(candidates: OperationalAlertInput[]): OperationalAlertInput[] {
  const severityRank: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return candidates
    .filter((c) => c.count > 0)
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || b.count - a.count);
}
