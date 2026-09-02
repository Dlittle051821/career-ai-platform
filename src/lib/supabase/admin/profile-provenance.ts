import "server-only";
import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { recordAuditLog } from "./audit";
import { AdminValidationError } from "@/lib/admin/form-state";
import { validateSetSectionProvenance } from "@/lib/profile-provenance/rules";
import { trackEvent } from "../analytics/track";
import {
  PROFILE_SECTION_KEYS,
  type ProfileSectionKey,
  type ProvenanceValue,
  type SectionProvenance,
} from "@/types/profile-provenance";

function logDbError(context: string, error: unknown) {
  console.error(`[admin/profile-provenance] ${context}:`, error);
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

interface ProvenanceRow {
  section_key: string;
  provenance: string;
  verified_by_counsellor_id: string | null;
  verified_at: string | null;
  last_updated_by: string | null;
  note: string | null;
  updated_at: string;
}

async function buildCounsellorNameMap(supabase: Supabase, ids: (string | null)[]): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(ids.filter((id): id is string => id !== null)));
  if (uniqueIds.length === 0) return new Map();
  const { data, error } = await supabase.from("counsellors").select("id, display_name").in("id", uniqueIds);
  if (error) {
    logDbError("buildCounsellorNameMap", error);
    return new Map();
  }
  return new Map((data ?? []).map((c) => [c.id, c.display_name]));
}

/**
 * Every section for a student, defaulting to SELF_ENTERED for any section
 * with no override row — that default is the true state, not a
 * placeholder (see the table's own comment in 0013 PART 4). Gated by
 * "profile-verification:read"; RLS is the independent backstop deciding
 * whether the caller's counsellor session can actually see this student's
 * rows at all (0013 PART 4 as widened by 0014 PART 2).
 */
export async function getSectionProvenanceMap(studentUserId: string): Promise<Record<ProfileSectionKey, SectionProvenance>> {
  await requireAdminPermission("profile-verification:read");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("student_profile_section_provenance")
    .select("*")
    .eq("student_user_id", studentUserId);
  if (error) logDbError("getSectionProvenanceMap", error);

  const rows = (data ?? []) as ProvenanceRow[];
  const counsellorNameById = await buildCounsellorNameMap(supabase, rows.map((r) => r.verified_by_counsellor_id));
  const bySectionKey = new Map(rows.map((r) => [r.section_key, r]));

  const result = {} as Record<ProfileSectionKey, SectionProvenance>;
  for (const key of PROFILE_SECTION_KEYS) {
    const row = bySectionKey.get(key);
    result[key] = row
      ? {
          sectionKey: key,
          provenance: row.provenance as ProvenanceValue,
          verifiedByCounsellorId: row.verified_by_counsellor_id,
          verifiedByCounsellorName: row.verified_by_counsellor_id ? (counsellorNameById.get(row.verified_by_counsellor_id) ?? null) : null,
          verifiedAt: row.verified_at,
          lastUpdatedBy: row.last_updated_by,
          note: row.note,
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

/**
 * Records a counsellor's COUNSELLOR_ENTERED or COUNSELLOR_VERIFIED
 * determination for one section — never SELF_ENTERED/SYSTEM_DERIVED (see
 * validateSetSectionProvenance()). Does NOT write to any student_* table:
 * this is a metadata-only record of who vouches for a section, not a
 * mechanism for a counsellor to edit the student's actual self-reported
 * data (there is no such admin data-entry path in this codebase — /admin/
 * students is deliberately read-only for student-reported data, see
 * docs/admin-system-guide.md §4).
 */
export async function setSectionProvenance(studentUserId: string, formData: FormData): Promise<void> {
  const admin = await requireAdminPermission("profile-verification:write");
  const sectionKey = String(formData.get("sectionKey") ?? "").trim();
  const provenance = String(formData.get("provenance") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;

  const check = validateSetSectionProvenance({
    hasPermission: true,
    sectionKey,
    provenance,
    hasCounsellorId: Boolean(admin.counsellorId),
  });
  if (!check.ok) throw new AdminValidationError(check.reason);

  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const isVerified = provenance === "COUNSELLOR_VERIFIED";

  const { error } = await supabase.from("student_profile_section_provenance").upsert(
    {
      student_user_id: studentUserId,
      section_key: sectionKey,
      provenance,
      verified_by_counsellor_id: isVerified ? admin.counsellorId : null,
      verified_at: isVerified ? nowIso : null,
      last_updated_by: admin.userId,
      note,
      updated_at: nowIso,
    },
    { onConflict: "student_user_id,section_key" }
  );
  if (error) {
    logDbError("setSectionProvenance", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Updated",
    entityType: "student_profile_section_provenance",
    entityId: studentUserId,
    entityLabel: `${sectionKey} section provenance`,
    fieldChangeSummaries: [`provenance: ${provenance}`],
    context: { actorRole: admin.role, sectionKey },
  });

  void trackEvent({
    eventName: isVerified ? "profile_field_counsellor_verified" : "profile_field_counsellor_updated",
    source: "admin_student_case_workspace",
    feature: "profile",
    entityType: "profile",
    entityId: studentUserId,
    properties: { sectionKey },
  });
}
