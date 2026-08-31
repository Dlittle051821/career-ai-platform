/**
 * Milestone 9 — domain types for the Global University and Course Data
 * Platform. Mirrors the convention established in src/types/admin.ts and
 * src/types/payments.ts: these are the camelCase app-level shapes; the
 * snake_case <-> camelCase mapping lives only in
 * src/lib/supabase/admin/education-*.ts / src/lib/supabase/education/*.ts
 * (see those files' docblocks).
 *
 * `University` and `Course` here EXTEND src/types/admin.ts's base
 * `University`/`Course` shapes (same underlying table, same row — see
 * supabase/migrations/0006_global_university_course_data.sql PART 2/PART 4)
 * rather than duplicating them. Existing M7 admin code that only knows the
 * base shape keeps working unchanged; only code that needs the new M9
 * fields imports from this file.
 */

import type { Course as BaseCourse, University as BaseUniversity } from "./admin";

// ---------------------------------------------------------------------------
// Shared status enums
// ---------------------------------------------------------------------------

/** Draft/review/publish/archive workflow shared by every M9 content table. */
export const EDUCATION_PUBLICATION_STATUSES = ["draft", "in_review", "published", "archived"] as const;
export type EducationPublicationStatus = (typeof EDUCATION_PUBLICATION_STATUSES)[number];

export const EDUCATION_PUBLICATION_STATUS_LABELS: Record<EducationPublicationStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  published: "Published",
  archived: "Archived",
};

/** Only a `content_editor` may create/edit content while it stays in one of these two statuses — see 0006's RLS `with check` clauses. */
export const CONTENT_EDITOR_WRITABLE_STATUSES: EducationPublicationStatus[] = ["draft", "in_review"];

export const EDUCATION_VERIFICATION_STATUSES = ["unverified", "needs_review", "verified"] as const;
export type EducationVerificationStatus = (typeof EDUCATION_VERIFICATION_STATUSES)[number];

export const EDUCATION_VERIFICATION_STATUS_LABELS: Record<EducationVerificationStatus, string> = {
  unverified: "Unverified",
  needs_review: "Needs review",
  verified: "Verified",
};

/** Freshness bands computed from last_verified_at — see src/lib/education/data-quality.ts. Never a stored column. */
export const EDUCATION_FRESHNESS_BANDS = ["current", "review_soon", "stale", "unknown"] as const;
export type EducationFreshnessBand = (typeof EDUCATION_FRESHNESS_BANDS)[number];

export const EDUCATION_FRESHNESS_BAND_LABELS: Record<EducationFreshnessBand, string> = {
  current: "Current",
  review_soon: "Review soon",
  stale: "Stale",
  unknown: "Unknown",
};

// ---------------------------------------------------------------------------
// Countries
// ---------------------------------------------------------------------------

