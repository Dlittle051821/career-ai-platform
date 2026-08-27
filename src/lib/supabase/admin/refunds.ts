import "server-only";
import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { recordAuditLog } from "./audit";
import { AdminValidationError } from "@/lib/admin/form-state";
import { parseMoneyInput, formatMoney } from "@/lib/admin/money";
import { getPaymentGateway } from "@/lib/payments/get-gateway";
import { PaymentGatewayNotConfiguredError } from "@/lib/payments/gateway";
import { cleanFilterParam, clampPageSize, pageToRange, parsePageParam } from "@/lib/admin/pagination";
import type { Refund, RefundStatus, PaymentsListResult } from "@/types/payments";

/**
 * Refunds — only ever initiated against a gateway-verified (non-manual)
 * captured payment_transaction. Offline/manual payments cannot be refunded
 * through this path (there is no gateway payment to refund) — an admin
 * reverses those by other means (e.g. a direct bank transfer back), which
 * this system does not attempt to automate or record as a `refunds` row,
 * to avoid implying a refund happened through a channel it didn't.
 */

function logDbError(context: string, error: unknown) {
  console.error(`[admin/refunds] ${context}:`, error);
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

interface RefundRow {
  id: string;
  payment_transaction_id: string;
  invoice_id: string;
  provider_refund_id: string | null;
  amount_minor_units: number;
  status: string;
  reason: string | null;
  initiated_by: string | null;
  created_at: string;
  updated_at: string;
}

function toRefund(row: RefundRow): Refund {
  return {
    id: row.id,
    paymentTransactionId: row.payment_transaction_id,
    invoiceId: row.invoice_id,
    providerRefundId: row.provider_refund_id,
    amountMinorUnits: row.amount_minor_units,
    status: row.status as RefundStatus,
    reason: row.reason,
    initiatedBy: row.initiated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface RefundFilters {
  query?: string;
  status?: RefundStatus;
  invoiceId?: string;
  page?: number;
}

const PAGE_SIZE = 20;

export async function listRefunds(filters: RefundFilters = {}): Promise<PaymentsListResult<Refund>> {
  await requireAdminPermission("refunds:read");
  const supabase = await createClient();
  const page = parsePageParam(String(filters.page ?? 1));
  const pageSize = clampPageSize(PAGE_SIZE);
  const { from, to } = pageToRange(page, pageSize);

  let query = supabase.from("refunds").select("*", { count: "exact" }).order("created_at", { ascending: false });
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.invoiceId) query = query.eq("invoice_id", filters.invoiceId);
  const cleanedQuery = cleanFilterParam(filters.query);
  if (cleanedQuery) query = query.ilike("provider_refund_id", `%${cleanedQuery.replace(/[,()%]/g, "")}%`);

  const { data, error, count } = await query.range(from, to);
  if (error) {
    logDbError("listRefunds", error);
    return { items: [], total: 0, page, pageSize };
  }
  return { items: ((data ?? []) as RefundRow[]).map(toRefund), total: count ?? 0, page, pageSize };
}

export async function getRefundById(id: string): Promise<Refund | null> {
  await requireAdminPermission("refunds:read");
  const supabase = await createClient();
  const { data, error } = await supabase.from("refunds").select("*").eq("id", id).maybeSingle();
  if (error) {
    logDbError("getRefundById", error);
    return null;
  }
  return data ? toRefund(data as RefundRow) : null;
}

interface EligibleTransaction {
  id: string;
  invoiceId: string;
  providerPaymentId: string;
  amountMinorUnits: number;
  amountRefundedMinorUnits: number;
  currency: string;
}

async function loadEligibleTransaction(supabase: Supabase, paymentTransactionId: string): Promise<EligibleTransaction> {
  const { data, error } = await supabase
    .from("payment_transactions")
    .select("id, provider_payment_id, is_manual, status, amount_minor_units, amount_refunded_minor_units, currency, payment_attempt_id")
    .eq("id", paymentTransactionId)
    .maybeSingle();
  if (error) {
    logDbError("loadEligibleTransaction", error);
    throw new Error(error.message);
  }
  if (!data) throw new AdminValidationError("Payment transaction not found.");
  if (data.is_manual || !data.provider_payment_id) {
    throw new AdminValidationError("This was an offline (manually recorded) payment and cannot be refunded through the payment gateway. Reverse it by your usual offline means instead.");
  }
  if (data.status !== "captured" && data.status !== "partially_refunded") {
    throw new AdminValidationError(`Only a captured payment can be refunded (this one is "${data.status}").`);
  }

  const { data: attempt, error: attemptError } = await supabase.from("payment_attempts").select("invoice_id").eq("id", data.payment_attempt_id).maybeSingle();
  if (attemptError || !attempt) {
    logDbError("loadEligibleTransaction:attempt", attemptError);
    throw new Error("Could not resolve the invoice for this payment.");
  }

  return {
    id: data.id,
    invoiceId: attempt.invoice_id,
    providerPaymentId: data.provider_payment_id,
    amountMinorUnits: data.amount_minor_units,
    amountRefundedMinorUnits: data.amount_refunded_minor_units,
    currency: data.currency,
  };
}

/**
 * Initiates a refund: creates a `requested` refunds row FIRST (the
 * refunds_one_open_per_transaction partial unique index rejects a second
 * concurrent request against the same transaction), then calls the
 * gateway. Final confirmation that the refund actually completed comes
 * from the `refund.processed` webhook (see the webhook route handler) —
 * this function only records that a refund was requested and forwarded to
 * Razorpay, moving the row to `processing`, never directly to `processed`.
 */
export async function initiateRefund(formData: FormData): Promise<string> {
  const admin = await requireAdminPermission("refunds:write");
  const supabase = await createClient();

  const paymentTransactionId = String(formData.get("paymentTransactionId") ?? "").trim();
  if (!paymentTransactionId) throw new AdminValidationError("A payment transaction is required.");
  const reason = String(formData.get("reason") ?? "").trim() || null;

  const txn = await loadEligibleTransaction(supabase, paymentTransactionId);
  const remaining = txn.amountMinorUnits - txn.amountRefundedMinorUnits;
  if (remaining <= 0) throw new AdminValidationError("This payment has already been fully refunded.");

  const amountRaw = String(formData.get("amount") ?? "").trim();
  let amountMinorUnits = remaining;
  if (amountRaw) {
    const parsed = parseMoneyInput(amountRaw, txn.currency);
    if (parsed === null || parsed <= 0) throw new AdminValidationError("Enter a valid positive refund amount, e.g. 500 or 500.50.");
    if (parsed > remaining) throw new AdminValidationError(`Cannot refund more than the remaining captured amount (${formatMoney(remaining, txn.currency)}).`);
    amountMinorUnits = parsed;
  }

  const gateway = getPaymentGateway();
  if (!gateway) {
    throw new AdminValidationError("Payment gateway is not configured — refunds cannot be processed until Razorpay credentials are set.");
  }

  const { data: refundRow, error: insertError } = await supabase
    .from("refunds")
    .insert({
      payment_transaction_id: txn.id,
      invoice_id: txn.invoiceId,
      provider_refund_id: null,
      amount_minor_units: amountMinorUnits,
      status: "requested",
      reason,
      initiated_by: admin.userId,
    })
    .select("id")
    .single();
  if (insertError) {
    logDbError("initiateRefund:insert", insertError);
    if (insertError.message.includes("refunds_one_open_per_transaction")) {
      throw new AdminValidationError("A refund is already in progress for this payment.");
    }
    throw new Error(insertError.message);
  }

  try {
    const gatewayRefund = await gateway.createRefund({
      providerPaymentId: txn.providerPaymentId,
      amountMinorUnits,
      notes: reason ? { reason } : undefined,
    });
    await supabase.from("refunds").update({ provider_refund_id: gatewayRefund.providerRefundId, status: "processing" }).eq("id", refundRow.id);
  } catch (gatewayError) {
    logDbError("initiateRefund:gateway", gatewayError);
    await supabase.from("refunds").update({ status: "failed" }).eq("id", refundRow.id);
    await recordAuditLog({
      action: "Refund failed",
      entityType: "refund",
      entityId: refundRow.id,
      entityLabel: `refund on transaction ${txn.id}`,
      after: { status: "failed" },
    });
    throw new Error(gatewayError instanceof PaymentGatewayNotConfiguredError ? gatewayError.message : "The payment gateway rejected this refund request. See the payment events log for details.");
  }

  await recordAuditLog({
    action: "Initiated",
    entityType: "refund",
    entityId: refundRow.id,
    entityLabel: `refund on transaction ${txn.id}`,
    after: { amountMinorUnits, reason, status: "processing" },
  });

  return refundRow.id;
}
