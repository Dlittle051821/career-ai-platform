"use server";

import { revalidatePath } from "next/cache";
import { createScholarship, deleteScholarship } from "@/lib/supabase/admin/education-scholarships";
import { friendlyAdminError, type ActionState } from "@/lib/admin/form-state";

/**
 * Scholarship sub-entity actions for a course's detail page. Scope and
 * courseId are fixed to "course"/the parent id via hidden form fields on the
 * client — never exposed as editable inputs. No dedicated edit page (MVP:
 * delete-and-recreate), per the M9 admin-UI spec. Mirrors
 * src/app/admin/universities/[id]/scholarships/actions.ts.
 */

export async function createCourseScholarshipAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const courseId = String(formData.get("courseId") ?? "").trim();
  try {
    await createScholarship(formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  if (courseId) revalidatePath(`/admin/courses/${courseId}`);
  return { error: null };
}

export async function deleteCourseScholarshipAction(formData: FormData): Promise<void> {
  const scholarshipId = String(formData.get("scholarshipId") ?? "").trim();
  const courseId = String(formData.get("courseId") ?? "").trim();
  if (!scholarshipId) return;
  try {
    await deleteScholarship(scholarshipId);
  } catch (error) {
    console.error("[admin/courses/scholarships] deleteCourseScholarshipAction failed:", error);
  }
  if (courseId) revalidatePath(`/admin/courses/${courseId}`);
}
