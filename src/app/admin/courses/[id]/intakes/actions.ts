"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createCourseIntake, deleteCourseIntake, updateCourseIntake } from "@/lib/supabase/admin/education-course-intakes";
import { friendlyAdminError, type ActionState } from "@/lib/admin/form-state";

/**
 * Intake sub-entity actions for a course's detail page. The parent course id
 * travels through a hidden `courseId` form field (create/delete) or through
 * `.bind()` (update, mirroring updateCampusAction) — never trusted from
 * anywhere else, since createCourseIntake/updateCourseIntake read it straight
 * out of the FormData/row themselves.
 */

export async function createCourseIntakeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const courseId = String(formData.get("courseId") ?? "").trim();
  try {
    await createCourseIntake(formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  if (courseId) revalidatePath(`/admin/courses/${courseId}`);
  return { error: null };
}

export async function updateCourseIntakeAction(
  courseId: string,
  intakeId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await updateCourseIntake(intakeId, formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath(`/admin/courses/${courseId}/intakes/${intakeId}`);
  redirect(`/admin/courses/${courseId}`);
}

export async function deleteCourseIntakeAction(formData: FormData): Promise<void> {
  const intakeId = String(formData.get("intakeId") ?? "").trim();
  const courseId = String(formData.get("courseId") ?? "").trim();
  if (!intakeId) return;
  try {
    await deleteCourseIntake(intakeId);
  } catch (error) {
    console.error("[admin/courses/intakes] deleteCourseIntakeAction failed:", error);
  }
  if (courseId) revalidatePath(`/admin/courses/${courseId}`);
}
