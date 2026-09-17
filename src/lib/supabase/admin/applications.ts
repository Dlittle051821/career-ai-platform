import "server-only";
import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { recordAuditLog } from "./audit";
import { AdminValidationError } from "@/lib/admin/form-state";
import { APPLICATION_STAGE_TRANSITIONS, isValidTransition } from "@/lib/admin/status";
import { cleanFilterParam, clampPageSize, pageToRange, parsePageParam } from "@/lib/admin/pagination";
import { trackEvent } from "../analytics/track";
import { getNotifier } from "@/lib/notifications/get-notifier";
import { APPLICATION_STAGE_LABELS, type AdminListResult, type Application, type ApplicationStage, type ApplicationStatusHistoryEntry, type DecisionStatus } from "@/types/admin";

function logDbError(context: string, error: unknown) {
  console.error(`[admin/applications] ${context}:`, error);
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function buildUniversityNameMap(supabase: Supabase, ids: (string | null)[]): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(ids.filter((id): id is string => id !== null)));
  if (uniqueIds.length === 0) return new Map();
  const { data, error } = await supabase.from("universities").select("id, name").in("id", uniqueIds);
  if (error) {
    logDbError("buildUniversityNameMap", error);
    return new Map();
  }
  return new Map((data ?? []).map((r) => [r.id, r.name]));
}

async function buildCourseNameMap(supabase: Supabase, ids: (string | null)[]): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(ids.filter((id): id is string => id !== null)));
  if (uniqueIds.length === 0) return new Map();
  const { data, error } = await supabase.from("courses").select("id, name").in("id", uniqueIds);
  if (error) {
    logDbError("buildCourseNameMap", error);
    return new Map();
  }
  return new Map((data ?? []).map((r) => [r.id, r.name]));
}

async function buildStudentNameMap(supabase: Supabase, ids: (string | null)[]): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(ids.filter((id): id is string => id !== null)));
  if (uniqueIds.length === 0) return new Map();
  const { data, error } = await supabase.from("profiles").select("id, full_name").in("id", uniqueIds);
  if (error) {
    logDbError("buildStudentNameMap", error);
    return new Map();
  }
  return new Map((data ?? []).map((p) => [p.id, p.full_name ?? "Unnamed student"]));
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

interface AppRow {
  id: string;
  student_user_id: string;
  university_id: string | null;
  course_id: string | null;
  course_intake_id: string | null;
  assigned_counsellor_id: string | null;
  stage: string;
  intake: string | null;
  submission_date: string | null;
  decision_status: string;
  offer_type: string | null;
  deadlines: unknown;
  next_action: string | null;
  next_action_date: string | null;
  last_contact_date: string | null;
  internal_notes: string | null;
  student_note: string | null;
  submitted_at: string | null;
  decision_at: string | null;
  withdrawn_at: string | null;
  created_at: string;
  updated_at: string;
}

