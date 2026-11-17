/**
 * Career Intelligence access — the pure decision.
 *
 * Free: registering, the profile, the whole assessment, saving answers.
 * Paid: every personalised output (matches, fit bands, explanations,
 * roadmaps, reports). This module turns facts the server has already read
 * into one access state; it reads nothing itself, so every rule is testable.
 * The server reader is src/lib/supabase/career-intelligence-access.ts.
 *
 * What counts as paid is the invoice's own live status, which the database
 * maintains from real payment and refund records. Only `paid` unlocks.
 * A purchase row, a checkout that was started, an issued or overdue
 * invoice, a failed attempt, a void or refunded invoice — none of them do.
 *
 * Staff are decided from their admin role, never from a purchase.
 */
export type CareerIntelligenceAccessState =
  /** Not signed in. */
  | "anonymous"
  /** Signed in, no qualifying purchase. */
  | "free"
  /** A qualifying plan was chosen but its invoice is not paid yet (issued / partially paid / overdue). */
  | "payment_pending"
  /** A qualifying plan with a paid invoice. */
  | "active"
  /** Access existed for a limited period that has ended. Answers are kept; results are not shown. */
  | "expired"
  /** Access was withdrawn: every qualifying invoice is refunded, partially refunded or void. */
  | "revoked"
  /** Admin staff, by role. */
  | "staff";

export const PAID_INVOICE_STATUS = "paid";
export const PENDING_INVOICE_STATUSES: readonly string[] = ["issued", "partially_paid", "overdue"];
export const REVOKED_INVOICE_STATUSES: readonly string[] = ["refunded", "partially_refunded", "void"];

export interface CareerIntelligenceAccessFacts {
  isSignedIn: boolean;
  /** From the existing admin role check — never from purchase state. */
  isStaff: boolean;
  /**
   * One entry per purchase of a plan that carries the career_intelligence
   * capability: the live status of its invoice, or null when it has none.
   */
  qualifyingInvoiceStatuses: readonly (string | null)[];
  /**
   * End of a time-limited access period, when the entitlement model has one
   * (ISO timestamp). No current plan sets this; it is here so a future
   * time-boxed plan or grant needs no change to any caller.
   */
  accessEndsAt?: string | null;
  now?: number;
}

export function resolveCareerIntelligenceAccess(facts: CareerIntelligenceAccessFacts): CareerIntelligenceAccessState {
  if (!facts.isSignedIn) return "anonymous";
  if (facts.isStaff) return "staff";
  const statuses = facts.qualifyingInvoiceStatuses;
  if (statuses.some((s) => s === PAID_INVOICE_STATUS)) {
    if (facts.accessEndsAt) {
      const end = Date.parse(facts.accessEndsAt);
      // an unreadable end date is treated as ended: fail closed
      if (Number.isNaN(end) || end <= (facts.now ?? Date.now())) return "expired";
    }
    return "active";
  }
  if (statuses.some((s) => s !== null && PENDING_INVOICE_STATUSES.includes(s))) return "payment_pending";
  if (statuses.some((s) => s !== null && REVOKED_INVOICE_STATUSES.includes(s))) return "revoked";
  return "free";
}

/** The single yes/no every protected surface asks. */
export function canViewCareerIntelligence(state: CareerIntelligenceAccessState): boolean {
  return state === "active" || state === "staff";
}

/** Where a student without access is sent. `from` is a fixed label, never a URL. */
export const CAREER_INTELLIGENCE_ACCESS_PATH = "/career/access";
export type CareerIntelligenceGateSource = "recommendations" | "dashboard" | "studio" | "compare" | "report";
export function careerIntelligenceAccessHref(from?: CareerIntelligenceGateSource): string {
  return from ? `${CAREER_INTELLIGENCE_ACCESS_PATH}?from=${from}` : CAREER_INTELLIGENCE_ACCESS_PATH;
}
