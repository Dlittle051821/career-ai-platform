import "server-only";
import { createClient } from "../server";
import type { EducationActionResult } from "./saved-items";

/**
 * Milestone 9 — a logged-in student recording interest in a specific
 * upcoming course intake (`education_intake_interests`, PART 14 of
 * 0006_global_university_course_data.sql). Same fully-student-owned RLS
 * pattern and write conventions as saved-items.ts.
 */

function logDbError(context: string, error: unknown) {
  console.error(`[education/intake-interests] ${context}:`, error);
}

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

async function requireUserId(supabase: ServerSupabase): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  return user.id;
}

/** course_intake_id values the logged-in student has flagged interest in — empty when logged out. */
export async function listInterestedIntakeIds(): Promise<string[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase.from("education_intake_interests").select("course_intake_id").eq("student_user_id", user.id);
  if (error) {
    logDbError("listInterestedIntakeIds", error);
    return [];
  }
  return (data ?? []).map((r) => r.course_intake_id);
}

/** Idempotent — recording interest twice in the same intake is treated as success (unique(student_user_id, course_intake_id) is expected to fire and is swallowed). */
export async function recordIntakeInterest(courseIntakeId: string): Promise<EducationActionResult> {
  const supabase = await createClient();
  let userId: string;
  try {
    userId = await requireUserId(supabase);
  } catch {
    return { success: false, error: "You need to be logged in to track intakes." };
  }

  const { error } = await supabase.from("education_intake_interests").insert({
    student_user_id: userId,
    course_intake_id: courseIntakeId,
  });
  if (error && !isUniqueViolation(error)) {
    logDbError("recordIntakeInterest", error);
    return { success: false, error: "We couldn't save your interest — please try again." };
  }
  return { success: true };
}

export async function removeIntakeInterest(courseIntakeId: string): Promise<EducationActionResult> {
  const supabase = await createClient();
  let userId: string;
  try {
    userId = await requireUserId(supabase);
  } catch {
    return { success: false, error: "You need to be logged in to manage tracked intakes." };
  }

  const { error } = await supabase
    .from("education_intake_interests")
    .delete()
    .eq("student_user_id", userId)
    .eq("course_intake_id", courseIntakeId);
  if (error) {
    logDbError("removeIntakeInterest", error);
    return { success: false, error: "We couldn't remove this — please try again." };
  }
  return { success: true };
}
