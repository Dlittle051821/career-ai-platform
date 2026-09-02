import "server-only";
import { createClient } from "./server";
import type {
  StudentProfileSnapshot,
  StudentProfile,
  EducationRecord,
  SubjectStrength,
  Interest,
  Skill,
  WorkPreferenceAnswer,
  CareerPriorityAnswer,
  CareerGoals,
  StudyPreferences,
  FundingPreferences,
  ExperienceRecord,
  ProfileStatus,
  CurrentStatus,
  EducationLevel,
  EducationRecordStatus,
  ScoreType,
  SkillLevel,
  CareerGoalClarity,
  YesNoMaybe,
  BudgetBand,
  FundingSource,
  ExperienceType,
} from "@/types/student-profile";

/**
 * All Supabase <-> app-type mapping for the Student Digital Profile lives
 * here — nothing else in the app should read raw `student_*` rows
 * directly. Centralizing this is what lets the database stay snake_case
 * (matching Postgres convention) while the rest of the app stays
 * camelCase, with exactly one place to update if a column is renamed.
 */

const EMPTY_SNAPSHOT_PROFILE: StudentProfile = {
  userId: "",
  dateOfBirth: null,
  gender: null,
  city: null,
  state: null,
  country: "India",
  preferredLanguage: null,
  currentStatus: null,
  profileStatus: "not_started",
  profileCompletionPercent: 0,
  onboardingCurrentStep: 1,
};

/**
 * Fetches every Milestone 3 table for the logged-in student in parallel
 * and maps it into one typed snapshot. Returns `null` if the visitor is
 * logged out. The `student_profiles` row itself is created automatically
 * by a database trigger on signup (see 0002_student_profile.sql), so a
 * missing row here (e.g. a pre-Milestone-3 account before the backfill)
 * falls back to sensible "not started" defaults rather than throwing.
 */
