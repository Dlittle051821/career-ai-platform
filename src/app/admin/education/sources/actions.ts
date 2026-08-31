"use server";

import { revalidatePath } from "next/cache";
import { upsertProvenanceRecord } from "@/lib/supabase/admin/education-sources";
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
