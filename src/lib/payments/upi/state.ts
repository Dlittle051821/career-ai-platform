/**
 * NW-PAYMENT-V1 — the checkout state the page renders, parsed from
 * get_quote_checkout_state(). Pure, client-safe and unit-tested. The phase is
 * derived ONLY from what the database recorded: "paid" means the invoice is
 * paid, never that a timer ran out or a button was pressed.
 */

export type UpiChannel = "upi_qr" | "upi_checkout";

export interface CheckoutState {
  quote: {
    id: string;
    status: string;
    planSlug: string;
    planName: string;
    currency: string;
    baseMinor: number;
    includedUniversities: number | null;
    additionalUniversities: number;
    addonUnitMinor: number | null;
    addonMinor: number;
    totalMinor: number;
    expiresAt: string;
  };
  invoice: { id: string; status: string; number: string | null; totalMinor: number; taxMinor: number; currency: string; paidAt: string | null; settledTransactionId: string | null; superseded: boolean } | null;
  attempt: {
    id: string;
    channel: UpiChannel | null;
    status: string;
    amountMinor: number;
    qrImageUrl: string | null;
    expiresAt: string | null;
    reference: string;
    hasGatewayObject: boolean;
    closeReason: string | null;
  } | null;
  settled: { transactionId: string; paymentId: string; amountMinor: number; method: string | null; capturedAt: string | null } | null;
  lastPayment: { status: string; failureReason: string | null } | null;
  purchaseId: string | null;
}

export type CheckoutPhase =
  | "not_started" // no invoice yet
  | "awaiting_payment" // live QR / order, nothing received yet
  | "processing" // the gateway reported an authorised payment that is not yet captured
  | "failed" // the last payment failed; the student may retry
  | "expired" // the QR expired with nothing received; a new one can be made
  | "paid" // the invoice is paid (verified)
  | "unavailable"; // the checkout can no longer be paid (superseded / stale)

const num = (v: unknown): number => (typeof v === "number" ? v : Number(v));
const str = (v: unknown): string => (typeof v === "string" ? v : String(v ?? ""));
const strOrNull = (v: unknown): string | null => (typeof v === "string" ? v : null);

export function parseCheckoutState(raw: unknown): CheckoutState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, Record<string, unknown> | null | string>;
  const q = r.quote as Record<string, unknown> | null;
  if (!q) return null;
  const inv = r.invoice as Record<string, unknown> | null;
  const att = r.attempt as Record<string, unknown> | null;
  const set = r.settled as Record<string, unknown> | null;
  const last = r.lastPayment as Record<string, unknown> | null;
  const channel = att?.channel === "upi_qr" || att?.channel === "upi_checkout" ? att.channel : null;
  return {
    quote: {
      id: str(q.id),
      status: str(q.status),
      planSlug: str(q.planSlug),
      planName: str(q.planName),
      currency: str(q.currency),
      baseMinor: num(q.baseMinor),
      includedUniversities: q.includedUniversities == null ? null : num(q.includedUniversities),
      additionalUniversities: num(q.additionalUniversities ?? 0),
      addonUnitMinor: q.addonUnitMinor == null ? null : num(q.addonUnitMinor),
      addonMinor: num(q.addonMinor ?? 0),
      totalMinor: num(q.totalMinor),
      expiresAt: str(q.expiresAt),
    },
    invoice: inv
      ? {
          id: str(inv.id),
          status: str(inv.status),
          number: strOrNull(inv.number),
          totalMinor: num(inv.totalMinor),
          taxMinor: num(inv.taxMinor ?? 0),
          currency: str(inv.currency),
          paidAt: strOrNull(inv.paidAt),
          settledTransactionId: strOrNull(inv.settledTransactionId),
          superseded: inv.superseded === true,
        }
      : null,
    attempt: att
      ? {
          id: str(att.id),
          channel,
          status: str(att.status),
          amountMinor: num(att.amountMinor),
          qrImageUrl: strOrNull(att.qrImageUrl),
          expiresAt: strOrNull(att.expiresAt),
          reference: str(att.reference),
          hasGatewayObject: att.hasGatewayObject === true,
          closeReason: strOrNull(att.closeReason),
        }
      : null,
    settled: set
      ? { transactionId: str(set.transactionId), paymentId: str(set.paymentId), amountMinor: num(set.amountMinor), method: strOrNull(set.method), capturedAt: strOrNull(set.capturedAt) }
      : null,
    lastPayment: last ? { status: str(last.status), failureReason: strOrNull(last.failureReason) } : null,
    purchaseId: strOrNull(r.purchaseId),
  };
}

export function checkoutPhase(state: CheckoutState | null, now: number = Date.now()): CheckoutPhase {
  if (!state) return "unavailable";
  const { invoice, attempt } = state;
  if (invoice && invoice.status === "paid" && invoice.settledTransactionId) return "paid";
  if (!invoice) return state.quote.status === "open" ? "not_started" : "unavailable";
  if (invoice.status !== "draft" || invoice.superseded) return "unavailable";
  if (!attempt) return "not_started";
  if (attempt.status === "authorized") return "processing";
  if (attempt.status === "failed" || (state.lastPayment?.status === "failed" && attempt.status !== "pending")) return "failed";
  if (attempt.status === "cancelled") return attempt.closeReason === "superseded" ? "unavailable" : "expired";
  if (attempt.channel === "upi_qr" && attempt.expiresAt && Date.parse(attempt.expiresAt) <= now) return "expired";
  return "awaiting_payment";
}
