"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./server";
import { friendlyDbError } from "./db-errors";
import { getStudentProfileSnapshot } from "./student-profile";
import { calculateCompletion } from "@/lib/profile/completion";
import { trackEvent } from "./analytics/track";
import { isNonNegativeInteger, isOneOf, isRequired, isValidPastDate, isValidRating, isValidScoreForType, isValidYear } from "@/lib/validation";
import {
  BUDGET_BAND_OPTIONS,
  CAREER_GOAL_CLARITY_OPTIONS,
  CAREER_PRIORITY_OPTIONS,
  COUNTRY_OPTIONS,
  CURRENT_STATUS_OPTIONS,
  EDUCATION_LEVEL_OPTIONS,
  EDUCATION_STATUS_OPTIONS,
  EXPERIENCE_TYPE_OPTIONS,
  FUNDING_SOURCE_OPTIONS,
  GENDER_OPTIONS,
  INTEREST_OPTIONS,
  SCORE_TYPE_OPTIONS,
  SKILL_LEVEL_OPTIONS,
  SUBJECT_OPTIONS,
  TECHNICAL_SKILL_OPTIONS,
  TRANSFERABLE_SKILL_OPTIONS,
  WORK_PREFERENCE_OPTIONS,
  YES_NO_MAYBE_OPTIONS,
} from "@/data/profile-options";
import type { CompletionResult } from "@/types/student-profile";

/**
 * All Milestone 3 "save this onboarding step" Server Actions. Every
 * function here:
 *  1. Re-checks the caller is authenticated (middleware protects the
 *     *pages*, but a Server Action can in principle be invoked directly,
 *     so each one re-derives the user from the session itself — see
 *     Milestone 3 summary "Security").
 *  2. Validates input shape/ranges server-side, even though the wizard
 *     already validates client-side — never trust browser data blindly.
 *  3. Writes to Supabase, translating any failure into a friendly message.
 *  4. Recomputes and persists profile_completion_percent / profile_status
 *     so the dashboard and /profile page are always in sync with what was
 *     actually saved.
 *
 * List-type sections (subjects, interests, skills, work preferences,
 * career priorities, education, experience) use a delete-then-insert
 * "replace all rows for this user" strategy rather than diffing — the
 * wizard always submits the section's full current state, so this can
 * never leave stale/duplicate rows behind (Milestone 3 section 33).
 */

export interface SaveResult {
  success: boolean;
  error?: string;
  completion?: CompletionResult;
}

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

async function requireUserId(supabase: ServerSupabase): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  return user.id;
}

async function recomputeCompletion(supabase: ServerSupabase, userId: string): Promise<CompletionResult> {
  // Read the PREVIOUS status before overwriting it — profile_completed
  // must fire exactly once, on the transition INTO 'completed', not on
  // every subsequent section edit a since-completed student makes.
  const { data: before } = await supabase.from("student_profiles").select("profile_status").eq("user_id", userId).maybeSingle();
  const previousStatus = before?.profile_status ?? "not_started";

  const snapshot = await getStudentProfileSnapshot();
  const completion = snapshot ? calculateCompletion(snapshot) : { percent: 0, status: "not_started" as const, sections: [] };
  await supabase
    .from("student_profiles")
    .upsert(
      { user_id: userId, profile_completion_percent: completion.percent, profile_status: completion.status },
      { onConflict: "user_id" }
    );

  if (completion.status === "completed" && previousStatus !== "completed") {
    void trackEvent({
      eventName: "profile_completed",
      source: "profile_onboarding",
      feature: "profile",
      entityType: "profile",
      entityId: userId,
      properties: { completionPercent: completion.percent },
    });
  }

  return completion;
}

function revalidateProfilePages() {
  revalidatePath("/dashboard");
  revalidatePath("/profile");
  revalidatePath("/profile/onboarding");
}

function keys(options: { key: string }[]): string[] {
  return options.map((o) => o.key);
}

