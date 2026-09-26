import type { ApplicationDocumentCompleteness, ApplicationDocumentReviewCompleteness } from "./application-documents";

/**
 * Milestone 18 — Application Requirements Checklist. Pure, framework-free —
 * same "pure logic in src/lib/<domain>/" convention as
 * application-lifecycle.ts and application-documents.ts. Nothing here talks
 * to Supabase.
 *
 * Deliberately a small, fixed, practical checklist — not a generic workflow
 * engine (task's own instruction). Of the eight example items the task
 * spec lists, only FOUR are genuinely staff-toggled manual state (below);
 * the other four are DERIVED at read time from real signals already
 * computed elsewhere in this codebase (document completeness, document
 * review, outstanding corrections, readiness) — a derived item can never
 * drift out of sync with the data it summarizes, because it is never
 * stored at all.
 */

export const APPLICATION_CHECKLIST_ITEM_KEYS = ["profile_reviewed", "eligibility_checked", "intake_confirmed", "details_confirmed"] as const;

export type ApplicationChecklistItemKey = (typeof APPLICATION_CHECKLIST_ITEM_KEYS)[number];

export function isApplicationChecklistItemKey(value: string): value is ApplicationChecklistItemKey {
  return (APPLICATION_CHECKLIST_ITEM_KEYS as readonly string[]).includes(value);
}

export const APPLICATION_CHECKLIST_ITEM_LABELS: Record<ApplicationChecklistItemKey, string> = {
  profile_reviewed: "Application profile reviewed",
  eligibility_checked: "Academic eligibility checked",
  intake_confirmed: "Course/intake confirmed",
  details_confirmed: "Application details confirmed",
};

export type ChecklistItemStatus = "complete" | "pending" | "action_required";

export interface ChecklistItemView {
  key: ApplicationChecklistItemKey | DerivedChecklistItemKey;
  label: string;
  status: ChecklistItemStatus;
  /** 'manual' items are toggled by staff (via toggleApplicationChecklistItem()); 'derived' items are computed here from other signals and can never be toggled directly. */
  kind: "manual" | "derived";
  completedAt: string | null;
}

export interface ManualChecklistItemState {
  key: ApplicationChecklistItemKey;
  completedAt: string | null;
}

const DERIVED_CHECKLIST_ITEM_KEYS = ["documents_uploaded", "documents_reviewed", "student_clarification_required", "ready_for_submission"] as const;
type DerivedChecklistItemKey = (typeof DERIVED_CHECKLIST_ITEM_KEYS)[number];

export interface ApplicationChecklistViewInput {
  manualItems: readonly ManualChecklistItemState[];
  documentCompleteness: ApplicationDocumentCompleteness;
  documentReviewCompleteness: ApplicationDocumentReviewCompleteness;
  /** Computed once by the caller via getApplicationReadiness() — passed in rather than recomputed here, so this module never needs to import application-readiness.ts (which itself composes manual checklist completion; keeping the dependency one-directional avoids a cycle). */
  isReady: boolean;
}

/**
 * The full eight-item checklist view: four manual items (in the fixed order
 * above) followed by four derived items. Every item resolves to exactly one
 * of complete/pending/action_required — never a fabricated percentage.
 */
export function getApplicationChecklistView(input: ApplicationChecklistViewInput): ChecklistItemView[] {
  const manualByKey = new Map(input.manualItems.map((m) => [m.key, m]));

  const manualViews: ChecklistItemView[] = APPLICATION_CHECKLIST_ITEM_KEYS.map((key) => {
    const state = manualByKey.get(key);
    return {
      key,
      label: APPLICATION_CHECKLIST_ITEM_LABELS[key],
      status: state?.completedAt ? "complete" : "pending",
      kind: "manual",
      completedAt: state?.completedAt ?? null,
    };
  });

  const { documentCompleteness, documentReviewCompleteness } = input;

  const derivedViews: ChecklistItemView[] = [
    {
      key: "documents_uploaded",
      label: "Required documents uploaded",
      status: documentCompleteness.isRequiredComplete ? "complete" : "action_required",
      kind: "derived",
      completedAt: null,
    },
    {
      key: "documents_reviewed",
      label: "Required documents reviewed",
      // Only meaningful once uploaded — otherwise there is nothing to
      // review yet, so this reads "pending" rather than a misleading
      // "action_required" for a document that was never uploaded at all
      // (that gap is already the "documents_uploaded" item's job).
      status: !documentCompleteness.isRequiredComplete ? "pending" : documentReviewCompleteness.isRequiredReviewComplete ? "complete" : "action_required",
      kind: "derived",
      completedAt: null,
    },
    {
      key: "student_clarification_required",
      label: "Student clarification required",
      // This item reads backwards from the other seven — its "good" state
      // is realizing NO clarification is outstanding, so 'complete' means
      // "nothing outstanding" and 'action_required' means "waiting on the
      // student".
      status: documentReviewCompleteness.hasOutstandingCorrection ? "action_required" : "complete",
      kind: "derived",
      completedAt: null,
    },
    {
      key: "ready_for_submission",
      label: "Ready for submission",
      status: input.isReady ? "complete" : "pending",
      kind: "derived",
      completedAt: null,
    },
  ];

  return [...manualViews, ...derivedViews];
}
