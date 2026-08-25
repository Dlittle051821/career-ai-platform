/**
 * Milestone 5 — every tunable number the recommendation engine uses lives
 * in this one file. Nothing in `dimensions.ts`, `engine.ts`, or `bands.ts`
 * should contain an unexplained numeric literal — if a new constant is
 * needed, add it here with a comment explaining what it controls.
 *
 * How to adjust weights safely: `DIMENSION_WEIGHTS` values are relative,
 * not percentages of a fixed pool — the engine renormalizes across
 * whichever dimensions actually had evidence for a given student/career
 * pair (see `engine.ts`), so the numbers only need to reflect each
 * dimension's importance *relative to the others*. They happen to sum to
 * 100 here for readability, but changing one value doesn't require
 * rebalancing the rest to compensate. After changing a weight, re-run
 * `npm run test` — the fixtures in `engine.test.ts` assert on band
 * boundaries, not exact scores, so most weight tweaks won't break them,
 * but a large swing (e.g. doubling a weight) can shift a fixture across a
 * band threshold and is worth checking by eye.
 */

/** Relative importance of each scoring dimension. See module docblock for how these combine. */
export const DIMENSION_WEIGHTS = {
  subjects: 18,
  interests: 18,
  skills: 14,
  workPreferences: 10,
  careerPriorities: 14,
  careerHeuristics: 10,
  education: 12,
  mobility: 4,
} as const;

export type DimensionKey = keyof typeof DIMENSION_WEIGHTS;

/** 1-5 rating scale used throughout M3/M4 — the max possible difference between two ratings on this scale. */
export const RATING_SCALE_MAX = 5;
export const RATING_SCALE_SPAN = 4; // max - min, used to normalize |a - b| into 0..1

/**
 * A student rating below a career's `minimumStrength`/minimum-education
 * requirement isn't scored as zero (a single below-minimum subject
 * shouldn't sink an otherwise strong match), but it is capped low enough
 * that it can never look like a comfortable fit, and it always surfaces as
 * a gap. See `dimensions.ts` `capBelowMinimum`.
 */
export const BELOW_MINIMUM_FIT_CAP = 0.4;

/** Fit assumed for a student-selected interest that has no strength rating yet (strength is optional — see `student_interests.strength`). */
export const INTEREST_NO_STRENGTH_DEFAULT_FIT = 0.7;

/**
 * Work-preference / career-priority agreement dimensions: how much weight
 * a career's opinion on a given key gets is scaled by how far from neutral
 * (3 on a 1-5 scale) that opinion is — a career that rates a trait a 5 or a
 * 1 is telling you something; a 3 is close to "doesn't matter much either
 * way" and should influence the score less.
 */
export const NEUTRAL_RATING = 3;
export const MIN_OPINION_WEIGHT = 1;

/** Career-heuristic dimension: floor on how much a low-priority rating still counts, so a "1/5" priority isn't treated as literally zero influence. */
export const HEURISTIC_MIN_ITEM_WEIGHT = 0.15;

/** Ordinal ranking of education levels, for "does the student meet/exceed this career's typical level" comparisons. `other` is deliberately unordered (0) and excluded from minimum-level checks. */
export const EDUCATION_LEVEL_ORDER: Record<string, number> = {
  class_10: 1,
  class_12: 2,
  diploma: 3,
  bachelors: 4,
  masters: 5,
  phd: 6,
  other: 0,
};

/** `career_education_routes.relevance` -> fit multiplier when the student's education level matches that route's level exactly. */
export const EDUCATION_ROUTE_RELEVANCE_FIT: Record<"primary" | "common" | "alternative", number> = {
  primary: 1,
  common: 0.75,
  alternative: 0.55,
};

/** Fit when the student's level doesn't exactly match any listed route but is already past the lowest one listed (i.e. plausibly on track). */
export const EDUCATION_LEVEL_ADJACENT_FIT = 0.6;

/**
 * Mobility dimension: how strongly a `yes` / `maybe` / `no` answer to a
 * study/relocate-abroad question counts, and how it's read against a
 * career's `internationalMobility` heuristic score. `null` (unanswered) is
 * excluded entirely — see requirement to never treat missing optional data
 * as a negative signal.
 */
export const MOBILITY_ANSWER_WEIGHT: Record<"yes" | "maybe" | "no", number> = {
  yes: 1,
  maybe: 0.6,
  no: 0.6,
};

/**
 * Evidence coverage (0-1, the share of a career's relevant signals the
 * student's profile actually had data for) below `moderate` forces the
 * "Limited evidence" band outright; between `moderate` and `high` caps the
 * band at "Promising match" even if the raw score alone would qualify as
 * "Strong match" — see requirement #7 (sparse profiles shouldn't look
 * highly reliable) and `bands.ts`.
 */
export const EVIDENCE_THRESHOLDS = {
  moderate: 0.3,
  high: 0.6,
} as const;

/** Raw normalized score (0-100, internal only — never shown to students) thresholds for the three positive match bands. */
export const MATCH_SCORE_THRESHOLDS = {
  strong: 70,
  promising: 50,
} as const;
// Anything scoring below `promising` (and with sufficient evidence) is "Worth exploring" — there is
// deliberately no lower/negative band; a lower-ranked career is not "unsuitable", see docs.

/**
 * A student profile needs at least this many of the five core signal
 * categories (subjects, interests, skills, work preferences, career
 * priorities) to have at least one entry before recommendations are worth
 * computing at all — otherwise every career would land in "Limited
 * evidence" and the ranking itself would be closer to noise than guidance.
 * The `/recommendations` page uses this to show an incomplete-profile
 * state instead of a ranked (but meaningless) list.
 */
export const MIN_CORE_SIGNAL_CATEGORIES = 2;

/** How many ranked careers `/recommendations` surfaces to the student. */
export const RECOMMENDATION_RESULT_LIMIT = 12;

/** Cap on how many "strongest reasons" / "possible gaps" are returned per career — keeps explanations readable. */
export const MAX_REASONS = 4;
export const MAX_GAPS = 3;
