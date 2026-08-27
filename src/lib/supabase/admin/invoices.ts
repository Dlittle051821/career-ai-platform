import "server-only";
import { createClient } from "../server";
import { requireAdminPermission, requireAdmin } from "../admin-auth";
import { recordAuditLog } from "./audit";
import { AdminValidationError } from "@/lib/admin/form-state";
import { parseMoneyInput } from "@/lib/admin/money";
import { computeLineItem, computeInvoiceTotals, isInvoiceIssuable, type LineItemInput } from "@/lib/payments/invoice-math";
import { INVOICE_STATUS_TRANSITIONS, isValidTransition } from "@/lib/admin/status";
import { buildBillingSnapshot } from "@/lib/payments/snapshot";
import { getBillingSettingsForDocument } from "./billing-settings";
import { generatePaymentLinkToken, hashPaymentLinkToken, defaultTokenExpiry } from "@/lib/payments/tokens";
import { getPublicAppUrl } from "@/lib/payments/env";
import { cleanFilterParam, clampPageSize, pageToRange, parsePageParam } from "@/lib/admin/pagination";
import type { Invoice, InvoiceLineItem, InvoiceStatus, PaymentsListResult } from "@/types/payments";
import { PAYABLE_INVOICE_STATUSES } from "@/types/payments";
import type { Json } from "@/types/database";

/**
 * Invoice data access — the core of Milestone 8's admin billing surface.
 * Every mutation here is permission-gated on invoices:read/write (see
 * src/lib/admin/permissions.ts) AND independently enforced by RLS on
 * public.invoices/invoice_line_items (0005_payments_billing.sql PART 3/4) —
 * this file is not the security boundary, only a convenience layer on top
 * of one. Money is always integer minor units; totals are always
 * server-recomputed from src/lib/payments/invoice-math.ts, never trusted
 * from client input.
 */

function logDbError(context: string, error: unknown) {
  console.error(`[admin/invoices] ${context}:`, error);
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

interface StudentInfo {
  fullName: string | null;
  email: string | null;
}

async function buildStudentInfoMap(supabase: Supabase, ids: (string | null)[]): Promise<Map<string, StudentInfo>> {
  const uniqueIds = Array.from(new Set(ids.filter((id): id is string => id !== null)));
  if (uniqueIds.length === 0) return new Map();
  const { data, error } = await supabase.from("profiles").select("id, full_name, email").in("id", uniqueIds);
  if (error) {
    logDbError("buildStudentInfoMap", error);
    return new Map();
  }
  return new Map((data ?? []).map((p) => [p.id, { fullName: p.full_name, email: p.email }]));
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
  internal_notes: string | null;
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
  invoice_id: string;
  description: string;
  quantity: number;
  unit_amount_minor_units: number;
  discount_minor_units: number;
  tax_rate_bps: number | null;
  tax_minor_units: number;
  line_total_minor_units: number;
  sort_order: number;
}

function toLineItem(row: LineItemRow): InvoiceLineItem {
  return {
    id: row.id,
    description: row.description,
    quantity: row.quantity,
    unitAmountMinorUnits: row.unit_amount_minor_units,
    discountMinorUnits: row.discount_minor_units,
    taxRateBps: row.tax_rate_bps,
    taxMinorUnits: row.tax_minor_units,
    lineTotalMinorUnits: row.line_total_minor_units,
    sortOrder: row.sort_order,
  };
}

/** Sums captured/refunded totals for one invoice — the same aggregation public.recompute_invoice_status() does in SQL, mirrored here purely for display (see the comment on Invoice.capturedTotalMinorUnits). */
async function getInvoicePaymentSummary(supabase: Supabase, invoiceId: string): Promise<{ capturedTotalMinorUnits: number; refundedTotalMinorUnits: number }> {
  const { data: attempts, error: attemptsError } = await supabase.from("payment_attempts").select("id").eq("invoice_id", invoiceId);
  if (attemptsError) {
    logDbError("getInvoicePaymentSummary:attempts", attemptsError);
    return { capturedTotalMinorUnits: 0, refundedTotalMinorUnits: 0 };
  }
  const attemptIds = (attempts ?? []).map((a) => a.id);
  let capturedTotalMinorUnits = 0;
  if (attemptIds.length > 0) {
    const { data: txns, error: txnsError } = await supabase
      .from("payment_transactions")
      .select("amount_minor_units, status")
      .in("payment_attempt_id", attemptIds)
      .in("status", ["captured", "refunded", "partially_refunded"]);
    if (txnsError) {
      logDbError("getInvoicePaymentSummary:transactions", txnsError);
    } else {
      capturedTotalMinorUnits = (txns ?? []).reduce((sum, t) => sum + t.amount_minor_units, 0);
    }
  }

  const { data: refunds, error: refundsError } = await supabase
    .from("refunds")
    .select("amount_minor_units")
    .eq("invoice_id", invoiceId)
    .eq("status", "processed");
  if (refundsError) {
    logDbError("getInvoicePaymentSummary:refunds", refundsError);
    return { capturedTotalMinorUnits, refundedTotalMinorUnits: 0 };
  }
  const refundedTotalMinorUnits = (refunds ?? []).reduce((sum, r) => sum + r.amount_minor_units, 0);

  return { capturedTotalMinorUnits, refundedTotalMinorUnits };
}

function toInvoice(row: InvoiceRow, lineItems: InvoiceLineItem[], studentInfo: StudentInfo | undefined, summary: { capturedTotalMinorUnits: number; refundedTotalMinorUnits: number }): Invoice {
  const dueMinorUnits = Math.max(0, row.total_minor_units - summary.capturedTotalMinorUnits);
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    studentUserId: row.student_user_id,
    studentName: studentInfo?.fullName ?? null,
    studentEmail: studentInfo?.email ?? null,
    applicationId: row.application_id,
    status: row.status as InvoiceStatus,
    currency: row.currency,
    subtotalMinorUnits: row.subtotal_minor_units,
    discountMinorUnits: row.discount_minor_units,
    taxMinorUnits: row.tax_minor_units,
    totalMinorUnits: row.total_minor_units,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    internalNotes: row.internal_notes,
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
    dueMinorUnits,
  };
}

