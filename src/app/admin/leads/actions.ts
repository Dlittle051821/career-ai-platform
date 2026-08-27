"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createLead, updateLead, convertLeadToStudent } from "@/lib/supabase/admin/leads";
import { friendlyAdminError, type ActionState } from "@/lib/admin/form-state";

export async function createLeadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let id: string;
  try {
    id = await createLead(formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/leads");
  redirect(`/admin/leads/${id}`);
}

export async function updateLeadAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await updateLead(id, formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/leads");
  revalidatePath(`/admin/leads/${id}`);
  redirect(`/admin/leads/${id}`);
}

export async function convertLeadAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("studentEmail") ?? "");
  try {
    await convertLeadToStudent(id, email);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/leads");
  revalidatePath(`/admin/leads/${id}`);
  return { error: null };
}
