import "server-only";
import { createClient } from "../server";
import { calculateFreshnessBand } from "@/lib/education/data-quality";
import { clampPublicPageSize, parsePageParam, sanitizeSearchQuery } from "@/lib/education/search";
import type { EducationFreshnessBand, EducationListResult, UniversitySearchFilters, UniversityOwnershipType } from "@/types/education";

/**
 * Milestone 9 — PUBLIC/student-facing read access to universities. This is
 * a deliberately separate module from src/lib/supabase/admin/universities.ts
 * (which is admin-gated and returns draft/internal fields): every function
 * here explicitly filters `publication_status = 'published'` and
 * `is_active = true` in addition to whatever RLS already enforces, so a
 * "public" result never depends solely on which role happens to be calling
 * it — see src/lib/supabase/careers.ts's docblock for the identical
 * read-only, fail-soft convention this mirrors.
 *
 * Never claims completeness: callers must show the "representative starter
 * dataset, not exhaustive" framing (see docs/global-education-data-guide.md
 * and the public page copy) — this module only returns what's actually
 * stored, nothing implied beyond that.
 */

function logDbError(context: string, error: unknown) {
  console.error(`[education/universities] ${context}:`, error);
}

export interface PublicUniversitySummary {
  id: string;
  name: string;
  slug: string;
  countryName: string | null;
  city: string | null;
  institutionType: string | null;
  ownershipType: UniversityOwnershipType | null;
  studyLevels: string[];
  logoUrl: string | null;
  lastVerifiedAt: string | null;
  freshnessBand: EducationFreshnessBand;
}

export interface PublicUniversityDetail extends PublicUniversitySummary {
  websiteUrl: string | null;
  admissionsUrl: string | null;
  internationalAdmissionsUrl: string | null;
  stateRegion: string | null;
  streetAddress: string | null;
  postalCode: string | null;
  foundingYear: number | null;
  accreditationOrganization: string | null;
  accreditationStatus: string;
  ranking: { provider: string; year: number; rank: number | string; category?: string }[];
  studyModes: string[];
  campusInfo: string | null;
  internationalStudentSupport: string | null;
  scholarshipsAvailable: boolean | null;
  applicationFeeMinorUnits: number | null;
  applicationFeeCurrency: string | null;
  sourceUrl: string | null;
  verificationStatus: string;
  summary: string | null;
}

interface PublicUniversityRow {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  website: string | null;
  institution_type: string | null;
  ownership_type: string | null;
  study_levels: string[] | null;
  study_modes: string[] | null;
  logo_url: string | null;
  last_verified_at: string | null;
  countries: { name: string } | null;
}

const SUMMARY_COLUMNS =
  "id, name, slug, city, website, institution_type, ownership_type, study_levels, study_modes, logo_url, last_verified_at, countries ( name )";

function toSummary(row: PublicUniversityRow): PublicUniversitySummary {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    countryName: row.countries?.name ?? null,
    city: row.city,
    institutionType: row.institution_type,
    ownershipType: row.ownership_type as UniversityOwnershipType | null,
    studyLevels: row.study_levels ?? [],
    logoUrl: row.logo_url,
    lastVerifiedAt: row.last_verified_at,
    freshnessBand: calculateFreshnessBand(row.last_verified_at),
  };
}

