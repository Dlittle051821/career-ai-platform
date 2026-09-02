/**
 * Milestone 11-B — pure, framework-free business rules for Discovery
 * Session booking and staff-side lifecycle management. Same "pure
 * src/lib/<domain> vs I/O src/lib/supabase/<domain>" split as
 * src/lib/signatures/rules.ts and src/lib/stamping/rules.ts — nothing here
 * talks to Supabase. Every function returns a discriminated { ok: true } |
 * { ok: false, reason } result and never throws; the I/O layer turns a
 * `reason` into a thrown AdminValidationError (admin side) or a plain Error
 * (student side).
 *
 * Defense-in-depth: the database independently enforces the rules that
 * matter for correctness/security (discovery_sessions' status CHECK
 * constraint, its RLS policies, the assigned-counsellor scoping) — see
 * supabase/migrations/0013_assisted_onboarding_and_recommendation_readiness.sql
 * PART 2. A bug here can produce a worse error message; it can never
 * produce an invalid database state.
 */

import type { DiscoverySessionStatus } from "@/types/discovery-session";

export type RuleResult = { ok: true } | { ok: false; reason: string };

function fail(reason: string): RuleResult {
  return { ok: false, reason };
}
const OK: RuleResult = { ok: true };

// ---------------------------------------------------------------------------
// Booking — a student requesting a free Discovery Session.
// ---------------------------------------------------------------------------

export interface BookDiscoverySessionInput {
  isAuthenticated: boolean;
  /** True if this student already has a non-terminal (requested/scheduled) Discovery Session. */
  hasActiveSession: boolean;
}

const ACTIVE_STATUSES: DiscoverySessionStatus[] = ["requested", "scheduled"];

export function validateBookDiscoverySession(input: BookDiscoverySessionInput): RuleResult {
  if (!input.isAuthenticated) return fail("You must be signed in to book a Discovery Session.");
  if (input.hasActiveSession) {
    return fail("You already have a Discovery Session request in progress — no need to book another one.");
  }
  return OK;
}

// ---------------------------------------------------------------------------
// Staff-side lifecycle — assign, schedule, mark complete/no-show, cancel.
// Status transitions themselves are validated against
// DISCOVERY_SESSION_STATUS_TRANSITIONS (src/lib/admin/status.ts) by the I/O
// layer, same pattern as every other controlled-status module in this
// codebase; these rules cover the preconditions a transition graph alone
// can't express.
// ---------------------------------------------------------------------------

export interface AssignCounsellorInput {
  hasPermission: boolean;
  sessionExists: boolean;
  status: DiscoverySessionStatus | null;
}

export function validateAssignCounsellor(input: AssignCounsellorInput): RuleResult {
  if (!input.hasPermission) return fail("You do not have permission to assign a Discovery Session.");
  if (!input.sessionExists || !input.status) return fail("Discovery Session not found.");
  if (input.status === "cancelled" || input.status === "completed" || input.status === "no_show") {
    return fail(`Cannot assign a counsellor to a Discovery Session that is already "${input.status}".`);
  }
  return OK;
}

export interface ScheduleDiscoverySessionInput {
  hasPermission: boolean;
  sessionExists: boolean;
  status: DiscoverySessionStatus | null;
  hasAssignedCounsellor: boolean;
  scheduledAt: string | null | undefined;
}

export function validateScheduleDiscoverySession(input: ScheduleDiscoverySessionInput): RuleResult {
  if (!input.hasPermission) return fail("You do not have permission to schedule a Discovery Session.");
  if (!input.sessionExists || !input.status) return fail("Discovery Session not found.");
  if (!ACTIVE_STATUSES.includes(input.status)) {
    return fail(`Cannot schedule a Discovery Session that is already "${input.status}".`);
  }
  if (!input.hasAssignedCounsellor) return fail("Assign a counsellor before scheduling a time.");
  if (!input.scheduledAt) return fail("A scheduled date/time is required.");
  return OK;
}

export interface CancelDiscoverySessionInput {
  hasPermission: boolean;
  sessionExists: boolean;
  status: DiscoverySessionStatus | null;
}

export function validateCancelDiscoverySession(input: CancelDiscoverySessionInput): RuleResult {
  if (!input.hasPermission) return fail("You do not have permission to cancel a Discovery Session.");
  if (!input.sessionExists || !input.status) return fail("Discovery Session not found.");
  if (input.status === "completed" || input.status === "cancelled" || input.status === "no_show") {
    return fail(`Cannot cancel a Discovery Session that is already "${input.status}".`);
  }
  return OK;
}

// ---------------------------------------------------------------------------
// Discovery Session Counsellor Workspace (Milestone 11-B2) — a cancelled
// session's workspace is frozen (the session never happened, so there is
// nothing further to record); every other status remains editable,
// including 'completed' (a counsellor finishing up notes after the call).
// ---------------------------------------------------------------------------

export interface SaveDiscoverySessionWorkspaceInput {
  hasPermission: boolean;
  sessionExists: boolean;
  status: DiscoverySessionStatus | null;
}

export function validateSaveDiscoverySessionWorkspace(input: SaveDiscoverySessionWorkspaceInput): RuleResult {
  if (!input.hasPermission) return fail("You do not have permission to edit this Discovery Session's workspace.");
  if (!input.sessionExists || !input.status) return fail("Discovery Session not found.");
  if (input.status === "cancelled") return fail("Cannot edit the workspace for a cancelled Discovery Session.");
  return OK;
}
