import "server-only";
import { createClient } from "../server";
import { requireAdmin, requireAdminPermission } from "../admin-auth";
import { recordAuditLog } from "./audit";
import { AdminValidationError } from "@/lib/admin/form-state";
import { parseMoneyInput } from "@/lib/admin/money";
import { cleanFilterParam, clampPageSize, pageToRange, parsePageParam } from "@/lib/admin/pagination";
import { isValidCurrencyCodeFormat } from "@/lib/education/normalize";
import type { AdminListResult, CourseDataQualityStatus, DeliveryMode, TuitionPeriod } from "@/types/admin";
import type {
  Course,
  CourseDurationUnit,
  CourseStudyPace,
  CourseTuitionCategory,
  EducationPublicationStatus,
  EducationVerificationStatus,
  EnglishRequirements,
  StandardizedTestRequirements,
} from "@/types/education";
import { CONTENT_EDITOR_WRITABLE_STATUSES, EDUCATION_PUBLICATION_STATUSES, EDUCATION_VERIFICATION_STATUSES } from "@/types/education";

/**
 * Milestone 7's Course module, EXTENDED for Milestone 9 (never duplicated —
 * same `public.courses` table; see
 * supabase/migrations/0006_global_university_course_data.sql PART 4 for the
 * new columns). Mirrors src/lib/supabase/admin/universities.ts's
 * conventions exactly, including the same publication-workflow shape.
 */

function logDbError(context: string, error: unknown) {
  console.error(`[admin/courses] ${context}:`, error);
}

interface CourseRow {
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
  campus_id: string | null;
  program_code: string | null;
  subject_area: string | null;
  discipline: string | null;
  qualification_title: string | null;
  award: string | null;
  duration_value: number | null;
  duration_unit: string | null;
  study_pace: string | null;
  teaching_language: string | null;
  tuition_domestic_or_international: string | null;
  additional_fees_summary: string | null;
  application_fee_minor_units: number | null;
  application_fee_currency: string | null;
  course_url: string | null;
  intake_periods: string[] | null;
  min_academic_requirement: string | null;
  english_requirements: unknown;
  standardized_test_requirements: unknown;
  work_experience_required: string | null;
  portfolio_required: boolean | null;
  interview_required: boolean | null;
  study_gap_policy: string | null;
  additional_documents_required: string[] | null;
  scholarships_available: boolean | null;
  career_outcomes: string | null;
  professional_accreditation: string | null;
  publication_status: string;
  data_source: string | null;
  source_url: string | null;
  last_verified_at: string | null;
  verification_status: string;
  merged_into_id: string | null;
}

function toCourse(row: CourseRow, universityNameById: Map<string, string>, campusNameById: Map<string, string>): Course {
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
    campusId: row.campus_id,
    campusName: row.campus_id ? (campusNameById.get(row.campus_id) ?? null) : null,
    programCode: row.program_code,
    subjectArea: row.subject_area,
    discipline: row.discipline,
    qualificationTitle: row.qualification_title,
    award: row.award,
    durationValue: row.duration_value,
    durationUnit: (row.duration_unit as CourseDurationUnit | null) ?? null,
    studyPace: (row.study_pace as CourseStudyPace | null) ?? null,
    teachingLanguage: row.teaching_language,
    tuitionDomesticOrInternational: (row.tuition_domestic_or_international as CourseTuitionCategory | null) ?? null,
    additionalFeesSummary: row.additional_fees_summary,
    applicationFeeMinorUnits: row.application_fee_minor_units,
    applicationFeeCurrency: row.application_fee_currency,
    courseUrl: row.course_url,
    intakePeriods: row.intake_periods ?? [],
    minAcademicRequirement: row.min_academic_requirement,
    englishRequirements: (row.english_requirements as EnglishRequirements | null) ?? null,
    standardizedTestRequirements: (row.standardized_test_requirements as StandardizedTestRequirements | null) ?? null,
    workExperienceRequired: row.work_experience_required,
    portfolioRequired: row.portfolio_required,
    interviewRequired: row.interview_required,
    studyGapPolicy: row.study_gap_policy,
    additionalDocumentsRequired: row.additional_documents_required ?? [],
    scholarshipsAvailable: row.scholarships_available,
    careerOutcomes: row.career_outcomes,
    professionalAccreditation: row.professional_accreditation,
    publicationStatus: row.publication_status as EducationPublicationStatus,
    dataSource: row.data_source,
    sourceUrl: row.source_url,
    lastVerifiedAt: row.last_verified_at,
    verificationStatus: row.verification_status as EducationVerificationStatus,
    mergedIntoId: row.merged_into_id,
  };
}

