import "server-only";
import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { recordAuditLog } from "./audit";
import { AdminValidationError } from "@/lib/admin/form-state";
import { clampPageSize, pageToRange, parsePageParam } from "@/lib/admin/pagination";
import {
  COURSE_DUPLICATE_SCORE_THRESHOLD,
  UNIVERSITY_DUPLICATE_SCORE_THRESHOLD,
  scoreCourseMatch,
  scoreUniversityMatch,
} from "@/lib/education/duplicates";
import type { AdminListResult } from "@/types/admin";
import type { Database } from "@/types/database";
import type { DuplicateCandidateStatus, DuplicateEntityType, DuplicateMatchSignal, EducationDuplicateCandidate } from "@/types/education";

type UniversitiesUpdate = Database["public"]["Tables"]["universities"]["Update"];
type CoursesUpdate = Database["public"]["Tables"]["courses"]["Update"];

/**
 * Milestone 9 — Duplicate detection and manual resolution (new table; see
 * supabase/migrations/0006_global_university_course_data.sql PART 12).
 *
 * Matching is deterministic (src/lib/education/duplicates.ts) and NEVER
 * auto-merges — `scanForDuplicates` only ever writes 'pending' suggestions,
 * and every status transition away from 'pending' requires an explicit
 * admin call (`rejectDuplicateCandidate` / `mergeDuplicateCandidates`)
 * that is itself audit-logged.
 *
 * A confirmed merge does not rewrite foreign keys anywhere else in the
 * schema (deliberately avoids a SECURITY DEFINER function to do that): it
 * sets the losing record's `merged_into_id` pointer and `is_active =
 * false`, and — for the fields the admin explicitly chose to keep from the
 * losing record — copies just those column values onto the surviving
 * record. Every other table that references the losing id (applications,
 * saved items, etc.) is left as-is; readers that care about merges should
 * follow `merged_into_id`.
 *
 * Note on scale: `scanForDuplicates` does a full pairwise comparison of all
 * active, unmerged records of the given type. This is appropriate for the
 * clearly-labelled starter dataset's size; a production-scale catalog would
 * need a blocking/indexing pass (e.g. compare only within the same country)
 * before pairwise scoring — see docs/global-education-data-guide.md.
 */

function logDbError(context: string, error: unknown) {
  console.error(`[admin/education-duplicates] ${context}:`, error);
}

interface DuplicateCandidateRow {
  id: string;
  entity_type: string;
  primary_entity_id: string;
  candidate_entity_id: string;
  match_score: number;
  match_signals: unknown;
  status: string;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
}

async function buildEntityNameMap(supabase: Awaited<ReturnType<typeof createClient>>, entityType: DuplicateEntityType, ids: string[]): Promise<Map<string, string>> {
  const nameById = new Map<string, string>();
  if (ids.length === 0) return nameById;
  const table = entityType === "university" ? "universities" : "courses";
  const { data } = await supabase.from(table).select("id, name").in("id", ids);
  for (const row of data ?? []) nameById.set(row.id, row.name);
  return nameById;
}

function toDuplicateCandidate(row: DuplicateCandidateRow, nameById: Map<string, string>): EducationDuplicateCandidate {
  return {
    id: row.id,
    entityType: row.entity_type as DuplicateEntityType,
    primaryEntityId: row.primary_entity_id,
    primaryEntityName: nameById.get(row.primary_entity_id) ?? null,
    candidateEntityId: row.candidate_entity_id,
    candidateEntityName: nameById.get(row.candidate_entity_id) ?? null,
    matchScore: row.match_score,
    matchSignals: Array.isArray(row.match_signals) ? (row.match_signals as unknown as DuplicateMatchSignal[]) : [],
    status: row.status as DuplicateCandidateStatus,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
    resolutionNotes: row.resolution_notes,
    createdAt: row.created_at,
  };
}

export interface DuplicateCandidateFilters {
  entityType?: DuplicateEntityType;
  status?: DuplicateCandidateStatus;
  page?: number;
  pageSize?: number;
}

