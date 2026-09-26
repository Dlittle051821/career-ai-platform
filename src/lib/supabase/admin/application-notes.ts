import "server-only";
import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { AdminValidationError } from "@/lib/admin/form-state";
import { recordAuditLog } from "./audit";

/**
 * Milestone 18 — INTERNAL-ONLY application notes. Mirrors
 * src/lib/supabase/admin/students.ts's addStudentNote()/getStudentDetail()
 * notes-fetching pattern exactly (same requireAdminPermission guard shape,
 * same insert-then-recordAuditLog flow, same author-name resolution
 * approach) — reusing that established PATTERN rather than inventing a new
 * one, per the task's own instruction to check for existing notes
 * infrastructure first. The underlying TABLE is new
 * (application_internal_notes, 0020_application_processing_workspace.sql
 * PART 5) because this is a different entity (an application, not a
 * student) with its own RLS scoping (assigned-counsellor, not
 * "any admin who can see this student") — not a second notes
 * ARCHITECTURE.
 *
 * Gated by `application-documents:review` — the same M18 workspace-access
 * boundary as document review and the checklist, never the broader
 * `applications:write`/`students:write`.
 */

function logDbError(context: string, error: unknown) {
  console.error(`[admin/application-notes] ${context}:`, error);
}

export interface ApplicationInternalNote {
  id: string;
  applicationId: string;
  authorUserId: string | null;
  authorName: string | null;
  note: string;
  createdAt: string;
}

interface InternalNoteRow {
  id: string;
  application_id: string;
  author_user_id: string | null;
  note: string;
  created_at: string;
}

/**
 * Every internal note for one application, newest first. This function —
 * and the underlying table's own RLS (0020 PART 5) — is the entire reason
 * "internal notes never reach student query/API" is true: no student-facing
 * function in this codebase reads application_internal_notes at all, and
 * this file is server-only (`import "server-only"`).
 */
export async function getApplicationInternalNotes(applicationId: string): Promise<ApplicationInternalNote[]> {
  await requireAdminPermission("application-documents:review");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("application_internal_notes")
    .select("id, application_id, author_user_id, note, created_at")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false });
  if (error) {
    logDbError("getApplicationInternalNotes", error);
    return [];
  }

  const rows = (data ?? []) as InternalNoteRow[];
  const authorIds = Array.from(new Set(rows.map((r) => r.author_user_id).filter((id): id is string => !!id)));
  const authorNameById = new Map<string, string>();
  if (authorIds.length > 0) {
    // Mirrors src/lib/supabase/admin/students.ts's own author-name
    // resolution for admin_student_notes exactly (select "id, full_name",
    // default to "Admin" for a null name — never the caller's raw id).
    const { data: authorProfiles, error: profileError } = await supabase.from("profiles").select("id, full_name").in("id", authorIds);
    if (profileError) {
      logDbError("getApplicationInternalNotes:authors", profileError);
    } else {
      for (const p of authorProfiles ?? []) {
        authorNameById.set(p.id, p.full_name ?? "Admin");
      }
    }
  }

  return rows.map((row) => ({
    id: row.id,
    applicationId: row.application_id,
    authorUserId: row.author_user_id,
    authorName: row.author_user_id ? authorNameById.get(row.author_user_id) ?? null : null,
    note: row.note,
    createdAt: row.created_at,
  }));
}

/**
 * Appends one internal note. author_user_id is always set to the caller's
 * own server-derived admin.userId — never accepted from the client — and
 * the underlying RLS INSERT policy (0020 PART 5) independently re-asserts
 * `author_user_id = auth.uid()` regardless of what this function does, so a
 * caller can never write a note attributed to someone else even if this
 * application-layer check were ever bypassed.
 */
export async function addApplicationInternalNote(applicationId: string, formData: FormData): Promise<void> {
  const admin = await requireAdminPermission("application-documents:review");
  const note = String(formData.get("note") ?? "").trim();
  if (!note) throw new AdminValidationError("Note text is required.");
  if (note.length > 4000) throw new AdminValidationError("Note is too long (4000 characters max).");

  const supabase = await createClient();
  const { error } = await supabase.from("application_internal_notes").insert({ application_id: applicationId, author_user_id: admin.userId, note });
  if (error) {
    logDbError("addApplicationInternalNote", error);
    throw new Error("We couldn't save this note. Please try again.");
  }

  await recordAuditLog({
    action: "Added internal note",
    entityType: "application",
    entityId: applicationId,
    entityLabel: `application ${applicationId}`,
  });
}
