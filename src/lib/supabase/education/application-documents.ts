import "server-only";
import { randomUUID } from "node:crypto";
import { createClient } from "../server";
import type { EducationActionResult } from "./saved-items";
import {
  APPLICATION_DOCUMENT_ALLOWED_MIME_TYPES,
  APPLICATION_DOCUMENT_MAX_FILE_SIZE_BYTES,
  isApplicationDocumentReviewStatus,
  isApplicationDocumentType,
  type ApplicationDocumentReviewStatus,
  type ApplicationDocumentType,
} from "@/lib/applications/application-documents";

/**
 * Milestone 17 — Application Documents Foundation.
 *
 * Student-facing orchestration for uploading/listing/replacing/removing a
 * document on the student's OWN application. Every read/write goes through
 * one of the three SECURITY DEFINER RPCs in
 * 0018_application_documents_foundation.sql
 * (get_my_application_documents/student_upload_application_document/
 * student_remove_application_document) — this file never reads or writes
 * `application_documents` directly, matching this table's own "zero direct
 * student RLS access" design.
 *
 * THIS FILE FIXES TWO OF v2's FIVE SECURITY GAPS a pre-install review found
 * in an earlier draft (the other three are fixed in the migration itself —
 * see 0018's own PART 5/6/7 comments):
 *
 *   - Issue 2 (replacement cleanup): uploadApplicationDocument() now deletes
 *     the OLD Storage object — using the RPC's own returned
 *     previous_storage_path, never a client-guessed path — only AFTER the
 *     new metadata row has already committed, and only as a best-effort,
 *     logged cleanup that can never invalidate the new current document.
 *   - Issue 5 (raw error leakage): neither uploadApplicationDocument() nor
 *     removeApplicationDocument() ever returns a raw `rpcError.message` or
 *     `storageError.message` to the caller. sanitizeApplicationDocumentError()
 *     below maps a small, explicit allow-list of this milestone's OWN
 *     RPC-authored, already-safe error strings back to themselves; every
 *     other error (a raw Postgres/PostgREST/Storage error this code did not
 *     itself author to be user-facing) maps to one generic fallback message.
 *
 * M17-v3 note: none of the three Storage `.remove()` calls in this file
 * (line ~275 orphan cleanup after an RPC failure, line ~292 old-object
 * cleanup after a replacement, line ~353 cleanup after an explicit remove)
 * needed to change for v3's Issue 1 (Storage DELETE policy hardening,
 * 0018 PART 5) — every one of them already only ever runs AFTER the
 * corresponding application_documents row has already had its is_current
 * flag flipped to false (replacement/remove) or was never created at all
 * (orphan cleanup), which is exactly the set of objects the hardened DELETE
 * policy still permits. Deleting a CURRENT document's object directly was
 * never something this file did in the first place — see
 * docs/application-documents-guide.md's "Issue 1" section for the full
 * ordering guarantee this depends on.
 */

export const APPLICATION_DOCUMENTS_BUCKET = "application-documents";

function logDbError(context: string, error: unknown) {
  console.error(`[education/application-documents] ${context}:`, error);
}

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

async function requireUserId(supabase: ServerSupabase): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  return user.id;
}

/**
 * Builds the Storage object path for a new upload:
 * `<applicationId>/<random correlation id>/<sanitized filename>`. The
 * random middle segment is generated here, independently of the eventual
 * `application_documents.id` — a client never gets to pick a future
 * metadata row's primary key via the path it uploads to. Matches
 * src/lib/storage/signed-documents.ts's own filename-sanitization
 * convention exactly (allow only `[a-zA-Z0-9._-]`).
 */
