import "server-only";
import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { computeRate, sumRecordedRevenue, type RateResult, type FunnelStageCount } from "@/lib/admin/analytics";
import { listCounsellorWorkload } from "./counsellors";
import { getOutcomeStatusDistribution } from "./outcomes";
import { IMPLEMENTED_EVENT_NAMES, type ImplementedEventName } from "@/lib/analytics/events";
import type { CounsellorWorkload, LeadStage, ApplicationStage, PaymentStatus } from "@/types/admin";

/**
 * Every query here is either a `count: "exact", head: true` query (no rows
 * transferred at all) or a bounded, narrow column select (e.g. just
 * `amount_minor_units, currency, status` for revenue) — never a full-row
 * table scan. Metric definitions are documented in
 * docs/admin-system-guide.md §11; this file computes them, it does not
 * define them independently of that doc.
 */

function logDbError(context: string, error: unknown) {
  console.error(`[admin/analytics] ${context}:`, error);
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

const LEAD_STAGES: LeadStage[] = ["new", "contacted", "qualified", "nurturing", "converted", "lost"];
const APPLICATION_STAGES: ApplicationStage[] = [
  "inquiry",
  "preparing",
  "submitted",
  "under_review",
  "interview",
  "decision_pending",
  "offer_received",
  "enrolled",
  "rejected",
  "withdrawn",
];
const PAYMENT_STATUSES: PaymentStatus[] = ["pending", "paid", "failed", "refunded", "partially_refunded", "cancelled"];

/**
 * NW08.7 — a date window with an optional floor AND an optional ceiling
 * (the pre-NW08 code only ever had a floor — "trailing N days" has no
 * natural upper bound other than "now"). Every query helper below takes
 * one of these instead of a bare `sinceIso: string | null`, so adding a
 * real calendar-month/custom-range filter meant widening this one shape
 * once rather than re-deriving a two-sided bound at each of the ~10 call
 * sites. An absent bound means "unbounded on that side" — exactly the old
 * "All time" behavior when both are absent.
 */
export interface DateWindow {
  sinceIso: string | null;
  untilIso: string | null;
}

async function countWhere(supabase: Supabase, table: "leads" | "applications" | "payments", column: string, value: string, window: DateWindow): Promise<number> {
  let query = supabase.from(table).select("*", { count: "exact", head: true }).eq(column, value);
  if (window.sinceIso) query = query.gte("created_at", window.sinceIso);
  if (window.untilIso) query = query.lt("created_at", window.untilIso);
  const { count, error } = await query;
  if (error) {
    logDbError(`countWhere:${table}.${column}=${value}`, error);
    return 0;
  }
  return count ?? 0;
}

async function totalCount(supabase: Supabase, table: "leads" | "applications" | "payments", window: DateWindow): Promise<number> {
  let query = supabase.from(table).select("*", { count: "exact", head: true });
  if (window.sinceIso) query = query.gte("created_at", window.sinceIso);
  if (window.untilIso) query = query.lt("created_at", window.untilIso);
  const { count, error } = await query;
  if (error) {
    logDbError(`totalCount:${table}`, error);
    return 0;
  }
  return count ?? 0;
}

function topCountsFromValues(values: (string | null)[], limit: number): { key: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Top-N lead sources computed in-memory from one bounded single-column select — safe because a single counselling operation's lead volume is expected to be modest, never millions of rows. */
async function topLeadSources(supabase: Supabase, window: DateWindow, limit: number): Promise<{ key: string; count: number }[]> {
  let query = supabase.from("leads").select("source");
  if (window.sinceIso) query = query.gte("created_at", window.sinceIso);
  if (window.untilIso) query = query.lt("created_at", window.untilIso);
  const { data, error } = await query;
  if (error) {
    logDbError("topLeadSources", error);
    return [];
  }
  return topCountsFromValues((data ?? []).map((r) => r.source), limit);
}

/** Top-N universities by application interest, same bounded single-column-select approach. */
async function topUniversitiesByApplicationCount(supabase: Supabase, window: DateWindow, limit: number): Promise<{ key: string; count: number }[]> {
  let query = supabase.from("applications").select("university_id");
  if (window.sinceIso) query = query.gte("created_at", window.sinceIso);
  if (window.untilIso) query = query.lt("created_at", window.untilIso);
  const { data, error } = await query;
  if (error) {
    logDbError("topUniversitiesByApplicationCount", error);
    return [];
  }
  return topCountsFromValues((data ?? []).map((r) => r.university_id), limit);
}

export interface AnalyticsFilters {
  /** Number of trailing days to scope leads/applications/payments to; omitted = all time. Counsellor workload is always current, not time-scoped. Ignored when sinceIso is also given. */
  sinceDays?: number;
  /** NW08.7 — explicit lower bound (inclusive), for a calendar-month or custom-range filter. Takes precedence over sinceDays. */
  sinceIso?: string;
  /** NW08.7 — explicit upper bound (exclusive). With no sinceDays/sinceIso, this alone still bounds the window (e.g. "everything before X"). */
  untilIso?: string;
}

/**
 * Milestone 9 — product/outcome metrics, additive to the Milestone 7
 * summary above. `eventCounts` is only ever keyed by
 * IMPLEMENTED_EVENT_NAMES (src/lib/analytics/events.ts) — a reserved event
 * name is never queried here since no code path ever inserts one, so its
 * count would always be a misleading, guaranteed zero. See
 * docs/M9_IMPLEMENTATION.md §"Admin analytics" for what each figure means
 * and docs/OUT-001_OUTCOME_DATA_FOUNDATION.md for outcomeStatusDistribution.
 */
export interface ProductAnalyticsSummary {
  totalStudentUsers: number;
  newRegistrations: number;
  profileCompletionCount: number;
  profileCompletionRate: RateResult;
  eventCounts: Record<ImplementedEventName, number>;
  invoicesPaid: number;
  outcomeStatusDistribution: { status: string; count: number }[];
}

export interface AnalyticsSummary {
  sinceDays: number | null;
  /** NW08.7 — the effective window actually applied (after resolving sinceDays/sinceIso/untilIso), so the page can state exactly what it filtered to rather than re-deriving it. */
  effectiveWindow: DateWindow;
  leadFunnel: FunnelStageCount[];
  leadToStudentConversion: RateResult;
  applicationStageDistribution: FunnelStageCount[];
  applicationOfferRate: RateResult;
  counsellorWorkload: CounsellorWorkload[];
  paymentStatusDistribution: FunnelStageCount[];
  recordedRevenueByCurrency: { currency: string; amountMinorUnits: number }[];
  topLeadSources: { key: string; count: number }[];
  topUniversitiesByInterest: { universityId: string; universityName: string; count: number }[];
  product: ProductAnalyticsSummary;
}

async function countProductEvent(supabase: Supabase, eventName: ImplementedEventName, window: DateWindow): Promise<number> {
  let query = supabase.from("product_events").select("*", { count: "exact", head: true }).eq("event_name", eventName);
  if (window.sinceIso) query = query.gte("created_at", window.sinceIso);
  if (window.untilIso) query = query.lt("created_at", window.untilIso);
  const { count, error } = await query;
  if (error) {
    logDbError(`countProductEvent:${eventName}`, error);
    return 0;
  }
  return count ?? 0;
}

/** Milestone 9 — the additive product/outcome metrics block. Every count here is a small, targeted `count: "exact", head: true` query (or, for outcomeStatusDistribution, the one bounded single-column select getOutcomeStatusDistribution() already uses) — same discipline as the rest of this file. */
async function getProductAnalyticsSummary(supabase: Supabase, window: DateWindow): Promise<ProductAnalyticsSummary> {
  const [totalStudentUsers, newRegistrations, profileCompletionCount, eventCountEntries, invoicesPaid, outcomeStatusDistribution] = await Promise.all([
    (async () => {
      const { count, error } = await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("account_type", "student");
      if (error) {
        logDbError("totalStudentUsers", error);
        return 0;
      }
      return count ?? 0;
    })(),
    (async () => {
      let query = supabase.from("profiles").select("*", { count: "exact", head: true }).eq("account_type", "student");
      if (window.sinceIso) query = query.gte("created_at", window.sinceIso);
      if (window.untilIso) query = query.lt("created_at", window.untilIso);
      const { count, error } = await query;
      if (error) {
        logDbError("newRegistrations", error);
        return 0;
      }
      return count ?? 0;
    })(),
    (async () => {
      let query = supabase.from("student_profiles").select("*", { count: "exact", head: true }).eq("profile_status", "completed");
      if (window.sinceIso) query = query.gte("updated_at", window.sinceIso);
      if (window.untilIso) query = query.lt("updated_at", window.untilIso);
      const { count, error } = await query;
      if (error) {
        logDbError("profileCompletionCount", error);
        return 0;
      }
      return count ?? 0;
    })(),
    Promise.all(IMPLEMENTED_EVENT_NAMES.map(async (name) => [name, await countProductEvent(supabase, name, window)] as const)),
    (async () => {
      let query = supabase.from("invoices").select("*", { count: "exact", head: true }).eq("status", "paid");
      if (window.sinceIso) query = query.gte("created_at", window.sinceIso);
      if (window.untilIso) query = query.lt("created_at", window.untilIso);
      const { count, error } = await query;
      if (error) {
        logDbError("invoicesPaid", error);
        return 0;
      }
      return count ?? 0;
    })(),
    getOutcomeStatusDistribution(),
  ]);

  return {
    totalStudentUsers,
    newRegistrations,
    profileCompletionCount,
    profileCompletionRate: computeRate(profileCompletionCount, totalStudentUsers),
    eventCounts: Object.fromEntries(eventCountEntries) as Record<ImplementedEventName, number>,
    invoicesPaid,
    outcomeStatusDistribution,
  };
}

export async function getAnalyticsSummary(filters: AnalyticsFilters = {}): Promise<AnalyticsSummary> {
  await requireAdminPermission("analytics:read");
  const supabase = await createClient();
  // NW08.7 — an explicit sinceIso/untilIso pair (a real calendar-month or
  // custom range) takes precedence over the legacy sinceDays convenience;
  // all three absent means "all time", exactly as before NW08.
  const window: DateWindow = {
    sinceIso: filters.sinceIso ?? (filters.sinceDays ? new Date(Date.now() - filters.sinceDays * 24 * 60 * 60 * 1000).toISOString() : null),
    untilIso: filters.untilIso ?? null,
  };

  const [leadStageCounts, applicationStageCounts, paymentStatusCounts, totalLeads, totalApplications, counsellorWorkload, revenueRows, topSources, topUniversityIds, product] =
    await Promise.all([
      Promise.all(LEAD_STAGES.map(async (stage) => ({ stage, count: await countWhere(supabase, "leads", "stage", stage, window) }))),
      Promise.all(APPLICATION_STAGES.map(async (stage) => ({ stage, count: await countWhere(supabase, "applications", "stage", stage, window) }))),
      Promise.all(PAYMENT_STATUSES.map(async (status) => ({ stage: status, count: await countWhere(supabase, "payments", "status", status, window) }))),
      totalCount(supabase, "leads", window),
      totalCount(supabase, "applications", window),
      listCounsellorWorkload(),
      (async () => {
        let query = supabase.from("payments").select("amount_minor_units, currency, status");
        if (window.sinceIso) query = query.gte("created_at", window.sinceIso);
        if (window.untilIso) query = query.lt("created_at", window.untilIso);
        const { data, error } = await query;
        if (error) {
          logDbError("revenueRows", error);
          return [];
        }
        return data ?? [];
      })(),
      topLeadSources(supabase, window, 5),
      topUniversitiesByApplicationCount(supabase, window, 5),
      getProductAnalyticsSummary(supabase, window),
    ]);

  const convertedLeads = leadStageCounts.find((s) => s.stage === "converted")?.count ?? 0;
  const offerCount =
    (applicationStageCounts.find((s) => s.stage === "offer_received")?.count ?? 0) + (applicationStageCounts.find((s) => s.stage === "enrolled")?.count ?? 0);

  // Grouped by currency FIRST, then summed within each group via the same
  // sumRecordedRevenue() helper the payments module's own math is tested
  // against — amounts in different currencies are never added together
  // (see docs/admin-system-guide.md §11).
  const paymentRowsByCurrency = new Map<string, { amountMinorUnits: number; status: string }[]>();
  for (const row of revenueRows as { amount_minor_units: number; currency: string; status: string }[]) {
    const list = paymentRowsByCurrency.get(row.currency) ?? [];
    list.push({ amountMinorUnits: row.amount_minor_units, status: row.status });
    paymentRowsByCurrency.set(row.currency, list);
  }
  const revenueByCurrency = new Map<string, number>();
  for (const [currency, rows] of paymentRowsByCurrency) {
    revenueByCurrency.set(currency, sumRecordedRevenue(rows));
  }

  let universityNameById = new Map<string, string>();
  const universityIds = topUniversityIds.map((u) => u.key);
  if (universityIds.length > 0) {
    const { data, error } = await supabase.from("universities").select("id, name").in("id", universityIds);
    if (error) logDbError("universityNames", error);
    universityNameById = new Map((data ?? []).map((u) => [u.id, u.name]));
  }

  return {
    sinceDays: filters.sinceDays ?? null,
    effectiveWindow: window,
    leadFunnel: leadStageCounts,
    leadToStudentConversion: computeRate(convertedLeads, totalLeads),
    applicationStageDistribution: applicationStageCounts,
    applicationOfferRate: computeRate(offerCount, totalApplications),
    counsellorWorkload,
    paymentStatusDistribution: paymentStatusCounts,
    recordedRevenueByCurrency: Array.from(revenueByCurrency.entries()).map(([currency, amountMinorUnits]) => ({ currency, amountMinorUnits })),
    topLeadSources: topSources,
    topUniversitiesByInterest: topUniversityIds.map((u) => ({
      universityId: u.key,
      universityName: universityNameById.get(u.key) ?? "Unknown",
      count: u.count,
    })),
    product,
  };
}
