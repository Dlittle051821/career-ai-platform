import "server-only";
import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { bucketRevenueByMonth, rankOperationalAlerts, sumRecordedRevenue, tallyByKey, withShareOfTotal, type CurrencyRevenueTrend, type OperationalAlertInput } from "@/lib/admin/analytics";
import { OUTCOME_STAGE_LABELS, OUTCOME_STAGES, type AuditLogEntry } from "@/types/admin";
import { isKnownAdminRole } from "@/lib/admin/permissions";

export interface AdminDashboardSummary {
  totalStudents: number;
  activeStudents: number;
  newLeadsCount: number;
  leadsNeedingFollowUp: number;
  activeApplicationsCount: number;
  upcomingDeadlinesCount: number;
  pendingPaymentsCount: number;
  /**
   * NW08.2 fix — this was previously a single {amount, currency} pair that
   * silently summed every paid payment's amount regardless of its own
   * currency (only the FIRST row's currency label was kept, so a platform
   * with more than one active currency would have shown a mixed-currency
   * total under one, arbitrary, currency label). This is exactly the kind
   * of revenue-accuracy mistake the NW08 brief's §16 rules exist to catch
   * ("never sum revenue across currencies"). Fixed here to the same
   * group-by-currency-first pattern src/lib/supabase/admin/analytics.ts's
   * getAnalyticsSummary() already uses correctly, so both surfaces agree.
   */
  recordedRevenueByCurrency: { currency: string; amountMinorUnits: number }[];
  /** NW08.2 — trailing-6-month paid-revenue trend, per currency, zero-filled per month. See bucketRevenueByMonth(). */
  revenueTrend: CurrencyRevenueTrend[];
  /**
   * NW08.2 — count of refund cases currently in a non-terminal state
   * (requested/under_review/approved/processing). "Pending" here means
   * "not yet processed, failed, rejected, or cancelled" — it is never
   * conflated with Payment.refundStatus (a separate, coarser field on the
   * payments table) and it never counts a refund REQUEST as a completed
   * refund. See docs/milestones/NW08/NW08_01_ADMIN_AUDIT.md §6.
   */
  pendingRefundsCount: number;
  /**
   * NW08.2 — a real, already-tracked composite distribution of students
   * across the counselling/application journey, reusing the Milestone 9
   * `student_outcomes.outcome_status` column (the same column
   * getOutcomeStatusDistribution() reads) rather than inventing a new
   * cross-table "service delivery stage" with no real backing data. Every
   * one of the 11 OUTCOME_STAGES is always present (zero-filled), so a
   * stage with no students is shown as 0, never omitted.
   */
  serviceDeliveryBreakdown: { stage: string; label: string; count: number; sharePercent: number | null }[];
  /** NW08.2 — a ranked, real-data-only operational exception feed. Empty when nothing needs attention — never padded to look non-empty. */
  operationalAlerts: OperationalAlertInput[];
  counsellorWorkload: { counsellorId: string; displayName: string; assignedStudents: number; assignedLeads: number; assignedApplications: number }[];
  recentAuditEntries: AuditLogEntry[];
  leadFunnel: { stage: string; count: number }[];
}

const LEAD_STAGES = ["new", "contacted", "qualified", "nurturing", "converted", "lost"] as const;
const NON_TERMINAL_APPLICATION_STAGES = ["inquiry", "preparing", "submitted", "under_review", "interview", "decision_pending", "offer_received"];
/** Non-terminal refund statuses — see REFUND_STATUS_TRANSITIONS in src/lib/admin/status.ts for the full 8-value graph this is a subset of. */
const PENDING_REFUND_STATUSES = ["requested", "under_review", "approved", "processing"];
/** Trailing months the Command Centre's revenue trend covers — a fixed, documented window, not configurable per request (keeps the query bounded). */
const REVENUE_TREND_MONTHS = 6;

function logAdminDbError(context: string, error: unknown) {
  console.error(`[admin/dashboard] ${context}:`, error);
}

/**
 * Everything the /admin dashboard needs, in a small, fixed number of
 * queries regardless of how much data exists — mostly `count: "exact",
 * head: true` queries (no rows transferred at all) plus a few bounded
 * column-only selects for the pieces that need real values (revenue sum,
 * counsellor workload grouping, recent audit entries). Nothing here loads
 * a full table into the browser (spec requirement). Every count is
 * genuinely queried — an empty database returns all zeros, never
 * fabricated numbers (spec: "do not fabricate live metrics").
 */
