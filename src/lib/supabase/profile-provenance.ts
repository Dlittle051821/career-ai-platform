import "server-only";
import { createClient } from "./server";
import { PROFILE_SECTION_KEYS, type ProfileSectionKey, type ProvenanceValue, type SectionProvenance } from "@/types/profile-provenance";

/**
 * Milestone 11-C1 — student-facing, READ-ONLY view of a student's own
 * profile section provenance. Deliberately not gated by an admin
 * permission (there is no admin role here): the student_profile_section_
 * provenance RLS policy "Students can read their own section provenance"
 * (0013 PART 4) is the actual boundary, mirroring how
 * getStudentProfileSnapshot() relies on `student_*` RLS rather than an
 * app-layer check. The counsellor's display name is deliberately never
 * resolved here — `counsellors` RLS only allows admin roles to read that
 * table (0004_admin_system.sql), so a student sees "your counsellor"
 * rather than a name; the admin-facing src/lib/supabase/admin/
 * profile-provenance.ts's getSectionProvenanceMap() is where staff see
 * the actual name.
 */
export async function getMySectionProvenanceMap(): Promise<Record<ProfileSectionKey, SectionProvenance> | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("student_profile_section_provenance").select("*").eq("student_user_id", user.id);
  const rows = data ?? [];
  const bySectionKey = new Map(rows.map((r) => [r.section_key, r]));

  const result = {} as Record<ProfileSectionKey, SectionProvenance>;
  for (const key of PROFILE_SECTION_KEYS) {
    const row = bySectionKey.get(key);
    result[key] = row
      ? {
          sectionKey: key,
          provenance: row.provenance as ProvenanceValue,
          verifiedByCounsellorId: row.verified_by_counsellor_id,
          verifiedByCounsellorName: null,
          verifiedAt: row.verified_at,
          lastUpdatedBy: row.last_updated_by,
          note: null, // internal staff note — never shown to the student
          updatedAt: row.updated_at,
        }
      : {
          sectionKey: key,
          provenance: "SELF_ENTERED",
          verifiedByCounsellorId: null,
          verifiedByCounsellorName: null,
          verifiedAt: null,
          lastUpdatedBy: null,
          note: null,
          updatedAt: null,
        };
  }
  return result;
}
