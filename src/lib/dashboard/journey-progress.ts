import type { ProfileStatus } from "@/types/student-profile";
import type { ReadinessLevel } from "@/types/recommendation-readiness";
import type { ApplicationStage } from "@/types/admin";
import { getApplicationBucket } from "@/lib/applications/application-lifecycle";

/**
 * UX04 — Student Journey Progress.
 *
 * Conceptual journey: Explore -> Build Profile -> Recommendations ->
 * Saved Options -> Decide -> Apply. This is deliberately NOT a rigid,
 * gated funnel a student must complete in order — it is an honest map of
 * "where am I now?" drawn from data this product already records. See
 * docs/ux/UX03-04_DESIGN_SYSTEM_JOURNEY.md for the full per-stage data
 * source audit and the reasoning below.
 *
 * Naming: the product's saved-item model is a flat "saved" boolean
 * (education_saved_items — Milestone 9), not a formal two-stage
 * Saved -> Shortlisted product (see the UX01-02 foundation audit, §6).
 * This stage is therefore called "Saved Options", never "Shortlist", so
 * the label never claims a distinction the data doesn't have.
 *
 * Per-stage derivation, and why:
 *
 * - Explore: this product does not expose a student's own page-view
 *   history to student-facing code today — `product_events` (career/
 *   course/college "_viewed" events, Milestone 9) is real and already
 *   recorded, but its RLS policy only grants SELECT to
 *   super_admin/admin/analyst roles; reading a student's own rows would
 *   need a new policy, i.e. a database migration, which this milestone's
 *   spec explicitly avoids ("strong preference: no database change").
 *   Rather than fabricate a "visited" signal, Explore is instead treated
 *   as satisfied the moment ANY later, honestly-derived stage shows real
 *   activity (a saved item, an application, a completed profile, or
 *   ready recommendations) — none of those can exist without the
 *   student having explored first. Until then it is simply "current":
 *   the natural first thing to do, never fabricated as "complete".
 * - Build Profile: taken directly from the Student Digital Profile's own
 *   completion status (src/lib/profile/completion.ts) — the same status
 *   already shown on the dashboard's profile card. Not re-derived here.
 * - Recommendations: taken from Recommendation Readiness (Milestone
 *   11-C2) AND real recommendation-engine output together —
 *   READY/COUNSELLOR_VERIFIED alone marks this stage "complete" NO
 *   LONGER; it also requires `hasUsableCareerRecommendations` (whether
 *   `getRecommendations()` actually returned at least one real career
 *   match against the live catalogue). NW01 Part D — readiness level
 *   only reflects whether the STUDENT'S OWN profile has enough data; it
 *   says nothing about whether the career catalogue itself currently has
 *   any matchable careers (the exact gap the original catalogue outage
 *   exposed: readiness said "ready" while zero careers existed to
 *   recommend). This still never claims the student has reviewed them
 *   (no such "reviewed" signal is stored anywhere in this product; see
 *   Section N of the UX03/04 spec, and NW01 brief Part D's explicit "do
 *   not fabricate a reviewed signal"). Copy is worded accordingly ("ready
 *   to view", never "reviewed").
 * - Saved Options: at least one row in education_saved_items.
 * - Decide: no persistent "a decision was made" signal exists anywhere
 *   in this product — career/course comparison (CompareTray and
 *   friends) is deliberately client-only React state, never persisted,
 *   and university-to-university comparison doesn't exist at all. This
 *   stage can therefore never honestly reach "complete" today. It is
 *   always rendered as informational/upcoming and never gates whether
 *   the Apply stage can be current — see `GATING_STAGES` below.
 * - Apply: NW01 Part E — no longer "at least one row exists, regardless
 *   of stage". A plain inquiry/preparing/ready_to_submit row is not a
 *   completed application ("an inquiry is NOT a completed application" —
 *   NW01 brief Part E); this stage is "complete" only once at least one
 *   application has moved past that internal-prep bucket, reusing the
 *   REAL, already-existing `getApplicationBucket()` classification
 *   (src/lib/applications/application-lifecycle.ts, Milestone 16/19) —
 *   "active" (inquiry/preparing/ready_to_submit) does not count;
 *   "submitted"/"decision"/"closed" do, because each of those buckets
 *   only exists once a stage transition past ready_to_submit has
 *   genuinely happened (and, as of Milestone 19, "submitted" itself can
 *   only ever be reached via the staff-recorded, immutable
 *   `application_submissions` row — see application-lifecycle.ts's own
 *   `submit` action docblock). No new status value or schema change was
 *   needed — the existing `ApplicationStage` enum already distinguishes
 *   this correctly; the bug was purely that this module never consulted
 *   it.
 *
 * This module intentionally does NOT produce its own call-to-action
 * text ("what should I do next") — that is `getNextBestAction()`'s job
 * (src/lib/dashboard/next-best-action.ts), which already reads the same
 * underlying state. Journey Progress is orientation (where am I?);
 * Next Best Action is action (what do I do?). Keeping this module to
 * stage/state/description output only is what keeps the dashboard to
 * ONE coherent "what's next" experience instead of two competing ones.
 */

