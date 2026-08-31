import "server-only";
import { createClient } from "../server";
import { calculateFreshnessBand } from "@/lib/education/data-quality";
import { clampPublicPageSize, parsePageParam, sanitizeSearchQuery, sanitizeFilterList } from "@/lib/education/search";
import type {
  CourseAdmissionRequirement,
  CourseDurationUnit,
  CourseIntake,
  CourseIntakeCapacityStatus,
  CourseIntakeStatus,
  CourseSearchFilters,
  CourseStudyPace,
  CourseTuitionCategory,
  CourseTuitionFee,
  EducationFreshnessBand,
  EducationListResult,
  EnglishRequirements,
  LivingCostsPeriod,
  StandardizedTestRequirements,
  TuitionBillingPeriod,
  TuitionStudentCategory,
} from "@/types/education";
import type { DeliveryMode, TuitionPeriod } from "@/types/admin";

/**
 * Milestone 9 — PUBLIC/student-facing read access to courses. Deliberately
 * separate from src/lib/supabase/admin/courses.ts (admin-gated, returns
 * draft/internal fields): every function here explicitly filters
 * `publication_status = 'published'` and `is_active = true` in addition to
 * whatever RLS already enforces — see src/lib/supabase/education/universities.ts's
 * docblock for the identical convention this mirrors.
 *
 * A course is only ever visible here if its PARENT university is also
 * published+active — the RLS policy "Public can read published active
 * courses of published unis" (0006_global_university_course_data.sql) already
 * enforces this with an `exists(...)` check against `universities`, so a
 * plain `.eq("publication_status","published").eq("is_active",true)` query
 * against `courses` alone is already correctly scoped end-to-end: Postgres
 * applies RLS before LIMIT/OFFSET/count, so pagination and `count: "exact"`
 * stay accurate without this layer re-deriving that join itself. Country
 * filtering (a university-level attribute) is instead resolved up front to a
 * list of eligible university ids — flat queries only, mirroring the
 * family/industry resolution pattern documented in
 * src/lib/supabase/careers.ts — rather than a nested PostgREST embed filter.
 *
 * Never claims completeness — see universities.ts's docblock; the same
 * "representative starter dataset" framing applies here.
 */

function logDbError(context: string, error: unknown) {
  console.error(`[education/courses] ${context}:`, error);
}

const MAX_COMPARE_COURSES = 4;

export interface PublicCourseSummary {
  id: string;
  name: string;
  slug: string;
  universityId: string;
  universityName: string;
  universitySlug: string;
  countryName: string | null;
  city: string | null;
  educationLevel: string | null;
  subjectArea: string | null;
  deliveryMode: DeliveryMode | null;
  durationText: string | null;
  durationValue: number | null;
  durationUnit: CourseDurationUnit | null;
  tuitionAmountMinorUnits: number | null;
  tuitionCurrency: string;
  tuitionPeriod: TuitionPeriod | null;
  scholarshipsAvailable: boolean | null;
  lastVerifiedAt: string | null;
  freshnessBand: EducationFreshnessBand;
}

export interface PublicCourseDetail extends PublicCourseSummary {
  campusName: string | null;
  programCode: string | null;
  subjectAreaDiscipline: string | null;
  qualificationTitle: string | null;
  award: string | null;
  studyPace: CourseStudyPace | null;
  teachingLanguage: string | null;
  tuitionDomesticOrInternational: CourseTuitionCategory | null;
  additionalFeesSummary: string | null;
  applicationFeeMinorUnits: number | null;
  applicationFeeCurrency: string | null;
  applicationUrl: string | null;
  courseUrl: string | null;
  intakePeriods: string[];
  entryRequirementsSummary: string | null;
  minAcademicRequirement: string | null;
  englishRequirements: EnglishRequirements | null;
  standardizedTestRequirements: StandardizedTestRequirements | null;
  workExperienceRequired: string | null;
  portfolioRequired: boolean | null;
  interviewRequired: boolean | null;
  studyGapPolicy: string | null;
  additionalDocumentsRequired: string[];
  careerOutcomes: string | null;
  professionalAccreditation: string | null;
  sourceUrl: string | null;
  verificationStatus: string;
}

