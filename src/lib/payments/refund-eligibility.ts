/**
 * Milestone 13 — Refund Operations: the pure "technical refundability"
 * calculator.
 *
 * This module deliberately answers ONLY the question the database itself
 * can answer with certainty: given a payment_transaction's captured amount
 * and what has already been refunded against it, how much MORE could ever
 * be refunded, and is a requested amount within that bound? It does NOT
 * decide whether a refund SHOULD be granted — that is a commercial/policy
 * judgment call (a refund window, a cancellation fee, a partial-completion
 * rule, GST treatment) that belongs to a human admin during review/approval,
 * never to code. Nothing in this file invents a refund percentage, a
 * refund-window cutoff, a fee, or a GST rule — see docs/payments-billing-
 * guide.md §25 for why that boundary is deliberate and where policy
 * decisions are actually made (the admin review/approve step, recorded via
 * reviewedBy/approvedBy, never computed).
 *
 * Framework-free — no Supabase/React import — so it's unit-testable without
 * a DB or DOM, same convention as every other src/lib/<domain>/*.ts module
 * (src/lib/admin/status.ts, src/lib/admin/money.ts, etc.). The only
 * authoritative, race-safe version of the "remaining balance" check lives
 * in the database (claim_refund_for_processing()/finalize_refund() in
 * supabase/migrations/0016_refund_operations.sql) — this module exists so
 * the admin UI can show the same number and pre-validate a form BEFORE
 * hitting the database, not to replace that database-side check.
 */

export interface RefundableTransactionSnapshot {
  /** payment_transactions.amount_minor_units — the original captured amount. */
  amountMinorUnits: number;
  /** payment_transactions.amount_refunded_minor_units — already refunded (processed) against this transaction. */
  amountRefundedMinorUnits: number;
  /** payment_transactions.status. */
  status: string;
  /** payment_transactions.is_manual — an offline/manual payment has no gateway payment to refund through. */
  isManual: boolean;
  /** payment_transactions.provider_payment_id — null for a manual payment. */
  providerPaymentId: string | null;
}

export interface RefundEligibility {
  /**
   * True only if the transaction is, as a matter of DB-derived fact, capable
   * of being refunded at all right now (gateway-backed, captured or
   * partially refunded, remaining balance > 0). This is NOT a policy
   * decision — a technically-refundable transaction may still be rejected
   * by an admin for commercial reasons (spec: separate technical
   * refundability from policy eligibility).
   */
  technicallyRefundable: boolean;
  /** The maximum amount (in minor units) that could technically be refunded right now — amountMinorUnits - amountRefundedMinorUnits, floored at 0. */
  maximumRefundableAmountMinorUnits: number;
  /**
   * Always true: whether to actually grant a refund — in full, in part, or
   * at all — is a decision for the admin review/approval step, never
   * computed here. Kept as an explicit field (rather than just documented)
   * so calling code cannot mistake `technicallyRefundable: true` for
   * "should be refunded".
   */
  policyDecisionRequired: true;
  /** Human-readable reasons technicallyRefundable is false — empty when true. */
  reasons: string[];
}

/**
 * Computes technical refundability from a transaction snapshot. Pure
 * arithmetic over already-loaded data — never queries anything itself, and
 * never the final word (see claim_refund_for_processing() for the
 * process-time, lock-protected re-check immediately before any gateway
 * call).
 */
export function computeRefundEligibility(txn: RefundableTransactionSnapshot): RefundEligibility {
  const reasons: string[] = [];

  if (txn.isManual || !txn.providerPaymentId) {
    reasons.push("This was an offline (manually recorded) payment and has no gateway payment to refund through.");
  }
  if (txn.status !== "captured" && txn.status !== "partially_refunded") {
    reasons.push(`The underlying payment is not in a refundable state (current status: "${txn.status}").`);
  }

  const maximumRefundableAmountMinorUnits = Math.max(0, txn.amountMinorUnits - txn.amountRefundedMinorUnits);
  if (maximumRefundableAmountMinorUnits <= 0) {
    reasons.push("This payment has already been fully refunded.");
  }

  return {
    technicallyRefundable: reasons.length === 0,
    maximumRefundableAmountMinorUnits,
    policyDecisionRequired: true,
    reasons,
  };
}

/**
 * Validates a proposed refund amount (already parsed to integer minor
 * units) against a transaction snapshot's technical refundability. Returns
 * an error message string, or null if the amount is technically valid.
 * Does not itself decide whether the amount should be approved — see this
 * file's docblock.
 */
export function validateRefundAmount(amountMinorUnits: number, txn: RefundableTransactionSnapshot): string | null {
  if (!Number.isInteger(amountMinorUnits) || amountMinorUnits <= 0) {
    return "Enter a valid positive refund amount.";
  }
  const eligibility = computeRefundEligibility(txn);
  if (!eligibility.technicallyRefundable) {
    return eligibility.reasons[0] ?? "This payment is not currently refundable.";
  }
  if (amountMinorUnits > eligibility.maximumRefundableAmountMinorUnits) {
    return `Cannot refund more than the remaining refundable balance (${eligibility.maximumRefundableAmountMinorUnits} minor units).`;
  }
  return null;
}

/** True if amountMinorUnits would refund the transaction's entire remaining balance — used only for UI labeling ("full" vs "partial"), never for any authorization or accounting decision. */
export function isFullRefund(amountMinorUnits: number, txn: RefundableTransactionSnapshot): boolean {
  const eligibility = computeRefundEligibility(txn);
  return amountMinorUnits >= eligibility.maximumRefundableAmountMinorUnits && eligibility.maximumRefundableAmountMinorUnits > 0;
}
