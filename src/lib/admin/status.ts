import type { AgreementStatus, ApplicationStage, ContentStatus, LeadStage, PaymentStatus, SignatureStatus } from "@/types/admin";
import type { InvoiceStatus, PaymentAttemptStatus } from "@/types/payments";

/**
 * Status-transition graphs for every module with a controlled status
 * field. Each graph maps a status to the set of statuses it may move to
 * next. A server action validates every status change against the
 * relevant graph via isValidTransition() BEFORE writing to the database —
 * this is what "use controlled statuses and retain auditable history"
 * means in practice: the graph is the single place a transition rule
 * lives, checked the same way from every mutation, and every accepted
 * transition is written to admin_audit_log by the caller.
 *
 * These graphs are deliberately permissive about "backward" moves (e.g. a
 * lead can go from `qualified` back to `contacted`) — real counselling
 * work is not always linear — but they do block nonsensical jumps (e.g. a
 * lead cannot move directly from `lost` to `converted`; it must be
 * reopened to an active stage first).
 */

export const LEAD_STAGE_TRANSITIONS: Record<LeadStage, LeadStage[]> = {
  new: ["contacted", "qualified", "lost"],
  contacted: ["qualified", "nurturing", "lost"],
  qualified: ["nurturing", "converted", "lost"],
  nurturing: ["contacted", "qualified", "converted", "lost"],
  converted: [],
  lost: ["new", "contacted"],
};

export const APPLICATION_STAGE_TRANSITIONS: Record<ApplicationStage, ApplicationStage[]> = {
  inquiry: ["preparing", "withdrawn"],
  preparing: ["submitted", "withdrawn"],
  submitted: ["under_review", "withdrawn"],
  under_review: ["interview", "decision_pending", "withdrawn"],
  interview: ["decision_pending", "withdrawn"],
  decision_pending: ["offer_received", "rejected", "withdrawn"],
  offer_received: ["enrolled", "withdrawn"],
  enrolled: [],
  rejected: [],
  withdrawn: [],
};

export const PAYMENT_STATUS_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ["paid", "failed", "cancelled"],
  paid: ["refunded", "partially_refunded"],
  failed: ["pending", "cancelled"],
  refunded: [],
  partially_refunded: ["refunded"],
  cancelled: [],
};

export const AGREEMENT_STATUS_TRANSITIONS: Record<AgreementStatus, AgreementStatus[]> = {
  draft: ["sent", "cancelled"],
  sent: ["signed", "declined", "expired", "cancelled"],
  signed: ["cancelled"],
  declined: ["sent"],
  expired: ["sent"],
  cancelled: [],
};

export const SIGNATURE_STATUS_TRANSITIONS: Record<SignatureStatus, SignatureStatus[]> = {
  not_started: ["pending_signature", "signed"],
  pending_signature: ["signed", "not_started"],
  signed: [],
};

export const CONTENT_STATUS_TRANSITIONS: Record<ContentStatus, ContentStatus[]> = {
  draft: ["published", "archived"],
  published: ["draft", "archived"],
  archived: ["draft"],
};

/**
 * Milestone 8 — invoice status transitions. void is reachable only from
 * draft/issued/overdue (an unpaid invoice) — never from a state where money
 * has already moved (partially_paid/paid/etc.), matching the spec's "cancel
 * /void an unpaid invoice" journey. This graph is advisory/UI-facing only
 * for the payment-driven transitions (paid, partially_paid, overdue,
 * refunded, partially_refunded) — those are actually decided by
 * public.recompute_invoice_status() / src/lib/payments/invoice-status.ts,
 * never picked directly by an admin. issued->void and draft->issued (via
 * the issue-invoice action) are the two transitions a server action
 * actually performs directly.
 */
export const INVOICE_STATUS_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ["issued", "void"],
  issued: ["partially_paid", "paid", "overdue", "void"],
  partially_paid: ["paid", "overdue", "partially_refunded"],
  overdue: ["partially_paid", "paid", "void"],
  paid: ["refunded", "partially_refunded"],
  partially_refunded: ["refunded"],
  refunded: [],
  void: [],
};

/**
 * Milestone 8 — payment-attempt (gateway order) status transitions. A
 * failed or cancelled attempt is terminal by design: a retry after failure
 * creates a NEW payment_attempts row (a new Razorpay order), never
 * resurrects an old one — this mirrors how Razorpay itself scopes a
 * payment attempt to one order. Every transition here is actually driven
 * by cryptographically verified gateway evidence (see
 * public.verify_checkout_payment()/public.apply_webhook_event() in
 * 0005_payments_billing.sql), never picked directly by a user.
 */
export const PAYMENT_ATTEMPT_STATUS_TRANSITIONS: Record<PaymentAttemptStatus, PaymentAttemptStatus[]> = {
  created: ["pending", "authorized", "captured", "failed", "cancelled"],
  pending: ["authorized", "captured", "failed", "cancelled"],
  authorized: ["captured", "failed"],
  captured: ["refunded", "partially_refunded"],
  failed: [],
  cancelled: [],
  refunded: [],
  partially_refunded: ["refunded"],
};

/** Generic, graph-agnostic transition check — every module's server action calls this with its own graph. Same status -> same status is always allowed (a no-op save shouldn't be rejected as an invalid transition). */
export function isValidTransition<S extends string>(graph: Record<S, S[]>, from: S, to: S): boolean {
  if (from === to) return true;
  return graph[from]?.includes(to) ?? false;
}

/** Every status a graph can reach from a given starting point (direct neighbors only) — used to build a "next status" <select> without hardcoding options per page. */
export function nextStatusOptions<S extends string>(graph: Record<S, S[]>, from: S): S[] {
  return graph[from] ?? [];
}
