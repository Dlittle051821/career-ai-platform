import "server-only";
import { createClient } from "../server";
import type { EducationActionResult } from "./saved-items";
import type { EducationCourseShare } from "@/types/education";

/**
 * Milestone 9 — a logged-in student sharing a course with a counsellor
 * (`education_course_shares`, PART 15 of
 * 0006_global_university_course_data.sql — see that migration section's
 * own comment for why `counsellor_id` is always left null from this file:
 * neither `counsellors` nor `admin_student_meta` has a student-self-read
 * RLS policy, so a student's own session cannot resolve which counsellor
 * to address without a new RLS grant or a SECURITY DEFINER bridge, both
 * judged out of scope here. Staff can still see every share regardless of
 * `counsellor_id` via the existing "Assigned counsellor/admins can read
 * shares directed at them" policy, so nothing is silently lost — it
 * surfaces as an unrouted item for staff to triage.
 */

const MAX_MESSAGE_LENGTH = 1000;

function logDbError(context: string, error: unknown) {
  console.error(`[education/shares] ${context}:`, error);
}

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

async function requireUserId(supabase: ServerSupabase): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  return user.id;
}

/** Shares the logged-in student has made — for showing "you shared this on {date}" state on a course page. */
export async function listMyCourseShares(): Promise<EducationCourseShare[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("education_course_shares")
    .select("id, student_user_id, course_id, counsellor_id, message, created_at")
    .eq("student_user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) {
    logDbError("listMyCourseShares", error);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    studentUserId: r.student_user_id,
    courseId: r.course_id,
    counsellorId: r.counsellor_id,
    message: r.message,
    createdAt: r.created_at,
  }));
}

/** Shares a course with staff (see module docblock re: counsellor_id). `message` is optional and clamped to MAX_MESSAGE_LENGTH so a crafted request can't write an unbounded row. */
export async function shareCourse(courseId: string, message?: string | null): Promise<EducationActionResult> {
  const supabase = await createClient();
  let userId: string;
  try {
    userId = await requireUserId(supabase);
  } catch {
    return { success: false, error: "You need to be logged in to share a course." };
  }

  const trimmedMessage = message?.trim();
  const { error } = await supabase.from("education_course_shares").insert({
    student_user_id: userId,
    course_id: courseId,
    counsellor_id: null,
    message: trimmedMessage ? trimmedMessage.slice(0, MAX_MESSAGE_LENGTH) : null,
  });
  if (error) {
    logDbError("shareCourse", error);
    return { success: false, error: "We couldn't share this course — please try again." };
  }
  return { success: true };
}
