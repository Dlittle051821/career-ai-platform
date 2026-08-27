"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createUniversity, updateUniversity } from "@/lib/supabase/admin/universities";
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