/**
 * No embedded relational select (see the hand-written Database types gotcha
 * documented across src/types/database.ts — every table declares
 * `Relationships: []`). University/campus names are resolved via follow-up
 * queries plus in-memory Maps, same avoid-N+1 pattern used throughout.
 */
async function buildUniversityNameMap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  universityIds: string[],
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

async function buildCampusNameMap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  campusIds: (string | null)[],
): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(campusIds.filter((id): id is string => !!id)));
  if (uniqueIds.length === 0) return new Map();
  const { data, error } = await supabase.from("campuses").select("id, name").in("id", uniqueIds);
  if (error) {
    logDbError("buildCampusNameMap", error);
    return new Map();
  }
  return new Map((data ?? []).map((c) => [c.id, c.name]));
}

export interface CourseFilters {
  query?: string;
  universityId?: string;
  isActive?: boolean;
  publicationStatus?: EducationPublicationStatus;
  verificationStatus?: EducationVerificationStatus;
  subjectArea?: string;
  page?: number;
}

const PAGE_SIZE = 20;

/** Unfiltered, unpaginated id+name list — used by the Applications form's course picker. Gated on `requireAdmin()` (any real admin role), same reasoning as listUniversityOptions. */
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
    query = query.or(`name.ilike.%${term}%,field_of_study.ilike.%${term}%,subject_area.ilike.%${term}%`);
  }
  if (filters.universityId) query = query.eq("university_id", filters.universityId);
  if (filters.isActive !== undefined) query = query.eq("is_active", filters.isActive);
  if (filters.publicationStatus) query = query.eq("publication_status", filters.publicationStatus);
  if (filters.verificationStatus) query = query.eq("verification_status", filters.verificationStatus);
  if (filters.subjectArea) query = query.eq("subject_area", filters.subjectArea);

  const { data, error, count } = await query.range(from, to);
  if (error) {
    logDbError("listCourses", error);
    return { items: [], total: 0, page, pageSize };
  }
  const rows = (data ?? []) as CourseRow[];
  const universityNameById = await buildUniversityNameMap(supabase, rows.map((r) => r.university_id));
  const campusNameById = await buildCampusNameMap(supabase, rows.map((r) => r.campus_id));
  return {
    items: rows.map((row) => toCourse(row, universityNameById, campusNameById)),
    total: count ?? 0,
    page,
    pageSize,
  };
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
  const row = data as CourseRow;
  const universityNameById = await buildUniversityNameMap(supabase, [row.university_id]);
  const campusNameById = await buildCampusNameMap(supabase, [row.campus_id]);
  return toCourse(row, universityNameById, campusNameById);
}

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DELIVERY_MODES: DeliveryMode[] = ["on_campus", "online", "hybrid"];
const TUITION_PERIODS: TuitionPeriod[] = ["per_year", "per_semester", "per_program", "per_credit"];
const DATA_QUALITY_STATUSES: CourseDataQualityStatus[] = ["draft", "reviewed", "approved"];
const DURATION_UNITS: CourseDurationUnit[] = ["years", "months", "weeks"];
const STUDY_PACES: CourseStudyPace[] = ["full_time", "part_time", "full_time_or_part_time"];
const TUITION_CATEGORIES: CourseTuitionCategory[] = ["domestic", "international", "not_distinguished"];

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
  campusId: string | null;
  programCode: string | null;
  subjectArea: string | null;
  discipline: string | null;
  qualificationTitle: string | null;
  award: string | null;
  durationValue: number | null;
  durationUnit: CourseDurationUnit | null;
  studyPace: CourseStudyPace | null;
  teachingLanguage: string | null;
  tuitionDomesticOrInternational: CourseTuitionCategory | null;
  additionalFeesSummary: string | null;
  applicationFeeMinorUnits: number | null;
  applicationFeeCurrency: string | null;
  courseUrl: string | null;
  intakePeriods: string[];
  minAcademicRequirement: string | null;
  workExperienceRequired: string | null;
  portfolioRequired: boolean | null;
  interviewRequired: boolean | null;
  studyGapPolicy: string | null;
  additionalDocumentsRequired: string[];
  scholarshipsAvailable: boolean | null;
  careerOutcomes: string | null;
  professionalAccreditation: string | null;
  dataSource: string | null;
  sourceUrl: string | null;
  lastVerifiedAt: string | null;
  verificationStatus: EducationVerificationStatus;
}

