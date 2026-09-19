import type { ReadinessLevel } from "@/types/recommendation-readiness";

/**
 * UX06D — friendlier, student-facing translation of a Recommendation
 * Readiness level, for the dashboard's own "Where you stand" section.
 *
 * This is deliberately a NEW, standalone module rather than an edit to
 * src/components/sections/recommendations/ReadinessBadge.tsx (which
 * already does a thin one-word translation via READINESS_LEVEL_LABELS —
 * "Not ready" / "Preliminary" / "Ready" / "Counsellor verified" — and is
 * kept exactly as-is here, still used for the compact badge) or to
 * src/lib/dashboard/next-best-action.ts / journey-progress.ts, whose
 * public branch order and copy are locked by their own existing test
 * suites. This module only supplies a longer headline + description pair
 * for the dashboard page's own rendering; it never feeds back into either
 * of those two modules' decision logic.
 *
 * Per the UX05/06 spec's own audit note: the real codebase enum is
 * `NOT_READY | PRELIMINARY | READY | COUNSELLOR_VERIFIED` (plus a
 * separate LOW/MEDIUM/HIGH confidence axis) — not the spec's guessed
 * `NOT_READY`/`PARTIALLY_READY`/`NEEDS_COUNSELLOR_REVIEW` names. The
 * underlying principle (never show a raw enum value to a student) is
 * honored against the real four-value enum below.
 */
export interface ReadinessCopy {
  headline: string;
  description: string;
}

const READINESS_COPY: Record<ReadinessLevel, ReadinessCopy> = {
  NOT_READY: {
    headline: "We need a bit more from your profile first",
    description: "Add a few more sections to your Student Digital Profile and we'll start putting recommendations together.",
  },
  PRELIMINARY: {
    headline: "We can already show you a first pass",
    description: "Your recommendations are usable today, and they'll keep sharpening as you fill in more of your profile.",
  },
  READY: {
    headline: "Your recommendations are ready",
    description: "Your Student Digital Profile has enough detail for a full set of ranked, explained recommendations.",
  },
  COUNSELLOR_VERIFIED: {
    headline: "A counsellor has reviewed your recommendations",
    description: "A NextWise counsellor has checked and confirmed your profile details behind these recommendations.",
  },
};

export function getReadinessCopy(level: ReadinessLevel): ReadinessCopy {
  return READINESS_COPY[level];
}

/**
 * Whether a level is still on its way to being usable, i.e. the student
 * likely benefits from being nudged to add more to their profile. Mirrors
 * the same NOT_READY/PRELIMINARY grouping getNextBestAction() already
 * uses internally (src/lib/dashboard/next-best-action.ts) — duplicated
 * here as a tiny, obviously-equivalent predicate rather than importing
 * private branch logic out of that locked module, so this module has no
 * ability to change next-best-action.ts's own behavior.
 */
export function isReadinessStillBuilding(level: ReadinessLevel): boolean {
  return level === "NOT_READY" || level === "PRELIMINARY";
}
