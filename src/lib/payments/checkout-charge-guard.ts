/**
 * Fail-closed validation of what a checkout is about to charge, run on the
 * server immediately before a payment-gateway order is created or reused
 * (src/lib/supabase/payments/checkout.ts). Pure and directly testable.
 *
 * Why it exists: the live public.purchase_pricing_plan() adds GST on top of
 * every plan once GST is configured, ignoring the plan version's tax_status
 * (see src/lib/pricing/plan-purchase-tax.ts). That would turn the ₹1,999
 * GST-inclusive "Nextwise Verified" price into ₹2,358.82. The SQL correction
 * (supabase/migrations-proposed/NW01_fix_purchase_pricing_plan_tax_handling.sql)
 * is not approved or applied, so the application refuses to charge any
 * amount it cannot prove is correct instead of trusting the invoice.
 *
 * Rules:
 * - Every invoice: amounts are safe non-negative integers, the currency is a
 *   3-letter code, at least one line exists, line totals add up to the
 *   invoice total, and the amount to charge is positive and never more than
 *   the invoice total.
 * - Plan-purchase invoices: the invoice must match its frozen purchase
 *   record exactly. Tax may only be ADDED on top when the plan version is
 *   readable and explicitly `tax_exclusive`, at the line's own rate;
 *   otherwise the total must equal the price minus discount.
 * - Nextwise Verified: the customer pays exactly ₹1,999 (199,900 paise) in
 *   INR, in one payment, inclusive of any GST, with no discount. Any GST share must be the
 *   inclusive back-calculation at the line's rate. Anything else fails.
 * - Missing or unreadable data (including an unidentifiable plan) is a failure, never a pass.
 * - The database enforces the same amount rules on payment attempts
 *   (supabase/migrations-proposed/nw-f01-s3/05_payment_attempt_integrity.sql).
 */

export const NEXTWISE_VERIFIED = Object.freeze({
  slug: "nextwise-verified",
  name: "Nextwise Verified",
  payableMinorUnits: 199_900,
  currency: "INR",
});

export type CheckoutChargeFailure =
  | "missing_configuration"
  | "invalid_amounts"
  | "unsupported_currency"
  | "line_items_mismatch"
  | "purchase_mismatch"
  | "invalid_tax_configuration"
  | "verified_price_mismatch"
  | "invalid_charge_amount";

export type CheckoutChargeResult = { ok: true } | { ok: false; reason: CheckoutChargeFailure };

export interface ChargeInvoice {
  currency: string;
  subtotalMinorUnits: number;
  discountMinorUnits: number;
  taxMinorUnits: number;
  totalMinorUnits: number;
}

export interface ChargeLineItem {
  taxRateBps: number | null;
  taxMinorUnits: number;
  lineTotalMinorUnits: number;
}

export interface ChargePurchase {
  planSlug: string | null;
  planNameAtPurchase: string;
  originalMinorUnits: number;
  discountMinorUnits: number;
  taxMinorUnits: number;
  finalMinorUnits: number;
  currency: string;
  /** The plan version's tax_status, or null when it could not be read. */
  versionTaxStatus: "unconfigured" | "tax_exclusive" | "tax_inclusive" | null;
}

export interface ChargeInput {
  invoice: ChargeInvoice | null;
  lineItems: ChargeLineItem[] | null;
  /** null = the invoice is not a plan purchase; undefined = the lookup failed. */
  purchase: ChargePurchase | null | undefined;
  /** What the gateway order will be (or was) created for. */
  chargeMinorUnits: number;
}

const fail = (reason: CheckoutChargeFailure): CheckoutChargeResult => ({ ok: false, reason });
const isAmount = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
const isRate = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n > 0 && n <= 10_000;
const isCurrency = (c: unknown): c is string => typeof c === "string" && /^[A-Z]{3}$/.test(c);

/** Share of a tax-INCLUSIVE amount that is tax, at `rateBps` (1800 = 18%). */
export function inclusiveTaxShare(inclusiveMinorUnits: number, rateBps: number): number {
  return Math.round((inclusiveMinorUnits * rateBps) / (10_000 + rateBps));
}

export function isNextwiseVerifiedPurchase(purchase: Pick<ChargePurchase, "planSlug" | "planNameAtPurchase">): boolean {
  return purchase.planSlug === NEXTWISE_VERIFIED.slug || purchase.planNameAtPurchase.trim().toLowerCase() === NEXTWISE_VERIFIED.name.toLowerCase();
}

/** The one tax rate used by the invoice's taxed lines; null if none are taxed; "conflict" if they disagree or are invalid. */
function lineTaxRate(lines: ChargeLineItem[]): number | null | "conflict" {
  const rates = new Set<number>();
  for (const line of lines) {
    if (line.taxMinorUnits === 0 && line.taxRateBps === null) continue;
    if (!isRate(line.taxRateBps)) return "conflict";
    rates.add(line.taxRateBps);
  }
  if (rates.size > 1) return "conflict";
  const [rate] = [...rates];
  return rate ?? null;
}

