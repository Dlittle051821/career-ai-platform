import "server-only";
import { createClient } from "../server";
import type { EducationActionResult } from "./saved-items";
import { getUniversitiesByIds } from "./universities";
import { getCoursesByIds } from "./courses";
import { resolveApplicationDeadline, type ResolvedApplicationDeadline } from "@/lib/applications/application-lifecycle";
import type { ApplicationDeadline, ApplicationStage, ApplicationStatusHistoryEntry, DecisionStatus, StudentApplicationAction } from "@/types/admin";
import { trackEvent } from "../analytics/track";
import { getNotifier } from "@/lib/notifications/get-notifier";

/**
 * Milestone 9 — a logged-in student starting an application from a course
 * page. Originally reused the Milestone 7 `applications` table directly via
 * two additive RLS policies added in PART 16 of
 * 0006_global_university_course_data.sql (a student could INSERT their own
 * row and SELECT it back, nothing more).
 *
 * Milestone 16 — this file gained the rest of the student-facing lifecycle:
 * a detail read, a student-safe history read, and the two mutation paths
 * (advance / update note), all going through SECURITY DEFINER RPCs in
 * 0017_student_application_workflow.sql rather than a direct UPDATE — see
 * that migration's PART 3 for why a bare RLS policy cannot safely express
 * the same guarantee.
 *
 * Milestone 16 v3 (database-boundary hardening) — the two original direct
 * RLS policies from 0006 are dropped entirely (0017 PART 7): an ordinary
 * student now has NO direct SELECT or INSERT access to `applications` at
 * all. Every function in this file — including startApplicationFromCourse(),
 * listMyApplications(), and getMyApplicationById(), previously the last
 * three direct-table-access holdouts — now goes through a narrow SECURITY
 * DEFINER RPC (student_start_application(), get_my_applications(),
 * get_my_application() respectively; 0017 PARTs 8-9), each of which
 * structurally excludes staff-only columns from its return shape and sets
 * every protected/admin field itself rather than trusting a caller-supplied
 * value. RLS restricts rows, not columns — see each function's own comment
 * below for the specific gap this closes.
 */

export interface StartApplicationResult extends EducationActionResult {
  applicationId?: string;
}

function logDbError(context: string, error: unknown) {
  console.error(`[education/applications] ${context}:`, error);
}

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

async function requireUserId(supabase: ServerSupabase): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  return user.id;
}

/**
 * Starts (or resumes) an application for the logged-in student from a
 * course.
 *
 * SECURITY PATCH (v3 — database-boundary hardening): this used to perform a
 * direct `.insert()` into `applications` via a student RLS policy whose
 * `WITH CHECK` clause constrained only `student_user_id = auth.uid()` — no
 * other column, meaning a caller could in principle insert an arbitrary
 * `stage`/`decision_status`/`internal_notes`/`assigned_counsellor_id` as
 * long as the owner matched. That policy is dropped entirely in
 * 0017_student_application_workflow.sql PART 7 (v3); this now delegates the
 * whole operation — ownership, protected-field assignment, course/
 * university pairing verification, reapplication-after-rejection/
 * withdrawal, and concurrency — to the SECURITY DEFINER RPC
 * `student_start_application()` (0017 PART 9), which is the single,
 * database-authoritative place all of that logic now lives. This function
 * itself validates nothing beyond "is someone logged in", by the same
 * "don't duplicate the RPC's own rules here" discipline
 * advanceMyApplication()/updateMyApplicationNote() already use.
 *
 * `application_started` analytics purposely fire only when this call
 * genuinely creates a fresh row, not when an existing non-terminal
 * application is resumed — the RPC itself returns only an id with no
 * "was this new" signal (by design: spec's own "return only the new/
 * existing application id, not the full row"), so a fast, best-effort
 * pre-check via the student-safe get_my_applications() RPC decides whether
 * to call student_start_application() at all. This is purely a UX/analytics
 * optimization, never a security boundary: the database itself (the two
 * partial unique indexes in 0017 PART 5, and student_start_application()'s
 * own reuse-or-insert logic) remains the sole source of truth for whether a
 * duplicate is actually created, exactly the same "pre-check is a fast,
 * friendly path; the database is the authoritative backstop" discipline
 * this function already used before this patch. A race that slips past
 * this pre-check (e.g. a genuine double-click) still resolves correctly —
 * the RPC returns the existing id either way — it may just occasionally
 * fire one extra analytics event, never a duplicate application.
 */