export function buildApplicationDocumentStoragePath(applicationId: string, fileName: string): string {
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${applicationId}/${randomUUID()}/${safeFileName}`;
}

/**
 * The small, explicit allow-list of error text this milestone's OWN RPCs
 * (0018_application_documents_foundation.sql PART 6/7) raise — every one of
 * these was deliberately written to be safe, honest, student-facing text
 * (never a raw constraint name or Postgres internals), so relaying an EXACT
 * match is safe. Matched by exact string equality, never a substring check
 * — a wrapped/rethrown Postgres error that happens to merely CONTAIN one of
 * these phrases must not slip through this allow-list by accident.
 */
const SAFE_APPLICATION_DOCUMENT_ERROR_MESSAGES = new Set<string>([
  "Not authenticated.",
  "This document type is not recognized.",
  "This file type is not supported. Please upload a PDF, JPEG, PNG, or WEBP file.",
  "This file is too large. The maximum size is 25MB.",
  "This file name is not valid.",
  "This label is too long (200 characters max).",
  "This document could not be saved. Please try uploading again.",
  "This document could not be saved — the application may not be yours. Please refresh and try again.",
  "This document could not be removed — it may not be yours, or it may have already been removed. Please refresh and try again.",
]);

const GENERIC_UPLOAD_ERROR = "We couldn't save this document. Please try again.";
const GENERIC_REMOVE_ERROR = "We couldn't remove this document. Please try again.";

/**
 * SECURITY FIX — Issue 5 (raw error leakage). Never returns `fallback`'s
 * caller-supplied raw error text unless it is an EXACT match against the
 * fixed allow-list above; every other input (including `undefined`/empty,
 * a raw Postgres/PostgREST error, a Storage SDK error, or any future RPC
 * error text this file was not updated to recognize) maps to `fallback`.
 * This is a deliberately more conservative approach than the "relay
 * error.message as-is" convention some pre-existing Milestone 16 code uses
 * (see advanceMyApplication() in ./applications.ts) — this milestone's own
 * task requirement is stricter: "Only explicitly recognized safe messages
 * may be surfaced."
 */
function sanitizeApplicationDocumentError(rawMessage: string | null | undefined, fallback: string): string {
  if (rawMessage && SAFE_APPLICATION_DOCUMENT_ERROR_MESSAGES.has(rawMessage)) {
    return rawMessage;
  }
  return fallback;
}

export interface MyApplicationDocument {
  id: string;
  documentType: ApplicationDocumentType | string;
  originalFilename: string;
  storagePath: string;
  mimeType: string;
  fileSizeBytes: number;
  displayLabel: string | null;
  createdAt: string;
  updatedAt: string;
  /** Milestone 18 — staff review state. Never review_note/reviewed_by — get_my_application_documents() (0020 PART 3) structurally excludes both; this type has no field for either, so a future accidental select can't leak them through here even if the RPC itself were ever widened by mistake. */
  reviewStatus: ApplicationDocumentReviewStatus;
  /** Milestone 18 — the STUDENT-FACING message, present only while reviewStatus is 'needs_correction'. */
  correctionMessage: string | null;
}

interface MyApplicationDocumentRow {
  id: string;
  document_type: string;
  original_filename: string;
  storage_path: string;
  mime_type: string;
  file_size_bytes: number;
  display_label: string | null;
  created_at: string;
  updated_at: string;
  review_status: string;
  correction_message: string | null;
}

/**
 * The logged-in student's own CURRENT documents for one of their own
 * applications. Calls get_my_application_documents() (0018 PART 3), which
 * is this table's entire read boundary for a student — there is no direct
 * student RLS policy on `application_documents` at all. Returns `[]`
 * (never throws) for a logged-out caller, an application id that isn't the
 * caller's, or any RPC error — matching listMyApplications()'s own
 * fail-closed convention in ./applications.ts.
 *
 * Defensively drops any row whose document_type is not one of the nine
 * recognized values (isApplicationDocumentType()) rather than passing an
 * unrecognized string through to UI code that assumes a closed set — this
 * can only happen if a future migration widens the taxonomy without this
 * file being updated in lockstep, never in ordinary operation today.
 */
export async function listMyApplicationDocuments(applicationId: string): Promise<MyApplicationDocument[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase.rpc("get_my_application_documents", { p_application_id: applicationId });
  if (error) {
    logDbError("listMyApplicationDocuments", error);
    return [];
  }

  return ((data ?? []) as unknown as MyApplicationDocumentRow[])
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
      reviewStatus: isApplicationDocumentReviewStatus(row.review_status) ? row.review_status : "pending_review",
      // Only ever shown while genuinely in needs_correction — the RPC
      // itself already clears this column server-side otherwise (0020 PART
      // 2), this is defense in depth against a future regression.
      correctionMessage: row.review_status === "needs_correction" ? row.correction_message : null,
    }));
}

export interface UploadApplicationDocumentInput {
  applicationId: string;
  documentType: string;
  file: File;
  displayLabel?: string | null;
}

export interface UploadApplicationDocumentResult extends EducationActionResult {
  document?: MyApplicationDocument;
}

/**
 * Uploads a new document (or replaces the current document of the same
 * type) for one of the student's own applications.
 *
 * Order of operations, deliberately: (1) client-side pre-validation — never
 * touches Storage for an input this code can already tell is invalid; (2)
 * upload the file bytes to the private Storage bucket, through the normal
 * RLS-respecting client (the FIRST genuine end-user browser-to-Storage
 * upload in this codebase — every prior Storage write ran from a webhook
 * with no session, via the service-role client); (3) call
 * student_upload_application_document() with the resulting path — which
 * itself re-verifies the object genuinely exists (0018's Issue-1 fix)
 * before any metadata becomes current; (4) only once that RPC call has
 * SUCCEEDED, attempt a best-effort delete of any now-orphaned OLD object
 * the RPC reports retiring (0018's Issue-2 fix) — a failure here is logged
 * and never fails the overall operation or invalidates the new document,
 * since PART 5's Storage SELECT policy already makes an orphaned old
 * object unreadable regardless of whether this cleanup ever runs.
 *
 * If the RPC call itself fails AFTER a successful Storage upload, the
 * newly-uploaded (now-orphaned, metadata-less) object is also cleaned up
 * best-effort — this is the "ghost object with no matching metadata" case,
 * distinct from Issue 2's "old object superseded by a successful
 * replacement" case, but the same cleanup discipline applies: never fail
 * louder than a log line, since the RPC call itself already failed and is
 * what the caller is told about.
 */
export async function uploadApplicationDocument(input: UploadApplicationDocumentInput): Promise<UploadApplicationDocumentResult> {
  const supabase = await createClient();
  try {
    await requireUserId(supabase);
  } catch {
    return { success: false, error: "You need to be logged in to upload a document." };
  }

  if (!isApplicationDocumentType(input.documentType)) {
    return { success: false, error: "This document type is not recognized." };
  }
  if (!APPLICATION_DOCUMENT_ALLOWED_MIME_TYPES.includes(input.file.type as (typeof APPLICATION_DOCUMENT_ALLOWED_MIME_TYPES)[number])) {
    return { success: false, error: "This file type is not supported. Please upload a PDF, JPEG, PNG, or WEBP file." };
  }
  if (input.file.size <= 0 || input.file.size > APPLICATION_DOCUMENT_MAX_FILE_SIZE_BYTES) {
    return { success: false, error: "This file is too large. The maximum size is 25MB." };
  }
  if (!input.file.name || input.file.name.length > 255) {
    return { success: false, error: "This file name is not valid." };
  }
  if (input.displayLabel && input.displayLabel.length > 200) {
    return { success: false, error: "This label is too long (200 characters max)." };
  }

  const storagePath = buildApplicationDocumentStoragePath(input.applicationId, input.file.name);
  const bytes = new Uint8Array(await input.file.arrayBuffer());

  const { error: uploadError } = await supabase.storage.from(APPLICATION_DOCUMENTS_BUCKET).upload(storagePath, bytes, {
    contentType: input.file.type,
    upsert: false,
  });
  if (uploadError) {
    logDbError("uploadApplicationDocument(storage upload)", uploadError);
    // Never surfaces the raw Storage error to the student — this is not one
    // of this milestone's own RPC-authored messages, so it is never eligible
    // for sanitizeApplicationDocumentError()'s allow-list either.
    return { success: false, error: GENERIC_UPLOAD_ERROR };
  }

  const { data, error: rpcError } = await supabase.rpc("student_upload_application_document", {
    p_application_id: input.applicationId,
    p_document_type: input.documentType,
    p_original_filename: input.file.name,
    p_storage_path: storagePath,
    p_mime_type: input.file.type,
    p_file_size_bytes: input.file.size,
    p_display_label: input.displayLabel ?? null,
  });

  if (rpcError) {
    logDbError("uploadApplicationDocument(rpc)", rpcError);
    // The just-uploaded object has no matching metadata row now — clean it
    // up best-effort so it does not sit around as an orphan. Failure here
    // is logged only; the student is told about the RPC failure, not this
    // secondary cleanup.
    const { error: orphanCleanupError } = await supabase.storage.from(APPLICATION_DOCUMENTS_BUCKET).remove([storagePath]);
    if (orphanCleanupError) {
      logDbError("uploadApplicationDocument(orphan cleanup after rpc failure)", orphanCleanupError);
    }
    return { success: false, error: sanitizeApplicationDocumentError(rpcError.message, GENERIC_UPLOAD_ERROR) };
  }

  const row = ((data ?? [])[0] ?? null) as (MyApplicationDocumentRow & { previous_storage_path: string | null }) | null;
  if (!row) {
    return { success: false, error: GENERIC_UPLOAD_ERROR };
  }

  // SECURITY FIX — Issue 2 (replacement cleanup): only reachable once the
  // new metadata row has already committed successfully. Uses the RPC's
  // own returned previous_storage_path — never a client-guessed value —
  // and only when a replacement actually happened (null on a first upload).
  if (row.previous_storage_path) {
    const { error: oldObjectCleanupError } = await supabase.storage.from(APPLICATION_DOCUMENTS_BUCKET).remove([row.previous_storage_path]);
    if (oldObjectCleanupError) {
      logDbError("uploadApplicationDocument(old object cleanup after replacement)", oldObjectCleanupError);
      // Deliberately does not affect the return value below — a cleanup
      // failure here can never invalidate the new current document, and the
      // old object is already unreadable via Storage regardless (0018 PART
      // 5's is_current-aware SELECT policy).
    }
  }

  return {
    success: true,
    document: {
      id: row.id,
      documentType: row.document_type,
      originalFilename: row.original_filename,
      storagePath: row.storage_path,
      mimeType: row.mime_type,
      fileSizeBytes: row.file_size_bytes,
      displayLabel: row.display_label,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      // Milestone 18 — a brand-new upload/replacement always starts at
      // 'pending_review' at the database level (the column DEFAULT — see
      // 0020 PART 1; student_upload_application_document() itself was not
      // changed to know about review at all, so this is asserted here
      // rather than read back from the RPC's own unchanged return columns).
      reviewStatus: "pending_review",
      correctionMessage: null,
    },
  };
}

/**
 * Removes one of the student's own current documents.
 *
 * SECURITY FIX — Issue 4 (remove cleanup failure): student_remove_
 * application_document() (0018 PART 7) already retires the metadata row
 * unconditionally, in one atomic statement, before this function ever
 * attempts the Storage delete below — so a Storage delete failure here
 * NEVER rolls back or invalidates the already-successful metadata removal,
 * and is explicitly logged (never silently swallowed) rather than merely
 * ignored. The object may remain physically present in Storage after a
 * failed cleanup, but 0018 PART 5's Storage SELECT policy already makes it
 * unreadable by anyone the moment its metadata row's is_current flips to
 * false — this function's job is only to ATTEMPT cleanup, not to be the
 * thing that makes it safe.
 *
 * Uses the RPC's own returned storage_path — never a client-supplied one —
 * for the delete call, so the object actually targeted for deletion can
 * never diverge from the document just proven to be the caller's own.
 */
export async function removeApplicationDocument(documentId: string): Promise<EducationActionResult> {
  const supabase = await createClient();
  try {
    await requireUserId(supabase);
  } catch {
    return { success: false, error: "You need to be logged in to remove a document." };
  }

  const { data, error: rpcError } = await supabase.rpc("student_remove_application_document", { p_document_id: documentId });
  if (rpcError) {
    logDbError("removeApplicationDocument(rpc)", rpcError);
    return { success: false, error: sanitizeApplicationDocumentError(rpcError.message, GENERIC_REMOVE_ERROR) };
  }

  const row = (data ?? [])[0] ?? null;
  if (row?.storage_path) {
    const { error: storageError } = await supabase.storage.from(APPLICATION_DOCUMENTS_BUCKET).remove([row.storage_path]);
    if (storageError) {
      logDbError("removeApplicationDocument(storage cleanup)", storageError);
      // Never surfaced to the student and never turns this into a failure —
      // the metadata removal already succeeded and is what matters for
      // visibility; see this function's own header comment.
    }
  }

  return { success: true };
}

/**
 * Short-lived (5 minute) signed download URL for one of the student's own
 * CURRENT documents. Relies entirely on 0018 PART 5's Storage SELECT policy
 * (bucket + regex-guarded ownership join + is_current = true) to decide
 * whether the calling session may actually read this object — mirrors
 * src/lib/storage/signed-documents.ts createSignedDownloadUrl() exactly.
 * Returns null (never throws) on any failure — not found, not authorized,
 * or a retired/removed document whose object is no longer readable — so
 * callers render a "not available" state rather than a raw error.
 */
export async function getApplicationDocumentDownloadUrl(storagePath: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(APPLICATION_DOCUMENTS_BUCKET).createSignedUrl(storagePath, 5 * 60);
  if (error || !data?.signedUrl) {
    if (error) logDbError("getApplicationDocumentDownloadUrl", error);
    return null;
  }
  return data.signedUrl;
}