export async function listDuplicateCandidates(filters: DuplicateCandidateFilters = {}): Promise<AdminListResult<EducationDuplicateCandidate>> {
  await requireAdminPermission("education-duplicates:read");
  const supabase = await createClient();
  const page = parsePageParam(filters.page ? String(filters.page) : undefined);
  const pageSize = clampPageSize(filters.pageSize);
  const { from, to } = pageToRange(page, pageSize);

  let query = supabase.from("education_duplicate_candidates").select("*", { count: "exact" }).order("match_score", { ascending: false }).order("created_at", { ascending: false }).range(from, to);
  if (filters.entityType) query = query.eq("entity_type", filters.entityType);
  query = query.eq("status", filters.status ?? "pending");
  // Note: callers that want every status regardless of resolution should
  // page through each status explicitly — the default here intentionally
  // matches the review queue's natural default (pending) rather than
  // silently mixing resolved rows into a single ranked list.

  const { data, error, count } = await query;
  if (error) {
    logDbError("listDuplicateCandidates", error);
    return { items: [], total: 0, page, pageSize };
  }

  const rows = (data ?? []) as unknown as DuplicateCandidateRow[];
  const universityIds = rows.filter((r) => r.entity_type === "university").flatMap((r) => [r.primary_entity_id, r.candidate_entity_id]);
  const courseIds = rows.filter((r) => r.entity_type === "course").flatMap((r) => [r.primary_entity_id, r.candidate_entity_id]);
  const [universityNames, courseNames] = await Promise.all([
    buildEntityNameMap(supabase, "university", Array.from(new Set(universityIds))),
    buildEntityNameMap(supabase, "course", Array.from(new Set(courseIds))),
  ]);
  const nameById = new Map<string, string>([...universityNames, ...courseNames]);

  return { items: rows.map((r) => toDuplicateCandidate(r, nameById)), total: count ?? 0, page, pageSize };
}

export async function getDuplicateCandidateById(id: string): Promise<EducationDuplicateCandidate | null> {
  await requireAdminPermission("education-duplicates:read");
  const supabase = await createClient();
  const { data, error } = await supabase.from("education_duplicate_candidates").select("*").eq("id", id).maybeSingle();
  if (error) {
    logDbError("getDuplicateCandidateById", error);
    return null;
  }
  if (!data) return null;
  const row = data as unknown as DuplicateCandidateRow;
  const nameById = await buildEntityNameMap(supabase, row.entity_type as DuplicateEntityType, [row.primary_entity_id, row.candidate_entity_id]);
  return toDuplicateCandidate(row, nameById);
}

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------

interface ScannableUniversity {
  id: string;
  name: string | null;
  city: string | null;
  website: string | null;
  country_id: string | null;
}

interface ScannableCourse {
  id: string;
  name: string | null;
  university_id: string;
  education_level: string | null;
  campus_id: string | null;
  program_code: string | null;
  delivery_mode: string | null;
}

