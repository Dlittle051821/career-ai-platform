import type { AgreementStatus } from "@/types/admin";
import { NON_TERMINAL_STAMP_REQUEST_STATUSES, type StampRequestStatus, type StampSignSequence } from "@/types/stamping";
import type { AgreementVersionStatus } from "@/types/signatures";

/**
 * Milestone 11-A (F-123) — pure, framework-free business rules for the
 * electronic-stamping flow. Mirrors src/lib/signatures/rules.ts's
 * conventions exactly ("pure src/lib/<domain> vs I/O
 * src/lib/supabase/<domain>" split; every function returns a discriminated
 * result, never throws; these are DEFENSE-IN-DEPTH checks — the database
 * independently enforces the ones that matter for correctness/security via
 * CHECK constraints and the partial unique index, see
 * 0012_electronic_stamping_and_assisted_onboarding.sql). This is what
 * src/lib/stamping/rules.test.ts exercises.
 */

export type RuleResult = { ok: true } | { ok: false; reason: string };

function fail(reason: string): RuleResult {
  return { ok: false, reason };
}
const OK: RuleResult = { ok: true };

// ---------------------------------------------------------------------------
// Request E-Stamp — spec §3/§5/§6 preconditions, in order.
// ---------------------------------------------------------------------------

export interface RequestStampInput {
  hasPermission: boolean;
  agreementExists: boolean;
  agreementStatus: AgreementStatus | null;
  /** The stamp+sign sequence configured for this agreement — null means "not configured" (spec §5: display "Electronic stamping is not configured for this agreement.", never silently proceed with a guessed order). */
  sequence: StampSignSequence | null;
  /** True when the configured sequence requires signing to happen before stamping (SIGN_THEN_STAMP) and the agreement is not yet signed. */
  signatureRequiredFirstButMissing: boolean;
  /** The selected agreement_versions row — must exist and must not be superseded; a stamp request is always taken against a specific, exact agreement version (spec §3: "EVERY stamp request must reference an EXACT agreement version"). A 'draft' version is valid: public.create_stamp_request() atomically locks it in the same statement that creates the request (0012 PART 3), the same "lock on send" behavior create_signature_request() already has for signing. Pass null when no such version was found/selected. */
  version: { status: AgreementVersionStatus } | null;
  /** True if stamp_requests_one_active_per_version already has a non-terminal row for this version. */
  hasActiveRequestForVersion: boolean;
}

export function validateRequestStamp(input: RequestStampInput): RuleResult {
  if (!input.hasPermission) return fail("You do not have permission to request electronic stamping.");
  if (!input.agreementExists) return fail("Agreement not found.");
  if (input.agreementStatus === "cancelled") return fail("This agreement has been cancelled.");
  if (!input.sequence) return fail("Electronic stamping is not configured for this agreement.");
  if (input.sequence === "SIGN_ONLY") return fail("This agreement is configured for signature only — electronic stamping does not apply.");
  if (input.signatureRequiredFirstButMissing) return fail("This agreement's configured sequence requires signing before stamping — send it for signature first.");
  if (!input.version) return fail("Select an agreement version to stamp — none was found.");
  if (input.version.status === "superseded") return fail("This agreement version has been superseded — select the current version instead.");
  if (input.hasActiveRequestForVersion) return fail("This agreement version already has an active stamp request — cancel it before requesting a new one.");
  return OK;
}

// ---------------------------------------------------------------------------
// Retry — a NEW stamp request against the same version, only after the
// prior one reached a terminal, non-completed state. Never retries a
// completed request (that would silently create a second stamp on the same
// version).
// ---------------------------------------------------------------------------

export interface RetryStampInput {
  hasPermission: boolean;
  requestExists: boolean;
  status: StampRequestStatus | null;
  hasActiveRequestForVersion: boolean;
}

const RETRYABLE_STATUSES: StampRequestStatus[] = ["failed", "cancelled", "expired"];

export function validateRetryStampRequest(input: RetryStampInput): RuleResult {
  if (!input.hasPermission) return fail("You do not have permission to retry a stamp request.");
  if (!input.requestExists || !input.status) return fail("Stamp request not found.");
  if (!RETRYABLE_STATUSES.includes(input.status)) {
    return fail(`Cannot retry a stamp request that is "${input.status}" — retry is only available after it has failed, been cancelled, or expired.`);
  }
  if (input.hasActiveRequestForVersion) return fail("This agreement version already has an active stamp request.");
  return OK;
}

// ---------------------------------------------------------------------------
// Cancel — any non-terminal state, never after completed (or any other
// terminal state).
// ---------------------------------------------------------------------------

export interface CancelStampInput {
  hasPermission: boolean;
  requestExists: boolean;
  status: StampRequestStatus | null;
}

export function validateCancelStampRequest(input: CancelStampInput): RuleResult {
  if (!input.hasPermission) return fail("You do not have permission to cancel a stamp request.");
  if (!input.requestExists || !input.status) return fail("Stamp request not found.");
  if (input.status === "completed") return fail("Cannot cancel a stamp request that has already completed.");
  if (!NON_TERMINAL_STAMP_REQUEST_STATUSES.includes(input.status)) {
    return fail(`Cannot cancel a stamp request that is already "${input.status}".`);
  }
  return OK;
}
