"use server";

import { revalidatePath } from "next/cache";
import {
  updateRecommendationDraftContent,
  submitRecommendationDraftForReview,
  reviewRecommendationDraft,
  releaseRecommendationDraft,
  withdrawRecommendationDraft,
  archiveRecommendationDraft,
  getRecommendationDraftById,
} from "@/lib/supabase/admin/recommendation-drafts";
import { friendlyAdminError, type ActionState } from "@/lib/admin/form-state";

/**
 * NW07.6 — thin Server Action wrappers for the Recommendation Review page.
 * Every action delegates authorization AND the state-machine rules
 * (including self-approval prevention) entirely to the staff_* RPC the
 * underlying src/lib/supabase/admin/recommendation-drafts.ts function
 * calls — nothing here re-checks or re-derives any of that.
 */
async function revalidateDraft(draftId: string): Promise<void> {
  revalidatePath(`/counsellor/recommendations/${draftId}`);
  revalidatePath("/counsellor/recommendations");
  revalidatePath("/counsellor");
  const draft = await getRecommendationDraftById(draftId).catch(() => null);
  if (draft) {
    revalidatePath(`/counsellor/students/${draft.studentUserId}`);
    if (draft.status === "released_to_student") {
      revalidatePath("/studio/recommendation-reports");
      revalidatePath(`/studio/recommendation-reports/${draftId}`);
    }
  }
}

export async function updateRecommendationDraftContentAction(draftId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await updateRecommendationDraftContent(draftId, formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  await revalidateDraft(draftId);
  return { error: null };
}

export async function submitRecommendationDraftForReviewAction(draftId: string, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  try {
    await submitRecommendationDraftForReview(draftId);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  await revalidateDraft(draftId);
  return { error: null };
}

export async function reviewRecommendationDraftAction(
  draftId: string,
  decision: "approve" | "request_changes",
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const reviewNotes = String(formData.get("reviewNotes") ?? "").trim() || null;
  try {
    await reviewRecommendationDraft(draftId, decision, reviewNotes);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  await revalidateDraft(draftId);
  return { error: null };
}

export async function releaseRecommendationDraftAction(draftId: string, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  try {
    await releaseRecommendationDraft(draftId);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  await revalidateDraft(draftId);
  return { error: null };
}

export async function withdrawRecommendationDraftAction(draftId: string, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  try {
    await withdrawRecommendationDraft(draftId);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  await revalidateDraft(draftId);
  return { error: null };
}

export async function archiveRecommendationDraftAction(draftId: string, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  try {
    await archiveRecommendationDraft(draftId);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  await revalidateDraft(draftId);
  return { error: null };
}
