import "server-only";
import { createClient } from "../server";
import { getCurrentUser } from "../profile";
import { createSignedDownloadUrl } from "@/lib/storage/signed-documents";
import { createStampedDownloadUrl } from "@/lib/storage/stamped-documents";
import type { SignatureRequest, SignatureRequestStatus } from "@/types/signatures";
import type { StampRequest, StampRequestStatus, StampSignSequence } from "@/types/stamping";
import type { AgreementStatus, SignatureStatus, StampStatus } from "@/types/admin";

/**
 * Milestone 10 (F-122) — student-facing agreement + signature reads.
 * Mirrors src/lib/supabase/payments/student-invoices.ts's own convention
 * exactly: EVERY function here re-checks `student_user_id = user.id`
 * EXPLICITLY in the query, on top of (never instead of) agreements' own
 * RLS policy — this codebase's "RLS is the floor, not the only check"
 * discipline. A student can never reach another student's agreement or
 * signature request by editing an id in a URL: getMyAgreementById()
 * returns null (never another student's row) the moment the ownership
 * filter doesn't match, well before any signature/document detail is
 * read.
 */

function logDbError(context: string, error: unknown) {
  console.error(`[agreements/my-agreements] ${context}:`, error);
}

export interface MyAgreementSummary {
  id: string;
  agreementType: string;
  status: AgreementStatus;
  signatureStatus: SignatureStatus;
  /** Milestone 11-A (F-123). Null = electronic stamping is not configured for this agreement — see agreements.stamp_sign_sequence's own comment. */
  stampSignSequence: StampSignSequence | null;
  stampStatus: StampStatus;
  effectiveDate: string | null;
  updatedAt: string;
}

interface AgreementRow {
  id: string;
  agreement_type: string;
  status: string;
  signature_status: string;
  stamp_sign_sequence: string | null;
  stamp_status: string;
  effective_date: string | null;
  updated_at: string;
}

const SUMMARY_COLUMNS = "id, agreement_type, status, signature_status, stamp_sign_sequence, stamp_status, effective_date, updated_at";

/** Every agreement belonging to the signed-in student, newest first. */
export async function listMyAgreements(): Promise<MyAgreementSummary[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("agreements")
    .select(SUMMARY_COLUMNS)
    .eq("student_user_id", user.id)
    .order("updated_at", { ascending: false });
  if (error) {
    logDbError("listMyAgreements", error);
    return [];
  }
  return ((data ?? []) as AgreementRow[]).map((row) => ({
    id: row.id,
    agreementType: row.agreement_type,
    status: row.status as AgreementStatus,
    signatureStatus: row.signature_status as SignatureStatus,
    stampSignSequence: row.stamp_sign_sequence as StampSignSequence | null,
    stampStatus: row.stamp_status as StampStatus,
    effectiveDate: row.effective_date,
    updatedAt: row.updated_at,
  }));
}

export interface MyAgreementDetail extends MyAgreementSummary {
  latestSignatureRequest: SignatureRequest | null;
  latestStampRequest: StampRequest | null;
}

