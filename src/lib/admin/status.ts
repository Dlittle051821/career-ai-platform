import type { AgreementStatus, ApplicationStage, ContentStatus, LeadStage, PaymentStatus, SignatureStatus, StampStatus } from "@/types/admin";
import type { DiscoverySessionStatus } from "@/types/discovery-session";
import type { InvoiceStatus, PaymentAttemptStatus } from "@/types/payments";
import type { PricingOfferStatus, PricingPlanVersionStatus } from "@/types/pricing";

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

/** Milestone 11-A (F-123) — mirrors SIGNATURE_STATUS_TRANSITIONS exactly, same "manually settable but overridden by the real webhook-driven flow once one exists" posture (see public.sync_agreement_stamp_status(), 0012 PART 2.1). */
export const STAMP_STATUS_TRANSITIONS: Record<StampStatus, StampStatus[]> = {
  not_started: ["pending_stamp", "stamped"],
  pending_stamp: ["stamped", "not_started"],
  stamped: [],
};

/** Milestone 11-B — Discovery Session lifecycle. A session can be marked no_show only from 'scheduled' (never straight from 'requested' — it has to have had a scheduled time to be a no-show at); 'requested' can also go straight to 'no_show' is deliberately NOT allowed for the same reason. completed/cancelled/no_show are all terminal — a fresh Discovery Session is a new booking, never a reopened old one. */
export const DISCOVERY_SESSION_STATUS_TRANSITIONS: Record<DiscoverySessionStatus, DiscoverySessionStatus[]> = {
  requested: ["scheduled", "cancelled"],
  scheduled: ["completed", "no_show", "cancelled"],
  completed: [],
  cancelled: [],
  no_show: [],
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

/**
 * Milestone 10 — pricing plan VERSION transitions. Deliberately narrower
 * than CONTENT_STATUS_TRANSITIONS above: once a version is published, it
 * can only ever move to archived — never back to draft, never re-edited —
 * because supabase/migrations/0007_nextwise_pricing_offers.sql PART 2.1's
 * database trigger physically enforces that same restriction at the row
 * level. This graph exists so the admin UI can disable/hide a transition
 * the database would reject anyway, not as the actual enforcement (the
 * trigger is). "Create a new price version" is how you change anything
 * about an archived or published version — never a status transition.
 */
export const PRICING_PLAN_VERSION_STATUS_TRANSITIONS: Record<PricingPlanVersionStatus, PricingPlanVersionStatus[]> = {
  draft: ["published"],
  published: ["archived"],
  archived: [],
};

/**
 * Milestone 10 — pricing OFFER transitions. Offers are not immutable the
 * way plan versions are (spec: "Add, schedule, disable and archive
 * offers" implies ongoing management, not a one-shot publish) — an
 * archived offer can be restored to draft for further edits, same pattern
 * as CONTENT_STATUS_TRANSITIONS. `is_active` is a separate boolean toggle
 * (spec: "disable" an offer) independent of this status graph — an admin
 * can flip is_active off/on for a published offer without moving it
 * through this graph at all.
 */
export const PRICING_OFFER_STATUS_TRANSITIONS: Record<PricingOfferStatus, PricingOfferStatus[]> = {
  draft: ["published", "archived"],
  published: ["archived"],
  archived: ["draft"],
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
