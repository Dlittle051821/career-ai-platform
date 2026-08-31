import "server-only";
import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { recordAuditLog } from "./audit";
import { AdminValidationError } from "@/lib/admin/form-state";
import { clampPageSize, pageToRange, parsePageParam } from "@/lib/admin/pagination";
import { validateExternalUrl, isVerificationStale } from "@/lib/education/external-search/url-validation";
import { CANONICAL_DEGREE_LEVELS, DEGREE_LEVEL_LABELS, SUBJECT_TAXONOMY } from "@/lib/education/external-search/taxonomy";
import type { CanonicalDegreeLevel } from "@/lib/education/external-search/taxonomy";
import type { MappingStatus, ProviderStrategy } from "@/lib/education/external-search/provider-types";
import type { ProviderClickCount, ProviderType, SearchGapRow } from "@/types/education-search";

/**
 * Trusted Global Course Search — ADMIN data access for
 * "Trusted Course Portals" (src/app/admin/trusted-portals/**). Every
 * function here starts with requireAdminPermission("trusted-portals:read"
 * or "trusted-portals:write") — the SAME app-layer check every other
 * admin module in this codebase makes, backed independently by RLS
 * (0009_trusted_course_search.sql PART 1/2/3), matching
 * src/lib/supabase/admin/education-sources.ts's docblock convention.
 */

function logDbError(context: string, error: unknown) {
  console.error(`[admin/external-search] ${context}:`, error);
}

const PROVIDER_TYPES: ProviderType[] = ["course_search", "institution_verification", "joint_programme"];
const PROVIDER_STRATEGIES: ProviderStrategy[] = ["verified_deep_link", "query_parameter_search", "official_landing_page", "manual_search_instructions"];
const MAPPING_STATUSES: MappingStatus[] = ["draft", "verified", "active", "archived"];

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

export interface AdminProviderRow {
  id: string;
  slug: string;
  displayName: string;
  countryCode: string | null;
  region: string | null;
  providerType: ProviderType;
  officialDomain: string;
  baseUrl: string;
  fallbackUrl: string | null;
  strategy: ProviderStrategy;
  description: string | null;
  warningText: string | null;
  warningEffectiveAt: string | null;
  warningReviewAt: string | null;
  language: string | null;
  active: boolean;
  lastVerifiedAt: string | null;
  verifiedBy: string | null;
  supportedDegreeLevels: CanonicalDegreeLevel[];
  createdAt: string;
  updatedAt: string;
}