function parseListField(formData: FormData, key: string): string[] {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return [];
  return raw.split(/[,;]/).map((v) => v.trim()).filter(Boolean);
}

function parseUrlField(formData: FormData, key: string, label: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) throw new AdminValidationError(`${label} must start with http:// or https://.`);
  return value;
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

  const applicationUrl = parseUrlField(formData, "applicationUrl", "Application URL");
  const courseUrl = parseUrlField(formData, "courseUrl", "Course URL");
  const sourceUrl = parseUrlField(formData, "sourceUrl", "Source URL");

  const deliveryModeRaw = String(formData.get("deliveryMode") ?? "").trim();
  const deliveryMode = DELIVERY_MODES.includes(deliveryModeRaw as DeliveryMode) ? (deliveryModeRaw as DeliveryMode) : null;
  const tuitionPeriodRaw = String(formData.get("tuitionPeriod") ?? "").trim();
  const tuitionPeriod = TUITION_PERIODS.includes(tuitionPeriodRaw as TuitionPeriod) ? (tuitionPeriodRaw as TuitionPeriod) : null;
  const dataQualityStatusRaw = String(formData.get("dataQualityStatus") ?? "draft").trim();
  const dataQualityStatus = DATA_QUALITY_STATUSES.includes(dataQualityStatusRaw as CourseDataQualityStatus)
    ? (dataQualityStatusRaw as CourseDataQualityStatus)
    : "draft";
  const durationUnitRaw = String(formData.get("durationUnit") ?? "").trim();
  const durationUnit = DURATION_UNITS.includes(durationUnitRaw as CourseDurationUnit) ? (durationUnitRaw as CourseDurationUnit) : null;
  const studyPaceRaw = String(formData.get("studyPace") ?? "").trim();
  const studyPace = STUDY_PACES.includes(studyPaceRaw as CourseStudyPace) ? (studyPaceRaw as CourseStudyPace) : null;
  const tuitionCategoryRaw = String(formData.get("tuitionDomesticOrInternational") ?? "").trim();
  const tuitionDomesticOrInternational = TUITION_CATEGORIES.includes(tuitionCategoryRaw as CourseTuitionCategory)
    ? (tuitionCategoryRaw as CourseTuitionCategory)
    : null;

  const tuitionCurrency = String(formData.get("tuitionCurrency") ?? "INR").trim().toUpperCase() || "INR";
  const tuitionRaw = String(formData.get("tuitionAmount") ?? "").trim();
  let tuitionAmountMinorUnits: number | null = null;
  if (tuitionRaw) {
    const parsed = parseMoneyInput(tuitionRaw, tuitionCurrency);
    if (parsed === null) throw new AdminValidationError("Tuition amount must be a valid non-negative number, e.g. 250000 or 250000.50.");
    tuitionAmountMinorUnits = parsed;
  }

  const applicationFeeCurrency = String(formData.get("applicationFeeCurrency") ?? "").trim().toUpperCase() || null;
  if (applicationFeeCurrency && !isValidCurrencyCodeFormat(applicationFeeCurrency)) {
    throw new AdminValidationError("Application fee currency must be a 3-letter ISO 4217 code.");
  }
  const applicationFeeRaw = String(formData.get("applicationFeeAmount") ?? "").trim();
  let applicationFeeMinorUnits: number | null = null;
  if (applicationFeeRaw) {
    const parsed = Number.parseFloat(applicationFeeRaw);
    if (!Number.isFinite(parsed) || parsed < 0) throw new AdminValidationError("Application fee must be a non-negative number.");
    applicationFeeMinorUnits = Math.round(parsed * 100);
  }

  const durationValueRaw = String(formData.get("durationValue") ?? "").trim();
  let durationValue: number | null = null;
  if (durationValueRaw) {
    const parsed = Number.parseFloat(durationValueRaw);
    if (!Number.isFinite(parsed) || parsed <= 0) throw new AdminValidationError("Duration must be a positive number.");
    durationValue = parsed;
  }

  const verificationStatusRaw = String(formData.get("verificationStatus") ?? "unverified").trim();
  const verificationStatus = (EDUCATION_VERIFICATION_STATUSES as readonly string[]).includes(verificationStatusRaw)
    ? (verificationStatusRaw as EducationVerificationStatus)
    : "unverified";

  const boolOrNull = (key: string): boolean | null => {
    const raw = formData.get(key);
    return raw === null ? null : raw === "on" || raw === "true";
  };

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
    applicationUrl,
    isActive: formData.get("isActive") === "on",
    isVisible: formData.get("isVisible") === "on",
    dataQualityStatus,
    internalNotes: String(formData.get("internalNotes") ?? "").trim() || null,
    campusId: String(formData.get("campusId") ?? "").trim() || null,
    programCode: String(formData.get("programCode") ?? "").trim() || null,
    subjectArea: String(formData.get("subjectArea") ?? "").trim() || null,
    discipline: String(formData.get("discipline") ?? "").trim() || null,
    qualificationTitle: String(formData.get("qualificationTitle") ?? "").trim() || null,
    award: String(formData.get("award") ?? "").trim() || null,
    durationValue,
    durationUnit,
    studyPace,
    teachingLanguage: String(formData.get("teachingLanguage") ?? "").trim() || null,
    tuitionDomesticOrInternational,
    additionalFeesSummary: String(formData.get("additionalFeesSummary") ?? "").trim() || null,
    applicationFeeMinorUnits,
    applicationFeeCurrency,
    courseUrl,
    intakePeriods: parseListField(formData, "intakePeriods"),
    minAcademicRequirement: String(formData.get("minAcademicRequirement") ?? "").trim() || null,
    workExperienceRequired: String(formData.get("workExperienceRequired") ?? "").trim() || null,
    portfolioRequired: boolOrNull("portfolioRequired"),
    interviewRequired: boolOrNull("interviewRequired"),
    studyGapPolicy: String(formData.get("studyGapPolicy") ?? "").trim() || null,
    additionalDocumentsRequired: parseListField(formData, "additionalDocumentsRequired"),
    scholarshipsAvailable: boolOrNull("scholarshipsAvailable"),
    careerOutcomes: String(formData.get("careerOutcomes") ?? "").trim() || null,
    professionalAccreditation: String(formData.get("professionalAccreditation") ?? "").trim() || null,
    dataSource: String(formData.get("dataSource") ?? "").trim() || null,
    sourceUrl,
    lastVerifiedAt: String(formData.get("lastVerifiedAt") ?? "").trim() || null,
    verificationStatus,
  };
}

