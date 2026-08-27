"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAgreement, updateAgreement } from "@/lib/supabase/admin/agreements";
import { friendlyAdminError, AdminValidationError, type ActionState } from "@/lib/admin/form-state";

async function resolveStudentEmail(formData: FormData): Promise<FormData> {
  const email = String(formData.get("studentEmail") ?? "").trim().toLowerCase();
  const next = new FormData();
  for (const [key, value] of formData.entries()) next.append(key, value);
  if (!email) {
    next.set("studentUserId", "");
    return next;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("id, account_type").eq("email", email).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.account_type !== "student") throw new AdminValidationError("No registered student account found with that email.");
  next.set("studentUserId", data.id);
  return next;
}

export async function createAgreementAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let id: string;
  try {
    const resolved = await resolveStudentEmail(formData);
    id = await createAgreement(resolved);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/agreements");
  redirect(`/admin/agreements/${id}`);
}

export async function updateAgreementAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const resolved = await resolveStudentEmail(formData);
    await updateAgreement(id, resolved);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/agreements");
  revalidatePath(`/admin/agreements/${id}`);
  redirect(`/admin/agreements/${id}`);
}
