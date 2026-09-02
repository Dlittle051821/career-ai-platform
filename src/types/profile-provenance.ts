/**
 * Milestone 11-C1 — Profile Field Provenance. Section-level (not per-field
 * — see supabase/migrations/0013_..._and_recommendation_readiness.sql PART
 * 4's header comment for why), matching the section-weighted completion
 * model already established in src/lib/profile/completion.ts exactly.
 */

export const PROFILE_SECTION_KEYS = [
  "about_you",
  "education",
  "subject_strengths",
  "interests",
  "skills",
  "work_preferences",
  "career_priorities",
  "career_goals",
  "study_location",
  "budget_funding",
  "experience",
] as const;
export type ProfileSectionKey = (typeof PROFILE_SECTION_KEYS)[number];

export const PROFILE_SECTION_LABELS: Record<ProfileSectionKey, string> = {
  about_you: "About You",
  education: "Education",
  subject_strengths: "Subject Strengths",
  interests: "Interests",
  skills: "Skills",
  work_preferences: "Work Preferences",
  career_priorities: "Career Priorities",
  career_goals: "Career Goals",
  study_location: "Study & Location",
  budget_funding: "Budget & Funding",
  experience: "Experience",
};

export const PROVENANCE_VALUES = ["SELF_ENTERED", "COUNSELLOR_ENTERED", "COUNSELLOR_VERIFIED", "SYSTEM_DERIVED"] as const;
export type ProvenanceValue = (typeof PROVENANCE_VALUES)[number];

export const PROVENANCE_LABELS: Record<ProvenanceValue, string> = {
  SELF_ENTERED: "Self-reported",
  COUNSELLOR_ENTERED: "Entered by counsellor",
  COUNSELLOR_VERIFIED: "Verified by counsellor",
  SYSTEM_DERIVED: "System-derived",
};

/**
 * One section's provenance. `updatedAt: null` (and every counsellor/note
 * field null) means no override row exists — the section is SELF_ENTERED
 * by default, which is the true state of every section for every student
 * who has never had a counsellor touch their record. This is never an
 * error state.
 */
export interface SectionProvenance {
  sectionKey: ProfileSectionKey;
  provenance: ProvenanceValue;
  verifiedByCounsellorId: string | null;
  verifiedByCounsellorName: string | null;
  verifiedAt: string | null;
  lastUpdatedBy: string | null;
  note: string | null;
  updatedAt: string | null;
}
