"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  archiveCourse,
  createCourse,
  publishCourse,
  restoreCourseToDraft,
  submitCourseForReview,
  updateCourse,
} from "@/lib/supabase/admin/courses";
import { friendlyAdminError, type ActionState } from "@/lib/admin/form-state";

export async function createCourseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let id: string;
  try {
    id = await createCourse(formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/courses");
  redirect(`/admin/courses/${id}`);
}

export async function updateCourseAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await updateCourse(id, formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${id}`);
  redirect(`/admin/courses/${id}`);
}

// ---------------------------------------------------------------------------
// Publication workflow — each stays on the detail page (no redirect) so the
// admin sees the updated status badge and the newly available action(s) in
// place; errors (e.g. an RLS denial for a content_editor) surface inline via
// the returned ActionState, same as the main save form. Mirrors
// src/app/admin/universities/actions.ts's equivalent actions exactly.
// ---------------------------------------------------------------------------

export async function submitCourseForReviewAction(id: string, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  try {
    await submitCourseForReview(id);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${id}`);
  return { error: null };
}

export async function publishCourseAction(id: string, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  try {
    await publishCourse(id);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${id}`);
  return { error: null };
}

export async function archiveCourseAction(id: string, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  try {
    await archiveCourse(id);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${id}`);
  return { error: null };
}

export async function restoreCourseToDraftAction(id: string, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  try {
    await restoreCourseToDraft(id);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${id}`);
  return { error: null };
}
