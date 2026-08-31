import type { ImportDuplicateStrategy, ImportEntityType } from "@/types/education";

/**
 * Human-readable labels for the CSV import pipeline's entity types and
 * duplicate-handling strategies — shared by the imports list, new-import
 * form, and batch detail page so the wording is identical everywhere,
 * mirroring EDUCATION_PUBLICATION_STATUS_LABELS's role for universities/
 * courses (src/types/education.ts).
 */
export const IMPORT_ENTITY_TYPE_LABELS: Record<ImportEntityType, string> = {
  universities: "Universities",
  campuses: "Campuses",
  courses: "Courses",
  course_intakes: "Course intakes",
  course_tuition_fees: "Course tuition fees",
  course_admission_requirements: "Course admission requirements",
  scholarships: "Scholarships",
};

export const IMPORT_DUPLICATE_STRATEGY_LABELS: Record<ImportDuplicateStrategy, string> = {
  skip: "Skip duplicates",
  update: "Update duplicates",
  review: "Flag duplicates for review",
};

/** One-line explanation shown next to each duplicate-strategy option on the new-import form. */
export const IMPORT_DUPLICATE_STRATEGY_HINTS: Record<ImportDuplicateStrategy, string> = {
  skip: "A row that matches an existing record (by slug/name) is left untouched — only genuinely new rows are written.",
  update: "A row that matches an existing record overwrites that record's fields with the CSV's values.",
  review: "A row that matches an existing record is neither created nor updated — it's set aside for an admin to resolve manually.",
};
