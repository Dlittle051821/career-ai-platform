import {
  BUDGET_BAND_OPTIONS,
  CAREER_GOAL_CLARITY_OPTIONS,
  CAREER_PRIORITY_OPTIONS,
  COUNTRY_OPTIONS,
  CURRENT_STATUS_OPTIONS,
  EDUCATION_LEVEL_OPTIONS,
  EXPERIENCE_TYPE_OPTIONS,
  FUNDING_SOURCE_OPTIONS,
  INTEREST_OPTIONS,
  INTEREST_STRENGTH_LABELS,
  RATING_SCALE_LABELS,
  SKILL_LEVEL_OPTIONS,
  SUBJECT_OPTIONS,
  SUBJECT_RATING_LABELS,
  TECHNICAL_SKILL_OPTIONS,
  TRANSFERABLE_SKILL_OPTIONS,
  WORK_PREFERENCE_OPTIONS,
  YES_NO_MAYBE_OPTIONS,
  type OptionDef,
} from "@/data/profile-options";
import { FIELD_OF_STUDY_OPTIONS } from "@/data/careers/taxonomy";

/** Label lookups — the model sees the same human wording the student chose, never internal keys alone. Unknown keys are dropped, not guessed. */
function table(options: readonly OptionDef[]): ReadonlyMap<string, string> {
  return new Map(options.map((o) => [o.key, o.label]));
}

export const LABELS = {
  status: table(CURRENT_STATUS_OPTIONS),
  educationLevel: table(EDUCATION_LEVEL_OPTIONS),
  field: table(FIELD_OF_STUDY_OPTIONS),
  subject: table(SUBJECT_OPTIONS),
  interest: table(INTEREST_OPTIONS),
  skill: table([...TECHNICAL_SKILL_OPTIONS, ...TRANSFERABLE_SKILL_OPTIONS]),
  skillLevel: table(SKILL_LEVEL_OPTIONS),
  workPreference: table(WORK_PREFERENCE_OPTIONS),
  priority: table(CAREER_PRIORITY_OPTIONS),
  clarity: table(CAREER_GOAL_CLARITY_OPTIONS),
  yesNo: table(YES_NO_MAYBE_OPTIONS),
  country: table(COUNTRY_OPTIONS),
  budget: table(BUDGET_BAND_OPTIONS),
  funding: table(FUNDING_SOURCE_OPTIONS),
  experienceType: table(EXPERIENCE_TYPE_OPTIONS),
} as const;

export const RATING = { subject: SUBJECT_RATING_LABELS, interest: INTEREST_STRENGTH_LABELS, agreement: RATING_SCALE_LABELS } as const;

export function label(map: ReadonlyMap<string, string>, key: string | null | undefined): string | null {
  return key ? (map.get(key) ?? null) : null;
}