function toApplication(
  row: AppRow,
  studentNameById: Map<string, string>,
  universityNameById: Map<string, string>,
  courseNameById: Map<string, string>,
  counsellorNameById: Map<string, string>
): Application {
  return {
    id: row.id,
    studentUserId: row.student_user_id,
    studentName: studentNameById.get(row.student_user_id) ?? null,
    universityId: row.university_id,
    universityName: row.university_id ? (universityNameById.get(row.university_id) ?? null) : null,
    courseId: row.course_id,
    courseName: row.course_id ? (courseNameById.get(row.course_id) ?? null) : null,
    courseIntakeId: row.course_intake_id,
    assignedCounsellorId: row.assigned_counsellor_id,
    assignedCounsellorName: row.assigned_counsellor_id ? (counsellorNameById.get(row.assigned_counsellor_id) ?? null) : null,
    stage: row.stage as ApplicationStage,
    intake: row.intake,
    submissionDate: row.submission_date,
    decisionStatus: row.decision_status as DecisionStatus,
    offerType: row.offer_type,
    deadlines: Array.isArray(row.deadlines) ? (row.deadlines as unknown as Application["deadlines"]) : [],
    nextAction: row.next_action,
    nextActionDate: row.next_action_date,
    lastContactDate: row.last_contact_date,
    internalNotes: row.internal_notes,
    studentNote: row.student_note,
    submittedAt: row.submitted_at,
    decisionAt: row.decision_at,
    withdrawnAt: row.withdrawn_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ApplicationFilters {
  query?: string;
  stage?: ApplicationStage;
  studentUserId?: string;
  page?: number;
}

const PAGE_SIZE = 20;

export async function listApplications(filters: ApplicationFilters = {}): Promise<AdminListResult<Application>> {
  await requireAdminPermission("applications:read");
  const supabase = await createClient();
  const page = parsePageParam(String(filters.page ?? 1));
  const pageSize = clampPageSize(PAGE_SIZE);
  const { from, to } = pageToRange(page, pageSize);

  let query = supabase.from("applications").select("*", { count: "exact" }).order("created_at", { ascending: false });
  if (filters.stage) query = query.eq("stage", filters.stage);
  if (filters.studentUserId) query = query.eq("student_user_id", filters.studentUserId);

  // Search is applied against the student's name/email, which lives on
  // `profiles` — resolved as a pre-pass id lookup rather than an embedded
  // select, same convention as every other module here.
  const cleanedQuery = cleanFilterParam(filters.query);
  if (cleanedQuery) {
    const term = cleanedQuery.replace(/[,()%]/g, "");
    const { data: matchingProfiles } = await supabase.from("profiles").select("id").eq("account_type", "student").or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
    const ids = (matchingProfiles ?? []).map((p) => p.id);
    if (ids.length === 0) return { items: [], total: 0, page, pageSize };
    query = query.in("student_user_id", ids);
  }

  const { data, error, count } = await query.range(from, to);
  if (error) {
    logDbError("listApplications", error);
    return { items: [], total: 0, page, pageSize };
  }
  const rows = (data ?? []) as AppRow[];
  const [studentNameById, universityNameById, courseNameById, counsellorNameById] = await Promise.all([
    buildStudentNameMap(supabase, rows.map((r) => r.student_user_id)),
    buildUniversityNameMap(supabase, rows.map((r) => r.university_id)),
    buildCourseNameMap(supabase, rows.map((r) => r.course_id)),
    buildCounsellorNameMap(supabase, rows.map((r) => r.assigned_counsellor_id)),
  ]);

  return {
    items: rows.map((row) => toApplication(row, studentNameById, universityNameById, courseNameById, counsellorNameById)),
    total: count ?? 0,
    page,
    pageSize,
  };
}

export interface ApplicationDetail extends Application {
  statusHistory: ApplicationStatusHistoryEntry[];
}

export async function getApplicationById(id: string): Promise<ApplicationDetail | null> {
  await requireAdminPermission("applications:read");
  const supabase = await createClient();
  const { data, error } = await supabase.from("applications").select("*").eq("id", id).maybeSingle();
  if (error) {
    logDbError("getApplicationById", error);
    return null;
  }
  if (!data) return null;
  const row = data as AppRow;

  const [studentNameById, universityNameById, courseNameById, counsellorNameById, historyRes] = await Promise.all([
    buildStudentNameMap(supabase, [row.student_user_id]),
    buildUniversityNameMap(supabase, [row.university_id]),
    buildCourseNameMap(supabase, [row.course_id]),
    buildCounsellorNameMap(supabase, [row.assigned_counsellor_id]),
    supabase.from("application_status_history").select("*").eq("application_id", id).order("created_at", { ascending: false }),
  ]);
  if (historyRes.error) logDbError("getApplicationById:history", historyRes.error);

  return {
    ...toApplication(row, studentNameById, universityNameById, courseNameById, counsellorNameById),
    statusHistory: (historyRes.data ?? []).map((h) => ({
      id: h.id,
      applicationId: h.application_id,
      fromStatus: h.from_status,
      toStatus: h.to_status,
      changedBy: h.changed_by,
      note: h.note,
      actorType: (h.actor_type ?? "system") as ApplicationStatusHistoryEntry["actorType"],
      studentVisibleMessage: h.student_visible_message ?? null,
      createdAt: h.created_at,
    })),
  };
}

const DECISION_STATUSES: DecisionStatus[] = ["pending", "offer", "waitlist", "rejected", "deferred"];

interface ApplicationInput {
  studentUserId: string;
  universityId: string | null;
  courseId: string | null;
  assignedCounsellorId: string | null;
  intake: string | null;
  submissionDate: string | null;
  decisionStatus: DecisionStatus;
  offerType: string | null;
  nextAction: string | null;
  nextActionDate: string | null;
  lastContactDate: string | null;
  internalNotes: string | null;
}

function parseApplicationForm(formData: FormData): ApplicationInput {
  const studentUserId = String(formData.get("studentUserId") ?? "").trim();
  if (!studentUserId) throw new AdminValidationError("A student must be selected.");

  const decisionStatusRaw = String(formData.get("decisionStatus") ?? "pending").trim();
  const decisionStatus = DECISION_STATUSES.includes(decisionStatusRaw as DecisionStatus) ? (decisionStatusRaw as DecisionStatus) : "pending";

  return {
    studentUserId,
    universityId: String(formData.get("universityId") ?? "").trim() || null,
    courseId: String(formData.get("courseId") ?? "").trim() || null,
    assignedCounsellorId: String(formData.get("assignedCounsellorId") ?? "").trim() || null,
    intake: String(formData.get("intake") ?? "").trim() || null,
    submissionDate: String(formData.get("submissionDate") ?? "").trim() || null,
    decisionStatus,
    offerType: String(formData.get("offerType") ?? "").trim() || null,
    nextAction: String(formData.get("nextAction") ?? "").trim() || null,
    nextActionDate: String(formData.get("nextActionDate") ?? "").trim() || null,
    lastContactDate: String(formData.get("lastContactDate") ?? "").trim() || null,
    internalNotes: String(formData.get("internalNotes") ?? "").trim() || null,
  };
}

/**
 * Milestone 16 — best-effort student notification for an admin-driven stage
 * change. Only fires for the two moments a student genuinely cares about
 * from this direction (an offer, or a rejection) — matches M13's refunds.ts
 * precedent of notifying only on the outcomes that matter, never on every
 * intermediate operational move. Never blocks or fails the state change
 * itself: getNotifier().notify() is documented to never throw/reject (see
 * notifier.ts), and this is additionally fired with `void` for defense in
 * depth.
 */
async function notifyStudentOfStageChange(supabase: Supabase, studentUserId: string, applicationId: string, stage: ApplicationStage): Promise<void> {
  if (stage !== "offer_received" && stage !== "rejected") return;
  const { data: profile } = await supabase.from("profiles").select("email").eq("id", studentUserId).maybeSingle();
  if (!profile?.email) return;
  void getNotifier().notify({
    to: profile.email,
    template: stage === "offer_received" ? "application_offer_received" : "application_rejected",
    data: { applicationId },
  });
}

/** Confirms studentUserId actually refers to a registered student — never trust an id typed/selected client-side without a server-side existence check. */
async function assertStudentExists(supabase: Supabase, studentUserId: string): Promise<void> {
  const { data, error } = await supabase.from("profiles").select("id").eq("id", studentUserId).eq("account_type", "student").maybeSingle();
  if (error) {
    logDbError("assertStudentExists", error);
    throw new Error(error.message);
  }
  if (!data) throw new AdminValidationError("Selected student was not found.");
}

export async function createApplication(formData: FormData): Promise<string> {
  const admin = await requireAdminPermission("applications:write");
  const input = parseApplicationForm(formData);
  const supabase = await createClient();
  await assertStudentExists(supabase, input.studentUserId);

  const { data, error } = await supabase
    .from("applications")
    .insert({
      student_user_id: input.studentUserId,
      university_id: input.universityId,
      course_id: input.courseId,
      assigned_counsellor_id: input.assignedCounsellorId,
      stage: "inquiry",
      intake: input.intake,
      submission_date: input.submissionDate,
      decision_status: input.decisionStatus,
      offer_type: input.offerType,
      deadlines: [],
      next_action: input.nextAction,
      next_action_date: input.nextActionDate,
      last_contact_date: input.lastContactDate,
      internal_notes: input.internalNotes,
    })
    .select("id")
    .single();

  if (error) {
    logDbError("createApplication", error);
    throw new Error(error.message);
  }

  await supabase.from("application_status_history").insert({ application_id: data.id, from_status: null, to_status: "inquiry", changed_by: admin.userId, note: null });

  await recordAuditLog({
    action: "Created",
    entityType: "application",
    entityId: data.id,
    entityLabel: `application for student ${input.studentUserId}`,
    after: { stage: "inquiry", studentUserId: input.studentUserId },
  });

  return data.id;
}

/**
 * Milestone 16 — a stage that has genuinely reached its own terminal
 * decision/withdrawal point gets its own timestamp column set atomically in
 * the SAME conditional UPDATE that performs the transition, mirroring how
 * student_advance_application() (0017_student_application_workflow.sql)
 * sets submitted_at/withdrawn_at server-side rather than trusting a
 * caller-supplied timestamp.
 */
interface ApplicationUpdatePatch {
  university_id: string | null;
  course_id: string | null;
  assigned_counsellor_id: string | null;
  stage: string;
  intake: string | null;
  submission_date: string | null;
  decision_status: string;
  offer_type: string | null;
  next_action: string | null;
  next_action_date: string | null;
  last_contact_date: string | null;
  internal_notes: string | null;
  submitted_at?: string;
  decision_at?: string;
  withdrawn_at?: string;
}

function timestampPatchForStage(stage: ApplicationStage): Pick<ApplicationUpdatePatch, "submitted_at" | "decision_at" | "withdrawn_at"> {
  const now = new Date().toISOString();
  if (stage === "submitted") return { submitted_at: now };
  if (stage === "offer_received" || stage === "rejected") return { decision_at: now };
  if (stage === "withdrawn") return { withdrawn_at: now };
  return {};
}

/**
 * Milestone 16 — closes the same class of stale-write race the M13 FINAL
 * FINANCIAL SAFETY PATCH closed for refunds (see applyRefundTransition() in
 * src/lib/supabase/admin/refunds.ts): the previous implementation read the
 * row, validated the transition in JS, then performed `UPDATE ... WHERE id
 * = :id` with no guard on the row's status actually still being what was
 * just read. Two admins (or a retried form submit) racing on the same
 * application could silently overwrite a stage some other actor (another
 * admin, or the student's own student_advance_application() RPC) had
 * already moved on to.
 *
 * This performs `UPDATE applications SET <patch> WHERE id = :id AND stage =
 * :expectedCurrentStage RETURNING *` — the exact "expected_current_status"
 * conditional update the spec calls for. Zero rows back means the stage
 * changed since `before` was read; that is surfaced as a plain, safe
 * "refresh and try again" validation error, never silently ignored and
 * never retried automatically (an automatic retry would just re-run the
 * same stale decision against whatever the row has become).
 */
async function applyApplicationUpdate(supabase: Supabase, id: string, expectedCurrentStage: ApplicationStage, patch: ApplicationUpdatePatch): Promise<AppRow> {
  const { data, error } = await supabase.from("applications").update(patch).eq("id", id).eq("stage", expectedCurrentStage).select("*").maybeSingle();
  if (error) {
    logDbError("applyApplicationUpdate", error);
    if (error.message.includes("applications_one_active_per_student_course")) {
      throw new AdminValidationError("This student already has an active application for that course (and intake, if set) — resolve or close the existing one first.");
    }
    throw new Error(error.message);
  }
  if (!data) {
    const { data: current } = await supabase.from("applications").select("stage").eq("id", id).maybeSingle();
    if (!current) throw new AdminValidationError("Application not found.");
    throw new AdminValidationError(`This application was updated by someone else — it is now "${current.stage}". Refresh and try again.`);
  }
  return data as AppRow;
}

export async function updateApplication(id: string, formData: FormData): Promise<void> {
  const admin = await requireAdminPermission("applications:write");
  const input = parseApplicationForm(formData);
  const requestedStageRaw = String(formData.get("stage") ?? "").trim();
  const supabase = await createClient();

  const before = await getApplicationById(id);
  if (!before) throw new AdminValidationError("Application not found.");

  const requestedStage = (requestedStageRaw || before.stage) as ApplicationStage;
  if (!isValidTransition(APPLICATION_STAGE_TRANSITIONS, before.stage, requestedStage)) {
    throw new AdminValidationError(`Cannot move an application from "${before.stage}" directly to "${requestedStage}".`);
  }

  const patch: ApplicationUpdatePatch = {
    university_id: input.universityId,
    course_id: input.courseId,
    assigned_counsellor_id: input.assignedCounsellorId,
    stage: requestedStage,
    intake: input.intake,
    submission_date: input.submissionDate,
    decision_status: input.decisionStatus,
    offer_type: input.offerType,
    next_action: input.nextAction,
    next_action_date: input.nextActionDate,
    last_contact_date: input.lastContactDate,
    internal_notes: input.internalNotes,
    ...(requestedStage !== before.stage ? timestampPatchForStage(requestedStage) : {}),
  };

  const updated = await applyApplicationUpdate(supabase, id, before.stage, patch);

  if (requestedStage !== before.stage) {
    await supabase.from("application_status_history").insert({
      application_id: id,
      from_status: before.stage,
      to_status: requestedStage,
      changed_by: admin.userId,
      actor_type: "admin",
      note: null,
      student_visible_message: `Your application status changed to "${APPLICATION_STAGE_LABELS[requestedStage]}".`,
    });
    void trackEvent({
      eventName: "application_status_changed",
      source: "admin_applications",
      feature: "applications",
      entityType: "application",
      entityId: id,
      properties: { fromStage: before.stage, toStage: requestedStage },
    });
    await notifyStudentOfStageChange(supabase, before.studentUserId, id, requestedStage);
  }

  const fieldChangeSummaries: string[] = [];
  if (before.stage !== requestedStage) fieldChangeSummaries.push(`stage: ${before.stage} -> ${requestedStage}`);
  if (before.decisionStatus !== input.decisionStatus) fieldChangeSummaries.push(`decisionStatus: ${before.decisionStatus} -> ${input.decisionStatus}`);

  await recordAuditLog({
    action: "Updated",
    entityType: "application",
    entityId: id,
    entityLabel: `application for student ${before.studentUserId}`,
    fieldChangeSummaries,
    before: { stage: before.stage, decisionStatus: before.decisionStatus },
    after: { stage: updated.stage, decisionStatus: input.decisionStatus },
  });
}
