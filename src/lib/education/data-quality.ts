/**
 * Milestone 9 — data-quality rule implementations and freshness-band
 * calculation. Pure functions operating on plain objects, no DB access —
 * reused by the admin data-quality dashboard aggregation queries
 * (src/lib/supabase/admin/education-data-quality.ts), the CSV import
 * validator, and the record-level "missing-field indicators" shown in
 * admin list/detail views.
 *
 * Per the spec: these functions only ever FLAG issues. Nothing here
 * deletes or silently "fixes" a record — every issue is surfaced for an
 * admin to review and correct.
 */

import { isValidAlpha2, isValidCurrencyCodeFormat } from "./normalize";
import type { EducationFreshnessBand, EducationPublicationStatus } from "@/types/education";

export type DataQualitySeverity = "error" | "warning";

export interface DataQualityIssue {
  code: string;
  severity: DataQualitySeverity;
  message: string;
}

function issue(code: string, severity: DataQualitySeverity, message: string): DataQualityIssue {
  return { code, severity, message };
}

// ---------------------------------------------------------------------------
// Freshness bands
// ---------------------------------------------------------------------------

export interface FreshnessBandConfig {
  /** last_verified_at within this many days of `now` => "current". */
  currentWithinDays: number;
  /** last_verified_at within this many days of `now` (but beyond currentWithinDays) => "review_soon". */
  reviewSoonWithinDays: number;
  /** Anything older than reviewSoonWithinDays => "stale". No last_verified_at at all => "unknown". */
}

export const DEFAULT_FRESHNESS_BAND_CONFIG: FreshnessBandConfig = {
  currentWithinDays: 180, // ~6 months
  reviewSoonWithinDays: 365, // ~1 year
};

/** Computed at read time — never a stored column (a DB CHECK/generated column can't reference "now" in a way that stays correct as time passes). */
export function calculateFreshnessBand(
  lastVerifiedAt: string | null,
  now: Date = new Date(),
  config: FreshnessBandConfig = DEFAULT_FRESHNESS_BAND_CONFIG,
): EducationFreshnessBand {
  if (!lastVerifiedAt) return "unknown";
  const verifiedDate = new Date(lastVerifiedAt);
  if (Number.isNaN(verifiedDate.getTime())) return "unknown";
  const daysSince = (now.getTime() - verifiedDate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince < 0) return "current"; // a future-dated verification is treated as current, not an error here (caught separately if ever needed)
  if (daysSince <= config.currentWithinDays) return "current";
  if (daysSince <= config.reviewSoonWithinDays) return "review_soon";
  return "stale";
}

// ---------------------------------------------------------------------------
// Rule 1-2, 7-9: generic field-presence / format checks shared by
// universities, courses, and any record with source/verification fields
// ---------------------------------------------------------------------------

export interface SourcedRecord {
  sourceUrl: string | null;
  lastVerifiedAt: string | null;
}

export function checkMissingSource(record: SourcedRecord): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];
  if (!record.sourceUrl) {
    issues.push(issue("missing_source_url", "warning", "No source URL is recorded for this record."));
  }
  if (!record.lastVerifiedAt) {
    issues.push(issue("missing_last_verified_at", "warning", "No last-verified date is recorded for this record."));
  }
  return issues;
}

export function checkStaleVerification(
  record: SourcedRecord,
  now: Date = new Date(),
  config: FreshnessBandConfig = DEFAULT_FRESHNESS_BAND_CONFIG,
): DataQualityIssue[] {
  const band = calculateFreshnessBand(record.lastVerifiedAt, now, config);
  if (band === "stale") {
    return [issue("stale_verification", "warning", "This record has not been verified recently and may be out of date.")];
  }
  return [];
}

// ---------------------------------------------------------------------------
// University-level checks
// ---------------------------------------------------------------------------

export interface UniversityQualityInput extends SourcedRecord {
  websiteUrl: string | null;
  countryIsoAlpha2: string | null;
  slug: string;
  isActive: boolean;
  publicationStatus: EducationPublicationStatus;
  applicationFeeCurrency: string | null;
}

export function checkUniversityDataQuality(university: UniversityQualityInput, now: Date = new Date()): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];

  if (!university.websiteUrl) {
    issues.push(issue("missing_official_url", "warning", "No official website URL is recorded."));
  }
  if (university.countryIsoAlpha2 && !isValidAlpha2(university.countryIsoAlpha2)) {
    issues.push(issue("invalid_country_code", "error", `"${university.countryIsoAlpha2}" is not a valid ISO 3166-1 alpha-2 country code.`));
  }
  if (university.applicationFeeCurrency && !isValidCurrencyCodeFormat(university.applicationFeeCurrency)) {
    issues.push(issue("invalid_currency_code", "error", `"${university.applicationFeeCurrency}" is not a valid ISO 4217 currency code.`));
  }
  issues.push(...checkMissingSource(university));
  issues.push(...checkStaleVerification(university, now));

  return issues;
}

// ---------------------------------------------------------------------------
// Course-level checks
// ---------------------------------------------------------------------------

export interface CourseQualityInput extends SourcedRecord {
  slug: string;
  isActive: boolean;
  publicationStatus: EducationPublicationStatus;
  tuitionAmountMinorUnits: number | null;
  tuitionCurrency: string | null;
  applicationFeeCurrency: string | null;
  parentUniversity: { isActive: boolean; publicationStatus: EducationPublicationStatus } | null;
}

