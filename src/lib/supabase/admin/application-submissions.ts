import "server-only";
import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { recordAuditLog } from "./audit";
import { AdminValidationError } from "@/lib/admin/form-state";
import {
  APPLICATION_SUBMISSION_EXTERNAL_REFERENCE_MAX_LENGTH,
  APPLICATION_SUBMISSION_INTERNAL_NOTE_MAX_LENGTH,
  APPLICATION_SUBMISSION_PLATFORM_NAME_MAX_LENGTH,
  isApplicationSubmissionMethod,
  isValidApplicationSubmissionUrl,
} from "@/lib/applications/application-submission";
import type { ApplicationDocumentType } from "@/lib/applications/application-documents";
import type { ApplicationSubmission } from "@/types/admin";

/**
 * Milestone 19 — Application Submission Preparation & Manual Submission
 * Tracking. Admin-layer I/O — the "pure logic vs I/O" split every prior
 * milestone in this codebase uses (see src/lib/applications/
 * application-submission.ts's own header comment): this file talks to
 * Supabase, that one does not.
 *
 * The real authorization AND concurrency boundary is
 * staff_record_application_submission() itself
 * (0021_application_submission_tracking.sql PART 3) — recordApplicationSubmission()
 * below is a thin, honest wrapper: it never re-derives or trusts a
 * caller-supplied submitted-by identity, stage, readiness, or assignment
 * state, and it never swallows the RPC's own generic anti-enumeration error
 * into something else.
 */