interface PublicCourseRow {
  id: string;
  university_id: string;
  campus_id: string | null;
  name: string;
  slug: string;
  education_level: string | null;
  subject_area: string | null;
  discipline: string | null;
  delivery_mode: string | null;
  duration_text: string | null;
  duration_value: number | null;
  duration_unit: string | null;
  tuition_amount_minor_units: number | null;
  tuition_currency: string;
  tuition_period: string | null;
  scholarships_available: boolean | null;
  last_verified_at: string | null;
  program_code: string | null;
  qualification_title: string | null;
  award: string | null;
  study_pace: string | null;
  teaching_language: string | null;
  tuition_domestic_or_international: string | null;
  additional_fees_summary: string | null;
  application_fee_minor_units: number | null;
  application_fee_currency: string | null;
  application_url: string | null;
  course_url: string | null;
  intake_periods: string[] | null;
  entry_requirements_summary: string | null;
  min_academic_requirement: string | null;
  english_requirements: unknown;
  standardized_test_requirements: unknown;
  work_experience_required: string | null;
  portfolio_required: boolean | null;
  interview_required: boolean | null;
  study_gap_policy: string | null;
  additional_documents_required: string[] | null;
  career_outcomes: string | null;
  professional_accreditation: string | null;
  source_url: string | null;
  verification_status: string;
}

const ROW_COLUMNS =
  "id, university_id, campus_id, name, slug, education_level, subject_area, discipline, delivery_mode, duration_text, duration_value, duration_unit, tuition_amount_minor_units, tuition_currency, tuition_period, scholarships_available, last_verified_at, program_code, qualification_title, award, study_pace, teaching_language, tuition_domestic_or_international, additional_fees_summary, application_fee_minor_units, application_fee_currency, application_url, course_url, intake_periods, entry_requirements_summary, min_academic_requirement, english_requirements, standardized_test_requirements, work_experience_required, portfolio_required, interview_required, study_gap_policy, additional_documents_required, career_outcomes, professional_accreditation, source_url, verification_status";

interface UniversityLookup {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  countryId: string | null;
}

/** Flat batch lookup (no embed) — mirrors src/lib/supabase/admin/courses.ts's buildUniversityNameMap, extended with the fields the public summary/detail shapes need. */
async function buildUniversityLookupMap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  universityIds: string[],
): Promise<Map<string, UniversityLookup>> {
  const uniqueIds = Array.from(new Set(universityIds));
  if (uniqueIds.length === 0) return new Map();
  const { data, error } = await supabase.from("universities").select("id, name, slug, city, country_id").in("id", uniqueIds);
  if (error) {
    logDbError("buildUniversityLookupMap", error);
    return new Map();
  }
  return new Map(
    (data ?? []).map((u) => [
      u.id,
      { id: u.id, name: u.name, slug: u.slug, city: u.city, countryId: u.country_id } as UniversityLookup,
    ]),
  );
}

async function buildCountryNameMap(supabase: Awaited<ReturnType<typeof createClient>>, countryIds: (string | null)[]): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(countryIds.filter((id): id is string => !!id)));
  if (uniqueIds.length === 0) return new Map();
  const { data, error } = await supabase.from("countries").select("id, name").in("id", uniqueIds);
  if (error) {
    logDbError("buildCountryNameMap", error);
    return new Map();
  }
  return new Map((data ?? []).map((c) => [c.id, c.name]));
}

async function buildCampusNameMap(supabase: Awaited<ReturnType<typeof createClient>>, campusIds: (string | null)[]): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(campusIds.filter((id): id is string => !!id)));
  if (uniqueIds.length === 0) return new Map();
  const { data, error } = await supabase.from("campuses").select("id, name").in("id", uniqueIds);
  if (error) {
    logDbError("buildCampusNameMap", error);
    return new Map();
  }
  return new Map((data ?? []).map((c) => [c.id, c.name]));
}

function toSummary(
  row: PublicCourseRow,
  universityById: Map<string, UniversityLookup>,
  countryNameById: Map<string, string>,
): PublicCourseSummary {
  const university = universityById.get(row.university_id);
  const countryName = university?.countryId ? (countryNameById.get(university.countryId) ?? null) : null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    universityId: row.university_id,
    universityName: university?.name ?? "",
    universitySlug: university?.slug ?? "",
    countryName,
    city: university?.city ?? null,
    educationLevel: row.education_level,
    subjectArea: row.subject_area,
    deliveryMode: (row.delivery_mode as DeliveryMode | null) ?? null,
    durationText: row.duration_text,
    durationValue: row.duration_value,
    durationUnit: (row.duration_unit as CourseDurationUnit | null) ?? null,
    tuitionAmountMinorUnits: row.tuition_amount_minor_units,
    tuitionCurrency: row.tuition_currency,
    tuitionPeriod: (row.tuition_period as TuitionPeriod | null) ?? null,
    scholarshipsAvailable: row.scholarships_available,
    lastVerifiedAt: row.last_verified_at,
    freshnessBand: calculateFreshnessBand(row.last_verified_at),
  };
}

