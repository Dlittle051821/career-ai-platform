import "server-only";
import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { recordAuditLog } from "./audit";
import { AdminValidationError } from "@/lib/admin/form-state";
import { parseMoneyInput } from "@/lib/admin/money";
import { PAYMENT_STATUS_TRANSITIONS, isValidTransition } from "@/lib/admin/status";
import { cleanFilterParam, clampPageSize, pageToRange, parsePageParam } from "@/lib/admin/pagination";
import type { AdminListResult, Payment, PaymentStatus, RefundStatus } from "@/types/admin";

/**
 * Payments here are OPERATIONAL TRACKING ONLY — never a payment processor.
 * No record here moves money; a "paid" status means "an admin recorded
 * that this was paid," not that a transaction was processed by this
 * system. See docs/admin-system-guide.md §7.
 */

function logDbError(context: string, error: unknown) {
  console.error(`[admin/payments] ${context}:`, error);
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function buildStudentNameMap(supabase: Supabase, ids: (string | null)[]): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(ids.filter((id): id is string => id !== null)));
  if (uniqueIds.length === 0) return new Map();
  const { data, error } = await supabase.from("profiles").select("id, full_name").in("id", uniqueIds);
  if (error) {
    logDbError("buildStudentNameMap", error);
    return new Map();
  }
  return new Map((data ?? []).map((p) => [p.id, p.full_name ?? "Unnamed student"]));
}

interface PaymentRow {
  id: string;
  student_user_id: string | null;
  application_id: string | null;
  invoice_reference: string | null;
  amount_minor_units: number;
  currency: string;
  payment_type: string | null;
  payment_method_label: string | null;
  status: string;
  due_date: string | null;
  paid_date: string | null;
  external_transaction_reference: string | null;
  refund_status: string;
  refund_amount_minor_units: number | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
}

