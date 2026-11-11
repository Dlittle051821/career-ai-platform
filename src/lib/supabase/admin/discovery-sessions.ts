import "server-only";
import { createClient } from "../server";
import { requireAdminPermission, requireAdminRole } from "../admin-auth";
import { recordAuditLog } from "./audit";
import { AdminValidationError } from "@/lib/admin/form-state";
import { DISCOVERY_SESSION_STATUS_TRANSITIONS, isValidTransition } from "@/lib/admin/status";
import {
  validateAssignCounsellor,
  validateCancelDiscoverySession,
  validateScheduleDiscoverySession,
} from "@/lib/discovery-sessions/rules";
import { discoverySessionWriteErrorMessage } from "@/lib/discovery-sessions/assignment-approval";
import { rpcSetAssignmentApproval, rpcStudentIdentities } from "./discovery-session-rpc";
import { cleanFilterParam, clampPageSize, pageToRange, parsePageParam } from "@/lib/admin/pagination";
import type { AdminListResult } from "@/types/admin";
import { trackEvent } from "../analytics/track";
import { istDateTimeLocalToUtcIso, InvalidIstDateTimeError } from "@/lib/discovery-sessions/ist";
import type {
  DiscoverySession,
  DiscoverySessionContactMethod,
  DiscoverySessionStatus,
} from "@/types/discovery-session";

function logDbError(context: string, error: unknown) {
  console.error(`[admin/discovery-sessions] ${context}:`, error);
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

interface DiscoverySessionRow {
  id: string;
  student_user_id: string;
  session_type: string;
  status: string;
  assigned_counsellor_id: string | null;
  preferred_contact_method: string | null;
  preferred_time_range: string | null;
  preferred_language: string | null;
  student_notes: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
  /** CC-25 0023 — absent until that migration is applied. */
  assignment_approved_counsellor_id?: string | null;
  assignment_approved_at?: string | null;
}

type StudentIdentity = { name: string | null; email: string | null };

/** CC-25 — the identity RPC accepts at most this many session ids per call. */
export const IDENTITY_LOOKUP_BATCH_SIZE = 100;

/** PostgREST / Postgres codes for "this function does not exist (yet)". */
function isMissingFunctionError(error: { code?: string | null } | null): boolean {
  return error?.code === "PGRST202" || error?.code === "42883";
}

async function buildStudentNameMapFromProfiles(supabase: Supabase, ids: string[]): Promise<Map<string, StudentIdentity>> {
  const uniqueIds = Array.from(new Set(ids));
  if (uniqueIds.length === 0) return new Map();
  const { data, error } = await supabase.from("profiles").select("id, full_name, email").in("id", uniqueIds);
  if (error) {
    logDbError("buildStudentNameMapFromProfiles", error);
    return new Map();
  }
  return new Map((data ?? []).map((p) => [p.id, { name: p.full_name ?? null, email: p.email ?? null }]));
}

/**
 * CC-25 — the student identity (name and email only) for each session the
 * viewer may identify, keyed by SESSION id. Uses the least-privilege
 * staff_discovery_session_student_identities RPC (migration 0023 CC-25):
 * admins see every student; a counsellor only for an admin-approved, active
 * assignment, or a student on their caseload. It never reads other profile
 * columns and never widens profiles RLS.
 *
 * Until that migration is applied the RPC does not exist; the lookup then
 * falls back to the pre-CC-25 profiles read, which RLS already limits (so
 * a counsellor simply sees "restricted", exactly as in CC-24). A session
 * missing from the returned map means the viewer may not identify it.
 */
async function buildStudentIdentityMap(
  supabase: Supabase,
  rows: Pick<DiscoverySessionRow, "id" | "student_user_id">[]
): Promise<Map<string, StudentIdentity>> {
  const sessionIds = Array.from(new Set(rows.map((r) => r.id)));
  if (sessionIds.length === 0) return new Map();

  const bySession = new Map<string, StudentIdentity>();
  for (let start = 0; start < sessionIds.length; start += IDENTITY_LOOKUP_BATCH_SIZE) {
    const batch = sessionIds.slice(start, start + IDENTITY_LOOKUP_BATCH_SIZE);
    const { data, error } = await rpcStudentIdentities(supabase, batch);
    if (error) {
      if (isMissingFunctionError(error)) {
        const byStudent = await buildStudentNameMapFromProfiles(supabase, rows.map((r) => r.student_user_id));
        return new Map(
          rows.flatMap((r) => {
            const identity = byStudent.get(r.student_user_id);
            return identity ? [[r.id, identity] as const] : [];
          })
        );
      }
      logDbError("buildStudentIdentityMap", error);
      return bySession;
    }
    for (const identity of data ?? []) {
      bySession.set(identity.session_id, { name: identity.full_name ?? null, email: identity.email ?? null });
    }
  }
  return bySession;
}

async function buildCounsellorNameMap(supabase: Supabase, ids: (string | null)[]): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(ids.filter((id): id is string => id !== null)));
  if (uniqueIds.length === 0) return new Map();
  const { data, error } = await supabase.from("counsellors").select("id, display_name").in("id", uniqueIds);
  if (error) {
    logDbError("buildCounsellorNameMap", error);
    return new Map();
  }
  return new Map((data ?? []).map((c) => [c.id, c.display_name]));
}

