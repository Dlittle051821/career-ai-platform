"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createApplication, updateApplication } from "@/lib/supabase/admin/applications";
import { friendlyAdminError, AdminValidationError, type ActionState } from "@/lib/admin/form-state";

async function resolveStudentEmailToId(formData: FormData): Promise<FormData> {
  const email = String(formData.get("studentEmail") ?? "").trim().toLowerCase();
  if (!email) throw new AdminValidationError("A registered student email is required.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("id, account_type").eq("email", email).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.account_type !== "student") throw new AdminValidationError("No registered student account found with that email.");
  const next = new FormData();
  for (const [key, value] of formData.entries()) next.append(key, value);
  next.set("studentUserId", data.id);
  return next;
}

export async function createApplicationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let id: string;
  try {
    const resolved = await resolveStudentEmailToId(formData);
    id = await createApplication(resolved);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/applications");
  redirect(`/admin/applications/${id}`);
}

export async function updateApplicationAction(id: string, studentUserId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  formData.set("studentUserId", studentUserId);
  try {
    await updateApplication(id, formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/applications");
  revalidatePath(`/admin/applications/${id}`);
  redirect(`/admin/applications/${id}`);
}
