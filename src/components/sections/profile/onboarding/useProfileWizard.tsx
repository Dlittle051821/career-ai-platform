"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { WORK_PREFERENCE_OPTIONS } from "@/data/profile-options";
import { calculateCompletion } from "@/lib/profile/completion";
import { snapshotToDraft } from "@/lib/profile/draft";
import { isValidPastDate } from "@/lib/validation";
import {
  completeOnboarding,
  saveAboutYou,
  saveCareerGoals,
  saveCareerPriorities,
  saveEducation,
  saveExperience,
  saveFundingPreferences,
  saveInterests,
  saveSkills,
  saveStudyPreferences,
  saveSubjectStrengths,
  saveWorkPreferences,
  setOnboardingStep,
  type SaveResult,
} from "@/lib/supabase/student-profile-actions";
import type { CompletionResult, StudentProfileSnapshot } from "@/types/student-profile";
import type { OnboardingDraftState } from "./onboarding-types";
import { AboutYouStep } from "./steps/AboutYouStep";
import { EducationStep, type EducationDraft } from "./steps/EducationStep";
import { SubjectStrengthsStep } from "./steps/SubjectStrengthsStep";
import { InterestsStep } from "./steps/InterestsStep";
import { SkillsStep } from "./steps/SkillsStep";
import { WorkPreferencesStep } from "./steps/WorkPreferencesStep";
import { CareerPrioritiesStep } from "./steps/CareerPrioritiesStep";
import { CareerGoalsStep } from "./steps/CareerGoalsStep";
import { StudyLocationStep } from "./steps/StudyLocationStep";
import { BudgetFundingStep } from "./steps/BudgetFundingStep";
import { ExperienceStep, type ExperienceDraft } from "./steps/ExperienceStep";
import { ReviewStep } from "./steps/ReviewStep";

const SAVE_CONNECTION_ERROR =
  "We couldn't reach Nextwise to save this step. Your answers are still here — check your connection and try again.";

/** CC-23 — shown instead of the connection message when the save failed because the student's session ended. */
export const SESSION_ENDED_ERROR =
  "Your session has ended, so this step wasn't saved. Log in again to continue — steps you already saved are kept.";

/**
 * True only when Supabase positively reports that there is no valid session
 * (401/403 or no session at all). A network failure is NOT treated as a
 * session end, so offline students still see the connection message.
 */
async function hasSessionEnded(): Promise<boolean> {
  try {
    const { data, error } = await createBrowserSupabaseClient().auth.getUser();
    if (data.user) return false;
    if (!error) return true;
    const status = (error as { status?: number }).status;
    return error.name === "AuthSessionMissingError" || status === 401 || status === 403;
  } catch {
    return false;
  }
}

/**
 * UX10-P01 — the real step-by-step save/validation/navigation logic that
 * used to live only inside `OnboardingWizard.tsx`, pulled out into its own
 * hook so BOTH `/profile/onboarding` (via `OnboardingWizard.tsx`, unchanged
 * behavior) and the new `/profile` page (via `ProfileWorkspace.tsx`, an
 * entirely different 3-column presentation) can drive the exact same real
 * Server Actions, validation rules, and step/completion state — never two
 * drifting copies of this product's actual business logic. This is a pure
 * extraction: every function/constant below is copied verbatim from
 * `OnboardingWizard.tsx`'s own previous inline definitions, not rewritten,
 * so `/profile/onboarding`'s behavior is byte-for-byte unchanged.
 */

export const TOTAL_STEPS = 12;

export const STEP_TITLES: Record<number, string> = {
  1: "About You",
  2: "Education",
  3: "Subject Strengths",
  4: "Interests",
  5: "Skills",
  6: "Work Preferences",
  7: "Career Priorities",
  8: "Career Goals",
  9: "Study & Location",
  10: "Budget & Funding",
  11: "Experience",
  12: "Review Your Profile",
};

export function clampStep(step: number): number {
  return Math.min(Math.max(Number.isInteger(step) ? step : 1, 1), TOTAL_STEPS);
}

export function isBlankEducation(r: EducationDraft): boolean {
  return (
    !r.educationLevel &&
    !r.institutionName &&
    !r.boardOrUniversity &&
    !r.fieldOfStudy &&
    !r.specialization &&
    !r.startYear &&
    !r.endYear &&
    !r.scoreType &&
    !r.scoreValue &&
    !r.backlogs
  );
}

export function isBlankExperience(r: ExperienceDraft): boolean {
  return !r.title.trim() && !r.organization && !r.description && !r.year;
}

/**
 * Work Preferences uses a Likert list where every statement visually
 * defaults to 3 (neutral) even before the student touches it — but the
 * underlying draft only contains keys the student actually interacted
 * with. Back-filling every option here before saving/counting is what
 * makes "all statements answered" true the moment the step is left, so
 * `completeOnboarding`'s completeness check (which requires every
 * WORK_PREFERENCE_OPTIONS key to be present) matches what the UI showed.
 */
export function backfillWorkPreferences(value: Record<string, number>): Record<string, number> {
  const next = { ...value };
  for (const option of WORK_PREFERENCE_OPTIONS) {
    if (!(option.key in next)) next[option.key] = 3;
  }
  return next;
}

