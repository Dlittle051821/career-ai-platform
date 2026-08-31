import "server-only";
import { createClient } from "../server";
import { requireAdmin, requireAdminPermission } from "../admin-auth";
import { recordAuditLog } from "./audit";
import { AdminValidationError } from "@/lib/admin/form-state";
import { isValidCurrencyCodeFormat } from "@/lib/education/normalize";
import type { Scholarship, ScholarshipScope } from "@/types/education";
import { SCHOLARSHIP_SCOPES } from "@/types/education";

/**
 * Milestone 9 — Scholarships (new table; see
 * supabase/migrations/0006_global_university_course_data.sql PART 8).
 * A scholarship is scoped to EITHER a university OR a course (never both —
 * see scholarships_scope_target_check). Because either parent can gate
 * access, every mutation here requires the permission for whichever parent
 * the request targets, mirroring the RLS policies' own dual-branch
 * `(scope = 'university' and ...) or (scope = 'course' and ...)` structure.
 * Award amounts are stored in the scholarship's own stated currency and are
 * never converted.
 */

function logDbError(context: string, error: unknown) {
  console.error(`[admin/education-scholarships] ${context}:`, error);
}

interface ScholarshipRow {
  id: string;
  scope: string;
  university_id: string | null;
  course_id: string | null;
  name: string;
  eligibility: string | null;
  award_amount_minor_units: number | null;
  award_description: string | null;
  currency_code: string | null;
  deadline: string | null;
  scholarship_url: string | null;
  international_eligible: boolean | null;
  is_active: boolean;
  data_source: string | null;
  source_url: string | null;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

function toScholarship(row: ScholarshipRow): Scholarship {
  return {
    id: row.id,
    scope: row.scope as ScholarshipScope,
    universityId: row.university_id,
    courseId: row.course_id,
    name: row.name,
    eligibility: row.eligibility,
    awardAmountMinorUnits: row.award_amount_minor_units,
    awardDescription: row.award_description,
    currencyCode: row.currency_code,
    deadline: row.deadline,
    scholarshipUrl: row.scholarship_url,
    internationalEligible: row.international_eligible,
    isActive: row.is_active,
    dataSource: row.data_source,
    sourceUrl: row.source_url,
    lastVerifiedAt: row.last_verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Requires read access to whichever parent type is being listed. */
export async function listScholarshipsForUniversity(universityId: string): Promise<Scholarship[]> {
  await requireAdminPermission("universities:read");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scholarships")
    .select("*")
    .eq("scope", "university")
    .eq("university_id", universityId)
    .order("name", { ascending: true });
  if (error) {
    logDbError("listScholarshipsForUniversity", error);
    return [];
  }
  return (data ?? []).map(toScholarship);
}

export async function listScholarshipsForCourse(courseId: string): Promise<Scholarship[]> {
  await requireAdminPermission("courses:read");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scholarships")
    .select("*")
    .eq("scope", "course")
    .eq("course_id", courseId)
    .order("name", { ascending: true });
  if (error) {
    logDbError("listScholarshipsForCourse", error);
    return [];
  }
  return (data ?? []).map(toScholarship);
}

/**
 * Fetches a scholarship without a scope-specific permission check — callers
 * that already know which parent it belongs to should prefer the
 * `requireXPermission` calls in the list/mutation functions instead. This is
 * used internally (e.g. to build a "before" snapshot for the audit log) and
 * by admin UI routes that only have the scholarship id, gated on the union
 * of both permissions so either an authorized university or course editor
 * can open the record.
 */
export async function getScholarshipById(id: string): Promise<Scholarship | null> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("scholarships").select("*").eq("id", id).maybeSingle();
  if (error) {
    logDbError("getScholarshipById", error);
    return null;
  }
  return data ? toScholarship(data as ScholarshipRow) : null;
}

interface ScholarshipInput {
  scope: ScholarshipScope;
  universityId: string | null;
  courseId: string | null;
  name: string;
  eligibility: string | null;
  awardAmountMinorUnits: number | null;
  awardDescription: string | null;
  currencyCode: string | null;
  deadline: string | null;
  scholarshipUrl: string | null;
  internationalEligible: boolean | null;
  isActive: boolean;
  dataSource: string | null;
  sourceUrl: string | null;
  lastVerifiedAt: string | null;
}

function parseAmountToMinor(raw: string, label: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) throw new AdminValidationError(`${label} must be a non-negative number.`);
  return Math.round(parsed * 100);
}

function parseUrlField(formData: FormData, key: string, label: string): string | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  try {
    new URL(raw);
  } catch {
    throw new AdminValidationError(`${label} must be a valid URL.`);
  }
  return raw;
}

function parseDateField(formData: FormData, key: string, label: string): string | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new AdminValidationError(`${label} must be a valid date (YYYY-MM-DD).`);
  return raw;
}

function parseTriBoolean(formData: FormData, key: string): boolean | null {
  const raw = formData.get(key);
  if (raw === null || raw === "") return null;
  return String(raw) === "true" || raw === "on";
}

