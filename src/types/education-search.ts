/**
 * Trusted Global Course Search — camelCase types mirroring
 * supabase/migrations/0009_trusted_course_search.sql. Mirrors the existing
 * convention in src/types/education.ts/src/types/pricing.ts: this file
 * only defines shapes, never talks to Supabase itself (that lives in
 * src/lib/supabase/education/external-search.ts and
 * src/lib/supabase/admin/external-search.ts).
 *
 * The pure provider-adapter types (ProviderRecord/MappingRecord/
 * AdapterResult/ProviderStrategy/...) live in
 * src/lib/education/external-search/provider-types.ts, deliberately kept
 * framework-free and DB-agnostic — re-exported here so callers only need
 * one import path for "everything about a trusted-search provider".
 */

export type {
  ProviderRecord as ExternalSearchProvider,
  MappingRecord as ExternalSearchMapping,
  AdapterResult as ExternalSearchAdapterResult,
  AdapterOutcome as ExternalSearchAdapterOutcome,
  AdapterUnavailable as ExternalSearchAdapterUnavailable,
  AppliedFilter as ExternalSearchAppliedFilter,
  ProviderStrategy,
  MappingStatus,
} from "@/lib/education/external-search/provider-types";
export { PROVIDER_STRATEGIES, MAPPING_STATUSES } from "@/lib/education/external-search/provider-types";
export type { CanonicalDegreeLevel, SubjectTaxonomyEntry, SubjectResolution } from "@/lib/education/external-search/taxonomy";
export { CANONICAL_DEGREE_LEVELS, DEGREE_LEVEL_LABELS, SUBJECT_TAXONOMY } from "@/lib/education/external-search/taxonomy";

export const PROVIDER_TYPES = ["course_search", "institution_verification", "joint_programme"] as const;
export type ProviderType = (typeof PROVIDER_TYPES)[number];

export const EXTERNAL_SEARCH_EVENT_TYPES = ["click", "mapping_needed"] as const;
export type ExternalSearchEventType = (typeof EXTERNAL_SEARCH_EVENT_TYPES)[number];

export const EXTERNAL_SEARCH_SOURCE_PAGES = ["courses_search", "course_detail", "admin_test_link"] as const;
export type ExternalSearchSourcePage = (typeof EXTERNAL_SEARCH_SOURCE_PAGES)[number];

export interface ExternalSearchClickRecord {
  id: string;
  providerId: string;
  providerDisplayName: string | null;
  mappingId: string | null;
  canonicalSubjectId: string | null;
  degreeLevel: string | null;
  destinationCountryCode: string | null;
  sourcePage: ExternalSearchSourcePage;
  eventType: ExternalSearchEventType;
  userId: string | null;
  sessionRef: string | null;
  occurredAt: string;
}

/** Per-provider outbound click counts for the admin dashboard — click events only (event_type='click'), never mapping_needed. */
export interface ProviderClickCount {
  providerId: string;
  providerDisplayName: string;
  clickCount: number;
}

/** One row in the admin "search-gap review queue" — a normalized (destination, subject, degree) combination that has been seen as a mapping_needed event, with how many times and when most recently. */
export interface SearchGapRow {
  destinationCountryCode: string | null;
  destinationCountryName: string | null;
  canonicalSubjectId: string | null;
  canonicalSubjectLabel: string | null;
  degreeLevel: string | null;
  occurrences: number;
  lastSeenAt: string;
}

// Shared list-page shape (mirrors src/types/admin.ts's AdminListResult).
export interface ExternalSearchListResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
