import "server-only";
import { hasUniversityDirectoryAccess } from "./university-access";
import { createClient } from "../server";
import { lookupValue, type DetailLookup } from "../detail-lookup";
import { calculateFreshnessBand } from "@/lib/education/data-quality";
import { buildContainsIlikePattern, clampPublicPageSize, parsePageParam, sanitizeSearchQuery } from "@/lib/education/search";
import { parseHighlights, parseRankings, type UniversityHighlight, type UniversityRanking } from "@/lib/education/university-discovery/directory";
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

export interface UniversityPhoto {
  url: string;
  alt: string;
  caption: string | null;
  creditAuthor: string;
  creditSourceUrl: string;
  licenceName: string;
  kind: "hero" | "gallery";
}

export interface PublicUniversitySummary {
  id: string;
  name: string;
  slug: string;
  countryName: string | null;
  city: string | null;
  stateRegion: string | null;
  institutionType: string | null;
  /** UNI_V3 — student-facing category; null until the enrichment columns exist and are filled. */
  institutionCategory: string | null;
  ownershipType: UniversityOwnershipType | null;
  studyLevels: string[];
  /** UNI_V3 — broad study areas from the official programme catalogue. Empty when not recorded. */
  studyAreas: string[];
  /** UNI_V3 — first sourced highlight, if any. Never an unsourced claim. */
  leadHighlight: UniversityHighlight | null;
  /** UNI_V3 — licence-cleared hero photograph with its credit, if one is recorded. */
  heroPhoto: UniversityPhoto | null;
  logoUrl: string | null;
  lastVerifiedAt: string | null;
  freshnessBand: EducationFreshnessBand;
  /** CC-22B — shown on every card so an unverified record is never presented as checked. */
  verificationStatus: string;
}

export interface PublicUniversityDetail extends PublicUniversitySummary {
  websiteUrl: string | null;
  admissionsUrl: string | null;
  internationalAdmissionsUrl: string | null;
  streetAddress: string | null;
  postalCode: string | null;
  foundingYear: number | null;
  accreditationOrganization: string | null;
  accreditationStatus: string;
  ranking: UniversityRanking[];
  highlights: UniversityHighlight[];
  photos: UniversityPhoto[];
  courseCatalogueUrl: string | null;
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

interface MediaRow {
  kind: string;
  url: string;
  alt_text: string;
  caption: string | null;
  credit_author: string;
  credit_source_url: string;
  licence_name: string;
  licence_status: string;
  is_active: boolean;
  sort_order: number;
}

interface PublicUniversityRow {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  state_region: string | null;
  website: string | null;
  institution_type: string | null;
  ownership_type: string | null;
  study_levels: string[] | null;
  study_modes: string[] | null;
  logo_url: string | null;
  last_verified_at: string | null;
  verification_status: string;
  countries: { name: string } | null;
  institution_category?: string | null;
  study_areas?: string[] | null;
  highlights?: unknown;
  university_media?: MediaRow[] | null;
}

/** Columns that exist on every deployed schema (migrations 0004 + 0006). */
const BASE_SUMMARY_COLUMNS =
  "id, name, slug, city, state_region, website, institution_type, ownership_type, study_levels, study_modes, logo_url, last_verified_at, verification_status, countries ( name )";
/** UNI_V3 enrichment (proposed migration UNI_V3/0002). Selected first; if the database does not have it yet the reader falls back to BASE_SUMMARY_COLUMNS. */
const V3_COLUMNS =
  "institution_category, study_areas, highlights, university_media ( kind, url, alt_text, caption, credit_author, credit_source_url, licence_name, licence_status, is_active, sort_order )";
const SUMMARY_COLUMNS = `${BASE_SUMMARY_COLUMNS}, ${V3_COLUMNS}`;

/** PostgREST / Postgres answers for "this column or relationship does not exist" — i.e. the enrichment migration is not applied. */
function isMissingV3Schema(error: { code?: string } | null): boolean {
  return !!error && ["42703", "PGRST200", "PGRST204", "42P01"].includes(error.code ?? "");
}

function toPhotos(rows: MediaRow[] | null | undefined): UniversityPhoto[] {
  return (rows ?? [])
    // Defence in depth: RLS already limits students to cleared, active rows; staff can read every row, so the page filters too.
    .filter((row) => row.is_active && row.licence_status === "cleared" && (row.kind === "hero" || row.kind === "gallery"))
    .sort((a, b) => (a.kind === b.kind ? a.sort_order - b.sort_order : a.kind === "hero" ? -1 : 1))
    .map((row) => ({
      url: row.url,
      alt: row.alt_text,
      caption: row.caption,
      creditAuthor: row.credit_author,
      creditSourceUrl: row.credit_source_url,
      licenceName: row.licence_name,
      kind: row.kind as "hero" | "gallery",
    }));
}

function toSummary(row: PublicUniversityRow): PublicUniversitySummary {
  const photos = toPhotos(row.university_media);
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    countryName: row.countries?.name ?? null,
    city: row.city,
    stateRegion: row.state_region,
    institutionType: row.institution_type,
    institutionCategory: row.institution_category ?? null,
    ownershipType: row.ownership_type as UniversityOwnershipType | null,
    studyLevels: row.study_levels ?? [],
    studyAreas: row.study_areas ?? [],
    leadHighlight: parseHighlights(row.highlights)[0] ?? null,
    heroPhoto: photos[0] ?? null,
    logoUrl: row.logo_url,
    lastVerifiedAt: row.last_verified_at,
    freshnessBand: calculateFreshnessBand(row.last_verified_at),
    verificationStatus: row.verification_status,
  };
}