export const JOURNEY_STAGE_KEYS = ["explore", "build_profile", "recommendations", "saved_options", "decide", "apply"] as const;
export type JourneyStageKey = (typeof JOURNEY_STAGE_KEYS)[number];

export type JourneyStageState = "complete" | "current" | "upcoming";

export interface JourneyStage {
  key: JourneyStageKey;
  label: string;
  state: JourneyStageState;
  description: string;
  href: string;
  /**
   * True only for "decide" today — a stage this product cannot honestly
   * mark complete with any data it currently records. Rendered as
   * informational rather than as a blocking step.
   */
  informational: boolean;
}

export interface JourneyProgress {
  stages: JourneyStage[];
  /** The stage most worth the student's attention right now. Always a non-informational stage. */
  currentStage: JourneyStageKey;
  completedStages: JourneyStageKey[];
}

export interface JourneyProgressInput {
  profileStatus: ProfileStatus;
  profilePercent: number;
  careerReadinessLevel: ReadinessLevel | null;
  /**
   * NW01 Part D — whether `getRecommendations()` actually returned at
   * least one real career match against the live catalogue right now
   * (e.g. `results.length > 0`), independent of `careerReadinessLevel`.
   * Required for the "recommendations" stage to ever read "complete" —
   * see the module docblock above.
   */
  hasUsableCareerRecommendations: boolean;
  savedItemCount: number;
  /** NW01 Part E — every one of the student's own applications' real stages, used to tell an internal inquiry/prep record apart from an actual recorded submission via `getApplicationBucket()`. */
  applicationStages: ApplicationStage[];
}

const STAGE_LABELS: Record<JourneyStageKey, string> = {
  explore: "Explore",
  build_profile: "Build Profile",
  recommendations: "Recommendations",
  saved_options: "Saved Options",
  decide: "Decide",
  apply: "Apply",
};

const STAGE_HREFS: Record<JourneyStageKey, string> = {
  explore: "/careers",
  build_profile: "/profile/onboarding",
  recommendations: "/recommendations",
  saved_options: "/saved",
  decide: "/compare",
  apply: "/applications",
};

/** Gating order — "decide" is deliberately excluded, per the module doc above: it never blocks Apply from becoming current. */
const GATING_STAGES: readonly JourneyStageKey[] = ["explore", "build_profile", "recommendations", "saved_options", "apply"];

