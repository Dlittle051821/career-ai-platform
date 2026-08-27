"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createDraftInvoice,
  updateInvoiceHeader,
  replaceInvoiceLineItems,
  issueInvoice,
  voidInvoice,
  recordOfflinePayment,
  createPaymentLink,
} from "@/lib/supabase/admin/invoices";
import { reconcilePaymentAttempt } from "@/lib/supabase/admin/payment-attempts";
import { initiateRefund } from "@/lib/supabase/admin/refunds";
import { friendlyAdminError, type ActionState } from "@/lib/admin/form-state";
import type { PaymentLinkActionState } from "@/lib/admin/payment-link-state";

export async function createDraftInvoiceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let id: string;
  try {
    id = await createDraftInvoice(formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/invoices");
  redirect(`/admin/invoices/${id}`);
}

export async function updateInvoiceHeaderAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await updateInvoiceHeader(id, formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath(`/admin/invoices/${id}`);
  redirect(`/admin/invoices/${id}`);
}

export async function replaceLineItemsAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await replaceInvoiceLineItems(id, formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath(`/admin/invoices/${id}`);
  redirect(`/admin/invoices/${id}`);
}

export async function issueInvoiceAction(id: string, _prev: ActionState): Promise<ActionState> {
  try {
    await issueInvoice(id);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/invoices");
  revalidatePath(`/admin/invoices/${id}`);
  redirect(`/admin/invoices/${id}`);
}

export async function voidInvoiceAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await voidInvoice(id, formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/invoices");
  revalidatePath(`/admin/invoices/${id}`);
  redirect(`/admin/invoices/${id}`);
}

export async function recordOfflinePaymentAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await recordOfflinePayment(id, formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath(`/admin/invoices/${id}`);
  redirect(`/admin/invoices/${id}`);
}

export async function createPaymentLinkAction(id: string, _prev: PaymentLinkActionState): Promise<PaymentLinkActionState> {
  try {
    const result = await createPaymentLink(id);
    revalidatePath(`/admin/invoices/${id}`);
    return { error: null, url: result.url, expiresAt: result.expiresAt };
  } catch (error) {
    return { error: friendlyAdminError(error), url: null, expiresAt: null };
  }
}

export async function reconcilePaymentAttemptAction(invoiceId: string, attemptId: string, _prev: ActionState): Promise<ActionState> {
  try {
    await reconcilePaymentAttempt(attemptId);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath(`/admin/invoices/${invoiceId}`);
  redirect(`/admin/invoices/${invoiceId}`);
}

export async function initiateRefundAction(invoiceId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await initiateRefund(formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath(`/admin/invoices/${invoiceId}`);
  revalidatePath("/admin/refunds");
  redirect(`/admin/invoices/${invoiceId}`);
}
