"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createContentItem, updateContentItem } from "@/lib/supabase/admin/content-items";
import { friendlyAdminError, type ActionState } from "@/lib/admin/form-state";

export async function createContentItemAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let id: string;
  try {
    id = await createContentItem(formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/content");
  redirect(`/admin/content/${id}`);
}

export async function updateContentItemAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await updateContentItem(id, formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/content");
  revalidatePath(`/admin/content/${id}`);
  redirect(`/admin/content/${id}`);
}