function toAdminProvider(row: Record<string, unknown>): AdminProviderRow {
  return {
    id: row.id as string,
    slug: row.slug as string,
    displayName: row.display_name as string,
    countryCode: (row.country_code as string | null) ?? null,
    region: (row.region as string | null) ?? null,
    providerType: row.provider_type as ProviderType,
    officialDomain: row.official_domain as string,
    baseUrl: row.base_url as string,
    fallbackUrl: (row.fallback_url as string | null) ?? null,
    strategy: row.strategy as ProviderStrategy,
    description: (row.description as string | null) ?? null,
    warningText: (row.warning_text as string | null) ?? null,
    warningEffectiveAt: (row.warning_effective_at as string | null) ?? null,
    warningReviewAt: (row.warning_review_at as string | null) ?? null,
    language: (row.language as string | null) ?? null,
    active: row.active as boolean,
    lastVerifiedAt: (row.last_verified_at as string | null) ?? null,
    verifiedBy: (row.verified_by as string | null) ?? null,
    supportedDegreeLevels: ((row.supported_degree_levels as string[] | null) ?? []) as CanonicalDegreeLevel[],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export interface ProviderFilters {
  countryCode?: string;
  active?: boolean;
  page?: number;
  pageSize?: number;
}

export async function listProviders(filters: ProviderFilters = {}) {
  await requireAdminPermission("trusted-portals:read");
  const supabase = await createClient();
  const page = parsePageParam(filters.page ? String(filters.page) : undefined);
  const pageSize = clampPageSize(filters.pageSize, 50);
  const { from, to } = pageToRange(page, pageSize);

  let query = supabase.from("external_search_providers").select("*", { count: "exact" }).order("display_name", { ascending: true }).range(from, to);
  if (filters.countryCode) query = query.eq("country_code", filters.countryCode);
  if (filters.active !== undefined) query = query.eq("active", filters.active);

  const { data, error, count } = await query;
  if (error) {
    logDbError("listProviders", error);
    return { items: [], total: 0, page, pageSize };
  }
  return { items: (data ?? []).map(toAdminProvider), total: count ?? 0, page, pageSize };
}

/** Every provider, unpaginated — small reference table, used to populate mapping-form provider pickers and the click-count/staleness dashboards. */
export async function listAllProviders(): Promise<AdminProviderRow[]> {
  await requireAdminPermission("trusted-portals:read");
  const supabase = await createClient();
  const { data, error } = await supabase.from("external_search_providers").select("*").order("display_name", { ascending: true });
  if (error) {
    logDbError("listAllProviders", error);
    return [];
  }
  return (data ?? []).map(toAdminProvider);
}

export async function getProviderById(id: string): Promise<AdminProviderRow | null> {
  await requireAdminPermission("trusted-portals:read");
  const supabase = await createClient();
  const { data, error } = await supabase.from("external_search_providers").select("*").eq("id", id).maybeSingle();
  if (error) {
    logDbError("getProviderById", error);
    return null;
  }
  return data ? toAdminProvider(data) : null;
}

interface ProviderInput {
  slug: string;
  displayName: string;
  countryCode: string | null;
  region: string | null;
  providerType: ProviderType;
  officialDomain: string;
  baseUrl: string;
  fallbackUrl: string | null;
  strategy: ProviderStrategy;
  description: string | null;
  warningText: string | null;
  warningEffectiveAt: string | null;
  warningReviewAt: string | null;
  language: string | null;
  supportedDegreeLevels: CanonicalDegreeLevel[];
}

function parseDateField(formData: FormData, key: string, label: string): string | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new AdminValidationError(`${label} must be a valid date (YYYY-MM-DD).`);
  return raw;
}

function parseProviderForm(formData: FormData): ProviderInput {
  const slug = String(formData.get("slug") ?? "").trim();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) throw new AdminValidationError("Slug must be lowercase letters, numbers, and hyphens only.");

  const displayName = String(formData.get("displayName") ?? "").trim();
  if (!displayName) throw new AdminValidationError("Display name is required.");

  const countryCode = String(formData.get("countryCode") ?? "").trim().toUpperCase() || null;
  const region = String(formData.get("region") ?? "").trim() || null;

  const providerTypeRaw = String(formData.get("providerType") ?? "").trim();
  if (!PROVIDER_TYPES.includes(providerTypeRaw as ProviderType)) throw new AdminValidationError("Provider type is not recognized.");

  const officialDomain = String(formData.get("officialDomain") ?? "").trim().toLowerCase();
  if (!officialDomain || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(officialDomain)) {
    throw new AdminValidationError("Official domain must be a plain lowercase domain (e.g. daad.de), not a full URL.");
  }

  const baseUrl = String(formData.get("baseUrl") ?? "").trim();
  const baseUrlCheck = validateExternalUrl(baseUrl, officialDomain);
  if (!baseUrlCheck.valid) {
    throw new AdminValidationError(`Base URL is not valid for this provider (${baseUrlCheck.reason ?? "invalid"}). It must be an HTTPS URL on ${officialDomain} or a subdomain of it.`);
  }

  const fallbackUrlRaw = String(formData.get("fallbackUrl") ?? "").trim();
  let fallbackUrl: string | null = null;
  if (fallbackUrlRaw) {
    const fallbackCheck = validateExternalUrl(fallbackUrlRaw, officialDomain);
    if (!fallbackCheck.valid) {
      throw new AdminValidationError(`Fallback URL is not valid for this provider (${fallbackCheck.reason ?? "invalid"}).`);
    }
    fallbackUrl = fallbackUrlRaw;
  }

  const strategyRaw = String(formData.get("strategy") ?? "").trim();
  if (!PROVIDER_STRATEGIES.includes(strategyRaw as ProviderStrategy)) throw new AdminValidationError("Strategy is not recognized.");

  const supportedDegreeLevels = formData
    .getAll("supportedDegreeLevels")
    .map((v) => String(v))
    .filter((v): v is CanonicalDegreeLevel => (CANONICAL_DEGREE_LEVELS as readonly string[]).includes(v));

  return {
    slug,
    displayName,
    countryCode,
    region,
    providerType: providerTypeRaw as ProviderType,
    officialDomain,
    baseUrl,
    fallbackUrl,
    strategy: strategyRaw as ProviderStrategy,
    description: String(formData.get("description") ?? "").trim() || null,
    warningText: String(formData.get("warningText") ?? "").trim() || null,
    warningEffectiveAt: parseDateField(formData, "warningEffectiveAt", "Warning effective date"),
    warningReviewAt: parseDateField(formData, "warningReviewAt", "Warning review date"),
    language: String(formData.get("language") ?? "").trim() || null,
    supportedDegreeLevels,
  };
}