// ---------------------------------------------------------------------------
// 1. About You
// ---------------------------------------------------------------------------
export interface AboutYouInput {
  dateOfBirth: string | null;
  gender: string | null;
  city: string | null;
  state: string | null;
  country: string;
  preferredLanguage: string | null;
  currentStatus: string | null;
}

export async function saveAboutYou(input: AboutYouInput): Promise<SaveResult> {
  try {
    const supabase = await createClient();
    const userId = await requireUserId(supabase);

    if (input.dateOfBirth && !isValidPastDate(input.dateOfBirth)) {
      return { success: false, error: "Birth date can't be in the future." };
    }
    if (input.currentStatus && !isOneOf(input.currentStatus, keys(CURRENT_STATUS_OPTIONS))) {
      return { success: false, error: "Please select a valid current status." };
    }
    if (input.gender && !isOneOf(input.gender, keys(GENDER_OPTIONS))) {
      return { success: false, error: "Please select a valid option." };
    }

    const { error } = await supabase.from("student_profiles").upsert(
      {
        user_id: userId,
        date_of_birth: input.dateOfBirth,
        gender: input.gender,
        city: input.city?.trim() || null,
        state: input.state?.trim() || null,
        country: input.country?.trim() || "India",
        preferred_language: input.preferredLanguage,
        current_status: input.currentStatus,
      },
      { onConflict: "user_id" }
    );
    if (error) return { success: false, error: friendlyDbError(error) };

    const completion = await recomputeCompletion(supabase, userId);
    revalidateProfilePages();
    return { success: true, completion };
  } catch (err) {
    return { success: false, error: friendlyDbError(err) };
  }
}

// ---------------------------------------------------------------------------
// 2. Education
// ---------------------------------------------------------------------------
export interface EducationInput {
  educationLevel: string;
  institutionName: string | null;
  boardOrUniversity: string | null;
  fieldOfStudy: string | null;
  specialization: string | null;
  startYear: number | null;
  endYear: number | null;
  status: string;
  scoreType: string | null;
  scoreValue: number | null;
  backlogs: number | null;
}

export async function saveEducation(records: EducationInput[]): Promise<SaveResult> {
  try {
    const supabase = await createClient();
    const userId = await requireUserId(supabase);

    for (const record of records) {
      if (!isOneOf(record.educationLevel, keys(EDUCATION_LEVEL_OPTIONS))) {
        return { success: false, error: "Please select a valid education level." };
      }
      if (!isOneOf(record.status, keys(EDUCATION_STATUS_OPTIONS))) {
        return { success: false, error: "Please select a valid education status." };
      }
      if (record.scoreType && !isOneOf(record.scoreType, keys(SCORE_TYPE_OPTIONS))) {
        return { success: false, error: "Please select a valid score type." };
      }
      if (record.scoreType && record.scoreValue !== null && !isValidScoreForType(record.scoreType, record.scoreValue)) {
        return { success: false, error: "That score is outside the valid range for the score type selected." };
      }
      if (record.startYear !== null && !isValidYear(record.startYear)) {
        return { success: false, error: "Please enter a valid start year." };
      }
      if (record.endYear !== null && !isValidYear(record.endYear)) {
        return { success: false, error: "Please enter a valid end year." };
      }
      if (record.backlogs !== null && !isNonNegativeInteger(record.backlogs)) {
        return { success: false, error: "Backlogs must be zero or a positive number." };
      }
    }

    const del = await supabase.from("student_education").delete().eq("user_id", userId);
    if (del.error) return { success: false, error: friendlyDbError(del.error) };

    if (records.length > 0) {
      const rows = records.map((r) => ({
        user_id: userId,
        education_level: r.educationLevel,
        institution_name: r.institutionName?.trim() || null,
        board_or_university: r.boardOrUniversity?.trim() || null,
        field_of_study: r.fieldOfStudy?.trim() || null,
        specialization: r.specialization?.trim() || null,
        start_year: r.startYear,
        end_year: r.endYear,
        status: r.status,
        score_type: r.scoreType,
        score_value: r.scoreValue,
        backlogs: r.backlogs,
      }));
      const ins = await supabase.from("student_education").insert(rows);
      if (ins.error) return { success: false, error: friendlyDbError(ins.error) };
    }

    const completion = await recomputeCompletion(supabase, userId);
    revalidateProfilePages();
    return { success: true, completion };
  } catch (err) {
    return { success: false, error: friendlyDbError(err) };
  }
}

