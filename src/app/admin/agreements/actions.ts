"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAgreement, updateAgreement } from "@/lib/supabase/admin/agreements";
import {
  createAgreementVersion,
  sendForSignature,
  resendSignatureRequestAction as resendSignatureRequest,
  cancelSignatureRequestAction as cancelSignatureRequest,
} from "@/lib/supabase/admin/signatures";
import {
  requestStamp,
  retryStampRequest as retryStampRequestIo,
  cancelStampRequestAction as cancelStampRequestIo,
} from "@/lib/supabase/admin/stamping";
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

// ---------------------------------------------------------------------------
// Milestone 10 (F-122) — agreement versions + signature requests
// ---------------------------------------------------------------------------

export async function createAgreementVersionAction(agreementId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await createAgreementVersion(agreementId, formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath(`/admin/agreements/${agreementId}`);
  return { error: null };
}

export async function sendForSignatureAction(agreementId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await sendForSignature(agreementId, formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/agreements");
  revalidatePath(`/admin/agreements/${agreementId}`);
  return { error: null };
}

export async function resendSignatureRequestFormAction(agreementId: string, requestId: string, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  try {
    await resendSignatureRequest(requestId);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath(`/admin/agreements/${agreementId}`);
  return { error: null };
}

export async function cancelSignatureRequestFormAction(agreementId: string, requestId: string, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  try {
    await cancelSignatureRequest(requestId);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/agreements");
  revalidatePath(`/admin/agreements/${agreementId}`);
  return { error: null };
}

// ---------------------------------------------------------------------------
// Milestone 11-A (F-123) — electronic stamping
// ---------------------------------------------------------------------------

export async function requestStampAction(agreementId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requestStamp(agreementId, formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/agreements");
  revalidatePath(`/admin/agreements/${agreementId}`);
  return { error: null };
}

export async function retryStampRequestFormAction(agreementId: string, requestId: string, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  try {
    await retryStampRequestIo(agreementId, requestId);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/agreements");
  revalidatePath(`/admin/agreements/${agreementId}`);
  return { error: null };
}

export async function cancelStampRequestFormAction(agreementId: string, requestId: string, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  try {
    await cancelStampRequestIo(agreementId, requestId);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/agreements");
  revalidatePath(`/admin/agreements/${agreementId}`);
  return { error: null };
}
