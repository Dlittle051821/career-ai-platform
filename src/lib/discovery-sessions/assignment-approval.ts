/**
 * CC-25 — Discovery Session assignment approval (presentation + error
 * mapping). The rules themselves live in the database (migration 0023 CC-25:
 * discovery_sessions_guard_cc25 trigger and
 * admin_set_discovery_session_assignment_approval RPC). This module only
 * turns their outcomes into words for staff screens; it never decides access.
 */

import type { DiscoverySession, DiscoverySessionStatus } from "@/types/discovery-session";

export const ACTIVE_DISCOVERY_SESSION_STATUSES: readonly DiscoverySessionStatus[] = ["requested", "scheduled"];

export type AssignmentApprovalState =
  | { kind: "unassigned" }
  | { kind: "approved"; approvedAt: string | null }
  | { kind: "awaiting_approval"; canApprove: boolean }
  | { kind: "not_tracked" };

type ApprovalFields = Pick<DiscoverySession, "assignedCounsellorId" | "assignmentApproved" | "assignmentApprovedAt" | "status">;

export function getAssignmentApprovalState(session: ApprovalFields): AssignmentApprovalState {
  if (!session.assignedCounsellorId) return { kind: "unassigned" };
  if (session.assignmentApproved === null || session.assignmentApproved === undefined) return { kind: "not_tracked" };
  if (session.assignmentApproved) return { kind: "approved", approvedAt: session.assignmentApprovedAt ?? null };
  return { kind: "awaiting_approval", canApprove: ACTIVE_DISCOVERY_SESSION_STATUSES.includes(session.status) };
}

/** Messages the database raises on purpose (migration 0023 CC-25); safe to show as written. */
const DATABASE_GUARD_MESSAGES = [
  "The student attached to a Discovery Session cannot be changed.",
  "Only an admin can approve a Discovery Session assignment.",
  "This Discovery Session assignment has not been approved by an admin. You can only claim an unassigned request.",
  "An approval must name the currently assigned counsellor.",
  "Only an admin can approve or revoke a Discovery Session assignment.",
  "This session is no longer assigned to that counsellor. Reload the page and try again.",
  "Only a requested or scheduled session can be approved.",
  "That counsellor is inactive.",
  "Discovery Session not found.",
] as const;

/**
 * A database error from a Discovery Session write, as a sentence a staff
 * member can act on. Known guard messages pass through verbatim; anything
 * else becomes a generic message (raw database text is never shown).
 */
export function discoverySessionWriteErrorMessage(error: { code?: string | null; message?: string | null } | null | undefined): string {
  const message = error?.message ?? "";
  const known = DATABASE_GUARD_MESSAGES.find((m) => message === m || message.startsWith(m));
  if (known) return known;
  if (error?.code === "42501" || /row-level security|permission denied/i.test(message)) {
    return "You don't have permission to make this change.";
  }
  if (error?.code === "23505") {
    return "This student already has an active Discovery Session.";
  }
  return "We couldn't save this Discovery Session. Please try again.";
}
