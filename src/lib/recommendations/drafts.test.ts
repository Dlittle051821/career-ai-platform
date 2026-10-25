import { describe, it, expect } from "vitest";
import {
  isRecommendationDraftStatus,
  isRecommendationDraftType,
  getAllowedRecommendationDraftActions,
  isRecommendationDraftEditable,
  canReviewOwnDraft,
  summarizeRecommendationDrafts,
  RECOMMENDATION_DRAFT_STATUSES,
  type RecommendationDraftStatus,
} from "./drafts";

describe("isRecommendationDraftStatus", () => {
  it("accepts every canonical status", () => {
    for (const s of RECOMMENDATION_DRAFT_STATUSES) {
      expect(isRecommendationDraftStatus(s)).toBe(true);
    }
  });

  it("rejects an unrecognized value", () => {
    expect(isRecommendationDraftStatus("pending_review")).toBe(false);
    expect(isRecommendationDraftStatus("")).toBe(false);
  });
});

describe("isRecommendationDraftType", () => {
  it("accepts the four recognized types", () => {
    for (const t of ["career", "course", "college", "pathway"]) {
      expect(isRecommendationDraftType(t)).toBe(true);
    }
  });

  it("rejects an unrecognized type", () => {
    expect(isRecommendationDraftType("scholarship")).toBe(false);
  });
});

describe("getAllowedRecommendationDraftActions", () => {
  it("draft: edit or submit for review", () => {
    expect(getAllowedRecommendationDraftActions("draft")).toEqual(["edit", "submit_for_review"]);
  });

  it("submitted_for_review: review decisions or withdraw — never edit directly", () => {
    const allowed = getAllowedRecommendationDraftActions("submitted_for_review");
    expect(allowed).toContain("review_approve");
    expect(allowed).toContain("review_request_changes");
    expect(allowed).toContain("withdraw");
    expect(allowed).not.toContain("edit");
  });

  it("changes_requested: back to editable, same as draft", () => {
    expect(getAllowedRecommendationDraftActions("changes_requested")).toEqual(["edit", "submit_for_review"]);
  });

  it("approved: release or archive — never edit, never re-review", () => {
    const allowed = getAllowedRecommendationDraftActions("approved");
    expect(allowed).toEqual(["release", "archive"]);
  });

  it("released_to_student: only archive — content is frozen", () => {
    expect(getAllowedRecommendationDraftActions("released_to_student")).toEqual(["archive"]);
  });

  it("archived: terminal, no actions", () => {
    expect(getAllowedRecommendationDraftActions("archived")).toEqual([]);
  });

  it("every status has a defined (possibly empty) action list — no silent fallthrough", () => {
    for (const s of RECOMMENDATION_DRAFT_STATUSES) {
      expect(Array.isArray(getAllowedRecommendationDraftActions(s))).toBe(true);
    }
  });
});

describe("isRecommendationDraftEditable", () => {
  it("true only for draft and changes_requested", () => {
    const editable: RecommendationDraftStatus[] = ["draft", "changes_requested"];
    const notEditable: RecommendationDraftStatus[] = ["submitted_for_review", "approved", "released_to_student", "archived"];
    for (const s of editable) expect(isRecommendationDraftEditable(s)).toBe(true);
    for (const s of notEditable) expect(isRecommendationDraftEditable(s)).toBe(false);
  });
});

describe("canReviewOwnDraft (UI-convenience mirror of the DB self-approval rule)", () => {
  it("false when reviewer is the author", () => {
    expect(canReviewOwnDraft("user-1", "user-1")).toBe(false);
  });

  it("true when reviewer differs from the author", () => {
    expect(canReviewOwnDraft("user-1", "user-2")).toBe(true);
  });
});

describe("summarizeRecommendationDrafts", () => {
  it("tallies each status into its own bucket", () => {
    const counts = summarizeRecommendationDrafts([
      { id: "1", status: "draft", createdBy: "a" },
      { id: "2", status: "draft", createdBy: "a" },
      { id: "3", status: "submitted_for_review", createdBy: "a" },
      { id: "4", status: "changes_requested", createdBy: "a" },
      { id: "5", status: "approved", createdBy: "a" },
      { id: "6", status: "released_to_student", createdBy: "a" },
      { id: "7", status: "archived", createdBy: "a" },
    ]);
    expect(counts).toEqual({
      draftCount: 2,
      awaitingReviewCount: 1,
      changesRequestedCount: 1,
      approvedReadyToReleaseCount: 1,
      releasedCount: 1,
    });
  });

  it("returns all zeros for an empty list", () => {
    expect(summarizeRecommendationDrafts([])).toEqual({
      draftCount: 0,
      awaitingReviewCount: 0,
      changesRequestedCount: 0,
      approvedReadyToReleaseCount: 0,
      releasedCount: 0,
    });
  });
});
