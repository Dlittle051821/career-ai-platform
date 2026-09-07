/**
 * Milestone 11-C2 — Recommendation Readiness. Four recommendation types
 * (career/course/college/pathway) each get their own readiness level and
 * confidence, computed fresh from the Student Digital Profile — see
 * src/lib/recommendations/readiness.ts. This codebase currently has a real
 * matching ENGINE for career only (src/lib/recommendations/engine.ts);
 * course/college/pathway readiness is deliberately forward-looking
 * infrastructure a counsellor can already assess and verify today, per
 * supabase/migrations/0013_..._and_recommendation_readiness.sql PART 5's
 * own table comment.
 */

export const RECOMMENDATION_TYPES = ["career", "course", "college", "pathway"] as const;
export type RecommendationType = (typeof RECOMMENDATION_TYPES)[number];

export const RECOMMENDATION_TYPE_LABELS: Record<RecommendationType, string> = {
  career: "Career",
  course: "Course",
  college: "College",
  pathway: "Pathway",
};

/** Whether a real matching engine exists yet for this recommendation type — purely descriptive, never gates readiness computation itself. */
export const RECOMMENDATION_TYPE_HAS_ENGINE: Record<RecommendationType, boolean> = {
  career: true,
  course: false,
  college: false,
  pathway: false,
};

export const READINESS_LEVELS = ["NOT_READY", "PRELIMINARY", "READY", "COUNSELLOR_VERIFIED"] as const;
export type ReadinessLevel = (typeof READINESS_LEVELS)[number];

export const READINESS_LEVEL_LABELS: Record<ReadinessLevel, string> = {
  NOT_READY: "Not ready",
  PRELIMINARY: "Preliminary",
  READY: "Ready",
  COUNSELLOR_VERIFIED: "Counsellor verified",
};

export const RECOMMENDATION_CONFIDENCE_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
export type RecommendationConfidence = (typeof RECOMMENDATION_CONFIDENCE_LEVELS)[number];

export const RECOMMENDATION_CONFIDENCE_LABELS: Record<RecommendationConfidence, string> = {
  LOW: "Low confidence",
  MEDIUM: "Medium confidence",
  HIGH: "High confidence",
};

/**
 * One recommendation type's readiness for one student. `level`/`confidence`
 * are always computed fresh (never trusted from storage); `verifiedBy*`
 * fields are non-null only when a counsellor override row exists in
 * `student_recommendation_verifications` (the one piece of this that IS
 * stored — see the migration comment above).
 */
export interface RecommendationReadiness {
  type: RecommendationType;
  level: ReadinessLevel;
  confidence: RecommendationConfidence;
  /** 0-100 — weighted completion of the profile sections relevant to this recommendation type specifically (not the same number as overall profile completion). */
  relevantCompletionPercent: number;
  /** Profile section keys (src/types/profile-provenance.ts's ProfileSectionKey) relevant to this type that are not yet complete. */
  missingSectionKeys: string[];
  /** How many of this type's relevant sections exist at all (constant per type — the denominator behind relevantCompletionPercent, exposed so a caller can render "3 of 7 sections" rather than only a percentage). */
  relevantSectionCount: number;
  /** Milestone 11-C — how many of this type's relevant sections currently carry COUNSELLOR_VERIFIED provenance (src/types/profile-provenance.ts). Improves `confidence` (never `level` — see computeRecommendationReadiness()'s own comment) when a counsellor has independently reviewed enough of the underlying data. */
  verifiedRelevantSectionCount: number;
  /** Milestone 11-C — one plain-language action per missing relevant section (e.g. "Tell us whether you prefer India, abroad, or both."), in the same order as missingSectionKeys — what a student-facing UI should show instead of a generic "profile incomplete" message. Empty when nothing is missing. */
  nextActions: string[];
  verifiedByCounsellorId: string | null;
  verifiedByCounsellorName: string | null;
  verifiedAt: string | null;
  note: string | null;
}
