import "server-only";
import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import {
  DEFAULT_FRESHNESS_BAND_CONFIG,
  calculateFreshnessBand,
  checkAdmissionRequirementDataQuality,
  checkCourseDataQuality,
  checkCourseIntakeDataQuality,
  checkUniversityDataQuality,
  findDuplicateSlugs,
} from "@/lib/education/data-quality";
import type { DataQualityIssue } from "@/lib/education/data-quality";
import type { EducationFreshnessBand, EducationPublicationStatus, EducationVerificationStatus } from "@/types/education";

/**
 * Milestone 9 — data-quality dashboard aggregation. Pure rule
 * implementations live in src/lib/education/data-quality.ts (unit-tested
 * there); this module is the DB-facing wiring that pulls the current
 * records, evaluates each against those rules, and rolls the results up
 * into the dashboard the admin sees.
 *
 * Spec requirement: nothing here deletes or auto-corrects a record — every
 * check only ever flags an issue for an admin to act on. Freshness bands
 * are computed at read time (see calculateFreshnessBand), never stored.
 *
 * Scale note: this reads every active university/course/intake/admission
 * requirement into memory to evaluate them. That is appropriate for the
 * clearly-labelled starter dataset; a production-scale catalog would want
 * this to run as a scheduled batch job writing a summary row per entity
 * rather than a live per-request scan — see
 * docs/global-education-data-guide.md.
 */

function logDbError(context: string, error: unknown) {
  console.error(`[admin/education-data-quality] ${context}:`, error);
}

export interface FlaggedRecordIssue {
  entityType: "university" | "course" | "course_intake" | "course_admission_requirement";
  entityId: string;
  entityLabel: string;
  issues: DataQualityIssue[];
}

export interface DataQualityDashboard {
  generatedAt: string;
  totals: {
    universities: number;
    courses: number;
    courseIntakes: number;
    admissionRequirements: number;
  };
  issueCountsByCode: Record<string, number>;
  errorCount: number;
  warningCount: number;
  freshnessBandCounts: Record<EducationFreshnessBand, { universities: number; courses: number }>;
  needsReviewCounts: { universities: number; courses: number };
  duplicateSlugGroups: { entityType: "university" | "course"; slug: string; ids: string[] }[];
  /** Capped list of the highest-severity flagged records, for the dashboard table. Never the full set for a large catalog — see the scale note above. */
  flaggedRecords: FlaggedRecordIssue[];
}

const FLAGGED_RECORDS_LIMIT = 200;

interface UniversityRow {
  id: string;
  name: string;
  slug: string;
  website: string | null;
  country_id: string | null;
  is_active: boolean;
  publication_status: string;
  verification_status: string;
  application_fee_currency: string | null;
  source_url: string | null;
  last_verified_at: string | null;
}

interface CourseRow {
  id: string;
  name: string;
  slug: string;
  university_id: string;
  is_active: boolean;
  publication_status: string;
  verification_status: string;
  tuition_amount_minor_units: number | null;
  tuition_currency: string | null;
  application_fee_currency: string | null;
  source_url: string | null;
  last_verified_at: string | null;
}

interface CourseIntakeRow {
  id: string;
  course_id: string;
  intake_name: string;
  applications_open_at: string | null;
  priority_deadline: string | null;
  final_deadline: string | null;
  start_year: number | null;
  start_month: number | null;
  intake_status: string;
}

interface AdmissionRequirementRow {
  id: string;
  course_id: string;
  accepted_qualification: string;
  language_test: string | null;
  language_test_min_score: number | null;
}

