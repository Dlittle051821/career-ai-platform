import { describe, expect, it } from "vitest";
import {
  APPLICATION_DOCUMENT_ALLOWED_MIME_TYPES,
  APPLICATION_DOCUMENT_CHECKLIST_ORDER,
  APPLICATION_DOCUMENT_MAX_FILE_SIZE_BYTES,
  APPLICATION_DOCUMENT_TYPES,
  APPLICATION_DOCUMENT_TYPE_LABELS,
  RECOMMENDED_APPLICATION_DOCUMENT_TYPES,
  REQUIRED_APPLICATION_DOCUMENT_TYPES,
  getApplicationDocumentCompleteness,
  isApplicationDocumentType,
} from "./application-documents";

describe("APPLICATION_DOCUMENT_TYPES — taxonomy shape", () => {
  it("has exactly the nine controlled values", () => {
    expect(APPLICATION_DOCUMENT_TYPES).toHaveLength(9);
    expect(APPLICATION_DOCUMENT_TYPES).toEqual([
      "academic_transcript",
      "degree_certificate",
      "resume_cv",
      "identity_document",
      "english_test_score",
      "standardized_test_score",
      "financial_document",
      "portfolio",
      "other_supporting_document",
    ]);
  });

  it("every type has a label", () => {
    for (const type of APPLICATION_DOCUMENT_TYPES) {
      expect(APPLICATION_DOCUMENT_TYPE_LABELS[type]).toBeTruthy();
    }
  });

  it("isApplicationDocumentType() accepts every known value and rejects unknown ones", () => {
    for (const type of APPLICATION_DOCUMENT_TYPES) {
      expect(isApplicationDocumentType(type)).toBe(true);
    }
    expect(isApplicationDocumentType("visa_document")).toBe(false);
    expect(isApplicationDocumentType("")).toBe(false);
  });
});

describe("required/recommended partition", () => {
  it("exactly three required types", () => {
    expect(REQUIRED_APPLICATION_DOCUMENT_TYPES).toEqual(["academic_transcript", "identity_document", "resume_cv"]);
  });

  it("recommended is every other type, no overlap", () => {
    expect(RECOMMENDED_APPLICATION_DOCUMENT_TYPES).toHaveLength(6);
    for (const type of RECOMMENDED_APPLICATION_DOCUMENT_TYPES) {
      expect(REQUIRED_APPLICATION_DOCUMENT_TYPES).not.toContain(type);
    }
  });

  it("required + recommended together cover every type exactly once", () => {
    const combined = [...REQUIRED_APPLICATION_DOCUMENT_TYPES, ...RECOMMENDED_APPLICATION_DOCUMENT_TYPES];
    expect(new Set(combined).size).toBe(APPLICATION_DOCUMENT_TYPES.length);
  });
});

describe("APPLICATION_DOCUMENT_CHECKLIST_ORDER", () => {
  it("required types come first, in their own fixed order", () => {
    expect(APPLICATION_DOCUMENT_CHECKLIST_ORDER.slice(0, 3)).toEqual(REQUIRED_APPLICATION_DOCUMENT_TYPES);
  });

  it("contains every document type exactly once", () => {
    expect(new Set(APPLICATION_DOCUMENT_CHECKLIST_ORDER).size).toBe(APPLICATION_DOCUMENT_TYPES.length);
  });
});

describe("upload validation constants", () => {
  it("max file size is exactly 25MB", () => {
    expect(APPLICATION_DOCUMENT_MAX_FILE_SIZE_BYTES).toBe(26214400);
  });

  it("allowed MIME types are exactly pdf/jpeg/png/webp", () => {
    expect(APPLICATION_DOCUMENT_ALLOWED_MIME_TYPES).toEqual(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
  });
});

describe("getApplicationDocumentCompleteness()", () => {
  it("empty: nothing uploaded", () => {
    const result = getApplicationDocumentCompleteness([]);
    expect(result.requiredTotal).toBe(3);
    expect(result.requiredUploaded).toBe(0);
    expect(result.isRequiredComplete).toBe(false);
    expect(result.missingRequired).toEqual(["academic_transcript", "identity_document", "resume_cv"]);
  });

  it("fully complete: all three required uploaded", () => {
    const result = getApplicationDocumentCompleteness([
      { documentType: "academic_transcript", originalFilename: "a.pdf" },
      { documentType: "identity_document", originalFilename: "b.pdf" },
      { documentType: "resume_cv", originalFilename: "c.pdf" },
    ]);
    expect(result.isRequiredComplete).toBe(true);
    expect(result.requiredUploaded).toBe(3);
    expect(result.missingRequired).toEqual([]);
  });

  it("partially complete: one of three required", () => {
    const result = getApplicationDocumentCompleteness([{ documentType: "academic_transcript", originalFilename: "a.pdf" }]);
    expect(result.requiredUploaded).toBe(1);
    expect(result.isRequiredComplete).toBe(false);
    expect(result.missingRequired).toEqual(["identity_document", "resume_cv"]);
  });

  it("recommended-only uploads never count toward required completeness", () => {
    const result = getApplicationDocumentCompleteness([
      { documentType: "portfolio", originalFilename: "p.pdf" },
      { documentType: "degree_certificate", originalFilename: "d.pdf" },
    ]);
    expect(result.requiredUploaded).toBe(0);
    expect(result.isRequiredComplete).toBe(false);
    expect(result.recommendedUploaded).toBe(2);
    expect(result.recommendedTotal).toBe(6);
  });

  it("a duplicate document_type in the input (should never happen given the DB's own partial unique index) is only counted once", () => {
    const result = getApplicationDocumentCompleteness([
      { documentType: "academic_transcript", originalFilename: "a1.pdf" },
      { documentType: "academic_transcript", originalFilename: "a2.pdf" },
    ]);
    expect(result.requiredUploaded).toBe(1);
  });

  it("never treats document completeness as application readiness — this function returns no readiness/submittable field at all", () => {
    const result = getApplicationDocumentCompleteness([]);
    expect(result).not.toHaveProperty("readyToSubmit");
    expect(result).not.toHaveProperty("applicationReady");
  });
});