export function computeJourneyProgress(input: JourneyProgressInput): JourneyProgress {
  const { profileStatus, profilePercent, careerReadinessLevel, hasUsableCareerRecommendations, savedItemCount, applicationStages } = input;

  const applicationCount = applicationStages.length;
  const buildProfileComplete = profileStatus === "completed";
  const readinessSaysReady = careerReadinessLevel === "READY" || careerReadinessLevel === "COUNSELLOR_VERIFIED";
  // NW01 Part D — readiness alone is not proof usable recommendations
  // exist; both must be true. See module docblock.
  const recommendationsComplete = readinessSaysReady && hasUsableCareerRecommendations;
  const savedOptionsComplete = savedItemCount > 0;
  // NW01 Part E — "complete" requires at least one application that has
  // genuinely moved past the inquiry/preparing/ready_to_submit bucket,
  // not merely "a row exists". See module docblock.
  const applyComplete = applicationStages.some((stage) => getApplicationBucket(stage) !== "active");
  const exploreComplete = savedOptionsComplete || applyComplete || buildProfileComplete || recommendationsComplete;

  const completeByKey: Record<JourneyStageKey, boolean> = {
    explore: exploreComplete,
    build_profile: buildProfileComplete,
    recommendations: recommendationsComplete,
    saved_options: savedOptionsComplete,
    decide: false,
    apply: applyComplete,
  };

  let currentStage: JourneyStageKey = GATING_STAGES[GATING_STAGES.length - 1];
  for (const key of GATING_STAGES) {
    if (!completeByKey[key]) {
      currentStage = key;
      break;
    }
  }

  const stages: JourneyStage[] = JOURNEY_STAGE_KEYS.map((key) => {
    const informational = key === "decide";
    const complete = completeByKey[key];
    const state: JourneyStageState = informational ? "upcoming" : complete ? "complete" : key === currentStage ? "current" : "upcoming";
    return {
      key,
      label: STAGE_LABELS[key],
      state,
      description: describeStage(key, state, { profilePercent, savedItemCount, applicationCount, readinessSaysReady }),
      href: STAGE_HREFS[key],
      informational,
    };
  });

  const completedStages = stages.filter((s) => s.state === "complete").map((s) => s.key);

  return { stages, currentStage, completedStages };
}

function describeStage(
  key: JourneyStageKey,
  state: JourneyStageState,
  ctx: { profilePercent: number; savedItemCount: number; applicationCount: number; readinessSaysReady: boolean }
): string {
  switch (key) {
    case "explore":
      return state === "complete" ? "You've started exploring options." : "Browse careers, courses, and universities to get started.";
    case "build_profile":
      if (state === "complete") return "Your Student Digital Profile is complete.";
      if (ctx.profilePercent > 0) return `${ctx.profilePercent}% complete — pick up where you left off.`;
      return "Add your details to unlock personalised guidance.";
    case "recommendations":
      if (state === "complete") return "Your recommendations are ready to view.";
      if (state === "current") {
        // NW01 Part D — readiness can say "ready" while there are still
        // no usable results (a catalogue-availability gap, not a profile
        // gap) — this honestly distinguishes the two instead of always
        // blaming "a bit more information", which would be wrong when the
        // real cause is on our side, not the student's.
        return ctx.readinessSaysReady
          ? "Your profile is ready, but we don't have matching recommendations available right now — please check back soon."
          : "A bit more information will make these more useful.";
      }
      return "Available once your Student Digital Profile is complete.";
    case "saved_options":
      if (state === "complete") {
        return `${ctx.savedItemCount} item${ctx.savedItemCount === 1 ? "" : "s"} saved for later.`;
      }
      return "Save careers, courses, or universities you're considering.";
    case "decide":
      return "Compare your saved options side by side when you're ready to decide — a feature we're continuing to build out.";
    case "apply":
      if (state === "complete") {
        return `${ctx.applicationCount} application${ctx.applicationCount === 1 ? "" : "s"} submitted or further along.`;
      }
      // NW01 Part E — an application can exist (inquiry/preparing/
      // ready_to_submit) without yet being "complete" here; say so
      // honestly instead of implying the student hasn't started at all.
      if (ctx.applicationCount > 0) {
        return `${ctx.applicationCount} application${ctx.applicationCount === 1 ? "" : "s"} in progress — not yet submitted.`;
      }
      return "Apply once you've decided on a course or university.";
  }
}