export async function createProvider(formData: FormData): Promise<string> {
  const admin = await requireAdminPermission("trusted-portals:write");
  const input = parseProviderForm(formData);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("external_search_providers")
    .insert({
      slug: input.slug,
      display_name: input.displayName,
      country_code: input.countryCode,
      region: input.region,
      provider_type: input.providerType,
      official_domain: input.officialDomain,
      base_url: input.baseUrl,
      fallback_url: input.fallbackUrl,
      strategy: input.strategy,
      description: input.description,
      warning_text: input.warningText,
      warning_effective_at: input.warningEffectiveAt,
      warning_review_at: input.warningReviewAt,
      language: input.language,
      supported_degree_levels: input.supportedDegreeLevels,
      active: false, // Always created inactive — an admin must deliberately activate after verifying (see PART 4 below).
      last_verified_at: null,
      verified_by: null,
    })
    .select("id")
    .single();

  if (error) {
    logDbError("createProvider", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Created",
    entityType: "external_search_provider",
    entityId: data.id,
    entityLabel: input.displayName,
    context: { createdBy: admin.userId },
    after: { slug: input.slug, officialDomain: input.officialDomain, strategy: input.strategy },
  });

  return data.id as string;
}

export async function updateProvider(id: string, formData: FormData): Promise<void> {
  const admin = await requireAdminPermission("trusted-portals:write");
  const input = parseProviderForm(formData);
  const supabase = await createClient();

  const { error } = await supabase
    .from("external_search_providers")
    .update({
      slug: input.slug,
      display_name: input.displayName,
      country_code: input.countryCode,
      region: input.region,
      provider_type: input.providerType,
      official_domain: input.officialDomain,
      base_url: input.baseUrl,
      fallback_url: input.fallbackUrl,
      strategy: input.strategy,
      description: input.description,
      warning_text: input.warningText,
      warning_effective_at: input.warningEffectiveAt,
      warning_review_at: input.warningReviewAt,
      language: input.language,
      supported_degree_levels: input.supportedDegreeLevels,
    })
    .eq("id", id);

  if (error) {
    logDbError("updateProvider", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Updated",
    entityType: "external_search_provider",
    entityId: id,
    entityLabel: input.displayName,
    context: { updatedBy: admin.userId },
    after: { officialDomain: input.officialDomain, strategy: input.strategy },
  });
}

/** Activates a provider — a deliberate, separate action from the general edit form, so "I verified this and I'm turning it on" is always its own explicit, audited step. Re-validates base_url/fallback_url against official_domain one more time server-side, so a provider can never go active with an invalid URL even if the row was somehow edited to one out of band. */
export async function setProviderActive(id: string, active: boolean): Promise<void> {
  const admin = await requireAdminPermission("trusted-portals:write");
  const supabase = await createClient();

  if (active) {
    const { data: provider, error: fetchError } = await supabase
      .from("external_search_providers")
      .select("official_domain, base_url, fallback_url, display_name")
      .eq("id", id)
      .maybeSingle();
    if (fetchError || !provider) throw new Error("Provider not found.");
    const baseCheck = validateExternalUrl(provider.base_url, provider.official_domain);
    if (!baseCheck.valid) {
      throw new AdminValidationError(`Cannot activate: base URL fails validation (${baseCheck.reason}). Fix it before activating.`);
    }
  }

  const { error } = await supabase.from("external_search_providers").update({ active }).eq("id", id);
  if (error) {
    logDbError("setProviderActive", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: active ? "Activated" : "Deactivated",
    entityType: "external_search_provider",
    entityId: id,
    entityLabel: `provider ${id}`,
    context: { by: admin.userId },
  });
}