export function prepareDraftForSave(step: number, draft: OnboardingDraftState): OnboardingDraftState {
  if (step === 6) {
    return { ...draft, workPreferences: backfillWorkPreferences(draft.workPreferences) };
  }
  return draft;
}

export function validateStep(step: number, draft: OnboardingDraftState): string | null {
  switch (step) {
    case 1:
      if (draft.aboutYou.dateOfBirth && !isValidPastDate(draft.aboutYou.dateOfBirth)) {
        return "Please enter a valid date of birth.";
      }
      return null;
    case 2:
      if (draft.education.some((r) => !isBlankEducation(r) && !r.educationLevel)) {
        return "Please select an education level for each entry you've started, or remove the empty ones.";
      }
      return null;
    case 8:
      if (draft.careerGoals.clarity === "clear" && !draft.careerGoals.dreamJobTitle?.trim()) {
        return "Please enter your dream job title, or choose a different option above.";
      }
      return null;
    case 11:
      if (draft.experience.some((r) => !isBlankExperience(r) && !r.title.trim())) {
        return "Please add a title for each entry you've started, or remove the empty ones.";
      }
      return null;
    default:
      return null;
  }
}

export async function saveStepData(step: number, draft: OnboardingDraftState): Promise<SaveResult> {
  switch (step) {
    case 1:
      return saveAboutYou(draft.aboutYou);
    case 2:
      return saveEducation(draft.education.filter((r) => !isBlankEducation(r)));
    case 3:
      return saveSubjectStrengths(
        Object.entries(draft.subjectStrengths).map(([subjectKey, rating]) => ({ subjectKey, rating }))
      );
    case 4:
      return saveInterests(
        Object.entries(draft.interests).map(([interestKey, strength]) => ({ interestKey, strength })),
        draft.interestsOtherText || null
      );
    case 5:
      return saveSkills(Object.entries(draft.skills).map(([skillKey, level]) => ({ skillKey, level })));
    case 6:
      return saveWorkPreferences(
        Object.entries(draft.workPreferences).map(([preferenceKey, rating]) => ({ preferenceKey, rating }))
      );
    case 7:
      return saveCareerPriorities(
        Object.entries(draft.careerPriorities).map(([priorityKey, rating]) => ({ priorityKey, rating }))
      );
    case 8:
      return saveCareerGoals(draft.careerGoals);
    case 9:
      return saveStudyPreferences(draft.studyPreferences);
    case 10:
      return saveFundingPreferences(draft.fundingPreferences);
    case 11:
      return saveExperience(draft.experience.filter((r) => !isBlankExperience(r)));
    default:
      return { success: true };
  }
}

export interface UseProfileWizardArgs {
  initialSnapshot: StudentProfileSnapshot;
  /** Deep-link into a specific step, overriding the student's last saved onboarding position. */
  initialStep?: number;
  /** Where "Save & Exit" sends the student. Defaults to `/dashboard` — the same destination `OnboardingWizard.tsx` always used. */
  saveAndExitHref?: string;
  /** Where a successful "Complete My Profile" sends the student. Defaults to `/profile` — the same destination `OnboardingWizard.tsx` always used. */
  completeHref?: string;
}

/**
 * The full stateful wizard — step, in-memory draft, real completion,
 * validation error, and every navigation handler. Identical state shape
 * and identical handler behavior to what `OnboardingWizard.tsx` used to
 * own directly; only the JSX that renders around it now lives in each
 * caller instead of here.
 */
