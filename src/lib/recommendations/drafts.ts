/**
 * NW07.6 — Recommendation Workflow. Pure, framework-free taxonomy and
 * classification logic — no Supabase import, same "pure logic lives in
 * src/lib/<domain>/, I/O lives in src/lib/supabase/<domain>/" convention as
 * src/lib/applications/application-tasks.ts. See
 * supabase/migrations-proposed/NW07_counsellor_studio_foundation.sql PART 2
 * for the backing schema and docs/milestones/NW07/NW07_06_RECOMMENDATION_
 * WORKFLOW.md for the full design writeup.
 */

export const RECOMMENDATION_DRAFT_STATUSES = [
  "draft",
  "submitted_for_review",
  "changes_requested",
  "approved",
  "released_to_student",
  "archived",
] as const;

export type RecommendationDraftStatus = (typeof RECOMMENDATION_DRAFT_STATUSES)[number];

export function isRecommendationDraftStatus(value: string): value is RecommendationDraftStatus {
  return (RECOMMENDATION_DRAFT_STATUSES as readonly string[]).includes(value);
}

export const RECOMMENDATION_DRAFT_STATUS_LABELS: Record<RecommendationDraftStatus, string> = {
  draft: "Draft",
  submitted_for_review: "Submitted for review",
  changes_requested: "Changes requested",
  approved: "Approved — ready to release",
  released_to_student: "Released to student",
  archived: "Archived",
};

/**
 * The fixed transition table, restated here in pure TS purely for UI
 * purposes (which action buttons to show) — the DATABASE-AUTHORITATIVE copy
 * lives across staff_submit_recommendation_draft_for_review()/
 * staff_review_recommendation_draft()/staff_release_recommendation_draft()/
 * staff_withdraw_recommendation_draft()/staff_archive_recommendation_draft()
 * (NW07_counsellor_studio_foundation.sql PART 2); this is never trusted as
 * the security boundary, only as a UI convenience so an impossible button
 * is never rendered.
 */
export function getAllowedRecommendationDraftActions(status: RecommendationDraftStatus): RecommendationDraftAction[] {
  switch (status) {
    case "draft":
      return ["edit", "submit_for_review"];
    case "submitted_for_review":
      return ["review_approve", "review_request_changes", "withdraw"];
    case "changes_requested":
      return ["edit", "submit_for_review"];
    case "approved":
      return ["release", "archive"];
    case "released_to_student":
      return ["archive"];
    case "archived":
      return [];
  }
}

export const RECOMMENDATION_DRAFT_ACTIONS = [
  "edit",
  "submit_for_review",
  "review_approve",
  "review_request_changes",
  "withdraw",
  "release",
  "archive",
] as const;

export type RecommendationDraftAction = (typeof RECOMMENDATION_DRAFT_ACTIONS)[number];

/**
 * True when editing content is allowed from this status — mirrors
 * staff_update_recommendation_draft_content()'s own status guard. UI
 * convenience only, same caveat as getAllowedRecommendationDraftActions().
 */
export function isRecommendationDraftEditable(status: RecommendationDraftStatus): boolean {
  return status === "draft" || status === "changes_requested";
}

/**
 * The one rule that is NEVER a UI-only convenience — the database itself
 * (staff_review_recommendation_draft()) raises if the reviewer is the
 * draft's own author, with no role-based exception. Restated here only so
 * the UI can disable the Approve/Request changes buttons for the author
 * BEFORE they click (a friendlier failure than a server error), never as a
 * substitute for the database check.
 */
export function canReviewOwnDraft(authorUserId: string, reviewerUserId: string): boolean {
  return authorUserId !== reviewerUserId;
}

export const RECOMMENDATION_DRAFT_TYPES = ["career", "course", "college", "pathway"] as const;
export type RecommendationDraftType = (typeof RECOMMENDATION_DRAFT_TYPES)[number];

export function isRecommendationDraftType(value: string): value is RecommendationDraftType {
  return (RECOMMENDATION_DRAFT_TYPES as readonly string[]).includes(value);
}

/**
 * The authored content shape (recommendation_draft_versions.content).
 * Deliberately a free-form, optional-everything bag — mirrors
 * DiscoverySessionWorkspace's own sections (src/types/discovery-session.ts)
 * rather than a rigid mandatory form; a counsellor fills in what applies to
 * this student, this report. Every field is the counsellor's own
 * professional synthesis — never a fabricated admissions eligibility claim
 * or a guarantee of admission (brief's own hard constraint, restated in
 * NW07_SECURITY_THREAT_MODEL.md).
 */
export interface RecommendationDraftContent {
  summary?: string;
  careerGuidance?: string;
  courseGuidance?: string;
  collegeGuidance?: string;
  pathwayGuidance?: string;
  counsellorRationale?: string;
}

export interface RecommendationDraftSummaryInput {
  id: string;
  status: RecommendationDraftStatus;
  createdBy: string;
}

export interface RecommendationDraftCounts {
  draftCount: number;
  awaitingReviewCount: number;
  changesRequestedCount: number;
  approvedReadyToReleaseCount: number;
  releasedCount: number;
}

/**
 * Pure tally used by the Counsellor Studio dashboard's "Recommendation
 * Drafts" tile/panel — counts across however many drafts the caller passes
 * in (typically a counsellor's own caseload, already RLS-scoped). Never
 * fabricates a count for a status this module does not recognize.
 */
export function summarizeRecommendationDrafts(drafts: readonly RecommendationDraftSummaryInput[]): RecommendationDraftCounts {
  let draftCount = 0;
  let awaitingReviewCount = 0;
  let changesRequestedCount = 0;
  let approvedReadyToReleaseCount = 0;
  let releasedCount = 0;
  for (const d of drafts) {
    switch (d.status) {
      case "draft":
        draftCount += 1;
        break;
      case "submitted_for_review":
        awaitingReviewCount += 1;
        break;
      case "changes_requested":
        changesRequestedCount += 1;
        break;
      case "approved":
        approvedReadyToReleaseCount += 1;
        break;
      case "released_to_student":
        releasedCount += 1;
        break;
      case "archived":
        break;
    }
  }
  return { draftCount, awaitingReviewCount, changesRequestedCount, approvedReadyToReleaseCount, releasedCount };
}
