import "server-only";
import { createClient } from "../server";
import { getCurrentUser } from "../profile";
import type { Invoice, InvoiceLineItem, InvoiceStatus, PaymentTransaction, PaymentTransactionStatus } from "@/types/payments";

/**
 * Student-facing invoice reads. Deliberately does NOT check any admin
 * permission — a student is reading their own data, gated purely by
 * `auth.uid() = student_user_id` on public.invoices' own RLS policy (see
 * 0005_payments_billing.sql PART 3). This file exists as a thin,
 * student-scoped counterpart to src/lib/supabase/admin/invoices.ts so the
 * two call paths (admin viewing any invoice, student viewing only their
 * own) never accidentally share a code path that could blur the boundary
 * between them.
 */

function logDbError(context: string, error: unknown) {
  console.error(`[payments/student-invoices] ${context}:`, error);
}

interface InvoiceRow {
  id: string;
  invoice_number: string | null;
  student_user_id: string | null;
  application_id: string | null;
  status: string;
  currency: string;
  subtotal_minor_units: number;
  discount_minor_units: number;
  tax_minor_units: number;
  total_minor_units: number;
  issue_date: string | null;
  due_date: string | null;
  student_notes: string | null;
  billing_snapshot: unknown;
  void_reason: string | null;
  issued_at: string | null;
  paid_at: string | null;
  voided_at: string | null;
  created_at: string;
  updated_at: string;
}

interface LineItemRow {
  id: string;
  description: string;
  quantity: number;
  unit_amount_minor_units: number;
  discount_minor_units: number;
  tax_rate_bps: number | null;
  tax_minor_units: number;
  line_total_minor_units: number;
  sort_order: number;
}

async function getCapturedRefundedTotals(supabase: Awaited<ReturnType<typeof createClient>>, invoiceId: string) {
  const { data: attempts } = await supabase.from("payment_attempts").select("id").eq("invoice_id", invoiceId);
  const attemptIds = (attempts ?? []).map((a) => a.id);
  let capturedTotalMinorUnits = 0;
  if (attemptIds.length > 0) {
    const { data: txns } = await supabase
      .from("payment_transactions")
      .select("amount_minor_units")
      .in("payment_attempt_id", attemptIds)
      .in("status", ["captured", "refunded", "partially_refunded"]);
    capturedTotalMinorUnits = (txns ?? []).reduce((sum, t) => sum + t.amount_minor_units, 0);
  }
  const { data: refunds } = await supabase.from("refunds").select("amount_minor_units").eq("invoice_id", invoiceId).eq("status", "processed");
  const refundedTotalMinorUnits = (refunds ?? []).reduce((sum, r) => sum + r.amount_minor_units, 0);
  return { capturedTotalMinorUnits, refundedTotalMinorUnits };
}

function toInvoice(row: InvoiceRow, lineItems: InvoiceLineItem[], summary: { capturedTotalMinorUnits: number; refundedTotalMinorUnits: number }, studentEmail: string | null): Invoice {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    studentUserId: row.student_user_id,
    studentName: null,
    studentEmail,
    applicationId: row.application_id,
    status: row.status as InvoiceStatus,
    currency: row.currency,
    subtotalMinorUnits: row.subtotal_minor_units,
    discountMinorUnits: row.discount_minor_units,
    taxMinorUnits: row.tax_minor_units,
    totalMinorUnits: row.total_minor_units,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    internalNotes: null, // never exposed to a student — see invoices RLS: this field is never selected below
    studentNotes: row.student_notes,
    billingSnapshot: (row.billing_snapshot as Invoice["billingSnapshot"]) ?? null,
    voidReason: row.void_reason,
    issuedAt: row.issued_at,
    paidAt: row.paid_at,
    voidedAt: row.voided_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lineItems,
    capturedTotalMinorUnits: summary.capturedTotalMinorUnits,
    refundedTotalMinorUnits: summary.refundedTotalMinorUnits,
    dueMinorUnits: Math.max(0, row.total_minor_units - summary.capturedTotalMinorUnits),
  };
}

const STUDENT_INVOICE_COLUMNS =
  "id, invoice_number, student_user_id, application_id, status, currency, subtotal_minor_units, discount_minor_units, tax_minor_units, total_minor_units, issue_date, due_date, student_notes, billing_snapshot, void_reason, issued_at, paid_at, voided_at, created_at, updated_at";