export interface InvoiceFilters {
  query?: string;
  status?: InvoiceStatus;
  studentUserId?: string;
  page?: number;
}

const PAGE_SIZE = 20;

/** List invoices. RLS already scopes a counsellor session to their assigned students' invoices — no extra app-level filtering needed here for that boundary. */
export async function listInvoices(filters: InvoiceFilters = {}): Promise<PaymentsListResult<Invoice>> {
  await requireAdminPermission("invoices:read");
  const supabase = await createClient();
  const page = parsePageParam(String(filters.page ?? 1));
  const pageSize = clampPageSize(PAGE_SIZE);
  const { from, to } = pageToRange(page, pageSize);

  let query = supabase.from("invoices").select("*", { count: "exact" }).order("created_at", { ascending: false });
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.studentUserId) query = query.eq("student_user_id", filters.studentUserId);

  const cleanedQuery = cleanFilterParam(filters.query);
  if (cleanedQuery) {
    const term = cleanedQuery.replace(/[,()%]/g, "");
    query = query.ilike("invoice_number", `%${term}%`);
  }

  const { data, error, count } = await query.range(from, to);
  if (error) {
    logDbError("listInvoices", error);
    return { items: [], total: 0, page, pageSize };
  }
  const rows = (data ?? []) as InvoiceRow[];
  const studentInfoById = await buildStudentInfoMap(supabase, rows.map((r) => r.student_user_id));

  const items = await Promise.all(
    rows.map(async (row) => {
      const summary = await getInvoicePaymentSummary(supabase, row.id);
      return toInvoice(row, [], row.student_user_id ? studentInfoById.get(row.student_user_id) : undefined, summary);
    })
  );

  return { items, total: count ?? 0, page, pageSize };
}

export async function getInvoiceById(id: string): Promise<Invoice | null> {
  await requireAdminPermission("invoices:read");
  const supabase = await createClient();
  const { data, error } = await supabase.from("invoices").select("*").eq("id", id).maybeSingle();
  if (error) {
    logDbError("getInvoiceById", error);
    return null;
  }
  if (!data) return null;
  const row = data as InvoiceRow;

  const [{ data: lineItemRows, error: lineError }, studentInfoById, summary] = await Promise.all([
    supabase.from("invoice_line_items").select("*").eq("invoice_id", id).order("sort_order", { ascending: true }),
    buildStudentInfoMap(supabase, [row.student_user_id]),
    getInvoicePaymentSummary(supabase, id),
  ]);
  if (lineError) logDbError("getInvoiceById:lineItems", lineError);

  const lineItems = ((lineItemRows ?? []) as LineItemRow[]).map(toLineItem);
  return toInvoice(row, lineItems, row.student_user_id ? studentInfoById.get(row.student_user_id) : undefined, summary);
}