/** Server-side paginated public university search — never loads the full catalog into the browser (spec requirement). */
export async function searchUniversities(filters: UniversitySearchFilters = {}): Promise<EducationListResult<PublicUniversitySummary>> {
  const page = parsePageParam(filters.page ? String(filters.page) : undefined);
  const pageSize = clampPublicPageSize(filters.pageSize);
  const empty: EducationListResult<PublicUniversitySummary> = { items: [], total: 0, page, pageSize };

  const supabase = await createClient();
  let query = supabase
    .from("universities")
    .select(SUMMARY_COLUMNS, { count: "exact" })
    .eq("publication_status", "published")
    .eq("is_active", true);

  const q = sanitizeSearchQuery(filters.q);
  if (q) {
    query = query.textSearch("search_vector", q, { type: "websearch", config: "english" });
  }
  if (filters.countryIds && filters.countryIds.length > 0) {
    query = query.in("country_id", filters.countryIds);
  }
  if (filters.city) {
    query = query.ilike("city", `%${filters.city}%`);
  }
  if (filters.studyModes && filters.studyModes.length > 0) {
    query = query.overlaps("study_modes", filters.studyModes);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await query.order("name", { ascending: true }).range(from, to);

  if (error) {
    logDbError("searchUniversities", error);
    return empty;
  }

  return { items: (data ?? []).map((r) => toSummary(r as unknown as PublicUniversityRow)), total: count ?? 0, page, pageSize };
}

interface PublicUniversityDetailRow extends PublicUniversityRow {
  admissions_url: string | null;
  international_admissions_url: string | null;
  state_region: string | null;
  street_address: string | null;
  postal_code: string | null;
  founding_year: number | null;
  accreditation_organization: string | null;
  accreditation_status: string;
  ranking: unknown;
  campus_info: string | null;
  international_student_support: string | null;
  scholarships_available: boolean | null;
  application_fee_minor_units: number | null;
  application_fee_currency: string | null;
  source_url: string | null;
  verification_status: string;
  summary: string | null;
}

const DETAIL_COLUMNS = `${SUMMARY_COLUMNS}, admissions_url, international_admissions_url, state_region, street_address, postal_code, founding_year, accreditation_organization, accreditation_status, ranking, campus_info, international_student_support, scholarships_available, application_fee_minor_units, application_fee_currency, source_url, verification_status, summary`;

/** Public university detail by slug — published+active only. Returns null for a draft/archived/unknown/merged-away slug rather than leaking its existence. */
export async function getPublicUniversityBySlug(slug: string): Promise<PublicUniversityDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("universities")
    .select(DETAIL_COLUMNS)
    .eq("slug", slug)
    .eq("publication_status", "published")
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    logDbError("getPublicUniversityBySlug", error);
    return null;
  }
  if (!data) return null;
  const row = data as unknown as PublicUniversityDetailRow;

  return {
    ...toSummary(row),
    websiteUrl: row.website,
    admissionsUrl: row.admissions_url,
    internationalAdmissionsUrl: row.international_admissions_url,
    stateRegion: row.state_region,
    streetAddress: row.street_address,
    postalCode: row.postal_code,
    foundingYear: row.founding_year,
    accreditationOrganization: row.accreditation_organization,
    accreditationStatus: row.accreditation_status,
    ranking: Array.isArray(row.ranking) ? (row.ranking as PublicUniversityDetail["ranking"]) : [],
    studyModes: row.study_modes ?? [],
    campusInfo: row.campus_info,
    internationalStudentSupport: row.international_student_support,
    scholarshipsAvailable: row.scholarships_available,
    applicationFeeMinorUnits: row.application_fee_minor_units,
    applicationFeeCurrency: row.application_fee_currency,
    sourceUrl: row.source_url,
    verificationStatus: row.verification_status,
    summary: row.summary,
  };
}

const MAX_BATCH_UNIVERSITIES = 60;

/** Fetches published+active universities by id — used by the student "saved universities" list. Caps the id list defensively (a saved-items list is expected to be small; this is not a pagination mechanism) and silently drops any id that is missing or unpublished, matching getPublicUniversityBySlug's not-found-is-null convention. */
export async function getUniversitiesByIds(ids: string[]): Promise<PublicUniversitySummary[]> {
  const uniqueIds = Array.from(new Set(ids)).slice(0, MAX_BATCH_UNIVERSITIES);
  if (uniqueIds.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("universities")
    .select(SUMMARY_COLUMNS)
    .in("id", uniqueIds)
    .eq("publication_status", "published")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) {
    logDbError("getUniversitiesByIds", error);
    return [];
  }
  return (data ?? []).map((r) => toSummary(r as unknown as PublicUniversityRow));
}

export interface PublicCampusSummary {
  id: string;
  name: string;
  countryName: string | null;
  stateRegion: string | null;
  city: string | null;
  isMain: boolean;
}

/** Published university's active campuses — the university's own publication gate already applies (see getPublicUniversityBySlug); campuses have no separate publication_status column, only is_active. */
export async function listPublicCampusesForUniversity(universityId: string): Promise<PublicCampusSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campuses")
    .select("id, name, state_region, city, is_main, countries ( name )")
    .eq("university_id", universityId)
    .eq("is_active", true)
    .order("is_main", { ascending: false })
    .order("name", { ascending: true });
  if (error) {
    logDbError("listPublicCampusesForUniversity", error);
    return [];
  }
  return (data ?? []).map((r) => {
    const row = r as unknown as { id: string; name: string; state_region: string | null; city: string | null; is_main: boolean; countries: { name: string } | null };
    return { id: row.id, name: row.name, countryName: row.countries?.name ?? null, stateRegion: row.state_region, city: row.city, isMain: row.is_main };
  });
}

export interface PublicScholarshipSummary {
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

function toPublicScholarship(row: {
  id: string;
  name: string;
  eligibility: string | null;
  award_amount_minor_units: number | null;
  award_description: string | null;
  currency_code: string | null;
  deadline: string | null;
  scholarship_url: string | null;
  international_eligible: boolean | null;
}): PublicScholarshipSummary {
  return {
    id: row.id,
    name: row.name,
    eligibility: row.eligibility,
    awardAmountMinorUnits: row.award_amount_minor_units,
    awardDescription: row.award_description,
    currencyCode: row.currency_code,
    deadline: row.deadline,
    scholarshipUrl: row.scholarship_url,
    internationalEligible: row.international_eligible,
  };
}

export async function listPublicScholarshipsForUniversity(universityId: string): Promise<PublicScholarshipSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scholarships")
    .select("id, name, eligibility, award_amount_minor_units, award_description, currency_code, deadline, scholarship_url, international_eligible")
    .eq("scope", "university")
    .eq("university_id", universityId)
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) {
    logDbError("listPublicScholarshipsForUniversity", error);
    return [];
  }
  return (data ?? []).map(toPublicScholarship);
}
