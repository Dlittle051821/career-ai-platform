import "server-only";
import { createClient } from "../server";
import { requireAdmin, requireAdminPermission } from "../admin-auth";
import { recordAuditLog } from "./audit";
import { AdminValidationError } from "@/lib/admin/form-state";
import { parseMoneyInput } from "@/lib/admin/money";
import { cleanFilterParam, clampPageSize, pageToRange, parsePageParam } from "@/lib/admin/pagination";
import type { AdminListResult, Course, CourseDataQualityStatus, DeliveryMode, TuitionPeriod } from "@/types/admin";

/** Mirrors src/lib/supabase/admin/universities.ts's conventions exactly. */

function logDbError(context: string, error: unknown) {
  console.error(`[admin/courses] ${context}:`, error);
}

function toCourse(
  row: {
    id: string;
    university_id: string;
    name: string;
    slug: string;
    education_level: string | null;
    field_of_study: string | null;
    duration_text: string | null;
    delivery_mode: string | null;
    campus_location: string | null;
    intake_info: string | null;
    tuition_amount_minor_units: number | null;
    tuition_currency: string;
    tuition_period: string | null;
    entry_requirements_summary: string | null;
    application_url: string | null;
    is_active: boolean;
    is_visible: boolean;
    data_quality_status: string;
    internal_notes: string | null;
    created_at: string;
    updated_at: string;
  },
  universityNameById: Map<string, string>
): Course {
  return {
    id: row.id,
    universityId: row.university_id,
    universityName: universityNameById.get(row.university_id) ?? "",
    name: row.name,
    slug: row.slug,
    educationLevel: row.education_level,
    fieldOfStudy: row.field_of_study,
    durationText: row.duration_text,
    deliveryMode: (row.delivery_mode as DeliveryMode | null) ?? null,
    campusLocation: row.campus_location,
    intakeInfo: row.intake_info,
    tuitionAmountMinorUnits: row.tuition_amount_minor_units,
    tuitionCurrency: row.tuition_currency,
    tuitionPeriod: (row.tuition_period as TuitionPeriod | null) ?? null,
    entryRequirementsSummary: row.entry_requirements_summary,
    applicationUrl: row.application_url,
    isActive: row.is_active,
    isVisible: row.is_visible,
    dataQualityStatus: row.data_quality_status as CourseDataQualityStatus,
    internalNotes: row.internal_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * No embedded relational select here (see the hand-written Database types
 * gotcha documented across src/types/database.ts — every table declares
 * `Relationships: []`, so `.select("*, universities(name)")` cannot be
 * typed and fails at the type level). Instead, courses are fetched plain
 * and university names are resolved via one follow-up query plus an
 * in-memory Map — the same avoid-N+1 pattern used throughout this project
 * (e.g. src/lib/supabase/admin/dashboard.ts's counsellor workload).
 */
async function buildUniversityNameMap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  universityIds: string[]
): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(universityIds));
  if (uniqueIds.length === 0) return new Map();
  const { data, error } = await supabase.from("universities").select("id, name").in("id", uniqueIds);
  if (error) {
    logDbError("buildUniversityNameMap", error);
    return new Map();
  }
  return new Map((data ?? []).map((u) => [u.id, u.name]));
}

export interface CourseFilters {
  query?: string;
  universityId?: string;
  isActive?: boolean;
  page?: number;
}

const PAGE_SIZE = 20;

/** Unfiltered, unpaginated id+name list — used by the Applications form's course picker. Gated on `requireAdmin()` (any real admin role), same reasoning as listUniversityOptions above. */
export async function listCourseOptions(): Promise<{ id: string; name: string }[]> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("courses").select("id, name").order("name", { ascending: true });
  if (error) {
    logDbError("listCourseOptions", error);
    return [];
  }
  return data ?? [];
}

