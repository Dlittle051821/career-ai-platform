"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createCampus, updateCampus } from "@/lib/supabase/admin/education-campuses";
import { friendlyAdminError, type ActionState } from "@/lib/admin/form-state";

/**
 * Campus sub-entity actions for a university's detail page. The parent
 * university id travels through a hidden `universityId` form field (create)
 * or through `.bind()` (update, mirroring updateUniversityAction) — never
 * trusted from anywhere else, since `createCampus`/`updateCampus` read it
 * straight out of the FormData/row themselves.
 */

export async function createCampusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const universityId = String(formData.get("universityId") ?? "").trim();
  let campusId: string;
  try {
    campusId = await createCampus(formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath(`/admin/universities/${universityId}`);
  redirect(`/admin/universities/${universityId}/campuses/${campusId}`);
}

export async function updateCampusAction(
  universityId: string,
  campusId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await updateCampus(campusId, formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath(`/admin/universities/${universityId}`);
  revalidatePath(`/admin/universities/${universityId}/campuses/${campusId}`);
  redirect(`/admin/universities/${universityId}`);
}