export interface Country {
  id: string;
  isoAlpha2: string;
  isoAlpha3: string;
  name: string;
  region: string | null;
  subregion: string | null;
  currencyCode: string | null;
  defaultLanguage: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Universities (extends src/types/admin.ts's base University)
// ---------------------------------------------------------------------------

export const UNIVERSITY_OWNERSHIP_TYPES = ["public", "private", "other"] as const;
export type UniversityOwnershipType = (typeof UNIVERSITY_OWNERSHIP_TYPES)[number];

export interface UniversityRankingEntry {
  provider: string;
  year: number;
  rank: string;
  rankType?: string | null;
}

export interface University extends BaseUniversity {
  countryId: string | null;
  countryName: string | null;
  stateRegion: string | null;
  streetAddress: string | null;
  postalCode: string | null;
  admissionsUrl: string | null;
  internationalAdmissionsUrl: string | null;
  ownershipType: UniversityOwnershipType | null;
  foundingYear: number | null;
  accreditationOrganization: string | null;
  ranking: UniversityRankingEntry[];
  studyLevels: string[];
  studyModes: string[];
  campusInfo: string | null;
  logoUrl: string | null;
  internationalStudentSupport: string | null;
  scholarshipsAvailable: boolean | null;
  applicationFeeMinorUnits: number | null;
  applicationFeeCurrency: string | null;
  publicationStatus: EducationPublicationStatus;
  dataSource: string | null;
  sourceUrl: string | null;
  sourceAccessDate: string | null;
  lastVerifiedAt: string | null;
  verificationStatus: EducationVerificationStatus;
  mergedIntoId: string | null;
}

// ---------------------------------------------------------------------------
// Campuses
// ---------------------------------------------------------------------------

export interface Campus {
  id: string;
  universityId: string;
  universityName: string | null;
  name: string;
  countryId: string | null;
  countryName: string | null;
  stateRegion: string | null;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  isMain: boolean;
  isActive: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Courses (extends src/types/admin.ts's base Course)
// ---------------------------------------------------------------------------

export const COURSE_DURATION_UNITS = ["years", "months", "weeks"] as const;
export type CourseDurationUnit = (typeof COURSE_DURATION_UNITS)[number];

export const COURSE_STUDY_PACES = ["full_time", "part_time", "full_time_or_part_time"] as const;
export type CourseStudyPace = (typeof COURSE_STUDY_PACES)[number];

export const COURSE_TUITION_CATEGORIES = ["domestic", "international", "not_distinguished"] as const;
export type CourseTuitionCategory = (typeof COURSE_TUITION_CATEGORIES)[number];

/** Shape stored in courses.english_requirements — keys are optional; only populated from an officially documented source. */
export interface EnglishRequirementScore {
  overall?: number | null;
  minComponent?: number | null;
}
export interface EnglishRequirements {
  ielts?: EnglishRequirementScore | null;
  toefl?: EnglishRequirementScore | null;
  pte?: EnglishRequirementScore | null;
  duolingo?: EnglishRequirementScore | null;
}

/** Shape stored in courses.standardized_test_requirements. */
export interface StandardizedTestRequirement {
  required?: boolean | null;
  minScore?: number | null;
}
export interface StandardizedTestRequirements {
  gre?: StandardizedTestRequirement | null;
  gmat?: StandardizedTestRequirement | null;
}

export interface Course extends BaseCourse {
  campusId: string | null;
  campusName: string | null;
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
  englishRequirements: EnglishRequirements | null;
  standardizedTestRequirements: StandardizedTestRequirements | null;
  workExperienceRequired: string | null;
  portfolioRequired: boolean | null;
  interviewRequired: boolean | null;
  studyGapPolicy: string | null;
  additionalDocumentsRequired: string[];
  scholarshipsAvailable: boolean | null;
  careerOutcomes: string | null;
  professionalAccreditation: string | null;
  publicationStatus: EducationPublicationStatus;
  dataSource: string | null;
  sourceUrl: string | null;
  lastVerifiedAt: string | null;
  verificationStatus: EducationVerificationStatus;
  mergedIntoId: string | null;
}

// ---------------------------------------------------------------------------
// Course intakes
// ---------------------------------------------------------------------------

export const COURSE_INTAKE_CAPACITY_STATUSES = ["open", "limited", "waitlist", "closed", "unknown"] as const;
export type CourseIntakeCapacityStatus = (typeof COURSE_INTAKE_CAPACITY_STATUSES)[number];

export const COURSE_INTAKE_STATUSES = ["upcoming", "open", "closed", "cancelled"] as const;
export type CourseIntakeStatus = (typeof COURSE_INTAKE_STATUSES)[number];

export interface CourseIntake {
  id: string;
  courseId: string;
  intakeName: string;
  startMonth: number | null;
  startYear: number | null;
  applicationsOpenAt: string | null;
  priorityDeadline: string | null;
  finalDeadline: string | null;
  internationalDeadline: string | null;
  capacityStatus: CourseIntakeCapacityStatus;
  intakeStatus: CourseIntakeStatus;
  dataSource: string | null;
  sourceUrl: string | null;
  lastVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Tuition and fees
// ---------------------------------------------------------------------------

export const TUITION_STUDENT_CATEGORIES = ["domestic", "international", "eu", "other"] as const;
export type TuitionStudentCategory = (typeof TUITION_STUDENT_CATEGORIES)[number];

export const TUITION_BILLING_PERIODS = ["per_year", "per_semester", "per_program", "per_credit", "per_module"] as const;
export type TuitionBillingPeriod = (typeof TUITION_BILLING_PERIODS)[number];

export const LIVING_COSTS_PERIODS = ["per_year", "per_month"] as const;
export type LivingCostsPeriod = (typeof LIVING_COSTS_PERIODS)[number];

/**
 * `currencyCode` always preserves the institution's own original currency —
 * see 0006's table comment. NEVER convert or compare these across records
 * as though equivalent (spec requirement) — see src/lib/education/currency.ts.
 */
export interface CourseTuitionFee {
  id: string;
  courseId: string;
  studentCategory: TuitionStudentCategory;
  amountMinorUnits: number;
  currencyCode: string;
  academicYear: string;
  billingPeriod: TuitionBillingPeriod | null;
  mandatoryFeesMinorUnits: number;
  estimatedLivingCostsMinorUnits: number | null;
  estimatedLivingCostsPeriod: LivingCostsPeriod | null;
  dataSource: string | null;
  sourceUrl: string | null;
  lastVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Admission requirements
// ---------------------------------------------------------------------------

export interface CourseAdmissionRequirement {
  id: string;
  courseId: string;
  countryContextId: string | null;
  countryContextName: string | null;
  acceptedQualification: string;
  minimumGrade: string | null;
  minimumGpa: number | null;
  requiredSubjects: string[];
  languageTest: string | null;
  languageTestMinScore: number | null;
  standardizedTest: string | null;
  standardizedTestMinScore: number | null;
  workExperienceRequired: string | null;
  portfolioRequired: boolean;
  interviewRequired: boolean;
  additionalDocuments: string[];
  dataSource: string | null;
  sourceUrl: string | null;
  lastVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Scholarships
// ---------------------------------------------------------------------------

export const SCHOLARSHIP_SCOPES = ["university", "course"] as const;
export type ScholarshipScope = (typeof SCHOLARSHIP_SCOPES)[number];

export interface Scholarship {
  id: string;
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
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Data provenance
// ---------------------------------------------------------------------------

export const PROVENANCE_ENTITY_TYPES = [
  "university",
  "campus",
  "course",
  "course_intake",
  "course_tuition_fee",
  "course_admission_requirement",
  "scholarship",
] as const;
export type ProvenanceEntityType = (typeof PROVENANCE_ENTITY_TYPES)[number];

export const PROVENANCE_SOURCE_TYPES = [
  "official_university",
  "government",
  "licensed_provider",
  "manual_admin_entry",
  "csv_import",
  "other",
] as const;
export type ProvenanceSourceType = (typeof PROVENANCE_SOURCE_TYPES)[number];

export const DATA_QUALITY_STATUSES = ["current", "review_soon", "stale", "unknown"] as const;
export type DataQualityStatus = (typeof DATA_QUALITY_STATUSES)[number];

export interface EducationDataProvenance {
  id: string;
  entityType: ProvenanceEntityType;
  entityId: string;
  sourceProvider: string | null;
  sourceType: ProvenanceSourceType;
  sourceUrl: string | null;
  sourceRecordId: string | null;
  retrievedAt: string | null;
  lastVerifiedAt: string | null;
  importBatchId: string | null;
  rawRecordChecksum: string | null;
  verificationStatus: EducationVerificationStatus;
  dataQualityStatus: DataQualityStatus;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Import batches / rows
// ---------------------------------------------------------------------------

/** Note: plural entity names here, distinct from ProvenanceEntityType's singular names — one import batch can produce many provenance rows of the corresponding singular type. */
export const IMPORT_ENTITY_TYPES = [
  "universities",
  "campuses",
  "courses",
  "course_intakes",
  "course_tuition_fees",
  "course_admission_requirements",
  "scholarships",
] as const;
export type ImportEntityType = (typeof IMPORT_ENTITY_TYPES)[number];

export const IMPORT_BATCH_STATUSES = [
  "uploaded",
  "validating",
  "validated",
  "importing",
  "completed",
  "completed_with_errors",
  "failed",
  "cancelled",
] as const;
export type ImportBatchStatus = (typeof IMPORT_BATCH_STATUSES)[number];

export const IMPORT_BATCH_STATUS_LABELS: Record<ImportBatchStatus, string> = {
  uploaded: "Uploaded",
  validating: "Validating",
  validated: "Validated",
  importing: "Importing",
  completed: "Completed",
  completed_with_errors: "Completed with errors",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const IMPORT_DUPLICATE_STRATEGIES = ["skip", "update", "review"] as const;
export type ImportDuplicateStrategy = (typeof IMPORT_DUPLICATE_STRATEGIES)[number];

export interface EducationImportBatch {
  id: string;
  entityType: ImportEntityType;
  fileName: string | null;
  fileSizeBytes: number | null;
  status: ImportBatchStatus;
  totalRecords: number;
  successfulRecords: number;
  rejectedRecords: number;
  warningCount: number;
  dryRun: boolean;
  duplicateStrategy: ImportDuplicateStrategy;
  startedAt: string | null;
  completedAt: string | null;
  initiatedBy: string | null;
  initiatedByName: string | null;
  rawFileChecksum: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export const IMPORT_ROW_STATUSES = ["pending", "valid", "warning", "error", "imported", "skipped", "duplicate"] as const;
export type ImportRowStatus = (typeof IMPORT_ROW_STATUSES)[number];

export interface ImportRowIssue {
  field?: string | null;
  message: string;
}

export interface EducationImportRow {
  id: string;
  importBatchId: string;
  rowNumber: number;
  rawData: Record<string, unknown>;
  status: ImportRowStatus;
  errors: ImportRowIssue[];
  warnings: ImportRowIssue[];
  duplicateOfEntityId: string | null;
  resultingEntityId: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Duplicate candidates
// ---------------------------------------------------------------------------

export const DUPLICATE_ENTITY_TYPES = ["university", "course"] as const;
export type DuplicateEntityType = (typeof DUPLICATE_ENTITY_TYPES)[number];

export const DUPLICATE_CANDIDATE_STATUSES = ["pending", "confirmed_duplicate", "rejected", "merged"] as const;
export type DuplicateCandidateStatus = (typeof DUPLICATE_CANDIDATE_STATUSES)[number];

export interface DuplicateMatchSignal {
  field: string;
  primaryValue: string | null;
  candidateValue: string | null;
  weight: number;
}

export interface EducationDuplicateCandidate {
  id: string;
  entityType: DuplicateEntityType;
  primaryEntityId: string;
  primaryEntityName: string | null;
  candidateEntityId: string;
  candidateEntityName: string | null;
  matchScore: number;
  matchSignals: DuplicateMatchSignal[];
  status: DuplicateCandidateStatus;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Student-facing: saved items, intake interests, course shares
// ---------------------------------------------------------------------------

export const SAVED_ITEM_ENTITY_TYPES = ["university", "course"] as const;
export type SavedItemEntityType = (typeof SAVED_ITEM_ENTITY_TYPES)[number];

export interface EducationSavedItem {
  id: string;
  studentUserId: string;
  entityType: SavedItemEntityType;
  entityId: string;
  createdAt: string;
}

export interface EducationIntakeInterest {
  id: string;
  studentUserId: string;
  courseIntakeId: string;
  createdAt: string;
}

export interface EducationCourseShare {
  id: string;
  studentUserId: string;
  courseId: string;
  counsellorId: string | null;
  message: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Shared list-page shape (mirrors src/types/admin.ts's AdminListResult / src/types/payments.ts's PaymentsListResult)
// ---------------------------------------------------------------------------

export interface EducationListResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Public search/filter shapes (src/app/(site)/universities, /courses)
// ---------------------------------------------------------------------------

export interface UniversitySearchFilters {
  q?: string;
  countryIds?: string[];
  city?: string;
  studyModes?: string[];
  page?: number;
  pageSize?: number;
}

export interface CourseSearchFilters {
  q?: string;
  countryIds?: string[];
  universityId?: string;
  subjectAreas?: string[];
  qualificationLevels?: string[];
  studyModes?: string[];
  teachingLanguages?: string[];
  currency?: string;
  minTuitionMinorUnits?: number;
  maxTuitionMinorUnits?: number;
  durationUnit?: CourseDurationUnit;
  intakePeriod?: string;
  scholarshipsAvailable?: boolean;
  minIeltsOverall?: number;
  page?: number;
  pageSize?: number;
}
