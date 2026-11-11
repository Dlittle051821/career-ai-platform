/**
 * CC-24 — length and count limits for a student's self-reported profile.
 *
 * Every onboarding/profile save is a Server Action that can be called
 * directly. Before CC-24 those actions validated choices against the
 * allowed option lists but accepted text of any length and any number of
 * education/experience rows. The database has no length constraints on
 * these columns, so the limits live here and are applied by both the
 * server actions (authoritative) and the form inputs (`maxLength`, so a
 * student is never surprised by a server-side rejection).
 *
 * Limits are generous for real answers and only stop abuse or accidents.
 */

export const PROFILE_TEXT_LIMITS = {
  city: 100,
  state: 100,
  country: 100,
  preferredLanguage: 60,
  institutionName: 200,
  boardOrUniversity: 200,
  fieldOfStudy: 150,
  specialization: 150,
  interestsOtherText: 200,
  dreamJobTitle: 120,
  dreamIndustry: 120,
  dreamReason: 1000,
  careerIdea: 120,
  lifeGoalsText: 2000,
  experienceTitle: 150,
  experienceOrganization: 150,
  experienceDescription: 1000,
} as const;

export type ProfileTextField = keyof typeof PROFILE_TEXT_LIMITS;

/** Maximum rows a student can save in the repeatable sections. */
export const MAX_EDUCATION_RECORDS = 10;
export const MAX_EXPERIENCE_RECORDS = 15;

const FIELD_LABELS: Record<ProfileTextField, string> = {
  city: "City",
  state: "State",
  country: "Country",
  preferredLanguage: "Preferred language",
  institutionName: "Institution name",
  boardOrUniversity: "Board or university",
  fieldOfStudy: "Field of study",
  specialization: "Specialization",
  interestsOtherText: "Other interests",
  dreamJobTitle: "Dream job title",
  dreamIndustry: "Dream industry",
  dreamReason: "Why this career",
  careerIdea: "Career idea",
  lifeGoalsText: "Life goals",
  experienceTitle: "Experience title",
  experienceOrganization: "Organization",
  experienceDescription: "Description",
};

/**
 * Returns a student-safe error for the first value that is too long, or null.
 * Lengths are measured after trimming, matching what is actually stored.
 * A non-string, non-null value is treated as invalid input.
 */
export function findTextLimitError(values: ReadonlyArray<readonly [ProfileTextField, unknown]>): string | null {
  for (const [field, value] of values) {
    if (value === null || value === undefined) continue;
    if (typeof value !== "string") return `${FIELD_LABELS[field]} isn't valid. Please check it and try again.`;
    if (value.trim().length > PROFILE_TEXT_LIMITS[field]) {
      return `${FIELD_LABELS[field]} can be at most ${PROFILE_TEXT_LIMITS[field]} characters.`;
    }
  }
  return null;
}
