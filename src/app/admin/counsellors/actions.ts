"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createCounsellor, updateCounsellor } from "@/lib/supabase/admin/counsellors";
import { friendlyAdminError, type ActionState } from "@/lib/admin/form-state";

export async function createCounsellorAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let id: string;
  try {
    id = await createCounsellor(formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/counsellors");
  redirect(`/admin/counsellors/${id}`);
}

export async function updateCounsellorAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await updateCounsellor(id, formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/counsellors");
  revalidatePath(`/admin/counsellors/${id}`);
  redirect(`/admin/counsellors/${id}`);
}