function parseInvoiceHeaderForm(formData: FormData): {
  studentUserId: string;
  applicationId: string | null;
  currency: string;
  dueDate: string | null;
  internalNotes: string | null;
  studentNotes: string | null;
} {
  const studentUserId = String(formData.get("studentUserId") ?? "").trim();
  if (!studentUserId) throw new AdminValidationError("Select the student this invoice is for.");

  return {
    studentUserId,
    applicationId: String(formData.get("applicationId") ?? "").trim() || null,
    currency: (String(formData.get("currency") ?? "INR").trim().toUpperCase() || "INR"),
    dueDate: String(formData.get("dueDate") ?? "").trim() || null,
    internalNotes: String(formData.get("internalNotes") ?? "").trim() || null,
    studentNotes: String(formData.get("studentNotes") ?? "").trim() || null,
  };
}

export async function createDraftInvoice(formData: FormData): Promise<string> {
  const admin = await requireAdminPermission("invoices:write");
  const input = parseInvoiceHeaderForm(formData);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      invoice_number: null,
      student_user_id: input.studentUserId,
      application_id: input.applicationId,
      status: "draft",
      currency: input.currency,
      subtotal_minor_units: 0,
      discount_minor_units: 0,
      tax_minor_units: 0,
      total_minor_units: 0,
      issue_date: null,
      due_date: input.dueDate,
      internal_notes: input.internalNotes,
      student_notes: input.studentNotes,
      billing_snapshot: null,
      void_reason: null,
      created_by: admin.userId,
      issued_by: null,
      issued_at: null,
      paid_at: null,
      voided_by: null,
      voided_at: null,
    })
    .select("id")
    .single();

  if (error) {
    logDbError("createDraftInvoice", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Created",
    entityType: "invoice",
    entityId: data.id,
    entityLabel: `draft invoice for student ${input.studentUserId}`,
    after: { status: "draft", currency: input.currency },
  });

  return data.id;
}

export async function updateInvoiceHeader(id: string, formData: FormData): Promise<void> {
  await requireAdminPermission("invoices:write");
  const input = parseInvoiceHeaderForm(formData);
  const supabase = await createClient();

  const before = await getInvoiceById(id);
  if (!before) throw new AdminValidationError("Invoice not found.");
  if (before.status !== "draft") {
    throw new AdminValidationError("Only a draft invoice's details can be edited. Void this invoice and create a new one instead.");
  }

  const { error } = await supabase
    .from("invoices")
    .update({
      student_user_id: input.studentUserId,
      application_id: input.applicationId,
      currency: input.currency,
      due_date: input.dueDate,
      internal_notes: input.internalNotes,
      student_notes: input.studentNotes,
    })
    .eq("id", id);

  if (error) {
    logDbError("updateInvoiceHeader", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Updated",
    entityType: "invoice",
    entityId: id,
    entityLabel: `invoice ${before.invoiceNumber ?? id}`,
    before: { studentUserId: before.studentUserId, dueDate: before.dueDate },
    after: { studentUserId: input.studentUserId, dueDate: input.dueDate },
  });
}

interface LineItemFormInput extends LineItemInput {
  description: string;
}

/** Parses the repeated-field line-item form shape: lineDescription[], lineQuantity[], lineUnitAmount[], lineDiscount[], lineTaxRateBps[] — all arrays aligned by index. */
function parseLineItemsForm(formData: FormData, currency: string): LineItemFormInput[] {
  const descriptions = formData.getAll("lineDescription").map((v) => String(v).trim());
  const quantities = formData.getAll("lineQuantity").map((v) => String(v).trim());
  const unitAmounts = formData.getAll("lineUnitAmount").map((v) => String(v).trim());
  const discounts = formData.getAll("lineDiscount").map((v) => String(v).trim());
  const taxRates = formData.getAll("lineTaxRateBps").map((v) => String(v).trim());

  const items: LineItemFormInput[] = [];
  for (let i = 0; i < descriptions.length; i++) {
    const description = descriptions[i];
    if (!description) continue; // a blank row from the UI's "add another line" pattern is simply skipped, not an error

    const quantity = Number.parseFloat(quantities[i] || "1");
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new AdminValidationError(`Line "${description}": quantity must be a positive number.`);
    }

    const unitAmountMinorUnits = parseMoneyInput(unitAmounts[i] || "", currency);
    if (unitAmountMinorUnits === null) {
      throw new AdminValidationError(`Line "${description}": unit amount must be a valid non-negative number.`);
    }

    let discountMinorUnits = 0;
    if (discounts[i]) {
      const parsed = parseMoneyInput(discounts[i], currency);
      if (parsed === null) throw new AdminValidationError(`Line "${description}": discount must be a valid non-negative number.`);
      discountMinorUnits = parsed;
    }

    let taxRateBps: number | null = null;
    if (taxRates[i]) {
      const parsed = Number.parseInt(taxRates[i], 10);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10_000) {
        throw new AdminValidationError(`Line "${description}": tax rate must be a basis-point value between 0 and 10000.`);
      }
      taxRateBps = parsed;
    }

    items.push({ description, quantity, unitAmountMinorUnits, discountMinorUnits, taxRateBps });
  }

  if (items.length === 0) throw new AdminValidationError("Add at least one line item.");
  return items;
}

