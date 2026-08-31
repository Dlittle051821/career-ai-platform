"use server";

import { revalidatePath } from "next/cache";
import { saveItem, removeSavedItem } from "@/lib/supabase/education/saved-items";

export interface ToggleSaveUniversityResult {
  saved: boolean;
  error: string | null;
}

/**
 * Toggles a university's saved state for the currently logged-in student.
 * `saveItem`/`removeSavedItem` already re-check auth server-side (see
 * saved-items.ts's docblock — middleware protects pages, not Server Actions
 * invoked directly), so a logged-out visitor calling this directly still
 * gets a clean error rather than a crash. `slug` is only used to revalidate
 * the detail page the button lives on; the actual save is keyed by
 * `universityId`.
 */
export async function toggleSaveUniversityAction(
  universityId: string,
  slug: string,
  nextSaved: boolean,
): Promise<ToggleSaveUniversityResult> {
  const result = nextSaved ? await saveItem("university", universityId) : await removeSavedItem("university", universityId);

  if (!result.success) {
    return { saved: !nextSaved, error: result.error ?? "Something went wrong. Please try again." };
  }

  revalidatePath(`/universities/${slug}`);
  return { saved: nextSaved, error: null };
}
