import "server-only";
import { createClient } from "../server";
import { buildChangeSet, buildAuditSummary } from "@/lib/admin/audit";
import type { AuditLogEntry } from "@/types/admin";
import type { Json } from "@/types/database";
import { isKnownAdminRole } from "@/lib/admin/permissions";
import { requireAdminRole } from "../admin-auth";

/**
 * The only place a server action calls the record_admin_audit_log RPC
 * (see 0004_admin_system.sql PART 11) — every admin mutation that changes
 * something worth an audit trail goes through this one function, so the
 * shape of what gets written is consistent everywhere. The RPC itself
 * forces actor_user_id to the caller's own auth.uid() and stamps
 * created_at server-side — this wrapper cannot override either, even if
 * it wanted to.
 */
export async function recordAuditLog(params: {
  action: string;
  entityType: string;
  entityId: string | null;
  entityLabel: string;
  fieldChangeSummaries?: string[];
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  context?: Record<string, unknown>;
}): Promise<void> {
  const supabase = await createClient();
  const summary = buildAuditSummary(params.action, params.entityLabel, params.fieldChangeSummaries ?? []);
  const changes = buildChangeSet(params.before, params.after);

  const { error } = await supabase.rpc("record_admin_audit_log", {
    p_action: params.action,
    p_entity_type: params.entityType,
    p_entity_id: params.entityId,
    p_summary: summary,
    p_changes: Object.keys(changes).length > 0 ? (changes as unknown as Json) : null,
    p_context: (params.context as unknown as Json) ?? null,
  });

  if (error) {
    // Never let a failed audit write silently swallow the fact that it
    // failed, but also never let it block the real mutation that already
    // succeeded — the mutation's own DB write is the source of truth; the
    // audit log is a best-effort trail on top of it. Logged server-side
    // only, same "never surface a raw DB error" convention as every other
    // data-access module in this project.
    console.error("[admin/audit] record_admin_audit_log failed:", error);
  }
}

const AUDIT_LOG_PAGE_SIZE = 50;

export interface AuditLogFilters {
  entityType?: string;
  action?: string;
  page?: number;
}

export interface AuditLogPage {
  entries: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

/** Read access to the audit log itself — super_admin/admin only, enforced both here and by RLS (0004_admin_system.sql PART 11's select policy). */
export async function getAuditLog(filters: AuditLogFilters = {}): Promise<AuditLogPage> {
  await requireAdminRole(["super_admin", "admin"]);
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * AUDIT_LOG_PAGE_SIZE;
  const to = from + AUDIT_LOG_PAGE_SIZE - 1;

  let query = supabase.from("admin_audit_log").select("*", { count: "exact" }).order("created_at", { ascending: false });
  if (filters.entityType) query = query.eq("entity_type", filters.entityType);
  if (filters.action) query = query.eq("action", filters.action);

  const { data, error, count } = await query.range(from, to);
  if (error) {
    console.error("[admin/audit] getAuditLog:", error);
    return { entries: [], total: 0, page, pageSize: AUDIT_LOG_PAGE_SIZE };
  }

  const entries: AuditLogEntry[] = (data ?? []).map((row) => ({
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

  return { entries, total: count ?? 0, page, pageSize: AUDIT_LOG_PAGE_SIZE };
}

export const AUDIT_ENTITY_TYPES = [
  "student",
  "university",
  "course",
  "application",
  "lead",
  "payment",
  "agreement",
  "counsellor",
  "content_item",
  "admin_role",
  // Milestone 8 — payments/billing:
  "invoice",
  "refund",
  "billing_settings",
  "payment_gateway_config",
  // Milestone 9 — global university/course data platform. "university" and
  // "course" above are reused as-is (same tables, extended with new
  // columns — see supabase/migrations/0006_global_university_course_data.sql
  // PART 2/4) rather than duplicated here.
  "campus",
  "course_intake",
  "course_tuition_fee",
  "course_admission_requirement",
  "scholarship",
  "education_import_batch",
  "education_duplicate_candidate",
  "education_data_provenance",
  "country",
  // Milestone 10 — NextWise Pricing & Offers.
  "pricing_plan",
  "pricing_plan_version",
  "pricing_offer",
] as const;
