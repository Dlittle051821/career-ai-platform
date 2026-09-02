/**
 * Milestone 11-A (F-123) — domain types for Electronic Stamping. Mirrors
 * src/types/signatures.ts's convention exactly: camelCase app-level shapes,
 * snake_case <-> camelCase mapping lives only in
 * src/lib/supabase/admin/stamping.ts.
 *
 * "Stamping" here means electronic stamp duty / e-stamping of a legal
 * document (a jurisdiction-specific requirement in several countries,
 * including India) — a DIFFERENT concept from Milestone 10's electronic
 * SIGNATURE. A document can be stamped, signed, both (in either order), or
 * neither, depending on what agreement_stamp_sign_sequence (see
 * 0012_electronic_stamping_and_assisted_onboarding.sql PART 1) says is
 * configured for a given agreement — this application never assumes or
 * asserts a universal legal ordering (spec §5).
 */

// ---------------------------------------------------------------------------
// Stamp requests
// ---------------------------------------------------------------------------

export const STAMP_REQUEST_STATUSES = ["draft", "pending", "processing", "completed", "failed", "cancelled", "expired"] as const;
export type StampRequestStatus = (typeof STAMP_REQUEST_STATUSES)[number];

export const STAMP_REQUEST_STATUS_LABELS: Record<StampRequestStatus, string> = {
  draft: "Draft",
  pending: "Pending",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
  expired: "Expired",
};

/** Statuses that are NOT terminal — retry/cancel is only ever valid against one of these. Mirrors stamp_requests_one_active_per_version's own partial-index definition. */
export const NON_TERMINAL_STAMP_REQUEST_STATUSES: StampRequestStatus[] = ["draft", "pending", "processing"];

/** Statuses only ever reachable through the verified webhook path (public.apply_stamp_webhook_event) — no admin action in this application sets any of these directly. */
export const WEBHOOK_ONLY_STAMP_REQUEST_STATUSES: StampRequestStatus[] = ["completed", "failed", "expired"];

export interface StampRequest {
  id: string;
  agreementId: string;
  agreementVersionId: string;
  provider: string;
  providerRequestId: string | null;
  status: StampRequestStatus;
  /** Free-text jurisdiction label (e.g. "Karnataka", "Delhi") — never validated against a hardcoded list; this application does not encode state-specific stamp rules (spec §3/§6: "do not guess state-specific stamp values"). */
  jurisdiction: string | null;
  state: string | null;
  documentType: string | null;
  /** Stamp value in the smallest currency unit (paise for INR), mirroring the pricing system's own integer-minor-unit convention. Null until the provider (or an admin, for the mock/manual path) reports a value — never invented by this application. */
  stampValue: number | null;
  currency: string;
  requestedAt: string | null;
  processingAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
  expiredAt: string | null;
  hasStampedDocument: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Stamp + sign sequence (spec §5) — configured per agreement, never a
// hardcoded universal legal order.
// ---------------------------------------------------------------------------

export const STAMP_SIGN_SEQUENCES = ["STAMP_THEN_SIGN", "SIGN_THEN_STAMP", "STAMP_ONLY", "SIGN_ONLY"] as const;
export type StampSignSequence = (typeof STAMP_SIGN_SEQUENCES)[number];

export const STAMP_SIGN_SEQUENCE_LABELS: Record<StampSignSequence, string> = {
  STAMP_THEN_SIGN: "Stamp, then sign",
  SIGN_THEN_STAMP: "Sign, then stamp",
  STAMP_ONLY: "Stamp only (no signature required)",
  SIGN_ONLY: "Sign only (no stamping required)",
};

// ---------------------------------------------------------------------------
// Stamp options a provider exposes (spec: getAvailableStampOptions()) — a
// provider-agnostic shape; the mock provider returns a small illustrative
// set, never fabricated real state-specific values (spec §6).
// ---------------------------------------------------------------------------

export interface StampOption {
  jurisdiction: string;
  state: string;
  documentType: string;
  /** Minor-unit stamp value the PROVIDER reports for this option — never invented by application code. */
  stampValue: number;
  currency: string;
}
