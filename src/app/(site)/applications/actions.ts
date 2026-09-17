"use server";

import { revalidatePath } from "next/cache";
import { advanceMyApplication, updateMyApplicationNote } from "@/lib/supabase/education/applications";
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