// ---------------------------------------------------------------------------
// 3. Subject Strengths
// ---------------------------------------------------------------------------
export interface SubjectStrengthInput {
  subjectKey: string;
  rating: number;
}

export async function saveSubjectStrengths(items: SubjectStrengthInput[]): Promise<SaveResult> {
  try {
    const supabase = await createClient();
    const userId = await requireUserId(supabase);
    const validKeys = keys(SUBJECT_OPTIONS);

    for (const item of items) {
      if (!isOneOf(item.subjectKey, validKeys)) return { success: false, error: "One of the selected subjects isn't valid." };
      if (!isValidRating(item.rating)) return { success: false, error: "Ratings must be between 1 and 5." };
    }

    const del = await supabase.from("student_subject_strengths").delete().eq("user_id", userId);
    if (del.error) return { success: false, error: friendlyDbError(del.error) };

    if (items.length > 0) {
      const rows = items.map((i) => ({ user_id: userId, subject_key: i.subjectKey, rating: i.rating }));
      const ins = await supabase.from("student_subject_strengths").insert(rows);
      if (ins.error) return { success: false, error: friendlyDbError(ins.error) };
    }

    const completion = await recomputeCompletion(supabase, userId);
    revalidateProfilePages();
    return { success: true, completion };
  } catch (err) {
    return { success: false, error: friendlyDbError(err) };
  }
}

// ---------------------------------------------------------------------------
// 4. Interests
// ---------------------------------------------------------------------------
export interface InterestInput {
  interestKey: string;
  strength: number | null;
}

export async function saveInterests(items: InterestInput[], otherText: string | null): Promise<SaveResult> {
  try {
    const supabase = await createClient();
    const userId = await requireUserId(supabase);
    const validKeys = keys(INTEREST_OPTIONS);

    for (const item of items) {
      if (!isOneOf(item.interestKey, validKeys)) return { success: false, error: "One of the selected interests isn't valid." };
      if (item.strength !== null && !isValidRating(item.strength)) {
        return { success: false, error: "Ratings must be between 1 and 5." };
      }
    }

    const del = await supabase.from("student_interests").delete().eq("user_id", userId);
    if (del.error) return { success: false, error: friendlyDbError(del.error) };

    if (items.length > 0) {
      const rows = items.map((i) => ({
        user_id: userId,
        interest_key: i.interestKey,
        strength: i.strength,
        other_text: i.interestKey === "other" ? otherText?.trim() || null : null,
      }));
      const ins = await supabase.from("student_interests").insert(rows);
      if (ins.error) return { success: false, error: friendlyDbError(ins.error) };
    }

    const completion = await recomputeCompletion(supabase, userId);
    revalidateProfilePages();
    return { success: true, completion };
  } catch (err) {
    return { success: false, error: friendlyDbError(err) };
  }
}

// ---------------------------------------------------------------------------
// 5. Skills
// ---------------------------------------------------------------------------
export interface SkillInput {
  skillKey: string;
  level: string;
}

