import "server-only";
import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { recordAuditLog } from "./audit";
import { AdminValidationError } from "@/lib/admin/form-state";
import { getPaymentGateway } from "@/lib/payments/get-gateway";
import type { PaymentAttempt, PaymentAttemptStatus, PaymentTransaction, PaymentTransactionStatus } from "@/types/payments";

/**
 * Payment attempt / transaction reads, plus admin-triggered reconciliation
 * ("refresh from gateway") for when a webhook delivery is delayed, was
 * missed, or a local/test-mode environment has no public URL for Razorpay
 * to call. This is the one place OTHER than the webhook route and
 * verify_checkout_payment() that a payment_transactions row's status can
 * move — and even here, the actual truth still comes from
 * gateway.fetchPayment() (a real Razorpay API call), never from anything
 * the admin types in. See docs/payments-billing-guide.md §6.
 */

function logDbError(context: string, error: unknown) {
  console.error(`[admin/payment-attempts] ${context}:`, error);
}

interface AttemptRow {
  id: string;
  invoice_id: string;
  provider: string;
  provider_order_id: string | null;
  status: string;
  amount_minor_units: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

interface TransactionRow {
  id: string;
  payment_attempt_id: string;
  provider_payment_id: string | null;
  is_manual: boolean;
  status: string;
  amount_minor_units: number;
  amount_refunded_minor_units: number;
  currency: string;
  method_category: string | null;
  captured_at: string | null;
  failure_reason: string | null;
  created_at: string;
}

function toAttempt(row: AttemptRow): PaymentAttempt {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    provider: row.provider,
    providerOrderId: row.provider_order_id,
    status: row.status as PaymentAttemptStatus,
    amountMinorUnits: row.amount_minor_units,
    currency: row.currency,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toTransaction(row: TransactionRow): PaymentTransaction {
  return {
    id: row.id,
    paymentAttemptId: row.payment_attempt_id,
    providerPaymentId: row.provider_payment_id,
    isManual: row.is_manual,
    status: row.status as PaymentTransactionStatus,
    amountMinorUnits: row.amount_minor_units,
    amountRefundedMinorUnits: row.amount_refunded_minor_units,
    currency: row.currency,
    methodCategory: row.method_category,
    capturedAt: row.captured_at,
    failureReason: row.failure_reason,
    createdAt: row.created_at,
  };
}

export interface PaymentActivityItem {
  attempt: PaymentAttempt;
  transactions: PaymentTransaction[];
}

/** One payment_transactions row, only if it actually belongs to the given invoice — used by the admin receipt-PDF route so a valid transaction id can never be used to pull a receipt for the wrong invoice. */
export async function getInvoicePaymentTransaction(invoiceId: string, transactionId: string): Promise<PaymentTransaction | null> {
  await requireAdminPermission("invoices:read");
  const supabase = await createClient();

  const { data: txn, error: txnError } = await supabase.from("payment_transactions").select("*").eq("id", transactionId).maybeSingle();
  if (txnError) {
    logDbError("getInvoicePaymentTransaction", txnError);
    return null;
  }
  if (!txn) return null;
  const row = txn as TransactionRow;

  const { data: attempt, error: attemptError } = await supabase.from("payment_attempts").select("invoice_id").eq("id", row.payment_attempt_id).maybeSingle();
  if (attemptError || !attempt || attempt.invoice_id !== invoiceId) return null;

  return toTransaction(row);
}

/** Every payment attempt (and its transactions) for one invoice, newest first — the "payment activity" list on an admin invoice detail page. */
export async function getInvoicePaymentActivity(invoiceId: string): Promise<PaymentActivityItem[]> {
  await requireAdminPermission("invoices:read");
  const supabase = await createClient();

  const { data: attemptRows, error: attemptError } = await supabase
    .from("payment_attempts")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: false });
  if (attemptError) {
    logDbError("getInvoicePaymentActivity:attempts", attemptError);
    return [];
  }
  const attempts = (attemptRows ?? []) as AttemptRow[];
  if (attempts.length === 0) return [];

