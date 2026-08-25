/**
 * Milestone 5 — Explainable Career Recommendation Engine.
 *
 * Deterministic and framework-independent: no AI/Claude API call, no
 * randomness, nothing here depends on Next.js, React, or Supabase. It
 * takes a student profile snapshot (Milestone 3 shape) and a list of
 * career match profiles (Milestone 4 shape, loaded in bulk via
 * `getCareersForMatching()` in `src/lib/supabase/careers.ts`) and returns
 * a ranked, explained list.
 *
 * See docs/recommendation-engine-guide.md for the full model write-up —
 * inputs, weights, missing-data handling, match bands, evidence coverage,
 * and known limitations.
 */
export { getRecommendations, scoreCareer } from "./engine";
export { hasMinimumProfileDataForRecommendations, normalizeStudentProfile } from "./normalize";
export { MATCH_BAND_LABELS, EVIDENCE_LEVEL_LABELS, determineMatchBand, evidenceLevelFor } from "./bands";
export { DIMENSION_WEIGHTS, RECOMMENDATION_RESULT_LIMIT } from "./weights";
export type { DimensionKey } from "./weights";
export type {
  RecommendationResult,
  RecommendationSummary,
  MatchBand,
  EvidenceLevel,
  ExplanationItem,
  MatchedSignals,
  DimensionResult,
} from "./types";
