import type { InvoiceStatus } from "@/types/payments";

/**
 * Pure TypeScript mirror of the decision table in
 * public.recompute_invoice_status() (0005_payments_billing.sql PART 6.5).
 * SQL remains authoritative for the actual database write — this function
 * exists so the admin/student UI can show a consistent, testable
 * explanation of "why is this invoice in this status" without a round
 * trip, and so the logic itself is covered by src/lib/payments/*.test.ts.
 * If you change one, change the other — see the comment on the SQL
 * function for the reminder in the other direction.
 */
export function deriveInvoiceStatus(params: {
  currentStatus: InvoiceStatus;
  totalMinorUnits: number;
  capturedTotalMinorUnits: number;
  refundedTotalMinorUnits: number;
  dueDate: string | null;
  today: string;
}): InvoiceStatus {
  const { currentStatus, totalMinorUnits, capturedTotalMinorUnits, refundedTotalMinorUnits, dueDate, today } = params;

  // draft/void are never touched by recomputation — see the SQL function's
  // identical early-return for why.
  if (currentStatus === "draft" || currentStatus === "void") return currentStatus;

  if (refundedTotalMinorUnits > 0 && refundedTotalMinorUnits >= capturedTotalMinorUnits && capturedTotalMinorUnits >= totalMinorUnits && totalMinorUnits > 0) {
    return "refunded";
  }
  if (refundedTotalMinorUnits > 0) return "partially_refunded";
  if (capturedTotalMinorUnits >= totalMinorUnits && totalMinorUnits > 0) return "paid";
  if (capturedTotalMinorUnits > 0) return "partially_paid";
  if (dueDate && dueDate < today) return "overdue";
  return "issued";
}
