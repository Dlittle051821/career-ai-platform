import type {
  AboutYouInput,
  CareerGoalsInput,
  FundingPreferencesInput,
  StudyPreferencesInput,
} from "@/lib/supabase/student-profile-actions";
import type { EducationDraft } from "./steps/EducationStep";
import type { ExperienceDraft } from "./steps/ExperienceStep";

/** The wizard's full in-memory draft — one slice per onboarding section. Shared between the wizard shell and the Review step. */
export interface OnboardingDraftState {
  aboutYou: AboutYouInput;
  education: EducationDraft[];
  subjectStrengths: Record<string, number>;
  interests: Record<string, number>;
  interestsOtherText: string;
  skills: Record<string, string>;
  workPreferences: Record<string, number>;
  careerPriorities: Record<string, number>;
  careerGoals: CareerGoalsInput;
  studyPreferences: StudyPreferencesInput;
  fundingPreferences: FundingPreferencesInput;
  experience: ExperienceDraft[];
}
