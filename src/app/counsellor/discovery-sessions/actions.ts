"use server";

import { revalidatePath } from "next/cache";
import { updateDiscoverySession } from "@/lib/supabase/admin/discovery-sessions";
import { friendlyAdminError, type ActionState } from "@/lib/admin/form-state";

/**
 * NW07.4 — thin Server Action wrapper for the Counsellor Studio's own
 * Discovery Session pages. Calls the EXACT SAME
 * updateDiscoverySession() `/admin/discovery-sessions/actions.ts` already
 * calls — no business logic duplicated, only this route's own
 * revalidatePath() targets differ. A counsellor claiming an unassigned
 * session, or updating one of their own, is just an ordinary write this
 * function already validates and records; RLS (0013 PART 2) is what
 * actually decides whether the write is allowed at all.
 */
export async function updateDiscoverySessionAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await updateDiscoverySession(id, formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/counsellor/discovery-sessions");
  revalidatePath(`/counsellor/discovery-sessions/${id}`);
  revalidatePath("/counsellor");
  return { error: null };
}