function validateInvoice(invoice: ChargeInvoice, lines: ChargeLineItem[], charge: number): CheckoutChargeResult {
  const amounts = [invoice.subtotalMinorUnits, invoice.discountMinorUnits, invoice.taxMinorUnits, invoice.totalMinorUnits, charge];
  if (!amounts.every(isAmount)) return fail("invalid_amounts");
  if (!isCurrency(invoice.currency)) return fail("unsupported_currency");
  if (lines.length === 0) return fail("line_items_mismatch");
  for (const line of lines) if (!isAmount(line.lineTotalMinorUnits) || !isAmount(line.taxMinorUnits)) return fail("invalid_amounts");
  const lineTotal = lines.reduce((sum, l) => sum + l.lineTotalMinorUnits, 0);
  const lineTax = lines.reduce((sum, l) => sum + l.taxMinorUnits, 0);
  if (lineTotal !== invoice.totalMinorUnits || lineTax !== invoice.taxMinorUnits) return fail("line_items_mismatch");
  if (charge <= 0 || charge > invoice.totalMinorUnits) return fail("invalid_charge_amount");
  return { ok: true };
}

function validatePurchase(invoice: ChargeInvoice, lines: ChargeLineItem[], purchase: ChargePurchase): CheckoutChargeResult {
  const amounts = [purchase.originalMinorUnits, purchase.discountMinorUnits, purchase.taxMinorUnits, purchase.finalMinorUnits];
  if (!amounts.every(isAmount)) return fail("invalid_amounts");
  if (
    purchase.currency !== invoice.currency ||
    purchase.finalMinorUnits !== invoice.totalMinorUnits ||
    purchase.taxMinorUnits !== invoice.taxMinorUnits ||
    purchase.discountMinorUnits !== invoice.discountMinorUnits ||
    purchase.originalMinorUnits !== invoice.subtotalMinorUnits
  ) {
    return fail("purchase_mismatch");
  }
  if (purchase.discountMinorUnits > purchase.originalMinorUnits) return fail("invalid_amounts");

  const base = purchase.originalMinorUnits - purchase.discountMinorUnits;
  const rate = lineTaxRate(lines);
  if (rate === "conflict") return fail("invalid_tax_configuration");
  if (purchase.taxMinorUnits > 0 && rate === null) return fail("invalid_tax_configuration");

  if (purchase.finalMinorUnits === base) {
    // Tax-inclusive (or no tax): any tax figure must be the inclusive share at the line rate.
    if (purchase.taxMinorUnits > 0 && rate !== null && purchase.taxMinorUnits !== inclusiveTaxShare(base, rate)) {
      return fail("invalid_tax_configuration");
    }
    return { ok: true };
  }
  // Tax added on top: only for an explicitly tax-exclusive version, at the line rate.
  if (purchase.versionTaxStatus !== "tax_exclusive" || rate === null) return fail("invalid_tax_configuration");
  const expectedTax = Math.round((base * rate) / 10_000);
  if (purchase.taxMinorUnits !== expectedTax || purchase.finalMinorUnits !== base + expectedTax) return fail("invalid_tax_configuration");
  return { ok: true };
}

function validateVerified(invoice: ChargeInvoice, lines: ChargeLineItem[], purchase: ChargePurchase, charge: number): CheckoutChargeResult {
  const price = NEXTWISE_VERIFIED.payableMinorUnits;
  // One payment of exactly the price: no partial or split charges (CC-15 re-review P2).
  if (charge !== price) return fail("verified_price_mismatch");
  if (invoice.currency !== NEXTWISE_VERIFIED.currency || purchase.currency !== NEXTWISE_VERIFIED.currency) return fail("verified_price_mismatch");
  if (purchase.originalMinorUnits !== price || purchase.discountMinorUnits !== 0) return fail("verified_price_mismatch");
  if (purchase.finalMinorUnits !== price || invoice.totalMinorUnits !== price) return fail("verified_price_mismatch");
  if (purchase.versionTaxStatus === "tax_exclusive") return fail("invalid_tax_configuration");
  const rate = lineTaxRate(lines);
  if (rate === "conflict") return fail("invalid_tax_configuration");
  if (purchase.taxMinorUnits > 0 && (rate === null || purchase.taxMinorUnits !== inclusiveTaxShare(price, rate))) {
    return fail("invalid_tax_configuration");
  }
  return { ok: true };
}

export function validateCheckoutCharge(input: ChargeInput): CheckoutChargeResult {
  if (!input.invoice || !input.lineItems || input.purchase === undefined) return fail("missing_configuration");
  const invoiceCheck = validateInvoice(input.invoice, input.lineItems, input.chargeMinorUnits);
  if (!invoiceCheck.ok) return invoiceCheck;
  if (input.purchase === null) return { ok: true };

  const isVerified = isNextwiseVerifiedPurchase(input.purchase);
  // A plan purchase whose plan cannot be identified cannot be validated (CC-15 re-review P2).
  if (input.purchase.planSlug === null && !isVerified) return fail("missing_configuration");
  const purchaseCheck = validatePurchase(input.invoice, input.lineItems, input.purchase);
  if (isVerified) {
    const verifiedCheck = validateVerified(input.invoice, input.lineItems, input.purchase, input.chargeMinorUnits);
    if (!verifiedCheck.ok) return verifiedCheck;
  }
  return purchaseCheck;
}

/** Student-facing message: never reveals internal amounts or configuration. */
export const CHECKOUT_CHARGE_BLOCKED_MESSAGE =
  "We can't take payment for this invoice right now because its price couldn't be verified. You have not been charged. Please contact support.";
