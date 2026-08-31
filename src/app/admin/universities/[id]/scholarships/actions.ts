"use server";

import { revalidatePath } from "next/cache";
import { createScholarship, deleteScholarship } from "@/lib/supabase/admin/education-scholarships";
import { friendlyAdminError, type ActionState } from "@/lib/admin/form-state";

/**
 * Scholarship sub-entity actions for a university's detail page. Scope and
 * universityId are fixed to "university"/the parent id via hidden form
 * fields on the client — never exposed as editable inputs. No dedicated
 * edit page (MVP: delete-and-recreate), per the M9 admin-UI spec.
 */

export async function createScholarshipAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const universityId = String(formData.get("universityId") ?? "").trim();
  try {
    await createScholarship(formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  if (universityId) revalidatePath(`/admin/universities/${universityId}`);
  return { error: null };
}

export async function deleteScholarshipAction(formData: FormData): Promise<void> {
  const scholarshipId = String(formData.get("scholarshipId") ?? "").trim();
  const universityId = String(formData.get("universityId") ?? "").trim();
  if (!scholarshipId) return;
  try {
    await deleteScholarship(scholarshipId);
  } catch (error) {
    console.error("[admin/universities/scholarships] deleteScholarshipAction failed:", error);
  }
  if (universityId) revalidatePath(`/admin/universities/${universityId}`);
}
