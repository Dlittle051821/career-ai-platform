/**
 * University Discovery V3 — access model (pure; no I/O).
 *
 * Three student-facing tiers plus staff, exactly as approved (a Verified student
 * may hold the tier through a paid purchase or through an administrator's grant):
 *   - anonymous / signed-in free: country discovery + official public portals only;
 *   - verified: the Nextwise university directory, student-safe profiles and the shortlist;
 *   - admin: the directory, plus the internal course research workspace under /admin.
 *
 * The internal COURSE database is never part of any student tier, including verified.
 *
 * This module only classifies facts that the server already fetched
 * (src/lib/supabase/education/university-access.ts). It never reads cookies,
 * query strings or anything a browser could forge.
 */

export type UniversityAccessState =
  | "anonymous"
  | "signed_in_free"
  | "payment_pending"
  | "payment_failed"
  | "verified"
  /** Verified access granted by an administrator (public.university_access_grants), not bought. */
  | "verified_by_grant"
  | "admin";

/**
 * Plans whose PAID purchase unlocks the university directory. `nextwise-verified`
 * is the approved entry plan (Rs 1,999, GST-inclusive); `nextwise-essential`
 * includes "Everything in Nextwise Verified" in its own published inclusion list.
 * Slugs are the stable identifiers of public.pricing_plans (never repurposed).
 */
export const UNIVERSITY_DIRECTORY_PLAN_SLUGS: readonly string[] = ["nextwise-verified", "nextwise-essential"];

/** Invoice states in which a Verified purchase has been started but is not (yet) paid. */
export const PENDING_INVOICE_STATUSES: readonly string[] = ["issued", "partially_paid", "overdue"];

export interface UniversityAccessFacts {
  isSignedIn: boolean;
  isAdmin: boolean;
  /** One entry per purchase of a qualifying plan: the live status of its invoice, or null when it has none. */
  qualifyingInvoiceStatuses: readonly (string | null)[];
  /** True when the student holds an admin grant that is neither revoked nor expired. Decided by the database. */
  hasActiveGrant?: boolean;
  /** True when the most recent payment attempt on an unpaid qualifying invoice failed or was cancelled. */
  latestAttemptFailed?: boolean;
}

/**
 * Fail-closed: only an invoice whose live status is exactly `paid` grants access
 * (same rule as src/lib/products/entitlements.ts, NW05.6). A refunded, void or
 * missing invoice grants nothing. Staff access follows the existing admin_roles check.
 */
export function resolveUniversityAccess(facts: UniversityAccessFacts): UniversityAccessState {
  if (!facts.isSignedIn) return "anonymous";
  if (facts.isAdmin) return "admin";
  if (facts.qualifyingInvoiceStatuses.some((status) => status === "paid")) return "verified";
  if (facts.hasActiveGrant === true) return "verified_by_grant";
  if (facts.qualifyingInvoiceStatuses.some((status) => status !== null && PENDING_INVOICE_STATUSES.includes(status))) {
    return facts.latestAttemptFailed === true ? "payment_failed" : "payment_pending";
  }
  return "signed_in_free";
}

export function canUseUniversityDirectory(state: UniversityAccessState): boolean {
  return state === "verified" || state === "verified_by_grant" || state === "admin";
}

/** The internal course database is staff-only. No student tier, paid or not, may read it. */
export function canUseInternalCourseDatabase(state: UniversityAccessState): boolean {
  return state === "admin";
}
