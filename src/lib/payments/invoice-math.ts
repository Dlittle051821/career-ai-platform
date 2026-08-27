import { sumMinorUnits } from "@/lib/admin/money";

/**
 * All invoice line-item and total arithmetic, in one pure, dependency-free
 * place — same rationale as src/lib/admin/money.ts: every amount is an
 * integer in the currency's minor unit (paise for INR), and nowhere else in
 * the payments module should do float arithmetic on money. The server
 * ALWAYS recomputes every value here from quantity/unitAmount/discount/tax
 * on every write (see src/lib/supabase/admin/invoices.ts) — a line item's
 * `lineTotalMinorUnits` supplied by a client is never trusted as-is.
 */

export interface LineItemInput {
  quantity: number;
  unitAmountMinorUnits: number;
  discountMinorUnits: number;
  /** basis points, e.g. 1800 = 18.00%. null means no tax applies to this line. */
  taxRateBps: number | null;
}

export interface ComputedLineItem {
  grossMinorUnits: number;
  discountMinorUnits: number;
  taxMinorUnits: number;
  lineTotalMinorUnits: number;
}

/**
 * Computes one line's gross/tax/total from its inputs. Quantity may be
 * fractional (e.g. 2.5 hours of counselling) — the gross amount is rounded
 * to the nearest minor unit exactly once, at the point money first becomes
 * an amount, matching the same "round once, immediately" discipline
 * parseMoneyInput() uses.
 */
export function computeLineItem(input: LineItemInput): ComputedLineItem {
  const grossMinorUnits = Math.round(input.quantity * input.unitAmountMinorUnits);
  const discountMinorUnits = Math.min(Math.max(0, Math.round(input.discountMinorUnits)), grossMinorUnits);
  const taxableBase = Math.max(0, grossMinorUnits - discountMinorUnits);
  const taxMinorUnits = input.taxRateBps ? Math.round((taxableBase * input.taxRateBps) / 10_000) : 0;
  const lineTotalMinorUnits = taxableBase + taxMinorUnits;

  return { grossMinorUnits, discountMinorUnits, taxMinorUnits, lineTotalMinorUnits };
}

export interface InvoiceTotals {
  subtotalMinorUnits: number;
  discountMinorUnits: number;
  taxMinorUnits: number;
  totalMinorUnits: number;
}

/** Sums a full set of already-computed line items into the invoice-level totals stored on the invoices row. */
export function computeInvoiceTotals(lines: ComputedLineItem[]): InvoiceTotals {
  return {
    subtotalMinorUnits: sumMinorUnits(lines.map((l) => l.grossMinorUnits)),
    discountMinorUnits: sumMinorUnits(lines.map((l) => l.discountMinorUnits)),
    taxMinorUnits: sumMinorUnits(lines.map((l) => l.taxMinorUnits)),
    totalMinorUnits: sumMinorUnits(lines.map((l) => l.lineTotalMinorUnits)),
  };
}

/** True when at least one line item exists and every amount is non-negative and the total is positive — the minimum an invoice needs before it can be issued. */
export function isInvoiceIssuable(lines: ComputedLineItem[]): boolean {
  if (lines.length === 0) return false;
  const totals = computeInvoiceTotals(lines);
  return totals.totalMinorUnits > 0;
}