/** Every non-draft invoice belonging to the signed-in student — a draft is never shown to a student (it is not yet a real request for payment). */
export async function listMyInvoices(): Promise<Invoice[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("invoices")
    .select(STUDENT_INVOICE_COLUMNS)
    .eq("student_user_id", user.id)
    .neq("status", "draft")
    .order("created_at", { ascending: false });
  if (error) {
    logDbError("listMyInvoices", error);
    return [];
  }

  const rows = (data ?? []) as InvoiceRow[];
  return Promise.all(
    rows.map(async (row) => {
      const [{ data: lineItemRows }, summary] = await Promise.all([
        supabase.from("invoice_line_items").select("*").eq("invoice_id", row.id).order("sort_order", { ascending: true }),
        getCapturedRefundedTotals(supabase, row.id),
      ]);
      const lineItems = ((lineItemRows ?? []) as LineItemRow[]).map((li) => ({
        id: li.id,
        description: li.description,
        quantity: li.quantity,
        unitAmountMinorUnits: li.unit_amount_minor_units,
        discountMinorUnits: li.discount_minor_units,
        taxRateBps: li.tax_rate_bps,
        taxMinorUnits: li.tax_minor_units,
        lineTotalMinorUnits: li.line_total_minor_units,
        sortOrder: li.sort_order,
      }));
      return toInvoice(row, lineItems, summary, user.email ?? null);
    })
  );
}

/** One invoice, ONLY if it belongs to the signed-in student and isn't a draft — relies on invoices' own RLS ("Students can read their own invoices") as the real boundary; the `.eq("student_user_id", user.id)` here is a defense-in-depth belt, not the enforcement itself. */
export async function getMyInvoiceById(invoiceId: string): Promise<Invoice | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("invoices")
    .select(STUDENT_INVOICE_COLUMNS)
    .eq("id", invoiceId)
    .eq("student_user_id", user.id)
    .neq("status", "draft")
    .maybeSingle();
  if (error) {
    logDbError("getMyInvoiceById", error);
    return null;
  }
  if (!data) return null;
  const row = data as InvoiceRow;

  const [{ data: lineItemRows }, summary] = await Promise.all([
    supabase.from("invoice_line_items").select("*").eq("invoice_id", row.id).order("sort_order", { ascending: true }),
    getCapturedRefundedTotals(supabase, row.id),
  ]);
  const lineItems = ((lineItemRows ?? []) as LineItemRow[]).map((li) => ({
    id: li.id,
    description: li.description,
    quantity: li.quantity,
    unitAmountMinorUnits: li.unit_amount_minor_units,
    discountMinorUnits: li.discount_minor_units,
    taxRateBps: li.tax_rate_bps,
    taxMinorUnits: li.tax_minor_units,
    lineTotalMinorUnits: li.line_total_minor_units,
    sortOrder: li.sort_order,
  }));
  return toInvoice(row, lineItems, summary, user.email ?? null);
}

/**
 * One captured payment_transaction, only if it genuinely belongs to an
 * invoice owned by the signed-in student — used by the student receipt-PDF
 * route. Relies on payment_transactions' own RLS ("Students can read their
 * own payment transactions") as the real boundary; the invoice-ownership
 * check here is defense in depth.
 */
export async function getMyPaymentTransaction(invoiceId: string, transactionId: string): Promise<PaymentTransaction | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();

  const { data: invoice } = await supabase.from("invoices").select("id").eq("id", invoiceId).eq("student_user_id", user.id).maybeSingle();
  if (!invoice) return null;

  // Deliberately two plain queries rather than a PostgREST embedded select —
  // same "avoid embedded selects" convention src/lib/supabase/admin/students.ts
  // follows for its own follow-up lookups.
  const { data: txn, error } = await supabase.from("payment_transactions").select("*").eq("id", transactionId).maybeSingle();
  if (error || !txn) {
    if (error) logDbError("getMyPaymentTransaction", error);
    return null;
  }
  const { data: attempt } = await supabase.from("payment_attempts").select("invoice_id").eq("id", txn.payment_attempt_id).maybeSingle();
  if (!attempt || attempt.invoice_id !== invoiceId) return null;

  return {
    id: txn.id,
    paymentAttemptId: txn.payment_attempt_id,
    providerPaymentId: txn.provider_payment_id,
    isManual: txn.is_manual,
    status: txn.status as PaymentTransactionStatus,
    amountMinorUnits: txn.amount_minor_units,
    amountRefundedMinorUnits: txn.amount_refunded_minor_units,
    currency: txn.currency,
    methodCategory: txn.method_category,
    capturedAt: txn.captured_at,
    failureReason: txn.failure_reason,
    createdAt: txn.created_at,
  };
}
