"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createPayment, updatePayment } from "@/lib/supabase/admin/payments";
import { friendlyAdminError, AdminValidationError, type ActionState } from "@/lib/admin/form-state";

/** Resolves an optional student email into a studentUserId, or clears it — a payment may exist with no linked student (e.g. a pending invoice before registration). */
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

export async function createPaymentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let id: string;
  try {
    const resolved = await resolveStudentEmail(formData);
    id = await createPayment(resolved);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/payments");
  redirect(`/admin/payments/${id}`);
}

export async function updatePaymentAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const resolved = await resolveStudentEmail(formData);
    await updatePayment(id, resolved);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/payments");
  revalidatePath(`/admin/payments/${id}`);
  redirect(`/admin/payments/${id}`);
}
