import { describe, expect, it } from "vitest";
import { getNextOperationalAction, type NextOperationalActionInput } from "./next-operational-action";
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

function baseInput(overrides: Partial<NextOperationalActionInput> = {}): NextOperationalActionInput {
  return {
    stage: "preparing",
    currentDocuments: [],
    documentCompleteness: COMPLETE_DOCS,
    documentReviewCompleteness: REVIEW_COMPLETE,
    manualChecklistItems: ALL_CHECKLIST_COMPLETE,
    ...overrides,
  };
}

describe("getNextOperationalAction() — deterministic, rules-based (no LLM)", () => {
  it("reports 'closed' for a terminal stage regardless of any other signal", () => {
    for (const stage of ["enrolled", "rejected", "withdrawn"] as const) {
      const result = getNextOperationalAction(
        baseInput({ stage, documentCompleteness: { ...COMPLETE_DOCS, isRequiredComplete: false, missingRequired: ["resume_cv"] } })
      );
      expect(result.kind).toBe("closed");
    }
  });

  it("prioritizes reviewing pending documents above everything else", () => {
    const result = getNextOperationalAction(
      baseInput({
        currentDocuments: [
          { documentType: "academic_transcript", reviewStatus: "pending_review" },
          { documentType: "identity_document", reviewStatus: "pending_review" },
        ],
        documentCompleteness: { ...COMPLETE_DOCS, isRequiredComplete: false, missingRequired: ["resume_cv"] },
      })
    );
    expect(result.kind).toBe("review_documents");
    expect(result.label).toContain("2");
  });

  it("asks staff to request a missing required document when nothing is pending review", () => {
    const result = getNextOperationalAction(
      baseInput({ documentCompleteness: { ...COMPLETE_DOCS, isRequiredComplete: false, missingRequired: ["identity_document"] } })
    );
    expect(result.kind).toBe("request_missing_documents");
    expect(result.label.toLowerCase()).toContain("identity document");
  });

  it("reports waiting-on-student once a correction is outstanding and nothing else is blocking", () => {
    const result = getNextOperationalAction(
      baseInput({ documentReviewCompleteness: { requiredAccepted: 3, isRequiredReviewComplete: true, hasOutstandingCorrection: true } })
    );
    expect(result.kind).toBe("waiting_on_student");
  });

  it("asks staff to complete the first incomplete checklist item, in fixed order", () => {
    const result = getNextOperationalAction(baseInput({ manualChecklistItems: [] }));
    expect(result.kind).toBe("complete_checklist_item");
    expect(result.label).toContain("Review the application profile");
  });

  it("reports ready-for-submission once every signal is satisfied", () => {
    const result = getNextOperationalAction(baseInput());
    expect(result.kind).toBe("ready_for_submission");
  });

  it("reports no-immediate-action once submitted with nothing else outstanding on this milestone's own signals", () => {
    const result = getNextOperationalAction(baseInput({ stage: "under_review" }));
    expect(result.kind).toBe("no_action");
  });

  it("is a pure function — same input always yields the same output, no randomness, no external calls", () => {
    const input = baseInput();
    expect(getNextOperationalAction(input)).toEqual(getNextOperationalAction(input));
  });
});
