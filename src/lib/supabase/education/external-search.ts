import "server-only";
import { createClient } from "../server";
import { buildProviderSearchResult, needsMappingGapEvent } from "@/lib/education/external-search/adapter";
import type { AdapterOutcome, MappingRecord, ProviderRecord } from "@/lib/education/external-search/provider-types";
import type { CanonicalDegreeLevel } from "@/lib/education/external-search/taxonomy";
import type { ExternalSearchSourcePage } from "@/types/education-search";

/**
 * Trusted Global Course Search — PUBLIC/student-facing read access to
 * trusted external providers/mappings, plus click/search-gap recording.
 * Deliberately separate from src/lib/supabase/admin/external-search.ts
 * (admin-gated, sees every provider/mapping regardless of active state) —
 * mirrors the exact convention src/lib/supabase/education/courses.ts's
 * docblock documents for the internal course catalogue.
 *
 * Every read here is additionally scoped by RLS (0009_trusted_course_search.sql):
 * an anonymous/authenticated non-admin client can only ever see
 * `active = true` providers and `mapping_status = 'active'` mappings of
 * active providers — the explicit `.active`/`.mappingStatus` checks in this
 * file (and again in src/lib/education/external-search/adapter.ts, and
 * again in the /go redirect route) are DEFENSE IN DEPTH on top of that, not
 * the only check.
 */

function logDbError(context: string, error: unknown) {
  console.error(`[education/external-search] ${context}:`, error);
}

interface ProviderRow {
  id: string;
  slug: string;
  display_name: string;
  country_code: string | null;
  region: string | null;
  provider_type: string;
  official_domain: string;
  base_url: string;
  fallback_url: string | null;
  strategy: string;
  description: string | null;
  warning_text: string | null;
  warning_effective_at: string | null;
  warning_review_at: string | null;
  language: string | null;
  active: boolean;
  last_verified_at: string | null;
  verified_by: string | null;
  supported_degree_levels: string[] | null;
}

function toProviderRecord(row: ProviderRow): ProviderRecord {
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.display_name,
    countryCode: row.country_code,
    region: row.region,
    providerType: row.provider_type,
    officialDomain: row.official_domain,
    baseUrl: row.base_url,
    fallbackUrl: row.fallback_url,
    strategy: row.strategy as ProviderRecord["strategy"],
    description: row.description,
    warningText: row.warning_text,
    warningEffectiveAt: row.warning_effective_at,
    warningReviewAt: row.warning_review_at,
    language: row.language,
    active: row.active,
    lastVerifiedAt: row.last_verified_at,
    verifiedBy: row.verified_by,
    supportedDegreeLevels: (row.supported_degree_levels ?? []) as CanonicalDegreeLevel[],
  };
}

interface MappingRow {
  id: string;
  provider_id: string;
  canonical_subject_id: string;
  degree_level: string;
  destination_country_code: string;
  verified_url: string | null;
  provider_subject_code: string | null;
  provider_degree_code: string | null;
  search_term: string | null;
  manual_instructions: string | null;
  mapping_status: string;
  last_verified_at: string | null;
  verified_by: string | null;
}

function toMappingRecord(row: MappingRow): MappingRecord {
  return {
    id: row.id,
    providerId: row.provider_id,
    canonicalSubjectId: row.canonical_subject_id,
    degreeLevel: row.degree_level as CanonicalDegreeLevel,
    destinationCountryCode: row.destination_country_code,
    verifiedUrl: row.verified_url,
    providerSubjectCode: row.provider_subject_code,
    providerDegreeCode: row.provider_degree_code,
    searchTerm: row.search_term,
    manualInstructions: row.manual_instructions,
    mappingStatus: row.mapping_status as MappingRecord["mappingStatus"],
    lastVerifiedAt: row.last_verified_at,
    verifiedBy: row.verified_by,
  };
}

const PROVIDER_COLUMNS =
  "id, slug, display_name, country_code, region, provider_type, official_domain, base_url, fallback_url, strategy, description, warning_text, warning_effective_at, warning_review_at, language, active, last_verified_at, verified_by, supported_degree_levels";
const MAPPING_COLUMNS =
  "id, provider_id, canonical_subject_id, degree_level, destination_country_code, verified_url, provider_subject_code, provider_degree_code, search_term, manual_instructions, mapping_status, last_verified_at, verified_by";

