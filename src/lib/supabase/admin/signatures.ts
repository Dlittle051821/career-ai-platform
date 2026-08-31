import "server-only";
import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { recordAuditLog } from "./audit";
import { trackEvent } from "../analytics/track";
import { createSignedDownloadUrl } from "@/lib/storage/signed-documents";
import { getSignatureProvider } from "@/lib/signatures/get-provider";
import { getNotifier } from "@/lib/notifications/get-notifier";
import { validateSendForSignature, validateResendSignatureRequest, validateCancelSignatureRequest } from "@/lib/signatures/rules";
import { AdminValidationError } from "@/lib/admin/form-state";
import { NON_TERMINAL_SIGNATURE_REQUEST_STATUSES, type AgreementVersion, type AgreementVersionStatus, type SignatureRequest, type SignatureRequestStatus } from "@/types/signatures";
import type { AgreementStatus, SignatureStatus } from "@/types/admin";

/**
 * Milestone 10 (F-122) — the I/O layer for agreement versions and
 * signature requests. Pure rules (src/lib/signatures/rules.ts) decide
 * whether an action is allowed; this file is what actually talks to
 * Supabase, the provider adapter, the notifier, analytics, and the audit
 * log — same "pure src/lib/<domain> vs I/O src/lib/supabase/<domain>"
 * split as every other module in this codebase.
 */

function logDbError(context: string, error: unknown) {
  console.error(`[admin/signatures] ${context}:`, error);
}

