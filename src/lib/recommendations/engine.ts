import type { CareerMatchProfile } from "@/types/career";
import type { StudentProfileSnapshot } from "@/types/student-profile";
import { normalizeStudentProfile } from "./normalize";
import {
  scoreSubjects,
  scoreInterests,
  scoreSkills,
  scoreWorkPreferences,
  scoreCareerPriorities,
  scoreCareerHeuristics,
  scoreEducation,
  scoreMobility,
} from "./dimensions";
import { determineMatchBand, evidenceLevelFor } from "./bands";
import { buildExplanation } from "./explain";
import { DIMENSION_WEIGHTS, RECOMMENDATION_RESULT_LIMIT } from "./weights";
import type { DimensionResult, RecommendationResult, RecommendationSummary } from "./types";

const DIMENSION_SCORERS = [
  scoreSubjects,
  scoreInterests,
  scoreSkills,
  scoreWorkPreferences,
  scoreCareerPriorities,
  scoreCareerHeuristics,
  scoreEducation,
  scoreMobility,
] as const;

/**
 * Scores a single career against a normalized student profile. Exported
 * mainly for tests — `getRecommendations` below is the entry point real
 * callers should use, since it also handles sorting/ranking/limiting
 * across the whole career catalogue.
 *
 * Deterministic and pure: same inputs always produce the same output, no
 * randomness, no network/AI calls, and neither input object is mutated.
 */
export function scoreCareer(
  student: ReturnType<typeof normalizeStudentProfile>,
  career: CareerMatchProfile
): RecommendationResult {
  const dimensionResults: DimensionResult[] = DIMENSION_SCORERS.map((scorer) => scorer(student, career));

  // Weighted combination, renormalized across only the dimensions that had
  // evidence — a dimension with nothing to go on is excluded, not scored
  // as a 0 (see requirement to never treat missing optional data as
  // negative). If literally nothing has evidence, the raw score is 0 and
  // evidence coverage is 0, which `determineMatchBand` correctly reads as
  // "Limited evidence" rather than a false "worst possible match".
  let weightedScoreSum = 0;
  let evaluableWeight = 0;
  let weightedEvidenceSum = 0;
  let totalWeight = 0;

  for (const result of dimensionResults) {
    const weight = DIMENSION_WEIGHTS[result.dimension];
    totalWeight += weight;
    weightedEvidenceSum += weight * result.evidenceStrength;
    if (result.hasEvidence) {
      weightedScoreSum += weight * result.rawScore;
      evaluableWeight += weight;
    }
  }

  const internalScore = evaluableWeight > 0 ? Math.round((weightedScoreSum / evaluableWeight) * 100) : 0;
  const internalEvidenceCoverage = totalWeight > 0 ? weightedEvidenceSum / totalWeight : 0;

  const matchBand = determineMatchBand(internalScore, internalEvidenceCoverage);
  const evidenceLevel = evidenceLevelFor(internalEvidenceCoverage);
  const { reasons, gaps, matched } = buildExplanation(dimensionResults);

  return {
    careerId: career.id,
    careerKey: career.careerKey,
    slug: career.slug,
    title: career.title,
    shortTitle: career.shortTitle,
    summary: career.summary,
    familyKey: career.familyKey,
    familyName: career.familyName,
    isFeatured: career.isFeatured,
    matchBand,
    evidenceLevel,
    reasons,
    gaps,
    matched,
    // Clamp defensively — every dimension fit is built from ratios/averages
    // of bounded inputs and should already land in range, but a clamp here
    // is a cheap guarantee against NaN/out-of-range values ever reaching a
    // caller, independent of whether that reasoning holds for every future
    // dimension someone adds.
    internalScore: Number.isFinite(internalScore) ? Math.min(100, Math.max(0, internalScore)) : 0,
    internalEvidenceCoverage: Number.isFinite(internalEvidenceCoverage) ? Math.min(1, Math.max(0, internalEvidenceCoverage)) : 0,
  };
}

/**
 * Deterministic tie-break chain, applied only when scores are otherwise
 * equal: higher evidence coverage first (a tie backed by more data is the
 * more trustworthy of the two), then featured careers, then alphabetical
 * title, then career key as an absolute final tiebreaker (guaranteed
 * unique) — so two runs over the same input always produce the same order.
 */
function compareResults(a: RecommendationResult, b: RecommendationResult): number {
  if (b.internalScore !== a.internalScore) return b.internalScore - a.internalScore;
  if (b.internalEvidenceCoverage !== a.internalEvidenceCoverage) return b.internalEvidenceCoverage - a.internalEvidenceCoverage;
  if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
  const titleCompare = a.title.localeCompare(b.title);
  if (titleCompare !== 0) return titleCompare;
  return a.careerKey.localeCompare(b.careerKey);
}

/**
 * The public entry point: ranks every given career against a student's
 * profile and returns the top results. Never mutates `snapshot` or
 * `careers`. Callers (the `/recommendations` page) are expected to have
 * already checked `hasMinimumProfileDataForRecommendations` — this
 * function will still run and return a result on a sparse profile (every
 * dimension just reports low/no evidence), it just won't be a useful
 * ranking, which is exactly why that separate gate exists.
 */
export function getRecommendations(
  snapshot: StudentProfileSnapshot,
  careers: CareerMatchProfile[],
  limit: number = RECOMMENDATION_RESULT_LIMIT
): RecommendationSummary {
  const student = normalizeStudentProfile(snapshot);
  const results = careers.map((career) => scoreCareer(student, career)).sort(compareResults);

  return {
    results: results.slice(0, Math.max(0, limit)),
    totalCareersConsidered: careers.length,
  };
}