/** Every active provider relevant to `destinationCountryCode` — direct country match, plus any active "region-wide" provider (country_code is null, e.g. Erasmus Mundus) whose own region indicates it applies broadly and `destinationCountryCode` is within Europe. Returns [] for a null/empty destination. */
async function listActiveProvidersForDestination(destinationCountryCode: string | null): Promise<ProviderRecord[]> {
  if (!destinationCountryCode) return [];
  const supabase = await createClient();

  const [{ data: direct, error: directError }, { data: destinationCountry }] = await Promise.all([
    supabase.from("external_search_providers").select(PROVIDER_COLUMNS).eq("active", true).eq("country_code", destinationCountryCode),
    supabase.from("countries").select("region").eq("iso_alpha2", destinationCountryCode).maybeSingle(),
  ]);
  if (directError) {
    logDbError("listActiveProvidersForDestination(direct)", directError);
    return [];
  }

  const providers = ((direct ?? []) as unknown as ProviderRow[]).map(toProviderRecord);

  if (destinationCountry?.region === "Europe") {
    const { data: wide, error: wideError } = await supabase
      .from("external_search_providers")
      .select(PROVIDER_COLUMNS)
      .eq("active", true)
      .is("country_code", null)
      .eq("region", "Europe-wide");
    if (wideError) {
      logDbError("listActiveProvidersForDestination(europe-wide)", wideError);
    } else {
      providers.push(...((wide ?? []) as unknown as ProviderRow[]).map(toProviderRecord));
    }
  }

  return providers;
}

/** Active mappings for the given providers matching one exact (subject, degree, destination) tuple — a batched IN() lookup, never one query per provider. */
async function findActiveMappings(
  providerIds: string[],
  canonicalSubjectId: string,
  degreeLevel: CanonicalDegreeLevel,
  destinationCountryCode: string,
): Promise<Map<string, MappingRecord>> {
  if (providerIds.length === 0) return new Map();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("external_search_mappings")
    .select(MAPPING_COLUMNS)
    .in("provider_id", providerIds)
    .eq("mapping_status", "active")
    .eq("canonical_subject_id", canonicalSubjectId)
    .eq("degree_level", degreeLevel)
    .eq("destination_country_code", destinationCountryCode);
  if (error) {
    logDbError("findActiveMappings", error);
    return new Map();
  }
  const byProvider = new Map<string, MappingRecord>();
  for (const row of (data ?? []) as unknown as MappingRow[]) {
    byProvider.set(row.provider_id, toMappingRecord(row));
  }
  return byProvider;
}

export interface TrustedSearchQuery {
  destinationCountryCode: string | null;
  canonicalSubjectId: string | null;
  canonicalSubjectLabel: string | null;
  degreeLevel: CanonicalDegreeLevel | null;
}

export interface TrustedSearchResults {
  /** Every available provider result for this destination, best (filtered) first. Never includes an `available: false` outcome. */
  results: import("@/lib/education/external-search/provider-types").AdapterResult[];
}

/**
 * The step-4 public entry point: resolves every active, eligible trusted
 * provider for `query.destinationCountryCode` into its best available
 * result (deep link, or landing page + instructions), in priority order.
 * Does NOT itself record any analytics — callers (the /courses page
 * server component) call recordMappingGapEventForPrimaryResult separately
 * so a page render never has a side effect a cached/prefetched render
 * would silently duplicate.
 */
export async function getTrustedSearchResults(query: TrustedSearchQuery): Promise<TrustedSearchResults> {
  const providers = await listActiveProvidersForDestination(query.destinationCountryCode);
  if (providers.length === 0) return { results: [] };

  const mappingByProvider =
    query.canonicalSubjectId && query.degreeLevel && query.destinationCountryCode
      ? await findActiveMappings(providers.map((p) => p.id), query.canonicalSubjectId, query.degreeLevel, query.destinationCountryCode)
      : new Map<string, MappingRecord>();

  const now = new Date();
  const outcomes: AdapterOutcome[] = providers.map((provider) =>
    buildProviderSearchResult(provider, mappingByProvider.get(provider.id) ?? null, query, now),
  );

  const results = outcomes.filter((o): o is import("@/lib/education/external-search/provider-types").AdapterResult => o.available);
  results.sort((a, b) => Number(b.isFiltered) - Number(a.isFiltered));
  return { results };
}