export interface UniversityDirectoryResult extends EducationListResult<PublicUniversitySummary> {
  /** False when the database does not have the UNI_V3 enrichment columns yet; category and study-area filters are then unavailable. */
  enriched: boolean;
}

/**
 * Server-side paginated university directory search (UNI_V3). Every filter is
 * a real column. Never loads the full catalogue into the browser.
 */
export async function searchUniversities(filters: UniversitySearchFilters = {}): Promise<UniversityDirectoryResult> {
  const page = parsePageParam(filters.page ? String(filters.page) : undefined);
  const pageSize = clampPublicPageSize(filters.pageSize);
  const empty: UniversityDirectoryResult = { items: [], total: 0, page, pageSize, enriched: true };
  // University Discovery V3 — access is enforced here, in the data layer, so no page, action or sitemap can read past it.
  if (!(await hasUniversityDirectoryAccess())) return empty;

  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const run = (enriched: boolean) => {
    let query = supabase
      .from("universities")
      .select(enriched ? SUMMARY_COLUMNS : BASE_SUMMARY_COLUMNS, { count: "exact" })
      .eq("publication_status", "published")
      .eq("is_active", true);

    const q = sanitizeSearchQuery(filters.q);
    if (q) {
      // Commas and parentheses are PostgREST `or()` syntax, so they are removed from the term before it is embedded.
      const pattern = buildContainsIlikePattern(q.replace(/[(),"]/g, " ").trim());
      query = query.or(`name.ilike.${pattern},city.ilike.${pattern},summary.ilike.${pattern}`);
    }
    if (filters.countryIds && filters.countryIds.length > 0) query = query.in("country_id", filters.countryIds);
    if (filters.stateRegion) query = query.eq("state_region", filters.stateRegion);
    if (filters.city) query = query.ilike("city", buildContainsIlikePattern(filters.city));
    if (filters.ownershipType) query = query.eq("ownership_type", filters.ownershipType);
    if (filters.studyModes && filters.studyModes.length > 0) query = query.overlaps("study_modes", filters.studyModes);
    if (enriched && filters.institutionCategory) query = query.eq("institution_category" as never, filters.institutionCategory as never);
    if (enriched && filters.studyArea) query = query.contains("study_areas" as never, [filters.studyArea] as never);

    if (filters.sort === "city") query = query.order("city", { ascending: true, nullsFirst: false }).order("name", { ascending: true });
    else if (filters.sort === "recent") query = query.order("last_verified_at", { ascending: false, nullsFirst: false }).order("name", { ascending: true });
    else if (filters.sort === "name") query = query.order("name", { ascending: true });
    // Default: records Nextwise has verified come first ("verified" sorts last alphabetically, hence descending), then A–Z.
    else query = query.order("verification_status", { ascending: false }).order("name", { ascending: true });
    return query.range(from, to);
  };

  let enriched = true;
  let { data, error, count } = await run(true);
  if (isMissingV3Schema(error)) {
    enriched = false;
    ({ data, error, count } = await run(false));
  }

  if (error) {
    logDbError("searchUniversities", error);
    // UX07 — a genuine query failure is reported as such, never as an empty catalogue.
    return { ...empty, enriched, error: true };
  }

  return { items: (data ?? []).map((r) => toSummary(r as unknown as PublicUniversityRow)), total: count ?? 0, page, pageSize, enriched };
}

export interface DirectoryFacets {
  countries: { id: string; name: string; isoAlpha2: string }[];
  states: string[];
}

const FACET_ROW_CAP = 2000;

/** Countries and regions that actually have published institutions, for the filter controls. Bounded; values only, no records. */
export async function listDirectoryFacets(countryId?: string): Promise<DirectoryFacets> {
  if (!(await hasUniversityDirectoryAccess())) return { countries: [], states: [] };
  const supabase = await createClient();
  const query = supabase
    .from("universities")
    .select("country_id, state_region, countries ( id, name, iso_alpha2 )")
    .eq("publication_status", "published")
    .eq("is_active", true)
    .range(0, FACET_ROW_CAP - 1);
  const { data, error } = await query;
  if (error) {
    logDbError("listDirectoryFacets", error);
    return { countries: [], states: [] };
  }
  const countries = new Map<string, { id: string; name: string; isoAlpha2: string }>();
  const states = new Set<string>();
  for (const raw of data ?? []) {
    const row = raw as unknown as { country_id: string | null; state_region: string | null; countries: { id: string; name: string; iso_alpha2: string } | null };
    if (row.countries) countries.set(row.countries.id, { id: row.countries.id, name: row.countries.name, isoAlpha2: row.countries.iso_alpha2 });
    if (row.state_region && (!countryId || row.country_id === countryId)) states.add(row.state_region);
  }
  return {
    countries: Array.from(countries.values()).sort((a, b) => a.name.localeCompare(b.name)),
    states: Array.from(states).sort((a, b) => a.localeCompare(b)),
  };
}

interface PublicUniversityDetailRow extends PublicUniversityRow {
  admissions_url: string | null;
  international_admissions_url: string | null;
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
  course_catalogue_url?: string | null;
}

const DETAIL_EXTRA_COLUMNS = "admissions_url, international_admissions_url, street_address, postal_code, founding_year, accreditation_organization, accreditation_status, ranking, campus_info, international_student_support, scholarships_available, application_fee_minor_units, application_fee_currency, source_url, summary";
const DETAIL_COLUMNS = `${SUMMARY_COLUMNS}, ${DETAIL_EXTRA_COLUMNS}, course_catalogue_url`;
const BASE_DETAIL_COLUMNS = `${BASE_SUMMARY_COLUMNS}, ${DETAIL_EXTRA_COLUMNS}`;

/** Public university detail by slug — published+active only. Returns null for a draft/archived/unknown/merged-away slug rather than leaking its existence. */
export async function getPublicUniversityBySlug(slug: string): Promise<PublicUniversityDetail | null> {
  return lookupValue(await lookupPublicUniversityBySlug(slug));
}

/** CC-24 — like getPublicUniversityBySlug, but tells "no such published university" (a real 404) apart from "the lookup failed". */
export async function lookupPublicUniversityBySlug(slug: string): Promise<DetailLookup<PublicUniversityDetail>> {
  // University Discovery V3 — access is enforced here, in the data layer, so no page, action or sitemap can read past it.
  if (!(await hasUniversityDirectoryAccess())) return { status: "not_found" };
  const supabase = await createClient();
  const run = (columns: string) =>
    supabase.from("universities").select(columns).eq("slug", slug).eq("publication_status", "published").eq("is_active", true).maybeSingle();
  let { data, error } = await run(DETAIL_COLUMNS);
  if (isMissingV3Schema(error)) ({ data, error } = await run(BASE_DETAIL_COLUMNS));

  if (error) {
    logDbError("getPublicUniversityBySlug", error);
    return { status: "unavailable" };
  }
  if (!data) return { status: "not_found" };
  const row = data as unknown as PublicUniversityDetailRow;

  const detail: PublicUniversityDetail = {
    ...toSummary(row),
    websiteUrl: row.website,
    admissionsUrl: row.admissions_url,
    internationalAdmissionsUrl: row.international_admissions_url,
    streetAddress: row.street_address,
    postalCode: row.postal_code,
    foundingYear: row.founding_year,
    accreditationOrganization: row.accreditation_organization,
    accreditationStatus: row.accreditation_status,
    ranking: parseRankings(row.ranking),
    highlights: parseHighlights(row.highlights),
    photos: toPhotos(row.university_media),
    courseCatalogueUrl: row.course_catalogue_url ?? null,
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
  return { status: "found", value: detail };
}

const MAX_BATCH_UNIVERSITIES = 60;

/** Fetches published+active universities by id — used by the student "saved universities" list. Caps the id list defensively (a saved-items list is expected to be small; this is not a pagination mechanism) and silently drops any id that is missing or unpublished, matching getPublicUniversityBySlug's not-found-is-null convention. */
export async function getUniversitiesByIds(ids: string[]): Promise<PublicUniversitySummary[]> {
  // University Discovery V3 — access is enforced here, in the data layer, so no page, action or sitemap can read past it.
  if (!(await hasUniversityDirectoryAccess())) return [];
  const uniqueIds = Array.from(new Set(ids)).slice(0, MAX_BATCH_UNIVERSITIES);
  if (uniqueIds.length === 0) return [];

  const supabase = await createClient();
  const run = (columns: string) =>
    supabase.from("universities").select(columns).in("id", uniqueIds).eq("publication_status", "published").eq("is_active", true).order("name", { ascending: true });
  let { data, error } = await run(SUMMARY_COLUMNS);
  if (isMissingV3Schema(error)) ({ data, error } = await run(BASE_SUMMARY_COLUMNS));
  if (error) {
    logDbError("getUniversitiesByIds", error);
    return [];
  }
  return (data ?? []).map((r) => toSummary(r as unknown as PublicUniversityRow));
}

const SITEMAP_MAX_ROWS = 5000;

export interface PublicUniversitySitemapEntry {
  slug: string;
  lastVerifiedAt: string | null;
}

/**
 * M17A Step 3 — every published+active university's slug, for sitemap
 * generation only. Mirrors searchUniversities()'s exact
 * publication_status/is_active filter so "public" never depends on more
 * than one place to define it (see this module's docblock). `lastVerifiedAt`
 * is a genuine, already-tracked "last checked" timestamp (the same one
 * freshness banding uses) — an honest lastModified source, not a fabricated
 * date; it is `null` for a university that has never been verified, and
 * callers should omit `lastModified` entirely in that case rather than
 * inventing one.
 *
 * Deliberately NOT paginated like searchUniversities() — a sitemap needs
 * every row, not one page — but bounded by SITEMAP_MAX_ROWS as a safety cap
 * against an unbounded query. See M17A_STEP3_REPORT.md's "unresolved risks"
 * section: if the published catalogue ever approaches this cap, it needs
 * revisiting (e.g. a paginated sitemap index) rather than silently
 * truncating unnoticed.
 */
export async function getPublishedUniversitySlugsForSitemap(): Promise<PublicUniversitySitemapEntry[]> {
  // University Discovery V3 — access is enforced here, in the data layer, so no page, action or sitemap can read past it.
  if (!(await hasUniversityDirectoryAccess())) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("universities")
    .select("slug, last_verified_at")
    .eq("publication_status", "published")
    .eq("is_active", true)
    .order("slug", { ascending: true })
    .range(0, SITEMAP_MAX_ROWS - 1);

  if (error) {
    logDbError("getPublishedUniversitySlugsForSitemap", error);
    return [];
  }
  return (data ?? []).map((row) => ({ slug: row.slug, lastVerifiedAt: row.last_verified_at }));
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
  // University Discovery V3 — access is enforced here, in the data layer, so no page, action or sitemap can read past it.
  if (!(await hasUniversityDirectoryAccess())) return [];
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
  // University Discovery V3 — access is enforced here, in the data layer, so no page, action or sitemap can read past it.
  if (!(await hasUniversityDirectoryAccess())) return [];
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
