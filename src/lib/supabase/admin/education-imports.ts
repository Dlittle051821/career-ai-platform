import "server-only";
import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { recordAuditLog } from "./audit";
import { AdminValidationError } from "@/lib/admin/form-state";
import { clampPageSize, pageToRange, parsePageParam } from "@/lib/admin/pagination";
import { CsvSizeLimitError, csvRowsToRecords, recordsToCsv, sanitizeCsvCellForFormulaInjection } from "@/lib/education/csv";
import { localCsvAdapter } from "@/lib/education/source-providers";
import { isValidAlpha2, isValidCurrencyCodeFormat, isValidSlug, normalizeSlug } from "@/lib/education/normalize";
import type { AdminListResult } from "@/types/admin";
import type {
  EducationImportBatch,
  EducationImportRow,
  ImportDuplicateStrategy,
  ImportEntityType,
  ImportRowIssue,
  ImportRowStatus,
} from "@/types/education";
import { IMPORT_DUPLICATE_STRATEGIES, IMPORT_ENTITY_TYPES } from "@/types/education";

/**
 * Milestone 9 — CSV import pipeline (new tables; see
 * supabase/migrations/0006_global_university_course_data.sql PARTS
 * 10-11). Two explicit steps, matching the spec's required workflow
 * (upload -> map -> preview -> validate without writing -> show
 * row/column errors+warnings -> detect duplicates -> confirm -> server-side
 * controlled processing -> results):
 *
 *  1. `validateImportBatch` parses the CSV, validates and normalizes every
 *     row, detects duplicates against existing DB records, and stores the
 *     per-row results — but NEVER writes to universities/courses/etc. This
 *     is always safe to call repeatedly and is what the admin "preview"
 *     screen reads from.
 *  2. `commitImportBatch` is a SEPARATE, explicit admin action (requires
 *     the batch to already be `validated` and an explicit `confirm=yes`
 *     field — spec: "require explicit confirmation ... for
 *     destructive/upsert operations") that actually creates/updates
 *     records for the rows that passed validation, honoring the batch's
 *     `duplicateStrategy` (skip / update / review) for any row whose
 *     business key matched an existing record.
 *
 * Row processing is NOT one all-or-nothing DB transaction: each row is
 * validated independently and, on commit, written independently, with its
 * own status recorded in `education_import_rows`. This is deliberate, not
 * a shortcut — the spec's own workflow expects partial success (a results
 * screen with a downloadable CSV of just the rejected rows), so a
 * chunk-at-a-time, per-row-isolated commit is the correct semantics here,
 * not a single big transaction that would make "download the rows that
 * failed" meaningless.
 *
 * Every written row also gets an `education_data_provenance` row
 * (source_type='csv_import', import_batch_id set) — the spec's "traceable
 * provenance for every imported entity" requirement.
 *
 * This module intentionally does NOT fetch anything from the network —
 * spec: "do not implement unlicensed web scraping" / "do not add fake API
 * integrations". The only source-provider adapter here is the local CSV
 * upload itself; see src/lib/education/source-providers/ for the adapter
 * interface this fits into.
 */

