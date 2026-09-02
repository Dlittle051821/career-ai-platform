import type { CompletionResult } from "@/types/student-profile";
import {
  RECOMMENDATION_TYPES,
  type RecommendationType,
  type ReadinessLevel,
  type RecommendationConfidence,
  type RecommendationReadiness,
} from "@/types/recommendation-readiness";

/**
 * Milestone 11-C2 — Recommendation Readiness. A PURE, computed-fresh value
 * (never stored) — see supabase/migrations/0013_..._and_recommendation_
 * readiness.sql PART 5's own comment for why: it mirrors the existing
 * "compute completion fresh from calculateCompletion() rather than trust a
 * stored percent" philosophy from src/lib/profile/completion.ts, avoiding a
 * second source of truth that could drift from the profile it describes.
 *
 * Readiness is deliberately a COARSER, profile-level gate ("is there enough
 * data to generate this TYPE of recommendation at all"), distinct from
 * src/lib/recommendations/bands.ts's per-career MatchBand/EvidenceLevel
 * ("how good is THIS ONE match"). The two answer different questions and
 * are not meant to be reconciled into one concept.
 */

/**
 * Which of the 11 profile-completion sections (src/lib/profile/
 * completion.ts) matter for judging readiness of each recommendation type.
 * "career" mirrors hasMinimumProfileDataForRecommendations()'s existing
 * five signal categories plus the two sections the career engine's other
 * dimensions read (about_you, career_goals) — see src/lib/recommendations/
 * dimensions.ts. course/college/pathway have no matching engine yet (see
 * RECOMMENDATION_TYPE_HAS_ENGINE), so their section lists are a considered
 * judgment call about what each future engine will plainly need: course
 * needs academic standing and subject fit, college needs academic standing
 * plus where/how much the student can spend, and pathway (an end-to-end
 * roadmap) needs goals, priorities, and study/budget context together.
 * "experience" is never included — completion.ts itself weights it 0 and
 * treats it as optional for every purpose.
 */
const RELEVANT_SECTION_KEYS: Record<RecommendationType, readonly string[]> = {
  career: ["about_you", "subject_strengths", "interests", "skills", "work_preferences", "career_priorities", "career_goals"],
  course: ["about_you", "education", "subject_strengths", "career_goals", "study_location"],
  college: ["about_you", "education", "study_location", "budget_funding"],
  pathway: ["about_you", "career_goals", "career_priorities", "study_location", "budget_funding"],
};

const READY_THRESHOLD_PERCENT = 80;
const PRELIMINARY_THRESHOLD_PERCENT = 40;

/** An explicit counsellor override for one recommendation type — the only piece of readiness that is ever read from storage. */
export interface RecommendationVerificationOverride {
  verifiedByCounsellorId: string;
  verifiedByCounsellorName: string | null;
  verifiedAt: string;
  note: string | null;
}

export function computeRecommendationReadiness(
  type: RecommendationType,
  completion: CompletionResult,
  override: RecommendationVerificationOverride | null = null
): RecommendationReadiness {
  const relevantKeys = RELEVANT_SECTION_KEYS[type];
  const relevantSections = completion.sections.filter((s) => relevantKeys.includes(s.key));

  const totalWeight = relevantSections.reduce((sum, s) => sum + s.weight, 0);
  const completedWeight = relevantSections.filter((s) => s.complete).reduce((sum, s) => sum + s.weight, 0);
  // Defensive only — every RELEVANT_SECTION_KEYS entry above sums to a
  // positive weight (guarded by a regression test), so totalWeight is
  // never actually 0 in practice.
  const relevantCompletionPercent = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
  const missingSectionKeys = relevantSections.filter((s) => !s.complete).map((s) => s.key);

  const computedLevel: ReadinessLevel =
    relevantCompletionPercent >= READY_THRESHOLD_PERCENT
      ? "READY"
      : relevantCompletionPercent >= PRELIMINARY_THRESHOLD_PERCENT
        ? "PRELIMINARY"
        : "NOT_READY";
  const computedConfidence: RecommendationConfidence =
    relevantCompletionPercent >= READY_THRESHOLD_PERCENT ? "HIGH" : relevantCompletionPercent >= PRELIMINARY_THRESHOLD_PERCENT ? "MEDIUM" : "LOW";

  return {
    type,
    // A counsellor's explicit verification is authoritative and always
    // wins, regardless of what the computed level/confidence would say —
    // the same "an explicit human override beats the automatic default"
    // pattern as COUNSELLOR_VERIFIED provenance in src/lib/profile-
    // provenance/rules.ts.
    level: override ? "COUNSELLOR_VERIFIED" : computedLevel,
    confidence: override ? "HIGH" : computedConfidence,
    relevantCompletionPercent,
    missingSectionKeys,
    verifiedByCounsellorId: override?.verifiedByCounsellorId ?? null,
    verifiedByCounsellorName: override?.verifiedByCounsellorName ?? null,
    verifiedAt: override?.verifiedAt ?? null,
    note: override?.note ?? null,
  };
}

/** Computes readiness for all four recommendation types at once — what every caller (admin card, dashboard, /recommendations) actually wants. */
export function computeAllRecommendationReadiness(
  completion: CompletionResult,
  overridesByType: Partial<Record<RecommendationType, RecommendationVerificationOverride>> = {}
): Record<RecommendationType, RecommendationReadiness> {
  const result = {} as Record<RecommendationType, RecommendationReadiness>;
  for (const type of RECOMMENDATION_TYPES) {
    result[type] = computeRecommendationReadiness(type, completion, overridesByType[type] ?? null);
  }
  return result;
}
