import type { ApplicationStage } from "@/types/admin";
import { APPLICATION_DOCUMENT_TYPE_LABELS, type ApplicationDocumentCompleteness, type ApplicationDocumentType } from "./application-documents";
import { APPLICATION_CHECKLIST_ITEM_LABELS, type ApplicationChecklistItemKey, type ManualChecklistItemState } from "./application-checklist";
import { getApplicationReadiness, type ApplicationReadinessInput } from "./application-readiness";
import type { ApplicationDocumentReviewCompleteness } from "./application-documents";

/**
 * Milestone 18 — the STAFF-facing "next operational action" helper (task
 * §11). Deliberately a separate module from application-lifecycle.ts's
 * `getApplicationNextAction()`, which is the STUDENT-facing equivalent and
 * stays untouched by this milestone — the two audiences need different
 * answers to "what happens next" (a student needs to know what THEY should
 * do; a counsellor needs to know what THEY should do), and merging them
 * would blur that.
 *
 * Deterministic and rules-based, by explicit task instruction — "Do NOT use
 * an LLM for this milestone." Every branch below is a plain conditional over
 * already-computed signals; see next-operational-action.test.ts for one
 * test per branch.
 */

export type NextOperationalActionKind =
  | "closed"
  | "review_documents"
  | "request_missing_documents"
  | "waiting_on_student"
  | "complete_checklist_item"
  | "ready_for_submission"
  | "add_application_reference"
  | "await_university_acknowledgement"
  | "no_action";

export interface NextOperationalAction {
  kind: NextOperationalActionKind;
  label: string;
}

const CLOSED_STAGES: readonly ApplicationStage[] = ["enrolled", "rejected", "withdrawn"];

const CHECKLIST_ACTION_LABELS: Record<ApplicationChecklistItemKey, string> = {
  profile_reviewed: "Review the application profile",
  eligibility_checked: "Complete eligibility check",
  intake_confirmed: "Confirm course/intake",
  details_confirmed: "Confirm application details",
};

export interface NextOperationalActionDocumentInput {
  documentType: ApplicationDocumentType;
  reviewStatus: "pending_review" | "accepted" | "needs_correction";
}

export interface NextOperationalActionInput {
  stage: ApplicationStage;
  currentDocuments: readonly NextOperationalActionDocumentInput[];
  documentCompleteness: ApplicationDocumentCompleteness;
  documentReviewCompleteness: ApplicationDocumentReviewCompleteness;
  manualChecklistItems: readonly ManualChecklistItemState[];
  /**
   * Milestone 19 — present once a public.application_submissions row exists
   * for this application; null/undefined for a not-yet-submitted
   * application. Optional so every M16-M18 call site (and their existing
   * tests) continues to compile and behave identically without being
   * updated — a caller that never passes this field simply never reaches
   * the two new post-submission branches below.
   */
  submission?: { hasExternalReference: boolean } | null;
}

/**
 * Fixed priority order, checked top to bottom — the FIRST matching rule
 * wins, so this can never report two contradictory "next actions" at once:
 *
 *   1. Closed application (enrolled/rejected/withdrawn) — nothing else
 *      matters once an application has reached a terminal state.
 *   2. Milestone 19 — a submission has already been recorded: add an
 *      external reference if none was captured yet, else wait for the
 *      university. This takes priority over every document/checklist
 *      branch below, since once a submission is recorded the M18
 *      processing steps that led to it are already resolved (the
 *      submission RPC itself re-validates that at write time).
 *   3. Any current document sitting in pending_review — reviewing what has
 *      already been submitted is the single highest-leverage staff action
 *      (it unblocks the student fastest).
 *   4. A required document is still missing — staff should chase it.
 *   5. A document is in needs_correction (a correction request is
 *      outstanding) — the ball is in the student's court now.
 *   6. A manual checklist item is incomplete — staff has an internal task
 *      left.
 *   7. Every signal is satisfied and the stage is appropriate — ready for
 *      the staff-controlled submission step (this module never performs
 *      that step itself — see application-readiness.ts's own header
 *      comment).
 *   8. Otherwise (e.g. under review/awaiting a decision, with nothing
 *      outstanding on this milestone's own signals) — no immediate action.
 */
export function getNextOperationalAction(input: NextOperationalActionInput): NextOperationalAction {
  if (CLOSED_STAGES.includes(input.stage)) {
    return { kind: "closed", label: "Application closed — no action needed." };
  }

  if (input.submission) {
    return input.submission.hasExternalReference
      ? { kind: "await_university_acknowledgement", label: "Await university acknowledgement." }
      : { kind: "add_application_reference", label: "Add the application reference once available." };
  }

  const pendingReviewCount = input.currentDocuments.filter((d) => d.reviewStatus === "pending_review").length;
  if (pendingReviewCount > 0) {
    return {
      kind: "review_documents",
      label: `Review ${pendingReviewCount} uploaded document${pendingReviewCount === 1 ? "" : "s"}.`,
    };
  }

  if (input.documentCompleteness.missingRequired.length > 0) {
    const firstMissing = input.documentCompleteness.missingRequired[0];
    return {
      kind: "request_missing_documents",
      label: `Request missing document: ${APPLICATION_DOCUMENT_TYPE_LABELS[firstMissing]}.`,
    };
  }

  if (input.documentReviewCompleteness.hasOutstandingCorrection) {
    return { kind: "waiting_on_student", label: "Waiting for student correction." };
  }

  const completedKeys = new Set(input.manualChecklistItems.filter((m) => m.completedAt).map((m) => m.key));
  const firstIncompleteChecklistKey = (Object.keys(CHECKLIST_ACTION_LABELS) as ApplicationChecklistItemKey[]).find((key) => !completedKeys.has(key));
  if (firstIncompleteChecklistKey) {
    return { kind: "complete_checklist_item", label: `${CHECKLIST_ACTION_LABELS[firstIncompleteChecklistKey]}.` };
  }

  const readinessInput: ApplicationReadinessInput = {
    stage: input.stage,
    documentCompleteness: input.documentCompleteness,
    documentReviewCompleteness: input.documentReviewCompleteness,
    manualChecklistItems: input.manualChecklistItems,
  };
  if (getApplicationReadiness(readinessInput).isReady) {
    return { kind: "ready_for_submission", label: "Ready for staff submission step." };
  }

  return { kind: "no_action", label: "Application requires no immediate action." };
}
