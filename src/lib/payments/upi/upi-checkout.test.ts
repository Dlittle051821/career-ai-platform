import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { attestRecord } from "./attest";
import { resolveUpiCheckout, UPI_LIVE_APPROVAL_VALUE } from "./config";
import { checkoutPhase, parseCheckoutState } from "./state";

const base = {
  NEXTWISE_PAID_CHECKOUT: "enabled",
  NEXTWISE_PAID_CHECKOUT_PREREQUISITES: "CC19-CC20-APPROVED",
  RAZORPAY_KEY_ID: "rzp_test_abc",
  RAZORPAY_KEY_SECRET: "s",
  NEXTWISE_UPI_CHECKOUT: "enabled",
  NEXTWISE_PAYMENT_MODE: "test",
};

describe("resolveUpiCheckout (launch gate)", () => {
  it("is closed by default", () => {
    expect(resolveUpiCheckout({}).open).toBe(false);
  });
  it("opens in test mode with a test key", () => {
    const r = resolveUpiCheckout(base);
    expect(r.open && r.mode).toBe("test");
    expect(r.open && r.apiBaseUrl).toBe("https://api.razorpay.com");
  });
  it("needs the UPI flag on top of the paid-checkout gate", () => {
    expect(resolveUpiCheckout({ ...base, NEXTWISE_UPI_CHECKOUT: undefined })).toEqual({ open: false, reason: "upi_flag_off" });
  });
  it("refuses a live key in test mode and a test key in live mode", () => {
    expect(resolveUpiCheckout({ ...base, RAZORPAY_KEY_ID: "rzp_live_x" })).toEqual({ open: false, reason: "key_mode_mismatch" });
    expect(resolveUpiCheckout({ ...base, NEXTWISE_PAYMENT_MODE: "live" })).toEqual({ open: false, reason: "key_mode_mismatch" });
  });
  it("keeps live mode closed until the release gates are approved", () => {
    const live = { ...base, NEXTWISE_PAYMENT_MODE: "live", RAZORPAY_KEY_ID: "rzp_live_x" };
    expect(resolveUpiCheckout(live)).toEqual({ open: false, reason: "live_not_approved" });
    expect(resolveUpiCheckout({ ...live, NEXTWISE_UPI_LIVE_APPROVED: UPI_LIVE_APPROVAL_VALUE }).open).toBe(true);
  });
  it("is always closed in public-launch modes", () => {
    expect(resolveUpiCheckout({ ...base, NEXTWISE_LAUNCH_MODE: "public-accounts" }).open).toBe(false);
    expect(resolveUpiCheckout({ ...base, NEXTWISE_LAUNCH_MODE: "public-marketing" }).open).toBe(false);
  });
  it("allows the local test double only in test mode, on localhost, off Vercel production", () => {
    const td = { ...base, RAZORPAY_API_BASE_URL_FOR_TESTS: "http://127.0.0.1:4010" };
    expect(resolveUpiCheckout(td).open && resolveUpiCheckout(td)).toMatchObject({ usesTestDouble: true, apiBaseUrl: "http://127.0.0.1:4010" });
    expect(resolveUpiCheckout({ ...td, VERCEL_ENV: "production" }).open).toBe(false);
    expect(resolveUpiCheckout({ ...td, VERCEL_ENV: "production", NEXTWISE_LAUNCH_MODE: "full-platform" })).toEqual({ open: false, reason: "test_double_not_allowed" });
    expect(resolveUpiCheckout({ ...td, RAZORPAY_API_BASE_URL_FOR_TESTS: "https://evil.example" })).toEqual({ open: false, reason: "test_double_not_allowed" });
  });
});

describe("attestRecord", () => {
  it("signs the exact payload with HMAC-SHA256 of the key secret, with a timestamp", () => {
    const { payload, signature } = attestRecord({ type: "list_reconcile" }, "secret", 1_700_000_000);
    expect(JSON.parse(payload)).toEqual({ type: "list_reconcile", ts: 1_700_000_000 });
    expect(signature).toBe(createHmac("sha256", "secret").update(payload).digest("hex"));
  });
});