export async function getStudentProfileSnapshot(): Promise<StudentProfileSnapshot | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return fetchStudentProfileSnapshotByUserId(supabase, user.id);
}

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Milestone 11-C1 — the same 10-table fetch + mapping getStudentProfileSnapshot()
 * always ran for "whoever is logged in", pulled out and parameterized by an
 * explicit user id so an ADMIN-scoped caller (src/lib/supabase/admin/
 * student-profile.ts's getStudentProfileSnapshotForAdmin(), which permission-
 * gates and passes an arbitrary student's id) can reuse the exact same
 * mapping instead of a second, drifting copy of it. Never exported for
 * direct use outside this module or its admin counterpart — every other
 * caller in this codebase should keep going through getStudentProfileSnapshot()
 * (self only) or getStudentProfileSnapshotForAdmin() (permission-checked).
 */
export async function fetchStudentProfileSnapshotByUserId(supabase: ServerSupabase, userId: string): Promise<StudentProfileSnapshot> {
  const user = { id: userId };
  const [
    profileRes,
    educationRes,
    subjectsRes,
    interestsRes,
    skillsRes,
    workPrefsRes,
    prioritiesRes,
    goalsRes,
    studyRes,
    fundingRes,
    experienceRes,
  ] = await Promise.all([
    supabase.from("student_profiles").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("student_education").select("*").eq("user_id", user.id).order("created_at"),
    supabase.from("student_subject_strengths").select("*").eq("user_id", user.id),
    supabase.from("student_interests").select("*").eq("user_id", user.id),
    supabase.from("student_skills").select("*").eq("user_id", user.id),
    supabase.from("student_work_preferences").select("*").eq("user_id", user.id),
    supabase.from("student_career_priorities").select("*").eq("user_id", user.id),
    supabase.from("student_career_goals").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("student_study_preferences").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("student_funding_preferences").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("student_experience").select("*").eq("user_id", user.id).order("created_at"),
  ]);

  const profileRow = profileRes.data;

  const profile: StudentProfile = profileRow
    ? {
        userId: profileRow.user_id,
        dateOfBirth: profileRow.date_of_birth,
        gender: profileRow.gender,
        city: profileRow.city,
        state: profileRow.state,
        country: profileRow.country,
        preferredLanguage: profileRow.preferred_language,
        currentStatus: profileRow.current_status as CurrentStatus | null,
        profileStatus: profileRow.profile_status as ProfileStatus,
        profileCompletionPercent: profileRow.profile_completion_percent,
        onboardingCurrentStep: profileRow.onboarding_current_step,
      }
    : { ...EMPTY_SNAPSHOT_PROFILE, userId: user.id };

  const education: EducationRecord[] = (educationRes.data ?? []).map((row) => ({
    id: row.id,
    educationLevel: row.education_level as EducationLevel,
    institutionName: row.institution_name,
    boardOrUniversity: row.board_or_university,
    fieldOfStudy: row.field_of_study,
    specialization: row.specialization,
    startYear: row.start_year,
    endYear: row.end_year,
    status: row.status as EducationRecordStatus,
    scoreType: row.score_type as ScoreType | null,
    scoreValue: row.score_value,
    backlogs: row.backlogs,
  }));

  const subjectStrengths: SubjectStrength[] = (subjectsRes.data ?? []).map((row) => ({
    subjectKey: row.subject_key,
    rating: row.rating,
  }));

  const interests: Interest[] = (interestsRes.data ?? []).map((row) => ({
    interestKey: row.interest_key,
    strength: row.strength,
    otherText: row.other_text,
  }));

  const skills: Skill[] = (skillsRes.data ?? []).map((row) => ({
    skillKey: row.skill_key,
    level: row.level as SkillLevel,
  }));

  const workPreferences: WorkPreferenceAnswer[] = (workPrefsRes.data ?? []).map((row) => ({
    preferenceKey: row.preference_key,
    rating: row.rating,
  }));

  const careerPriorities: CareerPriorityAnswer[] = (prioritiesRes.data ?? []).map((row) => ({
    priorityKey: row.priority_key,
    rating: row.rating,
  }));

  const goalsRow = goalsRes.data;
  const careerGoals: CareerGoals | null = goalsRow
    ? {
        clarity: goalsRow.clarity as CareerGoalClarity | null,
        dreamJobTitle: goalsRow.dream_job_title,
        dreamIndustry: goalsRow.dream_industry,
        dreamReason: goalsRow.dream_reason,
        careerIdeas: goalsRow.career_ideas ?? [],
        lifeGoalsText: goalsRow.life_goals_text,
      }
    : null;

  const studyRow = studyRes.data;
  const studyPreferences: StudyPreferences | null = studyRow
    ? {
        studyFurther: studyRow.study_further as YesNoMaybe | null,
        studyAbroad: studyRow.study_abroad as YesNoMaybe | null,
        preferredStudyDestinations: studyRow.preferred_study_destinations ?? [],
        preferredWorkDestinations: studyRow.preferred_work_destinations ?? [],
        relocateWithinIndia: studyRow.relocate_within_india as YesNoMaybe | null,
        relocateInternational: studyRow.relocate_international as YesNoMaybe | null,
      }
    : null;

  const fundingRow = fundingRes.data;
  const fundingPreferences: FundingPreferences | null = fundingRow
    ? {
        budgetBand: fundingRow.budget_band as BudgetBand | null,
        fundingSource: fundingRow.funding_source as FundingSource | null,
        loanOpenness: fundingRow.loan_openness as YesNoMaybe | null,
      }
    : null;

  const experience: ExperienceRecord[] = (experienceRes.data ?? []).map((row) => ({
    id: row.id,
    type: row.type as ExperienceType,
    title: row.title,
    organization: row.organization,
    description: row.description,
    year: row.year,
  }));

  return {
    profile,
    education,
    subjectStrengths,
    interests,
    skills,
    workPreferences,
    careerPriorities,
    careerGoals,
    studyPreferences,
    fundingPreferences,
    experience,
  };
}

/**
 * Milestone 11-B1 — a cheap, single-column read of the logged-in student's
 * Assisted Onboarding choice, for pages (the /welcome choice screen, the
 * dashboard) that only need this one field and shouldn't pay for
 * getStudentProfileSnapshot()'s full 10-table fetch just to check it.
 * Returns null (both fields) when logged out or when no choice has been
 * recorded yet — both are valid, non-error states this app never gates on.
 */
export async function getOnboardingPath(): Promise<{ onboardingPath: string | null; onboardingPathChosenAt: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { onboardingPath: null, onboardingPathChosenAt: null };

  const { data, error } = await supabase
    .from("student_profiles")
    .select("onboarding_path, onboarding_path_chosen_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !data) return { onboardingPath: null, onboardingPathChosenAt: null };
  return { onboardingPath: data.onboarding_path, onboardingPathChosenAt: data.onboarding_path_chosen_at };
}