function canonicalPairOrder(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/** Scans all active, unmerged universities (or courses) pairwise and writes any new pending candidates scoring at/above the threshold. Existing candidate rows for a pair (of ANY status — pending, rejected, merged) are left untouched so an admin's prior decision is never silently re-surfaced. Returns how many new candidates were created. */
export async function scanForDuplicates(entityType: DuplicateEntityType): Promise<number> {
  const admin = await requireAdminPermission("education-duplicates:write");
  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("education_duplicate_candidates")
    .select("primary_entity_id, candidate_entity_id")
    .eq("entity_type", entityType);
  if (existingError) {
    logDbError("scanForDuplicates:existing", existingError);
    throw new Error(existingError.message);
  }
  const alreadyKnownPairs = new Set((existing ?? []).map((r) => `${r.primary_entity_id}:${r.candidate_entity_id}`));

  const newCandidates: { primary_entity_id: string; candidate_entity_id: string; match_score: number; match_signals: DuplicateMatchSignal[] }[] = [];

  if (entityType === "university") {
    const { data, error } = await supabase
      .from("universities")
      .select("id, name, city, website, country_id")
      .eq("is_active", true)
      .is("merged_into_id", null);
    if (error) {
      logDbError("scanForDuplicates:universities", error);
      throw new Error(error.message);
    }
    const rows = (data ?? []) as ScannableUniversity[];
    const countryIds = Array.from(new Set(rows.map((r) => r.country_id).filter((id): id is string => !!id)));
    const isoByCountryId = new Map<string, string>();
    if (countryIds.length > 0) {
      const { data: countries } = await supabase.from("countries").select("id, iso_alpha2").in("id", countryIds);
      for (const c of countries ?? []) isoByCountryId.set(c.id, c.iso_alpha2);
    }
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        const a = rows[i];
        const b = rows[j];
        const result = scoreUniversityMatch(
          { name: a.name, countryCode: a.country_id ? (isoByCountryId.get(a.country_id) ?? null) : null, city: a.city, websiteUrl: a.website, sourceRecordId: null },
          { name: b.name, countryCode: b.country_id ? (isoByCountryId.get(b.country_id) ?? null) : null, city: b.city, websiteUrl: b.website, sourceRecordId: null },
        );
        if (result.score < UNIVERSITY_DUPLICATE_SCORE_THRESHOLD) continue;
        const [primaryId, candidateId] = canonicalPairOrder(a.id, b.id);
        const key = `${primaryId}:${candidateId}`;
        if (alreadyKnownPairs.has(key)) continue;
        alreadyKnownPairs.add(key);
        newCandidates.push({ primary_entity_id: primaryId, candidate_entity_id: candidateId, match_score: result.score, match_signals: result.signals });
      }
    }
  } else {
    const { data, error } = await supabase
      .from("courses")
      .select("id, name, university_id, education_level, campus_id, program_code, delivery_mode")
      .eq("is_active", true)
      .is("merged_into_id", null);
    if (error) {
      logDbError("scanForDuplicates:courses", error);
      throw new Error(error.message);
    }
    const rows = (data ?? []) as ScannableCourse[];
    // Courses are only ever compared within the same university (see
    // COURSE_DUPLICATE_REQUIRES_SAME_UNIVERSITY) — group first so we never
    // pay the O(n^2) cost across the whole catalog.
    const byUniversity = new Map<string, ScannableCourse[]>();
    for (const row of rows) {
      const bucket = byUniversity.get(row.university_id) ?? [];
      bucket.push(row);
      byUniversity.set(row.university_id, bucket);
    }
    for (const bucket of byUniversity.values()) {
      for (let i = 0; i < bucket.length; i++) {
        for (let j = i + 1; j < bucket.length; j++) {
          const a = bucket[i];
          const b = bucket[j];
          const result = scoreCourseMatch(
            { universityId: a.university_id, name: a.name, qualificationLevel: a.education_level, campusId: a.campus_id, programCode: a.program_code, studyMode: a.delivery_mode },
            { universityId: b.university_id, name: b.name, qualificationLevel: b.education_level, campusId: b.campus_id, programCode: b.program_code, studyMode: b.delivery_mode },
          );
          if (result.score < COURSE_DUPLICATE_SCORE_THRESHOLD) continue;
          const [primaryId, candidateId] = canonicalPairOrder(a.id, b.id);
          const key = `${primaryId}:${candidateId}`;
          if (alreadyKnownPairs.has(key)) continue;
          alreadyKnownPairs.add(key);
          newCandidates.push({ primary_entity_id: primaryId, candidate_entity_id: candidateId, match_score: result.score, match_signals: result.signals });
        }
      }
    }
  }

  if (newCandidates.length === 0) return 0;

  type DuplicateCandidateInsert = Database["public"]["Tables"]["education_duplicate_candidates"]["Insert"];
  const { error: insertError } = await supabase.from("education_duplicate_candidates").insert(
    newCandidates.map(
      (c) =>
        ({
          entity_type: entityType,
          status: "pending",
          resolved_by: null,
          resolved_at: null,
          resolution_notes: null,
          ...c,
        }) as unknown as DuplicateCandidateInsert,
    ),
  );
  if (insertError) {
    logDbError("scanForDuplicates:insert", insertError);
    throw new Error(insertError.message);
  }

  await recordAuditLog({
    action: "Scanned",
    entityType: "education_duplicate_candidate",
    entityId: null,
    entityLabel: `${entityType} duplicate scan (initiated by ${admin.userId})`,
    after: { entityType, newCandidatesFound: newCandidates.length },
  });

  return newCandidates.length;
}