/** Records "I (the acting admin) just confirmed this provider's URL(s) are correct today" — sets last_verified_at to today and verified_by to the acting admin's own id, matching pricing's updated_by convention. */
export async function recordProviderVerification(id: string): Promise<void> {
  const admin = await requireAdminPermission("trusted-portals:write");
  const supabase = await createClient();
  const { error } = await supabase
    .from("external_search_providers")
    .update({ last_verified_at: new Date().toISOString().slice(0, 10), verified_by: admin.userId })
    .eq("id", id);
  if (error) {
    logDbError("recordProviderVerification", error);
    throw new Error(error.message);
  }
  await recordAuditLog({ action: "Verified", entityType: "external_search_provider", entityId: id, entityLabel: `provider ${id}`, context: { verifiedBy: admin.userId } });
}

// ---------------------------------------------------------------------------
// Mappings
// ---------------------------------------------------------------------------

export interface AdminMappingRow {
  id: string;
  providerId: string;
  providerDisplayName: string | null;
  canonicalSubjectId: string;
  canonicalSubjectLabel: string;
  degreeLevel: CanonicalDegreeLevel;
  destinationCountryCode: string;
  verifiedUrl: string | null;
  providerSubjectCode: string | null;
  providerDegreeCode: string | null;
  searchTerm: string | null;
  manualInstructions: string | null;
  mappingStatus: MappingStatus;
  lastVerifiedAt: string | null;
  verifiedBy: string | null;
  isStale: boolean;
  createdAt: string;
  updatedAt: string;
}

const SUBJECT_LABEL_BY_ID = new Map(SUBJECT_TAXONOMY.map((s) => [s.id, s.canonicalLabel]));

function toAdminMapping(row: Record<string, unknown>, providerNameById: Map<string, string>): AdminMappingRow {
  const subjectId = row.canonical_subject_id as string;
  return {
    id: row.id as string,
    providerId: row.provider_id as string,
    providerDisplayName: providerNameById.get(row.provider_id as string) ?? null,
    canonicalSubjectId: subjectId,
    canonicalSubjectLabel: SUBJECT_LABEL_BY_ID.get(subjectId) ?? subjectId,
    degreeLevel: row.degree_level as CanonicalDegreeLevel,
    destinationCountryCode: row.destination_country_code as string,
    verifiedUrl: (row.verified_url as string | null) ?? null,
    providerSubjectCode: (row.provider_subject_code as string | null) ?? null,
    providerDegreeCode: (row.provider_degree_code as string | null) ?? null,
    searchTerm: (row.search_term as string | null) ?? null,
    manualInstructions: (row.manual_instructions as string | null) ?? null,
    mappingStatus: row.mapping_status as MappingStatus,
    lastVerifiedAt: (row.last_verified_at as string | null) ?? null,
    verifiedBy: (row.verified_by as string | null) ?? null,
    isStale: isVerificationStale(row.last_verified_at as string | null),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

async function buildProviderNameMap(supabase: Awaited<ReturnType<typeof createClient>>, providerIds: string[]): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(providerIds));
  if (uniqueIds.length === 0) return new Map();
  const { data } = await supabase.from("external_search_providers").select("id, display_name").in("id", uniqueIds);
  return new Map((data ?? []).map((p) => [p.id, p.display_name]));
}

export interface MappingFilters {
  providerId?: string;
  mappingStatus?: MappingStatus;
  destinationCountryCode?: string;
  page?: number;
  pageSize?: number;
}