function toPayment(row: PaymentRow, studentNameById: Map<string, string>): Payment {
  return {
    id: row.id,
    studentUserId: row.student_user_id,
    studentName: row.student_user_id ? (studentNameById.get(row.student_user_id) ?? null) : null,
    applicationId: row.application_id,
    invoiceReference: row.invoice_reference,
    amountMinorUnits: row.amount_minor_units,
    currency: row.currency,
    paymentType: row.payment_type,
    paymentMethodLabel: row.payment_method_label,
    status: row.status as PaymentStatus,
    dueDate: row.due_date,
    paidDate: row.paid_date,
    externalTransactionReference: row.external_transaction_reference,
    refundStatus: row.refund_status as RefundStatus,
    refundAmountMinorUnits: row.refund_amount_minor_units,
    internalNotes: row.internal_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface PaymentFilters {
  query?: string;
  status?: PaymentStatus;
  studentUserId?: string;
  page?: number;
}

const PAGE_SIZE = 20;

export async function listPayments(filters: PaymentFilters = {}): Promise<AdminListResult<Payment>> {
  await requireAdminPermission("payments:read");
  const supabase = await createClient();
  const page = parsePageParam(String(filters.page ?? 1));
  const pageSize = clampPageSize(PAGE_SIZE);
  const { from, to } = pageToRange(page, pageSize);

  let query = supabase.from("payments").select("*", { count: "exact" }).order("created_at", { ascending: false });
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.studentUserId) query = query.eq("student_user_id", filters.studentUserId);

  const cleanedQuery = cleanFilterParam(filters.query);
  if (cleanedQuery) {
    const term = cleanedQuery.replace(/[,()%]/g, "");
    query = query.or(`invoice_reference.ilike.%${term}%,external_transaction_reference.ilike.%${term}%`);
  }

  const { data, error, count } = await query.range(from, to);
  if (error) {
    logDbError("listPayments", error);
    return { items: [], total: 0, page, pageSize };
  }
  const rows = (data ?? []) as PaymentRow[];
  const studentNameById = await buildStudentNameMap(supabase, rows.map((r) => r.student_user_id));
  return { items: rows.map((row) => toPayment(row, studentNameById)), total: count ?? 0, page, pageSize };
}

export async function getPaymentById(id: string): Promise<Payment | null> {
  await requireAdminPermission("payments:read");
  const supabase = await createClient();
  const { data, error } = await supabase.from("payments").select("*").eq("id", id).maybeSingle();
  if (error) {
    logDbError("getPaymentById", error);
    return null;
  }
  if (!data) return null;
  const row = data as PaymentRow;
  const studentNameById = await buildStudentNameMap(supabase, [row.student_user_id]);
  return toPayment(row, studentNameById);
}

const REFUND_STATUSES: RefundStatus[] = ["none", "requested", "partial", "full"];

interface PaymentInput {
  studentUserId: string | null;
  applicationId: string | null;
  invoiceReference: string | null;
  amountMinorUnits: number;
  currency: string;
  paymentType: string | null;
  paymentMethodLabel: string | null;
  dueDate: string | null;
  paidDate: string | null;
  externalTransactionReference: string | null;
  refundStatus: RefundStatus;
  refundAmountMinorUnits: number | null;
  internalNotes: string | null;
}

function parsePaymentForm(formData: FormData): PaymentInput {
  const currency = String(formData.get("currency") ?? "INR").trim().toUpperCase() || "INR";
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const amountMinorUnits = parseMoneyInput(amountRaw, currency);
  if (amountMinorUnits === null) throw new AdminValidationError("Amount must be a valid non-negative number, e.g. 1500 or 1500.50.");

  const refundStatusRaw = String(formData.get("refundStatus") ?? "none").trim();
  const refundStatus = REFUND_STATUSES.includes(refundStatusRaw as RefundStatus) ? (refundStatusRaw as RefundStatus) : "none";

  const refundAmountRaw = String(formData.get("refundAmount") ?? "").trim();
  let refundAmountMinorUnits: number | null = null;
  if (refundAmountRaw) {
    const parsed = parseMoneyInput(refundAmountRaw, currency);
    if (parsed === null) throw new AdminValidationError("Refund amount must be a valid non-negative number.");
    refundAmountMinorUnits = parsed;
  }

  const studentEmail = String(formData.get("studentUserId") ?? "").trim();

  return {
    studentUserId: studentEmail || null,
    applicationId: String(formData.get("applicationId") ?? "").trim() || null,
    invoiceReference: String(formData.get("invoiceReference") ?? "").trim() || null,
    amountMinorUnits,
    currency,
    paymentType: String(formData.get("paymentType") ?? "").trim() || null,
    paymentMethodLabel: String(formData.get("paymentMethodLabel") ?? "").trim() || null,
    dueDate: String(formData.get("dueDate") ?? "").trim() || null,
    paidDate: String(formData.get("paidDate") ?? "").trim() || null,
    externalTransactionReference: String(formData.get("externalTransactionReference") ?? "").trim() || null,
    refundStatus,
    refundAmountMinorUnits,
    internalNotes: String(formData.get("internalNotes") ?? "").trim() || null,
  };
}

export async function createPayment(formData: FormData): Promise<string> {
  const admin = await requireAdminPermission("payments:write");
  const input = parsePaymentForm(formData);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("payments")
    .insert({
      student_user_id: input.studentUserId,
      application_id: input.applicationId,
      invoice_reference: input.invoiceReference,
      amount_minor_units: input.amountMinorUnits,
      currency: input.currency,
      payment_type: input.paymentType,
      payment_method_label: input.paymentMethodLabel,
      status: "pending",
      due_date: input.dueDate,
      paid_date: input.paidDate,
      external_transaction_reference: input.externalTransactionReference,
      refund_status: input.refundStatus,
      refund_amount_minor_units: input.refundAmountMinorUnits,
      internal_notes: input.internalNotes,
      created_by: admin.userId,
    })
    .select("id")
    .single();

  if (error) {
    logDbError("createPayment", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Created",
    entityType: "payment",
    entityId: data.id,
    entityLabel: `payment ${input.invoiceReference ?? data.id}`,
    after: { amountMinorUnits: input.amountMinorUnits, currency: input.currency, status: "pending" },
  });

  return data.id;
}

export async function updatePayment(id: string, formData: FormData): Promise<void> {
  await requireAdminPermission("payments:write");
  const input = parsePaymentForm(formData);
  const requestedStatusRaw = String(formData.get("status") ?? "").trim();
  const supabase = await createClient();

  const before = await getPaymentById(id);
  if (!before) throw new AdminValidationError("Payment not found.");

  const requestedStatus = (requestedStatusRaw || before.status) as PaymentStatus;
  if (!isValidTransition(PAYMENT_STATUS_TRANSITIONS, before.status, requestedStatus)) {
    throw new AdminValidationError(`Cannot move a payment from "${before.status}" directly to "${requestedStatus}". Never claim a payment is processed just because a record exists.`);
  }

  const { error } = await supabase
    .from("payments")
    .update({
      student_user_id: input.studentUserId,
      application_id: input.applicationId,
      invoice_reference: input.invoiceReference,
      amount_minor_units: input.amountMinorUnits,
      currency: input.currency,
      payment_type: input.paymentType,
      payment_method_label: input.paymentMethodLabel,
      status: requestedStatus,
      due_date: input.dueDate,
      paid_date: input.paidDate,
      external_transaction_reference: input.externalTransactionReference,
      refund_status: input.refundStatus,
      refund_amount_minor_units: input.refundAmountMinorUnits,
      internal_notes: input.internalNotes,
    })
    .eq("id", id);

  if (error) {
    logDbError("updatePayment", error);
    throw new Error(error.message);
  }

  // Spec: "audit status/amount changes" — these two fields specifically are
  // always called out even when nothing else changed, since they're the
  // financially sensitive ones.
  const fieldChangeSummaries: string[] = [];
  if (before.status !== requestedStatus) fieldChangeSummaries.push(`status: ${before.status} -> ${requestedStatus}`);
  if (before.amountMinorUnits !== input.amountMinorUnits) {
    fieldChangeSummaries.push(`amount: ${before.amountMinorUnits} -> ${input.amountMinorUnits} (${input.currency} minor units)`);
  }
  if (before.refundStatus !== input.refundStatus) fieldChangeSummaries.push(`refundStatus: ${before.refundStatus} -> ${input.refundStatus}`);

  await recordAuditLog({
    action: "Updated",
    entityType: "payment",
    entityId: id,
    entityLabel: `payment ${input.invoiceReference ?? id}`,
    fieldChangeSummaries,
    before: { status: before.status, amountMinorUnits: before.amountMinorUnits, refundStatus: before.refundStatus },
    after: { status: requestedStatus, amountMinorUnits: input.amountMinorUnits, refundStatus: input.refundStatus },
  });
}
