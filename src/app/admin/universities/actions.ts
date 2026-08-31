"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  archiveUniversity,
  createUniversity,
  publishUniversity,
  restoreUniversityToDraft,
  submitUniversityForReview,
  updateUniversity,
} from "@/lib/supabase/admin/universities";
import { friendlyAdminError, type ActionState } from "@/lib/admin/form-state";

export async function createUniversityAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let id: string;
  try {
    id = await createUniversity(formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/universities");
  redirect(`/admin/universities/${id}`);
}

export async function updateUniversityAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await updateUniversity(id, formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/universities");
  revalidatePath(`/admin/universities/${id}`);
  redirect(`/admin/universities/${id}`);
}

// ---------------------------------------------------------------------------
// Publication workflow — each stays on the detail page (no redirect) so the
// admin sees the updated status badge and the newly available action(s) in
// place; errors (e.g. an RLS denial for a content_editor) surface inline via
// the returned ActionState, same as the main save form.
// ---------------------------------------------------------------------------

export async function submitUniversityForReviewAction(id: string, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  try {
    await submitUniversityForReview(id);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/universities");
  revalidatePath(`/admin/universities/${id}`);
  return { error: null };
}

export async function publishUniversityAction(id: string, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  try {
    await publishUniversity(id);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/universities");
  revalidatePath(`/admin/universities/${id}`);
  return { error: null };
}

export async function archiveUniversityAction(id: string, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  try {
    await archiveUniversity(id);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/universities");
  revalidatePath(`/admin/universities/${id}`);
  return { error: null };
}

export async function restoreUniversityToDraftAction(id: string, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  try {
    await restoreUniversityToDraft(id);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/universities");
  revalidatePath(`/admin/universities/${id}`);
  return { error: null };
}