function logDbError(context: string, error: unknown) {
  console.error(`[admin/education-imports] ${context}:`, error);
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// ---------------------------------------------------------------------------
// Mapping / row types
// ---------------------------------------------------------------------------

interface BatchRow {
  id: string;
  entity_type: string;
  file_name: string | null;
  file_size_bytes: number | null;
  status: string;
  total_records: number;
  successful_records: number;
  rejected_records: number;
  warning_count: number;
  dry_run: boolean;
  duplicate_strategy: string;
  started_at: string | null;
  completed_at: string | null;
  initiated_by: string | null;
  raw_file_checksum: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function toImportBatch(row: BatchRow, initiatedByName: string | null): EducationImportBatch {
  return {
    id: row.id,
    entityType: row.entity_type as ImportEntityType,
    fileName: row.file_name,
    fileSizeBytes: row.file_size_bytes,
    status: row.status as EducationImportBatch["status"],
    totalRecords: row.total_records,
    successfulRecords: row.successful_records,
    rejectedRecords: row.rejected_records,
    warningCount: row.warning_count,
    dryRun: row.dry_run,
    duplicateStrategy: row.duplicate_strategy as ImportDuplicateStrategy,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    initiatedBy: row.initiated_by,
    initiatedByName,
    rawFileChecksum: row.raw_file_checksum,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface ImportRowRow {
  id: string;
  import_batch_id: string;
  row_number: number;
  raw_data: Record<string, unknown>;
  status: string;
  errors: ImportRowIssue[];
  warnings: ImportRowIssue[];
  duplicate_of_entity_id: string | null;
  resulting_entity_id: string | null;
  created_at: string;
}

function toImportRow(row: ImportRowRow): EducationImportRow {
  return {
    id: row.id,
    importBatchId: row.import_batch_id,
    rowNumber: row.row_number,
    rawData: row.raw_data,
    status: row.status as ImportRowStatus,
    errors: Array.isArray(row.errors) ? row.errors : [],
    warnings: Array.isArray(row.warnings) ? row.warnings : [],
    duplicateOfEntityId: row.duplicate_of_entity_id,
    resultingEntityId: row.resulting_entity_id,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Required columns per entity type — used for header-level validation so a
// wrong/incomplete template is rejected up front with one clear message
// rather than 200 identical per-row "missing field" errors.
// ---------------------------------------------------------------------------

const REQUIRED_COLUMNS: Record<ImportEntityType, string[]> = {
  universities: ["name", "slug", "country_iso_alpha2"],
  campuses: ["university_slug", "name"],
  courses: ["university_slug", "name", "slug"],
  course_intakes: ["university_slug", "course_slug", "intake_name"],
  course_tuition_fees: ["university_slug", "course_slug", "student_category", "amount", "currency_code", "academic_year"],
  course_admission_requirements: ["university_slug", "course_slug", "accepted_qualification"],
  scholarships: ["scope", "name"],
};

// ---------------------------------------------------------------------------
// Shared cell parsing helpers (plain strings in, typed values + issues out —
// no FormData here, unlike the single-record admin forms in the sibling
// education-*.ts files)
// ---------------------------------------------------------------------------

function err(field: string, message: string): ImportRowIssue {
  return { field, message };
}

function optionalText(record: Record<string, string>, key: string): string | null {
  const raw = (record[key] ?? "").trim();
  return raw || null;
}

function parseListCell(record: Record<string, string>, key: string): string[] {
  const raw = (record[key] ?? "").trim();
  if (!raw) return [];
  return raw.split(/[,;]/).map((v) => v.trim()).filter(Boolean);
}

function parseBooleanCell(record: Record<string, string>, key: string): boolean | null {
  const raw = (record[key] ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (["true", "yes", "1", "y"].includes(raw)) return true;
  if (["false", "no", "0", "n"].includes(raw)) return false;
  return null;
}

function parseAmountToMinor(record: Record<string, string>, key: string, issues: ImportRowIssue[]): number | null {
  const raw = (record[key] ?? "").trim();
  if (!raw) return null;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    issues.push(err(key, `"${raw}" is not a valid non-negative amount.`));
    return null;
  }
  return Math.round(parsed * 100);
}

function parseIntCell(record: Record<string, string>, key: string, issues: ImportRowIssue[], min?: number, max?: number): number | null {
  const raw = (record[key] ?? "").trim();
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || (min !== undefined && parsed < min) || (max !== undefined && parsed > max)) {
    issues.push(err(key, `"${raw}" is not a valid whole number${min !== undefined && max !== undefined ? ` between ${min} and ${max}` : ""}.`));
    return null;
  }
  return parsed;
}

function parseDateCell(record: Record<string, string>, key: string, issues: ImportRowIssue[]): string | null {
  const raw = (record[key] ?? "").trim();
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    issues.push(err(key, `"${raw}" is not a valid date (expected YYYY-MM-DD).`));
    return null;
  }
  return raw;
}

function parseUrlCell(record: Record<string, string>, key: string, issues: ImportRowIssue[]): string | null {
  const raw = (record[key] ?? "").trim();
  if (!raw) return null;
  try {
    new URL(raw);
  } catch {
    issues.push(err(key, `"${raw}" is not a valid URL.`));
    return null;
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Lookup context — resolved once per batch, reused for every row
// ---------------------------------------------------------------------------

interface ImportContext {
  countryIdByIso: Map<string, string>;
  universityBySlug: Map<string, { id: string; name: string }>;
  campusByUniversityAndName: Map<string, string>; // key: `${universityId}:${lowercased name}`
  courseByUniversityAndSlug: Map<string, string>; // key: `${universityId}:${slug}`
}

async function buildImportContext(supabase: SupabaseClient, entityType: ImportEntityType): Promise<ImportContext> {
  const ctx: ImportContext = {
    countryIdByIso: new Map(),
    universityBySlug: new Map(),
    campusByUniversityAndName: new Map(),
    courseByUniversityAndSlug: new Map(),
  };

  const needsCountry = entityType === "universities" || entityType === "campuses" || entityType === "course_admission_requirements";
  const needsUniversity = entityType !== "universities";
  const needsCampus = entityType === "courses";
  const needsCourse = entityType === "course_intakes" || entityType === "course_tuition_fees" || entityType === "course_admission_requirements" || entityType === "scholarships";

  if (needsCountry) {
    const { data } = await supabase.from("countries").select("id, iso_alpha2");
    for (const c of data ?? []) ctx.countryIdByIso.set(c.iso_alpha2.toUpperCase(), c.id);
  }
  if (needsUniversity) {
    const { data } = await supabase.from("universities").select("id, name, slug").eq("is_active", true).is("merged_into_id", null);
    for (const u of data ?? []) ctx.universityBySlug.set(u.slug.toLowerCase(), { id: u.id, name: u.name });
  }
  if (needsCampus) {
    const { data } = await supabase.from("campuses").select("id, name, university_id");
    for (const c of data ?? []) ctx.campusByUniversityAndName.set(`${c.university_id}:${c.name.toLowerCase()}`, c.id);
  }
  if (needsCourse) {
    const { data } = await supabase.from("courses").select("id, slug, university_id").is("merged_into_id", null);
    for (const c of data ?? []) ctx.courseByUniversityAndSlug.set(`${c.university_id}:${c.slug.toLowerCase()}`, c.id);
  }

  return ctx;
}

function resolveUniversity(record: Record<string, string>, ctx: ImportContext, issues: ImportRowIssue[]): { id: string; name: string } | null {
  const slugRaw = (record.university_slug ?? "").trim().toLowerCase();
  if (!slugRaw) {
    issues.push(err("university_slug", "A university_slug is required to link this row to an existing university."));
    return null;
  }
  const found = ctx.universityBySlug.get(slugRaw);
  if (!found) {
    issues.push(err("university_slug", `No active university found with slug "${slugRaw}". Import universities first, or check the spelling.`));
    return null;
  }
  return found;
}

function resolveCourse(record: Record<string, string>, ctx: ImportContext, universityId: string, issues: ImportRowIssue[]): string | null {
  const slugRaw = (record.course_slug ?? "").trim().toLowerCase();
  if (!slugRaw) {
    issues.push(err("course_slug", "A course_slug is required to link this row to an existing course."));
    return null;
  }
  const found = ctx.courseByUniversityAndSlug.get(`${universityId}:${slugRaw}`);
  if (!found) {
    issues.push(err("course_slug", `No course found with slug "${slugRaw}" under this university. Import courses first, or check the spelling.`));
    return null;
  }
  return found;
}

/** Literal union of the tables the import pipeline can write to — kept narrow (rather than plain `string`) so `.from(result.table)` still resolves through the hand-written Supabase client types in src/types/database.ts, which (unlike the officially generated client) don't accept an arbitrary string table name. */
type EntityTableName = "universities" | "campuses" | "courses" | "course_intakes" | "course_tuition_fees" | "course_admission_requirements" | "scholarships";

interface RowValidationResult {
  errors: ImportRowIssue[];
  warnings: ImportRowIssue[];
  /** snake_case DB column values ready for insert/update, or null if the row has errors. */
  writeFields: Record<string, unknown> | null;
  table: EntityTableName;
  /** A stable string identifying "the same real-world record" for this row, used for duplicate detection against existing DB rows within this batch. Null when no matching applies (should not normally happen for a valid row). */
  businessKey: string | null;
}

function validateUniversityRow(record: Record<string, string>, ctx: ImportContext): RowValidationResult {
  const errors: ImportRowIssue[] = [];
  const warnings: ImportRowIssue[] = [];

  const name = (record.name ?? "").trim();
  if (!name) errors.push(err("name", "Name is required."));

  let slug = (record.slug ?? "").trim();
  if (!slug && name) slug = normalizeSlug(name);
  if (!isValidSlug(slug)) errors.push(err("slug", `"${slug}" is not a valid slug (lowercase letters, numbers, hyphens).`));

  const isoRaw = (record.country_iso_alpha2 ?? "").trim().toUpperCase();
  if (!isValidAlpha2(isoRaw)) {
    errors.push(err("country_iso_alpha2", `"${isoRaw}" is not a valid 2-letter country code.`));
  }
  const countryId = ctx.countryIdByIso.get(isoRaw) ?? null;
  if (isoRaw && isValidAlpha2(isoRaw) && !countryId) {
    errors.push(err("country_iso_alpha2", `"${isoRaw}" is not a country this platform currently has configured.`));
  }

  const applicationFeeCurrency = optionalText(record, "application_fee_currency")?.toUpperCase() ?? null;
  if (applicationFeeCurrency && !isValidCurrencyCodeFormat(applicationFeeCurrency)) {
    errors.push(err("application_fee_currency", `"${applicationFeeCurrency}" is not a valid ISO 4217 currency code.`));
  }
  const applicationFeeMinorUnits = parseAmountToMinor(record, "application_fee_amount", errors);

  const websiteUrl = parseUrlCell(record, "website", warnings);
  const sourceUrl = parseUrlCell(record, "source_url", warnings);
  if (!sourceUrl) warnings.push(err("source_url", "No source URL provided — this record will be flagged for review."));
  const sourceAccessDate = parseDateCell(record, "source_access_date", warnings);
  const lastVerifiedAt = parseDateCell(record, "last_verified_at", warnings);
  const foundingYear = parseIntCell(record, "founding_year", warnings, 1000, 2100);

  if (errors.length > 0) {
    return { errors, warnings, writeFields: null, table: "universities", businessKey: null };
  }

  return {
    errors,
    warnings,
    table: "universities",
    businessKey: `slug:${slug.toLowerCase()}`,
    writeFields: {
      name,
      slug,
      country_id: countryId,
      country: isoRaw,
      city: optionalText(record, "city"),
      state_region: optionalText(record, "state_region"),
      street_address: optionalText(record, "street_address"),
      postal_code: optionalText(record, "postal_code"),
      website: websiteUrl,
      admissions_url: parseUrlCell(record, "admissions_url", warnings),
      international_admissions_url: parseUrlCell(record, "international_admissions_url", warnings),
      institution_type: optionalText(record, "institution_type"),
      ownership_type: optionalText(record, "ownership_type"),
      founding_year: foundingYear,
      accreditation_organization: optionalText(record, "accreditation_organization"),
      study_levels: parseListCell(record, "study_levels"),
      study_modes: parseListCell(record, "study_modes"),
      summary: optionalText(record, "summary"),
      scholarships_available: parseBooleanCell(record, "scholarships_available"),
      application_fee_minor_units: applicationFeeMinorUnits,
      application_fee_currency: applicationFeeCurrency,
      data_source: optionalText(record, "data_source"),
      source_url: sourceUrl,
      source_access_date: sourceAccessDate,
      last_verified_at: lastVerifiedAt,
      verification_status: ["unverified", "needs_review", "verified"].includes((record.verification_status ?? "").trim())
        ? record.verification_status.trim()
        : "needs_review",
      publication_status: "draft",
    },
  };
}

function validateCampusRow(record: Record<string, string>, ctx: ImportContext): RowValidationResult {
  const errors: ImportRowIssue[] = [];
  const warnings: ImportRowIssue[] = [];

  const university = resolveUniversity(record, ctx, errors);
  const name = (record.name ?? "").trim();
  if (!name) errors.push(err("name", "Campus name is required."));

  const isoRaw = optionalText(record, "country_iso_alpha2")?.toUpperCase() ?? null;
  let countryId: string | null = null;
  if (isoRaw) {
    if (!isValidAlpha2(isoRaw)) {
      errors.push(err("country_iso_alpha2", `"${isoRaw}" is not a valid 2-letter country code.`));
    } else {
      countryId = ctx.countryIdByIso.get(isoRaw) ?? null;
      if (!countryId) errors.push(err("country_iso_alpha2", `"${isoRaw}" is not a country this platform currently has configured.`));
    }
  }

  const latRaw = optionalText(record, "latitude");
  const latitude = latRaw ? Number.parseFloat(latRaw) : null;
  if (latRaw && (!Number.isFinite(latitude) || (latitude as number) < -90 || (latitude as number) > 90)) errors.push(err("latitude", `"${latRaw}" is not a valid latitude.`));
  const lngRaw = optionalText(record, "longitude");
  const longitude = lngRaw ? Number.parseFloat(lngRaw) : null;
  if (lngRaw && (!Number.isFinite(longitude) || (longitude as number) < -180 || (longitude as number) > 180)) errors.push(err("longitude", `"${lngRaw}" is not a valid longitude.`));

  if (errors.length > 0 || !university) {
    return { errors, warnings, writeFields: null, table: "campuses", businessKey: null };
  }

  return {
    errors,
    warnings,
    table: "campuses",
    businessKey: `university:${university.id}:name:${name.toLowerCase()}`,
    writeFields: {
      university_id: university.id,
      name,
      country_id: countryId,
      state_region: optionalText(record, "state_region"),
      city: optionalText(record, "city"),
      address: optionalText(record, "address"),
      latitude,
      longitude,
      is_main: parseBooleanCell(record, "is_main") ?? false,
      is_active: true,
    },
  };
}

function validateCourseRow(record: Record<string, string>, ctx: ImportContext): RowValidationResult {
  const errors: ImportRowIssue[] = [];
  const warnings: ImportRowIssue[] = [];

  const university = resolveUniversity(record, ctx, errors);
  const name = (record.name ?? "").trim();
  if (!name) errors.push(err("name", "Course name is required."));
  let slug = (record.slug ?? "").trim();
  if (!slug && name) slug = normalizeSlug(name);
  if (!isValidSlug(slug)) errors.push(err("slug", `"${slug}" is not a valid slug.`));

  let campusId: string | null = null;
  const campusName = optionalText(record, "campus_name");
  if (campusName && university) {
    campusId = ctx.campusByUniversityAndName.get(`${university.id}:${campusName.toLowerCase()}`) ?? null;
    if (!campusId) warnings.push(err("campus_name", `No campus named "${campusName}" found for this university — leaving campus unset.`));
  }

  const applicationFeeCurrency = optionalText(record, "application_fee_currency")?.toUpperCase() ?? null;
  if (applicationFeeCurrency && !isValidCurrencyCodeFormat(applicationFeeCurrency)) {
    errors.push(err("application_fee_currency", `"${applicationFeeCurrency}" is not a valid ISO 4217 currency code.`));
  }
  const applicationFeeMinorUnits = parseAmountToMinor(record, "application_fee_amount", errors);
  const durationValueRaw = optionalText(record, "duration_value");
  const durationValue = durationValueRaw ? Number.parseFloat(durationValueRaw) : null;
  if (durationValueRaw && (!Number.isFinite(durationValue) || (durationValue as number) < 0)) errors.push(err("duration_value", `"${durationValueRaw}" is not a valid duration.`));

  const sourceUrl = parseUrlCell(record, "source_url", warnings);
  if (!sourceUrl) warnings.push(err("source_url", "No source URL provided — this record will be flagged for review."));
  const lastVerifiedAt = parseDateCell(record, "last_verified_at", warnings);

  if (errors.length > 0 || !university) {
    return { errors, warnings, writeFields: null, table: "courses", businessKey: null };
  }

  return {
    errors,
    warnings,
    table: "courses",
    businessKey: `university:${university.id}:slug:${slug.toLowerCase()}`,
    writeFields: {
      university_id: university.id,
      campus_id: campusId,
      name,
      slug,
      program_code: optionalText(record, "program_code"),
      subject_area: optionalText(record, "subject_area"),
      discipline: optionalText(record, "discipline"),
      education_level: optionalText(record, "qualification_level"),
      qualification_title: optionalText(record, "qualification_title"),
      award: optionalText(record, "award"),
      duration_value: durationValue,
      duration_unit: optionalText(record, "duration_unit"),
      study_pace: optionalText(record, "study_pace"),
      delivery_mode: optionalText(record, "delivery_mode"),
      teaching_language: optionalText(record, "teaching_language"),
      tuition_domestic_or_international: optionalText(record, "tuition_domestic_or_international"),
      application_fee_minor_units: applicationFeeMinorUnits,
      application_fee_currency: applicationFeeCurrency,
      application_url: parseUrlCell(record, "application_url", warnings),
      course_url: parseUrlCell(record, "course_url", warnings),
      intake_periods: parseListCell(record, "intake_periods"),
      min_academic_requirement: optionalText(record, "min_academic_requirement"),
      career_outcomes: optionalText(record, "career_outcomes"),
      professional_accreditation: optionalText(record, "professional_accreditation"),
      data_source: optionalText(record, "data_source"),
      source_url: sourceUrl,
      last_verified_at: lastVerifiedAt,
      verification_status: ["unverified", "needs_review", "verified"].includes((record.verification_status ?? "").trim())
        ? record.verification_status.trim()
        : "needs_review",
      publication_status: "draft",
    },
  };
}

function validateCourseIntakeRow(record: Record<string, string>, ctx: ImportContext): RowValidationResult {
  const errors: ImportRowIssue[] = [];
  const warnings: ImportRowIssue[] = [];

  const university = resolveUniversity(record, ctx, errors);
  const courseId = university ? resolveCourse(record, ctx, university.id, errors) : null;
  const intakeName = (record.intake_name ?? "").trim();
  if (!intakeName) errors.push(err("intake_name", "Intake name is required."));

  const startMonth = parseIntCell(record, "start_month", errors, 1, 12);
  const startYear = parseIntCell(record, "start_year", errors, 1900, 2200);
  const applicationsOpenAt = parseDateCell(record, "applications_open_at", errors);
  const priorityDeadline = parseDateCell(record, "priority_deadline", errors);
  const finalDeadline = parseDateCell(record, "final_deadline", errors);
  const internationalDeadline = parseDateCell(record, "international_deadline", errors);

  if (applicationsOpenAt && priorityDeadline && priorityDeadline < applicationsOpenAt) errors.push(err("priority_deadline", "Priority deadline is before the applications-open date."));
  if (applicationsOpenAt && finalDeadline && finalDeadline < applicationsOpenAt) errors.push(err("final_deadline", "Final deadline is before the applications-open date."));
  if (priorityDeadline && finalDeadline && finalDeadline < priorityDeadline) errors.push(err("final_deadline", "Final deadline is before the priority deadline."));

  const capacityStatusRaw = (record.capacity_status ?? "unknown").trim();
  const capacityStatus = ["available", "limited", "waitlist", "closed", "unknown"].includes(capacityStatusRaw) ? capacityStatusRaw : "unknown";
  const intakeStatusRaw = (record.intake_status ?? "upcoming").trim();
  const intakeStatus = ["upcoming", "open", "closed", "cancelled"].includes(intakeStatusRaw) ? intakeStatusRaw : "upcoming";

  const sourceUrl = parseUrlCell(record, "source_url", warnings);
  const lastVerifiedAt = parseDateCell(record, "last_verified_at", warnings);

  if (errors.length > 0 || !courseId) {
    return { errors, warnings, writeFields: null, table: "course_intakes", businessKey: null };
  }

  return {
    errors,
    warnings,
    table: "course_intakes",
    businessKey: `course:${courseId}:intake:${intakeName.toLowerCase()}`,
    writeFields: {
      course_id: courseId,
      intake_name: intakeName,
      start_month: startMonth,
      start_year: startYear,
      applications_open_at: applicationsOpenAt,
      priority_deadline: priorityDeadline,
      final_deadline: finalDeadline,
      international_deadline: internationalDeadline,
      capacity_status: capacityStatus,
      intake_status: intakeStatus,
      data_source: optionalText(record, "data_source"),
      source_url: sourceUrl,
      last_verified_at: lastVerifiedAt,
    },
  };
}

function validateTuitionFeeRow(record: Record<string, string>, ctx: ImportContext): RowValidationResult {
  const errors: ImportRowIssue[] = [];
  const warnings: ImportRowIssue[] = [];

  const university = resolveUniversity(record, ctx, errors);
  const courseId = university ? resolveCourse(record, ctx, university.id, errors) : null;

  const studentCategoryRaw = (record.student_category ?? "").trim();
  if (!["domestic", "international", "eu", "other"].includes(studentCategoryRaw)) {
    errors.push(err("student_category", `"${studentCategoryRaw}" must be one of: domestic, international, eu, other.`));
  }

  const currencyCode = (record.currency_code ?? "").trim().toUpperCase();
  if (!isValidCurrencyCodeFormat(currencyCode)) {
    errors.push(err("currency_code", `"${currencyCode}" is not a valid ISO 4217 currency code — the institution's own original currency, never converted.`));
  }
  const academicYear = (record.academic_year ?? "").trim();
  if (!academicYear) errors.push(err("academic_year", "Academic year is required."));

  const amountMinorUnits = parseAmountToMinor(record, "amount", errors);
  if (amountMinorUnits === null && !errors.some((e) => e.field === "amount")) errors.push(err("amount", "Tuition amount is required."));
  const mandatoryFeesMinorUnits = parseAmountToMinor(record, "mandatory_fees_amount", warnings) ?? 0;
  const livingCostsMinorUnits = parseAmountToMinor(record, "estimated_living_costs_amount", warnings);

  const billingPeriodRaw = optionalText(record, "billing_period");
  const billingPeriod = billingPeriodRaw && ["per_year", "per_semester", "per_program", "per_credit"].includes(billingPeriodRaw) ? billingPeriodRaw : null;
  const livingCostsPeriodRaw = optionalText(record, "estimated_living_costs_period");
  const livingCostsPeriod = livingCostsPeriodRaw && ["per_month", "per_year"].includes(livingCostsPeriodRaw) ? livingCostsPeriodRaw : null;

  const sourceUrl = parseUrlCell(record, "source_url", warnings);
  const lastVerifiedAt = parseDateCell(record, "last_verified_at", warnings);

  if (errors.length > 0 || !courseId) {
    return { errors, warnings, writeFields: null, table: "course_tuition_fees", businessKey: null };
  }

  return {
    errors,
    warnings,
    table: "course_tuition_fees",
    businessKey: `course:${courseId}:category:${studentCategoryRaw}:year:${academicYear.toLowerCase()}`,
    writeFields: {
      course_id: courseId,
      student_category: studentCategoryRaw,
      amount_minor_units: amountMinorUnits,
      currency_code: currencyCode,
      academic_year: academicYear,
      billing_period: billingPeriod,
      mandatory_fees_minor_units: mandatoryFeesMinorUnits,
      estimated_living_costs_minor_units: livingCostsMinorUnits,
      estimated_living_costs_period: livingCostsPeriod,
      data_source: optionalText(record, "data_source"),
      source_url: sourceUrl,
      last_verified_at: lastVerifiedAt,
    },
  };
}

function validateAdmissionRequirementRow(record: Record<string, string>, ctx: ImportContext): RowValidationResult {
  const errors: ImportRowIssue[] = [];
  const warnings: ImportRowIssue[] = [];

  const university = resolveUniversity(record, ctx, errors);
  const courseId = university ? resolveCourse(record, ctx, university.id, errors) : null;

  const acceptedQualification = (record.accepted_qualification ?? "").trim();
  if (!acceptedQualification) errors.push(err("accepted_qualification", "Accepted qualification is required."));

  let countryContextId: string | null = null;
  const isoRaw = optionalText(record, "country_context_iso_alpha2")?.toUpperCase() ?? null;
  if (isoRaw) {
    if (!isValidAlpha2(isoRaw)) errors.push(err("country_context_iso_alpha2", `"${isoRaw}" is not a valid 2-letter country code.`));
    else {
      countryContextId = ctx.countryIdByIso.get(isoRaw) ?? null;
      if (!countryContextId) errors.push(err("country_context_iso_alpha2", `"${isoRaw}" is not a country this platform currently has configured.`));
    }
  }

  const minimumGpaRaw = optionalText(record, "minimum_gpa");
  const minimumGpa = minimumGpaRaw ? Number.parseFloat(minimumGpaRaw) : null;
  if (minimumGpaRaw && (!Number.isFinite(minimumGpa) || (minimumGpa as number) < 0 || (minimumGpa as number) > 100)) errors.push(err("minimum_gpa", `"${minimumGpaRaw}" must be between 0 and 100.`));

  const languageTestMinScoreRaw = optionalText(record, "language_test_min_score");
  const languageTestMinScore = languageTestMinScoreRaw ? Number.parseFloat(languageTestMinScoreRaw) : null;
  if (languageTestMinScoreRaw && (!Number.isFinite(languageTestMinScore) || (languageTestMinScore as number) < 0)) errors.push(err("language_test_min_score", `"${languageTestMinScoreRaw}" is not a valid score.`));

  const standardizedTestMinScoreRaw = optionalText(record, "standardized_test_min_score");
  const standardizedTestMinScore = standardizedTestMinScoreRaw ? Number.parseFloat(standardizedTestMinScoreRaw) : null;
  if (standardizedTestMinScoreRaw && (!Number.isFinite(standardizedTestMinScore) || (standardizedTestMinScore as number) < 0)) errors.push(err("standardized_test_min_score", `"${standardizedTestMinScoreRaw}" is not a valid score.`));

  const sourceUrl = parseUrlCell(record, "source_url", warnings);
  const lastVerifiedAt = parseDateCell(record, "last_verified_at", warnings);

  if (errors.length > 0 || !courseId) {
    return { errors, warnings, writeFields: null, table: "course_admission_requirements", businessKey: null };
  }

  return {
    errors,
    warnings,
    table: "course_admission_requirements",
    businessKey: `course:${courseId}:country:${countryContextId ?? "none"}:qualification:${acceptedQualification.toLowerCase()}`,
    writeFields: {
      course_id: courseId,
      country_context_id: countryContextId,
      accepted_qualification: acceptedQualification,
      minimum_grade: optionalText(record, "minimum_grade"),
      minimum_gpa: minimumGpa,
      required_subjects: parseListCell(record, "required_subjects"),
      language_test: optionalText(record, "language_test"),
      language_test_min_score: languageTestMinScore,
      standardized_test: optionalText(record, "standardized_test"),
      standardized_test_min_score: standardizedTestMinScore,
      work_experience_required: optionalText(record, "work_experience_required"),
      portfolio_required: parseBooleanCell(record, "portfolio_required") ?? false,
      interview_required: parseBooleanCell(record, "interview_required") ?? false,
      additional_documents: parseListCell(record, "additional_documents"),
      data_source: optionalText(record, "data_source"),
      source_url: sourceUrl,
      last_verified_at: lastVerifiedAt,
    },
  };
}

function validateScholarshipRow(record: Record<string, string>, ctx: ImportContext): RowValidationResult {
  const errors: ImportRowIssue[] = [];
  const warnings: ImportRowIssue[] = [];

  const scope = (record.scope ?? "").trim();
  if (!["university", "course"].includes(scope)) errors.push(err("scope", `"${scope}" must be either "university" or "course".`));

  const name = (record.name ?? "").trim();
  if (!name) errors.push(err("name", "Scholarship name is required."));

  let universityId: string | null = null;
  let courseId: string | null = null;
  if (scope === "university") {
    const university = resolveUniversity(record, ctx, errors);
    universityId = university?.id ?? null;
  } else if (scope === "course") {
    const university = resolveUniversity(record, ctx, errors);
    courseId = university ? resolveCourse(record, ctx, university.id, errors) : null;
  }

  const currencyCode = optionalText(record, "award_currency")?.toUpperCase() ?? null;
  if (currencyCode && !isValidCurrencyCodeFormat(currencyCode)) {
    errors.push(err("award_currency", `"${currencyCode}" is not a valid ISO 4217 currency code.`));
  }
  const awardAmountMinorUnits = parseAmountToMinor(record, "award_amount", errors);
  if (awardAmountMinorUnits !== null && !currencyCode) errors.push(err("award_currency", "A currency code is required whenever an award amount is provided."));

  const deadline = parseDateCell(record, "deadline", warnings);
  const sourceUrl = parseUrlCell(record, "source_url", warnings);
  const lastVerifiedAt = parseDateCell(record, "last_verified_at", warnings);

  const targetId = scope === "university" ? universityId : courseId;
  if (errors.length > 0 || !targetId) {
    return { errors, warnings, writeFields: null, table: "scholarships", businessKey: null };
  }

  return {
    errors,
    warnings,
    table: "scholarships",
    businessKey: `scope:${scope}:target:${targetId}:name:${name.toLowerCase()}`,
    writeFields: {
      scope,
      university_id: universityId,
      course_id: courseId,
      name,
      eligibility: optionalText(record, "eligibility"),
      award_amount_minor_units: awardAmountMinorUnits,
      award_description: optionalText(record, "award_description"),
      currency_code: currencyCode,
      deadline,
      scholarship_url: parseUrlCell(record, "scholarship_url", warnings),
      international_eligible: parseBooleanCell(record, "international_eligible"),
      is_active: true,
      data_source: optionalText(record, "data_source"),
      source_url: sourceUrl,
      last_verified_at: lastVerifiedAt,
    },
  };
}

const VALIDATORS: Record<ImportEntityType, (record: Record<string, string>, ctx: ImportContext) => RowValidationResult> = {
  universities: validateUniversityRow,
  campuses: validateCampusRow,
  courses: validateCourseRow,
  course_intakes: validateCourseIntakeRow,
  course_tuition_fees: validateTuitionFeeRow,
  course_admission_requirements: validateAdmissionRequirementRow,
  scholarships: validateScholarshipRow,
};

/** Every ImportEntityType string IS the backing table name — kept as an explicit map (rather than relying on that coincidence inline) so the relationship is documented and type-checked in one place. */
const IMPORT_ENTITY_TABLE: Record<ImportEntityType, EntityTableName> = {
  universities: "universities",
  campuses: "campuses",
  courses: "courses",
  course_intakes: "course_intakes",
  course_tuition_fees: "course_tuition_fees",
  course_admission_requirements: "course_admission_requirements",
  scholarships: "scholarships",
};

/** Plural ImportEntityType -> singular ProvenanceEntityType (see src/types/education.ts) — a naive "strip trailing s" would mangle "universities" -> "universitie", so this is spelled out explicitly. */
const IMPORT_ENTITY_TO_PROVENANCE_ENTITY: Record<ImportEntityType, string> = {
  universities: "university",
  campuses: "campus",
  courses: "course",
  course_intakes: "course_intake",
  course_tuition_fees: "course_tuition_fee",
  course_admission_requirements: "course_admission_requirement",
  scholarships: "scholarship",
};

/**
 * Insert/update a row on one of the seven import-target tables, given a
 * plain snake_case field object built by the matching validateXRow
 * function above. Switches on the literal table name rather than calling
 * `.from(table)` with `table` typed as the EntityTableName union: the
 * hand-written Supabase client types in src/types/database.ts resolve a
 * union table name to the INTERSECTION of each table's Insert/Update shape
 * (only fields common to all seven survive typing, everything else
 * becomes `never`) — the same limitation worked around with an explicit
 * per-table branch in education-duplicates.ts's mergeDuplicateCandidates.
 * The `as unknown as` cast on each branch is safe here because every
 * validateXRow function above already builds `writeFields` to match that
 * exact table's required columns (mirroring how the hand-written
 * `Insert` type is NOT `Partial` — every column must be supplied, the
 * same quirk documented in src/lib/supabase/admin/universities.ts).
 */
async function insertEntityRow(supabase: SupabaseClient, table: EntityTableName, writeFields: Record<string, unknown>): Promise<{ id: string } | { errorMessage: string }> {
  let result;
  switch (table) {
    case "universities":
      result = await supabase.from("universities").insert(writeFields as never).select("id").single();
      break;
    case "campuses":
      result = await supabase.from("campuses").insert(writeFields as never).select("id").single();
      break;
    case "courses":
      result = await supabase.from("courses").insert(writeFields as never).select("id").single();
      break;
    case "course_intakes":
      result = await supabase.from("course_intakes").insert(writeFields as never).select("id").single();
      break;
    case "course_tuition_fees":
      result = await supabase.from("course_tuition_fees").insert(writeFields as never).select("id").single();
      break;
    case "course_admission_requirements":
      result = await supabase.from("course_admission_requirements").insert(writeFields as never).select("id").single();
      break;
    case "scholarships":
      result = await supabase.from("scholarships").insert(writeFields as never).select("id").single();
      break;
  }
  if (result.error || !result.data) return { errorMessage: result.error?.message ?? "Insert failed." };
  return { id: (result.data as { id: string }).id };
}

async function updateEntityRow(supabase: SupabaseClient, table: EntityTableName, id: string, writeFields: Record<string, unknown>): Promise<{ errorMessage: string } | null> {
  let error;
  switch (table) {
    case "universities":
      ({ error } = await supabase.from("universities").update(writeFields as never).eq("id", id));
      break;
    case "campuses":
      ({ error } = await supabase.from("campuses").update(writeFields as never).eq("id", id));
      break;
    case "courses":
      ({ error } = await supabase.from("courses").update(writeFields as never).eq("id", id));
      break;
    case "course_intakes":
      ({ error } = await supabase.from("course_intakes").update(writeFields as never).eq("id", id));
      break;
    case "course_tuition_fees":
      ({ error } = await supabase.from("course_tuition_fees").update(writeFields as never).eq("id", id));
      break;
    case "course_admission_requirements":
      ({ error } = await supabase.from("course_admission_requirements").update(writeFields as never).eq("id", id));
      break;
    case "scholarships":
      ({ error } = await supabase.from("scholarships").update(writeFields as never).eq("id", id));
      break;
  }
  return error ? { errorMessage: error.message } : null;
}

/** Business-key lookup used at commit time to decide skip/update/create — separate from the pairwise fuzzy scan in education-duplicates.ts, since CSV import duplicate detection is a plain exact match on each entity type's natural key (see each validator's `businessKey`). */
async function fetchExistingKeys(supabase: SupabaseClient, table: string): Promise<Map<string, string>> {
  const byTable: Record<string, () => Promise<{ key: string; id: string }[]>> = {
    universities: async () => {
      const { data } = await supabase.from("universities").select("id, slug").is("merged_into_id", null);
      return (data ?? []).map((r) => ({ key: `slug:${r.slug.toLowerCase()}`, id: r.id }));
    },
    campuses: async () => {
      const { data } = await supabase.from("campuses").select("id, name, university_id");
      return (data ?? []).map((r) => ({ key: `university:${r.university_id}:name:${r.name.toLowerCase()}`, id: r.id }));
    },
    courses: async () => {
      const { data } = await supabase.from("courses").select("id, slug, university_id").is("merged_into_id", null);
      return (data ?? []).map((r) => ({ key: `university:${r.university_id}:slug:${r.slug.toLowerCase()}`, id: r.id }));
    },
    course_intakes: async () => {
      const { data } = await supabase.from("course_intakes").select("id, intake_name, course_id");
      return (data ?? []).map((r) => ({ key: `course:${r.course_id}:intake:${r.intake_name.toLowerCase()}`, id: r.id }));
    },
    course_tuition_fees: async () => {
      const { data } = await supabase.from("course_tuition_fees").select("id, student_category, academic_year, course_id");
      return (data ?? []).map((r) => ({ key: `course:${r.course_id}:category:${r.student_category}:year:${r.academic_year.toLowerCase()}`, id: r.id }));
    },
    course_admission_requirements: async () => {
      const { data } = await supabase.from("course_admission_requirements").select("id, accepted_qualification, country_context_id, course_id");
      return (data ?? []).map((r) => ({ key: `course:${r.course_id}:country:${r.country_context_id ?? "none"}:qualification:${r.accepted_qualification.toLowerCase()}`, id: r.id }));
    },
    scholarships: async () => {
      const { data } = await supabase.from("scholarships").select("id, scope, name, university_id, course_id");
      return (data ?? []).map((r) => ({ key: `scope:${r.scope}:target:${r.scope === "university" ? r.university_id : r.course_id}:name:${r.name.toLowerCase()}`, id: r.id }));
    },
  };
  const rows = await byTable[table]();
  return new Map(rows.map((r) => [r.key, r.id]));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ImportBatchFilters {
  entityType?: ImportEntityType;
  status?: string;
  page?: number;
  pageSize?: number;
}

export async function listImportBatches(filters: ImportBatchFilters = {}): Promise<AdminListResult<EducationImportBatch>> {
  await requireAdminPermission("education-imports:read");
  const supabase = await createClient();
  const page = parsePageParam(filters.page ? String(filters.page) : undefined);
  const pageSize = clampPageSize(filters.pageSize);
  const { from, to } = pageToRange(page, pageSize);

  let query = supabase.from("education_import_batches").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
  if (filters.entityType) query = query.eq("entity_type", filters.entityType);
  if (filters.status) query = query.eq("status", filters.status);

  const { data, error, count } = await query;
  if (error) {
    logDbError("listImportBatches", error);
    return { items: [], total: 0, page, pageSize };
  }
  return { items: (data ?? []).map((r) => toImportBatch(r as BatchRow, null)), total: count ?? 0, page, pageSize };
}

export async function getImportBatchById(id: string): Promise<EducationImportBatch | null> {
  await requireAdminPermission("education-imports:read");
  const supabase = await createClient();
  const { data, error } = await supabase.from("education_import_batches").select("*").eq("id", id).maybeSingle();
  if (error) {
    logDbError("getImportBatchById", error);
    return null;
  }
  return data ? toImportBatch(data as BatchRow, null) : null;
}

export async function listImportRowsForBatch(batchId: string, statusFilter?: ImportRowStatus): Promise<EducationImportRow[]> {
  await requireAdminPermission("education-imports:read");
  const supabase = await createClient();
  let query = supabase.from("education_import_rows").select("*").eq("import_batch_id", batchId).order("row_number", { ascending: true });
  if (statusFilter) query = query.eq("status", statusFilter);
  const { data, error } = await query;
  if (error) {
    logDbError("listImportRowsForBatch", error);
    return [];
  }
  return (data ?? []).map((r) => toImportRow(r as unknown as ImportRowRow));
}

/** Downloads the rejected (status='error') rows of a batch as CSV, including their error messages, for offline correction. */
export async function exportRejectedRowsCsv(batchId: string): Promise<string> {
  const rows = await listImportRowsForBatch(batchId, "error");
  if (rows.length === 0) return "row_number,errors\r\n";
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r.rawData))));
  const allHeaders = ["row_number", "errors", ...headers];
  const records = rows.map((r) => ({
    row_number: String(r.rowNumber),
    errors: r.errors.map((e) => (e.field ? `${e.field}: ${e.message}` : e.message)).join(" | "),
    ...Object.fromEntries(headers.map((h) => [h, String(r.rawData[h] ?? "")])),
  }));
  return recordsToCsv(allHeaders, records);
}

/**
 * Step 1: parse + validate a CSV upload without writing anything. Always
 * creates a new batch row. `duplicateStrategy` is recorded on the batch now
 * so the preview screen can show what WOULD happen to each duplicate row at
 * commit time, even though nothing is written yet.
 */
export async function validateImportBatch(params: {
  entityType: ImportEntityType;
  fileName: string;
  csvText: string;
  duplicateStrategy: ImportDuplicateStrategy;
}): Promise<{ batchId: string }> {
  const admin = await requireAdminPermission("education-imports:write");

  if (!(IMPORT_ENTITY_TYPES as readonly string[]).includes(params.entityType)) {
    throw new AdminValidationError("Unrecognized import entity type.");
  }
  if (!(IMPORT_DUPLICATE_STRATEGIES as readonly string[]).includes(params.duplicateStrategy)) {
    throw new AdminValidationError("Duplicate strategy must be one of: skip, update, review.");
  }

  const supabase = await createClient();
  const fileSizeBytes = Buffer.byteLength(params.csvText, "utf8");

  const { data: batchInsert, error: batchInsertError } = await supabase
    .from("education_import_batches")
    .insert({
      entity_type: params.entityType,
      file_name: params.fileName || null,
      file_size_bytes: fileSizeBytes,
      status: "validating",
      total_records: 0,
      successful_records: 0,
      rejected_records: 0,
      warning_count: 0,
      dry_run: true,
      duplicate_strategy: params.duplicateStrategy,
      started_at: new Date().toISOString(),
      completed_at: null,
      initiated_by: admin.userId,
      raw_file_checksum: null,
      notes: null,
    })
    .select("id")
    .single();
  if (batchInsertError) {
    logDbError("validateImportBatch:createBatch", batchInsertError);
    throw new Error(batchInsertError.message);
  }
  const batchId = batchInsert.id as string;

  let parsed;
  try {
    // Routed through the source-provider adapter interface (currently only
    // localCsvAdapter — see src/lib/education/source-providers/) rather
    // than calling parseCsv directly, so a future non-CSV provider can be
    // added without touching this function.
    parsed = localCsvAdapter.fetchRawRecords(params.csvText);
  } catch (e) {
    const message = e instanceof CsvSizeLimitError ? e.message : "The file could not be parsed as CSV.";
    await supabase.from("education_import_batches").update({ status: "failed", notes: message, completed_at: new Date().toISOString() }).eq("id", batchId);
    throw new AdminValidationError(message);
  }

  const missingRequired = REQUIRED_COLUMNS[params.entityType].filter((col) => !parsed.headers.includes(col));
  if (missingRequired.length > 0) {
    const message = `The file is missing required column(s): ${missingRequired.join(", ")}. See docs/import-templates/ for the expected format.`;
    await supabase.from("education_import_batches").update({ status: "failed", notes: message, completed_at: new Date().toISOString() }).eq("id", batchId);
    throw new AdminValidationError(message);
  }

  const records = csvRowsToRecords(parsed.headers, parsed.rows);
  const ctx = await buildImportContext(supabase, params.entityType);
  const validator = VALIDATORS[params.entityType];
  const existingKeys = await fetchExistingKeys(supabase, IMPORT_ENTITY_TABLE[params.entityType]);

  let successfulCount = 0;
  let rejectedCount = 0;
  let warningCount = 0;
  const rowsToInsert: Array<{
    import_batch_id: string;
    row_number: number;
    raw_data: Record<string, string>;
    status: string;
    errors: ImportRowIssue[];
    warnings: ImportRowIssue[];
    duplicate_of_entity_id: string | null;
    resulting_entity_id: string | null;
  }> = [];

  records.forEach((record, idx) => {
    const rowNumber = idx + 2; // header is row 1
    const result = validator(record, ctx);
    const sanitizedRawData = Object.fromEntries(Object.entries(record).map(([k, v]) => [k, sanitizeCsvCellForFormulaInjection(v)]));

    let status: ImportRowStatus;
    let duplicateOfEntityId: string | null = null;
    if (result.errors.length > 0) {
      status = "error";
      rejectedCount++;
    } else {
      const existingId = result.businessKey ? existingKeys.get(result.businessKey) ?? null : null;
      if (existingId) {
        duplicateOfEntityId = existingId;
        status = params.duplicateStrategy === "review" ? "duplicate" : "valid";
      } else {
        status = result.warnings.length > 0 ? "warning" : "valid";
      }
      successfulCount++;
      if (result.warnings.length > 0) warningCount++;
    }

    rowsToInsert.push({
      import_batch_id: batchId,
      row_number: rowNumber,
      raw_data: sanitizedRawData,
      status,
      errors: result.errors,
      warnings: result.warnings,
      duplicate_of_entity_id: duplicateOfEntityId,
      resulting_entity_id: null,
    });
  });

  // Insert rows in chunks to avoid one oversized request for a large file.
  // `raw_data`/`errors`/`warnings` are typed `Json` on the DB row but
  // ImportRowIssue[]/Record<string,string> here — cast through `unknown`
  // rather than widen the shared types to `Json` everywhere they're used.
  const CHUNK_SIZE = 500;
  for (let i = 0; i < rowsToInsert.length; i += CHUNK_SIZE) {
    const chunk = rowsToInsert.slice(i, i + CHUNK_SIZE);
    const { error: rowsError } = await supabase.from("education_import_rows").insert(chunk as unknown as never);
    if (rowsError) {
      logDbError("validateImportBatch:insertRows", rowsError);
      await supabase.from("education_import_batches").update({ status: "failed", notes: rowsError.message, completed_at: new Date().toISOString() }).eq("id", batchId);
      throw new Error(rowsError.message);
    }
  }

  const { error: updateError } = await supabase
    .from("education_import_batches")
    .update({
      status: "validated",
      total_records: records.length,
      successful_records: successfulCount,
      rejected_records: rejectedCount,
      warning_count: warningCount,
    })
    .eq("id", batchId);
  if (updateError) {
    logDbError("validateImportBatch:finalizeBatch", updateError);
    throw new Error(updateError.message);
  }

  await recordAuditLog({
    action: "Validated",
    entityType: "education_import_batch",
    entityId: batchId,
    entityLabel: `${params.entityType} import "${params.fileName}"`,
    after: { entityType: params.entityType, totalRecords: records.length, successfulCount, rejectedCount, warningCount },
  });

  return { batchId };
}

/**
 * Step 2: applies a previously-validated batch. Requires the batch to be
 * `validated` and `confirm === true` (spec: destructive/upsert operations
 * need explicit confirmation). Rows still in 'error' status are always
 * skipped; rows in 'duplicate' status (duplicateStrategy === 'review') are
 * left for a human to resolve manually and are never written here.
 */
export async function commitImportBatch(batchId: string, confirm: boolean): Promise<{ successfulRecords: number; rejectedRecords: number }> {
  const admin = await requireAdminPermission("education-imports:write");
  if (!confirm) throw new AdminValidationError("You must explicitly confirm before an import is applied to the live database.");

  const supabase = await createClient();
  const { data: batchData, error: batchError } = await supabase.from("education_import_batches").select("*").eq("id", batchId).maybeSingle();
  if (batchError || !batchData) {
    logDbError("commitImportBatch:loadBatch", batchError);
    throw new AdminValidationError("Import batch not found.");
  }
  const batch = batchData as BatchRow;
  if (batch.status !== "validated") {
    throw new AdminValidationError(`This batch is "${batch.status}" — only a "validated" batch can be committed.`);
  }

  await supabase.from("education_import_batches").update({ status: "importing" }).eq("id", batchId);

  const entityType = batch.entity_type as ImportEntityType;
  const table = IMPORT_ENTITY_TABLE[entityType];
  const ctx = await buildImportContext(supabase, entityType);
  const validator = VALIDATORS[entityType];

  const { data: rowsData, error: rowsError } = await supabase
    .from("education_import_rows")
    .select("*")
    .eq("import_batch_id", batchId)
    .in("status", ["valid", "warning"])
    .order("row_number", { ascending: true });
  if (rowsError) {
    logDbError("commitImportBatch:loadRows", rowsError);
    throw new Error(rowsError.message);
  }
  const rows = (rowsData ?? []) as unknown as ImportRowRow[];

  let successfulRecords = 0;
  let rejectedRecords = 0;
  // Fetched once and kept in sync as rows are written, rather than
  // re-querying every row — a row created earlier in this same batch (e.g.
  // a course) must be visible to a later row's duplicate check (e.g. that
  // course's tuition fee) without a round trip per row.
  const existingKeys = await fetchExistingKeys(supabase, table);

  for (const row of rows) {
    const rawRecord = Object.fromEntries(Object.entries(row.raw_data).map(([k, v]) => [k, String(v ?? "")]));
    const result = validator(rawRecord, ctx);
    if (result.errors.length > 0 || !result.writeFields) {
      await supabase.from("education_import_rows").update({ status: "error", errors: [...row.errors, err("_row", "Re-validation at commit time failed — the underlying data may have changed since preview. Re-run validation.")] } as never).eq("id", row.id);
      rejectedRecords++;
      continue;
    }

    const existingId = result.businessKey ? existingKeys.get(result.businessKey) ?? null : null;

    try {
      let resultingEntityId: string;
      let rowStatus: ImportRowStatus;
      if (existingId && batch.duplicate_strategy === "skip") {
        await supabase.from("education_import_rows").update({ status: "skipped", duplicate_of_entity_id: existingId }).eq("id", row.id);
        continue;
      } else if (existingId && batch.duplicate_strategy === "update") {
        const updateResult = await updateEntityRow(supabase, result.table, existingId, result.writeFields);
        if (updateResult) throw new Error(updateResult.errorMessage);
        resultingEntityId = existingId;
        rowStatus = "imported";
      } else {
        const insertResult = await insertEntityRow(supabase, result.table, result.writeFields);
        if ("errorMessage" in insertResult) throw new Error(insertResult.errorMessage);
        resultingEntityId = insertResult.id;
        rowStatus = "imported";
      }
      if (result.businessKey) existingKeys.set(result.businessKey, resultingEntityId);

      await supabase.from("education_import_rows").update({ status: rowStatus, resulting_entity_id: resultingEntityId }).eq("id", row.id);

      const provenanceEntityType = IMPORT_ENTITY_TO_PROVENANCE_ENTITY[entityType];
      await supabase.from("education_data_provenance").upsert(
        {
          entity_type: provenanceEntityType,
          entity_id: resultingEntityId,
          source_provider: null,
          source_type: "csv_import",
          source_url: (result.writeFields.source_url as string | undefined) ?? null,
          source_record_id: null,
          retrieved_at: new Date().toISOString().slice(0, 10),
          last_verified_at: (result.writeFields.last_verified_at as string | undefined) ?? null,
          import_batch_id: batchId,
          raw_record_checksum: null,
          verification_status: (result.writeFields.verification_status as string | undefined) ?? "needs_review",
          data_quality_status: "unknown",
        } as never,
        { onConflict: "entity_type,entity_id" },
      );

      successfulRecords++;
    } catch (writeError) {
      logDbError("commitImportBatch:writeRow", writeError);
      await supabase.from("education_import_rows").update({ status: "error", errors: [err("_row", writeError instanceof Error ? writeError.message : "This row failed to write.")] } as never).eq("id", row.id);
      rejectedRecords++;
    }
  }

  const finalStatus = rejectedRecords > 0 ? "completed_with_errors" : "completed";
  await supabase
    .from("education_import_batches")
    .update({
      status: finalStatus,
      dry_run: false,
      successful_records: successfulRecords,
      rejected_records: batch.rejected_records + rejectedRecords,
      completed_at: new Date().toISOString(),
    })
    .eq("id", batchId);

  await recordAuditLog({
    action: "Imported",
    entityType: "education_import_batch",
    entityId: batchId,
    entityLabel: `${entityType} import committed by ${admin.userId}`,
    after: { successfulRecords, rejectedRecords, duplicateStrategy: batch.duplicate_strategy },
  });

  return { successfulRecords, rejectedRecords };
}