interface SignatureRequestRow {
  id: string;
  agreement_id: string;
  agreement_version_id: string;
  provider: string;
  provider_request_id: string | null;
  status: string;
  signer_user_id: string | null;
  signer_name: string;
  signer_email: string;
  requested_at: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  signed_at: string | null;
  declined_at: string | null;
  cancelled_at: string | null;
  expired_at: string | null;
  signed_document_storage_path: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface StampRequestRow {
  id: string;
  agreement_id: string;
  agreement_version_id: string;
  provider: string;
  provider_request_id: string | null;
  status: string;
  jurisdiction: string | null;
  state: string | null;
  document_type: string | null;
  stamp_value: number | null;
  currency: string;
  requested_at: string | null;
  processing_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  cancelled_at: string | null;
  expired_at: string | null;
  stamped_document_storage_path: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * One agreement's detail, strictly scoped to the signed-in student's own
 * agreement — `.eq("student_user_id", user.id)` is an explicit,
 * server-side ownership check in ADDITION to agreements' own RLS policy
 * (see this file's header comment). Returns null for any id that is not
 * both a real agreement AND owned by the caller — a student can never
 * distinguish "does not exist" from "exists but is not mine" by response
 * shape, which is the correct behavior for preventing enumeration.
 */
export async function getMyAgreementById(agreementId: string): Promise<MyAgreementDetail | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("agreements")
    .select(SUMMARY_COLUMNS)
    .eq("id", agreementId)
    .eq("student_user_id", user.id)
    .maybeSingle();
  if (error) {
    logDbError("getMyAgreementById", error);
    return null;
  }
  if (!data) return null;
  const row = data as AgreementRow;

  const { data: requestRows, error: requestError } = await supabase
    .from("signature_requests")
    .select(
      "id, agreement_id, agreement_version_id, provider, provider_request_id, status, signer_user_id, signer_name, signer_email, requested_at, sent_at, viewed_at, signed_at, declined_at, cancelled_at, expired_at, signed_document_storage_path, created_by, created_at, updated_at"
    )
    .eq("agreement_id", agreementId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (requestError) logDbError("getMyAgreementById:requests", requestError);

  const requestRow = ((requestRows ?? []) as SignatureRequestRow[])[0] ?? null;

  const { data: stampRows, error: stampError } = await supabase
    .from("stamp_requests")
    .select(
      "id, agreement_id, agreement_version_id, provider, provider_request_id, status, jurisdiction, state, document_type, stamp_value, currency, requested_at, processing_at, completed_at, failed_at, cancelled_at, expired_at, stamped_document_storage_path, created_by, created_at, updated_at"
    )
    .eq("agreement_id", agreementId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (stampError) logDbError("getMyAgreementById:stampRequests", stampError);

  const stampRow = ((stampRows ?? []) as StampRequestRow[])[0] ?? null;

  return {
    id: row.id,
    agreementType: row.agreement_type,
    status: row.status as AgreementStatus,
    signatureStatus: row.signature_status as SignatureStatus,
    stampSignSequence: row.stamp_sign_sequence as StampSignSequence | null,
    stampStatus: row.stamp_status as StampStatus,
    effectiveDate: row.effective_date,
    updatedAt: row.updated_at,
    latestStampRequest: stampRow
      ? {
          id: stampRow.id,
          agreementId: stampRow.agreement_id,
          agreementVersionId: stampRow.agreement_version_id,
          provider: stampRow.provider,
          providerRequestId: stampRow.provider_request_id,
          status: stampRow.status as StampRequestStatus,
          jurisdiction: stampRow.jurisdiction,
          state: stampRow.state,
          documentType: stampRow.document_type,
          stampValue: stampRow.stamp_value,
          currency: stampRow.currency,
          requestedAt: stampRow.requested_at,
          processingAt: stampRow.processing_at,
          completedAt: stampRow.completed_at,
          failedAt: stampRow.failed_at,
          cancelledAt: stampRow.cancelled_at,
          expiredAt: stampRow.expired_at,
          hasStampedDocument: !!stampRow.stamped_document_storage_path,
          createdBy: stampRow.created_by,
          createdAt: stampRow.created_at,
          updatedAt: stampRow.updated_at,
        }
      : null,
    latestSignatureRequest: requestRow
      ? {
          id: requestRow.id,
          agreementId: requestRow.agreement_id,
          agreementVersionId: requestRow.agreement_version_id,
          provider: requestRow.provider,
          providerRequestId: requestRow.provider_request_id,
          status: requestRow.status as SignatureRequestStatus,
          signerUserId: requestRow.signer_user_id,
          signerName: requestRow.signer_name,
          signerEmail: requestRow.signer_email,
          requestedAt: requestRow.requested_at,
          sentAt: requestRow.sent_at,
          viewedAt: requestRow.viewed_at,
          signedAt: requestRow.signed_at,
          declinedAt: requestRow.declined_at,
          cancelledAt: requestRow.cancelled_at,
          expiredAt: requestRow.expired_at,
          hasSignedDocument: !!requestRow.signed_document_storage_path,
          createdBy: requestRow.created_by,
          createdAt: requestRow.created_at,
          updatedAt: requestRow.updated_at,
        }
      : null,
  };
}

/**
 * Student "Download signed agreement" — returns a short-lived signed URL
 * for the LATEST signature request's document, or null if not
 * available/not owned by the caller. Re-verifies ownership independently
 * (never trusts an id alone): re-derives the agreement from the
 * signature_requests row itself and checks student_user_id === user.id
 * before ever calling into Storage.
 */
export async function getMySignedDocumentUrl(agreementId: string): Promise<string | null> {
  const detail = await getMyAgreementById(agreementId);
  if (!detail?.latestSignatureRequest?.hasSignedDocument) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("signature_requests")
    .select("signed_document_storage_path")
    .eq("id", detail.latestSignatureRequest.id)
    .maybeSingle();
  if (error || !data?.signed_document_storage_path) return null;
  return createSignedDownloadUrl(data.signed_document_storage_path);
}

/**
 * Student "Download stamped agreement" — mirrors getMySignedDocumentUrl()
 * exactly, for the stamped-document equivalent (Milestone 11-A, F-123).
 * Re-verifies ownership independently via getMyAgreementById() before ever
 * calling into Storage.
 */
export async function getMyStampedDocumentUrl(agreementId: string): Promise<string | null> {
  const detail = await getMyAgreementById(agreementId);
  if (!detail?.latestStampRequest?.hasStampedDocument) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stamp_requests")
    .select("stamped_document_storage_path")
    .eq("id", detail.latestStampRequest.id)
    .maybeSingle();
  if (error || !data?.stamped_document_storage_path) return null;
  return createStampedDownloadUrl(data.stamped_document_storage_path);
}