function logDbError(context: string, error: unknown) {
  console.error(`[admin/application-submissions] ${context}:`, error);
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

interface ApplicationSubmissionRow {
  id: string;
  application_id: string;
  submitted_at: string;
  submitted_by_user_id: string | null;
  submission_method: string;
  platform_name: string | null;
  external_reference: string | null;
  external_url: string | null;
  internal_note: string | null;
  application_stage_at_submission: string;
  university_id: string | null;
  university_label: string | null;
  course_id: string | null;
  course_label: string | null;
  course_intake_id: string | null;
  intake_label: string | null;
  created_at: string;
}

async function resolveSubmittedByName(supabase: Supabase, userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const { data } = await supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  return data?.full_name ?? null;
}

function toApplicationSubmission(row: ApplicationSubmissionRow, submittedByName: string | null): ApplicationSubmission {
  return {
    id: row.id,
    applicationId: row.application_id,
    submittedAt: row.submitted_at,
    submittedByUserId: row.submitted_by_user_id,
    submittedByName,
    submissionMethod: row.submission_method,
    platformName: row.platform_name,
    externalReference: row.external_reference,
    externalUrl: row.external_url,
    internalNote: row.internal_note,
    applicationStageAtSubmission: row.application_stage_at_submission,
    universityLabel: row.university_label,
    courseLabel: row.course_label,
    intakeLabel: row.intake_label,
    createdAt: row.created_at,
  };
}

/**
 * The submission record for one application, for an authorized admin/
 * counsellor — or `null` if no submission has been recorded yet. RLS
 * (0021 PART 5) additionally scopes a counsellor caller to only their own
 * assigned applications regardless of what `applicationId` is passed — a
 * counsellor who is not assigned to this application gets zero rows, not an
 * error, matching every other table's RLS shape in this codebase.
 */
export async function getApplicationSubmissionForAdmin(applicationId: string): Promise<ApplicationSubmission | null> {
  await requireAdminPermission("application-submissions:read");
  const supabase = await createClient();

  const { data, error } = await supabase.from("application_submissions").select("*").eq("application_id", applicationId).maybeSingle();
  if (error) {
    logDbError("getApplicationSubmissionForAdmin", error);
    return null;
  }
  if (!data) return null;

  const row = data as ApplicationSubmissionRow;
  const submittedByName = await resolveSubmittedByName(supabase, row.submitted_by_user_id);
  return toApplicationSubmission(row, submittedByName);
}

export interface ApplicationSubmissionDocumentSummary {
  id: string;
  documentType: ApplicationDocumentType | string;
  originalFilename: string;
}

/**
 * The exact document versions included in a recorded submission — read via
 * a two-step lookup (submission_documents rows, then the referenced
 * application_documents rows by id), matching this codebase's own
 * established "resolve related names via a second query" convention (see
 * buildStudentNameMap()/buildCounsellorNameMap() in ./applications.ts)
 * rather than an embedded PostgREST join. Deliberately reads
 * `original_filename` from the REFERENCED application_documents row (not
 * from a duplicated column on the snapshot itself) — that row is never
 * hard-deleted (application_submission_documents.application_document_id is
 * ON DELETE RESTRICT, and no code path in this codebase issues a hard
 * DELETE against application_documents in the first place), so this stays
 * resolvable even long after the document was superseded by a later
 * replacement (is_current flips to false, the row itself persists).
 */
export async function listApplicationSubmissionDocumentsForAdmin(submissionId: string): Promise<ApplicationSubmissionDocumentSummary[]> {
  await requireAdminPermission("application-submissions:read");
  const supabase = await createClient();

  const { data: snapshotRows, error } = await supabase
    .from("application_submission_documents")
    .select("id, application_document_id, document_type")
    .eq("submission_id", submissionId)
    .order("document_type", { ascending: true });
  if (error) {
    logDbError("listApplicationSubmissionDocumentsForAdmin", error);
    return [];
  }
  const rows = snapshotRows ?? [];
  if (rows.length === 0) return [];

  const documentIds = rows.map((r) => r.application_document_id);
  const { data: documentRows, error: docError } = await supabase.from("application_documents").select("id, original_filename").in("id", documentIds);
  if (docError) {
    logDbError("listApplicationSubmissionDocumentsForAdmin(documents)", docError);
  }
  const filenameById = new Map((documentRows ?? []).map((d) => [d.id, d.original_filename]));

  return rows.map((r) => ({
    id: r.id,
    documentType: r.document_type as ApplicationDocumentType,
    originalFilename: filenameById.get(r.application_document_id) ?? "(document no longer available)",
  }));
}

/**
 * Milestone 19 — the ONLY admin-layer entry point for recording an external
 * submission. Gated by the new `application-submissions:write` permission
 * (never the broader `applications:write`/`application-documents:review`
 * alone). Every validation below mirrors — and is deliberately no stricter
 * or looser than — the identical checks inside
 * staff_record_application_submission() itself
 * (0021_application_submission_tracking.sql PART 3); this function's own
 * checks exist only to fail fast with a field-specific message before ever
 * reaching the database, never as a substitute for the RPC's own
 * authoritative re-validation.
 */
export async function recordApplicationSubmission(applicationId: string, formData: FormData): Promise<void> {
  const admin = await requireAdminPermission("application-submissions:write");

  const submissionMethod = String(formData.get("submissionMethod") ?? "").trim();
  if (!isApplicationSubmissionMethod(submissionMethod)) {
    throw new AdminValidationError("Please choose a valid submission method.");
  }

  const platformName = String(formData.get("platformName") ?? "").trim() || null;
  if (platformName && platformName.length > APPLICATION_SUBMISSION_PLATFORM_NAME_MAX_LENGTH) {
    throw new AdminValidationError(`The platform/portal name is too long (${APPLICATION_SUBMISSION_PLATFORM_NAME_MAX_LENGTH} characters max).`);
  }

  const externalReference = String(formData.get("externalReference") ?? "").trim() || null;
  if (externalReference && externalReference.length > APPLICATION_SUBMISSION_EXTERNAL_REFERENCE_MAX_LENGTH) {
    throw new AdminValidationError(`The application reference is too long (${APPLICATION_SUBMISSION_EXTERNAL_REFERENCE_MAX_LENGTH} characters max).`);
  }

  const externalUrlRaw = String(formData.get("externalUrl") ?? "").trim();
  const externalUrl = externalUrlRaw || null;
  if (externalUrl && !isValidApplicationSubmissionUrl(externalUrl)) {
    throw new AdminValidationError("The submission URL is not valid. Please use a link starting with http:// or https://.");
  }

  const internalNote = String(formData.get("internalNote") ?? "").trim() || null;
  if (internalNote && internalNote.length > APPLICATION_SUBMISSION_INTERNAL_NOTE_MAX_LENGTH) {
    throw new AdminValidationError(`The internal note is too long (${APPLICATION_SUBMISSION_INTERNAL_NOTE_MAX_LENGTH} characters max).`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_record_application_submission", {
    p_application_id: applicationId,
    p_submission_method: submissionMethod,
    p_platform_name: platformName,
    p_external_reference: externalReference,
    p_external_url: externalUrl,
    p_internal_note: internalNote,
  });

  if (error) {
    logDbError("recordApplicationSubmission", error);
    // staff_record_application_submission() raises one of a small set of
    // already-safe, generic, anti-enumeration messages (0021 PART 3) — safe
    // to relay as-is, matching reviewApplicationDocument()'s own convention
    // in ./application-documents.ts. No raw Postgres/PostgREST detail is
    // ever attached to any of those messages.
    throw new Error(error.message);
  }

  const row = (data ?? [])[0] ?? null;
  if (!row) {
    throw new Error("This submission could not be recorded. Please refresh and try again.");
  }

  await recordAuditLog({
    action: "Recorded external submission",
    entityType: "application_submission",
    entityId: row.application_id,
    entityLabel: `submission for application ${row.application_id}`,
    context: { submissionId: row.id, submissionMethod, actorRole: admin.role },
  });
}