/** Every field written on create/update EXCEPT publication_status — a controlled transition, see the workflow functions below (mirrors src/lib/supabase/admin/universities.ts). English/standardized-test requirements are deliberately not settable through this plain form (they are structured JSON with their own shape checks — see the not-yet-built dedicated editor; CSV import is the primary path that populates them for now). */
function courseWriteFields(input: CourseInput) {
  return {
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
    campus_id: input.campusId,
    program_code: input.programCode,
    subject_area: input.subjectArea,
    discipline: input.discipline,
    qualification_title: input.qualificationTitle,
    award: input.award,
    duration_value: input.durationValue,
    duration_unit: input.durationUnit,
    study_pace: input.studyPace,
    teaching_language: input.teachingLanguage,
    tuition_domestic_or_international: input.tuitionDomesticOrInternational,
    additional_fees_summary: input.additionalFeesSummary,
    application_fee_minor_units: input.applicationFeeMinorUnits,
    application_fee_currency: input.applicationFeeCurrency,
    course_url: input.courseUrl,
    intake_periods: input.intakePeriods,
    min_academic_requirement: input.minAcademicRequirement,
    work_experience_required: input.workExperienceRequired,
    portfolio_required: input.portfolioRequired,
    interview_required: input.interviewRequired,
    study_gap_policy: input.studyGapPolicy,
    additional_documents_required: input.additionalDocumentsRequired,
    scholarships_available: input.scholarshipsAvailable,
    career_outcomes: input.careerOutcomes,
    professional_accreditation: input.professionalAccreditation,
    data_source: input.dataSource,
    source_url: input.sourceUrl,
    last_verified_at: input.lastVerifiedAt,
    verification_status: input.verificationStatus,
  };
}