export function checkCourseDataQuality(course: CourseQualityInput, now: Date = new Date()): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];

  if (course.tuitionAmountMinorUnits !== null && course.tuitionAmountMinorUnits < 0) {
    issues.push(issue("invalid_tuition_amount", "error", "Tuition amount cannot be negative."));
  }
  if (course.tuitionCurrency && !isValidCurrencyCodeFormat(course.tuitionCurrency)) {
    issues.push(issue("invalid_currency_code", "error", `"${course.tuitionCurrency}" is not a valid ISO 4217 currency code.`));
  }
  if (course.applicationFeeCurrency && !isValidCurrencyCodeFormat(course.applicationFeeCurrency)) {
    issues.push(issue("invalid_currency_code", "error", `"${course.applicationFeeCurrency}" is not a valid ISO 4217 currency code.`));
  }
  if (course.parentUniversity && !course.parentUniversity.isActive) {
    issues.push(issue("inactive_parent_university", "error", "This course is linked to an inactive university."));
  }
  if (course.parentUniversity && course.publicationStatus === "published" && course.parentUniversity.publicationStatus !== "published") {
    issues.push(issue("unpublished_parent", "error", "This course is published but its parent university is not — it will not be visible to the public despite its own status."));
  }
  issues.push(...checkMissingSource(course));
  issues.push(...checkStaleVerification(course, now));

  return issues;
}

// ---------------------------------------------------------------------------
// Course intake checks
// ---------------------------------------------------------------------------

export interface CourseIntakeQualityInput {
  applicationsOpenAt: string | null;
  priorityDeadline: string | null;
  finalDeadline: string | null;
  startYear: number | null;
  startMonth: number | null;
  intakeStatus: "upcoming" | "open" | "closed" | "cancelled";
}

export function checkCourseIntakeDataQuality(intake: CourseIntakeQualityInput, now: Date = new Date()): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];

  // "deadline before opening date" is also enforced at the DB level (see
  // course_intakes_deadline_order_check in 0006) — this check exists so the
  // same rule can run at CSV-preview time, before any DB write happens.
  if (intake.applicationsOpenAt && intake.priorityDeadline && intake.priorityDeadline < intake.applicationsOpenAt) {
    issues.push(issue("deadline_before_opening", "error", "Priority deadline is before the applications-open date."));
  }
  if (intake.applicationsOpenAt && intake.finalDeadline && intake.finalDeadline < intake.applicationsOpenAt) {
    issues.push(issue("deadline_before_opening", "error", "Final deadline is before the applications-open date."));
  }
  if (intake.priorityDeadline && intake.finalDeadline && intake.finalDeadline < intake.priorityDeadline) {
    issues.push(issue("final_deadline_before_priority", "error", "Final deadline is before the priority deadline."));
  }

  if (intake.intakeStatus === "upcoming" && intake.startYear !== null) {
    const startDate = new Date(Date.UTC(intake.startYear, (intake.startMonth ?? 1) - 1, 1));
    if (startDate.getTime() < now.getTime()) {
      issues.push(issue("upcoming_intake_in_past", "warning", "This intake is marked upcoming, but its start date is in the past."));
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Admission requirement checks
// ---------------------------------------------------------------------------

export interface AdmissionRequirementQualityInput {
  languageTest: string | null;
  languageTestMinScore: number | null;
}

/** Reasonable score ranges per well-known test, generous enough to cover any officially documented scale; a score outside all of these is flagged. */
const LANGUAGE_TEST_SCORE_RANGES: Record<string, { min: number; max: number }> = {
  ielts: { min: 0, max: 9 },
  toefl: { min: 0, max: 120 },
  pte: { min: 10, max: 90 },
  duolingo: { min: 10, max: 160 },
};

export function checkAdmissionRequirementDataQuality(req: AdmissionRequirementQualityInput): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];
  if (req.languageTest && req.languageTestMinScore !== null) {
    const key = req.languageTest.trim().toLowerCase();
    const range = LANGUAGE_TEST_SCORE_RANGES[key];
    if (range && (req.languageTestMinScore < range.min || req.languageTestMinScore > range.max)) {
      issues.push(
        issue(
          "invalid_language_test_score_range",
          "error",
          `${req.languageTest} minimum score ${req.languageTestMinScore} is outside the valid ${range.min}-${range.max} range.`,
        ),
      );
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Cross-record checks: duplicate slugs
// ---------------------------------------------------------------------------

export interface SlugCheckInput {
  id: string;
  slug: string;
}

/** Returns the IDs of records whose slug collides with another record's slug in the same set — used both for the admin dashboard's "duplicate slug" count and for CSV import validation (case-insensitive, since Postgres unique indexes here are case-sensitive but two visually-identical slugs differing only in case are still a real-world duplicate worth flagging). */
export function findDuplicateSlugs(records: SlugCheckInput[]): Map<string, string[]> {
  const bySlug = new Map<string, string[]>();
  for (const record of records) {
    const key = record.slug.trim().toLowerCase();
    if (!key) continue;
    const existing = bySlug.get(key) ?? [];
    existing.push(record.id);
    bySlug.set(key, existing);
  }
  const duplicates = new Map<string, string[]>();
  for (const [slug, ids] of bySlug) {
    if (ids.length > 1) duplicates.set(slug, ids);
  }
  return duplicates;
}
