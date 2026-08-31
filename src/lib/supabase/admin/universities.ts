import "server-only";
import { createClient } from "../server";
import { requireAdmin, requireAdminPermission } from "../admin-auth";
import { recordAuditLog } from "./audit";
import { AdminValidationError } from "@/lib/admin/form-state";
import { cleanFilterParam, clampPageSize, pageToRange, parsePageParam } from "@/lib/admin/pagination";
import { isValidCurrencyCodeFormat, normalizeSlug } from "@/lib/education/normalize";
import type { AccreditationStatus, AdminListResult } from "@/types/admin";
import type {
  EducationPublicationStatus,
  EducationVerificationStatus,
  University,
  UniversityOwnershipType,
  UniversityRankingEntry,
} from "@/types/education";
import { CONTENT_EDITOR_WRITABLE_STATUSES, EDUCATION_PUBLICATION_STATUSES, EDUCATION_VERIFICATION_STATUSES } from "@/types/education";

/**
 * Milestone 7's University module, EXTENDED for Milestone 9 (never
 * duplicated — same `public.universities` table, same base columns; see
 * supabase/migrations/0006_global_university_course_data.sql PART 2 for the
 * new columns this file now also reads/writes). Mirrors
 * src/lib/supabase/careers.ts's snake_case <-> camelCase convention: the
 * mapper below is the ONE place that translation happens.
 *
 * RLS (not this file) is what actually stops a content_editor from
 * publishing a record — see 0006 PART 2's policies. This file's job is
 * just to shape the request; a content_editor calling `publishUniversity`
 * will get a clean RLS rejection from Postgres, mapped to a friendly
 * message by friendlyAdminError, exactly like any other write.
 */

function logDbError(context: string, error: unknown) {
  console.error(`[admin/universities] ${context}:`, error);
}

interface UniversityRow {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  city: string | null;
  website: string | null;
  institution_type: string | null;
  summary: string | null;
  accreditation_status: string;
  is_active: boolean;
  is_visible: boolean;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
  country_id: string | null;
  state_region: string | null;
  street_address: string | null;
  postal_code: string | null;
  admissions_url: string | null;
  international_admissions_url: string | null;
  ownership_type: string | null;
  founding_year: number | null;
  accreditation_organization: string | null;
  ranking: unknown;
  study_levels: string[] | null;
  study_modes: string[] | null;
  campus_info: string | null;
  logo_url: string | null;
  international_student_support: string | null;
  scholarships_available: boolean | null;
  application_fee_minor_units: number | null;
  application_fee_currency: string | null;
  publication_status: string;
  data_source: string | null;
  source_url: string | null;
  source_access_date: string | null;
  last_verified_at: string | null;
  verification_status: string;
  merged_into_id: string | null;
}

function toUniversity(row: UniversityRow, countryNameById: Map<string, string>): University {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    country: row.country,
    city: row.city,
    website: row.website,
    institutionType: row.institution_type,
    summary: row.summary,
    accreditationStatus: row.accreditation_status as AccreditationStatus,
    isActive: row.is_active,
    isVisible: row.is_visible,
    internalNotes: row.internal_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    countryId: row.country_id,
    countryName: row.country_id ? (countryNameById.get(row.country_id) ?? null) : null,
    stateRegion: row.state_region,
    streetAddress: row.street_address,
    postalCode: row.postal_code,
    admissionsUrl: row.admissions_url,
    internationalAdmissionsUrl: row.international_admissions_url,
    ownershipType: (row.ownership_type as UniversityOwnershipType | null) ?? null,
    foundingYear: row.founding_year,
    accreditationOrganization: row.accreditation_organization,
    ranking: Array.isArray(row.ranking) ? (row.ranking as UniversityRankingEntry[]) : [],
    studyLevels: row.study_levels ?? [],
    studyModes: row.study_modes ?? [],
    campusInfo: row.campus_info,
    logoUrl: row.logo_url,
    internationalStudentSupport: row.international_student_support,
    scholarshipsAvailable: row.scholarships_available,
    applicationFeeMinorUnits: row.application_fee_minor_units,
    applicationFeeCurrency: row.application_fee_currency,
    publicationStatus: row.publication_status as EducationPublicationStatus,
    dataSource: row.data_source,
    sourceUrl: row.source_url,
    sourceAccessDate: row.source_access_date,
    lastVerifiedAt: row.last_verified_at,
    verificationStatus: row.verification_status as EducationVerificationStatus,
    mergedIntoId: row.merged_into_id,
  };
}