function toDetail(
  row: PublicCourseRow,
  universityById: Map<string, UniversityLookup>,
  countryNameById: Map<string, string>,
  campusNameById: Map<string, string>,
): PublicCourseDetail {
  return {
    ...toSummary(row, universityById, countryNameById),
    campusName: row.campus_id ? (campusNameById.get(row.campus_id) ?? null) : null,
    programCode: row.program_code,
    subjectAreaDiscipline: row.discipline,
    qualificationTitle: row.qualification_title,
    award: row.award,
    studyPace: (row.study_pace as CourseStudyPace | null) ?? null,
    teachingLanguage: row.teaching_language,
    tuitionDomesticOrInternational: (row.tuition_domestic_or_international as CourseTuitionCategory | null) ?? null,
    additionalFeesSummary: row.additional_fees_summary,
    applicationFeeMinorUnits: row.application_fee_minor_units,
    applicationFeeCurrency: row.application_fee_currency,
    applicationUrl: row.application_url,
    courseUrl: row.course_url,
    intakePeriods: row.intake_periods ?? [],
    entryRequirementsSummary: row.entry_requirements_summary,
    minAcademicRequirement: row.min_academic_requirement,
    englishRequirements: (row.english_requirements as EnglishRequirements | null) ?? null,
    standardizedTestRequirements: (row.standardized_test_requirements as StandardizedTestRequirements | null) ?? null,
    workExperienceRequired: row.work_experience_required,
    portfolioRequired: row.portfolio_required,
    interviewRequired: row.interview_required,
    studyGapPolicy: row.study_gap_policy,
    additionalDocumentsRequired: row.additional_documents_required ?? [],
    careerOutcomes: row.career_outcomes,
    professionalAccreditation: row.professional_accreditation,
    sourceUrl: row.source_url,
    verificationStatus: row.verification_status,
  };
}

/** Resolves a country-id filter to the eligible published+active university ids up front (flat query, no embed) — mirrors careers.ts's family/industry resolution pattern. Returns `null` when no country filter was requested (meaning "don't restrict by university"), or an array (possibly empty) of matching university ids otherwise. */
async function resolveUniversityIdsForCountries(
  supabase: Awaited<ReturnType<typeof createClient>>,
  countryIds: string[],
): Promise<string[] | null> {
  if (countryIds.length === 0) return null;
  const { data, error } = await supabase
    .from("universities")
    .select("id")
    .eq("publication_status", "published")
    .eq("is_active", true)
    .in("country_id", countryIds);
  if (error) {
    logDbError("resolveUniversityIdsForCountries", error);
    return [];
  }
  return (data ?? []).map((u) => u.id);
}

/**
 * Server-side paginated public course search — never loads the full catalog
 * into the browser (spec requirement). `minIeltsOverall` is compared as text
 * against the `english_requirements->ielts->>overall` JSON path: every
 * seeded/imported IELTS overall band score is stored in a fixed "d.d" shape
 * (0.0–9.0 in 0.5 steps), for which lexicographic and numeric ordering
 * coincide, so a text comparison is safe here without a generated column on
 * the (already-finalized) migration — this is a narrower guarantee than a
 * true numeric comparison and is called out for anyone extending this filter.
 */
