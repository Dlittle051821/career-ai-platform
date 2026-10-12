"use client";

import { Section } from "@/components/layout/Section";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ProfileProgressBar } from "../ProfileProgressBar";
import type { StudentProfileSnapshot } from "@/types/student-profile";
import { STEP_TITLES, TOTAL_STEPS, renderOnboardingStep, useProfileWizard } from "./useProfileWizard";

interface OnboardingWizardProps {
  initialSnapshot: StudentProfileSnapshot;
  /** Deep-link into a specific step (e.g. from a `/profile` "Edit" button), overriding the student's last saved onboarding position. */
  initialStep?: number;
}

/**
 * UX10-P01 — this component's step/draft/completion state and every save/
 * validation/navigation handler now live in the shared `useProfileWizard()`
 * hook (`./useProfileWizard.tsx`), extracted so the new `/profile` page's
 * entirely different 3-column presentation can drive the exact same real
 * Server Actions and validation rules without a second, drifting copy of
 * this product's business logic (brief section 12: "DO NOT create
 * business logic duplicates. Reuse existing profile/onboarding update
 * functions."). This file's own behavior is UNCHANGED by that extraction
 * — every handler, constant, and step component call below is identical
 * to what this file previously defined inline; only the JSX layout (this
 * single-column "Student Digital Profile" wizard, unique to
 * `/profile/onboarding`) still lives here, since that page's presentation
 * is explicitly out of this milestone's scope.
 */
export function OnboardingWizard({ initialSnapshot, initialStep }: OnboardingWizardProps) {
  const { draft, step, completion, stepError, isPending, updateDraft, handleContinue, handleBack, handleSaveAndExit, handleCompleteProfile, goToStep } =
    useProfileWizard({ initialSnapshot, initialStep });

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

        {renderOnboardingStep(step, draft, updateDraft, completion, goToStep)}

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
