/**
 * M20A — Launch Country Definition.
 *
 * Pure, framework-free constant data: no DB access, no side effects — same
 * convention as every other module in src/lib/education/external-search/
 * (adapter.ts, url-validation.ts, taxonomy.ts). This is deliberately the
 * ONLY place the "Tier 1 launch country" list is defined; everything that
 * needs to know whether a country is a launch country (this milestone's
 * registry, and M20B/M20C's later UI) imports from here rather than
 * re-typing the list.
 *
 * COUNTRY-CODE CONVENTION: ISO 3166-1 alpha-2, uppercase — the SAME
 * convention already used throughout this codebase (public.countries.
 * iso_alpha2, external_search_providers.country_code,
 * external_search_mappings.destination_country_code — see
 * supabase/migrations/0009_trusted_course_search.sql and
 * src/lib/supabase/education/countries.ts). No new country-code convention
 * is introduced by this file.
 *
 * WHY A SEPARATE LIST FROM public.countries: public.countries holds every
 * country the global education-data platform (Milestone 9) knows about —
 * dozens of rows, used for university/course records anywhere in the
 * world. "Launch country" is a narrower, product-level concept (M20's own
 * term): the small set of destinations Nextwise is prepared to offer a
 * trusted national fallback source for AT LAUNCH. Every launch-country
 * code below is expected to already exist as a public.countries row, but
 * this list is not generated from that table — it is a deliberate,
 * hand-curated product decision, reviewed the same way SUBJECT_TAXONOMY is
 * (see taxonomy.ts's own docblock for why hand-curated data is preferred
 * here over deriving membership from a larger table).
 *
 * NW02 — LAUNCH SET REVISED: the original M20 launch set (DE/GB/US/CA/AU/IE)
 * is replaced by NW02's approved launch destinations — India plus the same
 * six European countries UX10-EU01's `/study-europe` explorer already
 * covers (`src/data/europe-explorer.ts`'s `EUROPE_COUNTRIES`): Germany,
 * Ireland, Netherlands, France, Sweden, Denmark. GB/US/CA/AU are REMOVED
 * from this launch-facing registry — this never deletes their historical
 * `public.countries` rows or their existing `external_search_providers`
 * rows (UCAS/EducationUSA/EduCanada/CRICOS/etc. all remain in the
 * database, untouched, simply no longer surfaced through this launch-
 * country registry). India's primary source
 * (`study-in-india` / studyinindia.gov.in) and the four newly-added
 * European primary sources (Netherlands/France/Sweden/Denmark) were already
 * seeded, inactive, by `supabase/seed/0006_trusted_course_search_seed.sql`
 * — see `launch-country-sources.ts` for how that inactive state is
 * surfaced honestly rather than treated as verified/active.
 */

export const LAUNCH_COUNTRY_CODES = ["IN", "DE", "IE", "NL", "FR", "SE", "DK"] as const;

export type LaunchCountryCode = (typeof LAUNCH_COUNTRY_CODES)[number];

/**
 * The one public display name every UI/report must use for each launch
 * country — never a casual abbreviation mixed in (the task's own "Country
 * Labels" rule: consistent public names, matching this codebase's existing
 * copy convention, e.g. public.countries seed data).
 */
export const LAUNCH_COUNTRY_NAMES: Readonly<Record<LaunchCountryCode, string>> = {
  IN: "India",
  DE: "Germany",
  IE: "Ireland",
  NL: "Netherlands",
  FR: "France",
  SE: "Sweden",
  DK: "Denmark",
};

const LAUNCH_COUNTRY_CODE_SET: ReadonlySet<string> = new Set(LAUNCH_COUNTRY_CODES);

/** True if `value` is already an exact, uppercase Tier 1 launch-country code. Use `normalizeLaunchCountryCode` first for any value that might have different casing/whitespace (e.g. a URL param or form field). */
export function isLaunchCountryCode(value: string): value is LaunchCountryCode {
  return LAUNCH_COUNTRY_CODE_SET.has(value);
}

/**
 * Normalizes a raw country-code-shaped string (uppercases, trims) and
 * returns it ONLY if the result is one of the Tier 1 launch countries
 * — otherwise null. Mirrors the trim/case-fold shape of this codebase's
 * existing normalize helpers (src/lib/education/normalize.ts's
 * normalizeWhitespace/extractDomain: pure, never throws, null for
 * anything that doesn't resolve cleanly) without introducing a new
 * country-code format of its own — the output, when non-null, is always
 * one of LAUNCH_COUNTRY_CODES, i.e. the exact same ISO alpha-2 shape the
 * rest of the codebase already uses.
 */
export function normalizeLaunchCountryCode(value: string | null | undefined): LaunchCountryCode | null {
  if (!value) return null;
  const candidate = value.trim().toUpperCase();
  return isLaunchCountryCode(candidate) ? candidate : null;
}

/** The public display name for a launch-country code, normalizing first. Null if `value` is not a Tier 1 launch country. */
export function getLaunchCountryName(value: string | null | undefined): string | null {
  const code = normalizeLaunchCountryCode(value);
  return code ? LAUNCH_COUNTRY_NAMES[code] : null;
}
