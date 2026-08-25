import type { StudentProfileSnapshot, SkillLevel, YesNoMaybe } from "@/types/student-profile";
import { MIN_CORE_SIGNAL_CATEGORIES } from "./weights";

/**
 * A lookup-friendly view of a student's Milestone 3 profile, built once per
 * recommendation run and then read (never mutated) by every dimension
 * scorer. Keeping this as a separate step means `dimensions.ts` never
 * touches `StudentProfileSnapshot`'s array shapes directly, and it's the
 * one place that would need to change if a new M3 field becomes relevant
 * to matching.
 *
 * Pure and side-effect-free: never mutates the snapshot it's given.
 */
export interface NormalizedStudentProfile {
  subjectStrengthByKey: Map<string, number>;
  /** `null` means the student selected this interest but left strength unset — see `student_interests.strength`, which is optional. */
  interestStrengthByKey: Map<string, number | null>;
  skillLevelByKey: Map<string, SkillLevel>;
  workPreferenceRatingByKey: Map<string, number>;
  priorityRatingByKey: Map<string, number>;
  /** Most-advanced education level across all recorded education entries, or null if none recorded. Ordinal comparisons live in `dimensions.ts` via `EDUCATION_LEVEL_ORDER`. */
  educationLevel: string | null;
  mobility: {
    studyAbroad: YesNoMaybe | null;
    relocateInternational: YesNoMaybe | null;
  };
}

export function normalizeStudentProfile(snapshot: StudentProfileSnapshot): NormalizedStudentProfile {
  const subjectStrengthByKey = new Map<string, number>();
  for (const s of snapshot.subjectStrengths) subjectStrengthByKey.set(s.subjectKey, s.rating);

  const interestStrengthByKey = new Map<string, number | null>();
  for (const i of snapshot.interests) interestStrengthByKey.set(i.interestKey, i.strength);

  const skillLevelByKey = new Map<string, SkillLevel>();
  for (const sk of snapshot.skills) skillLevelByKey.set(sk.skillKey, sk.level);

  const workPreferenceRatingByKey = new Map<string, number>();
  for (const wp of snapshot.workPreferences) workPreferenceRatingByKey.set(wp.preferenceKey, wp.rating);

  const priorityRatingByKey = new Map<string, number>();
  for (const p of snapshot.careerPriorities) priorityRatingByKey.set(p.priorityKey, p.rating);

  // Most-advanced recorded education level. "other" is unordered and only
  // used if it's literally the only entry — see EDUCATION_LEVEL_ORDER.
  let educationLevel: string | null = null;
  let bestOrder = -1;
  for (const record of snapshot.education) {
    const order = EDUCATION_LEVEL_ORDER_LOOKUP[record.educationLevel] ?? 0;
    if (educationLevel === null || order > bestOrder) {
      educationLevel = record.educationLevel;
      bestOrder = order;
    }
  }

  return {
    subjectStrengthByKey,
    interestStrengthByKey,
    skillLevelByKey,
    workPreferenceRatingByKey,
    priorityRatingByKey,
    educationLevel,
    mobility: {
      studyAbroad: snapshot.studyPreferences?.studyAbroad ?? null,
      relocateInternational: snapshot.studyPreferences?.relocateInternational ?? null,
    },
  };
}

// Kept local (rather than imported from weights.ts) to avoid a dependency
// cycle risk between normalize/dimensions — duplicated as a small literal,
// not re-derived, since it's only used for this one "pick the highest
// level" comparison and dimensions.ts owns the canonical export.
const EDUCATION_LEVEL_ORDER_LOOKUP: Record<string, number> = {
  class_10: 1,
  class_12: 2,
  diploma: 3,
  bachelors: 4,
  masters: 5,
  phd: 6,
  other: 0,
};

/**
 * Gate used by `/recommendations` (and available to the engine's caller in
 * general) to decide whether a profile has enough data for ranking to be
 * meaningful at all, rather than producing a full list that would just be
 * "Limited evidence" from top to bottom. See `MIN_CORE_SIGNAL_CATEGORIES`.
 */
export function hasMinimumProfileDataForRecommendations(snapshot: StudentProfileSnapshot): boolean {
  const categories = [
    snapshot.subjectStrengths.length > 0,
    snapshot.interests.length > 0,
    snapshot.skills.length > 0,
    snapshot.workPreferences.length > 0,
    snapshot.careerPriorities.length > 0,
  ];
  return categories.filter(Boolean).length >= MIN_CORE_SIGNAL_CATEGORIES;
}
