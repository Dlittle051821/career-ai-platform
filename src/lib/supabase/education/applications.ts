import "server-only";
import { createClient } from "../server";
import type { EducationActionResult } from "./saved-items";
import { getUniversitiesByIds } from "./universities";
import { getCoursesByIds } from "./courses";
import type { ApplicationDeadline, ApplicationStage, DecisionStatus } from "@/types/admin";
import { trackEvent } from "../analytics/track";

/**
 * Milestone 9 — a logged-in student starting an application from a course
 * page. Reuses the Milestone 7 `applications` table exactly as-is (spec:
 * "do not create duplicate student or application systems") via the two
 * additive RLS policies added in PART 16 of
 * 0006_global_university_course_data.sql — no schema change, and the
 * admin-only fields (`assigned_counsellor_id`, `internal_notes`, stage/
 * decision transitions) stay exactly as 0004 defined them: a student can
 * INSERT their own row and SELECT it back, nothing more.
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
 * course. If the student already has an application for this exact course,
 * that existing application's id is returned instead of inserting a
 * duplicate row — a lightweight UX safeguard against double-clicks, not a
 * DB-level uniqueness constraint (the 0004 schema intentionally allows a
 * student to reapply, so this is a best-effort check, not an invariant).
 */
export async function startApplicationFromCourse(courseId: string, universityId: string): Promise<StartApplicationResult> {
  const supabase = await createClient();
  let userId: string;
  try {
    userId = await requireUserId(supabase);
  } catch {
    return { success: false, error: "You need to be logged in to start an application." };
  }

  const { data: existing, error: existingError } = await supabase
    .from("applications")
    .select("id")
    .eq("student_user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (existingError) {
    logDbError("startApplicationFromCourse(check existing)", existingError);
    // Fall through and attempt the insert rather than blocking the student on a transient read failure.
  }
  if (existing) {
    return { success: true, applicationId: existing.id };
  }

  const { data, error } = await supabase
    .from("applications")
    .insert({
      student_user_id: userId,
      university_id: universityId,
      course_id: courseId,
      assigned_counsellor_id: null,
      stage: "inquiry",
      intake: null,
      submission_date: null,
      decision_status: "pending",
      offer_type: null,
      deadlines: [],
      next_action: null,
      next_action_date: null,
      last_contact_date: null,
      internal_notes: null,
    })
    .select("id")
    .single();
  if (error) {
    logDbError("startApplicationFromCourse(insert)", error);
    return { success: false, error: "We couldn't start your application — please try again." };
  }

  void trackEvent({
    eventName: "application_started",
    source: "course_detail_page",
    feature: "applications",
    entityType: "application",
    entityId: data.id,
    properties: { courseId, universityId },
  });

  return { success: true, applicationId: data.id };
}

export interface MyApplicationSummary {
  id: string;
  universityId: string | null;
  universityName: string | null;
  courseId: string | null;
  courseName: string | null;
  stage: ApplicationStage;
  intake: string | null;
  submissionDate: string | null;
  decisionStatus: DecisionStatus;
  offerType: string | null;
  deadlines: ApplicationDeadline[];
  nextAction: string | null;
  nextActionDate: string | null;
  createdAt: string;
}

interface MyApplicationRow {
  id: string;
  university_id: string | null;
  course_id: string | null;
  stage: string;
  intake: string | null;
  submission_date: string | null;
  decision_status: string;
  offer_type: string | null;
  deadlines: unknown;
  next_action: string | null;
  next_action_date: string | null;
  created_at: string;
}

/**
 * The logged-in student's own applications — deliberately selects only a
 * safe subset of `applications` columns: `internal_notes`,
 * `assigned_counsellor_id`, and `last_contact_date` are staff-authored
 * operational fields (same "never shown to the student" convention as
 * `universities.internal_notes`/`courses.internal_notes`) and are left out
 * here even though RLS's row-level policy would technically return them if
 * selected — this function is the actual boundary for that, not RLS alone.
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

  const { data, error } = await supabase
    .from("applications")
    .select("id, university_id, course_id, stage, intake, submission_date, decision_status, offer_type, deadlines, next_action, next_action_date, created_at")
    .eq("student_user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) {
    logDbError("listMyApplications", error);
    return [];
  }

  const rows = (data ?? []) as unknown as MyApplicationRow[];
  const universityIds = rows.map((r) => r.university_id).filter((id): id is string => !!id);
  const courseIds = rows.map((r) => r.course_id).filter((id): id is string => !!id);
  const MAX_APPLICATIONS_NAME_LOOKUP = 200;
  const [universities, courses] = await Promise.all([
    getUniversitiesByIds(universityIds),
    getCoursesByIds(courseIds, MAX_APPLICATIONS_NAME_LOOKUP),
  ]);
  const universityNameById = new Map(universities.map((u) => [u.id, u.name]));
  const courseNameById = new Map(courses.map((c) => [c.id, c.name]));

  return rows.map((row) => ({
    id: row.id,
    universityId: row.university_id,
    universityName: row.university_id ? (universityNameById.get(row.university_id) ?? null) : null,
    courseId: row.course_id,
    courseName: row.course_id ? (courseNameById.get(row.course_id) ?? null) : null,
    stage: row.stage as ApplicationStage,
    intake: row.intake,
    submissionDate: row.submission_date,
    decisionStatus: row.decision_status as DecisionStatus,
    offerType: row.offer_type,
    deadlines: Array.isArray(row.deadlines) ? (row.deadlines as ApplicationDeadline[]) : [],
    nextAction: row.next_action,
    nextActionDate: row.next_action_date,
    createdAt: row.created_at,
  }));
}