/**
 * CC-25 — whether the CURRENT assignment is admin-approved. null when the
 * database predates migration 0023 (no approval columns yet).
 */
export function isAssignmentApproved(row: Pick<DiscoverySessionRow, "assigned_counsellor_id" | "assignment_approved_counsellor_id" | "assignment_approved_at">): boolean | null {
  if (!("assignment_approved_counsellor_id" in row) || row.assignment_approved_counsellor_id === undefined) return null;
  return (
    row.assigned_counsellor_id !== null &&
    row.assignment_approved_counsellor_id === row.assigned_counsellor_id &&
    Boolean(row.assignment_approved_at)
  );
}

function toDiscoverySession(
  row: DiscoverySessionRow,
  studentBySession: Map<string, StudentIdentity>,
  counsellorNameById: Map<string, string>
): DiscoverySession {
  const student = studentBySession.get(row.id);
  return {
    id: row.id,
    studentUserId: row.student_user_id,
    studentName: student?.name ?? null,
    studentEmail: student?.email ?? null,
    studentIdentityVisible: student !== undefined,
    assignmentApproved: isAssignmentApproved(row),
    assignmentApprovedAt: row.assignment_approved_at ?? null,
    sessionType: row.session_type as DiscoverySession["sessionType"],
    status: row.status as DiscoverySessionStatus,
    assignedCounsellorId: row.assigned_counsellor_id,
    assignedCounsellorName: row.assigned_counsellor_id ? (counsellorNameById.get(row.assigned_counsellor_id) ?? null) : null,
    preferredContactMethod: row.preferred_contact_method as DiscoverySessionContactMethod | null,
    preferredTimeRange: row.preferred_time_range,
    preferredLanguage: row.preferred_language,
    studentNotes: row.student_notes,
    scheduledAt: row.scheduled_at,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
    cancellationReason: row.cancellation_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface DiscoverySessionFilters {
  status?: DiscoverySessionStatus;
  unassignedOnly?: boolean;
  /** NW07.3/07.4 — scope to one student's own Discovery Sessions (the Student Case Workspace's "Discovery Sessions" tab). RLS still applies on top — a counsellor only ever sees rows RLS already grants them, regardless of this filter. */
  studentUserId?: string;
  page?: number;
}

const PAGE_SIZE = 20;

export async function listDiscoverySessions(filters: DiscoverySessionFilters = {}): Promise<AdminListResult<DiscoverySession>> {
  await requireAdminPermission("discovery-sessions:read");
  const supabase = await createClient();
  const page = parsePageParam(String(filters.page ?? 1));
  const pageSize = clampPageSize(PAGE_SIZE);
  const { from, to } = pageToRange(page, pageSize);

  // RLS additionally scopes a counsellor's own session to unassigned rows
  // plus their own assigned rows — this query never needs to filter for
  // that itself; a counsellor session simply returns fewer rows.
  let query = supabase.from("discovery_sessions").select("*", { count: "exact" }).order("created_at", { ascending: false });
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.unassignedOnly) query = query.is("assigned_counsellor_id", null);
  if (filters.studentUserId) query = query.eq("student_user_id", filters.studentUserId);

  const { data, error, count } = await query.range(from, to);
  if (error) {
    logDbError("listDiscoverySessions", error);
    return { items: [], total: 0, page, pageSize };
  }
  const rows = data ?? [];
  const [studentById, counsellorNameById] = await Promise.all([
    buildStudentIdentityMap(supabase, rows),
    buildCounsellorNameMap(supabase, rows.map((r) => r.assigned_counsellor_id)),
  ]);
  return { items: rows.map((row) => toDiscoverySession(row, studentById, counsellorNameById)), total: count ?? 0, page, pageSize };
}

export async function getDiscoverySessionById(id: string): Promise<DiscoverySession | null> {
  await requireAdminPermission("discovery-sessions:read");
  const supabase = await createClient();
  const { data, error } = await supabase.from("discovery_sessions").select("*").eq("id", id).maybeSingle();
  if (error) {
    logDbError("getDiscoverySessionById", error);
    return null;
  }
  if (!data) return null;

  const [studentById, counsellorNameById] = await Promise.all([
    buildStudentIdentityMap(supabase, [data]),
    buildCounsellorNameMap(supabase, [data.assigned_counsellor_id]),
  ]);
  return toDiscoverySession(data, studentById, counsellorNameById);
}

interface DiscoverySessionUpdateInput {
  assignedCounsellorId: string | null;
  status: DiscoverySessionStatus;
  scheduledAt: string | null;
  cancellationReason: string | null;
}

function parseScheduledAtIst(raw: string): string {
  try {
    return istDateTimeLocalToUtcIso(raw);
  } catch (error) {
    if (error instanceof InvalidIstDateTimeError) throw new AdminValidationError(error.message);
    throw error;
  }
}

function parseDiscoverySessionForm(formData: FormData): DiscoverySessionUpdateInput {
  const assignedCounsellorId = String(formData.get("assignedCounsellorId") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "").trim() as DiscoverySessionStatus;
  const scheduledAtRaw = String(formData.get("scheduledAt") ?? "").trim();
  const cancellationReason = String(formData.get("cancellationReason") ?? "").trim() || null;
  return {
    assignedCounsellorId,
    status,
    // CC-22B: the form field is labelled IST; interpret it as Asia/Kolkata on any server.
    scheduledAt: scheduledAtRaw ? parseScheduledAtIst(scheduledAtRaw) : null,
    cancellationReason,
  };
}

/**
 * One combined update covering assignment, scheduling, and status —
 * mirrors updateLead()'s single-form pattern. Each kind of change is
 * validated by its own pure rule (validateAssignCounsellor/
 * validateScheduleDiscoverySession/validateCancelDiscoverySession) before
 * anything is written; the status transition itself is additionally
 * checked against DISCOVERY_SESSION_STATUS_TRANSITIONS. A counsellor
 * self-claiming an unassigned session is just an ordinary assignment
 * change to their own counsellor id — RLS (0013 PART 2) is what actually
 * decides whether they're allowed to write this row at all.
 */
export async function updateDiscoverySession(id: string, formData: FormData): Promise<void> {
  const admin = await requireAdminPermission("discovery-sessions:write");
  const input = parseDiscoverySessionForm(formData);
  const supabase = await createClient();

  const before = await getDiscoverySessionById(id);
  if (!before) throw new AdminValidationError("Discovery Session not found.");

  const requestedStatus = input.status || before.status;

  if (input.assignedCounsellorId !== before.assignedCounsellorId) {
    const check = validateAssignCounsellor({ hasPermission: true, sessionExists: true, status: before.status });
    if (!check.ok) throw new AdminValidationError(check.reason);
  }

  if (requestedStatus !== before.status) {
    if (!isValidTransition(DISCOVERY_SESSION_STATUS_TRANSITIONS, before.status, requestedStatus)) {
      throw new AdminValidationError(`Cannot move a Discovery Session from "${before.status}" directly to "${requestedStatus}".`);
    }
    if (requestedStatus === "scheduled") {
      const check = validateScheduleDiscoverySession({
        hasPermission: true,
        sessionExists: true,
        status: before.status,
        hasAssignedCounsellor: Boolean(input.assignedCounsellorId ?? before.assignedCounsellorId),
        scheduledAt: input.scheduledAt ?? before.scheduledAt,
      });
      if (!check.ok) throw new AdminValidationError(check.reason);
    }
    if (requestedStatus === "cancelled") {
      const check = validateCancelDiscoverySession({ hasPermission: true, sessionExists: true, status: before.status });
      if (!check.ok) throw new AdminValidationError(check.reason);
    }
  }

  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("discovery_sessions")
    .update({
      assigned_counsellor_id: input.assignedCounsellorId,
      status: requestedStatus,
      scheduled_at: input.scheduledAt ?? before.scheduledAt,
      completed_at: requestedStatus === "completed" ? nowIso : before.completedAt,
      cancelled_at: requestedStatus === "cancelled" ? nowIso : before.cancelledAt,
      cancellation_reason: requestedStatus === "cancelled" ? input.cancellationReason : before.cancellationReason,
    })
    .eq("id", id);
  if (error) {
    logDbError("updateDiscoverySession", error);
    throw new AdminValidationError(discoverySessionWriteErrorMessage(error));
  }

  const fieldChangeSummaries: string[] = [];
  if (before.assignedCounsellorId !== input.assignedCounsellorId) {
    fieldChangeSummaries.push(`assignedCounsellorId: ${before.assignedCounsellorId ?? "none"} -> ${input.assignedCounsellorId ?? "none"}`);
  }
  if (before.status !== requestedStatus) fieldChangeSummaries.push(`status: ${before.status} -> ${requestedStatus}`);

  await recordAuditLog({
    action: "Updated",
    entityType: "discovery_session",
    entityId: id,
    entityLabel: `Discovery Session for ${before.studentName ?? before.studentUserId}`,
    fieldChangeSummaries,
    before: { status: before.status, assignedCounsellorId: before.assignedCounsellorId },
    after: { status: requestedStatus, assignedCounsellorId: input.assignedCounsellorId },
    context: { actorRole: admin.role },
  });

  if (requestedStatus === "completed" && before.status !== "completed") {
    void trackEvent({
      eventName: "discovery_session_completed",
      source: "admin_discovery_sessions",
      feature: "onboarding",
      entityType: "discovery_session",
      entityId: id,
    });
  }
}

/**
 * CC-25 — an admin approves (or revokes approval of) the CURRENT counsellor
 * assignment. The database does the real work and the authorization: the
 * admin_set_discovery_session_assignment_approval RPC re-checks the admin
 * role, refuses a stale counsellor id, an inactive counsellor or an inactive
 * session, stamps approved_by/approved_at from auth.uid() and writes the
 * audit log row in the same transaction.
 */
export async function setDiscoverySessionAssignmentApproval(id: string, counsellorId: string, approved: boolean): Promise<void> {
  await requireAdminRole(["super_admin", "admin"]);
  if (!id || !counsellorId) throw new AdminValidationError("Choose a session that has an assigned counsellor.");
  const supabase = await createClient();
  const { error } = await rpcSetAssignmentApproval(supabase, { sessionId: id, counsellorId, approved });
  if (error) {
    logDbError("setDiscoverySessionAssignmentApproval", error);
    if (error.code === "PGRST202" || error.code === "42883") {
      throw new AdminValidationError("Assignment approval is not available yet: the CC-25 database update has not been applied.");
    }
    throw new AdminValidationError(discoverySessionWriteErrorMessage(error));
  }
}
