import { describe, expect, it } from "vitest";
import { getApplicationDocumentReviewCompleteness, isApplicationDocumentReviewStatus } from "./application-documents";

describe("isApplicationDocumentReviewStatus()", () => {
  it("accepts exactly the three recognized states", () => {
    expect(isApplicationDocumentReviewStatus("pending_review")).toBe(true);
    expect(isApplicationDocumentReviewStatus("accepted")).toBe(true);
    expect(isApplicationDocumentReviewStatus("needs_correction")).toBe(true);
  });

  it("rejects a dropped/unrecognized state (e.g. 'rejected', considered and deliberately not implemented)", () => {
    expect(isApplicationDocumentReviewStatus("rejected")).toBe(false);
    expect(isApplicationDocumentReviewStatus("")).toBe(false);
  });
});

describe("getApplicationDocumentReviewCompleteness()", () => {
  it("reports zero required-accepted and no outstanding correction for an empty document list", () => {
    const result = getApplicationDocumentReviewCompleteness([]);
    expect(result.requiredAccepted).toBe(0);
    expect(result.isRequiredReviewComplete).toBe(false);
    expect(result.hasOutstandingCorrection).toBe(false);
  });

  it("does NOT report review-complete merely because required documents are uploaded — they must also be accepted", () => {
    const result = getApplicationDocumentReviewCompleteness([
      { documentType: "academic_transcript", reviewStatus: "pending_review" },
      { documentType: "identity_document", reviewStatus: "pending_review" },
      { documentType: "resume_cv", reviewStatus: "pending_review" },
    ]);
    expect(result.isRequiredReviewComplete).toBe(false);
    expect(result.requiredAccepted).toBe(0);
  });

  it("reports review-complete once every required document is accepted", () => {
    const result = getApplicationDocumentReviewCompleteness([
      { documentType: "academic_transcript", reviewStatus: "accepted" },
      { documentType: "identity_document", reviewStatus: "accepted" },
      { documentType: "resume_cv", reviewStatus: "accepted" },
    ]);
    expect(result.isRequiredReviewComplete).toBe(true);
    expect(result.requiredAccepted).toBe(3);
  });

  it("flags an outstanding correction even on a non-required document type", () => {
    const result = getApplicationDocumentReviewCompleteness([{ documentType: "portfolio", reviewStatus: "needs_correction" }]);
    expect(result.hasOutstandingCorrection).toBe(true);
  });

  it("counts a document type only once even if somehow duplicated", () => {
    const result = getApplicationDocumentReviewCompleteness([
      { documentType: "academic_transcript", reviewStatus: "accepted" },
      { documentType: "academic_transcript", reviewStatus: "accepted" },
    ]);
    expect(result.requiredAccepted).toBe(1);
  });
});
