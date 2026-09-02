import "server-only";
import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { recordAuditLog } from "./audit";
import { trackEvent } from "../analytics/track";
import { createStampedDownloadUrl } from "@/lib/storage/stamped-documents";
import { getStampProvider } from "@/lib/stamping/get-provider";
import { validateRequestStamp, validateRetryStampRequest, validateCancelStampRequest } from "@/lib/stamping/rules";
import { AdminValidationError } from "@/lib/admin/form-state";
import { NON_TERMINAL_STAMP_REQUEST_STATUSES, type StampRequest, type StampRequestStatus, type StampSignSequence } from "@/types/stamping";
import type { AgreementStatus } from "@/types/admin";
import type { AgreementVersionStatus } from "@/types/signatures";

/**
 * Note: the stamp+sign sequence itself (agreements.stamp_sign_sequence) is
 * edited through the SAME base agreement form/action as every other
 * agreement field (AgreementForm.tsx -> updateAgreementAction ->
 * src/lib/supabase/admin/agreements.ts) rather than a separate function
 * here — it is agreement CONFIGURATION, not a stamping WORKFLOW action, so
 * it belongs with status/effectiveDate/etc., not alongside requestStamp/
 * retryStampRequest/cancelStampRequestAction below.
 */

/**
 * Milestone 11-A (F-123) — the I/O layer for stamp requests. Mirrors
 * src/lib/supabase/admin/signatures.ts exactly: pure rules
 * (src/lib/stamping/rules.ts) decide whether an action is allowed; this
 * file is what actually talks to Supabase, the provider adapter,
 * analytics, and the audit log.
 */

