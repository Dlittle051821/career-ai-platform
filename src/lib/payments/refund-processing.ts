import type { GatewayRefundStatus } from "./gateway";

/**
 * Milestone 13 FINAL FINANCIAL SAFETY PATCH (Issue 1) — pure decision logic
 * for what processApprovedRefund() must do with a SUCCESSFUL (non-throwing)
 * gateway.createRefund() response.
 *
 * A successful HTTP response from Razorpay is NOT proof the money has
 * actually moved. Razorpay's own refund.status vocabulary
 * ('pending' | 'processed' | 'failed' — see
 * node_modules/razorpay/dist/types/refunds.d.ts) distinguishes a refund
 * that has merely been accepted/queued ('pending', the common case for
 * non-instant-speed refunds) from one that has actually completed
 * ('processed') or been rejected inline ('failed'). Only a 'processed'
 * response may finalize the refund as processed; only a 'failed' response
 * may finalize it as failed; anything else — 'pending', or any value not in
 * the known vocabulary — must leave the refund exactly where
 * claim_refund_for_processing() left it (`processing`), waiting for the
 * refund.processed/refund.failed webhook or reconcileRefund() to confirm
 * the eventual outcome. This is deliberately a pure function — no I/O, no
 * Supabase — so the decision itself is fully unit-testable without mocking
 * anything (see refund-processing.test.ts).
 *
 * This is a distinct concern from GatewayDefiniteRejectionError /
 * GatewayUncertainOutcomeError (src/lib/payments/gateway.ts), which
 * classify a THROWN error from the gateway call itself (an HTTP rejection
 * vs. a network/transport failure). This module instead classifies a
 * SUCCESSFUL response's own reported status — the call reached Razorpay and
 * got an answer, but that answer might itself be "not yet".
 */
export type RefundProcessingAction = { kind: "finalize"; outcome: "processed" | "failed" } | { kind: "await_confirmation" };

export function decideRefundProcessingAction(status: GatewayRefundStatus): RefundProcessingAction {
  if (status === "processed") return { kind: "finalize", outcome: "processed" };
  if (status === "failed") return { kind: "finalize", outcome: "failed" };
  // 'pending', or (defensively, since this is a network response and not
  // something TypeScript can guarantee at runtime) any other value —
  // never finalize on anything short of an explicit 'processed'/'failed'.
  return { kind: "await_confirmation" };
}
