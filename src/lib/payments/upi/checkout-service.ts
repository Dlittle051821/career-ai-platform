import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getRazorpayServerConfig } from "../env";
import { attestRecord, type GatewayRecord, type ObservedPayment } from "./attest";
import { resolveUpiCheckout, type UpiCheckoutConfig } from "./config";
import { RazorpayUpiClient } from "./razorpay-upi";
import { parseCheckoutState, type CheckoutState, type UpiChannel } from "./state";

/**
 * NW-PAYMENT-V1 — the checkout service. Every decision about money is made
 * in the database (start_quote_checkout / prepare_upi_attempt /
 * nw_upi_settle_payment); this module only talks to Razorpay and hands
 * Razorpay's answers to the database as server-attested records.
 *
 * Success is never inferred here. The page shows "paid" only when
 * get_quote_checkout_state() reports the invoice as paid, which happens only
 * after a Razorpay-signed webhook or a server-side reconciliation read of
 * Razorpay's own API settled it.
 */

type Db = SupabaseClient<Database>;
type OpenConfig = Extract<UpiCheckoutConfig, { open: true }>;

export class UpiCheckoutError extends Error {
  constructor(
    message: string,
    readonly code: "closed" | "not_found" | "gateway" | "state" = "state",
  ) {
    super(message);
    this.name = "UpiCheckoutError";
  }
}

function openConfig(): { cfg: OpenConfig; keySecret: string } {
  const cfg = resolveUpiCheckout();
  const server = getRazorpayServerConfig();
  if (!cfg.open || !server) throw new UpiCheckoutError("Online payment is not open yet.", "closed");
  return { cfg, keySecret: server.keySecret };
}

function client(cfg: OpenConfig, keySecret: string): RazorpayUpiClient {
  return new RazorpayUpiClient({ keyId: cfg.keyId, keySecret, apiBaseUrl: cfg.apiBaseUrl });
}

/** Database messages raised by the checkout RPCs are written for students; anything else is replaced. */
function friendly(error: { message?: string } | null, fallback: string): string {
  const message = error?.message ?? "";
  const known = [
    "You must be signed in",
    "Online payment is not",
    "This package selection",
    "This package is not",
    "The price of this package",
    "That is more additional",
    "This package could not",
    "This checkout",
    "Unsupported payment method",
    "This package's tax treatment",
  ];
  return known.some((k) => message.startsWith(k)) ? message : fallback;
}

async function record(db: Db, keySecret: string, rec: GatewayRecord): Promise<unknown> {
  const { payload, signature } = attestRecord(rec, keySecret);
  const { data, error } = await db.rpc("apply_upi_gateway_record", { p_payload: payload, p_signature: signature });
  if (error) throw new UpiCheckoutError(`Gateway record refused: ${error.message}`, "state");
  return data;
}

export async function getCheckoutState(db: Db, quoteId: string): Promise<CheckoutState | null> {
  const { data, error } = await db.rpc("get_quote_checkout_state", { p_quote_id: quoteId });
  if (error) throw new UpiCheckoutError("We couldn't load this checkout.", "state");
  return parseCheckoutState(data);
}

/** Quote → draft invoice (idempotent per quote). */
export async function beginCheckout(db: Db, quoteId: string): Promise<{ invoiceId: string }> {
  openConfig();
  const { data, error } = await db.rpc("start_quote_checkout", { p_quote_id: quoteId });
  if (error || !data) throw new UpiCheckoutError(friendly(error, "We couldn't start checkout. Please try again."), "state");
  return { invoiceId: String((data as { invoice_id: string }).invoice_id) };
}

/**
 * Makes sure the invoice has exactly one live attempt on `channel` with its
 * Razorpay object (a single-use fixed-amount QR, or an order for UPI Intent).
 * A page refresh reuses the same QR; only an expired QR or a method switch
 * creates a new one, and the replaced QR is closed at Razorpay.
 */
export async function ensureUpiAttempt(db: Db, invoiceId: string, channel: UpiChannel): Promise<{ paid: boolean }> {
  const { cfg, keySecret } = openConfig();
  const rzp = client(cfg, keySecret);
  const { data, error } = await db.rpc("prepare_upi_attempt", { p_invoice_id: invoiceId, p_channel: channel });
  if (error || !data) throw new UpiCheckoutError(friendly(error, "We couldn't prepare the payment. Please try again."), "state");
  const prepared = data as {
    paid?: boolean;
    attempt_id?: string;
    needs_gateway?: boolean;
    amount_minor_units?: number;
    currency?: string;
    idempotency_key?: string;
    requested_close_by?: number;
    close_qr_id?: string | null;
  };
  if (prepared.paid) return { paid: true };

  if (prepared.close_qr_id) {
    // a replaced QR: close it so it can no longer be paid. If that fails it is still single-use and expires
    // by itself, and any payment that reaches it is held for finance by nw_upi_settle_payment().
    await rzp.closeQr(prepared.close_qr_id).catch(() => undefined);
  }
  if (!prepared.needs_gateway || !prepared.attempt_id) return { paid: false };

  const attemptId = prepared.attempt_id;
  const amount = Number(prepared.amount_minor_units);
  const currency = String(prepared.currency);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new UpiCheckoutError("This checkout could not be priced.", "state");

  if (channel === "upi_qr") {
    const minimumCloseBy = Math.floor(Date.now() / 1000) + 150; // Razorpay: close_by at least 2 minutes ahead
    const closeBy = Math.max(Number(prepared.requested_close_by) || 0, minimumCloseBy);
    const qr = await rzp.createUpiQr({ amountMinorUnits: amount, currency, closeBy, attemptId, invoiceId, description: "Nextwise package payment" });
    await record(db, keySecret, {
      type: "qr_created",
      attempt_id: attemptId,
      qr_id: qr.id,
      image_url: qr.imageUrl,
      close_by: qr.closeBy,
      amount: qr.amount,
      currency,
      fixed_amount: qr.fixedAmount,
      usage: qr.usage,
    });
  } else {
    const order = await rzp.createOrder({ amountMinorUnits: amount, currency, receipt: String(prepared.idempotency_key), attemptId, invoiceId });
    await record(db, keySecret, { type: "order_created", attempt_id: attemptId, order_id: order.id, amount: order.amount, currency: order.currency });
  }
  return { paid: false };
}