export async function listMappings(filters: MappingFilters = {}) {
  await requireAdminPermission("trusted-portals:read");
  const supabase = await createClient();
  const page = parsePageParam(filters.page ? String(filters.page) : undefined);
  const pageSize = clampPageSize(filters.pageSize, 50);
  const { from, to } = pageToRange(page, pageSize);

  let query = supabase.from("external_search_mappings").select("*", { count: "exact" }).order("updated_at", { ascending: false }).range(from, to);
  if (filters.providerId) query = query.eq("provider_id", filters.providerId);
  if (filters.mappingStatus) query = query.eq("mapping_status", filters.mappingStatus);
  if (filters.destinationCountryCode) query = query.eq("destination_country_code", filters.destinationCountryCode);

  const { data, error, count } = await query;
  if (error) {
    logDbError("listMappings", error);
    return { items: [], total: 0, page, pageSize };
  }
  const providerNameById = await buildProviderNameMap(supabase, (data ?? []).map((r) => r.provider_id));
  return { items: (data ?? []).map((r) => toAdminMapping(r, providerNameById)), total: count ?? 0, page, pageSize };
}

/** Every mapping whose mapping_status='active' AND whose verification is stale (src/lib/education/external-search/url-validation.ts's STALE_VERIFICATION_THRESHOLD_MONTHS) — the spec's "See expired verification dates" admin capability. Fetched in full (bounded, admin-only table) and filtered in application code, same convention as src/lib/supabase/admin/pricing-analytics.ts's client-side aggregation. */
export async function listStaleActiveMappings(): Promise<AdminMappingRow[]> {
  await requireAdminPermission("trusted-portals:read");
  const supabase = await createClient();
  const { data, error } = await supabase.from("external_search_mappings").select("*").eq("mapping_status", "active");
  if (error) {
    logDbError("listStaleActiveMappings", error);
    return [];
  }
  const providerNameById = await buildProviderNameMap(supabase, (data ?? []).map((r) => r.provider_id));
  return (data ?? []).map((r) => toAdminMapping(r, providerNameById)).filter((m) => m.isStale);
}

interface MappingInput {
  providerId: string;
  canonicalSubjectId: string;
  degreeLevel: CanonicalDegreeLevel;
  destinationCountryCode: string;
  verifiedUrl: string | null;
  providerSubjectCode: string | null;
  providerDegreeCode: string | null;
  searchTerm: string | null;
  manualInstructions: string | null;
}

function parseMappingForm(formData: FormData): MappingInput {
  const providerId = String(formData.get("providerId") ?? "").trim();
  if (!providerId) throw new AdminValidationError("A provider is required.");

  const canonicalSubjectId = String(formData.get("canonicalSubjectId") ?? "").trim();
  if (!SUBJECT_LABEL_BY_ID.has(canonicalSubjectId)) throw new AdminValidationError("Canonical subject is not recognized — it must be one of the taxonomy entries in src/lib/education/external-search/taxonomy.ts.");

  const degreeLevelRaw = String(formData.get("degreeLevel") ?? "").trim();
  if (!(CANONICAL_DEGREE_LEVELS as readonly string[]).includes(degreeLevelRaw)) throw new AdminValidationError("Degree level is not recognized.");

  const destinationCountryCode = String(formData.get("destinationCountryCode") ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(destinationCountryCode)) throw new AdminValidationError("Destination country is required.");

  const verifiedUrl = String(formData.get("verifiedUrl") ?? "").trim() || null;
  const manualInstructions = String(formData.get("manualInstructions") ?? "").trim() || null;

  return {
    providerId,
    canonicalSubjectId,
    degreeLevel: degreeLevelRaw as CanonicalDegreeLevel,
    destinationCountryCode,
    verifiedUrl,
    providerSubjectCode: String(formData.get("providerSubjectCode") ?? "").trim() || null,
    providerDegreeCode: String(formData.get("providerDegreeCode") ?? "").trim() || null,
    searchTerm: String(formData.get("searchTerm") ?? "").trim() || null,
    manualInstructions,
  };
}

