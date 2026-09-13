import "server-only";

/**
 * Provider-agnostic payment gateway abstraction. Razorpay
 * (src/lib/payments/providers/razorpay.ts) is the only implementation
 * today, but every call site in this module (order creation, checkout
 * config, refunds, reconciliation) depends only on this interface — adding
 * a second provider later means writing one new file that implements it,
 * never touching invoice/payment business logic.
 *
 * Every method here does a real network call to the gateway except the two
 * verify* methods, which are pure local HMAC checks. verify* methods are
 * used ONLY for fast local pre-checks (return a clear error quickly without
 * a database round trip) — the actual authoritative verification for any
 * privileged database write happens inside Postgres itself
 * (public.verify_checkout_payment() / public.apply_webhook_event() in
 * 0005_payments_billing.sql), independent of whatever this class reports.
 * See docs/payments-billing-guide.md §4 for why both layers exist.
 */

export interface CreateOrderParams {
  amountMinorUnits: number;
  currency: string;
  /** Sent to the gateway as an internal reference (Razorpay's `receipt` field) — this is our own idempotency_key, never a user-supplied value. */
  receipt: string;
  notes?: Record<string, string>;
}

export interface GatewayOrder {
  providerOrderId: string;
  amountMinorUnits: number;
  currency: string;
  status: string;
}

export interface FetchedPayment {
  providerPaymentId: string;
  providerOrderId: string | null;
  status: string;
  amountMinorUnits: number;
  currency: string;
  method: string | null;
  captured: boolean;
  errorDescription: string | null;
}

export interface CreateRefundParams {
  providerPaymentId: string;
  /** Omit for a full refund of the payment's remaining captured amount. */
  amountMinorUnits?: number;
  notes?: Record<string, string>;
  /**
   * Milestone 13 — our own refunds.id, sent to the gateway as an internal
   * reference (Razorpay's `receipt` field), mirroring CreateOrderParams'
   * `receipt` above. Never itself the idempotency mechanism (Razorpay does
   * not de-duplicate refund creation by receipt) — the actual exactly-once
   * guarantee is claim_refund_for_processing()/finalize_refund() in
   * supabase/migrations/0016_refund_operations.sql. This is purely so a
   * refund can be traced back to its case from the Razorpay dashboard.
   */
  internalReferenceId?: string;
}

export interface GatewayRefund {
  providerRefundId: string;
  /**
   * Milestone 13 FINAL FINANCIAL SAFETY PATCH (Issue 1) — tightened from a
   * bare `string` to the real Razorpay refund-status vocabulary. A
   * successful (non-throwing) createRefund() response can still report
   * 'pending' rather than a terminal outcome — this type is what makes that
   * distinguishable at the type level instead of relying on every caller to
   * remember it. See GatewayRefundStatus and
   * src/lib/payments/refund-processing.ts's decideRefundProcessingAction().
   */
  status: GatewayRefundStatus;
  amountMinorUnits: number;
}

/** Razorpay's refund status vocabulary (see node_modules/razorpay/dist/types/refunds.d.ts) — 'pending' means still in flight at the gateway, not yet a terminal outcome. */
export type GatewayRefundStatus = "pending" | "processed" | "failed";

export interface FetchedRefund {
  providerRefundId: string;
  status: GatewayRefundStatus;
  amountMinorUnits: number;
}

/**
 * Milestone 13 (spec §20) — thrown by createRefund()/getRefundStatus() when
 * the gateway itself gave a definite, unambiguous rejection (a genuine HTTP
 * error response from Razorpay — see RazorpayGateway's classifyRazorpayError
 * for exactly how this is distinguished from an uncertain/transport
 * failure). Safe to treat as a real "the provider said no" — the caller may
 * finalize the refund as failed.
 */
export class GatewayDefiniteRejectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GatewayDefiniteRejectionError";
  }
}

/**
 * Milestone 13 (spec §20) — thrown by createRefund()/getRefundStatus() when
 * the outcome is genuinely UNKNOWN: a network timeout, a connection reset,
 * a lost response, or any other transport-level failure where Razorpay may
 * have silently processed the refund anyway. This is the financial-safety-
 * critical distinction the whole M13 milestone exists to make: an uncertain
 * outcome must NEVER be treated as "safely retryable" or "failed" — the
 * caller must leave the refund in a non-terminal, blocking `processing`
 * state pending reconciliation or the webhook, never call finalize_refund()
 * from this branch.
 */
export class GatewayUncertainOutcomeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GatewayUncertainOutcomeError";
  }
}

export interface CheckoutSignatureParams {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
}

export interface WebhookSignatureParams {
  rawBody: string;
  signature: string;
}

export interface PaymentGateway {
  readonly providerName: string;
  createOrder(params: CreateOrderParams): Promise<GatewayOrder>;
  fetchPayment(providerPaymentId: string): Promise<FetchedPayment>;
  /**
   * Milestone 13: on ANY thrown error, the caller must NOT assume the
   * refund failed — see GatewayUncertainOutcomeError above. Only a thrown
   * GatewayDefiniteRejectionError may be treated as a real rejection.
   */
  createRefund(params: CreateRefundParams): Promise<GatewayRefund>;
  /**
   * Milestone 13 — used by manual reconciliation (and available to a future
   * scheduled sweep) to resolve a refund left in `processing` after an
   * uncertain createRefund() outcome, by asking Razorpay directly what
   * actually happened. Same error-classification contract as createRefund().
   */
  getRefundStatus(providerRefundId: string): Promise<FetchedRefund>;
  /** Local-only pre-check (see class docblock) — never the authoritative check for a database write. */
  verifyCheckoutSignature(params: CheckoutSignatureParams): boolean;
  /** Local-only pre-check (see class docblock) — never the authoritative check for a database write. */
  verifyWebhookSignature(params: WebhookSignatureParams): boolean;
}

export class PaymentGatewayNotConfiguredError extends Error {
  constructor() {
    super("Payment gateway is not configured.");
    this.name = "PaymentGatewayNotConfiguredError";
  }
}
