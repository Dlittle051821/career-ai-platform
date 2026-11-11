/**
 * CC-24 — what a staff screen shows for the student behind a Discovery
 * Session.
 *
 * Staff read the student's name and email from public.profiles, which RLS
 * filters by role: admins read every profile, a counsellor only the
 * students they are allowed to see. A profile the viewer cannot read used
 * to render exactly like a profile with an empty name ("Unnamed student"),
 * so a missing permission looked like missing data (CC-23 F11). This
 * keeps the two apart and says plainly when the details are restricted.
 *
 * It never widens access: it only labels what the database already decided.
 * CC-25: the identity now comes from the least-privilege
 * staff_discovery_session_student_identities RPC (migration 0023 CC-25),
 * which returns name and email only for an admin-approved, active
 * assignment or the counsellor's caseload (docs/cc25/CC25-02).
 */

import type { DiscoverySession } from "@/types/discovery-session";

export const UNNAMED_STUDENT_LABEL = "Unnamed student";
export const RESTRICTED_STUDENT_LABEL = "Student details restricted";

export interface DiscoverySessionStudentIdentity {
  /** Heading / list label for the student. */
  name: string;
  /** Secondary line: the email, "No email on file", or why details are hidden. */
  detail: string;
  /** True when the viewer is not allowed to read this student's profile. */
  restricted: boolean;
}

type IdentityFields = Pick<DiscoverySession, "studentName" | "studentEmail" | "studentIdentityVisible" | "assignedCounsellorId"> &
  Partial<Pick<DiscoverySession, "assignmentApproved" | "status">>;

/**
 * CC-25 — why the details are hidden, in the order the database checks it
 * (staff_discovery_session_student_identities): no assignment, assignment
 * not approved by an admin, session no longer active, otherwise access was
 * withheld for this account (e.g. reassigned or inactive).
 */
function restrictedDetail(session: IdentityFields): string {
  if (!session.assignedCounsellorId) return "Name and contact details appear once this request is assigned to you and approved by an admin.";
  if (session.assignmentApproved === false) return "Waiting for an admin to approve this assignment.";
  if (session.status && session.status !== "requested" && session.status !== "scheduled") {
    return "Details are only shown for requested or scheduled sessions.";
  }
  return "Your account can't view this student's details. Ask an admin to check the assignment.";
}

export function describeDiscoverySessionStudent(session: IdentityFields): DiscoverySessionStudentIdentity {
  if (session.studentIdentityVisible === false) {
    return {
      name: RESTRICTED_STUDENT_LABEL,
      detail: restrictedDetail(session),
      restricted: true,
    };
  }
  const name = session.studentName?.trim();
  return {
    name: name ? name : UNNAMED_STUDENT_LABEL,
    detail: session.studentEmail ?? "No email on file",
    restricted: false,
  };
}
