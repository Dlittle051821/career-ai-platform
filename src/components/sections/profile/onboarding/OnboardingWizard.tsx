"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Section } from "@/components/layout/Section";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ProfileProgressBar } from "../ProfileProgressBar";
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

const TOTAL_STEPS = 12;

const STEP_TITLES: Record<number, string> = {
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

interface OnboardingWizardProps {
  initialSnapshot: StudentProfileSnapshot;
  /** Deep-link into a specific step (e.g. from a `/profile` "Edit" button), overriding the student's last saved onboarding position. */
  initialStep?: number;
}

function clampStep(step: number): number {
  return Math.min(Math.max(Number.isInteger(step) ? step : 1, 1), TOTAL_STEPS);
}

function isBlankEducation(r: EducationDraft): boolean {
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

function isBlankExperience(r: ExperienceDraft): boolean {
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
function backfillWorkPreferences(value: Record<string, number>): Record<string, number> {
  const next = { ...value };
  for (const option of WORK_PREFERENCE_OPTIONS) {
    if (!(option.key in next)) next[option.key] = 3;
  }
  return next;
}

function prepareDraftForSave(step: number, draft: OnboardingDraftState): OnboardingDraftState {
  if (step === 6) {
    return { ...draft, workPreferences: backfillWorkPreferences(draft.workPreferences) };
  }
  return draft;
}

function validateStep(step: number, draft: OnboardingDraftState): string | null {
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

async function saveStepData(step: number, draft: OnboardingDraftState): Promise<SaveResult> {
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

export function OnboardingWizard({ initialSnapshot, initialStep }: OnboardingWizardProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<OnboardingDraftState>(() => snapshotToDraft(initialSnapshot));
  const [step, setStep] = useState(() => clampStep(initialStep ?? initialSnapshot.profile.onboardingCurrentStep));
  const [completion, setCompletion] = useState<CompletionResult>(() => calculateCompletion(initialSnapshot));
  const [stepError, setStepError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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

    startTransition(async () => {
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

    startTransition(async () => {
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

    startTransition(async () => {
      const result = await saveStepData(step, preparedDraft);
      if (!result.success) {
        setStepError(result.error ?? "Something went wrong saving this step. Please try again.");
        return;
      }
      if (result.completion) setCompletion(result.completion);
      await setOnboardingStep(step);
      router.push("/dashboard");
    });
  }

  function handleCompleteProfile() {
    setStepError(null);
    startTransition(async () => {
      const result = await completeOnboarding();
      if (result.completion) setCompletion(result.completion);
      if (!result.success) {
        setStepError(result.error ?? "Please complete the required sections first.");
        return;
      }
      router.push("/profile");
    });
  }

  function goToStep(target: number) {
    setStepError(null);
    setStep(clampStep(target));
  }

  function renderStep() {
    switch (step) {
      case 1:
        return <AboutYouStep value={draft.aboutYou} onChange={(v) => updateDraft("aboutYou", v)} errors={{}} />;
      case 2:
        return <EducationStep records={draft.education} onChange={(v) => updateDraft("education", v)} />;
      case 3:
        return (
          <SubjectStrengthsStep value={draft.subjectStrengths} onChange={(v) => updateDraft("subjectStrengths", v)} />
        );
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
        return (
          <CareerPrioritiesStep value={draft.careerPriorities} onChange={(v) => updateDraft("careerPriorities", v)} />
        );
      case 8:
        return <CareerGoalsStep value={draft.careerGoals} onChange={(v) => updateDraft("careerGoals", v)} />;
      case 9:
        return <StudyLocationStep value={draft.studyPreferences} onChange={(v) => updateDraft("studyPreferences", v)} />;
      case 10:
        return (
          <BudgetFundingStep value={draft.fundingPreferences} onChange={(v) => updateDraft("fundingPreferences", v)} />
        );
      case 11:
        return <ExperienceStep records={draft.experience} onChange={(v) => updateDraft("experience", v)} />;
      case 12:
        return <ReviewStep draft={draft} completion={completion} onEditSection={goToStep} />;
      default:
        return null;
    }
  }

  return (
    <Section tone="muted" className="pt-10 sm:pt-14">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Student Digital Profile</p>
        <h1 className="mt-2 text-3xl font-semibold text-primary balance sm:text-4xl">{STEP_TITLES[step]}</h1>
        <p className="mt-2 text-sm text-muted">
          Step {step} of {TOTAL_STEPS}
        </p>
        <ProfileProgressBar percent={completion.percent} className="mt-4 max-w-md" />
      </div>

      <Card>
        {stepError ? (
          <p
            role="alert"
            className="mb-6 rounded-[var(--radius-control)] border border-error/25 bg-error-light px-4 py-3 text-sm text-error"
          >
            {stepError}
          </p>
        ) : null}

        {renderStep()}

        <div className="mt-8 flex flex-col-reverse items-stretch gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            {step > 1 ? (
              <Button type="button" variant="outline" onClick={handleBack} disabled={isPending}>
                Back
              </Button>
            ) : null}
            <Button type="button" variant="ghost" onClick={handleSaveAndExit} disabled={isPending}>
              Save & Exit
            </Button>
          </div>
          {step < TOTAL_STEPS ? (
            <Button type="button" onClick={handleContinue} disabled={isPending}>
              {isPending ? "Saving…" : "Continue"}
            </Button>
          ) : (
            <Button type="button" onClick={handleCompleteProfile} disabled={isPending}>
              {isPending ? "Saving…" : "Complete My Profile"}
            </Button>
          )}
        </div>
      </Card>
    </Section>
  );
}
