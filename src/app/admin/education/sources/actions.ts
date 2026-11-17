"use server";

import { revalidatePath } from "next/cache";
import { upsertProvenanceRecord } from "@/lib/supabase/admin/education-sources";
import { createProvider, recordProviderVerification, setProviderActive } from "@/lib/supabase/admin/external-search";
import { friendlyAdminError, type ActionState } from "@/lib/admin/form-state";

/**
 * Backs the per-row "Mark verified" quick action (see MarkVerifiedForm).
 * Goes through the same permission-gated upsertProvenanceRecord the full
 * manual-correction form would use — this route only differs in which
 * fields the caller populates (the row's existing values plus
 * verificationStatus="verified" and today's date), never in how the write
 * is authorized.
 */
export async function markProvenanceVerifiedAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await upsertProvenanceRecord(formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/education/sources");
  return { error: null };
}

/**
 * University Discovery V3 — trusted official portals, managed on this page.
 * Each action goes through the existing permission-gated, audited functions in
 * src/lib/supabase/admin/external-search.ts ("trusted-portals:write"); nothing
 * here authorises anything itself. A new portal is always created inactive,
 * and activating one is its own deliberate step.
 */
export async function createTrustedPortalAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await createProvider(formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/education/sources");
  return { error: null };
}

export async function verifyTrustedPortalAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await recordProviderVerification(String(formData.get("id") ?? ""));
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/education/sources");
  return { error: null };
}

export async function setTrustedPortalActiveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await setProviderActive(String(formData.get("id") ?? ""), formData.get("active") === "true");
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/education/sources");
  revalidatePath("/universities");
  revalidatePath("/courses");
  return { error: null };
}
