import { EUROPE_COUNTRIES } from "@/data/europe-explorer";
import { COUNTRY_OPTIONS } from "@/data/profile-options";

const EUROPE_COUNTRY_NAMES = new Set(EUROPE_COUNTRIES.map((c) => c.name.toLowerCase()));

/**
 * NW05.5 — whether a resolved country name (a saved university's/course's
 * `countryName`, or an application's `universityCountryName`) is one of
 * Nextwise Abroad's current 6 launch destinations. Always derived from the
 * single real `EUROPE_COUNTRIES` registry (`src/data/europe-explorer.ts`)
 * — never a re-typed country list — so this can never silently drift if
 * that registry ever changes. Same discipline NW04 already applied to the
 * public Abroad flag map (see NW04_ARCHITECTURE.md §6.4).
 */
export function isAbroadDestinationName(countryName: string | null | undefined): boolean {
  if (!countryName) return false;
  return EUROPE_COUNTRY_NAMES.has(countryName.toLowerCase());
}

/**
 * NW05.5 — which of Nextwise Abroad's 6 launch destinations (if any) the
 * student has already named as a preferred study destination in their
 * Student Digital Profile (`student_study_preferences.
 * preferred_study_destinations`, saved via the existing, general-purpose
 * `saveStudyPreferences()` — this field is not Abroad-specific; a student
 * can select India, the USA, or any other `COUNTRY_OPTIONS` entry there
 * too). Returns only the real `EUROPE_COUNTRIES` names the student
 * actually selected, in registry order — a student who selected only
 * non-Abroad destinations gets an empty array, never a fabricated guess.
 *
 * Nothing here can ever report Denmark: `COUNTRY_OPTIONS`
 * (`src/data/profile-options.ts`) has no `"denmark"` option today, a real,
 * pre-existing data gap — disclosed in `NW05_05_ABROAD_WORKSPACE.md`
 * rather than silently worked around (e.g. by inventing a key that isn't
 * actually selectable anywhere in the product).
 */
export function getAbroadDestinationPreferences(preferredStudyDestinations: readonly string[]): string[] {
  const keyToLabel = new Map(COUNTRY_OPTIONS.map((o) => [o.key, o.label] as const));
  const selectedLabels = new Set(
    preferredStudyDestinations
      .map((key) => keyToLabel.get(key))
      .filter((label): label is string => Boolean(label))
      .map((label) => label.toLowerCase())
  );
  return EUROPE_COUNTRIES.filter((c) => selectedLabels.has(c.name.toLowerCase())).map((c) => c.name);
}
