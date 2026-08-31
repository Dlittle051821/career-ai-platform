import "server-only";
import { createClient } from "../server";
import type { SavedItemEntityType } from "@/types/education";
import { trackEvent } from "../analytics/track";

/**
 * Milestone 9 — a logged-in student's own saved universities/courses
 * (`education_saved_items`, PART 13 of 0006_global_university_course_data.sql).
 * Fully student-owned data: RLS scopes every row to `auth.uid() =
 * student_user_id`, so these functions never take a student id parameter —
 * the caller is always "whoever is currently logged in". Mirrors
 * src/lib/supabase/student-profile.ts's "return null/empty when logged
 * out rather than throw" convention, and src/lib/supabase/student-profile-actions.ts's
 * `requireUserId` re-check for the two write paths (middleware protects the
 * *pages*, not a Server Action invoked directly).
 */

export interface EducationActionResult {
  success: boolean;
  error?: string;
}

function logDbError(context: string, error: unknown) {
  console.error(`[education/saved-items] ${context}:`, error);
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

/** All (entityType, entityId) pairs the logged-in student has saved — returns an empty array when logged out, matching the fail-soft read convention used throughout src/lib/supabase/education. */
export async function listSavedItems(): Promise<{ entityType: SavedItemEntityType; entityId: string }[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase.from("education_saved_items").select("entity_type, entity_id").eq("student_user_id", user.id);
  if (error) {
    logDbError("listSavedItems", error);
    return [];
  }
  return (data ?? []).map((r) => ({ entityType: r.entity_type as SavedItemEntityType, entityId: r.entity_id }));
}

/** Convenience split of listSavedItems() for pages that only need one entity type's ids (e.g. to build getUniversitiesByIds/getCoursesByIds calls, or to mark "already saved" state in a list). */
export async function listSavedEntityIds(entityType: SavedItemEntityType): Promise<string[]> {
  const items = await listSavedItems();
  return items.filter((i) => i.entityType === entityType).map((i) => i.entityId);
}

/** Idempotent save — a repeat save of the same item is treated as success (the unique(student_user_id, entity_type, entity_id) constraint is expected to fire and is swallowed), not an error, since the UI models this as a toggle. */
export async function saveItem(entityType: SavedItemEntityType, entityId: string): Promise<EducationActionResult> {
  const supabase = await createClient();
  let userId: string;
  try {
    userId = await requireUserId(supabase);
  } catch {
    return { success: false, error: "You need to be logged in to save items." };
  }

  const { error } = await supabase.from("education_saved_items").insert({
    student_user_id: userId,
    entity_type: entityType,
    entity_id: entityId,
  });
  if (error && !isUniqueViolation(error)) {
    logDbError("saveItem", error);
    return { success: false, error: "We couldn't save this — please try again." };
  }
  if (!error) {
    // Only a genuinely NEW save fires an event — a repeat save (caught
    // above as a swallowed unique-violation) never reaches here, so a
    // student re-saving something already saved never double-counts.
    void trackEvent({
      eventName: entityType === "course" ? "course_saved" : "college_saved",
      source: "saved_items",
      feature: "saved_items",
      entityType: entityType === "course" ? "course" : "university",
      entityId,
    });
  }
  return { success: true };
}

/** Idempotent remove — removing something that was never saved (or already removed) is treated as success. */
export async function removeSavedItem(entityType: SavedItemEntityType, entityId: string): Promise<EducationActionResult> {
  const supabase = await createClient();
  let userId: string;
  try {
    userId = await requireUserId(supabase);
  } catch {
    return { success: false, error: "You need to be logged in to manage saved items." };
  }

  const { error } = await supabase
    .from("education_saved_items")
    .delete()
    .eq("student_user_id", userId)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);
  if (error) {
    logDbError("removeSavedItem", error);
    return { success: false, error: "We couldn't remove this — please try again." };
  }
  return { success: true };
}