/** Replaces every line item on a DRAFT invoice and recomputes its totals. Never usable once issued — see the invoices table comment on billing_snapshot for why an issued document's figures must never move. */
export async function replaceInvoiceLineItems(invoiceId: string, formData: FormData): Promise<void> {
  await requireAdminPermission("invoices:write");
  const supabase = await createClient();

  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) throw new AdminValidationError("Invoice not found.");
  if (invoice.status !== "draft") {
    throw new AdminValidationError("Line items can only be edited while the invoice is a draft.");
  }

  const inputs = parseLineItemsForm(formData, invoice.currency);
  const computed = inputs.map((input) => ({ input, result: computeLineItem(input) }));
  const totals = computeInvoiceTotals(computed.map((c) => c.result));

  const { error: deleteError } = await supabase.from("invoice_line_items").delete().eq("invoice_id", invoiceId);
  if (deleteError) {
    logDbError("replaceInvoiceLineItems:delete", deleteError);
    throw new Error(deleteError.message);
  }

  const { error: insertError } = await supabase.from("invoice_line_items").insert(
    computed.map((c, index) => ({
      invoice_id: invoiceId,
      description: c.input.description,
      quantity: c.input.quantity,
      unit_amount_minor_units: c.input.unitAmountMinorUnits,
      discount_minor_units: c.result.discountMinorUnits,
      tax_rate_bps: c.input.taxRateBps,
      tax_minor_units: c.result.taxMinorUnits,
      line_total_minor_units: c.result.lineTotalMinorUnits,
      sort_order: index,
    }))
  );
  if (insertError) {
    logDbError("replaceInvoiceLineItems:insert", insertError);
    throw new Error(insertError.message);
  }

  const { error: updateError } = await supabase
    .from("invoices")
    .update({
      subtotal_minor_units: totals.subtotalMinorUnits,
      discount_minor_units: totals.discountMinorUnits,
      tax_minor_units: totals.taxMinorUnits,
      total_minor_units: totals.totalMinorUnits,
    })
    .eq("id", invoiceId);
  if (updateError) {
    logDbError("replaceInvoiceLineItems:updateTotals", updateError);
    throw new Error(updateError.message);
  }

  await recordAuditLog({
    action: "Updated",
    entityType: "invoice",
    entityId: invoiceId,
    entityLabel: `invoice ${invoice.invoiceNumber ?? invoiceId} line items`,
    fieldChangeSummaries: [`line items replaced (${inputs.length} lines)`, `total: ${invoice.totalMinorUnits} -> ${totals.totalMinorUnits} (${invoice.currency} minor units)`],
    before: { totalMinorUnits: invoice.totalMinorUnits },
    after: { totalMinorUnits: totals.totalMinorUnits },
  });
}

/**
 * Issues a draft invoice: assigns an atomic invoice number
 * (public.next_invoice_number(), never MAX()+1), freezes the billing
 * snapshot, and moves status draft -> issued. Irreversible in the sense
 * that line items can no longer be edited afterward — see
 * replaceInvoiceLineItems's draft-only guard above.
 */