export async function saveSkills(items: SkillInput[]): Promise<SaveResult> {
  try {
    const supabase = await createClient();
    const userId = await requireUserId(supabase);
    const validKeys = keys([...TECHNICAL_SKILL_OPTIONS, ...TRANSFERABLE_SKILL_OPTIONS]);
    const validLevels = keys(SKILL_LEVEL_OPTIONS);

    for (const item of items) {
      if (!isOneOf(item.skillKey, validKeys)) return { success: false, error: "One of the selected skills isn't valid." };
      if (!isOneOf(item.level, validLevels)) return { success: false, error: "Please select a valid skill level." };
    }

    const del = await supabase.from("student_skills").delete().eq("user_id", userId);
    if (del.error) return { success: false, error: friendlyDbError(del.error) };

    if (items.length > 0) {
      const rows = items.map((i) => ({ user_id: userId, skill_key: i.skillKey, level: i.level }));
      const ins = await supabase.from("student_skills").insert(rows);
      if (ins.error) return { success: false, error: friendlyDbError(ins.error) };
    }

    const completion = await recomputeCompletion(supabase, userId);
    revalidateProfilePages();
    return { success: true, completion };
  } catch (err) {
    return { success: false, error: friendlyDbError(err) };
  }
}

// ---------------------------------------------------------------------------
// 6. Work Preferences
// ---------------------------------------------------------------------------
export interface WorkPreferenceInput {
  preferenceKey: string;
  rating: number;
}

export async function saveWorkPreferences(items: WorkPreferenceInput[]): Promise<SaveResult> {
  try {
    const supabase = await createClient();
    const userId = await requireUserId(supabase);
    const validKeys = keys(WORK_PREFERENCE_OPTIONS);

    for (const item of items) {
      if (!isOneOf(item.preferenceKey, validKeys)) return { success: false, error: "One of the submitted answers isn't valid." };
      if (!isValidRating(item.rating)) return { success: false, error: "Ratings must be between 1 and 5." };
    }

    const del = await supabase.from("student_work_preferences").delete().eq("user_id", userId);
    if (del.error) return { success: false, error: friendlyDbError(del.error) };

    if (items.length > 0) {
      const rows = items.map((i) => ({ user_id: userId, preference_key: i.preferenceKey, rating: i.rating }));
      const ins = await supabase.from("student_work_preferences").insert(rows);
      if (ins.error) return { success: false, error: friendlyDbError(ins.error) };
    }

    const completion = await recomputeCompletion(supabase, userId);
    revalidateProfilePages();
    return { success: true, completion };
  } catch (err) {
    return { success: false, error: friendlyDbError(err) };
  }
}

// ---------------------------------------------------------------------------
// 7. Career Priorities
// ---------------------------------------------------------------------------
export interface CareerPriorityInput {
  priorityKey: string;
  rating: number;
}

export async function saveCareerPriorities(items: CareerPriorityInput[]): Promise<SaveResult> {
  try {
    const supabase = await createClient();
    const userId = await requireUserId(supabase);
    const validKeys = keys(CAREER_PRIORITY_OPTIONS);

    for (const item of items) {
      if (!isOneOf(item.priorityKey, validKeys)) return { success: false, error: "One of the selected priorities isn't valid." };
      if (!isValidRating(item.rating)) return { success: false, error: "Ratings must be between 1 and 5." };
    }

    const del = await supabase.from("student_career_priorities").delete().eq("user_id", userId);
    if (del.error) return { success: false, error: friendlyDbError(del.error) };

    if (items.length > 0) {
      const rows = items.map((i) => ({ user_id: userId, priority_key: i.priorityKey, rating: i.rating }));
      const ins = await supabase.from("student_career_priorities").insert(rows);
      if (ins.error) return { success: false, error: friendlyDbError(ins.error) };
    }

    const completion = await recomputeCompletion(supabase, userId);
    revalidateProfilePages();
    return { success: true, completion };
  } catch (err) {
    return { success: false, error: friendlyDbError(err) };
  }
}

// ---------------------------------------------------------------------------
// 8. Career Goals
// ---------------------------------------------------------------------------
export interface CareerGoalsInput {
  clarity: string | null;
  dreamJobTitle: string | null;
  dreamIndustry: string | null;
  dreamReason: string | null;
  careerIdeas: string[];
  lifeGoalsText: string | null;
}