export async function startApplicationFromCourse(courseId: string, universityId: string): Promise<StartApplicationResult> {
  const supabase = await createClient();
  try {
    await requireUserId(supabase);
  } catch {
    return { success: false, error: "You need to be logged in to start an application." };
  }

  const { data: existingRows, error: existingError } = await supabase.rpc("get_my_applications");
  if (existingError) {
    logDbError("startApplicationFromCourse(check existing)", existingError);
    // Fall through and attempt the RPC rather than blocking the student on a transient read failure.
  }
  const existing = (existingRows ?? []).find((row) => row.course_id === courseId && row.stage !== "rejected" && row.stage !== "withdrawn");
  if (existing) {
    return { success: true, applicationId: existing.id };
  }

  const { data, error } = await supabase.rpc("student_start_application", { p_course_id: courseId, p_university_id: universityId });
  if (error) {
    logDbError("startApplicationFromCourse", error);
    if (error.message.includes("applications_one_active_per_student_course")) {
      return { success: false, error: "You already have an active application for this course." };
    }
    // The RPC's own thrown messages (e.g. "This course could not be found or
    // is not currently accepting applications.") are already safe, honest,
    // user-facing text — same "relay as-is" discipline advanceMyApplication()/
    // updateMyApplicationNote() already use for their own RPCs — so they are
    // relayed here rather than replaced with a second, possibly-inconsistent
    // generic message. Only a raw/unexpected Postgres error (no message, or
    // one this RPC never intentionally raises) falls back to the generic text.
    return { success: false, error: error.message || "We couldn't start your application — please try again." };
  }
  if (!data) {
    return { success: false, error: "We couldn't start your application — please try again." };
  }

  void trackEvent({
    eventName: "application_started",
    source: "course_detail_page",
    feature: "applications",
    entityType: "application",
    entityId: data,
    properties: { courseId, universityId },
  });

  return { success: true, applicationId: data };
}