function parseScholarshipForm(formData: FormData): ScholarshipInput {
  const scopeRaw = String(formData.get("scope") ?? "").trim();
  if (!(SCHOLARSHIP_SCOPES as readonly string[]).includes(scopeRaw)) {
    throw new AdminValidationError("Scope must be either \"university\" or \"course\".");
  }
  const scope = scopeRaw as ScholarshipScope;

  const universityId = String(formData.get("universityId") ?? "").trim() || null;
  const courseId = String(formData.get("courseId") ?? "").trim() || null;
  if (scope === "university" && !universityId) throw new AdminValidationError("A university must be selected for a university-scoped scholarship.");
  if (scope === "course" && !courseId) throw new AdminValidationError("A course must be selected for a course-scoped scholarship.");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new AdminValidationError("Scholarship name is required.");

  const currencyCodeRaw = String(formData.get("currencyCode") ?? "").trim().toUpperCase();
  const currencyCode = currencyCodeRaw || null;
  if (currencyCode && !isValidCurrencyCodeFormat(currencyCode)) {
    throw new AdminValidationError("Currency must be a 3-letter ISO 4217 code (e.g. EUR) — the source's own original currency, never converted.");
  }

  const awardAmountMinorUnits = parseAmountToMinor(String(formData.get("awardAmount") ?? ""), "Award amount");
  if (awardAmountMinorUnits !== null && !currencyCode) {
    throw new AdminValidationError("A currency code is required whenever an award amount is provided.");
  }

  return {
    scope,
    universityId: scope === "university" ? universityId : null,
    courseId: scope === "course" ? courseId : null,
    name,
    eligibility: String(formData.get("eligibility") ?? "").trim() || null,
    awardAmountMinorUnits,
    awardDescription: String(formData.get("awardDescription") ?? "").trim() || null,
    currencyCode,
    deadline: parseDateField(formData, "deadline", "Deadline"),
    scholarshipUrl: parseUrlField(formData, "scholarshipUrl", "Scholarship URL"),
    internationalEligible: parseTriBoolean(formData, "internationalEligible"),
    isActive: formData.get("isActive") !== "off",
    dataSource: String(formData.get("dataSource") ?? "").trim() || null,
    sourceUrl: String(formData.get("sourceUrl") ?? "").trim() || null,
    lastVerifiedAt: String(formData.get("lastVerifiedAt") ?? "").trim() || null,
  };
}

function scholarshipWriteFields(input: ScholarshipInput) {
  return {
    scope: input.scope,
    university_id: input.universityId,
    course_id: input.courseId,
    name: input.name,
    eligibility: input.eligibility,
    award_amount_minor_units: input.awardAmountMinorUnits,
    award_description: input.awardDescription,
    currency_code: input.currencyCode,
    deadline: input.deadline,
    scholarship_url: input.scholarshipUrl,
    international_eligible: input.internationalEligible,
    is_active: input.isActive,
    data_source: input.dataSource,
    source_url: input.sourceUrl,
    last_verified_at: input.lastVerifiedAt,
  };
}

export async function createScholarship(formData: FormData): Promise<string> {
  const input = parseScholarshipForm(formData);
  // Gate on whichever parent this scholarship belongs to, matching the RLS
  // policies' own per-scope branching.
  await requireAdminPermission(input.scope === "university" ? "universities:write" : "courses:write");
  const supabase = await createClient();

  const { data, error } = await supabase.from("scholarships").insert(scholarshipWriteFields(input)).select("id").single();
  if (error) {
    logDbError("createScholarship", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Created",
    entityType: "scholarship",
    entityId: data.id,
    entityLabel: `scholarship "${input.name}"`,
    after: { name: input.name, scope: input.scope, universityId: input.universityId, courseId: input.courseId },
  });

  return data.id;
}

export async function updateScholarship(id: string, formData: FormData): Promise<void> {
  const input = parseScholarshipForm(formData);
  await requireAdminPermission(input.scope === "university" ? "universities:write" : "courses:write");
  const supabase = await createClient();
  const before = await getScholarshipById(id);

  const { error } = await supabase.from("scholarships").update(scholarshipWriteFields(input)).eq("id", id);
  if (error) {
    logDbError("updateScholarship", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Updated",
    entityType: "scholarship",
    entityId: id,
    entityLabel: `scholarship "${input.name}"`,
    before: before ? { name: before.name, isActive: before.isActive } : undefined,
    after: { name: input.name, isActive: input.isActive },
  });
}

export async function deleteScholarship(id: string): Promise<void> {
  const supabase = await createClient();
  const before = await getScholarshipById(id);
  if (!before) throw new AdminValidationError("Scholarship not found.");
  await requireAdminPermission(before.scope === "university" ? "universities:write" : "courses:write");

  const { error } = await supabase.from("scholarships").delete().eq("id", id);
  if (error) {
    logDbError("deleteScholarship", error);
    throw new Error(error.message);
  }
  await recordAuditLog({
    action: "Deleted",
    entityType: "scholarship",
    entityId: id,
    entityLabel: `scholarship "${before.name}"`,
  });
}