function logDbError(context: string, error: unknown) {
  console.error(`[admin/stamping] ${context}:`, error);
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

function toStampRequest(row: StampRequestRow): StampRequest {
  return {
    id: row.id,
    agreementId: row.agreement_id,
    agreementVersionId: row.agreement_version_id,
    provider: row.provider,
    providerRequestId: row.provider_request_id,
    status: row.status as StampRequestStatus,
    jurisdiction: row.jurisdiction,
    state: row.state,
    documentType: row.document_type,
    stampValue: row.stamp_value,
    currency: row.currency,
    requestedAt: row.requested_at,
    processingAt: row.processing_at,
    completedAt: row.completed_at,
    failedAt: row.failed_at,
    cancelledAt: row.cancelled_at,
    expiredAt: row.expired_at,
    hasStampedDocument: !!row.stamped_document_storage_path,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const REQUEST_COLUMNS =
  "id, agreement_id, agreement_version_id, provider, provider_request_id, status, jurisdiction, state, document_type, stamp_value, currency, requested_at, processing_at, completed_at, failed_at, cancelled_at, expired_at, stamped_document_storage_path, created_by, created_at, updated_at";

export async function listStampRequests(agreementId: string): Promise<StampRequest[]> {
  await requireAdminPermission("agreements:read");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stamp_requests")
    .select(REQUEST_COLUMNS)
    .eq("agreement_id", agreementId)
    .order("created_at", { ascending: false });
  if (error) {
    logDbError("listStampRequests", error);
    return [];
  }
  return ((data ?? []) as StampRequestRow[]).map(toStampRequest);
}

interface RequestStampFields {
  agreementVersionId: string;
  jurisdiction: string;
  state: string;
  documentType: string;
}

function parseRequestStampForm(formData: FormData): RequestStampFields {
  return {
    agreementVersionId: String(formData.get("agreementVersionId") ?? "").trim(),
    jurisdiction: String(formData.get("jurisdiction") ?? "").trim(),
    state: String(formData.get("state") ?? "").trim(),
    documentType: String(formData.get("documentType") ?? "").trim(),
  };
}

/**
 * "Request E-Stamp" — validates every precondition (spec §3/§5/§6),
 * atomically locks the chosen version and creates the (status='pending')
 * stamp_requests row via public.create_stamp_request(), then calls the
 * provider adapter and records its response in a single follow-up UPDATE.
 * Same failure-handling posture as sendForSignature(): if the provider
 * call itself fails, the DB row is left exactly as 'pending' — visible to
 * an admin, never silently lost, retryable via "Retry".
 */
export async function requestStamp(agreementId: string, formData: FormData): Promise<string> {
  const admin = await requireAdminPermission("agreements:write");
  const fields = parseRequestStampForm(formData);
  const supabase = await createClient();

  const { data: agreement, error: agreementError } = await supabase
    .from("agreements")
    .select("id, agreement_type, status, stamp_sign_sequence, signature_status")
    .eq("id", agreementId)
    .maybeSingle();
  if (agreementError) {
    logDbError("requestStamp:agreement", agreementError);
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
      logDbError("requestStamp:version", versionError);
      throw new Error(versionError.message);
    }
    version = versionRow;
  }

  let hasActiveRequestForVersion = false;
  if (version) {
    const { count } = await supabase
      .from("stamp_requests")
      .select("id", { count: "exact", head: true })
      .eq("agreement_version_id", version.id)
      .in("status", NON_TERMINAL_STAMP_REQUEST_STATUSES);
    hasActiveRequestForVersion = (count ?? 0) > 0;
  }

  const sequence = (agreement?.stamp_sign_sequence as StampSignSequence | null) ?? null;
  const signatureRequiredFirstButMissing = sequence === "SIGN_THEN_STAMP" && agreement?.signature_status !== "signed";

  const check = validateRequestStamp({
    hasPermission: true, // already enforced by requireAdminPermission above
    agreementExists: !!agreement,
    agreementStatus: agreement ? (agreement.status as AgreementStatus) : null,
    sequence,
    signatureRequiredFirstButMissing,
    version: version ? { status: version.status as AgreementVersionStatus } : null,
    hasActiveRequestForVersion,
  });
  if (!check.ok) throw new AdminValidationError(check.reason);

  const { data: createdRequest, error: createError } = await supabase.rpc("create_stamp_request", {
    p_agreement_version_id: fields.agreementVersionId,
    p_jurisdiction: fields.jurisdiction || null,
    p_state: fields.state || null,
    p_document_type: fields.documentType || null,
    p_provider: getStampProvider().providerName,
  });
  if (createError || !createdRequest) {
    logDbError("requestStamp:create_stamp_request", createError);
    throw new Error(createError?.message ?? "Could not create the stamp request.");
  }
  const requestRow = createdRequest as unknown as StampRequestRow;

  await recordAuditLog({
    action: "STAMP_REQUEST_CREATED",
    entityType: "stamp_request",
    entityId: requestRow.id,
    entityLabel: `stamp request for ${agreement?.agreement_type ?? "agreement"}`,
    context: { agreementId, agreementVersionId: fields.agreementVersionId, jurisdiction: fields.jurisdiction || null, state: fields.state || null, requestedBy: admin.userId },
  });

  try {
    const provider = getStampProvider();
    const result = await provider.createStampRequest({
      agreementId,
      agreementVersionId: fields.agreementVersionId,
      documentTitle: agreement?.agreement_type ?? "Agreement",
      jurisdiction: fields.jurisdiction || null,
      state: fields.state || null,
      documentType: fields.documentType || null,
    });

    const { error: updateError } = await supabase
      .from("stamp_requests")
      .update({
        provider_request_id: result.providerRequestId,
        status: result.status,
        stamp_value: result.stampValue,
        currency: result.currency ?? "INR",
        processing_at: result.status === "processing" ? new Date().toISOString() : null,
      })
      .eq("id", requestRow.id);
    if (updateError) logDbError("requestStamp:update-after-provider", updateError);

    await recordAuditLog({
      action: "STAMP_REQUEST_SENT",
      entityType: "stamp_request",
      entityId: requestRow.id,
      entityLabel: `stamp request for ${agreement?.agreement_type ?? "agreement"}`,
      context: { agreementId, provider: provider.providerName, providerRequestId: result.providerRequestId },
    });
    void trackEvent({ eventName: "agreement_stamp_requested", entityType: "agreement", entityId: agreementId, source: "admin" });
  } catch (providerError) {
    logDbError("requestStamp:provider", providerError);
    throw new Error("The stamp request was created, but the provider could not be reached. It is saved as pending — try retrying from the agreement page.");
  }

  return requestRow.id;
}

async function loadRequestForAction(supabase: Awaited<ReturnType<typeof createClient>>, requestId: string) {
  const { data, error } = await supabase.from("stamp_requests").select(REQUEST_COLUMNS).eq("id", requestId).maybeSingle();
  if (error) {
    logDbError("loadRequestForAction", error);
    throw new Error(error.message);
  }
  return data as StampRequestRow | null;
}

/**
 * "Retry" — a genuinely NEW stamp request against the same version (spec
 * §32 "STAMP_REQUEST_RETRIED"), only valid after the prior one reached a
 * terminal, non-completed state. Never mutates the old (failed/cancelled/
 * expired) row — that stays as historical record; a fresh row is created.
 */
export async function retryStampRequest(agreementId: string, requestId: string): Promise<string> {
  const admin = await requireAdminPermission("agreements:write");
  const supabase = await createClient();
  const row = await loadRequestForAction(supabase, requestId);

  let hasActiveRequestForVersion = false;
  if (row) {
    const { count } = await supabase
      .from("stamp_requests")
      .select("id", { count: "exact", head: true })
      .eq("agreement_version_id", row.agreement_version_id)
      .in("status", NON_TERMINAL_STAMP_REQUEST_STATUSES);
    hasActiveRequestForVersion = (count ?? 0) > 0;
  }

  const check = validateRetryStampRequest({ hasPermission: true, requestExists: !!row, status: (row?.status as StampRequestStatus) ?? null, hasActiveRequestForVersion });
  if (!check.ok) throw new AdminValidationError(check.reason);
  if (!row) throw new AdminValidationError("Stamp request not found.");

  await recordAuditLog({
    action: "STAMP_REQUEST_RETRIED",
    entityType: "stamp_request",
    entityId: requestId,
    entityLabel: "stamp request",
    context: { agreementId, agreementVersionId: row.agreement_version_id, previousStatus: row.status, retriedBy: admin.userId },
  });

  const form = new FormData();
  form.set("agreementVersionId", row.agreement_version_id);
  if (row.jurisdiction) form.set("jurisdiction", row.jurisdiction);
  if (row.state) form.set("state", row.state);
  if (row.document_type) form.set("documentType", row.document_type);
  return requestStamp(agreementId, form);
}

export async function cancelStampRequestAction(agreementId: string, requestId: string): Promise<void> {
  await requireAdminPermission("agreements:write");
  const supabase = await createClient();
  const row = await loadRequestForAction(supabase, requestId);

  const check = validateCancelStampRequest({ hasPermission: true, requestExists: !!row, status: (row?.status as StampRequestStatus) ?? null });
  if (!check.ok) throw new AdminValidationError(check.reason);
  if (!row) return;

  if (row.provider_request_id) {
    try {
      await getStampProvider().cancelStampRequest(row.provider_request_id);
    } catch (error) {
      // Log and continue — this application's OWN record must still move
      // to cancelled even if the provider-side cancel call itself fails,
      // same discipline as cancelSignatureRequestAction().
      logDbError("cancelStampRequestAction:provider", error);
    }
  }

  const { error } = await supabase.from("stamp_requests").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", requestId);
  if (error) {
    logDbError("cancelStampRequestAction:update", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "STAMP_REQUEST_CANCELLED",
    entityType: "stamp_request",
    entityId: requestId,
    entityLabel: "stamp request",
    context: { agreementId },
  });
  void trackEvent({ eventName: "agreement_stamp_cancelled", entityType: "agreement", entityId: agreementId, source: "admin" });
}

/** Admin "View stamped agreement" — returns a short-lived signed URL, or null if not yet available. */
export async function getAdminStampedDocumentUrl(requestId: string): Promise<string | null> {
  await requireAdminPermission("agreements:read");
  const supabase = await createClient();
  const { data, error } = await supabase.from("stamp_requests").select("stamped_document_storage_path").eq("id", requestId).maybeSingle();
  if (error || !data?.stamped_document_storage_path) return null;
  return createStampedDownloadUrl(data.stamped_document_storage_path);
}

/** Convenience wrapper for the agreement detail page's "View stamped agreement" link — resolves the agreement's most recent stamp request, then its stamped document URL, if any. */
export async function getAdminStampedDocumentUrlForAgreement(agreementId: string): Promise<string | null> {
  await requireAdminPermission("agreements:read");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stamp_requests")
    .select("id, stamped_document_storage_path")
    .eq("agreement_id", agreementId)
    .not("stamped_document_storage_path", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data?.stamped_document_storage_path) return null;
  return createStampedDownloadUrl(data.stamped_document_storage_path);
}