interface AttemptRef {
  id: string;
  channel: UpiChannel;
  status: string;
  amountMinorUnits: number;
  currency: string;
  providerQrId: string | null;
  providerOrderId: string | null;
}

/**
 * Asks Razorpay — with the server's own key, never the browser's word —
 * which payments reached this attempt's QR or order, and hands them to the
 * database. Settlement happens there, exactly once. An authorised (not yet
 * captured) UPI Intent payment of exactly the order amount is captured first.
 */
export async function observeAttempt(db: Db, attempt: AttemptRef, deps?: { rzp: RazorpayUpiClient; keySecret: string }): Promise<unknown> {
  const { cfg, keySecret } = deps ? { cfg: null, keySecret: deps.keySecret } : openConfig();
  const rzp = deps?.rzp ?? client(cfg as OpenConfig, keySecret);
  let payments: ObservedPayment[] = [];
  if (attempt.channel === "upi_qr" && attempt.providerQrId) payments = await rzp.fetchQrPayments(attempt.providerQrId);
  else if (attempt.channel === "upi_checkout" && attempt.providerOrderId) payments = await rzp.fetchOrderPayments(attempt.providerOrderId);
  else return null;

  const settled: ObservedPayment[] = [];
  for (const p of payments) {
    if (p.status === "authorized" && attempt.channel === "upi_checkout" && p.amount === attempt.amountMinorUnits && p.currency === attempt.currency) {
      settled.push(await rzp.capture(p.id, p.amount, p.currency).catch(() => p));
    } else {
      settled.push(p);
    }
  }
  const relevant = settled.filter((p) => p.status === "captured" || p.status === "authorized" || p.status === "failed" || p.status === "refunded");
  if (relevant.length === 0) return null;
  return record(db, keySecret, { type: "payments_observed", attempt_id: attempt.id, payments: relevant });
}

/** The student's checkout page asks "has it been paid yet?" — answered from Razorpay, settled in the database. */
export async function refreshCheckout(db: Db, quoteId: string): Promise<CheckoutState | null> {
  const state = await getCheckoutState(db, quoteId);
  if (!state?.attempt || state.invoice?.status === "paid") return state;
  const { data: row } = await db
    .from("payment_attempts")
    .select("id, channel, status, amount_minor_units, currency, provider_qr_id, provider_order_id")
    .eq("id", state.attempt.id)
    .maybeSingle();
  const attempt = row as { id: string; channel: UpiChannel | null; status: string; amount_minor_units: number; currency: string; provider_qr_id: string | null; provider_order_id: string | null } | null;
  if (!attempt?.channel) return state;
  try {
    await observeAttempt(db, {
      id: attempt.id,
      channel: attempt.channel,
      status: attempt.status,
      amountMinorUnits: Number(attempt.amount_minor_units),
      currency: attempt.currency,
      providerQrId: attempt.provider_qr_id,
      providerOrderId: attempt.provider_order_id,
    });
  } catch (err) {
    // Razorpay unreachable: the webhook and the scheduled reconciliation still settle the payment.
    console.error("[payments/upi] status refresh could not reach the gateway:", err instanceof Error ? err.name : "unknown");
  }
  return getCheckoutState(db, quoteId);
}

/**
 * Scheduled reconciliation (no user session): finds every open or recently
 * closed Payment V1 attempt and asks Razorpay about it. This is what settles a
 * payment when the student closed the browser AND the webhook was lost.
 */
export async function reconcileOpenAttempts(db: Db): Promise<{ checked: number; errors: number }> {
  const { cfg, keySecret } = openConfig();
  const rzp = client(cfg, keySecret);
  const { payload, signature } = attestRecord({ type: "list_reconcile" }, keySecret);
  const { data, error } = await db.rpc("upi_attempts_to_reconcile", { p_payload: payload, p_signature: signature });
  if (error) throw new UpiCheckoutError("Reconciliation list refused.", "state");
  const rows = (Array.isArray(data) ? data : []) as Array<{
    attempt_id: string;
    channel: UpiChannel;
    status: string;
    amount_minor_units: number;
    currency: string;
    provider_qr_id: string | null;
    provider_order_id: string | null;
  }>;
  let errors = 0;
  for (const r of rows) {
    try {
      await observeAttempt(
        db,
        { id: r.attempt_id, channel: r.channel, status: r.status, amountMinorUnits: Number(r.amount_minor_units), currency: r.currency, providerQrId: r.provider_qr_id, providerOrderId: r.provider_order_id },
        { rzp, keySecret },
      );
    } catch {
      errors += 1;
    }
  }
  return { checked: rows.length, errors };
}
