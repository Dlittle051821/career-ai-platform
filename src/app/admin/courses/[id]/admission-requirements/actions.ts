"use server";

import { revalidatePath } from "next/cache";
import { createAdmissionRequirement, deleteAdmissionRequirement } from "@/lib/supabase/admin/education-admission-requirements";
import { friendlyAdminError, type ActionState } from "@/lib/admin/form-state";

/**
 * Admission-requirement sub-entity actions for a course's detail page.
 * courseId is fixed via a hidden form field on the client — never exposed as
 * an editable input. No dedicated edit page (MVP: delete-and-recreate), per
 * the M9 admin-UI spec.
 */

export async function createAdmissionRequirementAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const courseId = String(formData.get("courseId") ?? "").trim();
  try {
    await createAdmissionRequirement(formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  if (courseId) revalidatePath(`/admin/courses/${courseId}`);
  return { error: null };
}

export async function deleteAdmissionRequirementAction(formData: FormData): Promise<void> {
  const admissionRequirementId = String(formData.get("admissionRequirementId") ?? "").trim();
  const courseId = String(formData.get("courseId") ?? "").trim();
  if (!admissionRequirementId) return;
  try {
    await deleteAdmissionRequirement(admissionRequirementId);
  } catch (error) {
    console.error("[admin/courses/admission-requirements] deleteAdmissionRequirementAction failed:", error);
  }
  if (courseId) revalidatePath(`/admin/courses/${courseId}`);
}