// ---------------------------------------------------------------------------
// Resolution: reject or merge
// ---------------------------------------------------------------------------

export async function rejectDuplicateCandidate(id: string, notes: string | null): Promise<void> {
  const admin = await requireAdminPermission("education-duplicates:write");
  const supabase = await createClient();
  const before = await getDuplicateCandidateById(id);
  if (!before) throw new AdminValidationError("Duplicate candidate not found.");
  if (before.status !== "pending") throw new AdminValidationError("This duplicate candidate has already been resolved.");

  const { error } = await supabase
    .from("education_duplicate_candidates")
    .update({ status: "rejected", resolved_by: admin.userId, resolved_at: new Date().toISOString(), resolution_notes: notes })
    .eq("id", id);
  if (error) {
    logDbError("rejectDuplicateCandidate", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Rejected",
    entityType: "education_duplicate_candidate",
    entityId: id,
    entityLabel: `duplicate candidate (${before.entityType}: "${before.primaryEntityName ?? before.primaryEntityId}" vs "${before.candidateEntityName ?? before.candidateEntityId}")`,
    after: { status: "rejected", notes },
  });
}

const UNIVERSITY_MERGE_PRESERVABLE_FIELDS = [
  "name", "city", "country_id", "website", "summary", "institution_type",
  "admissions_url", "international_admissions_url", "ownership_type", "founding_year",
  "accreditation_organization", "study_levels", "study_modes", "campus_info", "logo_url",
  "international_student_support", "scholarships_available", "application_fee_minor_units",
  "application_fee_currency", "data_source", "source_url", "source_access_date", "last_verified_at",
] as const;

const COURSE_MERGE_PRESERVABLE_FIELDS = [
  "name", "field_of_study", "education_level", "delivery_mode", "campus_id", "program_code",
  "subject_area", "discipline", "qualification_title", "award", "duration_value", "duration_unit",
  "study_pace", "teaching_language", "course_url", "intake_periods", "min_academic_requirement",
  "work_experience_required", "portfolio_required", "interview_required",
  "additional_documents_required", "scholarships_available", "career_outcomes",
  "professional_accreditation", "data_source", "source_url", "last_verified_at",
] as const;

/**
 * Merges a pending duplicate candidate: `survivorEntityId` must be either
 * the candidate row's primary or candidate entity id (the other one becomes
 * the "loser"). `preserveFieldsFromLoser` is an allowlisted subset of
 * columns whose VALUE ON THE LOSER should be copied onto the survivor
 * before the loser is deactivated — every field not listed keeps the
 * survivor's own existing value. The loser is never deleted: it is marked
 * `is_active = false` with `merged_into_id` pointing at the survivor.
 */