export async function saveCareerGoals(input: CareerGoalsInput): Promise<SaveResult> {
  try {
    const supabase = await createClient();
    const userId = await requireUserId(supabase);

    if (input.clarity && !isOneOf(input.clarity, keys(CAREER_GOAL_CLARITY_OPTIONS))) {
      return { success: false, error: "Please select a valid option." };
    }
    if (input.careerIdeas.length > 3) {
      return { success: false, error: "You can list up to 3 career ideas." };
    }

    const { error } = await supabase.from("student_career_goals").upsert(
      {
        user_id: userId,
        clarity: input.clarity,
        dream_job_title: input.dreamJobTitle?.trim() || null,
        dream_industry: input.dreamIndustry?.trim() || null,
        dream_reason: input.dreamReason?.trim() || null,
        career_ideas: input.careerIdeas.map((idea) => idea.trim()).filter(isRequired).slice(0, 3),
        life_goals_text: input.lifeGoalsText?.trim() || null,
      },
      { onConflict: "user_id" }
    );
    if (error) return { success: false, error: friendlyDbError(error) };

    const completion = await recomputeCompletion(supabase, userId);
    revalidateProfilePages();
    return { success: true, completion };
  } catch (err) {
    return { success: false, error: friendlyDbError(err) };
  }
}

// ---------------------------------------------------------------------------
// 9. Study & Location Preferences
// ---------------------------------------------------------------------------
export interface StudyPreferencesInput {
  studyFurther: string | null;
  studyAbroad: string | null;
  preferredStudyDestinations: string[];
  preferredWorkDestinations: string[];
  relocateWithinIndia: string | null;
  relocateInternational: string | null;
}

export async function saveStudyPreferences(input: StudyPreferencesInput): Promise<SaveResult> {
  try {
    const supabase = await createClient();
    const userId = await requireUserId(supabase);
    const yesNoMaybeKeys = keys(YES_NO_MAYBE_OPTIONS);
    const countryKeys = keys(COUNTRY_OPTIONS);

    for (const value of [input.studyFurther, input.studyAbroad, input.relocateWithinIndia, input.relocateInternational]) {
      if (value && !isOneOf(value, yesNoMaybeKeys)) return { success: false, error: "Please select a valid option." };
    }
    for (const destination of [...input.preferredStudyDestinations, ...input.preferredWorkDestinations]) {
      if (!isOneOf(destination, countryKeys)) return { success: false, error: "One of the selected destinations isn't valid." };
    }

    const { error } = await supabase.from("student_study_preferences").upsert(
      {
        user_id: userId,
        study_further: input.studyFurther,
        study_abroad: input.studyAbroad,
        preferred_study_destinations: input.preferredStudyDestinations,
        preferred_work_destinations: input.preferredWorkDestinations,
        relocate_within_india: input.relocateWithinIndia,
        relocate_international: input.relocateInternational,
      },
      { onConflict: "user_id" }
    );
    if (error) return { success: false, error: friendlyDbError(error) };

    const completion = await recomputeCompletion(supabase, userId);
    revalidateProfilePages();
    return { success: true, completion };
  } catch (err) {
    return { success: false, error: friendlyDbError(err) };
  }
}

// ---------------------------------------------------------------------------
// 10. Budget & Funding
// ---------------------------------------------------------------------------
export interface FundingPreferencesInput {
  budgetBand: string | null;
  fundingSource: string | null;
  loanOpenness: string | null;
}