export async function issueInvoice(invoiceId: string): Promise<void> {
  const admin = await requireAdminPermission("invoices:write");
  const supabase = await createClient();

  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) throw new AdminValidationError("Invoice not found.");
  if (!isValidTransition(INVOICE_STATUS_TRANSITIONS, invoice.status, "issued")) {
    throw new AdminValidationError(`Cannot issue an invoice from status "${invoice.status}".`);
  }
  // isInvoiceIssuable only inspects lineTotalMinorUnits/length — the already
  // server-computed and stored per-line totals are exactly what it needs;
  // grossMinorUnits is irrelevant to this check and left at 0 here.
  const computedLines = invoice.lineItems.map((li) => ({
    grossMinorUnits: 0,
    discountMinorUnits: li.discountMinorUnits,
    taxMinorUnits: li.taxMinorUnits,
    lineTotalMinorUnits: li.lineTotalMinorUnits,
  }));
  if (!isInvoiceIssuable(computedLines)) {
    throw new AdminValidationError("Add at least one line item with a positive total before issuing this invoice.");
  }
  if (!invoice.studentUserId) {
    throw new AdminValidationError("This invoice has no student assigned.");
  }

  const { data: numberResult, error: numberError } = await supabase.rpc("next_invoice_number");
  if (numberError || !numberResult) {
    logDbError("issueInvoice:next_invoice_number", numberError);
    throw new Error(numberError?.message ?? "Could not generate an invoice number.");
  }

  const settings = await getBillingSettingsForDocument();
  const snapshot = buildBillingSnapshot({ studentName: invoice.studentName, studentEmail: invoice.studentEmail, settings });

  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase
    .from("invoices")
    .update({
      invoice_number: numberResult,
      status: "issued",
      issue_date: today,
      issued_by: admin.userId,
      issued_at: new Date().toISOString(),
      billing_snapshot: snapshot as unknown as Json,
    })
    .eq("id", invoiceId);

  if (error) {
    logDbError("issueInvoice:update", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Issued",
    entityType: "invoice",
    entityId: invoiceId,
    entityLabel: `invoice ${numberResult}`,
    fieldChangeSummaries: [`status: draft -> issued`, `invoice_number assigned: ${numberResult}`],
    before: { status: "draft" },
    after: { status: "issued", invoiceNumber: numberResult },
  });
}

export async function voidInvoice(invoiceId: string, formData: FormData): Promise<void> {
  const admin = await requireAdminPermission("invoices:write");
  const reason = String(formData.get("voidReason") ?? "").trim();
  if (!reason) throw new AdminValidationError("A reason is required to void an invoice.");
  const supabase = await createClient();

  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) throw new AdminValidationError("Invoice not found.");
  if (!isValidTransition(INVOICE_STATUS_TRANSITIONS, invoice.status, "void")) {
    throw new AdminValidationError(`Cannot void an invoice from status "${invoice.status}" — only an unpaid invoice (draft, issued, or overdue) can be voided.`);
  }

  const { error } = await supabase
    .from("invoices")
    .update({ status: "void", void_reason: reason, voided_by: admin.userId, voided_at: new Date().toISOString() })
    .eq("id", invoiceId);
  if (error) {
    logDbError("voidInvoice", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Voided",
    entityType: "invoice",
    entityId: invoiceId,
    entityLabel: `invoice ${invoice.invoiceNumber ?? invoiceId}`,
    fieldChangeSummaries: [`status: ${invoice.status} -> void`, `reason: ${reason}`],
    before: { status: invoice.status },
    after: { status: "void", voidReason: reason },
  });
}

/**
 * Records an OFFLINE (manually verified, e.g. bank transfer/cash) payment
 * against an invoice. Always creates its own payment_attempts row (provider
 * "offline") to hang the payment_transactions row off of, with is_manual =
 * true and provider_payment_id left null — payment_transactions_manual_requires_no_provider_id
 * enforces the two can never be confused with a gateway-verified payment.
 * Never usable to mark an invoice paid based on nothing but the browser
 * returning to a success URL — this is an explicit, audited admin action
 * with its own paper trail, not an automatic side effect of anything a
 * student's browser reports.
 */