async function buildCountryNameMap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  countryIds: (string | null)[],
): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(countryIds.filter((id): id is string => !!id)));
  if (uniqueIds.length === 0) return new Map();
  const { data, error } = await supabase.from("countries").select("id, name").in("id", uniqueIds);
  if (error) {
    logDbError("buildCountryNameMap", error);
    return new Map();
  }
  return new Map((data ?? []).map((c) => [c.id, c.name]));
}

export interface UniversityFilters {
  query?: string;
  isActive?: boolean;
  countryId?: string;
  publicationStatus?: EducationPublicationStatus;
  verificationStatus?: EducationVerificationStatus;
  page?: number;
}

const PAGE_SIZE = 20;

export async function listUniversities(filters: UniversityFilters = {}): Promise<AdminListResult<University>> {
  await requireAdminPermission("universities:read");
  const supabase = await createClient();
  const page = parsePageParam(String(filters.page ?? 1));
  const pageSize = clampPageSize(PAGE_SIZE);
  const { from, to } = pageToRange(page, pageSize);

  let query = supabase.from("universities").select("*", { count: "exact" }).order("name", { ascending: true });
  const cleanedQuery = cleanFilterParam(filters.query);
  if (cleanedQuery) {
    const term = cleanedQuery.replace(/[,()%]/g, "");
    query = query.or(`name.ilike.%${term}%,city.ilike.%${term}%,country.ilike.%${term}%`);
  }
  if (filters.isActive !== undefined) query = query.eq("is_active", filters.isActive);
  if (filters.countryId) query = query.eq("country_id", filters.countryId);
  if (filters.publicationStatus) query = query.eq("publication_status", filters.publicationStatus);
  if (filters.verificationStatus) query = query.eq("verification_status", filters.verificationStatus);

  const { data, error, count } = await query.range(from, to);
  if (error) {
    logDbError("listUniversities", error);
    return { items: [], total: 0, page, pageSize };
  }
  const rows = (data ?? []) as UniversityRow[];
  const countryNameById = await buildCountryNameMap(supabase, rows.map((r) => r.country_id));
  return { items: rows.map((r) => toUniversity(r, countryNameById)), total: count ?? 0, page, pageSize };
}

/** Unfiltered, unpaginated name+id list — used by pickers throughout the admin (Courses form, campuses, etc). Gated on `requireAdmin()`, same reasoning as Milestone 7's original version of this function. */
export async function listUniversityOptions(): Promise<{ id: string; name: string }[]> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("universities").select("id, name").order("name", { ascending: true });
  if (error) {
    logDbError("listUniversityOptions", error);
    return [];
  }
  return data ?? [];
}

export async function getUniversityById(id: string): Promise<University | null> {
  await requireAdminPermission("universities:read");
  const supabase = await createClient();
  const { data, error } = await supabase.from("universities").select("*").eq("id", id).maybeSingle();
  if (error) {
    logDbError("getUniversityById", error);
    return null;
  }
  if (!data) return null;
  const countryNameById = await buildCountryNameMap(supabase, [(data as UniversityRow).country_id]);
  return toUniversity(data as UniversityRow, countryNameById);
}

/** Public-facing lookup by slug — used by src/lib/supabase/education/universities.ts's public-page reads and by getUniversityById's admin callers that already have a slug. Not permission-gated (RLS is the boundary; anon/authenticated both have a published-active read policy). */
export async function getUniversityBySlugForAdmin(slug: string): Promise<University | null> {
  await requireAdminPermission("universities:read");
  const supabase = await createClient();
  const { data, error } = await supabase.from("universities").select("*").eq("slug", slug).maybeSingle();
  if (error) {
    logDbError("getUniversityBySlugForAdmin", error);
    return null;
  }
  if (!data) return null;
  const countryNameById = await buildCountryNameMap(supabase, [(data as UniversityRow).country_id]);
  return toUniversity(data as UniversityRow, countryNameById);
}

const ACCREDITATION_STATUSES: AccreditationStatus[] = ["unverified", "self_reported", "verified"];
const OWNERSHIP_TYPES: UniversityOwnershipType[] = ["public", "private", "other"];

