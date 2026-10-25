"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createApplication, updateApplication } from "@/lib/supabase/admin/applications";
import { getApplicationDocumentDownloadUrlForAdmin, reviewApplicationDocument } from "@/lib/supabase/admin/application-documents";
import { toggleApplicationChecklistItem } from "@/lib/supabase/admin/application-checklist";
import { addApplicationInternalNote } from "@/lib/supabase/admin/application-notes";
import { recordApplicationSubmission } from "@/lib/supabase/admin/application-submissions";
import { createApplicationTask, updateApplicationTaskStatus, type CreateApplicationTaskInput } from "@/lib/supabase/admin/application-tasks";
import { friendlyAdminError, AdminValidationError, type ActionState } from "@/lib/admin/form-state";

export interface SimpleActionResult {
  success: boolean;
  error?: string;
}

async function resolveStudentEmailToId(formData: FormData): Promise<FormData> {
  const email = String(formData.get("studentEmail") ?? "").trim().toLowerCase();
  if (!email) throw new AdminValidationError("A registered student email is required.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("id, account_type").eq("email", email).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.account_type !== "student") throw new AdminValidationError("No registered student account found with that email.");
  const next = new FormData();
  for (const [key, value] of formData.entries()) next.append(key, value);
  next.set("studentUserId", data.id);
  return next;
}

export async function createApplicationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let id: string;
  try {
    const resolved = await resolveStudentEmailToId(formData);
    id = await createApplication(resolved);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/applications");
  redirect(`/admin/applications/${id}`);
}

export async function updateApplicationAction(id: string, studentUserId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  formData.set("studentUserId", studentUserId);
  try {
    await updateApplication(id, formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/applications");
  revalidatePath(`/admin/applications/${id}`);
  redirect(`/admin/applications/${id}`);
}

/**
 * Milestone 17 — read-only "View" action for AdminDocumentDownloadButton.tsx
 * on the admin application-detail page. Swallows AdminAuthorizationError
 * (thrown by requireAdminPermission inside
 * getApplicationDocumentDownloadUrlForAdmin) into a plain `{ url: null }`
 * rather than letting it propagate — this is a small, non-critical "View"
 * button, not a page load; a caller who somehow reaches it without
 * `application-documents:read` (M17-v3 — narrowed from the broader
 * `applications:read` v2 used; see src/lib/supabase/admin/application-
 * documents.ts's own header comment) simply sees the link fail to open,
 * never a raw error screen, and never any information about why. In
 * practice this button is never even rendered for such a caller — the
 * surrounding page (src/app/admin/applications/[id]/page.tsx) omits the
 * whole Documents card when `hasPermission(admin?.role,
 * "application-documents:read")` is false — but this action still enforces
 * the permission itself regardless, as defense in depth.
 */
export async function getAdminApplicationDocumentDownloadUrlAction(storagePath: string): Promise<{ url: string | null }> {
  try {
    const url = await getApplicationDocumentDownloadUrlForAdmin(storagePath);
    return { url };
  } catch {
    return { url: null };
  }
}

/**
 * Milestone 18 — staff document review. Never accepts a reviewer identity
 * from the client (the RPC behind reviewApplicationDocument() derives it
 * server-side from auth.uid() only). revalidatePath refreshes the
 * server-rendered document list/history on this same page after a
 * successful review.
 */
export async function reviewApplicationDocumentAction(
  applicationId: string,
  documentId: string,
  reviewStatus: string,
  options: { reviewNote?: string; correctionMessage?: string } = {}
): Promise<SimpleActionResult> {
  try {
    await reviewApplicationDocument(documentId, reviewStatus, { reviewNote: options.reviewNote, correctionMessage: options.correctionMessage });
  } catch (error) {
    return { success: false, error: friendlyAdminError(error) };
  }
  revalidatePath(`/admin/applications/${applicationId}`);
  return { success: true };
}

/** Milestone 18 — toggles one of the four manual checklist items. */
export async function toggleApplicationChecklistItemAction(applicationId: string, itemKey: string, completed: boolean): Promise<SimpleActionResult> {
  try {
    await toggleApplicationChecklistItem(applicationId, itemKey, completed);
  } catch (error) {
    return { success: false, error: friendlyAdminError(error) };
  }
  revalidatePath(`/admin/applications/${applicationId}`);
  return { success: true };
}

/** Milestone 18 — appends one internal (staff-only) note. */
export async function addApplicationInternalNoteAction(applicationId: string, formData: FormData): Promise<SimpleActionResult> {
  try {
    await addApplicationInternalNote(applicationId, formData);
  } catch (error) {
    return { success: false, error: friendlyAdminError(error) };
  }
  revalidatePath(`/admin/applications/${applicationId}`);
  return { success: true };
}

/**
 * NW06 — creates a new Student Action Required task (AdminApplicationTasks.tsx's
 * "New task" form). Every validation rule and the authorization/assignment
 * check both live in staff_create_application_task() — this action is a
 * thin FormData-to-typed-input adapter plus the standard
 * friendlyAdminError()/revalidatePath() wrapping every other action in this
 * file already uses.
 */
export async function createApplicationTaskAction(applicationId: string, formData: FormData): Promise<SimpleActionResult> {
  const input: CreateApplicationTaskInput = {
    applicationId,
    taskType: String(formData.get("taskType") ?? ""),
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    dueDate: String(formData.get("dueDate") ?? "").trim() || null,
    relatedDocumentType: String(formData.get("relatedDocumentType") ?? "").trim() || null,
    externalPaymentAmountMinorUnits: (() => {
      const raw = String(formData.get("externalPaymentAmountMajor") ?? "").trim();
      if (!raw) return null;
      const major = Number.parseFloat(raw);
      return Number.isFinite(major) ? Math.round(major * 100) : null;
    })(),
    externalPaymentCurrency: String(formData.get("externalPaymentCurrency") ?? "").trim() || null,
    externalPaymentPayee: String(formData.get("externalPaymentPayee") ?? "").trim() || null,
    externalPaymentInstructions: String(formData.get("externalPaymentInstructions") ?? "").trim() || null,
    externalPaymentReference: String(formData.get("externalPaymentReference") ?? "").trim() || null,
  };
  try {
    await createApplicationTask(input);
  } catch (error) {
    return { success: false, error: friendlyAdminError(error) };
  }
  revalidatePath(`/admin/applications/${applicationId}`);
  return { success: true };
}

/** NW06 — moves a task to a new status (review, verify, reopen, cancel). */
export async function updateApplicationTaskStatusAction(applicationId: string, taskId: string, status: string, staffNote?: string): Promise<SimpleActionResult> {
  try {
    await updateApplicationTaskStatus(taskId, status, staffNote || null);
  } catch (error) {
    return { success: false, error: friendlyAdminError(error) };
  }
  revalidatePath(`/admin/applications/${applicationId}`);
  return { success: true };
}

/**
 * Milestone 19 — "Record submitted application" (deliberately never named
 * "Submit application" — see AdminApplicationSubmissionPanel.tsx's own
 * comment). Never accepts a submitted-by identity, stage, or readiness
 * value from the client — the RPC behind recordApplicationSubmission()
 * derives/re-validates every one of those server-side from auth.uid() and
 * the current database state only. revalidatePath refreshes the
 * server-rendered submission panel/history and the student-facing
 * application page after a successful recording, since this action also
 * transitions applications.stage.
 */
export async function recordApplicationSubmissionAction(applicationId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await recordApplicationSubmission(applicationId, formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/applications");
  revalidatePath(`/admin/applications/${applicationId}`);
  revalidatePath(`/applications/${applicationId}`);
  return { error: null };
}