  const { data: txnRows, error: txnError } = await supabase
    .from("payment_transactions")
    .select("*")
    .in("payment_attempt_id", attempts.map((a) => a.id))
    .order("created_at", { ascending: false });
  if (txnError) logDbError("getInvoicePaymentActivity:transactions", txnError);

  const txnsByAttempt = new Map<string, PaymentTransaction[]>();
  for (const row of (txnRows ?? []) as TransactionRow[]) {
    const list = txnsByAttempt.get(row.payment_attempt_id) ?? [];
    list.push(toTransaction(row));
    txnsByAttempt.set(row.payment_attempt_id, list);
  }

  return attempts.map((row) => ({ attempt: toAttempt(row), transactions: txnsByAttempt.get(row.id) ?? [] }));
}

/**
 * "Only move forward" status mapping — mirrors the ON CONFLICT logic inside
 * public.apply_webhook_event() so a reconciliation fetch can never demote an
 * already-captured transaction back to authorized, or resurrect a failed one.
 */
function nextTransactionStatus(current: PaymentTransactionStatus, fetched: string): PaymentTransactionStatus {
  const mapped: PaymentTransactionStatus | null = fetched === "captured" ? "captured" : fetched === "authorized" ? "authorized" : fetched === "failed" ? "failed" : fetched === "refunded" ? "refunded" : null;
  if (!mapped) return current;
  if (current === "captured" && mapped === "authorized") return current;
  if (current === "failed") return current;
  return mapped;
}

/**
 * Re-fetches the current status of a payment attempt's transaction directly
 * from Razorpay (gateway.fetchPayment) and applies it locally, for when a
 * webhook delivery was delayed or missed (e.g. local development with no
 * public URL configured). Never marks anything "captured" from anything
 * other than this real gateway API response.
 */
export async function reconcilePaymentAttempt(attemptId: string): Promise<void> {
  await requireAdminPermission("invoices:write");
  const supabase = await createClient();

  const { data: attempt, error: attemptError } = await supabase.from("payment_attempts").select("*").eq("id", attemptId).maybeSingle();
  if (attemptError || !attempt) throw new AdminValidationError("Payment attempt not found.");

  const { data: txnRows, error: txnError } = await supabase
    .from("payment_transactions")
    .select("*")
    .eq("payment_attempt_id", attemptId)
    .not("provider_payment_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (txnError) {
    logDbError("reconcilePaymentAttempt:transactions", txnError);
    throw new Error(txnError.message);
  }
  const txn = (txnRows ?? [])[0] as TransactionRow | undefined;
  if (!txn || !txn.provider_payment_id) {
    throw new AdminValidationError("No gateway payment has been recorded against this attempt yet — nothing to reconcile.");
  }

  const gateway = getPaymentGateway();
  if (!gateway) throw new AdminValidationError("Payment gateway is not configured.");

  const fetched = await gateway.fetchPayment(txn.provider_payment_id);
  const newStatus = nextTransactionStatus(txn.status as PaymentTransactionStatus, fetched.status);

  const { error: updateError } = await supabase
    .from("payment_transactions")
    .update({
      status: newStatus,
      captured_at: newStatus === "captured" ? (txn.captured_at ?? new Date().toISOString()) : txn.captured_at,
      failure_reason: fetched.errorDescription ?? txn.failure_reason,
      raw_status: fetched.status,
    })
    .eq("id", txn.id);
  if (updateError) {
    logDbError("reconcilePaymentAttempt:update", updateError);
    throw new Error(updateError.message);
  }

  await supabase
    .from("payment_attempts")
    .update({ status: newStatus === "authorized" && attempt.status === "captured" ? attempt.status : newStatus })
    .eq("id", attemptId);

  const { error: recomputeError } = await supabase.rpc("recompute_invoice_status", { p_invoice_id: attempt.invoice_id });
  if (recomputeError) logDbError("reconcilePaymentAttempt:recompute", recomputeError);

  await recordAuditLog({
    action: "Reconciled",
    entityType: "invoice",
    entityId: attempt.invoice_id,
    entityLabel: `payment attempt ${attemptId}`,
    fieldChangeSummaries: [`transaction status: ${txn.status} -> ${newStatus} (from live gateway lookup)`],
    before: { status: txn.status },
    after: { status: newStatus, gatewayStatus: fetched.status },
  });
}
