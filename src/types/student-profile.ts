/**
 * Domain types for the Student Digital Profile (Milestone 3). These mirror
 * the `student_*` tables in supabase/migrations/0002_student_profile.sql —
 * see that file for column-level constraints (ranges, enums).
 *
 * Naming convention: camelCase in TypeScript, snake_case in the database.
 * Mapping happens once, in src/lib/supabase/student-profile.ts — nothing
 * else should read raw Supabase rows directly.
 */

export type ProfileStatus = "not_started" | "in_progress" | "completed";

export type CurrentStatus =
  | "school_10"
  | "school_12"
  | "diploma"
  | "undergraduate"
  | "postgraduate"
  | "working"
  | "gap_year"
  | "other";

export type EducationLevel = "class_10" | "class_12" | "diploma" | "bachelors" | "masters" | "phd" | "other";
export type EducationRecordStatus = "ongoing" | "completed" | "discontinued";
export type ScoreType = "percentage" | "cgpa_10" | "cgpa_4" | "grade" | "other";
export type SkillLevel = "beginner" | "intermediate" | "advanced";
export type CareerGoalClarity = "clear" | "some_ideas" | "not_sure";
export type YesNoMaybe = "yes" | "no" | "maybe";
export type BudgetBand = "below_5l" | "5_10l" | "10_20l" | "20_30l" | "30_50l" | "50l_plus" | "not_sure";
export type FundingSource =
  | "family_self_funded"
  | "scholarship_dependent"
  | "education_loan_expected"
  | "combination"
  | "not_sure";
export type ExperienceType =
  | "internship"
  | "project"
  | "competition"
  | "certification"
  | "work_experience"
  | "extracurricular";

export interface StudentProfile {
  userId: string;
  dateOfBirth: string | null;
  gender: string | null;
  city: string | null;
  state: string | null;
  country: string;
  preferredLanguage: string | null;
  currentStatus: CurrentStatus | null;
  profileStatus: ProfileStatus;
  profileCompletionPercent: number;
  onboardingCurrentStep: number;
}

export interface EducationRecord {
  id: string;
  educationLevel: EducationLevel;
  institutionName: string | null;
  boardOrUniversity: string | null;
  fieldOfStudy: string | null;
  specialization: string | null;
  startYear: number | null;
  endYear: number | null;
  status: EducationRecordStatus;
  scoreType: ScoreType | null;
  scoreValue: number | null;
  backlogs: number | null;
}

/** A draft education record being edited in the onboarding wizard — no `id` until saved. */
export type EducationRecordDraft = Omit<EducationRecord, "id"> & { draftId: string; id?: string };

export interface SubjectStrength {
  subjectKey: string;
  rating: number;
}

export interface Interest {
  interestKey: string;
  strength: number | null;
  otherText: string | null;
}

export interface Skill {
  skillKey: string;
  level: SkillLevel;
}

export interface WorkPreferenceAnswer {
  preferenceKey: string;
  rating: number;
}

export interface CareerPriorityAnswer {
  priorityKey: string;
  rating: number;
}

export interface CareerGoals {
  clarity: CareerGoalClarity | null;
  dreamJobTitle: string | null;
  dreamIndustry: string | null;
  dreamReason: string | null;
  careerIdeas: string[];
  lifeGoalsText: string | null;
}

export interface StudyPreferences {
  studyFurther: YesNoMaybe | null;
  studyAbroad: YesNoMaybe | null;
  preferredStudyDestinations: string[];
  preferredWorkDestinations: string[];
  relocateWithinIndia: YesNoMaybe | null;
  relocateInternational: YesNoMaybe | null;
}

export interface FundingPreferences {
  budgetBand: BudgetBand | null;
  fundingSource: FundingSource | null;
  loanOpenness: YesNoMaybe | null;
}

export interface ExperienceRecord {
  id: string;
  type: ExperienceType;
  title: string;
  organization: string | null;
  description: string | null;
  year: number | null;
}

export type ExperienceRecordDraft = Omit<ExperienceRecord, "id"> & { draftId: string; id?: string };

/** Full snapshot of everything a student has entered — used to resume onboarding and render /profile. */
export interface StudentProfileSnapshot {
  profile: StudentProfile;
  education: EducationRecord[];
  subjectStrengths: SubjectStrength[];
  interests: Interest[];
  skills: Skill[];
  workPreferences: WorkPreferenceAnswer[];
  careerPriorities: CareerPriorityAnswer[];
  careerGoals: CareerGoals | null;
  studyPreferences: StudyPreferences | null;
  fundingPreferences: FundingPreferences | null;
  experience: ExperienceRecord[];
}

export interface CompletionSection {
  key: string;
  label: string;
  weight: number;
  complete: boolean;
  required: boolean;
}

export interface CompletionResult {
  percent: number;
  status: ProfileStatus;
  sections: CompletionSection[];
}
