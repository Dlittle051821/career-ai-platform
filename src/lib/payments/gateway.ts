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
}

export interface GatewayRefund {
  providerRefundId: string;
  status: string;
  amountMinorUnits: number;
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
  createRefund(params: CreateRefundParams): Promise<GatewayRefund>;
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
