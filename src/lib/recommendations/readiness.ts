import type { CompletionResult } from "@/types/student-profile";
import { RECOMMENDATION_CONFIDENCE_LEVELS, RECOMMENDATION_TYPES, type RecommendationType, type ReadinessLevel, type RecommendationConfidence, type RecommendationReadiness } from "@/types/recommendation-readiness";
import { PROFILE_SECTION_LABELS, type ProfileSectionKey, type SectionProvenance } from "@/types/profile-provenance";

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
 *
 * Milestone 11-C — Section-level profile provenance (student_profile_
 * section_provenance, src/types/profile-provenance.ts) now feeds this
 * computation too, but deliberately only as a CONFIDENCE signal, never a
 * level override: a counsellor independently reviewing and verifying
 * enough of a student's relevant sections should make Nextwise more
 * confident in whatever level the data already supports — it must never,
 * by itself, manufacture data that isn't there. That is the one-line
 * distinction between this and the separate, deliberate
 * student_recommendation_verifications override (the `override` parameter
 * below): that table is an explicit "I professionally vouch this type is
 * ready regardless of the score" action a counsellor takes on purpose (see
 * its own migration comment, 0013 PART 5) — a stronger, human-initiated
 * signal than incidental section provenance, so it is left free to raise
 * `level` all the way to COUNSELLOR_VERIFIED, unlike provenance here.
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

/**
 * Milestone 11-C — how much of a recommendation type's relevant sections
 * must carry COUNSELLOR_VERIFIED provenance before it's worth raising
 * confidence one tier (LOW->MEDIUM or MEDIUM->HIGH; HIGH has nowhere higher
 * to go). Set at "at least half" rather than "any single section" so one
 * verified section on an otherwise-untouched profile can't overstate
 * confidence — deliberately the same kind of considered, explained
 * threshold as READY_THRESHOLD_PERCENT/PRELIMINARY_THRESHOLD_PERCENT above,
 * not an arbitrary number.
 */
const COUNSELLOR_VERIFIED_CONFIDENCE_BOOST_RATIO = 0.5;

/**
 * Milestone 11-C — one plain-language next action per profile section,
 * shown to a student in place of a generic "profile incomplete" message
 * (spec: avoid generic messages when specific guidance is available). Kept
 * here rather than in src/types/profile-provenance.ts because "what should
 * a student do about it" is a readiness/recommendations concern, not a
 * property of the section itself — PROFILE_SECTION_LABELS there stays the
 * neutral, reusable label.
 */
const PROFILE_SECTION_NEXT_ACTION: Record<ProfileSectionKey, string> = {
  about_you: "Tell us your current academic stage.",
  education: "Add your current or most recent educational institution and scores.",
  subject_strengths: "Rate at least a few subjects you're strong in.",
  interests: "Add at least one career or subject interest.",
  skills: "Add a couple of skills you already have.",
  work_preferences: "Tell us what kind of work environment you'd prefer.",
  career_priorities: "Tell us what matters most to you in a career — salary, growth, balance, and so on.",
  career_goals: "Tell us about your career goals, even if they're not fully clear yet.",
  study_location: "Tell us whether you prefer India, abroad, or both.",
  budget_funding: "Add your approximate study budget.",
  experience: "Add any internships, projects, or work experience (optional).",
};

