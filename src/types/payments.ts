/**
 * Milestone 8 — domain types for Payments, Invoicing and Receipts. Mirrors
 * the convention established in src/types/admin.ts: these are the camelCase
 * app-level shapes; the snake_case <-> camelCase mapping lives only in
 * src/lib/supabase/payments/*.ts (see those files' docblocks).
 */

// ---------------------------------------------------------------------------
// Billing settings
// ---------------------------------------------------------------------------

export interface BillingSettings {
  legalEntityName: string | null;
  businessAddress: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  gstRegistered: boolean;
  gstin: string | null;
  defaultTaxRateBps: number | null;
  invoiceFooterNote: string | null;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

export const INVOICE_STATUSES = [
  "draft",
  "issued",
  "partially_paid",
  "paid",
  "overdue",
  "void",
  "refunded",
  "partially_refunded",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  issued: "Issued",
  partially_paid: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
};

/** Statuses a student may still start/resume a checkout against. */
export const PAYABLE_INVOICE_STATUSES: InvoiceStatus[] = ["issued", "partially_paid", "overdue"];

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitAmountMinorUnits: number;
  discountMinorUnits: number;
  taxRateBps: number | null;
  taxMinorUnits: number;
  lineTotalMinorUnits: number;
  sortOrder: number;
}

/** Snapshot of billing-relevant facts frozen at issuance — see src/lib/payments/snapshot.ts for how this is built and why it must never be recomputed from live data after issuance. */
export interface InvoiceBillingSnapshot {
  studentName: string;
  studentEmail: string | null;
  legalEntityName: string | null;
  businessAddress: string | null;
  gstin: string | null;
  gstRegisteredAtIssuance: boolean;
}

export interface Invoice {
  id: string;
  invoiceNumber: string | null;
  studentUserId: string | null;
  studentName: string | null;
  studentEmail: string | null;
  applicationId: string | null;
  status: InvoiceStatus;
  currency: string;
  subtotalMinorUnits: number;
  discountMinorUnits: number;
  taxMinorUnits: number;
  totalMinorUnits: number;
  issueDate: string | null;
  dueDate: string | null;
  internalNotes: string | null;
  studentNotes: string | null;
  billingSnapshot: InvoiceBillingSnapshot | null;
  voidReason: string | null;
  issuedAt: string | null;
  paidAt: string | null;
  voidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lineItems: InvoiceLineItem[];
  /**
   * Aggregated from payment_transactions/refunds at read time (see
   * src/lib/supabase/admin/invoices.ts's getInvoicePaymentSummary) — NOT a
   * stored column. Mirrors the same aggregation public.recompute_invoice_status()
   * uses in SQL, purely for display (how much has actually been captured/
   * refunded/is still owed). Always 0 for a draft invoice.
   */
  capturedTotalMinorUnits: number;
  refundedTotalMinorUnits: number;
  dueMinorUnits: number;
}

// ---------------------------------------------------------------------------
// Payment attempts (one Razorpay order per attempt)
// ---------------------------------------------------------------------------

export const PAYMENT_ATTEMPT_STATUSES = [
  "created",
  "pending",
  "authorized",
  "captured",
  "failed",
  "cancelled",
  "refunded",
  "partially_refunded",
] as const;
export type PaymentAttemptStatus = (typeof PAYMENT_ATTEMPT_STATUSES)[number];

export const PAYMENT_ATTEMPT_STATUS_LABELS: Record<PaymentAttemptStatus, string> = {
  created: "Checkout started",
  pending: "Pending",
  authorized: "Verification pending",
  captured: "Captured",
  failed: "Failed",
  cancelled: "Cancelled",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
};

export interface PaymentAttempt {
  id: string;
  invoiceId: string;
  provider: string;
  providerOrderId: string | null;
  status: PaymentAttemptStatus;
  amountMinorUnits: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Payment transactions (individual gateway payment records)
// ---------------------------------------------------------------------------

export const PAYMENT_TRANSACTION_STATUSES = ["created", "authorized", "captured", "failed", "refunded", "partially_refunded"] as const;
export type PaymentTransactionStatus = (typeof PAYMENT_TRANSACTION_STATUSES)[number];

export const PAYMENT_TRANSACTION_STATUS_LABELS: Record<PaymentTransactionStatus, string> = {
  created: "Created",
  authorized: "Verification pending",
  captured: "Captured",
  failed: "Failed",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
};

export interface PaymentTransaction {
  id: string;
  paymentAttemptId: string;
  providerPaymentId: string | null;
  isManual: boolean;
  status: PaymentTransactionStatus;
  amountMinorUnits: number;
  amountRefundedMinorUnits: number;
  currency: string;
  methodCategory: string | null;
  capturedAt: string | null;
  failureReason: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Refunds
// ---------------------------------------------------------------------------

export const REFUND_STATUSES = ["requested", "processing", "processed", "failed"] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export const REFUND_STATUS_LABELS: Record<RefundStatus, string> = {
  requested: "Requested",
  processing: "Processing",
  processed: "Completed",
  failed: "Failed",
};

export interface Refund {
  id: string;
  paymentTransactionId: string;
  invoiceId: string;
  providerRefundId: string | null;
  amountMinorUnits: number;
  status: RefundStatus;
  reason: string | null;
  initiatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Webhook events
// ---------------------------------------------------------------------------

export type WebhookProcessingStatus = "received" | "processed" | "ignored" | "failed";

export interface WebhookEvent {
  id: string;
  provider: string;
  eventType: string;
  processingStatus: WebhookProcessingStatus;
  relatedInvoiceId: string | null;
  diagnosticMessage: string | null;
  payloadSummary: Record<string, unknown> | null;
  createdAt: string;
  processedAt: string | null;
}

// ---------------------------------------------------------------------------
// Payment request tokens
// ---------------------------------------------------------------------------

export interface PaymentRequestToken {
  id: string;
  invoiceId: string;
  expiresAt: string;
  createdAt: string;
  revokedAt: string | null;
}

// ---------------------------------------------------------------------------
// Shared list-page shape (mirrors src/types/admin.ts's AdminListResult)
// ---------------------------------------------------------------------------

export interface PaymentsListResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
