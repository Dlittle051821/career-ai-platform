import type { BillingSettings, InvoiceBillingSnapshot } from "@/types/payments";
import { isGstConfigured } from "./tax";

/**
 * Builds the frozen billing_snapshot stored on an invoice at the moment it
 * is ISSUED (see src/lib/supabase/admin/invoices.ts's issueInvoice()).
 * Once written, this object is what every invoice/receipt PDF and every
 * "view issued invoice" screen renders from — never a live join back to
 * profiles/billing_settings — so a later edit to the student's name or the
 * business's GST registration can never silently rewrite an
 * already-issued document. See docs/payments-billing-guide.md §7.
 */
export function buildBillingSnapshot(params: {
  studentName: string | null;
  studentEmail: string | null;
  settings: BillingSettings | null;
}): InvoiceBillingSnapshot {
  return {
    studentName: params.studentName?.trim() || "Student",
    studentEmail: params.studentEmail,
    legalEntityName: params.settings?.legalEntityName ?? null,
    businessAddress: params.settings?.businessAddress ?? null,
    gstin: isGstConfigured(params.settings) ? params.settings!.gstin : null,
    gstRegisteredAtIssuance: isGstConfigured(params.settings),
  };
}