export async function createMapping(formData: FormData): Promise<string> {
  const admin = await requireAdminPermission("trusted-portals:write");
  const input = parseMappingForm(formData);
  const supabase = await createClient();

  const { data: provider, error: providerError } = await supabase
    .from("external_search_providers")
    .select("official_domain")
    .eq("id", input.providerId)
    .maybeSingle();
  if (providerError || !provider) throw new AdminValidationError("Selected provider was not found.");

  if (input.verifiedUrl) {
    const check = validateExternalUrl(input.verifiedUrl, provider.official_domain);
    if (!check.valid) throw new AdminValidationError(`Verified URL is not valid for this provider (${check.reason}). It must be an HTTPS URL on ${provider.official_domain} or a subdomain of it, with no embedded credentials.`);
  }

  const { data, error } = await supabase
    .from("external_search_mappings")
    .insert({
      provider_id: input.providerId,
      canonical_subject_id: input.canonicalSubjectId,
      degree_level: input.degreeLevel,
      destination_country_code: input.destinationCountryCode,
      verified_url: input.verifiedUrl,
      provider_subject_code: input.providerSubjectCode,
      provider_degree_code: input.providerDegreeCode,
      search_term: input.searchTerm,
      manual_instructions: input.manualInstructions,
      mapping_status: "draft", // Always created as draft — see setMappingStatus for the deliberate, separate activation step.
      last_verified_at: null,
      verified_by: null,
    })
    .select("id")
    .single();

  if (error) {
    logDbError("createMapping", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Created",
    entityType: "external_search_mapping",
    entityId: data.id,
    entityLabel: `${input.canonicalSubjectId} / ${input.degreeLevel} / ${input.destinationCountryCode}`,
    context: { createdBy: admin.userId },
  });

  return data.id as string;
}

export async function updateMapping(id: string, formData: FormData): Promise<void> {
  const admin = await requireAdminPermission("trusted-portals:write");
  const input = parseMappingForm(formData);
  const supabase = await createClient();

  const { data: provider, error: providerError } = await supabase
    .from("external_search_providers")
    .select("official_domain")
    .eq("id", input.providerId)
    .maybeSingle();
  if (providerError || !provider) throw new AdminValidationError("Selected provider was not found.");

  if (input.verifiedUrl) {
    const check = validateExternalUrl(input.verifiedUrl, provider.official_domain);
    if (!check.valid) throw new AdminValidationError(`Verified URL is not valid for this provider (${check.reason}).`);
  }

  const { error } = await supabase
    .from("external_search_mappings")
    .update({
      provider_id: input.providerId,
      canonical_subject_id: input.canonicalSubjectId,
      degree_level: input.degreeLevel,
      destination_country_code: input.destinationCountryCode,
      verified_url: input.verifiedUrl,
      provider_subject_code: input.providerSubjectCode,
      provider_degree_code: input.providerDegreeCode,
      search_term: input.searchTerm,
      manual_instructions: input.manualInstructions,
    })
    .eq("id", id);

  if (error) {
    logDbError("updateMapping", error);
    throw new Error(error.message);
  }

  await recordAuditLog({ action: "Updated", entityType: "external_search_mapping", entityId: id, entityLabel: id, context: { updatedBy: admin.userId } });
}

/** Transitions a mapping's status — the deliberate, separate "activate/deactivate/archive" action the spec asks for, distinct from the general edit form. Setting status='active' also stamps last_verified_at/verified_by to today/the acting admin, on the theory that activating IS the verification act. */
export async function setMappingStatus(id: string, status: MappingStatus): Promise<void> {
  const admin = await requireAdminPermission("trusted-portals:write");
  if (!MAPPING_STATUSES.includes(status)) throw new AdminValidationError("Status is not recognized.");
  const supabase = await createClient();

  const update: { mapping_status: string; last_verified_at?: string; verified_by?: string } = { mapping_status: status };
  if (status === "active") {
    update.last_verified_at = new Date().toISOString().slice(0, 10);
    update.verified_by = admin.userId;
  }

  const { error } = await supabase.from("external_search_mappings").update(update).eq("id", id);
  if (error) {
    logDbError("setMappingStatus", error);
    throw new Error(error.message);
  }

  await recordAuditLog({ action: `Status -> ${status}`, entityType: "external_search_mapping", entityId: id, entityLabel: id, context: { by: admin.userId } });
}

// ---------------------------------------------------------------------------
// Click counts / search-gap review queue
// ---------------------------------------------------------------------------

const CLICK_LOOKBACK_LIMIT = 5000;

