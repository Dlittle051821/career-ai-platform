"use server";

import { revalidatePath } from "next/cache";
import { addStudentNote } from "@/lib/supabase/admin/students";
import { setSectionProvenance } from "@/lib/supabase/admin/profile-provenance";
import { setRecommendationVerification, clearRecommendationVerification } from "@/lib/supabase/admin/recommendation-readiness";
import { createRecommendationDraft } from "@/lib/supabase/admin/recommendation-drafts";
import { friendlyAdminError, type ActionState } from "@/lib/admin/form-state";

/**
 * NW07.3/07.5/07.6 — thin Server Action wrappers for the Counsellor Studio's
 * own Student Case Workspace (`/counsellor/students/[studentId]`). Every
 * one of these calls the EXACT SAME `src/lib/supabase/admin/*.ts` function
 * `/admin/students/actions.ts` already calls for the admin workspace — no
 * business logic is duplicated here, only the `revalidatePath()` targets
 * differ (this route's own paths, not `/admin/students/...`).
 *
 * Deliberately does NOT re-export updateStudentStatusAction/
 * assignCounsellorAction: the `counsellor` role holds no `students:write`
 * permission at all (src/lib/admin/permissions.ts) — operational status
 * and counsellor (re)assignment stay admin-only, by design (see
 * NW07_01_AUDIT.md §3's note on why admin_student_meta's own UPDATE policy
 * is deliberately left untouched). The Student Case Workspace page shows
 * both as read-only text for a counsellor, never a form that would fail on
 * submit.
 */

export async function addStudentNoteAction(studentUserId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await addStudentNote(studentUserId, formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath(`/counsellor/students/${studentUserId}`);
  return { error: null };
}

export async function setSectionProvenanceAction(studentUserId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await setSectionProvenance(studentUserId, formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath(`/counsellor/students/${studentUserId}`);
  revalidatePath("/counsellor/verifications");
  revalidatePath("/counsellor");
  return { error: null };
}

export async function setRecommendationVerificationAction(studentUserId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await setRecommendationVerification(studentUserId, formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath(`/counsellor/students/${studentUserId}`);
  return { error: null };
}

export async function clearRecommendationVerificationAction(studentUserId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await clearRecommendationVerification(studentUserId, formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath(`/counsellor/students/${studentUserId}`);
  return { error: null };
}

export async function createRecommendationDraftAction(studentUserId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const title = String(formData.get("title") ?? "").trim();
  const recommendationTypeRaw = String(formData.get("recommendationType") ?? "").trim();
  let draftId: string;
  try {
    draftId = await createRecommendationDraft({ studentUserId, title, recommendationType: recommendationTypeRaw || null }, formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath(`/counsellor/students/${studentUserId}`);
  revalidatePath("/counsellor/recommendations");
  revalidatePath("/counsellor");
  // Server Actions can't redirect-with-state in the same return shape this
  // form uses (useActionState) — the page's own revalidated data shows the
  // new draft immediately in the Recommendations section; the counsellor
  // opens it with its own link, same pattern staff_create_application_task's
  // own caller uses (no forced redirect, the created id is just available).
  void draftId;
  return { error: null };
}
