import "server-only";
import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { isApplicationDocumentType, type ApplicationDocumentType } from "@/lib/applications/application-documents";
import { APPLICATION_DOCUMENTS_BUCKET } from "../education/application-documents";

/**
 * Milestone 17 — Application Documents Foundation.
 *
 * Minimal, READ-ONLY admin/counsellor visibility, embedded in the existing
 * application-detail page (never a standalone document-management page —
 * see M17_COMPLETION_REPORT.md §16).
 *
 * SECURITY FIX — Issue 2 (M17-v3, least-privilege document access): v2
 * gated both functions below with `requireAdminPermission("applications:read")`
 * — reused from the surrounding page's own broader permission. Re-audited:
 * `applications:read` is held by super_admin/admin/counsellor/finance/analyst
 * (src/lib/admin/permissions.ts), and nothing in this project's existing
 * spec establishes a concrete need for finance or analyst to see application
 * documents specifically — they can contain identity documents, academic
 * transcripts, financial documents, and test-score certificates. Both
 * functions below now require the new, narrower `application-documents:read`
 * permission instead (granted only to super_admin/admin/counsellor — see
 * src/lib/admin/permissions.ts), matching 0018_application_documents_
 * foundation.sql PART 2/5's own narrowed RLS role checks exactly, so the
 * SQL and TypeScript authorization models agree. This is a reuse of the
 * codebase's own established per-milestone-narrow-permission-pair
 * convention (see "profile-verification:read", "recommendation-readiness:
 * read"), not a new RBAC architecture.
 *
 * A caller who can reach the surrounding application-detail page (gated by
 * the broader `applications:read`, unchanged by this milestone) but lacks
 * `application-documents:read` (finance, analyst) must never see this
 * throw and break the whole page — src/app/admin/applications/[id]/page.tsx
 * checks `hasPermission(admin?.role, "application-documents:read")` itself
 * before ever calling listApplicationDocumentsForAdmin(), and simply omits
 * the Documents card entirely for such a caller, the same pattern already
 * used there for "profile-verification:read"/"recommendation-readiness:read"
 * (src/app/admin/students/[id]/page.tsx).
 *
 * `application_documents` DOES have one admin/counsellor RLS SELECT policy
 * (0018_application_documents_foundation.sql PART 2) — unlike the student
 * path, this file reads the table directly rather than through an RPC,
 * exactly mirroring how the rest of src/lib/supabase/admin/applications.ts
 * reads `applications` directly under its own admin RLS policies. This is
 * safe because that RLS policy already re-derives authorization from the
 * caller's admin role / assigned-counsellor status on every row, the same
 * database-authoritative boundary every RPC in this milestone also uses.
 *
 * Task requirement ("M17 has no version-history UI, so normal viewing
 * should expose current documents only"): filters `.eq("is_current", true)`
 * below — the RLS policy itself does not filter on is_current (see that
 * policy's own comment for why), so this is where that UI-level rule is
 * actually enforced.
 */

function logDbError(context: string, error: unknown) {
  console.error(`[admin/application-documents] ${context}:`, error);
}

export interface AdminApplicationDocument {
  id: string;
  documentType: ApplicationDocumentType | string;
  originalFilename: string;
  storagePath: string;
  mimeType: string;
  fileSizeBytes: number;
  displayLabel: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ApplicationDocumentRow {
  id: string;
  document_type: string;
  original_filename: string;
  storage_path: string;
  mime_type: string;
  file_size_bytes: number;
  display_label: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * The CURRENT documents for one application, for an authorized admin/
 * counsellor. Throws AdminAuthorizationError (via requireAdminPermission)
 * for a caller without `application-documents:read` — same convention as
 * every other function in src/lib/supabase/admin/applications.ts, left for
 * the calling page/action to handle, never swallowed here (see this file's
 * own header comment for why the surrounding page checks this permission
 * itself before ever calling this function, rather than relying on the
 * throw). RLS additionally scopes a counsellor caller to only their own
 * assigned applications regardless of what `applicationId` is passed — a
 * counsellor who is not assigned to this application gets zero rows, not an
 * error, matching this table's own RLS policy shape.
 */
export async function listApplicationDocumentsForAdmin(applicationId: string): Promise<AdminApplicationDocument[]> {
  await requireAdminPermission("application-documents:read");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("application_documents")
    .select("id, document_type, original_filename, storage_path, mime_type, file_size_bytes, display_label, created_at, updated_at")
    .eq("application_id", applicationId)
    .eq("is_current", true)
    .order("document_type", { ascending: true });

  if (error) {
    logDbError("listApplicationDocumentsForAdmin", error);
    return [];
  }

  return ((data ?? []) as ApplicationDocumentRow[])
    .filter((row) => isApplicationDocumentType(row.document_type))
    .map((row) => ({
      id: row.id,
      documentType: row.document_type as ApplicationDocumentType,
      originalFilename: row.original_filename,
      storagePath: row.storage_path,
      mimeType: row.mime_type,
      fileSizeBytes: row.file_size_bytes,
      displayLabel: row.display_label,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
}

/**
 * Short-lived signed download URL for an admin/counsellor "View" action.
 * Requires `application-documents:read` at the application layer AND —
 * since this still goes through the admin's own RLS-respecting session —
 * must also satisfy 0018 PART 5's Storage SELECT policy (bucket +
 * regex-guarded ownership/role join + is_current = true), so a stale/removed
 * document's path never resolves to a usable URL even for an authorized
 * admin. Returns null (never throws) on any Storage-level failure — but
 * still THROWS AdminAuthorizationError for a missing `application-documents:
 * read` permission (see getAdminApplicationDocumentDownloadUrlAction in
 * src/app/admin/applications/actions.ts, which is what actually swallows
 * that into a plain `{ url: null }` for this specific "View" button, a
 * deliberately different, more forgiving posture than a full page load).
 */
export async function getApplicationDocumentDownloadUrlForAdmin(storagePath: string): Promise<string | null> {
  await requireAdminPermission("application-documents:read");
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(APPLICATION_DOCUMENTS_BUCKET).createSignedUrl(storagePath, 5 * 60);
  if (error || !data?.signedUrl) {
    if (error) logDbError("getApplicationDocumentDownloadUrlForAdmin", error);
    return null;
  }
  return data.signedUrl;
}
