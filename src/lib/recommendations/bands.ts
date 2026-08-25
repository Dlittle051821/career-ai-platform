import type { EvidenceLevel, MatchBand } from "./types";
import { EVIDENCE_THRESHOLDS, MATCH_SCORE_THRESHOLDS } from "./weights";

/** Student-facing copy for each band/level — the ONLY place these strings are defined, so wording stays consistent everywhere they're used. */
export const MATCH_BAND_LABELS: Record<MatchBand, string> = {
  strong_match: "Strong match",
  promising_match: "Promising match",
  worth_exploring: "Worth exploring",
  limited_evidence: "Limited evidence",
};

export const EVIDENCE_LEVEL_LABELS: Record<EvidenceLevel, string> = {
  high: "Based on a well-filled-out profile",
  moderate: "Based on a partially filled-out profile",
  low: "Based on limited profile data so far",
};

export function evidenceLevelFor(evidenceCoverage: number): EvidenceLevel {
  if (evidenceCoverage >= EVIDENCE_THRESHOLDS.high) return "high";
  if (evidenceCoverage >= EVIDENCE_THRESHOLDS.moderate) return "moderate";
  return "low";
}

/**
 * Combines the raw score with evidence coverage into one qualitative band.
 * Evidence coverage can only ever pull the band DOWN from what the raw
 * score alone would suggest, never up — a sparse profile should never be
 * presented as a highly reliable match (requirement #7), but plenty of
 * real evidence pointing at a below-average fit is still honest information
 * worth showing, not something to hide.
 */
export function determineMatchBand(internalScore: number, evidenceCoverage: number): MatchBand {
  const evidenceLevel = evidenceLevelFor(evidenceCoverage);

  if (evidenceLevel === "low") return "limited_evidence";

  const scoreBand: MatchBand =
    internalScore >= MATCH_SCORE_THRESHOLDS.strong
      ? "strong_match"
      : internalScore >= MATCH_SCORE_THRESHOLDS.promising
        ? "promising_match"
        : "worth_exploring";

  if (evidenceLevel === "moderate" && scoreBand === "strong_match") {
    return "promising_match";
  }

  return scoreBand;
}
