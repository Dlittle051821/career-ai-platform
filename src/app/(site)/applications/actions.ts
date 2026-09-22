"use server";

import { revalidatePath } from "next/cache";
import { advanceMyApplication, updateMyApplicationNote } from "@/lib/supabase/education/applications";
import {
  getApplicationDocumentDownloadUrl,
  removeApplicationDocument,
  uploadApplicationDocument,
  type MyApplicationDocument,
} from "@/lib/supabase/education/application-documents";
import type { StudentApplicationAction } from "@/types/admin";

/**
 * Server Actions backing the two client-side controls on
 * /applications/[id] (ApplicationActions.tsx and
 * ApplicationNoteEditor.tsx). Every function here re-derives the logged-in
 * user itself via the underlying src/lib/supabase/education/applications.ts
 * calls (middleware protects *pages*, not a Server Action invoked directly
 * — same convention as
 * src/app/(site)/courses/[universitySlug]/[courseSlug]/actions.ts) and
 * revalidates both the dashboard and the detail page so a stage/note change
 * is reflected immediately without a hard refresh.
 */

export interface ApplicationActionResult {
  success: boolean;
  error: string | null;
}

export async function advanceApplicationAction(applicationId: string, action: StudentApplicationAction): Promise<ApplicationActionResult> {
  const result = await advanceMyApplication(applicationId, action);
  if (!result.success) {
    return { success: false, error: result.error ?? "This application could not be updated. Please refresh and try again." };
  }
  revalidatePath("/applications");
  revalidatePath(`/applications/${applicationId}`);
  return { success: true, error: null };
}

export async function updateApplicationNoteAction(applicationId: string, note: string): Promise<ApplicationActionResult> {
  const result = await updateMyApplicationNote(applicationId, note);
  if (!result.success) {
    return { success: false, error: result.error ?? "Your note could not be saved. Please try again." };
  }
  revalidatePath(`/applications/${applicationId}`);
  return { success: true, error: null };
}

/**
 * Milestone 17 (v2) — the four new Server Actions backing
 * ApplicationDocuments.tsx (the student-facing document checklist on
 * /applications/[id]). Every one re-derives the logged-in user itself via
 * the underlying src/lib/supabase/education/application-documents.ts calls
 * — same "middleware protects pages, not a Server Action invoked directly"
 * convention documented above for the two pre-existing actions in this
 * file. None of these ever mutate applications.stage — document actions
 * are deliberately independent of application lifecycle state (spec's own
 * instruction: document completeness is one input to readiness, never an
 * automatic trigger for it).
 */

export interface ApplicationDocumentActionResult {
  success: boolean;
  error: string | null;
  document: MyApplicationDocument | null;
}

export async function uploadApplicationDocumentAction(applicationId: string, formData: FormData): Promise<ApplicationDocumentActionResult> {
  const documentType = String(formData.get("documentType") ?? "");
  const file = formData.get("file");
  const rawLabel = formData.get("displayLabel");

  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Please choose a file to upload.", document: null };
  }

  const result = await uploadApplicationDocument({
    applicationId,
    documentType,
    file,
    displayLabel: typeof rawLabel === "string" && rawLabel.trim() ? rawLabel.trim() : null,
  });

  if (!result.success) {
    return { success: false, error: result.error ?? "We couldn't save this document. Please try again.", document: null };
  }
  revalidatePath(`/applications/${applicationId}`);
  return { success: true, error: null, document: result.document ?? null };
}

export async function removeApplicationDocumentAction(applicationId: string, documentId: string): Promise<ApplicationActionResult> {
  const result = await removeApplicationDocument(documentId);
  if (!result.success) {
    return { success: false, error: result.error ?? "We couldn't remove this document. Please try again." };
  }
  revalidatePath(`/applications/${applicationId}`);
  return { success: true, error: null };
}

/**
 * Returns a short-lived signed URL for one of the student's own documents,
 * or `null` on any failure (not found, not authorized, retired). Relies
 * entirely on 0018_application_documents_foundation.sql PART 5's Storage
 * SELECT policy — this action performs no ownership check of its own,
 * exactly like the pre-existing signed-agreement/stamped-agreement download
 * paths this milestone's Storage helper mirrors.
 */
export async function getApplicationDocumentDownloadUrlAction(storagePath: string): Promise<{ url: string | null }> {
  const url = await getApplicationDocumentDownloadUrl(storagePath);
  return { url };
}