export async function createCourse(formData: FormData): Promise<string> {
  await requireAdminPermission("courses:write");
  const input = parseCourseForm(formData);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("courses")
    .insert({
      ...courseWriteFields(input),
      publication_status: "draft",
      // Not yet settable through the plain form — see courseWriteFields'
      // docblock; both start null/empty and are populated by the CSV
      // import pipeline or a future dedicated editor.
      english_requirements: null,
      standardized_test_requirements: null,
      merged_into_id: null,
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
    after: { name: input.name, universityId: input.universityId, publicationStatus: "draft", isActive: input.isActive },
  });

  return data.id;
}

export async function updateCourse(id: string, formData: FormData): Promise<void> {
  await requireAdminPermission("courses:write");
  const input = parseCourseForm(formData);
  const supabase = await createClient();

  const before = await getCourseById(id);

  const { error } = await supabase.from("courses").update(courseWriteFields(input)).eq("id", id);

  if (error) {
    logDbError("updateCourse", error);
    throw new Error(error.message);
  }

  const fieldChangeSummaries: string[] = [];
  if (before) {
    if (before.isActive !== input.isActive) fieldChangeSummaries.push(`isActive: ${before.isActive} -> ${input.isActive}`);
    if (before.verificationStatus !== input.verificationStatus) {
      fieldChangeSummaries.push(`verificationStatus: ${before.verificationStatus} -> ${input.verificationStatus}`);
    }
    if (before.name !== input.name) fieldChangeSummaries.push(`name: ${before.name} -> ${input.name}`);
  }

  await recordAuditLog({
    action: "Updated",
    entityType: "course",
    entityId: id,
    entityLabel: `course "${input.name}"`,
    fieldChangeSummaries,
    before: before ? { name: before.name, verificationStatus: before.verificationStatus, isActive: before.isActive } : undefined,
    after: { name: input.name, verificationStatus: input.verificationStatus, isActive: input.isActive },
  });
}

// ---------------------------------------------------------------------------
// Publication workflow — mirrors src/lib/supabase/admin/universities.ts's
// transitionUniversityStatus exactly.
// ---------------------------------------------------------------------------

async function transitionCourseStatus(id: string, status: EducationPublicationStatus, action: string): Promise<void> {
  await requireAdminPermission("courses:write");
  const supabase = await createClient();
  const before = await getCourseById(id);
  if (!before) throw new AdminValidationError("Course not found.");

  const { error } = await supabase.from("courses").update({ publication_status: status }).eq("id", id);
  if (error) {
    logDbError(`transitionCourseStatus(${status})`, error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action,
    entityType: "course",
    entityId: id,
    entityLabel: `course "${before.name}"`,
    fieldChangeSummaries: [`publicationStatus: ${before.publicationStatus} -> ${status}`],
    before: { publicationStatus: before.publicationStatus },
    after: { publicationStatus: status },
  });
}

export async function submitCourseForReview(id: string): Promise<void> {
  await transitionCourseStatus(id, "in_review", "Submitted for review");
}
export async function publishCourse(id: string): Promise<void> {
  await transitionCourseStatus(id, "published", "Published");
}
export async function archiveCourse(id: string): Promise<void> {
  await transitionCourseStatus(id, "archived", "Archived");
}
export async function restoreCourseToDraft(id: string): Promise<void> {
  await transitionCourseStatus(id, "draft", "Restored to draft");
}

export async function bulkUpdateCoursePublicationStatus(
  ids: string[],
  status: EducationPublicationStatus,
): Promise<{ succeeded: number; failed: number }> {
  await requireAdminPermission("courses:write");
  if (!(EDUCATION_PUBLICATION_STATUSES as readonly string[]).includes(status)) {
    throw new AdminValidationError("Invalid publication status.");
  }
  let succeeded = 0;
  let failed = 0;
  for (const id of ids) {
    try {
      await transitionCourseStatus(id, status, `Bulk-updated to ${status}`);
      succeeded += 1;
    } catch (err) {
      logDbError("bulkUpdateCoursePublicationStatus", err);
      failed += 1;
    }
  }
  return { succeeded, failed };
}

export function isContentEditorWritableCourseStatus(status: EducationPublicationStatus): boolean {
  return CONTENT_EDITOR_WRITABLE_STATUSES.includes(status);
}
