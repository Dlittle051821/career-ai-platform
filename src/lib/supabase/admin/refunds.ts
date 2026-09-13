import "server-only";
import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { recordAuditLog } from "./audit";
import { AdminValidationError } from "@/lib/admin/form-state";
import { parseMoneyInput } from "@/lib/admin/money";
import { getPaymentGateway } from "@/lib/payments/get-gateway";
import { PaymentGatewayNotConfiguredError, GatewayDefiniteRejectionError, GatewayUncertainOutcomeError } from "@/lib/payments/gateway";
import { computeRefundEligibility, validateRefundAmount, type RefundableTransactionSnapshot } from "@/lib/payments/refund-eligibility";
import { decideRefundProcessingAction } from "@/lib/payments/refund-processing";
import { cleanFilterParam, clampPageSize, pageToRange, parsePageParam } from "@/lib/admin/pagination";
import { isValidTransition, REFUND_STATUS_TRANSITIONS, sourceStatusOptions } from "@/lib/admin/status";
import { getNotifier } from "@/lib/notifications/get-notifier";
import type { Refund, RefundStatus, PaymentsListResult } from "@/types/payments";

/**
 * Milestone 8 → Milestone 13 (Refund Operations, financial-safety-first) —
 * this file is the ONLY place a refund's lifecycle is driven from
 * application code. The actual financial-safety mechanics — the
 * process-time claim (re-validating the remaining refundable balance
 * immediately before any gateway call) and exactly-once finalization —
 * live in the database, not here (claim_refund_for_processing() /
 * finalize_refund() in supabase/migrations/0016_refund_operations.sql).
 * Every function below that moves money calls one of those two RPCs rather
 * than doing its own arithmetic — see docs/payments-billing-guide.md §25
 * for the full write-up of why.
 *
 * Refunds are only ever initiated against a gateway-verified (non-manual)
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
  reviewed_by: string | null;
  reviewed_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  finalized_at: string | null;
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
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    rejectedBy: row.rejected_by,
    rejectedAt: row.rejected_at,
    rejectionReason: row.rejection_reason,
    cancelledBy: row.cancelled_by,
    cancelledAt: row.cancelled_at,
    finalizedAt: row.finalized_at,
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

export interface RefundDetailTransaction {
  id: string;
  providerPaymentId: string | null;
  isManual: boolean;
  status: string;
  amountMinorUnits: number;
  amountRefundedMinorUnits: number;
  currency: string;
}

export interface RefundDetail {
  refund: Refund;
  transaction: RefundDetailTransaction;
  invoiceNumber: string | null;
  studentName: string | null;
  studentEmail: string | null;
  /** The technical-refundability snapshot for this refund's transaction, computed fresh at read time — for the admin UI's "remaining balance" display; never itself the authoritative check (see claim_refund_for_processing()). */
  currentMaximumRefundableAmountMinorUnits: number;
}

