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
 * code below is expected to already exist as a public.countries row (it
 * does — DE/GB/US/CA/AU/IE are all already referenced by existing
 * external_search_providers rows seeded in
 * supabase/seed/0006_trusted_course_search_seed.sql), but this list is not
 * generated from that table — it is a deliberate, hand-curated product
 * decision, reviewed the same way SUBJECT_TAXONOMY is (see taxonomy.ts's
 * own docblock for why hand-curated data is preferred here over deriving
 * membership from a larger table).
 */

export const LAUNCH_COUNTRY_CODES = ["DE", "GB", "US", "CA", "AU", "IE"] as const;

export type LaunchCountryCode = (typeof LAUNCH_COUNTRY_CODES)[number];

/**
 * The one public display name every UI/report must use for each launch
 * country — never "USA"/"US"/"United States of America" interchangeably
 * (the task's own "Country Labels" rule: consistent public names, no
 * casual mixing, unless existing product copy conventions require it; this
 * codebase's existing copy already says "United States" wherever it names
 * a country in a sentence, e.g. src/lib/education/duplicates.ts comments
 * and public.countries seed data, so this list matches that convention
 * rather than introducing a new one).
 */
export const LAUNCH_COUNTRY_NAMES: Readonly<Record<LaunchCountryCode, string>> = {
  DE: "Germany",
  GB: "United Kingdom",
  US: "United States",
  CA: "Canada",
  AU: "Australia",
  IE: "Ireland",
};

const LAUNCH_COUNTRY_CODE_SET: ReadonlySet<string> = new Set(LAUNCH_COUNTRY_CODES);

/** True if `value` is already an exact, uppercase Tier 1 launch-country code. Use `normalizeLaunchCountryCode` first for any value that might have different casing/whitespace (e.g. a URL param or form field). */
export function isLaunchCountryCode(value: string): value is LaunchCountryCode {
  return LAUNCH_COUNTRY_CODE_SET.has(value);
}

/**
 * Normalizes a raw country-code-shaped string (uppercases, trims) and
 * returns it ONLY if the result is one of the six Tier 1 launch countries
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