export async function searchCourses(filters: CourseSearchFilters = {}): Promise<EducationListResult<PublicCourseSummary>> {
  const page = parsePageParam(filters.page ? String(filters.page) : undefined);
  const pageSize = clampPublicPageSize(filters.pageSize);
  const empty: EducationListResult<PublicCourseSummary> = { items: [], total: 0, page, pageSize };

  const supabase = await createClient();

  const countryIds = sanitizeFilterList(filters.countryIds);
  const universityIdsForCountries = await resolveUniversityIdsForCountries(supabase, countryIds);
  if (universityIdsForCountries !== null && universityIdsForCountries.length === 0) {
    // A country filter was requested but no published university matches it.
    return empty;
  }

  let query = supabase
    .from("courses")
    .select(ROW_COLUMNS, { count: "exact" })
    .eq("publication_status", "published")
    .eq("is_active", true);

  const q = sanitizeSearchQuery(filters.q);
  if (q) {
    query = query.textSearch("search_vector", q, { type: "websearch", config: "english" });
  }
  if (filters.universityId) {
    query = query.eq("university_id", filters.universityId);
  }
  if (universityIdsForCountries !== null) {
    query = query.in("university_id", universityIdsForCountries);
  }
  const subjectAreas = sanitizeFilterList(filters.subjectAreas);
  if (subjectAreas.length > 0) query = query.in("subject_area", subjectAreas);
  const qualificationLevels = sanitizeFilterList(filters.qualificationLevels);
  if (qualificationLevels.length > 0) query = query.in("education_level", qualificationLevels);
  const studyModes = sanitizeFilterList(filters.studyModes);
  if (studyModes.length > 0) query = query.in("delivery_mode", studyModes);
  const teachingLanguages = sanitizeFilterList(filters.teachingLanguages);
  if (teachingLanguages.length > 0) query = query.in("teaching_language", teachingLanguages);
  if (filters.currency) {
    query = query.eq("tuition_currency", filters.currency);
  }
  if (filters.minTuitionMinorUnits !== undefined) {
    query = query.gte("tuition_amount_minor_units", filters.minTuitionMinorUnits);
  }
  if (filters.maxTuitionMinorUnits !== undefined) {
    query = query.lte("tuition_amount_minor_units", filters.maxTuitionMinorUnits);
  }
  if (filters.durationUnit) {
    query = query.eq("duration_unit", filters.durationUnit);
  }
  if (filters.intakePeriod) {
    query = query.contains("intake_periods", [filters.intakePeriod]);
  }
  if (filters.scholarshipsAvailable !== undefined) {
    query = query.eq("scholarships_available", filters.scholarshipsAvailable);
  }
  if (filters.minIeltsOverall !== undefined) {
    query = query.gte("english_requirements->ielts->>overall", String(filters.minIeltsOverall));
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await query.order("name", { ascending: true }).range(from, to);

  if (error) {
    logDbError("searchCourses", error);
    return empty;
  }

  const rows = (data ?? []) as unknown as PublicCourseRow[];
  const universityById = await buildUniversityLookupMap(supabase, rows.map((r) => r.university_id));
  const countryNameById = await buildCountryNameMap(supabase, Array.from(universityById.values()).map((u) => u.countryId));

  return { items: rows.map((r) => toSummary(r, universityById, countryNameById)), total: count ?? 0, page, pageSize };
}

/** Public course detail by (universitySlug, courseSlug) — course slugs are only unique per-university (`unique(university_id, slug)`), so the route is `/courses/[universitySlug]/[courseSlug]`, never a flat `/courses/[slug]`. Returns null for a draft/archived/unknown/merged-away slug pair, or an unpublished parent university, rather than leaking existence. */
export async function getPublicCourseBySlugPair(universitySlug: string, courseSlug: string): Promise<PublicCourseDetail | null> {
  const supabase = await createClient();

  const { data: university, error: universityError } = await supabase
    .from("universities")
    .select("id, name, slug, city, country_id")
    .eq("slug", universitySlug)
    .eq("publication_status", "published")
    .eq("is_active", true)
    .maybeSingle();
  if (universityError) {
    logDbError("getPublicCourseBySlugPair(university)", universityError);
    return null;
  }
  if (!university) return null;

  const { data, error } = await supabase
    .from("courses")
    .select(ROW_COLUMNS)
    .eq("university_id", university.id)
    .eq("slug", courseSlug)
    .eq("publication_status", "published")
    .eq("is_active", true)
    .maybeSingle();
  if (error) {
    logDbError("getPublicCourseBySlugPair(course)", error);
    return null;
  }
  if (!data) return null;

  const row = data as unknown as PublicCourseRow;
  const universityById = new Map<string, UniversityLookup>([
    [university.id, { id: university.id, name: university.name, slug: university.slug, city: university.city, countryId: university.country_id }],
  ]);
  const countryNameById = await buildCountryNameMap(supabase, [university.country_id]);
  const campusNameById = await buildCampusNameMap(supabase, [row.campus_id]);

  return toDetail(row, universityById, countryNameById, campusNameById);
}

/** Fetches up to `limit` published+active courses by id — defaults to MAX_COMPARE_COURSES for the course comparison page's use (preserves the caller's requested order; comparison tables read left-to-right in selection order); pass a higher `limit` for other batch-lookup uses (e.g. resolving course names for a student's own application list, src/lib/supabase/education/applications.ts). Silently drops any id that is missing, unpublished, or beyond the cap. */
export async function getCoursesByIds(ids: string[], limit: number = MAX_COMPARE_COURSES): Promise<PublicCourseDetail[]> {
  const uniqueIds = Array.from(new Set(ids)).slice(0, limit);
  if (uniqueIds.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .select(ROW_COLUMNS)
    .in("id", uniqueIds)
    .eq("publication_status", "published")
    .eq("is_active", true);
  if (error) {
    logDbError("getCoursesByIds", error);
    return [];
  }

  const rows = (data ?? []) as unknown as PublicCourseRow[];
  const universityById = await buildUniversityLookupMap(supabase, rows.map((r) => r.university_id));
  const countryNameById = await buildCountryNameMap(supabase, Array.from(universityById.values()).map((u) => u.countryId));
  const campusNameById = await buildCampusNameMap(supabase, rows.map((r) => r.campus_id));

  const byId = new Map(rows.map((r) => [r.id, toDetail(r, universityById, countryNameById, campusNameById)]));
  // Preserve caller order; drop ids that didn't resolve to a visible row.
  return uniqueIds.map((id) => byId.get(id)).filter((c): c is PublicCourseDetail => !!c);
}

// ---------------------------------------------------------------------------
// Course sub-entities — intakes, tuition/fees, admission requirements,
// course-scoped scholarships. Each RLS policy for these tables already
// requires the parent course (and transitively its university) to be
// published+active (see PART 5/6/7 of the migration), so no additional
// `.eq("publication_status", ...)` filter is needed on these child tables
// themselves — same reasoning as searchCourses' docblock. Callers are
// expected to only call these for a course id already confirmed visible
// (e.g. from getPublicCourseBySlugPair), never as a way to probe existence.
// ---------------------------------------------------------------------------

interface PublicCourseIntakeRow {
  id: string;
  course_id: string;
  intake_name: string;
  start_month: number | null;
  start_year: number | null;
  applications_open_at: string | null;
  priority_deadline: string | null;
  final_deadline: string | null;
  international_deadline: string | null;
  capacity_status: string;
  intake_status: string;
  data_source: string | null;
  source_url: string | null;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

function toPublicIntake(row: PublicCourseIntakeRow): CourseIntake {
  return {
    id: row.id,
    courseId: row.course_id,
    intakeName: row.intake_name,
    startMonth: row.start_month,
    startYear: row.start_year,
    applicationsOpenAt: row.applications_open_at,
    priorityDeadline: row.priority_deadline,
    finalDeadline: row.final_deadline,
    internationalDeadline: row.international_deadline,
    capacityStatus: row.capacity_status as CourseIntakeCapacityStatus,
    intakeStatus: row.intake_status as CourseIntakeStatus,
    dataSource: row.data_source,
    sourceUrl: row.source_url,
    lastVerifiedAt: row.last_verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listPublicIntakesForCourse(courseId: string): Promise<CourseIntake[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("course_intakes")
    .select("*")
    .eq("course_id", courseId)
    .order("start_year", { ascending: true })
    .order("start_month", { ascending: true });
  if (error) {
    logDbError("listPublicIntakesForCourse", error);
    return [];
  }
  return (data ?? []).map((r) => toPublicIntake(r as unknown as PublicCourseIntakeRow));
}

interface PublicTuitionFeeRow {
  id: string;
  course_id: string;
  student_category: string;
  amount_minor_units: number;
  currency_code: string;
  academic_year: string;
  billing_period: string | null;
  mandatory_fees_minor_units: number;
  estimated_living_costs_minor_units: number | null;
  estimated_living_costs_period: string | null;
  data_source: string | null;
  source_url: string | null;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

function toPublicTuitionFee(row: PublicTuitionFeeRow): CourseTuitionFee {
  return {
    id: row.id,
    courseId: row.course_id,
    studentCategory: row.student_category as TuitionStudentCategory,
    amountMinorUnits: row.amount_minor_units,
    currencyCode: row.currency_code,
    academicYear: row.academic_year,
    billingPeriod: (row.billing_period as TuitionBillingPeriod | null) ?? null,
    mandatoryFeesMinorUnits: row.mandatory_fees_minor_units,
    estimatedLivingCostsMinorUnits: row.estimated_living_costs_minor_units,
    estimatedLivingCostsPeriod: (row.estimated_living_costs_period as LivingCostsPeriod | null) ?? null,
    dataSource: row.data_source,
    sourceUrl: row.source_url,
    lastVerifiedAt: row.last_verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** currencyCode is returned exactly as stored — never converted (spec: "do not convert or compare currencies as though they were equivalent"). */
export async function listPublicTuitionFeesForCourse(courseId: string): Promise<CourseTuitionFee[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("course_tuition_fees")
    .select("*")
    .eq("course_id", courseId)
    .order("academic_year", { ascending: false });
  if (error) {
    logDbError("listPublicTuitionFeesForCourse", error);
    return [];
  }
  return (data ?? []).map((r) => toPublicTuitionFee(r as unknown as PublicTuitionFeeRow));
}

interface PublicAdmissionRequirementRow {
  id: string;
  course_id: string;
  country_context_id: string | null;
  accepted_qualification: string;
  minimum_grade: string | null;
  minimum_gpa: number | null;
  required_subjects: string[] | null;
  language_test: string | null;
  language_test_min_score: number | null;
  standardized_test: string | null;
  standardized_test_min_score: number | null;
  work_experience_required: string | null;
  portfolio_required: boolean;
  interview_required: boolean;
  additional_documents: string[] | null;
  data_source: string | null;
  source_url: string | null;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

function toPublicAdmissionRequirement(row: PublicAdmissionRequirementRow, countryNameById: Map<string, string>): CourseAdmissionRequirement {
  return {
    id: row.id,
    courseId: row.course_id,
    countryContextId: row.country_context_id,
    countryContextName: row.country_context_id ? (countryNameById.get(row.country_context_id) ?? null) : null,
    acceptedQualification: row.accepted_qualification,
    minimumGrade: row.minimum_grade,
    minimumGpa: row.minimum_gpa,
    requiredSubjects: row.required_subjects ?? [],
    languageTest: row.language_test,
    languageTestMinScore: row.language_test_min_score,
    standardizedTest: row.standardized_test,
    standardizedTestMinScore: row.standardized_test_min_score,
    workExperienceRequired: row.work_experience_required,
    portfolioRequired: row.portfolio_required,
    interviewRequired: row.interview_required,
    additionalDocuments: row.additional_documents ?? [],
    dataSource: row.data_source,
    sourceUrl: row.source_url,
    lastVerifiedAt: row.last_verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listPublicAdmissionRequirementsForCourse(courseId: string): Promise<CourseAdmissionRequirement[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("course_admission_requirements").select("*").eq("course_id", courseId);
  if (error) {
    logDbError("listPublicAdmissionRequirementsForCourse", error);
    return [];
  }
  const rows = (data ?? []) as unknown as PublicAdmissionRequirementRow[];
  const countryNameById = await buildCountryNameMap(supabase, rows.map((r) => r.country_context_id));
  return rows.map((r) => toPublicAdmissionRequirement(r, countryNameById));
}

export interface PublicCourseScholarshipSummary {
  id: string;
  name: string;
  eligibility: string | null;
  awardAmountMinorUnits: number | null;
  awardDescription: string | null;
  currencyCode: string | null;
  deadline: string | null;
  scholarshipUrl: string | null;
  internationalEligible: boolean | null;
}

export async function listPublicScholarshipsForCourse(courseId: string): Promise<PublicCourseScholarshipSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scholarships")
    .select("id, name, eligibility, award_amount_minor_units, award_description, currency_code, deadline, scholarship_url, international_eligible")
    .eq("scope", "course")
    .eq("course_id", courseId)
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) {
    logDbError("listPublicScholarshipsForCourse", error);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    eligibility: row.eligibility,
    awardAmountMinorUnits: row.award_amount_minor_units,
    awardDescription: row.award_description,
    currencyCode: row.currency_code,
    deadline: row.deadline,
    scholarshipUrl: row.scholarship_url,
    internationalEligible: row.international_eligible,
  }));
}