export async function recordOfflinePayment(invoiceId: string, formData: FormData): Promise<void> {
  const admin = await requireAdminPermission("invoices:write");
  const supabase = await createClient();

  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) throw new AdminValidationError("Invoice not found.");
  if (!PAYABLE_INVOICE_STATUSES.includes(invoice.status)) {
    throw new AdminValidationError(`Cannot record a payment against an invoice with status "${invoice.status}".`);
  }

  const amountRaw = String(formData.get("amount") ?? "").trim();
  const amountMinorUnits = parseMoneyInput(amountRaw, invoice.currency);
  if (amountMinorUnits === null || amountMinorUnits <= 0) {
    throw new AdminValidationError("Enter a valid positive payment amount.");
  }
  if (amountMinorUnits > invoice.dueMinorUnits) {
    throw new AdminValidationError(`This would exceed the amount still due (${invoice.dueMinorUnits} ${invoice.currency} minor units). Record a smaller amount, or issue a credit/adjustment separately.`);
  }
  const note = String(formData.get("note") ?? "").trim() || null;

  const { data: attempt, error: attemptError } = await supabase
    .from("payment_attempts")
    .insert({
      invoice_id: invoiceId,
      provider: "offline",
      provider_order_id: null,
      idempotency_key: `offline-${invoiceId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: "captured",
      amount_minor_units: amountMinorUnits,
      currency: invoice.currency,
      created_by: admin.userId,
    })
    .select("id")
    .single();
  if (attemptError) {
    logDbError("recordOfflinePayment:attempt", attemptError);
    throw new Error(attemptError.message);
  }

  const { error: txnError } = await supabase.from("payment_transactions").insert({
    payment_attempt_id: attempt.id,
    provider_payment_id: null,
    is_manual: true,
    status: "captured",
    amount_minor_units: amountMinorUnits,
    amount_refunded_minor_units: 0,
    currency: invoice.currency,
    method_category: null,
    captured_at: new Date().toISOString(),
    failure_reason: null,
    raw_status: note ? `offline: ${note}` : "offline payment recorded by admin",
    recorded_by: admin.userId,
  });
  if (txnError) {
    logDbError("recordOfflinePayment:transaction", txnError);
    throw new Error(txnError.message);
  }

  const { error: recomputeError } = await supabase.rpc("recompute_invoice_status", { p_invoice_id: invoiceId });
  if (recomputeError) logDbError("recordOfflinePayment:recompute", recomputeError);

  await recordAuditLog({
    action: "Recorded offline payment",
    entityType: "invoice",
    entityId: invoiceId,
    entityLabel: `invoice ${invoice.invoiceNumber ?? invoiceId}`,
    fieldChangeSummaries: [`offline payment recorded: ${amountMinorUnits} ${invoice.currency} minor units`],
    after: { amountMinorUnits, note },
  });
}

export interface PaymentLinkResult {
  url: string;
  expiresAt: string;
}

/** Generates a copyable "pay this invoice" link. The raw token is returned ONCE here and never persisted — only its SHA-256 hash is stored (see src/lib/payments/tokens.ts). Possessing the link is a lookup convenience only; /pay/[token] still requires the visitor to sign in as the invoice's own student before anything is shown (RLS is the real boundary — see payment_request_tokens' table comment). */
export async function createPaymentLink(invoiceId: string): Promise<PaymentLinkResult> {
  const admin = await requireAdminPermission("invoices:write");
  const supabase = await createClient();

  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) throw new AdminValidationError("Invoice not found.");
  if (!PAYABLE_INVOICE_STATUSES.includes(invoice.status)) {
    throw new AdminValidationError(`Cannot create a payment link for an invoice with status "${invoice.status}".`);
  }

  const rawToken = generatePaymentLinkToken();
  const tokenHash = hashPaymentLinkToken(rawToken);
  const expiresAt = defaultTokenExpiry();

  const { error } = await supabase.from("payment_request_tokens").insert({
    invoice_id: invoiceId,
    token_hash: tokenHash,
    expires_at: expiresAt,
    created_by: admin.userId,
    revoked_at: null,
  });
  if (error) {
    logDbError("createPaymentLink", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Created payment link",
    entityType: "invoice",
    entityId: invoiceId,
    entityLabel: `invoice ${invoice.invoiceNumber ?? invoiceId}`,
    after: { expiresAt },
    // Deliberately never logs the raw token itself — only its existence/expiry.
  });

  const base = getPublicAppUrl();
  const path = `/pay/${rawToken}`;
  return { url: base ? `${base}${path}` : path, expiresAt };
}

/** For dropdowns — a lightweight id/name list of students, reusing the same profiles table every other admin module already trusts for this. */
export async function listStudentOptions(): Promise<{ id: string; label: string }[]> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("account_type", "student")
    .order("full_name", { ascending: true })
    .limit(500);
  if (error) {
    logDbError("listStudentOptions", error);
    return [];
  }
  return (data ?? []).map((p) => ({ id: p.id, label: p.full_name ? `${p.full_name} (${p.email ?? "no email"})` : (p.email ?? p.id) }));
}
