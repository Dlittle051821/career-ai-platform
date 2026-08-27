import "server-only";
import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { sumRecordedRevenue } from "@/lib/admin/analytics";
import type { AuditLogEntry } from "@/types/admin";
import { isKnownAdminRole } from "@/lib/admin/permissions";

export interface AdminDashboardSummary {
  totalStudents: number;
  activeStudents: number;
  newLeadsCount: number;
  leadsNeedingFollowUp: number;
  activeApplicationsCount: number;
  upcomingDeadlinesCount: number;
  pendingPaymentsCount: number;
  recordedRevenueMinorUnits: number;
  recordedRevenueCurrency: string;
  counsellorWorkload: { counsellorId: string; displayName: string; assignedStudents: number; assignedLeads: number; assignedApplications: number }[];
  recentAuditEntries: AuditLogEntry[];
  leadFunnel: { stage: string; count: number }[];
}

const LEAD_STAGES = ["new", "contacted", "qualified", "nurturing", "converted", "lost"] as const;
const NON_TERMINAL_APPLICATION_STAGES = ["inquiry", "preparing", "submitted", "under_review", "interview", "decision_pending", "offer_received"];

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
  const recordedRevenueMinorUnits = sumRecordedRevenue(
    paidPayments.map((p) => ({ amountMinorUnits: p.amount_minor_units, status: p.status }))
  );
  const recordedRevenueCurrency = paidPayments[0]?.currency ?? "INR";

  const leadFunnel = LEAD_STAGES.map((stage, i) => ({ stage, count: leadFunnelCounts[i].count ?? 0 }));

  return {
    totalStudents: totalStudentsRes.count ?? 0,
    activeStudents: activeStudentsRes.count ?? 0,
    newLeadsCount: newLeadsRes.count ?? 0,
    leadsNeedingFollowUp: followUpRes.count ?? 0,
    activeApplicationsCount: activeApplicationsRes.count ?? 0,
    upcomingDeadlinesCount: upcomingDeadlinesRes.count ?? 0,
    pendingPaymentsCount: pendingPaymentsRes.count ?? 0,
    recordedRevenueMinorUnits,
    recordedRevenueCurrency,
    counsellorWorkload,
    recentAuditEntries,
    leadFunnel,
  };
}
