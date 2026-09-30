import type { ApplicationStage } from "@/types/admin";
import type { ApplicationReadiness } from "./application-readiness";

/**
 * Milestone 19 — Application Submission Preparation & Manual Submission
 * Tracking. Pure, framework-free — same "pure logic lives in
 * src/lib/applications/, I/O lives in src/lib/supabase/{admin,education}/"
 * convention as every prior milestone in this directory. Nothing here talks
 * to Supabase.
 *
 * THREE-LAYER RELATIONSHIP (task's own explicit documentation requirement):
 *
 *   - M16 `stage` (application-lifecycle.ts, src/lib/admin/status.ts) is the
 *     LIFECYCLE STATE — the authoritative record of where an application
 *     actually is, changed only via a controlled transition.
 *   - M18 `getApplicationReadiness()` (application-readiness.ts) is an
 *     OPERATIONAL PROCESSING SIGNAL — "is the staff-side prep work (document
 *     review, checklist) done" — deliberately answerable even while the
 *     application still sits in 'inquiry' or 'preparing', because that
 *     question is useful before the application has even reached
 *     'ready_to_submit'.
 *   - M19 `getApplicationSubmissionReadiness()` (this file) is the FINAL GATE
 *     before staff may record an external submission. It COMPOSES the other
 *     two rather than re-deriving anything they already answer: it takes
 *     M18's own ApplicationReadiness result as an input verbatim (never
 *     re-checking document completeness/review/checklist state itself), and
 *     adds exactly two things M18 does not and must not answer on its own:
 *     (1) a STRICT stage requirement — this application must actually be
 *     AT `ready_to_submit` right now, not merely "M18-ready" while still in
 *     'preparing' — because 'ready_to_submit' is the only stage the existing
 *     M16 lifecycle graph (APPLICATION_STAGE_TRANSITIONS) allows a
 *     transition to 'submitted' from at all; and (2) whether a submission
 *     has already been recorded (an application is never "ready to submit
 *     again" once submitted — see this milestone's "one immutable submission
 *     per application" design decision, documented in
 *     supabase/migrations/0021_application_submission_tracking.sql's own
 *     header comment and docs/application-submission-guide.md).
 *
 * This module NEVER mutates a stage, NEVER records a submission, and NEVER
 * imports anything from src/lib/supabase/ — it only turns already-fetched
 * signals into an honest yes/no-plus-reasons answer, mirroring
 * application-readiness.ts's own "purely informational" posture exactly.
 */

// ---------------------------------------------------------------------------
// Submission method vocabulary — a fixed, small set, kept in sync BY HAND
// with the identical CHECK constraint in
// supabase/migrations/0021_application_submission_tracking.sql
// (application_submissions_method_check). This is the same manual-sync
// convention this codebase already uses for document_type/item_key (see
// application-documents.ts / application-checklist.ts's own comments).
// `agent_partner` is a plain descriptive label only — it is NOT
// implemented as, and must never grow into, an agent workflow/commission
// engine (explicitly out of scope for this milestone).
// ---------------------------------------------------------------------------

export const APPLICATION_SUBMISSION_METHODS = ["university_portal", "centralized_platform", "email", "agent_partner", "other"] as const;

export type ApplicationSubmissionMethod = (typeof APPLICATION_SUBMISSION_METHODS)[number];

export function isApplicationSubmissionMethod(value: string): value is ApplicationSubmissionMethod {
  return (APPLICATION_SUBMISSION_METHODS as readonly string[]).includes(value);
}

export const APPLICATION_SUBMISSION_METHOD_LABELS: Record<ApplicationSubmissionMethod, string> = {
  university_portal: "University portal",
  centralized_platform: "Centralized platform",
  email: "Email",
  agent_partner: "Agent / partner",
  other: "Other",
};

// ---------------------------------------------------------------------------
// External reference-data validation — pure length/format checks mirrored
// exactly by the CHECK constraints in the migration above (defense in
// depth: the same rule expressed once here for client-side/server-action
// pre-validation, and once again as the database's own authoritative
// constraint — never relied on as the ONLY enforcement).
// ---------------------------------------------------------------------------

export const APPLICATION_SUBMISSION_PLATFORM_NAME_MAX_LENGTH = 200;
export const APPLICATION_SUBMISSION_EXTERNAL_REFERENCE_MAX_LENGTH = 200;
export const APPLICATION_SUBMISSION_EXTERNAL_URL_MAX_LENGTH = 500;
export const APPLICATION_SUBMISSION_INTERNAL_NOTE_MAX_LENGTH = 2000;

/**
 * A conservative, honest external-URL check — must be a plausible http(s)
 * URL within the length limit. Deliberately does not attempt to verify the
 * URL resolves anywhere or is "safe" in any deeper sense (that is not
 * something this codebase can verify server-side without itself making an
 * outbound request to an address a staff member typed in, which is its own
 * class of risk this milestone does not take on) — it only rejects the
 * obviously-wrong shapes (empty, no scheme, wrong scheme, too long) before
 * the value ever reaches the database's own identical CHECK constraint.
 */
export function isValidApplicationSubmissionUrl(value: string): boolean {
  if (value.length === 0 || value.length > APPLICATION_SUBMISSION_EXTERNAL_URL_MAX_LENGTH) return false;
  return /^https?:\/\//.test(value);
}

// ---------------------------------------------------------------------------
// Submission readiness — the final gate.
// ---------------------------------------------------------------------------

export type ApplicationSubmissionReadinessBlockerReason =
  | "stage_not_ready_to_submit"
  | "operational_readiness_incomplete"
  | "already_submitted";

export interface ApplicationSubmissionReadinessBlocker {
  reason: ApplicationSubmissionReadinessBlockerReason;
  message: string;
}

export interface ApplicationSubmissionReadiness {
  isReady: boolean;
  blockers: ApplicationSubmissionReadinessBlocker[];
}

export interface ApplicationSubmissionReadinessInput {
  stage: ApplicationStage;
  /** Computed once by the caller via getApplicationReadiness() (M18) — passed in rather than recomputed here, so this module never duplicates M18's own document/checklist logic. */
  applicationReadiness: ApplicationReadiness;
  /** True once a public.application_submissions row already exists for this application (see this milestone's "one immutable submission per application" design decision). */
  hasExistingSubmission: boolean;
}

/**
 * The M19 final gate. Blockers are additive, never mutually exclusive with
 * M18's own — a caller that wants the full underlying reason list (e.g. "2
 * required documents still need review") should render
 * `input.applicationReadiness.blockers` directly alongside whatever this
 * function returns, exactly as the admin workspace UI does (see
 * src/app/admin/applications/[id]/page.tsx's Submission preparation
 * section).
 */
export function getApplicationSubmissionReadiness(input: ApplicationSubmissionReadinessInput): ApplicationSubmissionReadiness {
  const blockers: ApplicationSubmissionReadinessBlocker[] = [];

  if (input.hasExistingSubmission) {
    blockers.push({
      reason: "already_submitted",
      message: "This application has already been recorded as submitted.",
    });
  }

  if (input.stage !== "ready_to_submit") {
    blockers.push({
      reason: "stage_not_ready_to_submit",
      message: 'This application must be in the "Ready to submit" stage before staff can record an external submission.',
    });
  }

  if (!input.applicationReadiness.isReady) {
    blockers.push({
      reason: "operational_readiness_incomplete",
      message: "This application still has outstanding processing steps — see the blockers below.",
    });
  }

  return { isReady: blockers.length === 0, blockers };
}