export async function getAdminDashboardSummary(): Promise<AdminDashboardSummary> {
  await requireAdminPermission("dashboard:read");
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const trendSinceIso = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - (REVENUE_TREND_MONTHS - 1), 1)).toISOString();
  const overdueActionDate = today;

  const [
    totalStudentsRes,
    activeStudentsRes,
    newLeadsRes,
    followUpRes,
    activeApplicationsRes,
    upcomingDeadlinesRes,
    pendingPaymentsRes,
    paidPaymentsRes,
    counsellorsRes,
    studentMetaRes,
    leadsAssignedRes,
    applicationsAssignedRes,
    auditRes,
    leadFunnelCounts,
    revenueTrendRowsRes,
    pendingRefundsRes,
    outcomeStatusRowsRes,
    overdueInvoicesRes,
    refundsAwaitingReviewRes,
    refundsProcessingRes,
    overdueApplicationActionsRes,
  ] = await Promise.all([
    // Total students comes from `profiles` (every registered account),
    // not `admin_student_meta` — a student only gets a meta row once an
    // admin has looked at/assigned them, so counting meta rows would
    // undercount total registrations.
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("account_type", "student"),
    supabase.from("admin_student_meta").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("stage", "new"),
    supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .lte("next_follow_up_date", today)
      .not("stage", "in", "(converted,lost)"),
    supabase.from("applications").select("*", { count: "exact", head: true }).in("stage", NON_TERMINAL_APPLICATION_STAGES),
    supabase
      .from("applications")
      .select("*", { count: "exact", head: true })
      .not("next_action_date", "is", null)
      .lte("next_action_date", new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
      .gte("next_action_date", today),
    supabase.from("payments").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("payments").select("amount_minor_units, currency, status").eq("status", "paid"),
    supabase.from("counsellors").select("id, display_name").eq("is_active", true),
    supabase.from("admin_student_meta").select("assigned_counsellor_id").not("assigned_counsellor_id", "is", null),
    supabase.from("leads").select("assigned_counsellor_id").not("assigned_counsellor_id", "is", null).not("stage", "in", "(converted,lost)"),
    supabase.from("applications").select("assigned_counsellor_id").not("assigned_counsellor_id", "is", null).in("stage", NON_TERMINAL_APPLICATION_STAGES),
    supabase.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(10),
    Promise.all(LEAD_STAGES.map((stage) => supabase.from("leads").select("*", { count: "exact", head: true }).eq("stage", stage))),
    // Revenue trend — bounded to the last REVENUE_TREND_MONTHS calendar
    // months, narrow column select only (never a full row/table load).
    supabase.from("payments").select("amount_minor_units, currency, status, created_at").eq("status", "paid").gte("created_at", trendSinceIso),
    // Pending refunds — count-only, non-terminal statuses. See
    // PENDING_REFUND_STATUSES docblock above.
    supabase.from("refunds").select("*", { count: "exact", head: true }).in("status", PENDING_REFUND_STATUSES),
    // Service delivery breakdown — one bounded single-column select, the
    // same table/column getOutcomeStatusDistribution() reads, counted
    // in-memory via tallyByKey() rather than re-deriving a second query
    // shape (src/lib/supabase/admin/outcomes.ts's own helper is private
    // and gated by a separate `analytics:read` permission this
    // `dashboard:read`-gated summary must not additionally require).
    supabase.from("student_outcomes").select("outcome_status"),
    // Operational alerts — each one a single bounded count query, same
    // pattern as every other count in this function.
    supabase.from("invoices").select("*", { count: "exact", head: true }).eq("status", "overdue"),
    supabase.from("refunds").select("*", { count: "exact", head: true }).in("status", ["requested", "under_review"]),
    supabase.from("refunds").select("*", { count: "exact", head: true }).eq("status", "processing"),
    supabase
      .from("applications")
      .select("*", { count: "exact", head: true })
      .not("next_action_date", "is", null)
      .lt("next_action_date", overdueActionDate)
      .in("stage", NON_TERMINAL_APPLICATION_STAGES),
  ]);

  for (const [label, res] of [
    ["totalStudents", totalStudentsRes],
    ["activeStudents", activeStudentsRes],
    ["newLeads", newLeadsRes],
    ["followUp", followUpRes],
    ["activeApplications", activeApplicationsRes],
    ["upcomingDeadlines", upcomingDeadlinesRes],
    ["pendingPayments", pendingPaymentsRes],
    ["paidPayments", paidPaymentsRes],
    ["counsellors", counsellorsRes],
    ["studentMeta", studentMetaRes],
    ["leadsAssigned", leadsAssignedRes],
    ["applicationsAssigned", applicationsAssignedRes],
    ["audit", auditRes],
    ["revenueTrendRows", revenueTrendRowsRes],
    ["pendingRefunds", pendingRefundsRes],
    ["outcomeStatusRows", outcomeStatusRowsRes],
    ["overdueInvoices", overdueInvoicesRes],
    ["refundsAwaitingReview", refundsAwaitingReviewRes],
    ["refundsProcessing", refundsProcessingRes],
    ["overdueApplicationActions", overdueApplicationActionsRes],
  ] as const) {
    if (res.error) logAdminDbError(label, res.error);
  }

  const counsellorById = new Map((counsellorsRes.data ?? []).map((c) => [c.id, c.display_name]));
  const countBy = (rows: { assigned_counsellor_id: string | null }[] | null) => {
    const map = new Map<string, number>();
    for (const row of rows ?? []) {
      if (!row.assigned_counsellor_id) continue;
      map.set(row.assigned_counsellor_id, (map.get(row.assigned_counsellor_id) ?? 0) + 1);
    }
    return map;
  };
  const studentCounts = countBy(studentMetaRes.data);
  const leadCounts = countBy(leadsAssignedRes.data);
  const applicationCounts = countBy(applicationsAssignedRes.data);

  const counsellorWorkload = [...counsellorById.entries()].map(([counsellorId, displayName]) => ({
    counsellorId,
    displayName,
    assignedStudents: studentCounts.get(counsellorId) ?? 0,
    assignedLeads: leadCounts.get(counsellorId) ?? 0,
    assignedApplications: applicationCounts.get(counsellorId) ?? 0,
  }));

  const recentAuditEntries: AuditLogEntry[] = (auditRes.data ?? []).map((row) => ({
    id: row.id,
    actorUserId: row.actor_user_id,
    actorRole: isKnownAdminRole(row.actor_role) ? row.actor_role : null,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    summary: row.summary,
    changes: (row.changes as Record<string, unknown> | null) ?? null,
    context: (row.context as Record<string, unknown> | null) ?? null,
    createdAt: row.created_at,
  }));

  const paidPayments = paidPaymentsRes.data ?? [];
  // Grouped by currency FIRST, then summed within each group — see this
  // field's docblock on AdminDashboardSummary for the bug this replaced.
  const paidByCurrency = new Map<string, { amountMinorUnits: number; status: string }[]>();
  for (const p of paidPayments) {
    const list = paidByCurrency.get(p.currency) ?? [];
    list.push({ amountMinorUnits: p.amount_minor_units, status: p.status });
    paidByCurrency.set(p.currency, list);
  }
  const recordedRevenueByCurrency = Array.from(paidByCurrency.entries()).map(([currency, rows]) => ({
    currency,
    amountMinorUnits: sumRecordedRevenue(rows),
  }));

  const revenueTrend = bucketRevenueByMonth(
    (revenueTrendRowsRes.data ?? []).map((r) => ({
      amountMinorUnits: r.amount_minor_units,
      currency: r.currency,
      status: r.status,
      createdAt: r.created_at,
    })),
    REVENUE_TREND_MONTHS,
    new Date()
  );

  const outcomeTally = tallyByKey((outcomeStatusRowsRes.data ?? []).map((r) => r.outcome_status));
  const outcomeCountByStage = new Map(outcomeTally.map((t) => [t.stage, t.count]));
  const serviceDeliveryFunnel = withShareOfTotal(OUTCOME_STAGES.map((stage) => ({ stage, count: outcomeCountByStage.get(stage) ?? 0 })));
  const serviceDeliveryBreakdown = serviceDeliveryFunnel.map((row) => ({
    stage: row.stage,
    label: OUTCOME_STAGE_LABELS[row.stage as keyof typeof OUTCOME_STAGE_LABELS] ?? row.stage,
    count: row.count,
    sharePercent: row.sharePercent,
  }));

  const operationalAlerts = rankOperationalAlerts([
    { id: "leads-overdue-followup", label: "Leads overdue for follow-up", count: followUpRes.count ?? 0, href: "/admin/leads", severity: "warning" },
    {
      id: "applications-overdue-action",
      label: "Applications with an overdue next action",
      count: overdueApplicationActionsRes.count ?? 0,
      href: "/admin/applications",
      severity: "critical",
    },
    { id: "invoices-overdue", label: "Invoices overdue", count: overdueInvoicesRes.count ?? 0, href: "/admin/invoices", severity: "critical" },
    {
      id: "refunds-awaiting-review",
      label: "Refund cases awaiting your review",
      count: refundsAwaitingReviewRes.count ?? 0,
      href: "/admin/refunds",
      severity: "warning",
    },
    {
      id: "refunds-processing",
      label: "Refund cases awaiting gateway confirmation",
      count: refundsProcessingRes.count ?? 0,
      href: "/admin/refunds",
      severity: "info",
    },
  ]);

  const leadFunnel = LEAD_STAGES.map((stage, i) => ({ stage, count: leadFunnelCounts[i].count ?? 0 }));

  return {
    totalStudents: totalStudentsRes.count ?? 0,
    activeStudents: activeStudentsRes.count ?? 0,
    newLeadsCount: newLeadsRes.count ?? 0,
    leadsNeedingFollowUp: followUpRes.count ?? 0,
    activeApplicationsCount: activeApplicationsRes.count ?? 0,
    upcomingDeadlinesCount: upcomingDeadlinesRes.count ?? 0,
    pendingPaymentsCount: pendingPaymentsRes.count ?? 0,
    recordedRevenueByCurrency,
    revenueTrend,
    pendingRefundsCount: pendingRefundsRes.count ?? 0,
    serviceDeliveryBreakdown,
    operationalAlerts,
    counsellorWorkload,
    recentAuditEntries,
    leadFunnel,
  };
}
