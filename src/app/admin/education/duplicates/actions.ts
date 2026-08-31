"use server";

import { revalidatePath } from "next/cache";
import {
  mergeDuplicateCandidates,
  rejectDuplicateCandidate,
  scanForDuplicates,
} from "@/lib/supabase/admin/education-duplicates";
import { friendlyAdminError, type ActionState } from "@/lib/admin/form-state";
import type { DuplicateEntityType } from "@/types/education";

/**
 * Extends the shared ActionState with an optional success message, so the
 * scan buttons can report "Found N new candidate(s)" without a redirect
 * (this page always stays put — a scan just repopulates the pending list
 * below via revalidatePath). Kept local to this module rather than folded
 * into src/lib/admin/form-state.ts's ActionState, since no other admin
 * module needs a message channel on top of the error one.
 */
export interface ScanActionState extends ActionState {
  message?: string;
}

/**
 * Runs the pairwise scan for one entity type. Bound with `entityType` from
 * the page (two buttons, two bound instances) — same
 * bind-the-non-form-argument pattern as updateUniversityAction(id, ...) in
 * src/app/admin/universities/actions.ts.
 */
export async function scanForDuplicatesAction(
  entityType: DuplicateEntityType,
  _prev: ScanActionState,
  _formData: FormData,
): Promise<ScanActionState> {
  let count: number;
  try {
    count = await scanForDuplicates(entityType);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/education/duplicates");
  return { error: null, message: `Found ${count} new candidate${count === 1 ? "" : "s"}.` };
}

/** Bound with the candidate's `id` from the page — one instance per card, mirrors PublicationWorkflowCard's bound-action-per-transition pattern. */
export async function rejectDuplicateCandidateAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const notes = String(formData.get("notes") ?? "").trim() || null;
  try {
    await rejectDuplicateCandidate(id, notes);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/education/duplicates");
  return { error: null };
}

/**
 * MVP merge: always calls with an empty preserve-list, so the survivor's
 * own field values are left untouched and only the loser is deactivated
 * and pointed at the survivor via merged_into_id (see
 * mergeDuplicateCandidates's docblock). A future pass could surface the
 * per-field preserve checkboxes the data-access layer already supports.
 */
export async function mergeDuplicateCandidatesAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const survivorEntityId = String(formData.get("survivorEntityId") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!survivorEntityId) {
    return { error: "Choose which record should survive the merge." };
  }
  try {
    await mergeDuplicateCandidates(id, survivorEntityId, [], notes);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/education/duplicates");
  return { error: null };
}