export async function getDataQualityDashboard(): Promise<DataQualityDashboard> {
  await requireAdminPermission("education-data-quality:read");
  const supabase = await createClient();
  const now = new Date();

  const [universitiesRes, coursesRes, intakesRes, requirementsRes] = await Promise.all([
    supabase
      .from("universities")
      .select("id, name, slug, website, country_id, is_active, publication_status, verification_status, application_fee_currency, source_url, last_verified_at")
      .eq("is_active", true)
      .is("merged_into_id", null),
    supabase
      .from("courses")
      .select("id, name, slug, university_id, is_active, publication_status, verification_status, tuition_amount_minor_units, tuition_currency, application_fee_currency, source_url, last_verified_at")
      .eq("is_active", true)
      .is("merged_into_id", null),
    supabase
      .from("course_intakes")
      .select("id, course_id, intake_name, applications_open_at, priority_deadline, final_deadline, start_year, start_month, intake_status"),
    supabase
      .from("course_admission_requirements")
      .select("id, course_id, accepted_qualification, language_test, language_test_min_score"),
  ]);

  if (universitiesRes.error) logDbError("getDataQualityDashboard:universities", universitiesRes.error);
  if (coursesRes.error) logDbError("getDataQualityDashboard:courses", coursesRes.error);
  if (intakesRes.error) logDbError("getDataQualityDashboard:intakes", intakesRes.error);
  if (requirementsRes.error) logDbError("getDataQualityDashboard:requirements", requirementsRes.error);

  const universities = (universitiesRes.data ?? []) as UniversityRow[];
  const courses = (coursesRes.data ?? []) as CourseRow[];
  const intakes = (intakesRes.data ?? []) as CourseIntakeRow[];
  const requirements = (requirementsRes.data ?? []) as AdmissionRequirementRow[];

  const countryIds = Array.from(new Set(universities.map((u) => u.country_id).filter((id): id is string => !!id)));
  const isoByCountryId = new Map<string, string>();
  if (countryIds.length > 0) {
    const { data: countries } = await supabase.from("countries").select("id, iso_alpha2").in("id", countryIds);
    for (const c of countries ?? []) isoByCountryId.set(c.id, c.iso_alpha2);
  }
  const universityById = new Map(universities.map((u) => [u.id, u]));

  const issueCountsByCode: Record<string, number> = {};
  let errorCount = 0;
  let warningCount = 0;
  const flaggedRecords: FlaggedRecordIssue[] = [];

  function tally(entityType: FlaggedRecordIssue["entityType"], entityId: string, entityLabel: string, issues: DataQualityIssue[]) {
    if (issues.length === 0) return;
    for (const iss of issues) {
      issueCountsByCode[iss.code] = (issueCountsByCode[iss.code] ?? 0) + 1;
      if (iss.severity === "error") errorCount++;
      else warningCount++;
    }
    if (flaggedRecords.length < FLAGGED_RECORDS_LIMIT) {
      flaggedRecords.push({ entityType, entityId, entityLabel, issues });
    }
  }

  const freshnessBandCounts: Record<EducationFreshnessBand, { universities: number; courses: number }> = {
    current: { universities: 0, courses: 0 },
    review_soon: { universities: 0, courses: 0 },
    stale: { universities: 0, courses: 0 },
    unknown: { universities: 0, courses: 0 },
  };
  const needsReviewCounts = { universities: 0, courses: 0 };

  for (const u of universities) {
    const issues = checkUniversityDataQuality(
      {
        websiteUrl: u.website,
        countryIsoAlpha2: u.country_id ? (isoByCountryId.get(u.country_id) ?? null) : null,
        slug: u.slug,
        isActive: u.is_active,
        publicationStatus: u.publication_status as EducationPublicationStatus,
        applicationFeeCurrency: u.application_fee_currency,
        sourceUrl: u.source_url,
        lastVerifiedAt: u.last_verified_at,
      },
      now,
    );
    tally("university", u.id, u.name, issues);
    freshnessBandCounts[calculateFreshnessBand(u.last_verified_at, now, DEFAULT_FRESHNESS_BAND_CONFIG)].universities++;
    if ((u.verification_status as EducationVerificationStatus) === "needs_review") needsReviewCounts.universities++;
  }

  for (const c of courses) {
    const parent = universityById.get(c.university_id) ?? null;
    const issues = checkCourseDataQuality(
      {
        slug: c.slug,
        isActive: c.is_active,
        publicationStatus: c.publication_status as EducationPublicationStatus,
        tuitionAmountMinorUnits: c.tuition_amount_minor_units,
        tuitionCurrency: c.tuition_currency,
        applicationFeeCurrency: c.application_fee_currency,
        sourceUrl: c.source_url,
        lastVerifiedAt: c.last_verified_at,
        parentUniversity: parent ? { isActive: parent.is_active, publicationStatus: parent.publication_status as EducationPublicationStatus } : null,
      },
      now,
    );
    tally("course", c.id, c.name, issues);
    freshnessBandCounts[calculateFreshnessBand(c.last_verified_at, now, DEFAULT_FRESHNESS_BAND_CONFIG)].courses++;
    if ((c.verification_status as EducationVerificationStatus) === "needs_review") needsReviewCounts.courses++;
  }

  for (const intake of intakes) {
    const issues = checkCourseIntakeDataQuality(
      {
        applicationsOpenAt: intake.applications_open_at,
        priorityDeadline: intake.priority_deadline,
        finalDeadline: intake.final_deadline,
        startYear: intake.start_year,
        startMonth: intake.start_month,
        intakeStatus: intake.intake_status as "upcoming" | "open" | "closed" | "cancelled",
      },
      now,
    );
    tally("course_intake", intake.id, intake.intake_name, issues);
  }

  for (const req of requirements) {
    const issues = checkAdmissionRequirementDataQuality({ languageTest: req.language_test, languageTestMinScore: req.language_test_min_score });
    tally("course_admission_requirement", req.id, req.accepted_qualification, issues);
  }

  const duplicateSlugGroups: DataQualityDashboard["duplicateSlugGroups"] = [];
  for (const [slug, ids] of findDuplicateSlugs(universities.map((u) => ({ id: u.id, slug: u.slug })))) {
    duplicateSlugGroups.push({ entityType: "university", slug, ids });
  }
  // Course slugs are only unique per-university (see courses' `unique
  // (university_id, slug)` constraint), so duplicates are checked within
  // each university's own course set rather than globally.
  const coursesByUniversity = new Map<string, CourseRow[]>();
  for (const c of courses) {
    const bucket = coursesByUniversity.get(c.university_id) ?? [];
    bucket.push(c);
    coursesByUniversity.set(c.university_id, bucket);
  }
  for (const bucket of coursesByUniversity.values()) {
    for (const [slug, ids] of findDuplicateSlugs(bucket.map((c) => ({ id: c.id, slug: c.slug })))) {
      duplicateSlugGroups.push({ entityType: "course", slug, ids });
    }
  }
  for (const group of duplicateSlugGroups) {
    issueCountsByCode.duplicate_slug = (issueCountsByCode.duplicate_slug ?? 0) + 1;
    errorCount++;
  }

  return {
    generatedAt: now.toISOString(),
    totals: {
      universities: universities.length,
      courses: courses.length,
      courseIntakes: intakes.length,
      admissionRequirements: requirements.length,
    },
    issueCountsByCode,
    errorCount,
    warningCount,
    freshnessBandCounts,
    needsReviewCounts,
    duplicateSlugGroups,
    flaggedRecords,
  };
}
