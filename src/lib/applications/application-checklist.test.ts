import { describe, expect, it } from "vitest";
import { getApplicationChecklistView, type ApplicationChecklistViewInput } from "./application-checklist";
import type { ApplicationDocumentCompleteness, ApplicationDocumentReviewCompleteness } from "./application-documents";

const COMPLETE_DOCS: ApplicationDocumentCompleteness = {
  requiredTotal: 3,
  requiredUploaded: 3,
  recommendedTotal: 6,
  recommendedUploaded: 0,
  isRequiredComplete: true,
  missingRequired: [],
};

const INCOMPLETE_DOCS: ApplicationDocumentCompleteness = {
  ...COMPLETE_DOCS,
  requiredUploaded: 1,
  isRequiredComplete: false,
  missingRequired: ["identity_document", "resume_cv"],
};

const REVIEW_COMPLETE: ApplicationDocumentReviewCompleteness = { requiredAccepted: 3, isRequiredReviewComplete: true, hasOutstandingCorrection: false };
const REVIEW_INCOMPLETE: ApplicationDocumentReviewCompleteness = { requiredAccepted: 0, isRequiredReviewComplete: false, hasOutstandingCorrection: false };
const REVIEW_WITH_CORRECTION: ApplicationDocumentReviewCompleteness = { requiredAccepted: 2, isRequiredReviewComplete: false, hasOutstandingCorrection: true };

function baseInput(overrides: Partial<ApplicationChecklistViewInput> = {}): ApplicationChecklistViewInput {
  return {
    manualItems: [],
    documentCompleteness: COMPLETE_DOCS,
    documentReviewCompleteness: REVIEW_COMPLETE,
    isReady: false,
    ...overrides,
  };
}

describe("getApplicationChecklistView()", () => {
  it("returns exactly eight items: four manual, four derived, in a fixed order", () => {
    const items = getApplicationChecklistView(baseInput());
    expect(items).toHaveLength(8);
    expect(items.slice(0, 4).map((i) => i.kind)).toEqual(["manual", "manual", "manual", "manual"]);
    expect(items.slice(4).map((i) => i.kind)).toEqual(["derived", "derived", "derived", "derived"]);
  });

  it("a manual item with no stored row reads pending", () => {
    const items = getApplicationChecklistView(baseInput());
    const item = items.find((i) => i.key === "eligibility_checked");
    expect(item?.status).toBe("pending");
    expect(item?.completedAt).toBeNull();
  });

  it("a manual item with completedAt reads complete", () => {
    const items = getApplicationChecklistView(baseInput({ manualItems: [{ key: "eligibility_checked", completedAt: "2026-01-01T00:00:00Z" }] }));
    const item = items.find((i) => i.key === "eligibility_checked");
    expect(item?.status).toBe("complete");
    expect(item?.completedAt).toBe("2026-01-01T00:00:00Z");
  });

  it("'documents_uploaded' reflects required-document completeness only", () => {
    expect(getApplicationChecklistView(baseInput({ documentCompleteness: INCOMPLETE_DOCS })).find((i) => i.key === "documents_uploaded")?.status).toBe(
      "action_required"
    );
    expect(getApplicationChecklistView(baseInput({ documentCompleteness: COMPLETE_DOCS })).find((i) => i.key === "documents_uploaded")?.status).toBe(
      "complete"
    );
  });

  it("'documents_reviewed' is 'pending' (not action_required) when documents aren't even uploaded yet", () => {
    const items = getApplicationChecklistView(baseInput({ documentCompleteness: INCOMPLETE_DOCS, documentReviewCompleteness: REVIEW_INCOMPLETE }));
    expect(items.find((i) => i.key === "documents_reviewed")?.status).toBe("pending");
  });

  it("'documents_reviewed' is action_required once uploaded but not yet accepted", () => {
    const items = getApplicationChecklistView(baseInput({ documentCompleteness: COMPLETE_DOCS, documentReviewCompleteness: REVIEW_INCOMPLETE }));
    expect(items.find((i) => i.key === "documents_reviewed")?.status).toBe("action_required");
  });

  it("'documents_reviewed' is complete once every required document is accepted", () => {
    const items = getApplicationChecklistView(baseInput({ documentReviewCompleteness: REVIEW_COMPLETE }));
    expect(items.find((i) => i.key === "documents_reviewed")?.status).toBe("complete");
  });

  it("'student_clarification_required' reads complete when nothing is outstanding, action_required when something is", () => {
    expect(getApplicationChecklistView(baseInput({ documentReviewCompleteness: REVIEW_COMPLETE })).find((i) => i.key === "student_clarification_required")?.status).toBe(
      "complete"
    );
    expect(
      getApplicationChecklistView(baseInput({ documentReviewCompleteness: REVIEW_WITH_CORRECTION })).find((i) => i.key === "student_clarification_required")?.status
    ).toBe("action_required");
  });

  it("'ready_for_submission' mirrors the isReady flag passed in — never recomputed independently", () => {
    expect(getApplicationChecklistView(baseInput({ isReady: true })).find((i) => i.key === "ready_for_submission")?.status).toBe("complete");
    expect(getApplicationChecklistView(baseInput({ isReady: false })).find((i) => i.key === "ready_for_submission")?.status).toBe("pending");
  });
});
