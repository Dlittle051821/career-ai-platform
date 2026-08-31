/**
 * Milestone 10 — domain types for Electronic Signature Integration
 * (F-122). Mirrors the convention established in src/types/payments.ts:
 * these are the camelCase app-level shapes; the snake_case <-> camelCase
 * mapping lives only in src/lib/supabase/admin/signatures.ts and
 * src/lib/supabase/agreements/my-agreements.ts.
 */

// ---------------------------------------------------------------------------
// Agreement versions
// ---------------------------------------------------------------------------

export const AGREEMENT_VERSION_STATUSES = ["draft", "locked", "superseded"] as const;
export type AgreementVersionStatus = (typeof AGREEMENT_VERSION_STATUSES)[number];

export const AGREEMENT_VERSION_STATUS_LABELS: Record<AgreementVersionStatus, string> = {
  draft: "Draft",
  locked: "Locked",
  superseded: "Superseded",
};

export interface AgreementVersion {
  id: string;
  agreementId: string;
  versionNumber: number;
  contentReferenceUrl: string | null;
  contentNotes: string | null;
  status: AgreementVersionStatus;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Signature requests
// ---------------------------------------------------------------------------

export const SIGNATURE_REQUEST_STATUSES = ["draft", "pending", "sent", "viewed", "signed", "declined", "cancelled", "expired", "failed"] as const;
export type SignatureRequestStatus = (typeof SIGNATURE_REQUEST_STATUSES)[number];

export const SIGNATURE_REQUEST_STATUS_LABELS: Record<SignatureRequestStatus, string> = {
  draft: "Draft",
  pending: "Pending",
  sent: "Sent",
  viewed: "Viewed",
  signed: "Signed",
  declined: "Declined",
  cancelled: "Cancelled",
  expired: "Expired",
  failed: "Failed",
};

/** Statuses that are NOT terminal — a resend/cancel action is only ever valid against one of these. Mirrors signature_requests_one_active_per_version's own partial-index definition in 0011_electronic_signature.sql. */
export const NON_TERMINAL_SIGNATURE_REQUEST_STATUSES: SignatureRequestStatus[] = ["draft", "pending", "sent", "viewed"];

/** Statuses only ever reachable through the verified webhook path (public.apply_signature_webhook_event) — no admin action in this application sets any of these directly. */
export const WEBHOOK_ONLY_SIGNATURE_REQUEST_STATUSES: SignatureRequestStatus[] = ["viewed", "signed", "declined", "expired", "failed"];

export interface SignatureRequest {
  id: string;
  agreementId: string;
  agreementVersionId: string;
  provider: string;
  providerRequestId: string | null;
  status: SignatureRequestStatus;
  signerUserId: string | null;
  signerName: string;
  signerEmail: string;
  requestedAt: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  signedAt: string | null;
  declinedAt: string | null;
  cancelledAt: string | null;
  expiredAt: string | null;
  hasSignedDocument: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}
