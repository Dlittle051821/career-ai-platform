import type { DimensionKey } from "./weights";

/**
 * One evidence-backed reason or gap surfaced in a recommendation's
 * explanation. `key` is the stable taxonomy key involved (a subject,
 * interest, skill, preference, or priority key) when the item is tied to
 * one; `dimension` records which scoring dimension produced it, for
 * grouping/debugging. `label` is always human-readable — nothing here is
 * a raw key or a number.
 */
export interface ExplanationItem {
  dimension: DimensionKey;
  key: string | null;
  label: string;
}

/** Qualitative match strength shown to students — never a percentage or raw score. See docs/recommendation-engine-guide.md. */
export type MatchBand = "strong_match" | "promising_match" | "worth_exploring" | "limited_evidence";

/** Qualitative evidence-coverage descriptor — how much of the student's profile was actually usable for this career's comparison. */
export type EvidenceLevel = "high" | "moderate" | "low";

/** The result of scoring one dimension for one (student, career) pair. Every field is derived only from its inputs — pure, no I/O. */
export interface DimensionResult {
  dimension: DimensionKey;
  /** Whether the student had usable data for at least one item this career cares about in this dimension. A dimension with no evidence contributes nothing to the score (its weight is excluded, not scored as 0). */
  hasEvidence: boolean;
  /** 0-1 fit, only meaningful when `hasEvidence` is true. */
  rawScore: number;
  /** 0-1 — the share of this career's relevant items in this dimension the student had data for. Drives evidence coverage / confidence. */
  evidenceStrength: number;
  reasons: ExplanationItem[];
  gaps: ExplanationItem[];
  matchedKeys: string[];
}

/** Grouped, labeled matches shown on a recommendation card/detail view. */
export interface MatchedSignals {
  subjects: string[];
  interests: string[];
  skills: string[];
  workPreferences: string[];
  careerPriorities: string[];
}

export interface RecommendationResult {
  careerId: string;
  careerKey: string;
  slug: string;
  title: string;
  shortTitle: string | null;
  summary: string;
  familyKey: string;
  familyName: string;
  isFeatured: boolean;

  matchBand: MatchBand;
  evidenceLevel: EvidenceLevel;

  reasons: ExplanationItem[];
  gaps: ExplanationItem[];
  matched: MatchedSignals;

  /**
   * Raw internal figures. These exist for computation, testing, and
   * deterministic sorting — never render them directly to a student as a
   * percentage or score (that would imply a precision this engine doesn't
   * have; see the M5 spec's explicit ban on claims like "93% match").
   * `internalScore` is 0-100, `internalEvidenceCoverage` is 0-1.
   */
  internalScore: number;
  internalEvidenceCoverage: number;
}

export interface RecommendationSummary {
  results: RecommendationResult[];
  /** Total careers considered (before ranking/limiting) — lets the UI say "compared against N careers". */
  totalCareersConsidered: number;
}
