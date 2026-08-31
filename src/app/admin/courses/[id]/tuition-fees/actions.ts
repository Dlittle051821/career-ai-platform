"use server";

import { revalidatePath } from "next/cache";
import { createTuitionFee, deleteTuitionFee } from "@/lib/supabase/admin/education-tuition-fees";
import { friendlyAdminError, type ActionState } from "@/lib/admin/form-state";

/**
 * Tuition-fee sub-entity actions for a course's detail page. courseId is
 * fixed via a hidden form field on the client — never exposed as an editable
 * input. No dedicated edit page (MVP: delete-and-recreate), per the M9
 * admin-UI spec.
 */

export async function createTuitionFeeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const courseId = String(formData.get("courseId") ?? "").trim();
  try {
    await createTuitionFee(formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  if (courseId) revalidatePath(`/admin/courses/${courseId}`);
  return { error: null };
}

export async function deleteTuitionFeeAction(formData: FormData): Promise<void> {
  const tuitionFeeId = String(formData.get("tuitionFeeId") ?? "").trim();
  const courseId = String(formData.get("courseId") ?? "").trim();
  if (!tuitionFeeId) return;
  try {
    await deleteTuitionFee(tuitionFeeId);
  } catch (error) {
    console.error("[admin/courses/tuition-fees] deleteTuitionFeeAction failed:", error);
  }
  if (courseId) revalidatePath(`/admin/courses/${courseId}`);
}
