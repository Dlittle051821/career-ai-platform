"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createApplication, updateApplication } from "@/lib/supabase/admin/applications";
import { getApplicationDocumentDownloadUrlForAdmin } from "@/lib/supabase/admin/application-documents";
import { friendlyAdminError, AdminValidationError, type ActionState } from "@/lib/admin/form-state";

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