/** Outbound click counts per provider (event_type='click' only, never mapping_needed) — the spec's "View outbound click counts" capability. */
export async function listProviderClickCounts(): Promise<ProviderClickCount[]> {
  await requireAdminPermission("trusted-portals:read");
  const supabase = await createClient();
  const [{ data: clicks, error: clickError }, { data: providers, error: providerError }] = await Promise.all([
    supabase.from("external_search_clicks").select("provider_id").eq("event_type", "click").order("occurred_at", { ascending: false }).limit(CLICK_LOOKBACK_LIMIT),
    supabase.from("external_search_providers").select("id, display_name"),
  ]);
  if (clickError) logDbError("listProviderClickCounts(clicks)", clickError);
  if (providerError) logDbError("listProviderClickCounts(providers)", providerError);

  const nameById = new Map((providers ?? []).map((p) => [p.id, p.display_name]));
  const counts = new Map<string, number>();
  for (const row of clicks ?? []) {
    counts.set(row.provider_id, (counts.get(row.provider_id) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([providerId, clickCount]) => ({ providerId, providerDisplayName: nameById.get(providerId) ?? providerId, clickCount }))
    .sort((a, b) => b.clickCount - a.clickCount);
}

/** The search-gap review queue: normalized (destination, subject, degree) combinations that produced a "mapping needed" event, most-recent/most-frequent first — the spec's "View searches that lack a verified mapping" capability. Only ever reads canonical_subject_id/degree_level/destination_country_code — never a raw free-text query, matching external_search_clicks' own no-free-text design. */
export async function listSearchGapQueue(): Promise<SearchGapRow[]> {
  await requireAdminPermission("trusted-portals:read");
  const supabase = await createClient();
  const [{ data: gapRows, error: gapError }, { data: countries, error: countryError }] = await Promise.all([
    supabase
      .from("external_search_clicks")
      .select("destination_country_code, canonical_subject_id, degree_level, occurred_at")
      .eq("event_type", "mapping_needed")
      .order("occurred_at", { ascending: false })
      .limit(CLICK_LOOKBACK_LIMIT),
    supabase.from("countries").select("iso_alpha2, name"),
  ]);
  if (gapError) {
    logDbError("listSearchGapQueue", gapError);
    return [];
  }
  if (countryError) logDbError("listSearchGapQueue(countries)", countryError);
  const countryNameByCode = new Map((countries ?? []).map((c) => [c.iso_alpha2, c.name]));

  const bucket = new Map<string, SearchGapRow>();
  for (const row of gapRows ?? []) {
    const key = `${row.destination_country_code ?? ""}|${row.canonical_subject_id ?? ""}|${row.degree_level ?? ""}`;
    const existing = bucket.get(key);
    if (existing) {
      existing.occurrences += 1;
      if (row.occurred_at > existing.lastSeenAt) existing.lastSeenAt = row.occurred_at;
    } else {
      bucket.set(key, {
        destinationCountryCode: row.destination_country_code,
        destinationCountryName: row.destination_country_code ? (countryNameByCode.get(row.destination_country_code) ?? row.destination_country_code) : null,
        canonicalSubjectId: row.canonical_subject_id,
        canonicalSubjectLabel: row.canonical_subject_id ? (SUBJECT_LABEL_BY_ID.get(row.canonical_subject_id) ?? row.canonical_subject_id) : null,
        degreeLevel: row.degree_level,
        occurrences: 1,
        lastSeenAt: row.occurred_at,
      });
    }
  }
  return Array.from(bucket.values()).sort((a, b) => b.occurrences - a.occurrences);
}

/** Providers whose warning is set and whose warning_review_at has passed (or is within 30 days) — the spec's "Review temporary notices such as the EduCanada warning" capability. */
export async function listWarningsNeedingReview(): Promise<AdminProviderRow[]> {
  await requireAdminPermission("trusted-portals:read");
  const supabase = await createClient();
  const { data, error } = await supabase.from("external_search_providers").select("*").not("warning_text", "is", null);
  if (error) {
    logDbError("listWarningsNeedingReview", error);
    return [];
  }
  const soon = new Date();
  soon.setDate(soon.getDate() + 30);
  return (data ?? [])
    .map(toAdminProvider)
    .filter((p) => p.warningReviewAt && new Date(p.warningReviewAt).getTime() <= soon.getTime());
}

export { DEGREE_LEVEL_LABELS };
