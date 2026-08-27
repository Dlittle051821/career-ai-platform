import { createHmac } from "node:crypto";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { RazorpayGateway } from "./razorpay";

/**
 * Tests RazorpayGateway's two LOCAL pre-check verification methods against
 * hand-computed HMAC vectors using the exact algorithms documented in this
 * file's own docblock (grounded in the real razorpay-node SDK source — see
 * that docblock for the citation). These are never the authoritative check
 * for a database write (that's public.verify_checkout_payment() /
 * public.apply_webhook_event() in Postgres — see
 * 0005_payments_billing.sql), but they are the fast-path Node-side check
 * the webhook route and checkout-verification flow both use, so they need
 * their own correctness coverage: valid, invalid (tampered), and mismatched
 * signatures.
 */

const KEY_SECRET = "test_key_secret_abc123";
const WEBHOOK_SECRET = "test_webhook_secret_xyz789";

describe("RazorpayGateway.verifyCheckoutSignature", () => {
  const gateway = new RazorpayGateway({ keyId: "rzp_test_key", keySecret: KEY_SECRET });

  it("accepts a genuinely valid signature (order_id|payment_id, HMAC-SHA256 with the key secret)", () => {
    const orderId = "order_ABC123";
    const paymentId = "pay_XYZ789";
    const signature = createHmac("sha256", KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
    expect(gateway.verifyCheckoutSignature({ providerOrderId: orderId, providerPaymentId: paymentId, signature })).toBe(true);
  });

  it("rejects a signature computed with the wrong secret", () => {
    const orderId = "order_ABC123";
    const paymentId = "pay_XYZ789";
    const signature = createHmac("sha256", "wrong_secret").update(`${orderId}|${paymentId}`).digest("hex");
    expect(gateway.verifyCheckoutSignature({ providerOrderId: orderId, providerPaymentId: paymentId, signature })).toBe(false);
  });

  it("rejects a signature valid for a different order/payment pair (signature reuse/replay across orders)", () => {
    const signatureForOtherPair = createHmac("sha256", KEY_SECRET).update("order_OTHER|pay_OTHER").digest("hex");
    expect(gateway.verifyCheckoutSignature({ providerOrderId: "order_ABC123", providerPaymentId: "pay_XYZ789", signature: signatureForOtherPair })).toBe(false);
  });

  it("rejects a tampered (single-character-altered) signature", () => {
    const orderId = "order_ABC123";
    const paymentId = "pay_XYZ789";
    const valid = createHmac("sha256", KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
    const tampered = valid.slice(0, -1) + (valid.at(-1) === "0" ? "1" : "0");
    expect(gateway.verifyCheckoutSignature({ providerOrderId: orderId, providerPaymentId: paymentId, signature: tampered })).toBe(false);
  });

  it("rejects an empty signature", () => {
    expect(gateway.verifyCheckoutSignature({ providerOrderId: "order_ABC123", providerPaymentId: "pay_XYZ789", signature: "" })).toBe(false);
  });
});

describe("RazorpayGateway.verifyWebhookSignature", () => {
  const gateway = new RazorpayGateway({ keyId: "rzp_test_key", keySecret: KEY_SECRET });
  const originalSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  beforeEach(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
    else process.env.RAZORPAY_WEBHOOK_SECRET = originalSecret;
  });

  const rawBody = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_1", order_id: "order_1", amount: 10000 } } } });

  it("accepts a genuinely valid webhook signature (HMAC-SHA256 of the raw body with the webhook secret)", () => {
    const signature = createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
    expect(gateway.verifyWebhookSignature({ rawBody, signature })).toBe(true);
  });

  it("rejects a signature computed with the wrong secret", () => {
    const signature = createHmac("sha256", "wrong_secret").update(rawBody).digest("hex");
    expect(gateway.verifyWebhookSignature({ rawBody, signature })).toBe(false);
  });

  it("rejects a signature computed over a DIFFERENT body than the one supplied — catches any re-serialization bug (e.g. accidentally verifying JSON.parse(body) re-stringified instead of the raw body)", () => {
    const otherBody = JSON.stringify({ event: "payment.failed" });
    const signature = createHmac("sha256", WEBHOOK_SECRET).update(otherBody).digest("hex");
    expect(gateway.verifyWebhookSignature({ rawBody, signature })).toBe(false);
  });

  it("fails closed when the webhook secret is not configured at all, rather than skipping verification", () => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
    expect(gateway.verifyWebhookSignature({ rawBody, signature })).toBe(false);
  });

  it("two identical (duplicate) deliveries of the same raw body produce the identical signature check result — the basis for the DB layer's fingerprint-based idempotency", () => {
    const signature = createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
    expect(gateway.verifyWebhookSignature({ rawBody, signature })).toBe(gateway.verifyWebhookSignature({ rawBody, signature }));
  });
});
