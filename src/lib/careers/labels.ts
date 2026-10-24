import {
  SUBJECT_OPTIONS,
  INTEREST_OPTIONS,
  TECHNICAL_SKILL_OPTIONS,
  TRANSFERABLE_SKILL_OPTIONS,
  WORK_PREFERENCE_OPTIONS,
  CAREER_PRIORITY_OPTIONS,
  EDUCATION_LEVEL_OPTIONS,
  type OptionDef,
} from "@/data/profile-options";
import { FIELD_OF_STUDY_OPTIONS } from "@/data/careers/taxonomy";

/**
 * Every career detail field is a stable snake_case key (subject_key,
 * interest_key, ...), not a display string — the same convention as the
 * Milestone 3 Student Digital Profile. This module is the one place that
 * turns those keys back into the human-readable labels already defined in
 * `profile-options.ts` / `taxonomy.ts`, so the Career Explorer and detail
 * page never have to know the mapping themselves.
 *
 * A key with no matching option (shouldn't happen — `validate-career-data`
 * fails the build on unknown keys — but the seed dataset can still outlive
 * this file) falls back to a humanized version of the key itself rather
 * than rendering raw snake_case or throwing.
 */

function toLabelMap(options: OptionDef[]): Map<string, string> {
  return new Map(options.map((o) => [o.key, o.label]));
}

const SUBJECT_LABELS = toLabelMap(SUBJECT_OPTIONS);
const INTEREST_LABELS = toLabelMap(INTEREST_OPTIONS);
const SKILL_LABELS = toLabelMap([...TECHNICAL_SKILL_OPTIONS, ...TRANSFERABLE_SKILL_OPTIONS]);
const WORK_PREFERENCE_LABELS = toLabelMap(WORK_PREFERENCE_OPTIONS);
const CAREER_PRIORITY_LABELS = toLabelMap(CAREER_PRIORITY_OPTIONS);
const EDUCATION_LEVEL_LABELS = toLabelMap(EDUCATION_LEVEL_OPTIONS);
const FIELD_LABELS = toLabelMap(FIELD_OF_STUDY_OPTIONS);

function humanize(key: string): string {
  return key
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export const subjectLabel = (key: string): string => SUBJECT_LABELS.get(key) ?? humanize(key);
export const interestLabel = (key: string): string => INTEREST_LABELS.get(key) ?? humanize(key);
export const skillLabel = (key: string): string => SKILL_LABELS.get(key) ?? humanize(key);
export const workPreferenceLabel = (key: string): string => WORK_PREFERENCE_LABELS.get(key) ?? humanize(key);
export const careerPriorityLabel = (key: string): string => CAREER_PRIORITY_LABELS.get(key) ?? humanize(key);
export const educationLevelLabel = (key: string): string => EDUCATION_LEVEL_LABELS.get(key) ?? humanize(key);
export const fieldLabel = (key: string): string => FIELD_LABELS.get(key) ?? humanize(key);

/**
 * NW02 §7 — career → education pathway navigation.
 *
 * Maps a career's own `education_routes.education_level` key (from
 * `profile-options.ts`'s EDUCATION_LEVEL_OPTIONS — the same taxonomy the
 * Student Digital Profile uses) onto the Course Explorer's taxonomy of
 * `CanonicalDegreeLevel` string values (`/lib/education/external-search/
 * taxonomy.ts`'s CANONICAL_DEGREE_LEVELS: "bachelors" | "masters" |
 * "doctorate" | "diploma_certificate" | "other") — returned as a plain
 * string, not that type, so this module never has to import the
 * education/external-search taxonomy just for a type annotation.
 *
 * Returns null for a level this milestone has no confident Course
 * Explorer equivalent for (class_10/class_12 — school-stage levels with no
 * course-catalogue analogue) rather than guessing one; callers should omit
 * the "search courses" link entirely in that case, never link to a degree
 * level this route doesn't actually imply.
 */
export function educationLevelToCourseSearchDegree(key: string): string | null {
  switch (key) {
    case "bachelors":
      return "bachelors";
    case "masters":
      return "masters";
    case "phd":
      return "doctorate";
    case "diploma":
      return "diploma_certificate";
    default:
      return null;
  }
}

export const SKILL_LEVEL_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export const RELEVANCE_LABELS: Record<string, string> = {
  primary: "Primary route",
  common: "Common route",
  alternative: "Alternative route",
};