/** Full detail for the admin refund detail page — the refund itself plus enough of its related transaction/invoice to review and act on it without another round trip. */
export async function getRefundDetailForAdmin(id: string): Promise<RefundDetail | null> {
  await requireAdminPermission("refunds:read");
  const supabase = await createClient();

  const { data: refundRow, error } = await supabase.from("refunds").select("*").eq("id", id).maybeSingle();
  if (error) {
    logDbError("getRefundDetailForAdmin:refund", error);
    return null;
  }
  if (!refundRow) return null;
  const refund = toRefund(refundRow as RefundRow);

  const { data: txnRow, error: txnError } = await supabase
    .from("payment_transactions")
    .select("id, provider_payment_id, is_manual, status, amount_minor_units, amount_refunded_minor_units, currency")
    .eq("id", refund.paymentTransactionId)
    .maybeSingle();
  if (txnError || !txnRow) {
    logDbError("getRefundDetailForAdmin:transaction", txnError);
    return null;
  }

  const { data: invoiceRow } = await supabase.from("invoices").select("invoice_number, student_user_id").eq("id", refund.invoiceId).maybeSingle();

  // Student name/email lives on `profiles`, not `student_profiles` (that
  // table holds onboarding data only) — same table
  // src/lib/supabase/admin/invoices.ts's buildStudentInfoMap already
  // trusts for exactly this lookup.
  let studentName: string | null = null;
  let studentEmail: string | null = null;
  if (invoiceRow?.student_user_id) {
    const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", invoiceRow.student_user_id).maybeSingle();
    studentName = profile?.full_name ?? null;
    studentEmail = profile?.email ?? null;
  }

  const eligibility = computeRefundEligibility({
    amountMinorUnits: txnRow.amount_minor_units,
    amountRefundedMinorUnits: txnRow.amount_refunded_minor_units,
    status: txnRow.status,
    isManual: txnRow.is_manual,
    providerPaymentId: txnRow.provider_payment_id,
  });

  return {
    refund,
    transaction: {
      id: txnRow.id,
      providerPaymentId: txnRow.provider_payment_id,
      isManual: txnRow.is_manual,
      status: txnRow.status,
      amountMinorUnits: txnRow.amount_minor_units,
      amountRefundedMinorUnits: txnRow.amount_refunded_minor_units,
      currency: txnRow.currency,
    },
    invoiceNumber: invoiceRow?.invoice_number ?? null,
    studentName,
    studentEmail,
    // The refund's own amount is excluded from "already refunded" — this
    // case has not been finalized yet, so it must not appear to shrink its
    // own remaining balance.
    currentMaximumRefundableAmountMinorUnits: eligibility.maximumRefundableAmountMinorUnits,
  };
}

async function loadEligibleTransaction(
  supabase: Supabase,
  paymentTransactionId: string
): Promise<{ invoiceId: string; currency: string; snapshot: RefundableTransactionSnapshot }> {
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

  const snapshot: RefundableTransactionSnapshot = {
    amountMinorUnits: data.amount_minor_units,
    amountRefundedMinorUnits: data.amount_refunded_minor_units,
    status: data.status,
    isManual: data.is_manual,
    providerPaymentId: data.provider_payment_id,
  };
  const eligibility = computeRefundEligibility(snapshot);
  if (!eligibility.technicallyRefundable) {
    throw new AdminValidationError(eligibility.reasons[0] ?? "This payment is not currently refundable.");
  }

  const { data: attempt, error: attemptError } = await supabase.from("payment_attempts").select("invoice_id").eq("id", data.payment_attempt_id).maybeSingle();
  if (attemptError || !attempt) {
    logDbError("loadEligibleTransaction:attempt", attemptError);
    throw new Error("Could not resolve the invoice for this payment.");
  }

  return { invoiceId: attempt.invoice_id, currency: data.currency, snapshot };
}

/**
 * Resolves the real email address of the student an invoice belongs to —
 * same `profiles` table lookup src/lib/supabase/admin/invoices.ts's
 * buildStudentInfoMap already trusts for this. Returns null (never a
 * fabricated placeholder) when the invoice has no student or no email on
 * file — callers must skip notifying rather than send to a made-up
 * address, matching the honesty principle documented in
 * src/lib/notifications/notifier.ts.
 */
async function resolveStudentEmail(supabase: Supabase, invoiceId: string): Promise<string | null> {
  const { data: invoiceRow } = await supabase.from("invoices").select("student_user_id").eq("id", invoiceId).maybeSingle();
  if (!invoiceRow?.student_user_id) return null;
  const { data: profile } = await supabase.from("profiles").select("email").eq("id", invoiceRow.student_user_id).maybeSingle();
  return profile?.email ?? null;
}

/**
 * Milestone 13 — REQUEST ONLY. Creates a `requested` refunds row and stops
 * there — no gateway call happens here at all, and never will until an
 * admin explicitly reviews and approves the case (see approveRefund below)
 * and then processApprovedRefund actually claims it for processing. This
 * is the core behavior change from the Milestone 8 original (which called
 * the gateway synchronously from this function) — see this module's
 * docblock and docs/payments-billing-guide.md §25 for why "admin
 * review/approval BEFORE any gateway call" is the whole point of M13.
 *
 * Name/signature kept identical to the Milestone 8 original so every
 * existing call site (src/app/admin/invoices/actions.ts's
 * initiateRefundAction, src/components/admin/invoices/InvoiceActionForms.tsx's
 * InitiateRefundForm) keeps working unchanged.
 */
