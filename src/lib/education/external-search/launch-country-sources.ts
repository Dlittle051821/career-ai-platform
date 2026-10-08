/**
 * M20A — Launch Country Trusted Source Registry.
 *
 * Pure, framework-free configuration: no DB access, no side effects, same
 * convention as launch-countries.ts/taxonomy.ts/url-validation.ts. This
 * module answers exactly one question — "for this Tier 1 launch country,
 * which ONE external_search_providers row is THE primary trusted source?"
 * — and nothing else. It does not fetch, cache, or duplicate a provider's
 * live data (name/URL/active state/last-verified date all continue to
 * live solely in public.external_search_providers, the table M20A
 * confirmed already exists and already supports every field this
 * registry needs — see docs/m20a-trusted-country-source-registry.md
 * "Existing architecture found"). This file only RE-LABELS which already-
 * seeded provider row is the launch-primary one for each country — the
 * same "re-label, never re-derive" discipline UX09's work-queue module
 * and PathwayGraphic established (a caller supplies state from data that
 * already exists; this module never invents new facts about a provider).
 *
 * WHY A SEPARATE CONFIG FILE RATHER THAN A NEW DB COLUMN: the existing
 * external_search_providers table intentionally allows MANY provider rows
 * per country (the architecture's own design — "additional specialist
 * sources can be added later" per this milestone's own brief, and the
 * existing seed already carries multiple EU country rows). "Which one is
 * THIS MILESTONE'S single launch-primary for these six specific
 * countries" is a narrower, M20-specific product decision that doesn't
 * belong on the general-purpose provider table — adding an
 * `is_launch_primary` column there would conflate "is generally the main
 * provider for a country" (a fact about the provider) with "is one of the
 * six countries Nextwise is launching trusted-fallback support for right
 * now" (a fact about this milestone's own rollout), and would need a
 * migration to boot. Keeping the designation here, as plain data keyed by
 * `providerSlug`, needs none — see this milestone's own completion report
 * for why NO migration was required anywhere in M20A.
 *
 * SOURCE SELECTION RULE (M20A's own spec): exactly one primary source per
 * Tier 1 launch country — never two competing primaries. Enforced below
 * by LAUNCH_COUNTRY_PRIMARY_SOURCES itself (exactly one entry per
 * LaunchCountryCode) and exercised by this module's own test file
 * (launch-country-sources.test.ts asserts no duplicate countryCode and no
 * duplicate providerSlug across the whole list).
 */

import { LAUNCH_COUNTRY_CODES, LAUNCH_COUNTRY_NAMES, normalizeLaunchCountryCode, type LaunchCountryCode } from "./launch-countries";

export interface LaunchCountryPrimarySource {
  countryCode: LaunchCountryCode;
  /** Mirrors LAUNCH_COUNTRY_NAMES[countryCode] — duplicated here (rather than looked up at call sites) so a single destructure of one entry carries everything a caller needs for display, without a second import. */
  countryName: string;
  /**
   * The exact `slug` of the public.external_search_providers row this
   * country's launch-primary source is. Resolving slug -> the row's live
   * displayName/baseUrl/active/lastVerifiedAt is the data-access layer's
   * job (src/lib/supabase/education/external-search.ts /
   * src/lib/supabase/admin/external-search.ts), not this module's — this
   * module never talks to Supabase.
   */
  providerSlug: string;
  /**
   * The external authority that owns/runs this source — plain
   * attribution text, never implying Nextwise owns or partners with it
   * (see attribution.ts for the shared wording rules this string must
   * stay compatible with).
   */
  authority: string;
  /** The exact "Primary domain" this milestone's own task brief specified for this country — must match the provider row's official_domain seeded for `providerSlug` (asserted by this module's migration-security-style seed-consistency test). */
  primaryDomain: string;
  /** Why this source is useful to a student — mirrors (and must stay consistent with) the provider row's own `description` column. */
  purpose: string;
}

/**
 * Exactly six entries — one per LAUNCH_COUNTRY_CODES, in the same order.
 * Germany's source (DAAD International Programmes) already existed in
 * the architecture this milestone discovered — seeded `active = true`
 * with a real verified deep link by
 * supabase/seed/0006_trusted_course_search_seed.sql — and is reused
 * as-is, unmodified. The other five are new provider rows added by
 * supabase/seed/0008_m20a_launch_country_sources_seed.sql (this
 * milestone's own seed file; see that file's header for why each was
 * seeded `active = true` rather than left pending admin verification).
 */
export const LAUNCH_COUNTRY_PRIMARY_SOURCES: readonly LaunchCountryPrimarySource[] = [
  {
    countryCode: "DE",
    countryName: LAUNCH_COUNTRY_NAMES.DE,
    providerSlug: "daad-international-programmes",
    authority: "DAAD — German Academic Exchange Service",
    primaryDomain: "daad.de",
    purpose: "International study guidance, programme discovery, and admission guidance for studying in Germany.",
  },
  {
    countryCode: "GB",
    countryName: LAUNCH_COUNTRY_NAMES.GB,
    providerSlug: "study-uk-british-council",
    authority: "Study UK — British Council",
    primaryDomain: "study-uk.britishcouncil.org",
    purpose: "National study guidance, course and university guidance, and application guidance for studying in the UK.",
  },
  {
    countryCode: "US",
    countryName: LAUNCH_COUNTRY_NAMES.US,
    providerSlug: "educationusa",
    authority: "EducationUSA",
    primaryDomain: "educationusa.state.gov",
    purpose: "Official U.S. higher-education guidance for international students.",
  },
  {
    countryCode: "CA",
    countryName: LAUNCH_COUNTRY_NAMES.CA,
    providerSlug: "government-of-canada-study",
    authority: "Government of Canada",
    primaryDomain: "canada.ca",
    purpose: "International student study guidance, school selection, and study permit information for studying in Canada.",
  },
  {
    countryCode: "AU",
    countryName: LAUNCH_COUNTRY_NAMES.AU,
    providerSlug: "study-australia",
    authority: "Study Australia — Australian Government",
    primaryDomain: "studyaustralia.gov.au",
    purpose: "Course and provider discovery, study guidance, student life, and visa preparation for studying in Australia.",
  },
  {
    countryCode: "IE",
    countryName: LAUNCH_COUNTRY_NAMES.IE,
    providerSlug: "education-in-ireland",
    authority: "Education in Ireland",
    primaryDomain: "educationinireland.com",
    purpose: "Institution discovery, study planning, and international student guidance for studying in Ireland.",
  },
];

/** Looks up the launch-primary source for a country code, normalizing first. Null if `value` is not a Tier 1 launch country. */
export function getLaunchCountryPrimarySource(value: string | null | undefined): LaunchCountryPrimarySource | null {
  const code = normalizeLaunchCountryCode(value ?? undefined);
  if (!code) return null;
  return LAUNCH_COUNTRY_PRIMARY_SOURCES.find((entry) => entry.countryCode === code) ?? null;
}

/** True once every LAUNCH_COUNTRY_CODES entry has exactly one corresponding LAUNCH_COUNTRY_PRIMARY_SOURCES row — the invariant this module's own test file enforces; exported so that invariant can also be asserted from outside this file (e.g. a future M20B integration test) without re-deriving the check. */
export function hasPrimarySourceForEveryLaunchCountry(): boolean {
  return LAUNCH_COUNTRY_CODES.every((code) => LAUNCH_COUNTRY_PRIMARY_SOURCES.some((entry) => entry.countryCode === code));
}
