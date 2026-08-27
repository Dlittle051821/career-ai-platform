import type { BillingSettings } from "@/types/payments";

/**
 * The single gate every tax-field-rendering codepath (invoice forms, PDF
 * generation, the student-facing invoice view) must check before showing
 * GST/tax information. Deliberately conservative: gst_registered=true with
 * an empty/whitespace gstin is still "not configured" — see
 * 0005_payments_billing.sql's billing_settings_gstin_requires_flag
 * constraint, which is the DB-level half of this same rule.
 *
 * "Do not call a document a legally compliant GST tax invoice unless GST
 * registration details and required tax fields have actually been
 * configured and validated. Do not fabricate GSTIN, tax rates, legal
 * entity names, addresses or registration information." — spec.
 */
export function isGstConfigured(settings: BillingSettings | null): boolean {
  return !!settings && settings.gstRegistered && !!settings.gstin && settings.gstin.trim().length > 0;
}

/**
 * The tax rate (basis points, e.g. 1800 = 18.00%) that should apply to a
 * new line item, honoring an explicit per-line override first and falling
 * back to billing_settings' configured default — but ONLY when GST is
 * actually configured. If GST is not configured, this always returns
 * null: never invent a tax rate that was never set up.
 */
export function applicableTaxRateBps(settings: BillingSettings | null, lineItemOverrideBps: number | null): number | null {
  if (!isGstConfigured(settings)) return null;
  if (lineItemOverrideBps !== null) return lineItemOverrideBps;
  return settings?.defaultTaxRateBps ?? null;
}

/** A short, honest label for wherever a document needs to say what kind of document it is — never claims "Tax Invoice" unless GST is genuinely configured. */
export function invoiceDocumentLabel(settings: BillingSettings | null): string {
  return isGstConfigured(settings) ? "Tax Invoice" : "Invoice";
}