describe("checkoutPhase — success only from a paid, settled invoice", () => {
  const raw = (over: Record<string, unknown> = {}) => ({
    quote: { id: "q", status: "open", planSlug: "nextwise-verified", planName: "Nextwise Verified", currency: "INR", baseMinor: 199900, totalMinor: 199900, additionalUniversities: 0, addonMinor: 0, expiresAt: "2099-01-01" },
    invoice: { id: "i", status: "draft", number: null, totalMinor: 199900, currency: "INR", settledTransactionId: null, superseded: false },
    attempt: { id: "a", channel: "upi_qr", status: "pending", amountMinor: 199900, qrImageUrl: "x", expiresAt: "2099-01-01T00:00:00Z", reference: "upi-ab12", hasGatewayObject: true, closeReason: null },
    settled: null,
    lastPayment: null,
    purchaseId: "p",
    ...over,
  });
  it("awaits payment while the QR is live", () => expect(checkoutPhase(parseCheckoutState(raw()))).toBe("awaiting_payment"));
  it("is expired once the QR's own expiry passes", () => {
    expect(checkoutPhase(parseCheckoutState(raw()), Date.parse("2099-01-02"))).toBe("expired");
  });
  it("is paid only when the invoice is paid AND has a settling transaction", () => {
    expect(checkoutPhase(parseCheckoutState(raw({ invoice: { id: "i", status: "paid", number: "INV-2026-00001", totalMinor: 1, currency: "INR", settledTransactionId: "t" } })))).toBe("paid");
    expect(checkoutPhase(parseCheckoutState(raw({ invoice: { id: "i", status: "paid", number: "INV-2026-00001", totalMinor: 1, currency: "INR", settledTransactionId: null } })))).not.toBe("paid");
  });
  it("is unavailable for a superseded checkout", () => {
    expect(checkoutPhase(parseCheckoutState(raw({ invoice: { id: "i", status: "draft", totalMinor: 1, currency: "INR", superseded: true } })))).toBe("unavailable");
  });
  it("shows failure after a failed payment", () => {
    expect(checkoutPhase(parseCheckoutState(raw({ attempt: { ...raw().attempt, status: "failed" }, lastPayment: { status: "failed", failureReason: "x" } })))).toBe("failed");
  });
});

describe("static safety checks", () => {
  const root = path.resolve(__dirname, "../../../..");
  const read = (p: string) => readFileSync(path.join(root, p), "utf8");
  it("never exposes a Razorpay secret through a NEXT_PUBLIC_ variable", () => {
    for (const f of ["src/lib/payments/upi/config.ts", "src/lib/payments/upi/checkout-service.ts", "src/components/payment-v1/CheckoutClient.tsx", "src/app/(site)/checkout/actions.ts"]) {
      expect(read(f)).not.toMatch(/NEXT_PUBLIC_[A-Z_]*(SECRET|KEY_SECRET|WEBHOOK)/);
    }
  });
  it("the browser component never sends an amount to the server", () => {
    const client = read("src/components/payment-v1/CheckoutClient.tsx");
    expect(client).toMatch(/prepareUpiAction\(quoteId, "upi_qr"\)/);
    expect(client).not.toMatch(/prepareUpiAction\([^)]*amount/i);
  });
  it("the migration keeps settlement unreachable from the API and never adds tax on top", () => {
    const sql = read("supabase/migrations-proposed/NW_PAYMENT_V1/0001_upi_checkout.sql");
    expect(sql).toMatch(/revoke execute on function public\.nw_upi_settle_payment\(uuid, jsonb, text\) from public, anon, authenticated;/);
    expect(sql).toMatch(/p_gross_unit \* p_gst_rate_bps \/ \(10000\.0 \+ p_gst_rate_bps\)/);
    expect(sql).toMatch(/tax_exclusive[\s\S]*raise exception/);
  });
});