export async function initiateRefund(formData: FormData): Promise<string> {
  const admin = await requireAdminPermission("refunds:write");
  const supabase = await createClient();

  const paymentTransactionId = String(formData.get("paymentTransactionId") ?? "").trim();
  if (!paymentTransactionId) throw new AdminValidationError("A payment transaction is required.");
  const reason = String(formData.get("reason") ?? "").trim() || null;

  const { invoiceId, currency, snapshot } = await loadEligibleTransaction(supabase, paymentTransactionId);

  const amountRaw = String(formData.get("amount") ?? "").trim();
  let amountMinorUnits = snapshot.amountMinorUnits - snapshot.amountRefundedMinorUnits;
  if (amountRaw) {
    const parsed = parseMoneyInput(amountRaw, currency);
    if (parsed === null) throw new AdminValidationError("Enter a valid positive refund amount, e.g. 500 or 500.50.");
    amountMinorUnits = parsed;
  }
  const validationError = validateRefundAmount(amountMinorUnits, snapshot);
  if (validationError) throw new AdminValidationError(validationError);

  const { data: refundRow, error: insertError } = await supabase
    .from("refunds")
    .insert({
      payment_transaction_id: paymentTransactionId,
      invoice_id: invoiceId,
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
    if (insertError.message.includes("refunds_one_active_per_transaction") || insertError.message.includes("refunds_one_open_per_transaction")) {
      throw new AdminValidationError("A refund case is already open for this payment.");
    }
    throw new Error(insertError.message);
  }

  await recordAuditLog({
    action: "Requested",
    entityType: "refund",
    entityId: refundRow.id,
    entityLabel: `refund on transaction ${paymentTransactionId}`,
    after: { amountMinorUnits, reason, status: "requested" },
  });

  // No refund_requested notification is fired here: this codebase has no
  // real staff-notification recipient to resolve (every existing
  // getNotifier() call site — src/lib/supabase/admin/signatures.ts — sends
  // to an external counterparty's real email, never a fabricated "staff"
  // address). A new request is already visible to admins via the
  // /admin/refunds queue itself. The refund_requested template is kept in
  // NOTIFICATION_TEMPLATES for a future real implementation to use — see
  // M13_COMPLETION_REPORT.md "known limitations".

  return refundRow.id;
}

function assertTransition(current: RefundStatus, next: RefundStatus) {
  if (!isValidTransition(REFUND_STATUS_TRANSITIONS, current, next)) {
    throw new AdminValidationError(`Cannot move a refund from "${current}" to "${next}".`);
  }
}

async function loadRefundRowForUpdate(supabase: Supabase, id: string): Promise<RefundRow> {
  const { data, error } = await supabase.from("refunds").select("*").eq("id", id).maybeSingle();
  if (error) {
    logDbError("loadRefundRowForUpdate", error);
    throw new Error(error.message);
  }
  if (!data) throw new AdminValidationError("Refund case not found.");
  return data as RefundRow;
}

/**
 * Milestone 13 FINAL FINANCIAL SAFETY PATCH (Issue 2) — every admin-driven
 * refund lifecycle transition (under_review / approved / rejected /
 * cancelled) MUST be a single database-authoritative conditional UPDATE,
 * never the previous "SELECT row, validate in application code, then
 * UPDATE by id only" sequence. That older sequence has a real race: two
 * admins (or one admin's stale duplicate request, e.g. a retried form
 * submit) can both read the same starting status, and whichever UPDATE-by-
 * id-only runs second silently overwrites whatever the first one — or
 * claim_refund_for_processing()/finalize_refund() moving the case forward
 * in the meantime — already wrote. That must be impossible, especially:
 * `processing` can never be overwritten by a stale under_review/approved/
 * rejected/cancelled action, and `processed`/`failed` can never be moved
 * backwards.
 *
 * This performs `UPDATE refunds SET <patch>, status = :target WHERE id =
 * :id AND status IN (:fromStatuses) RETURNING *`. The permitted source-
 * status set is read directly off REFUND_STATUS_TRANSITIONS via
 * sourceStatusOptions() (plus `target` itself, mirroring
 * isValidTransition()'s own "same status to itself is always a no-op"
 * rule for idempotent re-application — e.g. re-marking an already-
 * under_review case under review just to bump reviewed_at) — so the
 * allowed source set can never drift from the one graph definition by
 * being hand-duplicated here. Critically, `target` is never `processing`,
 * `processed`, or `failed` for any of this file's admin-facing callers
 * (those transitions are exclusively driven by the claim_refund_for_processing()
 * / finalize_refund() RPCs — see REFUND_STATUS_TRANSITIONS' own docblock),
 * so this self-loop allowance can never be used to re-enter or escape
 * `processing`.
 *
 * If zero rows come back, some other process already moved this refund to
 * a different status since the caller last read it (or it no longer
 * exists) — that is reported as a plain, safe "refresh and try again"
 * validation error. It is never silently ignored and this function never
 * retries by re-reading and writing again — doing so would reintroduce
 * exactly the race this function exists to close.
 */
async function applyRefundTransition(supabase: Supabase, id: string, target: RefundStatus, patch: Record<string, unknown>): Promise<RefundRow> {
  const fromStatuses = Array.from(new Set([...sourceStatusOptions(REFUND_STATUS_TRANSITIONS, target), target]));
  const { data, error } = await supabase
    .from("refunds")
    .update({ ...patch, status: target })
    .eq("id", id)
    .in("status", fromStatuses)
    .select("*")
    .maybeSingle();
  if (error) {
    logDbError(`applyRefundTransition:${target}`, error);
    if (error.message.includes("refunds_rejection_reason_check")) {
      throw new AdminValidationError("A rejection reason is required.");
    }
    throw new Error(error.message);
  }
  if (!data) {
    const { data: current } = await supabase.from("refunds").select("id, status").eq("id", id).maybeSingle();
    if (!current) throw new AdminValidationError("Refund case not found.");
    throw new AdminValidationError(`This refund was already changed to "${current.status}" by someone else — please refresh and try again.`);
  }
  return data as RefundRow;
}

/** Moves a case from `requested` to `under_review` (or back — see REFUND_STATUS_TRANSITIONS), the first review step before any approval decision. */
export async function markRefundUnderReview(id: string): Promise<void> {
  const admin = await requireAdminPermission("refunds:write");
  const supabase = await createClient();
  const row = await loadRefundRowForUpdate(supabase, id);
  assertTransition(row.status as RefundStatus, "under_review");

  const updated = await applyRefundTransition(supabase, id, "under_review", { reviewed_by: admin.userId, reviewed_at: new Date().toISOString() });
  await recordAuditLog({ action: "Marked under review", entityType: "refund", entityId: id, entityLabel: `refund ${id}`, before: { status: row.status }, after: { status: updated.status } });
}

/**
 * Approves a refund case for processing — this is the commercial/policy
 * decision point (spec: "separate technical refundability from commercial
 * eligibility... do NOT invent refund percentages, windows, fees, GST
 * rules"). This function does not decide WHETHER to approve — the admin
 * does, by choosing to call it — it only re-validates that the (possibly
 * admin-adjusted) amount is still technically within bounds, and records
 * who approved it and when. Approving does NOT itself call the gateway —
 * see processApprovedRefund below for the actual claim + gateway step.
 */
export async function approveRefund(id: string, formData: FormData): Promise<void> {
  const admin = await requireAdminPermission("refunds:write");
  const supabase = await createClient();
  const row = await loadRefundRowForUpdate(supabase, id);
  assertTransition(row.status as RefundStatus, "approved");

  const { currency, snapshot } = await loadEligibleTransaction(supabase, row.payment_transaction_id);

  const amountRaw = String(formData.get("amount") ?? "").trim();
  let amountMinorUnits = row.amount_minor_units;
  if (amountRaw) {
    const parsed = parseMoneyInput(amountRaw, currency);
    if (parsed === null) throw new AdminValidationError("Enter a valid positive refund amount, e.g. 500 or 500.50.");
    amountMinorUnits = parsed;
  }
  const validationError = validateRefundAmount(amountMinorUnits, snapshot);
  if (validationError) throw new AdminValidationError(validationError);

  const updated = await applyRefundTransition(supabase, id, "approved", {
    amount_minor_units: amountMinorUnits,
    approved_by: admin.userId,
    approved_at: new Date().toISOString(),
  });
  await recordAuditLog({
    action: "Approved",
    entityType: "refund",
    entityId: id,
    entityLabel: `refund ${id}`,
    before: { status: row.status, amountMinorUnits: row.amount_minor_units },
    after: { status: updated.status, amountMinorUnits: updated.amount_minor_units },
  });
  const studentEmail = await resolveStudentEmail(supabase, row.invoice_id);
  if (studentEmail) void getNotifier().notify({ to: studentEmail, template: "refund_approved", data: { refundId: id, amountMinorUnits } });
}

/** Rejects a refund case — requires a non-blank rejection_reason (also enforced by refunds_rejection_reason_check at the database level, per the financial-safety patch). */
export async function rejectRefund(id: string, formData: FormData): Promise<void> {
  const admin = await requireAdminPermission("refunds:write");
  const supabase = await createClient();
  const row = await loadRefundRowForUpdate(supabase, id);
  assertTransition(row.status as RefundStatus, "rejected");

  const rejectionReason = String(formData.get("rejectionReason") ?? "").trim();
  if (rejectionReason.length === 0) {
    throw new AdminValidationError("A rejection reason is required — it is shown to the student, so please explain the decision.");
  }

  const updated = await applyRefundTransition(supabase, id, "rejected", {
    rejected_by: admin.userId,
    rejected_at: new Date().toISOString(),
    rejection_reason: rejectionReason,
  });
  await recordAuditLog({ action: "Rejected", entityType: "refund", entityId: id, entityLabel: `refund ${id}`, before: { status: row.status }, after: { status: updated.status, rejectionReason } });
  const studentEmail = await resolveStudentEmail(supabase, row.invoice_id);
  if (studentEmail) void getNotifier().notify({ to: studentEmail, template: "refund_rejected", data: { refundId: id, rejectionReason } });
}

/** Cancels a refund case before it has begun processing (requested/under_review/approved only — see REFUND_STATUS_TRANSITIONS; once claimed for processing it can no longer be cancelled). */
export async function cancelRefund(id: string): Promise<void> {
  const admin = await requireAdminPermission("refunds:write");
  const supabase = await createClient();
  const row = await loadRefundRowForUpdate(supabase, id);
  assertTransition(row.status as RefundStatus, "cancelled");

  const updated = await applyRefundTransition(supabase, id, "cancelled", { cancelled_by: admin.userId, cancelled_at: new Date().toISOString() });
  await recordAuditLog({ action: "Cancelled", entityType: "refund", entityId: id, entityLabel: `refund ${id}`, before: { status: row.status }, after: { status: updated.status } });
}

export type ProcessApprovedRefundOutcome = "processed" | "failed" | "uncertain_pending_reconciliation" | "pending_provider_confirmation";

/**
 * THE financial-safety-critical function (spec §16-27, FINAL FINANCIAL
 * SAFETY PATCH issues #1 and #3). Sequence:
 *
 *   1. Milestone 13 FINAL FINANCIAL SAFETY PATCH (Issue 3) — resolve/verify
 *      the payment gateway is configured FIRST, strictly before claiming
 *      the refund for processing. This check does not move money and does
 *      not touch any client financial data, so doing it before the claim
 *      cannot itself create a state where "we don't know if Razorpay saw
 *      the request" — that uncertainty can only begin once the gateway is
 *      actually called, which now happens strictly after the claim.
 *      Previously the claim ran first: an unconfigured gateway left the
 *      refund stuck in `processing` forever, with zero provider calls ever
 *      made and no safe way back to `approved` (moving OUT of `processing`
 *      other than via finalize_refund() is deliberately impossible — see
 *      applyRefundTransition/REFUND_STATUS_TRANSITIONS above). With the
 *      check moved here, an unconfigured gateway leaves the refund exactly
 *      where it was (`approved`, zero provider calls made) so the case can
 *      simply be retried once a gateway is configured.
 *   2. Calls claim_refund_for_processing() — a database RPC that locks the
 *      refund + its payment_transaction FOR UPDATE, re-validates the
 *      remaining refundable balance against CURRENT data (not whatever was
 *      true at approval time), and only then flips status to `processing`.
 *      This is the ONLY thing standing between "approved" and an actual
 *      gateway call — see that RPC's own comment for the race conditions
 *      it closes.
 *   3. Calls the gateway with the RPC's own returned (not caller-supplied)
 *      providerPaymentId/amount/currency — so nothing this function itself
 *      computed can be substituted for what the database just verified.
 *      This call alone is wrapped in the try/catch below, so a later DB
 *      error (finalize_refund, or the provider-id-persistence update) can
 *      never be mis-classified as a gateway-transport failure.
 *   4. Classifies a THROWN outcome using the gateway's own error types:
 *        - GatewayDefiniteRejectionError -> finalize_refund(..., 'failed')
 *          (a genuine HTTP rejection from Razorpay — safe to record as failed)
 *        - GatewayUncertainOutcomeError -> finalize_refund is NEVER called
 *          and the processing claim is NEVER released. A network timeout or
 *          lost response does NOT mean the refund failed; Razorpay may have
 *          silently received or even completed it. This is exactly the case
 *          the refund.processed/refund.failed webhook (PART 6 of
 *          0016_refund_operations.sql) and reconcileRefund() below exist to
 *          resolve later, never guessed at here.
 *   5. Milestone 13 FINAL FINANCIAL SAFETY PATCH (Issue 1) — for a
 *      SUCCESSFUL (non-throwing) response, a definite HTTP success is STILL
 *      not proof the money has moved: decideRefundProcessingAction()
 *      (src/lib/payments/refund-processing.ts) inspects Razorpay's own
 *      reported refund.status. Only 'processed'/'failed' finalize; a
 *      'pending' (or any non-terminal) status instead persists the
 *      provider_refund_id (conditioned on the refund still being
 *      `processing`, so it can never resurrect a case something else has
 *      already finalized) and leaves the refund in `processing` — never
 *      incrementing amount_refunded_minor_units, never treating "the HTTP
 *      call succeeded" as "the refund is done". Never treat HTTP/API-call
 *      success alone as proof the money has actually been refunded.
 *
 * Never duplicates finalize_refund's arithmetic — every finalization call
 * site in this codebase (this function, the webhook, reconcileRefund)
 * calls the exact same RPC.
 */
export async function processApprovedRefund(id: string): Promise<ProcessApprovedRefundOutcome> {
  await requireAdminPermission("refunds:write");
  const supabase = await createClient();

  // Issue 3 — check BEFORE the claim. See docblock above.
  const gateway = getPaymentGateway();
  if (!gateway) {
    throw new PaymentGatewayNotConfiguredError();
  }

  const { data: claim, error: claimError } = await supabase.rpc("claim_refund_for_processing", { p_refund_id: id });
  if (claimError) {
    logDbError("processApprovedRefund:claim", claimError);
    throw new AdminValidationError(claimError.message);
  }
  const claimed = claim as { refund_id: string; payment_transaction_id: string; provider_payment_id: string; amount_minor_units: number; currency: string };

  let gatewayRefund;
  try {
    gatewayRefund = await gateway.createRefund({
      providerPaymentId: claimed.provider_payment_id,
      amountMinorUnits: claimed.amount_minor_units,
      internalReferenceId: claimed.refund_id,
    });
  } catch (gatewayError) {
    if (gatewayError instanceof GatewayUncertainOutcomeError) {
      // Deliberately do NOT finalize and do NOT release the processing
      // claim — see this function's docblock. Record the uncertainty in
      // the audit trail so a human knows to reconcile, but the refund
      // itself stays exactly where claim_refund_for_processing left it:
      // `processing`.
      logDbError("processApprovedRefund:uncertain", gatewayError);
      await recordAuditLog({
        action: "Processing outcome uncertain (network/transport error) — pending reconciliation",
        entityType: "refund",
        entityId: id,
        entityLabel: `refund ${id}`,
        context: { message: gatewayError.message },
      });
      return "uncertain_pending_reconciliation";
    }

    const isDefiniteRejection = gatewayError instanceof GatewayDefiniteRejectionError;
    const failureMessage = gatewayError instanceof Error ? gatewayError.message : "The payment gateway rejected this refund request.";
    if (isDefiniteRejection) {
      const { error: finalizeError } = await supabase.rpc("finalize_refund", { p_refund_id: id, p_provider_refund_id: null, p_outcome: "failed" });
      if (finalizeError) {
        logDbError("processApprovedRefund:finalize:failed", finalizeError);
      }
      await recordAuditLog({ action: "Refund failed (gateway rejected)", entityType: "refund", entityId: id, entityLabel: `refund ${id}`, context: { message: failureMessage } });
      const { data: refundRow } = await supabase.from("refunds").select("invoice_id").eq("id", id).maybeSingle();
      const studentEmail = refundRow ? await resolveStudentEmail(supabase, refundRow.invoice_id) : null;
      if (studentEmail) void getNotifier().notify({ to: studentEmail, template: "refund_failed", data: { refundId: id, reason: failureMessage } });
      return "failed";
    }

    // Any other unexpected error thrown before classification (should not
    // happen — RazorpayGateway always throws one of the two typed errors
    // above) — do not finalize; surface it to the admin, leaving the
    // refund in `processing` for investigation rather than guessing.
    logDbError("processApprovedRefund:unexpected", gatewayError);
    throw gatewayError instanceof Error ? gatewayError : new Error(failureMessage);
  }

  // Issue 1 — deliberately OUTSIDE the try/catch above: a DB error from
  // finalize_refund()/the persistence update below must never be
  // mis-classified as a gateway-transport failure.
  const action = decideRefundProcessingAction(gatewayRefund.status);

  if (action.kind === "await_confirmation") {
    // Persist the provider refund id so reconcileRefund() can query
    // Razorpay directly even if no webhook ever arrives — WITHOUT
    // finalizing and WITHOUT touching amount_refunded_minor_units (that
    // arithmetic lives exclusively inside finalize_refund()). Conditioned
    // on the refund still being `processing` so this can never resurrect
    // or overwrite a case some other process (e.g. a webhook that raced
    // ahead of this very response) has already finalized in the meantime.
    const { error: persistError } = await supabase.from("refunds").update({ provider_refund_id: gatewayRefund.providerRefundId }).eq("id", id).eq("status", "processing");
    if (persistError) {
      logDbError("processApprovedRefund:persistProviderRefundId", persistError);
    }
    await recordAuditLog({
      action: "Provider accepted refund request (pending confirmation) — awaiting webhook/reconciliation before finalizing",
      entityType: "refund",
      entityId: id,
      entityLabel: `refund ${id}`,
      context: { providerRefundId: gatewayRefund.providerRefundId, providerStatus: gatewayRefund.status },
    });
    return "pending_provider_confirmation";
  }

  // action.kind === "finalize" — a definite terminal 'processed' or
  // 'failed' response from the gateway.
  const { error: finalizeError } = await supabase.rpc("finalize_refund", {
    p_refund_id: id,
    p_provider_refund_id: gatewayRefund.providerRefundId,
    p_outcome: action.outcome,
  });
  if (finalizeError) {
    logDbError(`processApprovedRefund:finalize:${action.outcome}`, finalizeError);
    throw new Error(finalizeError.message);
  }
  await recordAuditLog({
    action: action.outcome === "processed" ? "Processed" : "Refund failed (gateway reported failed)",
    entityType: "refund",
    entityId: id,
    entityLabel: `refund ${id}`,
    after: { status: action.outcome, providerRefundId: gatewayRefund.providerRefundId },
  });
  const { data: refundRow } = await supabase.from("refunds").select("invoice_id").eq("id", id).maybeSingle();
  const studentEmail = refundRow ? await resolveStudentEmail(supabase, refundRow.invoice_id) : null;
  if (studentEmail) {
    void getNotifier().notify({
      to: studentEmail,
      template: action.outcome === "processed" ? "refund_completed" : "refund_failed",
      data:
        action.outcome === "processed"
          ? { refundId: id, amountMinorUnits: claimed.amount_minor_units }
          : { refundId: id, reason: "The payment provider reported this refund as failed." },
    });
  }
  return action.outcome;
}

export type ReconcileRefundOutcome = "still_processing" | "awaiting_webhook" | "processed" | "failed";

/**
 * Manual reconciliation (spec §26/§27) — for a refund an admin believes
 * has been stuck in `processing` longer than expected (the sync gateway
 * call returned an uncertain outcome and no webhook has arrived yet).
 * Calls the SAME finalize_refund() RPC every other finalization path uses
 * — never its own arithmetic — so a race against a webhook that resolves
 * the same refund moments later collapses to finalize_refund's own
 * already-terminal no-op (see that RPC's own comment for spec §24).
 *
 * If this refund case never got a provider_refund_id recorded (the
 * gateway's create-refund response was itself lost before any id was
 * captured — the deepest form of spec §20's uncertain-outcome case), there
 * is nothing this function can ask Razorpay to fetch by id; that case is
 * resolved only by the refund.processed/refund.failed webhook's own
 * fallback matching (PART 6 of 0016_refund_operations.sql, "exactly one
 * processing refund with no provider_refund_id yet") — documented as a
 * known limitation in M13_COMPLETION_REPORT.md rather than silently
 * guessed at here.
 */
export async function reconcileRefund(id: string): Promise<ReconcileRefundOutcome> {
  await requireAdminPermission("refunds:write");
  const supabase = await createClient();
  const row = await loadRefundRowForUpdate(supabase, id);

  if (row.status !== "processing") {
    throw new AdminValidationError(`Only a refund currently "processing" can be reconciled (this one is "${row.status}").`);
  }
  if (!row.provider_refund_id) {
    return "awaiting_webhook";
  }

  const gateway = getPaymentGateway();
  if (!gateway) throw new PaymentGatewayNotConfiguredError();

  let fetched;
  try {
    fetched = await gateway.getRefundStatus(row.provider_refund_id);
  } catch (err) {
    if (err instanceof GatewayUncertainOutcomeError) {
      logDbError("reconcileRefund:uncertain", err);
      return "still_processing";
    }
    throw err;
  }

  if (fetched.status === "pending") return "still_processing";

  const { error: finalizeError } = await supabase.rpc("finalize_refund", {
    p_refund_id: id,
    p_provider_refund_id: row.provider_refund_id,
    p_outcome: fetched.status,
  });
  if (finalizeError) {
    logDbError("reconcileRefund:finalize", finalizeError);
    throw new Error(finalizeError.message);
  }
  await recordAuditLog({
    action: `Reconciled (${fetched.status})`,
    entityType: "refund",
    entityId: id,
    entityLabel: `refund ${id}`,
    after: { status: fetched.status },
  });
  const studentEmail = await resolveStudentEmail(supabase, row.invoice_id);
  if (studentEmail) {
    void getNotifier().notify({ to: studentEmail, template: fetched.status === "processed" ? "refund_completed" : "refund_failed", data: { refundId: id } });
  }
  return fetched.status;
}
