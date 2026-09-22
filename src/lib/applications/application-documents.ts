/**
 * Milestone 17 (v2) — Application Documents Foundation.
 *
 * Pure, framework-free document taxonomy and completeness logic — same
 * "pure logic lives in src/lib/<domain>/, I/O lives in
 * src/lib/supabase/<domain>/" convention as src/lib/applications/
 * application-lifecycle.ts (Milestone 16). Nothing here talks to Supabase.
 *
 * The controlled 9-value taxonomy below, and the required/recommended
 * split, mirror the fixed, global (not per-course) checklist this
 * milestone's spec asks for — a future milestone could promote this to a
 * real per-course requirements model without changing
 * getApplicationDocumentCompleteness()'s public shape.
 */

export const APPLICATION_DOCUMENT_TYPES = [
  "academic_transcript",
  "degree_certificate",
  "resume_cv",
  "identity_document",
  "english_test_score",
  "standardized_test_score",
  "financial_document",
  "portfolio",
  "other_supporting_document",
] as const;

export type ApplicationDocumentType = (typeof APPLICATION_DOCUMENT_TYPES)[number];

export function isApplicationDocumentType(value: string): value is ApplicationDocumentType {
  return (APPLICATION_DOCUMENT_TYPES as readonly string[]).includes(value);
}

export const APPLICATION_DOCUMENT_TYPE_LABELS: Record<ApplicationDocumentType, string> = {
  academic_transcript: "Academic transcript / marksheet",
  degree_certificate: "Degree certificate",
  resume_cv: "Resume / CV",
  identity_document: "Identity document (passport/ID)",
  english_test_score: "English test score (IELTS/TOEFL/PTE)",
  standardized_test_score: "Standardized test score (SAT/GRE/GMAT)",
  financial_document: "Financial document (proof of funds)",
  portfolio: "Portfolio",
  other_supporting_document: "Other supporting document",
};

/**
 * The three document types every application is expected to have before it
 * can realistically be considered ready — deliberately a small, fixed set,
 * not "all nine". This is ONE input to application readiness, never an
 * automatic gate: no code in this milestone mutates applications.stage
 * based on document completeness (spec's own instruction).
 */
export const REQUIRED_APPLICATION_DOCUMENT_TYPES: readonly ApplicationDocumentType[] = [
  "academic_transcript",
  "identity_document",
  "resume_cv",
];

export const RECOMMENDED_APPLICATION_DOCUMENT_TYPES: readonly ApplicationDocumentType[] = APPLICATION_DOCUMENT_TYPES.filter(
  (type) => !REQUIRED_APPLICATION_DOCUMENT_TYPES.includes(type),
);

/** Display order for the student-facing checklist — required documents first, in a stable, deliberate order; recommended ones after. */
export const APPLICATION_DOCUMENT_CHECKLIST_ORDER: readonly ApplicationDocumentType[] = [
  ...REQUIRED_APPLICATION_DOCUMENT_TYPES,
  ...RECOMMENDED_APPLICATION_DOCUMENT_TYPES,
];

/** 25MB — matches both the Storage bucket's own file_size_limit and application_documents_file_size_check (0018 migration PART 1/4), so the three layers (client, bucket, table) always agree. */
export const APPLICATION_DOCUMENT_MAX_FILE_SIZE_BYTES = 26214400;

export const APPLICATION_DOCUMENT_ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;

export type ApplicationDocumentSummary = {
  documentType: ApplicationDocumentType;
  originalFilename: string;
};

export interface ApplicationDocumentCompleteness {
  requiredTotal: number;
  requiredUploaded: number;
  recommendedTotal: number;
  recommendedUploaded: number;
  isRequiredComplete: boolean;
  missingRequired: ApplicationDocumentType[];
}

/**
 * Pure completeness calculation — takes the list of CURRENT documents
 * already uploaded (never a raw/unfiltered list; the caller — either
 * get_my_application_documents() via the RPC, or the admin listing filtered
 * to is_current — is responsible for that) and computes required/
 * recommended coverage. A document type with more than one entry (should
 * never happen given the database's own partial unique index, but this
 * function does not assume it can't) is only counted once.
 */
export function getApplicationDocumentCompleteness(uploadedDocuments: readonly ApplicationDocumentSummary[]): ApplicationDocumentCompleteness {
  const uploadedTypes = new Set(uploadedDocuments.map((d) => d.documentType));

  const missingRequired = REQUIRED_APPLICATION_DOCUMENT_TYPES.filter((type) => !uploadedTypes.has(type));
  const requiredUploaded = REQUIRED_APPLICATION_DOCUMENT_TYPES.length - missingRequired.length;
  const recommendedUploaded = RECOMMENDED_APPLICATION_DOCUMENT_TYPES.filter((type) => uploadedTypes.has(type)).length;

  return {
    requiredTotal: REQUIRED_APPLICATION_DOCUMENT_TYPES.length,
    requiredUploaded,
    recommendedTotal: RECOMMENDED_APPLICATION_DOCUMENT_TYPES.length,
    recommendedUploaded,
    isRequiredComplete: missingRequired.length === 0,
    missingRequired,
  };
}
