"use server";

import { revalidatePath } from "next/cache";
import { updateStudentMeta, addStudentNote } from "@/lib/supabase/admin/students";
import { setSectionProvenance } from "@/lib/supabase/admin/profile-provenance";
import { setRecommendationVerification, clearRecommendationVerification } from "@/lib/supabase/admin/recommendation-readiness";
import { friendlyAdminError, type ActionState } from "@/lib/admin/form-state";
import type { AdminStudentStatus } from "@/types/admin";

export async function updateStudentStatusAction(studentUserId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const status = String(formData.get("status") ?? "") as AdminStudentStatus;
  try {
    await updateStudentMeta(studentUserId, { status });
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath(`/admin/students/${studentUserId}`);
  revalidatePath("/admin/students");
  return { error: null };
}

export async function assignCounsellorAction(studentUserId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = String(formData.get("assignedCounsellorId") ?? "").trim();
  try {
    await updateStudentMeta(studentUserId, { assignedCounsellorId: raw || null });
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath(`/admin/students/${studentUserId}`);
  revalidatePath("/admin/students");
  return { error: null };
}

export async function addStudentNoteAction(studentUserId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await addStudentNote(studentUserId, formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath(`/admin/students/${studentUserId}`);
  return { error: null };
}

/**
 * Milestone 11-C1 — records a counsellor/admin's provenance determination
 * for one Student Digital Profile section (COUNSELLOR_ENTERED or
 * COUNSELLOR_VERIFIED only — see validateSetSectionProvenance()). Metadata
 * only: never writes to student_profiles or any student_* table.
 */
export async function setSectionProvenanceAction(studentUserId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await setSectionProvenance(studentUserId, formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath(`/admin/students/${studentUserId}`);
  return { error: null };
}

/**
 * Milestone 11-C2 — records a counsellor's explicit COUNSELLOR_VERIFIED
 * override for one recommendation type (career/course/college/pathway).
 */
export async function setRecommendationVerificationAction(studentUserId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await setRecommendationVerification(studentUserId, formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath(`/admin/students/${studentUserId}`);
  return { error: null };
}

/** Milestone 11-C2 — undoes a mistaken recommendation-readiness verification; readiness reverts to the pure computed value. */
export async function clearRecommendationVerificationAction(studentUserId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await clearRecommendationVerification(studentUserId, formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath(`/admin/students/${studentUserId}`);
  return { error: null };
}
