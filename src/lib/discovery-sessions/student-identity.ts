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
 * It never widens access: it only labels what RLS already decided. The
 * access fix for an assigned counsellor is the separate, approval-gated
 * migration 0023 (docs/cc24/CC24-03-SECURITY-AND-RLS-REPORT.md).
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

type IdentityFields = Pick<DiscoverySession, "studentName" | "studentEmail" | "studentIdentityVisible" | "assignedCounsellorId">;

export function describeDiscoverySessionStudent(session: IdentityFields): DiscoverySessionStudentIdentity {
  if (session.studentIdentityVisible === false) {
    return {
      name: RESTRICTED_STUDENT_LABEL,
      detail: session.assignedCounsellorId
        ? "Your account can't read this student's profile yet. Ask an admin to check your access."
        : "Name and contact details appear once this request is assigned to you.",
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