interface AgreementVersionRow {
  id: string;
  agreement_id: string;
  version_number: number;
  content_reference_url: string | null;
  content_notes: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function toAgreementVersion(row: AgreementVersionRow): AgreementVersion {
  return {
    id: row.id,
    agreementId: row.agreement_id,
    versionNumber: row.version_number,
    contentReferenceUrl: row.content_reference_url,
    contentNotes: row.content_notes,
    status: row.status as AgreementVersionStatus,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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

function toSignatureRequest(row: SignatureRequestRow): SignatureRequest {
  return {
    id: row.id,
    agreementId: row.agreement_id,
    agreementVersionId: row.agreement_version_id,
    provider: row.provider,
    providerRequestId: row.provider_request_id,
    status: row.status as SignatureRequestStatus,
    signerUserId: row.signer_user_id,
    signerName: row.signer_name,
    signerEmail: row.signer_email,
    requestedAt: row.requested_at,
    sentAt: row.sent_at,
    viewedAt: row.viewed_at,
    signedAt: row.signed_at,
    declinedAt: row.declined_at,
    cancelledAt: row.cancelled_at,
    expiredAt: row.expired_at,
    hasSignedDocument: !!row.signed_document_storage_path,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const VERSION_COLUMNS = "id, agreement_id, version_number, content_reference_url, content_notes, status, created_by, created_at, updated_at";
const REQUEST_COLUMNS =
  "id, agreement_id, agreement_version_id, provider, provider_request_id, status, signer_user_id, signer_name, signer_email, requested_at, sent_at, viewed_at, signed_at, declined_at, cancelled_at, expired_at, signed_document_storage_path, created_by, created_at, updated_at";

export async function listAgreementVersions(agreementId: string): Promise<AgreementVersion[]> {
  await requireAdminPermission("agreements:read");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agreement_versions")
    .select(VERSION_COLUMNS)
    .eq("agreement_id", agreementId)
    .order("version_number", { ascending: false });
  if (error) {
    logDbError("listAgreementVersions", error);
    return [];
  }
  return ((data ?? []) as AgreementVersionRow[]).map(toAgreementVersion);
}

export async function listSignatureRequests(agreementId: string): Promise<SignatureRequest[]> {
  await requireAdminPermission("agreements:read");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("signature_requests")
    .select(REQUEST_COLUMNS)
    .eq("agreement_id", agreementId)
    .order("created_at", { ascending: false });
  if (error) {
    logDbError("listSignatureRequests", error);
    return [];
  }
  return ((data ?? []) as SignatureRequestRow[]).map(toSignatureRequest);
}

/** Creates a new draft agreement version (version_number = current max + 1). Never touches any existing version row. */
export async function createAgreementVersion(agreementId: string, formData: FormData): Promise<string> {
  const admin = await requireAdminPermission("agreements:write");
  const contentReferenceUrl = String(formData.get("contentReferenceUrl") ?? "").trim();
  if (contentReferenceUrl && !/^https?:\/\//i.test(contentReferenceUrl)) {
    throw new AdminValidationError("Document reference URL must start with http:// or https://.");
  }
  const contentNotes = String(formData.get("contentNotes") ?? "").trim() || null;

  const supabase = await createClient();
  const { data: existing, error: existingError } = await supabase
    .from("agreement_versions")
    .select("version_number")
    .eq("agreement_id", agreementId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) {
    logDbError("createAgreementVersion:lookup", existingError);
    throw new Error(existingError.message);
  }
  const nextVersionNumber = (existing?.version_number ?? 0) + 1;

  const { data, error } = await supabase
    .from("agreement_versions")
    .insert({
      agreement_id: agreementId,
      version_number: nextVersionNumber,
      content_reference_url: contentReferenceUrl || null,
      content_notes: contentNotes,
      status: "draft",
      created_by: admin.userId,
    })
    .select("id")
    .single();
  if (error) {
    logDbError("createAgreementVersion", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "AGREEMENT_VERSION_CREATED",
    entityType: "agreement_version",
    entityId: data.id,
    entityLabel: `agreement version #${nextVersionNumber}`,
    context: { agreementId, versionNumber: nextVersionNumber },
  });

  return data.id;
}

interface SendForSignatureFields {
  agreementVersionId: string;
  signerName: string;
  signerEmail: string;
}

function parseSendForSignatureForm(formData: FormData): SendForSignatureFields {
  return {
    agreementVersionId: String(formData.get("agreementVersionId") ?? "").trim(),
    signerName: String(formData.get("signerName") ?? "").trim(),
    signerEmail: String(formData.get("signerEmail") ?? "").trim(),
  };
}

/**
 * "Send for Signature" — validates every §5 precondition, atomically locks
 * the chosen draft version and creates the (status='pending')
 * signature_requests row via public.create_signature_request() (see
 * 0011_electronic_signature.sql PART 2.1 for why this needs to be
 * atomic), then calls the provider adapter and records its response in a
 * single follow-up UPDATE. If the provider call itself fails, the DB rows
 * already created are left exactly as they are (status='pending', no
 * provider_request_id) — a genuinely failed send is visible to an admin
 * as a stuck 'pending' request, never silently lost, and can be retried by
 * cancelling it and creating a fresh one.
 */
export async function sendForSignature(agreementId: string, formData: FormData): Promise<string> {
  const admin = await requireAdminPermission("agreements:write");
  const fields = parseSendForSignatureForm(formData);
  const supabase = await createClient();

  const { data: agreement, error: agreementError } = await supabase
    .from("agreements")
    .select("id, agreement_type, status, signature_status")
    .eq("id", agreementId)
    .maybeSingle();
  if (agreementError) {
    logDbError("sendForSignature:agreement", agreementError);
    throw new Error(agreementError.message);
  }

  let version: { id: string; status: string } | null = null;
  if (fields.agreementVersionId) {
    const { data: versionRow, error: versionError } = await supabase
      .from("agreement_versions")
      .select("id, status")
      .eq("id", fields.agreementVersionId)
      .eq("agreement_id", agreementId)
      .maybeSingle();
    if (versionError) {
      logDbError("sendForSignature:version", versionError);
      throw new Error(versionError.message);
    }
    version = versionRow;
  }

  let hasActiveRequestForVersion = false;
  if (version) {
    const { count } = await supabase
      .from("signature_requests")
      .select("id", { count: "exact", head: true })
      .eq("agreement_version_id", version.id)
      .in("status", NON_TERMINAL_SIGNATURE_REQUEST_STATUSES);
    hasActiveRequestForVersion = (count ?? 0) > 0;
  }

  const check = validateSendForSignature({
    hasPermission: true, // already enforced by requireAdminPermission above
    agreementExists: !!agreement,
    agreementStatus: agreement ? (agreement.status as AgreementStatus) : null,
    agreementSignatureStatus: agreement ? (agreement.signature_status as SignatureStatus) : null,
    version: version ? { status: version.status as AgreementVersionStatus } : null,
    signerName: fields.signerName,
    signerEmail: fields.signerEmail,
    hasActiveRequestForVersion,
  });
  if (!check.ok) throw new AdminValidationError(check.reason);

  const { data: createdRequest, error: createError } = await supabase.rpc("create_signature_request", {
    p_agreement_version_id: fields.agreementVersionId,
    p_signer_name: fields.signerName,
    p_signer_email: fields.signerEmail,
    p_provider: getSignatureProvider().providerName,
  });
  if (createError || !createdRequest) {
    logDbError("sendForSignature:create_signature_request", createError);
    throw new Error(createError?.message ?? "Could not create the signature request.");
  }
  const requestRow = createdRequest as unknown as SignatureRequestRow;

  await recordAuditLog({
    action: "SIGNATURE_REQUEST_CREATED",
    entityType: "signature_request",
    entityId: requestRow.id,
    entityLabel: `signature request for ${agreement?.agreement_type ?? "agreement"}`,
    context: { agreementId, agreementVersionId: fields.agreementVersionId, signerEmail: fields.signerEmail },
  });

  try {
    const provider = getSignatureProvider();
    const result = await provider.createSignatureRequest({
      agreementId,
      agreementVersionId: fields.agreementVersionId,
      signerName: fields.signerName,
      signerEmail: fields.signerEmail,
      documentTitle: agreement?.agreement_type ?? "Agreement",
    });

    const { error: updateError } = await supabase
      .from("signature_requests")
      .update({ provider_request_id: result.providerRequestId, status: result.status, sent_at: result.status === "sent" ? new Date().toISOString() : null })
      .eq("id", requestRow.id);
    if (updateError) logDbError("sendForSignature:update-after-provider", updateError);

    if (result.status === "sent") {
      await recordAuditLog({
        action: "SIGNATURE_REQUEST_SENT",
        entityType: "signature_request",
        entityId: requestRow.id,
        entityLabel: `signature request for ${agreement?.agreement_type ?? "agreement"}`,
        context: { agreementId, provider: provider.providerName, providerRequestId: result.providerRequestId },
      });
      void trackEvent({ eventName: "agreement_signature_requested", entityType: "agreement", entityId: agreementId, source: "admin" });
      void getNotifier().notify({
        to: fields.signerEmail,
        template: "signature_requested",
        data: { agreementType: agreement?.agreement_type ?? "Agreement", signerName: fields.signerName },
      });
    }
  } catch (providerError) {
    // The DB rows already exist as status='pending' — a genuinely failed
    // provider call is visible to an admin as a stuck request (see this
    // function's own docblock), never silently lost or double-created.
    logDbError("sendForSignature:provider", providerError);
    throw new Error("The signature request was created, but the provider could not be reached. It is saved as pending — try resending, or cancel and send again.");
  }

  return requestRow.id;
}

async function loadRequestForAction(supabase: Awaited<ReturnType<typeof createClient>>, requestId: string) {
  const { data, error } = await supabase.from("signature_requests").select(REQUEST_COLUMNS).eq("id", requestId).maybeSingle();
  if (error) {
    logDbError("loadRequestForAction", error);
    throw new Error(error.message);
  }
  return data as SignatureRequestRow | null;
}

export async function resendSignatureRequestAction(requestId: string): Promise<void> {
  await requireAdminPermission("agreements:write");
  const supabase = await createClient();
  const row = await loadRequestForAction(supabase, requestId);

  const check = validateResendSignatureRequest({ hasPermission: true, requestExists: !!row, status: (row?.status as SignatureRequestStatus) ?? null });
  if (!check.ok) throw new AdminValidationError(check.reason);
  if (!row?.provider_request_id) throw new AdminValidationError("This signature request has no provider reference yet.");

  await getSignatureProvider().resendSignatureRequest(row.provider_request_id);

  await recordAuditLog({
    action: "SIGNATURE_REQUEST_RESENT",
    entityType: "signature_request",
    entityId: requestId,
    entityLabel: "signature request",
    context: { agreementId: row.agreement_id, provider: row.provider, providerRequestId: row.provider_request_id },
  });
  void getNotifier().notify({ to: row.signer_email, template: "signature_reminder", data: { signerName: row.signer_name } });
}

export async function cancelSignatureRequestAction(requestId: string): Promise<void> {
  await requireAdminPermission("agreements:write");
  const supabase = await createClient();
  const row = await loadRequestForAction(supabase, requestId);

  const check = validateCancelSignatureRequest({ hasPermission: true, requestExists: !!row, status: (row?.status as SignatureRequestStatus) ?? null });
  if (!check.ok) throw new AdminValidationError(check.reason);
  if (!row) return;

  if (row.provider_request_id) {
    try {
      await getSignatureProvider().cancelSignatureRequest(row.provider_request_id);
    } catch (error) {
      // Log and continue — this application's OWN record of the request
      // must still move to cancelled even if the provider-side cancel
      // call itself fails (e.g. the provider considers it already
      // terminal); we never leave our own row stuck because of that.
      logDbError("cancelSignatureRequestAction:provider", error);
    }
  }

  const { error } = await supabase.from("signature_requests").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", requestId);
  if (error) {
    logDbError("cancelSignatureRequestAction:update", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "SIGNATURE_REQUEST_CANCELLED",
    entityType: "signature_request",
    entityId: requestId,
    entityLabel: "signature request",
    context: { agreementId: row.agreement_id },
  });
  void trackEvent({ eventName: "agreement_signature_cancelled", entityType: "agreement", entityId: row.agreement_id, source: "admin" });
}

/** Admin "View signed agreement" — returns a short-lived signed URL, or null if not yet available. */
export async function getAdminSignedDocumentUrl(requestId: string): Promise<string | null> {
  await requireAdminPermission("agreements:read");
  const supabase = await createClient();
  const { data, error } = await supabase.from("signature_requests").select("signed_document_storage_path").eq("id", requestId).maybeSingle();
  if (error || !data?.signed_document_storage_path) return null;
  return createSignedDownloadUrl(data.signed_document_storage_path);
}

/** Convenience wrapper for the agreement detail page's "View signed agreement" link — resolves the agreement's most recent signature request, then its signed document URL, if any. */
export async function getAdminSignedDocumentUrlForAgreement(agreementId: string): Promise<string | null> {
  await requireAdminPermission("agreements:read");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("signature_requests")
    .select("id, signed_document_storage_path")
    .eq("agreement_id", agreementId)
    .not("signed_document_storage_path", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data?.signed_document_storage_path) return null;
  return createSignedDownloadUrl(data.signed_document_storage_path);
}