function bumpConfidenceOneTier(level: RecommendationConfidence): RecommendationConfidence {
  const index = RECOMMENDATION_CONFIDENCE_LEVELS.indexOf(level);
  return RECOMMENDATION_CONFIDENCE_LEVELS[Math.min(index + 1, RECOMMENDATION_CONFIDENCE_LEVELS.length - 1)];
}

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
  override: RecommendationVerificationOverride | null = null,
  sectionProvenance: Partial<Record<ProfileSectionKey, SectionProvenance>> = {}
): RecommendationReadiness {
  const relevantKeys = RELEVANT_SECTION_KEYS[type];
  const relevantSections = completion.sections.filter((s) => relevantKeys.includes(s.key));

  const totalWeight = relevantSections.reduce((sum, s) => sum + s.weight, 0);
  const completedWeight = relevantSections.filter((s) => s.complete).reduce((sum, s) => sum + s.weight, 0);
  // Defensive only — every RELEVANT_SECTION_KEYS entry above sums to a
  // positive weight (guarded by a regression test), so totalWeight is
  // never actually 0 in practice.
  const relevantCompletionPercent = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
  const missingSections = relevantSections.filter((s) => !s.complete);
  const missingSectionKeys = missingSections.map((s) => s.key);
  const nextActions = missingSections.map((s) => PROFILE_SECTION_NEXT_ACTION[s.key as ProfileSectionKey] ?? `Complete your ${PROFILE_SECTION_LABELS[s.key as ProfileSectionKey] ?? s.label} section.`);

  const computedLevel: ReadinessLevel =
    relevantCompletionPercent >= READY_THRESHOLD_PERCENT
      ? "READY"
      : relevantCompletionPercent >= PRELIMINARY_THRESHOLD_PERCENT
        ? "PRELIMINARY"
        : "NOT_READY";
  const baseConfidence: RecommendationConfidence =
    relevantCompletionPercent >= READY_THRESHOLD_PERCENT ? "HIGH" : relevantCompletionPercent >= PRELIMINARY_THRESHOLD_PERCENT ? "MEDIUM" : "LOW";

  // Milestone 11-C — a counsellor who has independently reviewed enough of
  // THIS type's relevant sections earns a confidence bump, never a level
  // bump: it can turn MEDIUM into HIGH, but it can never turn NOT_READY
  // into READY on its own (spec: "do not automatically mark a student
  // READY merely because a counsellor touched the profile — the underlying
  // information must still be sufficient").
  const verifiedRelevantSectionCount = relevantSections.filter((s) => sectionProvenance[s.key as ProfileSectionKey]?.provenance === "COUNSELLOR_VERIFIED").length;
  const verifiedRatio = relevantSections.length > 0 ? verifiedRelevantSectionCount / relevantSections.length : 0;
  const computedConfidence = verifiedRatio >= COUNSELLOR_VERIFIED_CONFIDENCE_BOOST_RATIO ? bumpConfidenceOneTier(baseConfidence) : baseConfidence;

  return {
    type,
    // A counsellor's explicit RECOMMENDATION-TYPE verification
    // (student_recommendation_verifications) is a distinct, stronger, and
    // deliberately human-initiated action from section provenance above —
    // see this file's top-of-file comment for the full "why". It is
    // authoritative and always wins, regardless of what the computed
    // level/confidence would say, the same "an explicit human override
    // beats the automatic default" pattern as COUNSELLOR_VERIFIED
    // provenance itself in src/lib/profile-provenance/rules.ts.
    level: override ? "COUNSELLOR_VERIFIED" : computedLevel,
    confidence: override ? "HIGH" : computedConfidence,
    relevantCompletionPercent,
    missingSectionKeys,
    relevantSectionCount: relevantSections.length,
    verifiedRelevantSectionCount,
    nextActions,
    verifiedByCounsellorId: override?.verifiedByCounsellorId ?? null,
    verifiedByCounsellorName: override?.verifiedByCounsellorName ?? null,
    verifiedAt: override?.verifiedAt ?? null,
    note: override?.note ?? null,
  };
}

/** Computes readiness for all four recommendation types at once — what every caller (admin card, dashboard, /recommendations) actually wants. */
export function computeAllRecommendationReadiness(
  completion: CompletionResult,
  overridesByType: Partial<Record<RecommendationType, RecommendationVerificationOverride>> = {},
  sectionProvenance: Partial<Record<ProfileSectionKey, SectionProvenance>> = {}
): Record<RecommendationType, RecommendationReadiness> {
  const result = {} as Record<RecommendationType, RecommendationReadiness>;
  for (const type of RECOMMENDATION_TYPES) {
    result[type] = computeRecommendationReadiness(type, completion, overridesByType[type] ?? null, sectionProvenance);
  }
  return result;
}
