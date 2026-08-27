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
  CheckoutSignatureParams,
  WebhookSignatureParams,
} from "../gateway";
import { getRazorpayWebhookSecret } from "../env";

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

  async createRefund(params: CreateRefundParams): Promise<GatewayRefund> {
    const refund = await this.client.payments.refund(params.providerPaymentId, {
      amount: params.amountMinorUnits,
      notes: params.notes,
    });
    return {
      providerRefundId: refund.id,
      status: refund.status,
      amountMinorUnits: Number(refund.amount ?? params.amountMinorUnits ?? 0),
    };
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
