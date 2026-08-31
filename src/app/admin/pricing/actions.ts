"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  archivePricingOffer,
  archivePricingPlanVersion,
  createPricingInclusion,
  createPricingOffer,
  createPricingPlan,
  createPricingPlanVersion,
  deletePricingInclusion,
  publishPricingOffer,
  publishPricingPlanVersion,
  reorderPricingInclusions,
  reorderPricingPlans,
  restorePricingOfferToDraft,
  setPricingOfferActive,
  updatePricingInclusion,
  updatePricingOffer,
  updatePricingPlan,
  updatePricingPlanVersion,
} from "@/lib/supabase/admin/pricing";
import { friendlyAdminError, type ActionState } from "@/lib/admin/form-state";

export async function createPricingPlanAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let id: string;
  try {
    id = await createPricingPlan(formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/pricing");
  redirect(`/admin/pricing/${id}`);
}

export async function updatePricingPlanAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await updatePricingPlan(id, formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/pricing");
  revalidatePath(`/admin/pricing/${id}`);
  revalidatePath("/pricing");
  redirect(`/admin/pricing/${id}`);
}

export async function reorderPricingPlansAction(orderedPlanIds: string[]): Promise<ActionState> {
  try {
    await reorderPricingPlans(orderedPlanIds);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/pricing");
  revalidatePath("/pricing");
  return { error: null };
}

export async function createPricingPlanVersionAction(planId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  let versionId: string;
  try {
    versionId = await createPricingPlanVersion(planId, formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath(`/admin/pricing/${planId}`);
  redirect(`/admin/pricing/${planId}/versions/${versionId}`);
}

export async function updatePricingPlanVersionAction(planId: string, versionId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await updatePricingPlanVersion(versionId, formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath(`/admin/pricing/${planId}`);
  revalidatePath(`/admin/pricing/${planId}/versions/${versionId}`);
  redirect(`/admin/pricing/${planId}`);
}

export async function publishPricingPlanVersionAction(planId: string, versionId: string, _prev: ActionState): Promise<ActionState> {
  try {
    await publishPricingPlanVersion(versionId);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath(`/admin/pricing/${planId}`);
  revalidatePath("/admin/pricing");
  revalidatePath("/pricing");
  redirect(`/admin/pricing/${planId}`);
}

export async function archivePricingPlanVersionAction(planId: string, versionId: string, _prev: ActionState): Promise<ActionState> {
  try {
    await archivePricingPlanVersion(versionId);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath(`/admin/pricing/${planId}`);
  revalidatePath("/admin/pricing");
  revalidatePath("/pricing");
  redirect(`/admin/pricing/${planId}`);
}

export async function createPricingInclusionAction(planId: string, versionId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await createPricingInclusion(versionId, formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath(`/admin/pricing/${planId}/versions/${versionId}`);
  redirect(`/admin/pricing/${planId}/versions/${versionId}`);
}

export async function updatePricingInclusionAction(planId: string, versionId: string, inclusionId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await updatePricingInclusion(inclusionId, formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath(`/admin/pricing/${planId}/versions/${versionId}`);
  redirect(`/admin/pricing/${planId}/versions/${versionId}`);
}

/**
 * Deliberately does NOT redirect (unlike every other action in this file) —
 * PricingInclusionsManager calls this imperatively (not via a native
 * <form action> / useActionState dispatch) and then calls router.refresh()
 * itself on success, since the admin is already on the page that should
 * simply re-render with the inclusion gone.
 */
export async function deletePricingInclusionAction(planId: string, versionId: string, inclusionId: string, _prev: ActionState): Promise<ActionState> {
  try {
    await deletePricingInclusion(inclusionId);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath(`/admin/pricing/${planId}/versions/${versionId}`);
  return { error: null };
}

export async function reorderPricingInclusionsAction(planId: string, versionId: string, orderedInclusionIds: string[]): Promise<ActionState> {
  try {
    await reorderPricingInclusions(versionId, orderedInclusionIds);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath(`/admin/pricing/${planId}/versions/${versionId}`);
  return { error: null };
}

export async function createPricingOfferAction(planId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  let offerId: string;
  try {
    offerId = await createPricingOffer(planId, formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath(`/admin/pricing/${planId}`);
  redirect(`/admin/pricing/offers/${offerId}`);
}

export async function updatePricingOfferAction(planId: string, offerId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await updatePricingOffer(offerId, formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath(`/admin/pricing/${planId}`);
  revalidatePath(`/admin/pricing/offers/${offerId}`);
  redirect(`/admin/pricing/offers/${offerId}`);
}

export async function publishPricingOfferAction(planId: string, offerId: string, _prev: ActionState): Promise<ActionState> {
  try {
    await publishPricingOffer(offerId);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath(`/admin/pricing/${planId}`);
  revalidatePath(`/admin/pricing/offers/${offerId}`);
  revalidatePath("/pricing");
  redirect(`/admin/pricing/offers/${offerId}`);
}

export async function archivePricingOfferAction(planId: string, offerId: string, _prev: ActionState): Promise<ActionState> {
  try {
    await archivePricingOffer(offerId);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath(`/admin/pricing/${planId}`);
  revalidatePath(`/admin/pricing/offers/${offerId}`);
  revalidatePath("/pricing");
  redirect(`/admin/pricing/offers/${offerId}`);
}

export async function restorePricingOfferToDraftAction(planId: string, offerId: string, _prev: ActionState): Promise<ActionState> {
  try {
    await restorePricingOfferToDraft(offerId);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath(`/admin/pricing/${planId}`);
  revalidatePath(`/admin/pricing/offers/${offerId}`);
  revalidatePath("/pricing");
  redirect(`/admin/pricing/offers/${offerId}`);
}

export async function setPricingOfferActiveAction(planId: string, offerId: string, isActive: boolean, _prev: ActionState): Promise<ActionState> {
  try {
    await setPricingOfferActive(offerId, isActive);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath(`/admin/pricing/${planId}`);
  revalidatePath(`/admin/pricing/offers/${offerId}`);
  revalidatePath("/pricing");
  redirect(`/admin/pricing/offers/${offerId}`);
}
