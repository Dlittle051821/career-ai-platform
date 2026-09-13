"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  markRefundUnderReview,
  approveRefund,
  rejectRefund,
  cancelRefund,
  processApprovedRefund,
  reconcileRefund,
} from "@/lib/supabase/admin/refunds";
import { friendlyAdminError, type ActionState } from "@/lib/admin/form-state";

/**
 * Milestone 13 — every action here revalidates both the refund's own
 * detail page and the /admin/refunds list (the list shows status, so it
 * must reflect the change too), then redirects back to the detail page so
 * the admin sees the new state immediately — same pattern
 * src/app/admin/invoices/actions.ts already uses.
 */

function revalidateRefund(id: string) {
  revalidatePath(`/admin/refunds/${id}`);
  revalidatePath("/admin/refunds");
}

export async function markRefundUnderReviewAction(id: string, _prev: ActionState): Promise<ActionState> {
  try {
    await markRefundUnderReview(id);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidateRefund(id);
  redirect(`/admin/refunds/${id}`);
}

export async function approveRefundAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await approveRefund(id, formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidateRefund(id);
  redirect(`/admin/refunds/${id}`);
}

export async function rejectRefundAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await rejectRefund(id, formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidateRefund(id);
  redirect(`/admin/refunds/${id}`);
}

export async function cancelRefundAction(id: string, _prev: ActionState): Promise<ActionState> {
  try {
    await cancelRefund(id);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidateRefund(id);
  redirect(`/admin/refunds/${id}`);
}

/**
 * The financial-safety-critical action: claims the refund for processing
 * (database-authoritative re-validation) and calls the gateway. Never
 * treats an "uncertain" outcome as an error to show the admin — that
 * outcome means the refund is correctly, deliberately left in `processing`
 * pending reconciliation, not a failure of this action itself.
 */
export async function processApprovedRefundAction(id: string, _prev: ActionState): Promise<ActionState> {
  try {
    // Every outcome — processed, failed, uncertain_pending_reconciliation,
    // or (Milestone 13 FINAL FINANCIAL SAFETY PATCH) pending_provider_
    // confirmation — is a successful CALL of this action; none of them is
    // an error to show the admin via ActionState. "Uncertain" and "pending
    // provider confirmation" both deliberately leave the refund in
    // `processing` (a definite HTTP success is not proof the money has
    // moved — see processApprovedRefund's own docblock), which the detail
    // page's own status display already communicates — never surfaced as a
    // failure here. redirect() must stay OUTSIDE this try block (it throws
    // internally; catching that here would misreport it as an error), so
    // this branch only records the outcome and falls through.
    await processApprovedRefund(id);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidateRefund(id);
  redirect(`/admin/refunds/${id}`);
}

export async function reconcileRefundAction(id: string, _prev: ActionState): Promise<ActionState> {
  try {
    await reconcileRefund(id);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidateRefund(id);
  redirect(`/admin/refunds/${id}`);
}