/**
 * Records one privacy-conscious "mapping needed" search-gap event for the
 * single best (primary) provider result, when that result was NOT a
 * genuine filtered deep link — spec: "When no verified deep-link mapping
 * exists... Record an anonymized 'mapping needed' event." Fire-and-forget
 * safe: never throws, matching src/lib/supabase/pricing/analytics.ts's
 * recordPricingAnalyticsEvent convention exactly. Only ever writes
 * normalized/canonical values (provider id, taxonomy subject id, canonical
 * degree level, ISO country code) — never a raw free-text query string.
 */
export async function recordMappingGapEventForPrimaryResult(results: TrustedSearchResults, query: TrustedSearchQuery): Promise<void> {
  const primary = results.results[0];
  if (!primary || !needsMappingGapEvent(primary)) return;
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("external_search_clicks").insert({
      provider_id: primary.providerId,
      mapping_id: null,
      canonical_subject_id: query.canonicalSubjectId,
      degree_level: query.degreeLevel,
      destination_country_code: query.destinationCountryCode,
      source_page: "courses_search",
      event_type: "mapping_needed",
    });
    if (error) logDbError("recordMappingGapEventForPrimaryResult", error);
  } catch (error) {
    logDbError("recordMappingGapEventForPrimaryResult threw", error);
  }
}

export interface RecordClickParams {
  providerId: string;
  mappingId: string | null;
  canonicalSubjectId: string | null;
  degreeLevel: string | null;
  destinationCountryCode: string | null;
  sourcePage: ExternalSearchSourcePage;
}

/** Records one outbound click. Called server-side from the /go redirect route, right before issuing the redirect — never from the client directly (so provider_id/mapping_id are always already-validated ids, never client-supplied free text). */
export async function recordExternalSearchClick(params: RecordClickParams): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("external_search_clicks").insert({
      provider_id: params.providerId,
      mapping_id: params.mappingId,
      canonical_subject_id: params.canonicalSubjectId,
      degree_level: params.degreeLevel,
      destination_country_code: params.destinationCountryCode,
      source_page: params.sourcePage,
      event_type: "click",
    });
    if (error) logDbError("recordExternalSearchClick", error);
  } catch (error) {
    logDbError("recordExternalSearchClick threw", error);
  }
}

// ---------------------------------------------------------------------------
// Single-row lookups for the /go redirect routes.
// ---------------------------------------------------------------------------

export interface MappingWithProvider {
  mapping: MappingRecord;
  provider: ProviderRecord;
}

/**
 * Loads one mapping and its parent provider by mapping id, for the
 * /go/course-search/[mappingId] redirect route. RLS already restricts an
 * anon/authenticated non-admin caller to `mapping_status = 'active'` rows
 * whose provider is also `active = true` — a mapping that is inactive, or
 * whose provider is inactive, simply comes back as `null` here (RLS makes
 * it invisible), which the route treats identically to "not found": a safe
 * error page, never a redirect. The explicit `.mappingStatus`/`.active`
 * checks in the route itself are defense in depth on top of that, not the
 * only gate.
 */
export async function getMappingWithProviderById(mappingId: string): Promise<MappingWithProvider | null> {
  const supabase = await createClient();
  const { data: mappingRow, error: mappingError } = await supabase
    .from("external_search_mappings")
    .select(MAPPING_COLUMNS)
    .eq("id", mappingId)
    .maybeSingle();
  if (mappingError) {
    logDbError("getMappingWithProviderById(mapping)", mappingError);
    return null;
  }
  if (!mappingRow) return null;

  const { data: providerRow, error: providerError } = await supabase
    .from("external_search_providers")
    .select(PROVIDER_COLUMNS)
    .eq("id", (mappingRow as unknown as MappingRow).provider_id)
    .maybeSingle();
  if (providerError) {
    logDbError("getMappingWithProviderById(provider)", providerError);
    return null;
  }
  if (!providerRow) return null;

  return { mapping: toMappingRecord(mappingRow as unknown as MappingRow), provider: toProviderRecord(providerRow as unknown as ProviderRow) };
}

/** Loads one provider by id for the /go/course-search/provider/[providerId] landing-page-only redirect route. Same RLS-is-the-first-gate reasoning as getMappingWithProviderById. */
export async function getProviderById(providerId: string): Promise<ProviderRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("external_search_providers").select(PROVIDER_COLUMNS).eq("id", providerId).maybeSingle();
  if (error) {
    logDbError("getProviderById", error);
    return null;
  }
  if (!data) return null;
  return toProviderRecord(data as unknown as ProviderRow);
}
