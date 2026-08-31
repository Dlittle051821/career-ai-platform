/**
 * Milestone 10 (F-122) — pure, framework-free business rules for the
 * electronic-signature flow. Nothing in this file talks to Supabase or a
 * provider (that lives in src/lib/supabase/admin/signatures.ts, the I/O
 * layer that wraps this) — same "pure src/lib/<domain> vs I/O
 * src/lib/supabase/<domain>" convention as src/lib/pricing/ vs
 * src/lib/supabase/pricing/, src/lib/admin/ vs src/lib/supabase/admin/,
 * etc. This is what src/lib/signatures/rules.test.ts exercises.
 *
 * Every function here returns a discriminated result — { ok: true } or
 * { ok: false, reason } — never throws; the I/O layer is what turns a
 * `reason` into an AdminValidationError. These are DEFENSE-IN-DEPTH,
 * friendly-error checks: the database itself independently enforces the
 * ones that matter for correctness/security (agreement_versions'
 * immutability trigger, signature_requests_one_active_per_version's
 * partial unique index, the status CHECK constraints) — see
 * 0011_electronic_signature.sql. A bug here can produce a worse error
 * message; it can never produce an invalid database state.
 */

import type { AgreementStatus, SignatureStatus } from "@/types/admin";
import { NON_TERMINAL_SIGNATURE_REQUEST_STATUSES, type AgreementVersionStatus, type SignatureRequestStatus } from "@/types/signatures";

export type RuleResult = { ok: true } | { ok: false; reason: string };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function fail(reason: string): RuleResult {
  return { ok: false, reason };
}
const OK: RuleResult = { ok: true };

// ---------------------------------------------------------------------------
// Send for Signature — spec §5 preconditions, in order.
// ---------------------------------------------------------------------------

export interface SendForSignatureInput {
  hasPermission: boolean;
  agreementExists: boolean;
  agreementStatus: AgreementStatus | null;
  agreementSignatureStatus: SignatureStatus | null;
  /** The selected agreement_versions row — must exist and be unlocked ('draft'). Pass null when no such version was found/selected. */
  version: { status: AgreementVersionStatus } | null;
  signerName: string | null | undefined;
  signerEmail: string | null | undefined;
  /** True if signature_requests_one_active_per_version already has a non-terminal row for this version. */
  hasActiveRequestForVersion: boolean;
}

export function validateSendForSignature(input: SendForSignatureInput): RuleResult {
  if (!input.hasPermission) return fail("You do not have permission to send an agreement for signature.");
  if (!input.agreementExists) return fail("Agreement not found.");
  if (input.agreementSignatureStatus === "signed") return fail("This agreement is already signed.");
  if (input.agreementStatus === "cancelled") return fail("This agreement has been cancelled.");
  if (!input.version) return fail("Select or create an agreement version to send — none was found.");
  if (input.version.status !== "draft") return fail(`The selected agreement version is "${input.version.status}", not draft — create a new version to send instead.`);
  const name = (input.signerName ?? "").trim();
  if (!name) return fail("Signer name is required.");
  const email = (input.signerEmail ?? "").trim();
  if (!email || !EMAIL_RE.test(email)) return fail("A valid signer email is required.");
  if (input.hasActiveRequestForVersion) return fail("This agreement version already has an active signature request — cancel it before sending a new one.");
  return OK;
}

// ---------------------------------------------------------------------------
// Resend — the SAME signature_requests row, never a new one. Only valid
// while the provider is still actively waiting on a signer (sent/viewed).
// ---------------------------------------------------------------------------

export interface ResendSignatureInput {
  hasPermission: boolean;
  requestExists: boolean;
  status: SignatureRequestStatus | null;
}

const RESENDABLE_STATUSES: SignatureRequestStatus[] = ["sent", "viewed"];

export function validateResendSignatureRequest(input: ResendSignatureInput): RuleResult {
  if (!input.hasPermission) return fail("You do not have permission to resend a signature request.");
  if (!input.requestExists || !input.status) return fail("Signature request not found.");
  if (!RESENDABLE_STATUSES.includes(input.status)) {
    return fail(`Cannot resend a signature request that is "${input.status}" — resend is only available while it is sent or viewed.`);
  }
  return OK;
}

// ---------------------------------------------------------------------------
// Cancel — any non-terminal state, never after signed (or any other
// terminal state).
// ---------------------------------------------------------------------------

export interface CancelSignatureInput {
  hasPermission: boolean;
  requestExists: boolean;
  status: SignatureRequestStatus | null;
}

export function validateCancelSignatureRequest(input: CancelSignatureInput): RuleResult {
  if (!input.hasPermission) return fail("You do not have permission to cancel a signature request.");
  if (!input.requestExists || !input.status) return fail("Signature request not found.");
  if (input.status === "signed") return fail("Cannot cancel a signature request that has already been signed.");
  if (!NON_TERMINAL_SIGNATURE_REQUEST_STATUSES.includes(input.status)) {
    return fail(`Cannot cancel a signature request that is already "${input.status}".`);
  }
  return OK;
}

// ---------------------------------------------------------------------------
// "If the agreement is edited after a request exists, create a new
// version and leave the old request/version pair alone — admin must
// explicitly cancel-old + send-new, never silently swap the document
// under an in-flight request." There is deliberately no rule function
// here for this: creating a new draft version is always allowed
// regardless of any other version's state (agreement_versions.
// version_number is per-agreement and independent), and never itself
// cancels or mutates any existing signature_requests row. The database's
// own locking trigger (prevent_agreement_version_mutation, see
// 0011_electronic_signature.sql PART 1.1) already makes "silently swap
// the document under an in-flight request" structurally impossible: a
// locked version cannot be edited, full stop — only a new version can be
// created, which never touches the old one.
// ---------------------------------------------------------------------------