export async function listCourses(filters: CourseFilters = {}): Promise<AdminListResult<Course>> {
  await requireAdminPermission("courses:read");
  const supabase = await createClient();
  const page = parsePageParam(String(filters.page ?? 1));
  const pageSize = clampPageSize(PAGE_SIZE);
  const { from, to } = pageToRange(page, pageSize);

  let query = supabase.from("courses").select("*", { count: "exact" }).order("name", { ascending: true });
  const cleanedQuery = cleanFilterParam(filters.query);
  if (cleanedQuery) {
    const term = cleanedQuery.replace(/[,()%]/g, "");
    query = query.or(`name.ilike.%${term}%,field_of_study.ilike.%${term}%`);
  }
  if (filters.universityId) {
    query = query.eq("university_id", filters.universityId);
  }
  if (filters.isActive !== undefined) {
    query = query.eq("is_active", filters.isActive);
  }

  const { data, error, count } = await query.range(from, to);
  if (error) {
    logDbError("listCourses", error);
    return { items: [], total: 0, page, pageSize };
  }
  const rows = data ?? [];
  const universityNameById = await buildUniversityNameMap(supabase, rows.map((r) => r.university_id));
  return { items: rows.map((row) => toCourse(row, universityNameById)), total: count ?? 0, page, pageSize };
}

export async function getCourseById(id: string): Promise<Course | null> {
  await requireAdminPermission("courses:read");
  const supabase = await createClient();
  const { data, error } = await supabase.from("courses").select("*").eq("id", id).maybeSingle();
  if (error) {
    logDbError("getCourseById", error);
    return null;
  }
  if (!data) return null;
  const universityNameById = await buildUniversityNameMap(supabase, [data.university_id]);
  return toCourse(data, universityNameById);
}

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DELIVERY_MODES: DeliveryMode[] = ["on_campus", "online", "hybrid"];
const TUITION_PERIODS: TuitionPeriod[] = ["per_year", "per_semester", "per_program", "per_credit"];
const DATA_QUALITY_STATUSES: CourseDataQualityStatus[] = ["draft", "reviewed", "approved"];

interface CourseInput {
  universityId: string;
  name: string;
  slug: string;
  educationLevel: string | null;
  fieldOfStudy: string | null;
  durationText: string | null;
  deliveryMode: DeliveryMode | null;
  campusLocation: string | null;
  intakeInfo: string | null;
  tuitionAmountMinorUnits: number | null;
  tuitionCurrency: string;
  tuitionPeriod: TuitionPeriod | null;
  entryRequirementsSummary: string | null;
  applicationUrl: string | null;
  isActive: boolean;
  isVisible: boolean;
  dataQualityStatus: CourseDataQualityStatus;
  internalNotes: string | null;
}

function parseCourseForm(formData: FormData): CourseInput {
  const universityId = String(formData.get("universityId") ?? "").trim();
  if (!universityId) throw new AdminValidationError("A university must be selected.");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new AdminValidationError("Name is required.");
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  if (!slug || !SLUG_PATTERN.test(slug)) {
    throw new AdminValidationError("Slug must be lowercase letters, numbers, and single hyphens only.");
  }
  const applicationUrl = String(formData.get("applicationUrl") ?? "").trim();
  if (applicationUrl && !/^https?:\/\//i.test(applicationUrl)) {
    throw new AdminValidationError("Application URL must start with http:// or https://.");
  }

  const deliveryModeRaw = String(formData.get("deliveryMode") ?? "").trim();
  const deliveryMode = DELIVERY_MODES.includes(deliveryModeRaw as DeliveryMode) ? (deliveryModeRaw as DeliveryMode) : null;
  const tuitionPeriodRaw = String(formData.get("tuitionPeriod") ?? "").trim();
  const tuitionPeriod = TUITION_PERIODS.includes(tuitionPeriodRaw as TuitionPeriod) ? (tuitionPeriodRaw as TuitionPeriod) : null;
  const dataQualityStatusRaw = String(formData.get("dataQualityStatus") ?? "draft").trim();
  const dataQualityStatus = DATA_QUALITY_STATUSES.includes(dataQualityStatusRaw as CourseDataQualityStatus)
    ? (dataQualityStatusRaw as CourseDataQualityStatus)
    : "draft";

  const tuitionCurrency = String(formData.get("tuitionCurrency") ?? "INR").trim().toUpperCase() || "INR";
  const tuitionRaw = String(formData.get("tuitionAmount") ?? "").trim();
  let tuitionAmountMinorUnits: number | null = null;
  if (tuitionRaw) {
    const parsed = parseMoneyInput(tuitionRaw, tuitionCurrency);
    if (parsed === null) throw new AdminValidationError("Tuition amount must be a valid non-negative number, e.g. 250000 or 250000.50.");
    tuitionAmountMinorUnits = parsed;
  }

  return {
    universityId,
    name,
    slug,
    educationLevel: String(formData.get("educationLevel") ?? "").trim() || null,
    fieldOfStudy: String(formData.get("fieldOfStudy") ?? "").trim() || null,
    durationText: String(formData.get("durationText") ?? "").trim() || null,
    deliveryMode,
    campusLocation: String(formData.get("campusLocation") ?? "").trim() || null,
    intakeInfo: String(formData.get("intakeInfo") ?? "").trim() || null,
    tuitionAmountMinorUnits,
    tuitionCurrency,
    tuitionPeriod,
    entryRequirementsSummary: String(formData.get("entryRequirementsSummary") ?? "").trim() || null,
    applicationUrl: applicationUrl || null,
    isActive: formData.get("isActive") === "on",
    isVisible: formData.get("isVisible") === "on",
    dataQualityStatus,
    internalNotes: String(formData.get("internalNotes") ?? "").trim() || null,
  };
}

