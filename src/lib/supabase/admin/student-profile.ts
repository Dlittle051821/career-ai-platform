import "server-only";
import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { fetchStudentProfileSnapshotByUserId } from "../student-profile";
import type { StudentProfileSnapshot } from "@/types/student-profile";

/**
 * Milestone 11-C1 — the admin/counsellor-facing equivalent of
 * getStudentProfileSnapshot() (src/lib/supabase/student-profile.ts), which
 * only ever reads "whoever is logged in"'s own profile. This one takes an
 * explicit student id and is gated by requireAdminPermission("students:read")
 * — the same permission the rest of the admin Student Case Workspace
 * (getStudentDetail(), src/lib/supabase/admin/students.ts) already requires
 * to view a student at all. RLS on every student_* table (0004_admin_
 * system.sql PART "Admin/counsellor read access to student-reported data")
 * is the independent backstop: super_admin/admin/analyst read every
 * student's rows, a counsellor only their admin_student_meta-assigned
 * students' rows — a counsellor calling this for an unassigned student
 * simply gets back an empty/default snapshot, never an error, never another
 * counsellor's data.
 *
 * Used to compute the SAME calculateCompletion() (src/lib/profile/
 * completion.ts) section breakdown the student sees on their own /profile
 * page, so the admin-side "Profile completeness & section provenance"
 * panel (src/app/admin/students/[id]/page.tsx) shows a consistent picture
 * — never a second, drifting completion calculation.
 */
export async function getStudentProfileSnapshotForAdmin(studentUserId: string): Promise<StudentProfileSnapshot> {
  await requireAdminPermission("students:read");
  const supabase = await createClient();
  return fetchStudentProfileSnapshotByUserId(supabase, studentUserId);
}
