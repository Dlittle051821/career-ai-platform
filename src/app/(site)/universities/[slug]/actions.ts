"use server";

import { revalidatePath } from "next/cache";
import { saveItem, removeSavedItem } from "@/lib/supabase/education/saved-items";
import { getUniversityAccess } from "@/lib/supabase/education/university-access";
import { getUniversitiesByIds } from "@/lib/supabase/education/universities";

export interface ToggleSaveUniversityResult {
  saved: boolean;
  error: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Saves or removes a university for the signed-in student.
 *
 * Authorisation is decided here, on the server, on every call:
 *   - saving needs a signed-in student with Verified directory access, and the
 *     id must be a published university that student is allowed to read;
 *   - removing only needs the student's own session (a student whose access
 *     has ended can still tidy their own list).
 * Rows are always written for auth.uid(); RLS on education_saved_items makes
 * it impossible to touch another student's list.
 */
export async function toggleSaveUniversityAction(universityId: string, slug: string, nextSaved: boolean): Promise<ToggleSaveUniversityResult> {
  if (typeof universityId !== "string" || !UUID.test(universityId)) {
    return { saved: !nextSaved, error: "That university could not be found." };
  }

  const access = await getUniversityAccess();
  if (access === "anonymous") {
    return { saved: !nextSaved, error: "Your session has ended. Log in again to manage your saved universities." };
  }

  if (nextSaved) {
    if (access === "admin") return { saved: false, error: "Staff accounts do not have a student shortlist." };
    if (access !== "verified" && access !== "verified_by_grant") {
      return { saved: false, error: "Saving universities is part of Nextwise Verified." };
    }
    const [university] = await getUniversitiesByIds([universityId]);
    if (!university) return { saved: false, error: "That university is not available right now." };
  }

  const result = nextSaved ? await saveItem("university", universityId) : await removeSavedItem("university", universityId);
  if (!result.success) {
    return { saved: !nextSaved, error: result.error ?? "Something went wrong. Please try again." };
  }

  if (typeof slug === "string" && /^[a-z0-9-]{1,120}$/.test(slug)) revalidatePath(`/universities/${slug}`);
  revalidatePath("/universities");
  revalidatePath("/saved");
  revalidatePath("/studio");
  return { saved: nextSaved, error: null };
}
