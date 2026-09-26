import { describe, expect, it } from "vitest";
import { getApplicationReadiness, type ApplicationReadinessInput } from "./application-readiness";
import type { ApplicationDocumentCompleteness, ApplicationDocumentReviewCompleteness } from "./application-documents";
import { APPLICATION_CHECKLIST_ITEM_KEYS, type ManualChecklistItemState } from "./application-checklist";

const COMPLETE_DOCS: ApplicationDocumentCompleteness = {
  requiredTotal: 3,
  requiredUploaded: 3,
  recommendedTotal: 6,
  recommendedUploaded: 0,
  isRequiredComplete: true,
  missingRequired: [],
};

const REVIEW_COMPLETE: ApplicationDocumentReviewCompleteness = { requiredAccepted: 3, isRequiredReviewComplete: true, hasOutstandingCorrection: false };

const ALL_CHECKLIST_COMPLETE: ManualChecklistItemState[] = APPLICATION_CHECKLIST_ITEM_KEYS.map((key) => ({ key, completedAt: "2026-01-01T00:00:00Z" }));

function baseInput(overrides: Partial<ApplicationReadinessInput> = {}): ApplicationReadinessInput {
  return {
    stage: "preparing",
    documentCompleteness: COMPLETE_DOCS,
    documentReviewCompleteness: REVIEW_COMPLETE,
    manualChecklistItems: ALL_CHECKLIST_COMPLETE,
    ...overrides,
  };
}

describe("getApplicationReadiness()", () => {
  it("is ready when every signal is satisfied and the stage is appropriate", () => {
    const result = getApplicationReadiness(baseInput());
    expect(result.isReady).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it("is NOT ready merely because required documents are uploaded — task's own explicit rule", () => {
    const result = getApplicationReadiness(
      baseInput({ documentReviewCompleteness: { requiredAccepted: 0, isRequiredReviewComplete: false, hasOutstandingCorrection: false } })
    );
    expect(result.isReady).toBe(false);
    expect(result.blockers.map((b) => b.reason)).toContain("documents_not_accepted");
  });

  it("blocks on missing required documents", () => {
    const result = getApplicationReadiness(
      baseInput({ documentCompleteness: { ...COMPLETE_DOCS, isRequiredComplete: false, missingRequired: ["resume_cv"] } })
    );
    expect(result.isReady).toBe(false);
    expect(result.blockers.map((b) => b.reason)).toContain("documents_missing");
  });

  it("blocks on an outstanding correction request even if required documents are otherwise accepted", () => {
    const result = getApplicationReadiness(
      baseInput({ documentReviewCompleteness: { requiredAccepted: 3, isRequiredReviewComplete: true, hasOutstandingCorrection: true } })
    );
    expect(result.isReady).toBe(false);
    expect(result.blockers.map((b) => b.reason)).toContain("correction_outstanding");
  });

  it("blocks on an incomplete manual checklist item", () => {
    const result = getApplicationReadiness(baseInput({ manualChecklistItems: [] }));
    expect(result.isReady).toBe(false);
    expect(result.blockers.map((b) => b.reason)).toContain("checklist_incomplete");
  });

  it("blocks when the stage has already moved past the pre-submission window (e.g. already submitted)", () => {
    const result = getApplicationReadiness(baseInput({ stage: "submitted" }));
    expect(result.isReady).toBe(false);
    expect(result.blockers.map((b) => b.reason)).toContain("stage_not_appropriate");
  });

  it("never mutates or reads back applications.stage — this is a pure function over its own inputs only", () => {
    const input = baseInput();
    const before = JSON.stringify(input);
    getApplicationReadiness(input);
    expect(JSON.stringify(input)).toBe(before);
  });
});