export async function createCourse(formData: FormData): Promise<string> {
  await requireAdminPermission("courses:write");
  const input = parseCourseForm(formData);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("courses")
    .insert({
      university_id: input.universityId,
      name: input.name,
      slug: input.slug,
      education_level: input.educationLevel,
      field_of_study: input.fieldOfStudy,
      duration_text: input.durationText,
      delivery_mode: input.deliveryMode,
      campus_location: input.campusLocation,
      intake_info: input.intakeInfo,
      tuition_amount_minor_units: input.tuitionAmountMinorUnits,
      tuition_currency: input.tuitionCurrency,
      tuition_period: input.tuitionPeriod,
      entry_requirements_summary: input.entryRequirementsSummary,
      application_url: input.applicationUrl,
      is_active: input.isActive,
      is_visible: input.isVisible,
      data_quality_status: input.dataQualityStatus,
      internal_notes: input.internalNotes,
    })
    .select("id")
    .single();

  if (error) {
    logDbError("createCourse", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Created",
    entityType: "course",
    entityId: data.id,
    entityLabel: `course "${input.name}"`,
    after: { name: input.name, universityId: input.universityId, dataQualityStatus: input.dataQualityStatus, isActive: input.isActive },
  });

  return data.id;
}

export async function updateCourse(id: string, formData: FormData): Promise<void> {
  await requireAdminPermission("courses:write");
  const input = parseCourseForm(formData);
  const supabase = await createClient();

  const before = await getCourseById(id);

  const { error } = await supabase
    .from("courses")
    .update({
      university_id: input.universityId,
      name: input.name,
      slug: input.slug,
      education_level: input.educationLevel,
      field_of_study: input.fieldOfStudy,
      duration_text: input.durationText,
      delivery_mode: input.deliveryMode,
      campus_location: input.campusLocation,
      intake_info: input.intakeInfo,
      tuition_amount_minor_units: input.tuitionAmountMinorUnits,
      tuition_currency: input.tuitionCurrency,
      tuition_period: input.tuitionPeriod,
      entry_requirements_summary: input.entryRequirementsSummary,
      application_url: input.applicationUrl,
      is_active: input.isActive,
      is_visible: input.isVisible,
      data_quality_status: input.dataQualityStatus,
      internal_notes: input.internalNotes,
    })
    .eq("id", id);

  if (error) {
    logDbError("updateCourse", error);
    throw new Error(error.message);
  }

  const fieldChangeSummaries: string[] = [];
  if (before) {
    if (before.isActive !== input.isActive) fieldChangeSummaries.push(`isActive: ${before.isActive} -> ${input.isActive}`);
    if (before.dataQualityStatus !== input.dataQualityStatus) {
      fieldChangeSummaries.push(`dataQualityStatus: ${before.dataQualityStatus} -> ${input.dataQualityStatus}`);
    }
    if (before.name !== input.name) fieldChangeSummaries.push(`name: ${before.name} -> ${input.name}`);
  }

  await recordAuditLog({
    action: "Updated",
    entityType: "course",
    entityId: id,
    entityLabel: `course "${input.name}"`,
    fieldChangeSummaries,
    before: before ? { name: before.name, dataQualityStatus: before.dataQualityStatus, isActive: before.isActive } : undefined,
    after: { name: input.name, dataQualityStatus: input.dataQualityStatus, isActive: input.isActive },
  });
}
