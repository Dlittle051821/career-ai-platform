import "server-only";
import Razorpay from "razorpay";
import { createHmac } from "node:crypto";
import type {
  PaymentGateway,
  CreateOrderParams,
  GatewayOrder,
  FetchedPayment,
  CreateRefundParams,
  GatewayRefund,
  FetchedRefund,
  GatewayRefundStatus,
  CheckoutSignatureParams,
  WebhookSignatureParams,
} from "../gateway";
import { GatewayDefiniteRejectionError, GatewayUncertainOutcomeError } from "../gateway";
import { getRazorpayWebhookSecret } from "../env";

/**
 * Milestone 13 (spec §20) — the exact shape razorpay-node's own
 * dist/api.js normalizeError() produces ONLY when the underlying axios
 * error had a real `.response` (i.e. Razorpay actually received the
 * request and sent back an HTTP error): `throw { statusCode:
 * err.response.status, error: err.response.data.error }`. Verified by
 * reading that file directly rather than guessed — see this module's own
 * docblock above.
 */
function isNormalizedRazorpayError(err: unknown): err is { statusCode: number; error: { description?: string; code?: string; reason?: string } } {
  return typeof err === "object" && err !== null && "statusCode" in err && typeof (err as { statusCode: unknown }).statusCode === "number" && "error" in err;
}

/**
 * Distinguishes a definite provider rejection from an uncertain/transport
 * failure using the exact mechanism razorpay-node's own api.js
 * normalizeError() relies on: it can only produce the {statusCode, error}
 * shape checked above when `err.response` exists — a genuine HTTP response,
 * meaning Razorpay definitely received and rejected the request. A
 * network/timeout error has no `.response`, so normalizeError()'s own
 * `err.response.status` property access throws a DIFFERENT error (a bare
 * TypeError, not shaped like {statusCode, error}) — that shape difference,
 * not a guess about error messages, is what this function keys off. See
 * node_modules/razorpay/dist/api.js.
 */
export function classifyRazorpayError(err: unknown): GatewayDefiniteRejectionError | GatewayUncertainOutcomeError {
  if (isNormalizedRazorpayError(err)) {
    const description = err.error && typeof err.error === "object" && typeof err.error.description === "string" ? err.error.description : "";
    return new GatewayDefiniteRejectionError(description || `Razorpay rejected the request (HTTP ${err.statusCode}).`);
  }
  const message = err instanceof Error ? err.message : "Unknown error";
  return new GatewayUncertainOutcomeError(
    `Could not confirm the outcome of this request with Razorpay — a network/transport error occurred, so the refund may or may not have actually been created. This must be resolved by reconciliation, never assumed to have failed: ${message}`
  );
}

/**
 * Razorpay implementation of PaymentGateway, built directly on the
 * official `razorpay` npm SDK (razorpay-node) — every request shape and
 * the HMAC verification algorithms below were read directly out of that
 * package's own published source (dist/resources/orders.js,
 * dist/resources/payments.js, dist/resources/refunds.js,
 * dist/utils/razorpay-utils.js) rather than guessed, per the spec's
 * explicit instruction to use current official documentation:
 *
 *  - orders.create({amount, currency, receipt, notes}) -> POST /orders
 *  - payments.fetch(paymentId) -> GET /payments/{id}
 *  - payments.refund(paymentId, {amount?, notes?}) -> POST /payments/{id}/refund
 *  - checkout signature: HMAC-SHA256("{order_id}|{payment_id}", key_secret),
 *    hex digest, compared to razorpay_signature from Checkout's handler —
 *    the exact algorithm razorpay-node's validatePaymentVerification() uses.
 *  - webhook signature: HMAC-SHA256(raw request body, webhook_secret), hex
 *    digest, compared to the X-Razorpay-Signature header — the exact
 *    algorithm razorpay-node's validateWebhookSignature() uses.
 *
 * Payment capture mode (automatic vs manual) is deliberately left
 * unspecified in createOrder() — Razorpay applies your account's own
 * capture settings (Dashboard -> Settings -> Payment capture), which this
 * integration does not override. See docs/payments-billing-guide.md §5.
 */
