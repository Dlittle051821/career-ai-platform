/**
 * Trusted Global Course Search — shared plain-object shapes for the
 * provider-adapter layer (src/lib/education/external-search/adapter.ts).
 * These mirror supabase/migrations/0009_trusted_course_search.sql's two
 * tables (external_search_providers/external_search_mappings) in
 * camelCase, but are intentionally decoupled from any specific ORM/query
 * result type — the adapter is pure and framework-free, and takes these
 * plain objects however the caller (src/lib/supabase/education/
 * external-search.ts, or a unit test) constructs them.
 */

import type { CanonicalDegreeLevel } from "./taxonomy";

export const PROVIDER_STRATEGIES = ["verified_deep_link", "query_parameter_search", "official_landing_page", "manual_search_instructions"] as const;
export type ProviderStrategy = (typeof PROVIDER_STRATEGIES)[number];

export const MAPPING_STATUSES = ["draft", "verified", "active", "archived"] as const;
export type MappingStatus = (typeof MAPPING_STATUSES)[number];

export interface ProviderRecord {
  id: string;
  slug: string;
  displayName: string;
  /** ISO alpha-2, or null for a provider not tied to one destination country (e.g. Erasmus Mundus, a Europe-wide joint-programme provider). */
  countryCode: string | null;
  region: string | null;
  providerType: string;
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
  /** Empty array = no restriction (every canonical degree level may use this provider). Non-empty = ONLY these levels — e.g. Erasmus Mundus is restricted to ["masters"], so it is never offered as a Bachelor's-level result. */
  supportedDegreeLevels: CanonicalDegreeLevel[];
}

export interface MappingRecord {
  id: string;
  providerId: string;
  canonicalSubjectId: string;
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
}

export interface AppliedFilter {
  label: string;
  value: string;
}

export type AdapterUnavailableReason =
  | "provider_inactive"
  | "degree_level_not_supported"
  | "no_valid_url_available";

export interface AdapterResult {
  available: true;
  providerId: string;
  providerSlug: string;
  providerDisplayName: string;
  officialDomain: string;
  region: string | null;
  countryCode: string | null;
  /** The single URL this result should send the student to — already passed through validateExternalUrl(). */
  url: string;
  canonicalSubjectId: string | null;
  canonicalSubjectLabel: string | null;
  degreeLevel: CanonicalDegreeLevel | null;
  degreeLevelLabel: string | null;
  appliedFilters: AppliedFilter[];
  /** True only when `url` is a genuine, subject+degree-filtered deep link (strategy verified_deep_link/query_parameter_search backed by an active, non-stale, validated mapping). */
  isFiltered: boolean;
  /** True whenever the student must use the provider's own search UI themselves — always true unless isFiltered is true. */
  requiresManualSearch: boolean;
  /** Plain-language instructions for what to search/select once on the provider's site — populated whenever requiresManualSearch is true. */
  instructions: string | null;
  /** Currently-effective warning text for this provider, or null. */
  warningText: string | null;
  /** The most relevant "last verified" date to show for whatever `url` is (mapping's own date when filtered, else the provider's). */
  linkVerificationDate: string | null;
  strategyUsed: ProviderStrategy;
  /** Null when this result did not come from a specific stored mapping row (landing-page/manual fallback). */
  mappingId: string | null;
  /** Whether the verification date behind `url` is currently stale — informational; a stale deep link is never surfaced as filtered in the first place (see adapter.ts), so this is only ever true for a landing-page/manual result whose provider-level verification has lapsed. */
  isStale: boolean;
}

export interface AdapterUnavailable {
  available: false;
  reason: AdapterUnavailableReason;
  providerId: string;
}

export type AdapterOutcome = AdapterResult | AdapterUnavailable;