export async function saveFundingPreferences(input: FundingPreferencesInput): Promise<SaveResult> {
  try {
    const supabase = await createClient();
    const userId = await requireUserId(supabase);

    if (input.budgetBand && !isOneOf(input.budgetBand, keys(BUDGET_BAND_OPTIONS))) {
      return { success: false, error: "Please select a valid budget band." };
    }
    if (input.fundingSource && !isOneOf(input.fundingSource, keys(FUNDING_SOURCE_OPTIONS))) {
      return { success: false, error: "Please select a valid funding source." };
    }
    if (input.loanOpenness && !isOneOf(input.loanOpenness, keys(YES_NO_MAYBE_OPTIONS))) {
      return { success: false, error: "Please select a valid option." };
    }

    const { error } = await supabase.from("student_funding_preferences").upsert(
      {
        user_id: userId,
        budget_band: input.budgetBand,
        funding_source: input.fundingSource,
        loan_openness: input.loanOpenness,
      },
      { onConflict: "user_id" }
    );
    if (error) return { success: false, error: friendlyDbError(error) };

    const completion = await recomputeCompletion(supabase, userId);
    revalidateProfilePages();
    return { success: true, completion };
  } catch (err) {
    return { success: false, error: friendlyDbError(err) };
  }
}

// ---------------------------------------------------------------------------
// 11. Experience (optional)
// ---------------------------------------------------------------------------
export interface ExperienceInput {
  type: string;
  title: string;
  organization: string | null;
  description: string | null;
  year: number | null;
}

export async function saveExperience(records: ExperienceInput[]): Promise<SaveResult> {
  try {
    const supabase = await createClient();
    const userId = await requireUserId(supabase);
    const validTypes = keys(EXPERIENCE_TYPE_OPTIONS);

    for (const record of records) {
      if (!isOneOf(record.type, validTypes)) return { success: false, error: "Please select a valid experience type." };
      if (!isRequired(record.title)) return { success: false, error: "Each experience entry needs a title." };
      if (record.year !== null && !isValidYear(record.year)) return { success: false, error: "Please enter a valid year." };
    }

    const del = await supabase.from("student_experience").delete().eq("user_id", userId);
    if (del.error) return { success: false, error: friendlyDbError(del.error) };

    if (records.length > 0) {
      const rows = records.map((r) => ({
        user_id: userId,
        type: r.type,
        title: r.title.trim(),
        organization: r.organization?.trim() || null,
        description: r.description?.trim() || null,
        year: r.year,
      }));
      const ins = await supabase.from("student_experience").insert(rows);
      if (ins.error) return { success: false, error: friendlyDbError(ins.error) };
    }

    const completion = await recomputeCompletion(supabase, userId);
    revalidateProfilePages();
    return { success: true, completion };
  } catch (err) {
    return { success: false, error: friendlyDbError(err) };
  }
}

// ---------------------------------------------------------------------------
// 12. Onboarding navigation / completion
// ---------------------------------------------------------------------------
export async function setOnboardingStep(step: number): Promise<{ success: boolean; error?: string }> {
  try {
    if (!Number.isInteger(step) || step < 1 || step > 12) {
      return { success: false, error: "Invalid step." };
    }
    const supabase = await createClient();
    const userId = await requireUserId(supabase);
    const { error } = await supabase
      .from("student_profiles")
      .upsert({ user_id: userId, onboarding_current_step: step }, { onConflict: "user_id" });
    if (error) return { success: false, error: friendlyDbError(error) };
    return { success: true };
  } catch (err) {
    return { success: false, error: friendlyDbError(err) };
  }
}

/**
 * Called from the Review step's "Complete My Profile" button. Does NOT
 * generate any career matches (out of scope for Milestone 3) — it only
 * validates that every required section has real data, then finalizes
 * profile_status via the same weighted calculation used everywhere else.
 */
export async function completeOnboarding(): Promise<SaveResult & { missingSections?: string[] }> {
  try {
    const supabase = await createClient();
    const userId = await requireUserId(supabase);
    const completion = await recomputeCompletion(supabase, userId);
    revalidateProfilePages();

    const missing = completion.sections.filter((s) => s.required && !s.complete).map((s) => s.label);
    if (missing.length > 0) {
      return {
        success: false,
        error: `Please complete these sections first: ${missing.join(", ")}.`,
        completion,
        missingSections: missing,
      };
    }

    return { success: true, completion };
  } catch (err) {
    return { success: false, error: friendlyDbError(err) };
  }
}
