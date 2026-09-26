import type { ApplicationStage } from "@/types/admin";
import type { ApplicationDocumentCompleteness, ApplicationDocumentReviewCompleteness } from "./application-documents";
import { APPLICATION_CHECKLIST_ITEM_KEYS, type ManualChecklistItemState } from "./application-checklist";

/**
 * Milestone 18 — Application Readiness. Pure, framework-free — composes
 * EXISTING signals (M16 stage, M17 document completeness, M18 document
 * review + operational checklist) into one honest "is this application
 * ready to move toward submission" answer. Deliberately distinct from:
 *
 *   - M16's `ready_to_submit` STAGE value (src/lib/admin/status.ts) — that is
 *     a stage a student or admin explicitly sets via a controlled
 *     transition; this module never reads or writes it as an input, and
 *     never mutates it. An application can sit in the 'preparing' stage and
 *     still be "M18-ready" the moment every signal below is satisfied — this
 *     module tells staff that, it does not advance anything itself.
 *   - M17's document completeness alone (getApplicationDocumentCompleteness
 *     in ./application-documents.ts) — "documents exist" is only ONE input
 *     here; a required document that is uploaded but still pending_review
 *     or needs_correction does NOT make this module report ready (task's own
 *     explicit instruction: "do not claim an application is ready merely
 *     because documents exist").
 *
 * Purely informational. Nothing here submits, advances a stage, or performs
 * any action — the counsellor/admin remains responsible for explicit
 * progression (task's own instruction).
 */

export interface ApplicationReadinessInput {
  stage: ApplicationStage;
  documentCompleteness: ApplicationDocumentCompleteness;
  documentReviewCompleteness: ApplicationDocumentReviewCompleteness;
  manualChecklistItems: readonly ManualChecklistItemState[];
}

export type ApplicationReadinessBlockerReason = "stage_not_appropriate" | "documents_missing" | "documents_not_accepted" | "correction_outstanding" | "checklist_incomplete";

export interface ApplicationReadinessBlocker {
  reason: ApplicationReadinessBlockerReason;
  message: string;
}

export interface ApplicationReadiness {
  isReady: boolean;
  blockers: ApplicationReadinessBlocker[];
}

/**
 * The stages readiness is even a meaningful question for — "preparing
 * toward submission". A submitted/decided/withdrawn application has already
 * moved past what this checklist is about; reported as a blocker (never as
 * silently "ready") so staff are never told an already-submitted
 * application is merely "ready to submit".
 */
export const READINESS_APPROPRIATE_STAGES: readonly ApplicationStage[] = ["inquiry", "preparing", "ready_to_submit"];

export function getApplicationReadiness(input: ApplicationReadinessInput): ApplicationReadiness {
  const blockers: ApplicationReadinessBlocker[] = [];

  if (!READINESS_APPROPRIATE_STAGES.includes(input.stage)) {
    blockers.push({
      reason: "stage_not_appropriate",
      message: "This application has already moved past the pre-submission stage.",
    });
  }

  if (!input.documentCompleteness.isRequiredComplete) {
    const count = input.documentCompleteness.missingRequired.length;
    blockers.push({
      reason: "documents_missing",
      message: `${count} required document${count === 1 ? "" : "s"} still missing.`,
    });
  } else if (!input.documentReviewCompleteness.isRequiredReviewComplete) {
    blockers.push({
      reason: "documents_not_accepted",
      message: "Not all required documents have been accepted yet.",
    });
  }

  if (input.documentReviewCompleteness.hasOutstandingCorrection) {
    blockers.push({
      reason: "correction_outstanding",
      message: "A document correction request is still outstanding.",
    });
  }

  const completedKeys = new Set(input.manualChecklistItems.filter((m) => m.completedAt).map((m) => m.key));
  const incompleteCount = APPLICATION_CHECKLIST_ITEM_KEYS.filter((key) => !completedKeys.has(key)).length;
  if (incompleteCount > 0) {
    blockers.push({
      reason: "checklist_incomplete",
      message: `${incompleteCount} checklist item${incompleteCount === 1 ? "" : "s"} still pending.`,
    });
  }

  return { isReady: blockers.length === 0, blockers };
}