interface UniversityInput {
  name: string;
  slug: string;
  country: string | null;
  city: string | null;
  website: string | null;
  institutionType: string | null;
  summary: string | null;
  accreditationStatus: AccreditationStatus;
  isActive: boolean;
  isVisible: boolean;
  internalNotes: string | null;
  countryId: string | null;
  stateRegion: string | null;
  streetAddress: string | null;
  postalCode: string | null;
  admissionsUrl: string | null;
  internationalAdmissionsUrl: string | null;
  ownershipType: UniversityOwnershipType | null;
  foundingYear: number | null;
  accreditationOrganization: string | null;
  studyLevels: string[];
  studyModes: string[];
  campusInfo: string | null;
  logoUrl: string | null;
  internationalStudentSupport: string | null;
  scholarshipsAvailable: boolean | null;
  applicationFeeMinorUnits: number | null;
  applicationFeeCurrency: string | null;
  dataSource: string | null;
  sourceUrl: string | null;
  lastVerifiedAt: string | null;
  verificationStatus: EducationVerificationStatus;
}

function parseUrlField(formData: FormData, key: string, label: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) throw new AdminValidationError(`${label} must start with http:// or https://.`);
  return value;
}

function parseListField(formData: FormData, key: string): string[] {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return [];
  return raw
    .split(/[,;]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function parseUniversityForm(formData: FormData): UniversityInput {
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  if (!name) throw new AdminValidationError("Name is required.");
  if (!slug || slug !== normalizeSlug(slug)) {
    throw new AdminValidationError("Slug must be lowercase letters, numbers, and single hyphens only (e.g. delhi-institute-of-technology).");
  }

  const website = parseUrlField(formData, "website", "Website");
  const admissionsUrl = parseUrlField(formData, "admissionsUrl", "Admissions URL");
  const internationalAdmissionsUrl = parseUrlField(formData, "internationalAdmissionsUrl", "International admissions URL");
  const sourceUrl = parseUrlField(formData, "sourceUrl", "Source URL");
  const logoUrl = parseUrlField(formData, "logoUrl", "Logo URL");

  const ownershipTypeRaw = String(formData.get("ownershipType") ?? "").trim();
  const ownershipType = OWNERSHIP_TYPES.includes(ownershipTypeRaw as UniversityOwnershipType) ? (ownershipTypeRaw as UniversityOwnershipType) : null;

  const foundingYearRaw = String(formData.get("foundingYear") ?? "").trim();
  let foundingYear: number | null = null;
  if (foundingYearRaw) {
    const parsed = Number.parseInt(foundingYearRaw, 10);
    if (!Number.isInteger(parsed) || parsed < 800 || parsed > 2100) {
      throw new AdminValidationError("Founding year must be a plausible year between 800 and 2100.");
    }
    foundingYear = parsed;
  }

  const applicationFeeCurrency = String(formData.get("applicationFeeCurrency") ?? "").trim().toUpperCase() || null;
  if (applicationFeeCurrency && !isValidCurrencyCodeFormat(applicationFeeCurrency)) {
    throw new AdminValidationError("Application fee currency must be a 3-letter ISO 4217 code (e.g. EUR).");
  }
  const applicationFeeRaw = String(formData.get("applicationFeeAmount") ?? "").trim();
  let applicationFeeMinorUnits: number | null = null;
  if (applicationFeeRaw) {
    const parsed = Number.parseFloat(applicationFeeRaw);
    if (!Number.isFinite(parsed) || parsed < 0) throw new AdminValidationError("Application fee must be a non-negative number.");
    applicationFeeMinorUnits = Math.round(parsed * 100);
  }

  const accreditationStatusRaw = String(formData.get("accreditationStatus") ?? "unverified").trim();
  const accreditationStatus = ACCREDITATION_STATUSES.includes(accreditationStatusRaw as AccreditationStatus)
    ? (accreditationStatusRaw as AccreditationStatus)
    : "unverified";

  const verificationStatusRaw = String(formData.get("verificationStatus") ?? "unverified").trim();
  const verificationStatus = (EDUCATION_VERIFICATION_STATUSES as readonly string[]).includes(verificationStatusRaw)
    ? (verificationStatusRaw as EducationVerificationStatus)
    : "unverified";

  const scholarshipsAvailableRaw = formData.get("scholarshipsAvailable");
  const scholarshipsAvailable = scholarshipsAvailableRaw === null ? null : scholarshipsAvailableRaw === "on" || scholarshipsAvailableRaw === "true";

  return {
    name,
    slug,
    country: String(formData.get("country") ?? "").trim() || null,
    city: String(formData.get("city") ?? "").trim() || null,
    website,
    institutionType: String(formData.get("institutionType") ?? "").trim() || null,
    summary: String(formData.get("summary") ?? "").trim() || null,
    accreditationStatus,
    isActive: formData.get("isActive") === "on",
    isVisible: formData.get("isVisible") === "on",
    internalNotes: String(formData.get("internalNotes") ?? "").trim() || null,
    countryId: String(formData.get("countryId") ?? "").trim() || null,
    stateRegion: String(formData.get("stateRegion") ?? "").trim() || null,
    streetAddress: String(formData.get("streetAddress") ?? "").trim() || null,
    postalCode: String(formData.get("postalCode") ?? "").trim() || null,
    admissionsUrl,
    internationalAdmissionsUrl,
    ownershipType,
    foundingYear,
    accreditationOrganization: String(formData.get("accreditationOrganization") ?? "").trim() || null,
    studyLevels: parseListField(formData, "studyLevels"),
    studyModes: parseListField(formData, "studyModes"),
    campusInfo: String(formData.get("campusInfo") ?? "").trim() || null,
    logoUrl,
    internationalStudentSupport: String(formData.get("internationalStudentSupport") ?? "").trim() || null,
    scholarshipsAvailable,
    applicationFeeMinorUnits,
    applicationFeeCurrency,
    dataSource: String(formData.get("dataSource") ?? "").trim() || null,
    sourceUrl,
    lastVerifiedAt: String(formData.get("lastVerifiedAt") ?? "").trim() || null,
    verificationStatus,
  };
}

/** Every field written on create/update EXCEPT publication_status — that is deliberately its own controlled transition (see submitUniversityForReview/publishUniversity/archiveUniversity/restoreUniversity below), never something a generic form save can jump straight to 'published' on. A brand-new record always starts 'draft' regardless of what a crafted form payload might contain. */
function universityWriteFields(input: UniversityInput) {
  return {
    name: input.name,
    slug: input.slug,
    country: input.country,
    city: input.city,
    website: input.website,
    institution_type: input.institutionType,
    summary: input.summary,
    accreditation_status: input.accreditationStatus,
    is_active: input.isActive,
    is_visible: input.isVisible,
    internal_notes: input.internalNotes,
    country_id: input.countryId,
    state_region: input.stateRegion,
    street_address: input.streetAddress,
    postal_code: input.postalCode,
    admissions_url: input.admissionsUrl,
    international_admissions_url: input.internationalAdmissionsUrl,
    ownership_type: input.ownershipType,
    founding_year: input.foundingYear,
    accreditation_organization: input.accreditationOrganization,
    study_levels: input.studyLevels,
    study_modes: input.studyModes,
    campus_info: input.campusInfo,
    logo_url: input.logoUrl,
    international_student_support: input.internationalStudentSupport,
    scholarships_available: input.scholarshipsAvailable,
    application_fee_minor_units: input.applicationFeeMinorUnits,
    application_fee_currency: input.applicationFeeCurrency,
    data_source: input.dataSource,
    source_url: input.sourceUrl,
    last_verified_at: input.lastVerifiedAt,
    verification_status: input.verificationStatus,
  };
}

export async function createUniversity(formData: FormData): Promise<string> {
  const admin = await requireAdminPermission("universities:write");
  const input = parseUniversityForm(formData);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("universities")
    .insert({
      ...universityWriteFields(input),
      publication_status: "draft",
      // Every INSERT into this table must supply the full row shape (see
      // src/types/database.ts's Insert type for `universities` — it is
      // deliberately NOT Partial, unlike Update). These three are never
      // set through the plain edit form: `ranking` starts empty and is
      // populated later via a dedicated ranking-entry workflow (not yet
      // built); `mergedIntoId` is only ever set by the duplicate-merge
      // flow (src/lib/supabase/admin/education-duplicates.ts), never a
      // generic save; `sourceAccessDate` defaults to today the first time
      // a source URL is recorded, exactly once, at creation.
      ranking: [],
      merged_into_id: null,
      source_access_date: input.sourceUrl ? new Date().toISOString().slice(0, 10) : null,
      created_by: admin.userId,
      updated_by: admin.userId,
    })
    .select("id")
    .single();

  if (error) {
    logDbError("createUniversity", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Created",
    entityType: "university",
    entityId: data.id,
    entityLabel: `university "${input.name}"`,
    after: { name: input.name, slug: input.slug, publicationStatus: "draft", isActive: input.isActive },
  });

  return data.id;
}

export async function updateUniversity(id: string, formData: FormData): Promise<void> {
  const admin = await requireAdminPermission("universities:write");
  const input = parseUniversityForm(formData);
  const supabase = await createClient();

  const before = await getUniversityById(id);

  const { error } = await supabase
    .from("universities")
    .update({ ...universityWriteFields(input), updated_by: admin.userId })
    .eq("id", id);

  if (error) {
    logDbError("updateUniversity", error);
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
    entityType: "university",
    entityId: id,
    entityLabel: `university "${input.name}"`,
    fieldChangeSummaries,
    before: before ? { name: before.name, verificationStatus: before.verificationStatus, isActive: before.isActive } : undefined,
    after: { name: input.name, verificationStatus: input.verificationStatus, isActive: input.isActive },
  });
}

// ---------------------------------------------------------------------------
// Publication workflow — draft -> in_review -> published -> archived (or
// restored back to draft). Each transition is its own narrow function
// rather than a generic "setStatus" so the audit trail reads clearly and so
// RLS's per-transition restrictions (content_editor can reach draft/
// in_review only) map onto obviously-separate code paths.
// ---------------------------------------------------------------------------

async function transitionUniversityStatus(id: string, status: EducationPublicationStatus, action: string): Promise<void> {
  await requireAdminPermission("universities:write");
  const supabase = await createClient();
  const before = await getUniversityById(id);
  if (!before) throw new AdminValidationError("University not found.");

  const { error } = await supabase.from("universities").update({ publication_status: status }).eq("id", id);
  if (error) {
    logDbError(`transitionUniversityStatus(${status})`, error);
    // RLS denial surfaces here as a Postgres error — friendlyAdminError maps
    // it to "You don't have permission to make this change." for e.g. a
    // content_editor attempting to publish directly.
    throw new Error(error.message);
  }

  await recordAuditLog({
    action,
    entityType: "university",
    entityId: id,
    entityLabel: `university "${before.name}"`,
    fieldChangeSummaries: [`publicationStatus: ${before.publicationStatus} -> ${status}`],
    before: { publicationStatus: before.publicationStatus },
    after: { publicationStatus: status },
  });
}

export async function submitUniversityForReview(id: string): Promise<void> {
  await transitionUniversityStatus(id, "in_review", "Submitted for review");
}
export async function publishUniversity(id: string): Promise<void> {
  await transitionUniversityStatus(id, "published", "Published");
}
export async function archiveUniversity(id: string): Promise<void> {
  await transitionUniversityStatus(id, "archived", "Archived");
}
export async function restoreUniversityToDraft(id: string): Promise<void> {
  await transitionUniversityStatus(id, "draft", "Restored to draft");
}

/** Bulk status update — spec: "bulk status updates". Applies the same narrow per-row RLS as the single-record transition; partial failure is possible (RLS may allow some rows and not others, e.g. a content_editor bulk-publishing a mix of their own drafts and someone else's), so this reports counts rather than throwing on the first failure. */
export async function bulkUpdateUniversityPublicationStatus(
  ids: string[],
  status: EducationPublicationStatus,
): Promise<{ succeeded: number; failed: number }> {
  await requireAdminPermission("universities:write");
  if (!(EDUCATION_PUBLICATION_STATUSES as readonly string[]).includes(status)) {
    throw new AdminValidationError("Invalid publication status.");
  }
  let succeeded = 0;
  let failed = 0;
  for (const id of ids) {
    try {
      await transitionUniversityStatus(id, status, `Bulk-updated to ${status}`);
      succeeded += 1;
    } catch (err) {
      logDbError("bulkUpdateUniversityPublicationStatus", err);
      failed += 1;
    }
  }
  return { succeeded, failed };
}

/** Whether the given publication status is one a content_editor may reach through the draft-only write policy — mirrors RLS, used purely for UI affordances (disabling a "Publish" button), never as the actual security check. */
export function isContentEditorWritableStatus(status: EducationPublicationStatus): boolean {
  return CONTENT_EDITOR_WRITABLE_STATUSES.includes(status);
}