export class RazorpayGateway implements PaymentGateway {
  readonly providerName = "razorpay";
  private readonly client: Razorpay;
  private readonly keySecret: string;

  constructor(config: { keyId: string; keySecret: string }) {
    this.client = new Razorpay({ key_id: config.keyId, key_secret: config.keySecret });
    this.keySecret = config.keySecret;
  }

  async createOrder(params: CreateOrderParams): Promise<GatewayOrder> {
    const order = await this.client.orders.create({
      amount: params.amountMinorUnits,
      currency: params.currency,
      receipt: params.receipt,
      notes: params.notes,
    });
    return {
      providerOrderId: order.id,
      amountMinorUnits: Number(order.amount),
      currency: order.currency,
      status: order.status,
    };
  }

  async fetchPayment(providerPaymentId: string): Promise<FetchedPayment> {
    const payment = await this.client.payments.fetch(providerPaymentId);
    return {
      providerPaymentId: payment.id,
      providerOrderId: payment.order_id ?? null,
      status: payment.status,
      amountMinorUnits: Number(payment.amount),
      currency: payment.currency,
      method: payment.method ?? null,
      captured: !!payment.captured,
      errorDescription: payment.error_description ?? null,
    };
  }

  /**
   * Milestone 13 (spec §20): on ANY thrown error, the caller must NOT
   * assume the refund failed at Razorpay — a timed-out/reset request may
   * have silently succeeded there. This method never decides that for the
   * caller; it only classifies the error (see classifyRazorpayError above)
   * and rethrows one of GatewayDefiniteRejectionError (safe to treat as a
   * real rejection) or GatewayUncertainOutcomeError (must NOT be treated as
   * failed — the caller must leave the refund blocking in `processing`
   * pending reconciliation/webhook). The refund's own case id is passed as
   * `receipt` purely for traceability in the Razorpay dashboard — it is
   * never itself the idempotency mechanism (see CreateRefundParams'
   * internalReferenceId docblock).
   */
  async createRefund(params: CreateRefundParams): Promise<GatewayRefund> {
    try {
      const refund = await this.client.payments.refund(params.providerPaymentId, {
        amount: params.amountMinorUnits,
        notes: params.notes,
        receipt: params.internalReferenceId,
      });
      return {
        providerRefundId: refund.id,
        status: refund.status,
        amountMinorUnits: Number(refund.amount ?? params.amountMinorUnits ?? 0),
      };
    } catch (err) {
      throw classifyRazorpayError(err);
    }
  }

  /**
   * Milestone 13 — used by manual reconciliation to resolve a refund left
   * in `processing` after an uncertain createRefund() outcome. Same
   * error-classification contract as createRefund() above: a thrown
   * GatewayUncertainOutcomeError here means reconciliation itself could not
   * get a definite answer this time and must be retried later, never
   * treated as a failure.
   */
  async getRefundStatus(providerRefundId: string): Promise<FetchedRefund> {
    try {
      const refund = await this.client.refunds.fetch(providerRefundId);
      return {
        providerRefundId: refund.id,
        status: refund.status as GatewayRefundStatus,
        amountMinorUnits: Number(refund.amount ?? 0),
      };
    } catch (err) {
      throw classifyRazorpayError(err);
    }
  }

  verifyCheckoutSignature({ providerOrderId, providerPaymentId, signature }: CheckoutSignatureParams): boolean {
    const expected = createHmac("sha256", this.keySecret).update(`${providerOrderId}|${providerPaymentId}`).digest("hex");
    return expected === signature;
  }

  verifyWebhookSignature({ rawBody, signature }: WebhookSignatureParams): boolean {
    const secret = getRazorpayWebhookSecret();
    if (!secret) return false;
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    return expected === signature;
  }
}
