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
 *
 * NW02 — LAUNCH SET REVISED (India + the six EU01 European countries):
 * Germany's and Ireland's entries are untouched (same providerSlug, same
 * already-active provider rows). The United Kingdom/United States/Canada/
 * Australia entries are REMOVED (their underlying `external_search_providers`
 * rows are untouched in the database — just no longer surfaced as a
 * launch-primary here). Five entries are added/changed:
 *   - India (`study-in-india`, studyinindia.gov.in) and the four new
 *     European countries (Netherlands/France/Sweden/Denmark) all point at
 *     provider rows that already exist in
 *     `supabase/seed/0006_trusted_course_search_seed.sql` — but, unlike
 *     Germany/Ireland, those five rows are seeded `active = false` (the
 *     original spec behind that seed gave only a bare official domain for
 *     them, with instructions to "verify... before activation" — the same
 *     discipline this file's own header describes for UCAS/CRICOS/NCES
 *     before 0008 activated the UK/US/CA/AU/IE set).
 *   - This file still names them as the launch-primary designation (the
 *     "which ONE provider row is the right one for this country"
 *     question this module exists to answer), but `active = false` means
 *     `buildProviderSearchResult` (adapter.ts) returns
 *     `{ available: false, reason: "provider_inactive" }` for every one of
 *     them until an admin activates the row — so no inactive source is
 *     ever surfaced to a student as verified. `/courses` and
 *     `/universities` already render the honest
 *     "No trusted official portal is currently activated for <country> in
 *     our system yet" message for exactly this case (pre-existing M20C
 *     behavior, exercised by this milestone's own regression tests).
 *   - Each of these five domains (studyinindia.gov.in, studyinnl.org,
 *     campusfrance.org, universityadmissions.se, studyindenmark.dk) is the
 *     SAME domain already independently verified by UX10-EU01's
 *     `src/data/europe-explorer.ts` (Netherlands/France/Sweden/Denmark —
 *     that file's own docblock records how each was verified against the
 *     organization's own live site) — reused here verbatim rather than
 *     re-typed, so the two registries can never silently drift apart on
 *     authority/domain text for the countries they share.
 *   - NW02 does not flip any provider's `active` flag — that is a database
 *     write, and the brief is explicit that an inactive source must get a
 *     separately reviewable activation proposal, never an automatic flip.
 *     See NW02_OPEN_BLOCKERS.md for the exact admin action (via the
 *     existing `/admin/education/sources` tooling) that activates each of
 *     these five once reviewed.
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
 * Exactly seven entries — one per LAUNCH_COUNTRY_CODES, in the same order.
 * Germany's and Ireland's sources are unmodified: both already existed,
 * already `active = true`, already carrying a real verified source
 * (DAAD International Programmes / Education in Ireland). The other five
 * (India, Netherlands, France, Sweden, Denmark) point at provider rows
 * that already exist in `supabase/seed/0006_trusted_course_search_seed.sql`
 * but are seeded `active = false` — this file still designates each as its
 * country's launch-primary so `getLaunchCountryPrimarySource` answers "which
 * one provider is this country's primary" correctly, while the `active`
 * flag itself (a database value, never flipped by this milestone) keeps
 * each one honestly unavailable to students until an admin verifies and
 * activates it. See this file's own header and NW02_OPEN_BLOCKERS.md.
 */
export const LAUNCH_COUNTRY_PRIMARY_SOURCES: readonly LaunchCountryPrimarySource[] = [
  {
    countryCode: "IN",
    countryName: LAUNCH_COUNTRY_NAMES.IN,
    providerSlug: "study-in-india",
    authority: "Study in India — Government of India",
    primaryDomain: "studyinindia.gov.in",
    purpose: "Official Government of India guidance on higher-education institutions and programmes in India.",
  },
  {
    countryCode: "DE",
    countryName: LAUNCH_COUNTRY_NAMES.DE,
    providerSlug: "daad-international-programmes",
    authority: "DAAD — German Academic Exchange Service",
    primaryDomain: "daad.de",
    purpose: "International study guidance, programme discovery, and admission guidance for studying in Germany.",
  },
  {
    countryCode: "IE",
    countryName: LAUNCH_COUNTRY_NAMES.IE,
    providerSlug: "education-in-ireland",
    authority: "Education in Ireland",
    primaryDomain: "educationinireland.com",
    purpose: "Institution discovery, study planning, and international student guidance for studying in Ireland.",
  },
  {
    countryCode: "NL",
    countryName: LAUNCH_COUNTRY_NAMES.NL,
    providerSlug: "study-in-nl",
    authority: "Study in NL — Nuffic",
    primaryDomain: "studyinnl.org",
    purpose: "Official guidance on studying in the Netherlands, programme search, and practical planning for international students.",
  },
  {
    countryCode: "FR",
    countryName: LAUNCH_COUNTRY_NAMES.FR,
    providerSlug: "campus-france",
    authority: "Campus France",
    primaryDomain: "campusfrance.org",
    purpose: "France's official agency for promoting French higher education and guiding international students through study and admission planning.",
  },
  {
    countryCode: "SE",
    countryName: LAUNCH_COUNTRY_NAMES.SE,
    providerSlug: "universityadmissions-se",
    authority: "University Admissions in Sweden — Swedish Council for Higher Education (UHR)",
    primaryDomain: "universityadmissions.se",
    purpose: "Official national application portal for higher education in Sweden, run by the Swedish Council for Higher Education (UHR).",
  },
  {
    countryCode: "DK",
    countryName: LAUNCH_COUNTRY_NAMES.DK,
    providerSlug: "study-in-denmark",
    authority: "Study in Denmark — Danish Ministry of Higher Education and Science",
    primaryDomain: "studyindenmark.dk",
    purpose: "Official Danish government guidance on studying in Denmark, including institutions, programmes, and practical planning.",
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