export function useProfileWizard({
  initialSnapshot,
  initialStep,
  saveAndExitHref = "/dashboard",
  completeHref = "/profile",
}: UseProfileWizardArgs) {
  const router = useRouter();
  const [draft, setDraft] = useState<OnboardingDraftState>(() => snapshotToDraft(initialSnapshot));
  const [step, setStep] = useState(() => clampStep(initialStep ?? initialSnapshot.profile.onboardingCurrentStep));
  const [completion, setCompletion] = useState<CompletionResult>(() => calculateCompletion(initialSnapshot));
  const [stepError, setStepError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // CC-22B — a failed server-action call (dropped connection, or an action
  // that changed during a deploy) used to throw inside the transition and
  // replace the page with the default error screen. Catch it, keep the
  // student's answers, and say what to do.
  // CC-23 — `isPending` disables the buttons only after React re-renders, so
  // several clicks in the same instant could each start a save (seen as a
  // duplicate delete + insert of the same step). This ref closes that gap.
  const busyRef = useRef(false);

  function runSafely(task: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    startTransition(async () => {
      try {
        await task();
      } catch (error) {
        console.error("[profile wizard] save failed:", error);
        setStepError((await hasSessionEnded()) ? SESSION_ENDED_ERROR : SAVE_CONNECTION_ERROR);
      } finally {
        busyRef.current = false;
      }
    });
  }

  // CC-22B — after moving between steps, bring the new step into view (on a
  // phone the student was otherwise left at the bottom of the next step).
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "auto" });
  }, [step]);

  function updateDraft<K extends keyof OnboardingDraftState>(key: K, value: OnboardingDraftState[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function handleContinue() {
    const preparedDraft = prepareDraftForSave(step, draft);
    if (preparedDraft !== draft) setDraft(preparedDraft);

    const validationError = validateStep(step, preparedDraft);
    if (validationError) {
      setStepError(validationError);
      return;
    }
    setStepError(null);

    runSafely(async () => {
      const result = await saveStepData(step, preparedDraft);
      if (!result.success) {
        setStepError(result.error ?? "Something went wrong saving this step. Please try again.");
        return;
      }
      if (result.completion) setCompletion(result.completion);
      const next = Math.min(step + 1, TOTAL_STEPS);
      await setOnboardingStep(next);
      setStep(next);
    });
  }

  function handleBack() {
    if (step === 1) return;
    const preparedDraft = prepareDraftForSave(step, draft);
    if (preparedDraft !== draft) setDraft(preparedDraft);
    setStepError(null);

    runSafely(async () => {
      // Persist valid data on the way back too, but never trap the student
      // here — an invalid step just skips its own save rather than
      // blocking Back navigation (their in-memory draft is unaffected
      // either way, so nothing is lost).
      if (!validateStep(step, preparedDraft)) {
        const result = await saveStepData(step, preparedDraft);
        if (result.success && result.completion) setCompletion(result.completion);
      }
      const prev = Math.max(step - 1, 1);
      await setOnboardingStep(prev);
      setStep(prev);
    });
  }

  function handleSaveAndExit() {
    const preparedDraft = prepareDraftForSave(step, draft);
    if (preparedDraft !== draft) setDraft(preparedDraft);

    const validationError = validateStep(step, preparedDraft);
    if (validationError) {
      setStepError(validationError);
      return;
    }
    setStepError(null);

    runSafely(async () => {
      const result = await saveStepData(step, preparedDraft);
      if (!result.success) {
        setStepError(result.error ?? "Something went wrong saving this step. Please try again.");
        return;
      }
      if (result.completion) setCompletion(result.completion);
      await setOnboardingStep(step);
      router.push(saveAndExitHref);
    });
  }

  function handleCompleteProfile() {
    setStepError(null);
    runSafely(async () => {
      const result = await completeOnboarding();
      if (result.completion) setCompletion(result.completion);
      if (!result.success) {
        setStepError(result.error ?? "Please complete the required sections first.");
        return;
      }
      router.push(completeHref);
    });
  }

  function goToStep(target: number) {
    setStepError(null);
    setStep(clampStep(target));
  }

  return {
    draft,
    step,
    completion,
    stepError,
    isPending,
    updateDraft,
    handleContinue,
    handleBack,
    handleSaveAndExit,
    handleCompleteProfile,
    goToStep,
  };
}

export type ProfileWizardState = ReturnType<typeof useProfileWizard>;

/**
 * The one real JSX switch mapping a step number to its real step
 * component, shared so neither `OnboardingWizard.tsx` nor the new
 * `/profile` form panel re-lists the same 12 cases independently. Copied
 * verbatim from `OnboardingWizard.tsx`'s own previous `renderStep()`.
 */
export function renderOnboardingStep(
  step: number,
  draft: OnboardingDraftState,
  updateDraft: ProfileWizardState["updateDraft"],
  completion: CompletionResult,
  goToStep: (target: number) => void
) {
  switch (step) {
    case 1:
      return <AboutYouStep value={draft.aboutYou} onChange={(v) => updateDraft("aboutYou", v)} errors={{}} />;
    case 2:
      return <EducationStep records={draft.education} onChange={(v) => updateDraft("education", v)} />;
    case 3:
      return <SubjectStrengthsStep value={draft.subjectStrengths} onChange={(v) => updateDraft("subjectStrengths", v)} />;
    case 4:
      return (
        <InterestsStep
          value={draft.interests}
          onChange={(v) => updateDraft("interests", v)}
          otherText={draft.interestsOtherText}
          onOtherTextChange={(v) => updateDraft("interestsOtherText", v)}
        />
      );
    case 5:
      return <SkillsStep value={draft.skills} onChange={(v) => updateDraft("skills", v)} />;
    case 6:
      return <WorkPreferencesStep value={draft.workPreferences} onChange={(v) => updateDraft("workPreferences", v)} />;
    case 7:
      return <CareerPrioritiesStep value={draft.careerPriorities} onChange={(v) => updateDraft("careerPriorities", v)} />;
    case 8:
      return <CareerGoalsStep value={draft.careerGoals} onChange={(v) => updateDraft("careerGoals", v)} />;
    case 9:
      return <StudyLocationStep value={draft.studyPreferences} onChange={(v) => updateDraft("studyPreferences", v)} />;
    case 10:
      return <BudgetFundingStep value={draft.fundingPreferences} onChange={(v) => updateDraft("fundingPreferences", v)} />;
    case 11:
      return <ExperienceStep records={draft.experience} onChange={(v) => updateDraft("experience", v)} />;
    case 12:
      return <ReviewStep draft={draft} completion={completion} onEditSection={goToStep} />;
    default:
      return null;
  }
}