export interface MyApplicationSummary {
  id: string;
  universityId: string | null;
  universityName: string | null;
  /** Milestone 16 — resolved via the linked university record (never duplicated onto `applications` itself — spec: "do not duplicate university/course fields resolvable via linked records"). */
  universityCountryName: string | null;
  courseId: string | null;
  courseName: string | null;
  /** Milestone 16 — real FK to course_intakes when linked; null for the (today, default) free-text-only case. */
  courseIntakeId: string | null;
  stage: ApplicationStage;
  intake: string | null;
  submissionDate: string | null;
  decisionStatus: DecisionStatus;
  offerType: string | null;
  deadlines: ApplicationDeadline[];
  /** Milestone 16 — the single real deadline resolved off the linked course_intakes row, if any. Never a guessed date — see resolveApplicationDeadline(). */
  resolvedDeadline: ResolvedApplicationDeadline | null;
  nextAction: string | null;
  nextActionDate: string | null;
  studentNote: string | null;
  submittedAt: string | null;
  decisionAt: string | null;
  withdrawnAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MyApplicationRow {
  id: string;
  university_id: string | null;
  course_id: string | null;
  course_intake_id: string | null;
  stage: string;
  intake: string | null;
  submission_date: string | null;
  decision_status: string;
  offer_type: string | null;
  deadlines: unknown;
  next_action: string | null;
  next_action_date: string | null;
  student_note: string | null;
  submitted_at: string | null;
  decision_at: string | null;
  withdrawn_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CourseIntakeRow {
  id: string;
  intake_name: string;
  priority_deadline: string | null;
  final_deadline: string | null;
  international_deadline: string | null;
}

async function buildIntakeDeadlineMap(supabase: ServerSupabase, ids: (string | null)[]): Promise<Map<string, ResolvedApplicationDeadline | null>> {
  const uniqueIds = Array.from(new Set(ids.filter((id): id is string => id !== null)));
  if (uniqueIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("course_intakes")
    .select("id, intake_name, priority_deadline, final_deadline, international_deadline")
    .in("id", uniqueIds);
  if (error) {
    logDbError("buildIntakeDeadlineMap", error);
    return new Map();
  }
  return new Map(
    ((data ?? []) as CourseIntakeRow[]).map((row) => [
      row.id,
      resolveApplicationDeadline({
        intakeName: row.intake_name,
        priorityDeadline: row.priority_deadline,
        finalDeadline: row.final_deadline,
        internationalDeadline: row.international_deadline,
      }),
    ])
  );
}

function toMyApplicationSummary(
  row: MyApplicationRow,
  universityById: Map<string, { name: string; countryName: string | null }>,
  courseNameById: Map<string, string>,
  deadlineByIntakeId: Map<string, ResolvedApplicationDeadline | null>
): MyApplicationSummary {
  const university = row.university_id ? universityById.get(row.university_id) : undefined;
  return {
    id: row.id,
    universityId: row.university_id,
    universityName: university?.name ?? null,
    universityCountryName: university?.countryName ?? null,
    courseId: row.course_id,
    courseName: row.course_id ? (courseNameById.get(row.course_id) ?? null) : null,
    courseIntakeId: row.course_intake_id,
    stage: row.stage as ApplicationStage,
    intake: row.intake,
    submissionDate: row.submission_date,
    decisionStatus: row.decision_status as DecisionStatus,
    offerType: row.offer_type,
    deadlines: Array.isArray(row.deadlines) ? (row.deadlines as ApplicationDeadline[]) : [],
    resolvedDeadline: row.course_intake_id ? (deadlineByIntakeId.get(row.course_intake_id) ?? null) : null,
    nextAction: row.next_action,
    nextActionDate: row.next_action_date,
    studentNote: row.student_note,
    submittedAt: row.submitted_at,
    decisionAt: row.decision_at,
    withdrawnAt: row.withdrawn_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * The logged-in student's own applications.
 *
 * SECURITY PATCH (v3 — database-boundary hardening): this used to run a
 * direct `.from("applications").select(MY_APPLICATION_COLUMNS)...` — naming
 * only a safe subset of columns in the select list. But RLS restricts ROWS,
 * not COLUMNS: the student RLS policy that made this query possible at all
 * ("Students can read their own applications", 0006 PART 16) would have let
 * a caller's own session request `internal_notes`/`assigned_counsellor_id`/
 * `last_contact_date` too, regardless of what this file's own select list
 * named — this file's column list was an application-layer convention, not
 * a database-authoritative boundary. That policy is dropped entirely in
 * 0017_student_application_workflow.sql PART 7 (v3) — an ordinary student
 * now has NO direct SELECT access to `applications` at all — and this now
 * calls `get_my_applications()` (0017 PART 8), a SECURITY DEFINER function
 * whose RETURNS TABLE structurally excludes those same staff-only columns,
 * so the boundary holds even against a caller that bypasses this file
 * entirely and calls the RPC directly.
 *
 * University/course names are resolved via the same published+active
 * public lookups the rest of this module uses; if either has since been
 * unpublished or archived, its name resolves to null rather than throwing
 * (a student's own RLS session cannot read an unpublished university/course
 * row at all, so this is the correct, unavoidable degradation, not a bug).
 */
export async function listMyApplications(): Promise<MyApplicationSummary[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase.rpc("get_my_applications");
  if (error) {
    logDbError("listMyApplications", error);
    return [];
  }

  const rows = (data ?? []) as unknown as MyApplicationRow[];
  const universityIds = rows.map((r) => r.university_id).filter((id): id is string => !!id);
  const courseIds = rows.map((r) => r.course_id).filter((id): id is string => !!id);
  const intakeIds = rows.map((r) => r.course_intake_id);
  const MAX_APPLICATIONS_NAME_LOOKUP = 200;
  const [universities, courses, deadlineByIntakeId] = await Promise.all([
    getUniversitiesByIds(universityIds),
    getCoursesByIds(courseIds, MAX_APPLICATIONS_NAME_LOOKUP),
    buildIntakeDeadlineMap(supabase, intakeIds),
  ]);
  const universityById = new Map(universities.map((u) => [u.id, { name: u.name, countryName: u.countryName }]));
  const courseNameById = new Map(courses.map((c) => [c.id, c.name]));

  return rows.map((row) => toMyApplicationSummary(row, universityById, courseNameById, deadlineByIntakeId));
}

/**
 * Milestone 16 — a single application's detail for the logged-in student.
 *
 * SECURITY PATCH (v3 — database-boundary hardening): this used to run
 * `.from("applications").select(MY_APPLICATION_COLUMNS).eq("id", id).eq
 * ("student_user_id", user.id)` — the same "safe select list, but RLS
 * restricts rows not columns" gap listMyApplications() had. Now calls
 * `get_my_application(p_application_id)` (0017 PART 8), a SECURITY DEFINER
 * function that re-verifies ownership itself
 * (`application.student_user_id = auth.uid()`) and whose RETURNS TABLE
 * structurally excludes `internal_notes`/`assigned_counsellor_id`/
 * `last_contact_date`. A mismatched id still returns null exactly like "not
 * found" (the RPC returns zero rows, never an error, for another student's
 * application), so a student probing another student's application id by
 * URL can never distinguish "doesn't exist" from "exists but isn't mine"
 * (same anti-enumeration posture as student_advance_application()'s own
 * generic error message).
 */
export async function getMyApplicationById(id: string): Promise<MyApplicationSummary | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.rpc("get_my_application", { p_application_id: id });
  if (error) {
    logDbError("getMyApplicationById", error);
    return null;
  }
  const first = (data ?? [])[0];
  if (!first) return null;
  const row = first as unknown as MyApplicationRow;

  const [universities, courses, deadlineByIntakeId] = await Promise.all([
    getUniversitiesByIds(row.university_id ? [row.university_id] : []),
    getCoursesByIds(row.course_id ? [row.course_id] : [], 1),
    buildIntakeDeadlineMap(supabase, [row.course_intake_id]),
  ]);
  const universityById = new Map(universities.map((u) => [u.id, { name: u.name, countryName: u.countryName }]));
  const courseNameById = new Map(courses.map((c) => [c.id, c.name]));

  return toMyApplicationSummary(row, universityById, courseNameById, deadlineByIntakeId);
}

export interface MyApplicationHistoryEntry {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  /** Milestone 16 — the ONLY message text ever shown here. `note` (admin/counsellor-internal) is deliberately never selected by this function — see 0017's own column comment. */
  studentVisibleMessage: string | null;
  actorType: ApplicationStatusHistoryEntry["actorType"];
  createdAt: string;
}

/**
 * Milestone 16 (post-review patch) — the student-safe slice of
 * `application_status_history` for one of the student's own applications.
 *
 * SECURITY PATCH: this used to run a plain `.from("application_status_history")
 * .select(...)` naming only the safe columns — but RLS restricts ROWS, not
 * COLUMNS. A student's own supabase-js session could, in principle, issue
 * the exact same PostgREST request with `note`/`changed_by` added to the
 * select list and RLS's old "is this my application" row check would have
 * let it through, leaking staff-internal fields. This now calls
 * `get_my_application_status_history()` (0017_student_application_workflow.sql
 * PART 4.1), a SECURITY DEFINER function whose RETURNS TABLE structurally
 * excludes `note` and `changed_by` — they are not merely left out of the
 * select list here, they do not exist anywhere in the function's return
 * shape, so this boundary holds even against a caller that bypasses this
 * file entirely and calls the RPC directly. The RPC re-verifies ownership
 * itself (`application.student_user_id = auth.uid()`), matching this
 * codebase's "never trust RLS/a single check alone" discipline used
 * throughout getMyApplicationById() and student_advance_application().
 */
export async function getMyApplicationHistory(applicationId: string): Promise<MyApplicationHistoryEntry[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase.rpc("get_my_application_status_history", { p_application_id: applicationId });
  if (error) {
    logDbError("getMyApplicationHistory", error);
    return [];
  }

  return (data ?? []).map((h) => ({
    id: h.id,
    fromStatus: h.from_status,
    toStatus: h.to_status,
    studentVisibleMessage: h.student_visible_message ?? null,
    actorType: (h.actor_type ?? "system") as ApplicationStatusHistoryEntry["actorType"],
    createdAt: h.created_at,
  }));
}

/**
 * Best-effort resolution of the logged-in student's own email for a
 * fire-and-forget confirmation notification — never a fabricated address
 * (see notifier.ts's own honesty discipline), and never itself capable of
 * blocking or failing the caller.
 */
async function resolveOwnEmail(supabase: ServerSupabase, userId: string): Promise<string | null> {
  const { data } = await supabase.from("profiles").select("email").eq("id", userId).maybeSingle();
  return data?.email ?? null;
}

/**
 * Milestone 16 — the ONLY path by which the site UI moves a student's own
 * application forward or withdraws it. Delegates every ownership check and
 * every stage-transition rule to the SECURITY DEFINER RPC
 * `student_advance_application()` (0017_student_application_workflow.sql) —
 * this function does no validation of its own beyond "is someone logged
 * in", by design: duplicating the RPC's own from-stage/to-stage rules here
 * would risk the two definitions drifting apart, and the RPC is the one
 * place that can safely combine "lock the row", "check ownership", "check
 * the current stage", and "write both the row and its history entry" as one
 * atomic unit — see that function's own docblock for why a plain client-side
 * sequence of calls cannot give the same guarantee.
 *
 * The RPC's own thrown messages are already written to be safe, honest,
 * user-facing text (never a raw Postgres/constraint error) — see its
 * `raise exception` call sites — so they are relayed here as-is rather than
 * replaced with a second, possibly-inconsistent friendly message.
 */
export async function advanceMyApplication(applicationId: string, action: StudentApplicationAction): Promise<EducationActionResult> {
  const supabase = await createClient();
  let userId: string;
  try {
    userId = await requireUserId(supabase);
  } catch {
    return { success: false, error: "You need to be logged in to update an application." };
  }

  const { data, error } = await supabase.rpc("student_advance_application", { p_application_id: applicationId, p_action: action });
  if (error) {
    logDbError("advanceMyApplication", error);
    return { success: false, error: error.message || "Application could not be updated." };
  }

  const eventName = action === "submit" ? "application_submitted" : action === "withdraw" ? "application_withdrawn" : null;
  if (eventName) {
    void trackEvent({
      eventName,
      source: "student_applications",
      feature: "applications",
      entityType: "application",
      entityId: applicationId,
      properties: { action },
    });
  }
  if (action === "submit") {
    const email = await resolveOwnEmail(supabase, userId);
    if (email) void getNotifier().notify({ to: email, template: "application_submitted", data: { applicationId } });
  }

  void data; // The RPC's returned row is not currently consumed by any caller — callers re-fetch via getMyApplicationById() for a single source of truth on what actually rendered.
  return { success: true };
}

/**
 * Milestone 16 — the ONLY path by which the site UI writes a student's own
 * `student_note`. Delegates length/trim rules to
 * `student_update_application_note()` (defense in depth: also enforced by
 * `applications_student_note_length_check`), which is itself scoped to
 * `student_user_id = auth.uid()` — never trusts a client-supplied
 * application id's ownership beyond that.
 */
export async function updateMyApplicationNote(applicationId: string, note: string): Promise<EducationActionResult> {
  const supabase = await createClient();
  try {
    await requireUserId(supabase);
  } catch {
    return { success: false, error: "You need to be logged in to update an application." };
  }

  const { error } = await supabase.rpc("student_update_application_note", { p_application_id: applicationId, p_note: note });
  if (error) {
    logDbError("updateMyApplicationNote", error);
    return { success: false, error: error.message || "Your note could not be saved." };
  }
  return { success: true };
}
