import { SUBJECT_OPTIONS, INTEREST_OPTIONS, TECHNICAL_SKILL_OPTIONS, TRANSFERABLE_SKILL_OPTIONS, WORK_PREFERENCE_OPTIONS, CAREER_PRIORITY_OPTIONS, labelFor } from "@/data/profile-options";
import type { DimensionResult, ExplanationItem, MatchedSignals } from "./types";
import { MAX_GAPS, MAX_REASONS } from "./weights";

const SKILL_OPTIONS = [...TECHNICAL_SKILL_OPTIONS, ...TRANSFERABLE_SKILL_OPTIONS];

/**
 * Turns the per-dimension results for one career into the explanation data
 * shown on a recommendation card: the strongest reasons it appears, the
 * most useful gaps to consider, and grouped/labeled matched signals. Pure
 * — takes dimension results, returns display-ready data, no I/O.
 */
export function buildExplanation(dimensionResults: DimensionResult[]): {
  reasons: ExplanationItem[];
  gaps: ExplanationItem[];
  matched: MatchedSignals;
} {
  const allReasons = dimensionResults.flatMap((d) => d.reasons);
  const allGaps = dimensionResults.flatMap((d) => d.gaps);

  // Dimensions are already internally sorted by contribution; interleave
  // by dimension order (subjects/interests first — the most concrete,
  // student-legible signals) rather than re-deriving a cross-dimension
  // strength ranking that would need score internals this layer doesn't have.
  const reasons = allReasons.slice(0, MAX_REASONS);
  const gaps = allGaps.slice(0, MAX_GAPS);

  const byDimension = new Map(dimensionResults.map((d) => [d.dimension, d]));

  const labelAll = (keys: string[] | undefined, options: { key: string; label: string }[]) =>
    (keys ?? []).map((k) => labelFor(options, k));

  const matched: MatchedSignals = {
    subjects: labelAll(byDimension.get("subjects")?.matchedKeys, SUBJECT_OPTIONS),
    interests: labelAll(byDimension.get("interests")?.matchedKeys, INTEREST_OPTIONS),
    skills: labelAll(byDimension.get("skills")?.matchedKeys, SKILL_OPTIONS),
    workPreferences: labelAll(byDimension.get("workPreferences")?.matchedKeys, WORK_PREFERENCE_OPTIONS),
    careerPriorities: labelAll(byDimension.get("careerPriorities")?.matchedKeys, CAREER_PRIORITY_OPTIONS),
  };

  return { reasons, gaps, matched };
}