export async function mergeDuplicateCandidates(id: string, survivorEntityId: string, preserveFieldsFromLoser: string[], notes: string | null): Promise<void> {
  const admin = await requireAdminPermission("education-duplicates:write");
  const supabase = await createClient();
  const before = await getDuplicateCandidateById(id);
  if (!before) throw new AdminValidationError("Duplicate candidate not found.");
  if (before.status !== "pending") throw new AdminValidationError("This duplicate candidate has already been resolved.");
  if (survivorEntityId !== before.primaryEntityId && survivorEntityId !== before.candidateEntityId) {
    throw new AdminValidationError("The chosen survivor must be one of the two records being compared.");
  }
  const loserEntityId = survivorEntityId === before.primaryEntityId ? before.candidateEntityId : before.primaryEntityId;

  const allowlist: readonly string[] = before.entityType === "university" ? UNIVERSITY_MERGE_PRESERVABLE_FIELDS : COURSE_MERGE_PRESERVABLE_FIELDS;
  const fields = preserveFieldsFromLoser.filter((f) => allowlist.includes(f));
  const invalid = preserveFieldsFromLoser.filter((f) => !allowlist.includes(f));
  if (invalid.length > 0) throw new AdminValidationError(`These fields cannot be preserved through a merge: ${invalid.join(", ")}.`);

  // Branched (rather than a single dynamic `.from(table)`) so each call
  // site keeps a literal table name — the hand-written Supabase types in
  // src/types/database.ts don't support a union table-name variable the
  // way the officially generated client types would.
  if (before.entityType === "university") {
    let patch: Partial<UniversitiesUpdate> = {};
    if (fields.length > 0) {
      const { data: loserRow, error: loserError } = await supabase.from("universities").select(fields.join(", ")).eq("id", loserEntityId).maybeSingle();
      if (loserError || !loserRow) {
        logDbError("mergeDuplicateCandidates:loser", loserError);
        throw new Error(loserError?.message ?? "Could not load the record being merged away.");
      }
      patch = loserRow as unknown as Partial<UniversitiesUpdate>;
    }
    if (Object.keys(patch).length > 0) {
      const { error: survivorError } = await supabase.from("universities").update(patch).eq("id", survivorEntityId);
      if (survivorError) {
        logDbError("mergeDuplicateCandidates:survivor", survivorError);
        throw new Error(survivorError.message);
      }
    }
    const { error: loserUpdateError } = await supabase.from("universities").update({ is_active: false, merged_into_id: survivorEntityId }).eq("id", loserEntityId);
    if (loserUpdateError) {
      logDbError("mergeDuplicateCandidates:deactivate-loser", loserUpdateError);
      throw new Error(loserUpdateError.message);
    }
  } else {
    let patch: Partial<CoursesUpdate> = {};
    if (fields.length > 0) {
      const { data: loserRow, error: loserError } = await supabase.from("courses").select(fields.join(", ")).eq("id", loserEntityId).maybeSingle();
      if (loserError || !loserRow) {
        logDbError("mergeDuplicateCandidates:loser", loserError);
        throw new Error(loserError?.message ?? "Could not load the record being merged away.");
      }
      patch = loserRow as unknown as Partial<CoursesUpdate>;
    }
    if (Object.keys(patch).length > 0) {
      const { error: survivorError } = await supabase.from("courses").update(patch).eq("id", survivorEntityId);
      if (survivorError) {
        logDbError("mergeDuplicateCandidates:survivor", survivorError);
        throw new Error(survivorError.message);
      }
    }
    const { error: loserUpdateError } = await supabase.from("courses").update({ is_active: false, merged_into_id: survivorEntityId }).eq("id", loserEntityId);
    if (loserUpdateError) {
      logDbError("mergeDuplicateCandidates:deactivate-loser", loserUpdateError);
      throw new Error(loserUpdateError.message);
    }
  }

  const { error: candidateError } = await supabase
    .from("education_duplicate_candidates")
    .update({ status: "merged", resolved_by: admin.userId, resolved_at: new Date().toISOString(), resolution_notes: notes })
    .eq("id", id);
  if (candidateError) {
    logDbError("mergeDuplicateCandidates:candidate", candidateError);
    throw new Error(candidateError.message);
  }

  await recordAuditLog({
    action: "Merged",
    entityType: "education_duplicate_candidate",
    entityId: id,
    entityLabel: `duplicate candidate (${before.entityType}: "${before.primaryEntityName ?? before.primaryEntityId}" vs "${before.candidateEntityName ?? before.candidateEntityId}")`,
    after: { survivorEntityId, loserEntityId, preservedFields: fields, notes },
  });
}
