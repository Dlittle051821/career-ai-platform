"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { renderOnboardingStep, STEP_TITLES, TOTAL_STEPS, type ProfileWizardState } from "./onboarding/useProfileWizard";

const STEP_SUBTITLES: Record<number, string> = {
  1: "Let's start with the basic details about you.",
  2: "Tell us about your current or most recent education.",
  3: "Rate how strong you are in each subject.",
  4: "Pick the things that genuinely interest you.",
  5: "Tell us what you're already good at.",
  6: "Tell us how you like to work.",
  7: "What matters most to you in a career?",
  8: "Share your career goals, even if they're still forming.",
  9: "Where are you open to studying or working?",
  10: "Help us understand your study budget.",
  11: "Add any internships, projects, or other experience (optional).",
  12: "Review everything you've told us so far.",
};

/**
 * UX10-P01 — the active profile section form (center column). Renders
 * from `useProfileWizard()`'s live state via the SHARED `renderOnboardingStep`
 * switch (no reimplementation of any step's fields) and calls the SAME
 * real handlers `/profile/onboarding` uses — `handleContinue` validates
 * and saves through the real Server Actions, never a new save path.
 *
 * Autosave copy is truthful: this product has no autosave anywhere (every
 * save happens on an explicit button click — confirmed by a full read of
 * the onboarding wizard's logic during this milestone's audit), so this
 * never claims "saved automatically." It shows the brief's own suggested
 * honest alternative instead.
 */
export function ProfileFormPanel({ wizard }: { wizard: ProfileWizardState }) {
  const { draft, step, completion, stepError, isPending, updateDraft, handleContinue, handleBack, handleSaveAndExit, handleCompleteProfile, goToStep } =
    wizard;

  return (
    <Card className="flex h-full flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-sans text-xl font-semibold text-text">{STEP_TITLES[step]}</h2>
          <p className="mt-1 text-sm text-muted">{STEP_SUBTITLES[step]}</p>
        </div>
        <span className="shrink-0 rounded-full bg-surface-alt px-3 py-1 text-xs font-semibold text-text-soft">
          Step {step} of {TOTAL_STEPS}
        </span>
      </div>

      {stepError ? (
        <p
          role="alert"
          className="mt-5 flex items-start gap-2 rounded-[var(--radius-control)] border border-error/25 bg-error-light px-4 py-3 text-sm text-error"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          {stepError}
        </p>
      ) : null}

      <div className="mt-6 flex-1">{renderOnboardingStep(step, draft, updateDraft, completion, goToStep)}</div>

      <div className="mt-8 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="inline-flex items-center gap-1.5 text-xs text-muted">
          <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-muted" />
          Save your progress before continuing.
        </p>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
          {step > 1 ? (
            <Button type="button" variant="outline" onClick={handleBack} disabled={isPending}>
              Back
            </Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={handleSaveAndExit} disabled={isPending}>
            Save & Exit
          </Button>
          {/* UX10-M01 — the primary action in this row (Save & Continue /
              Complete My Profile) is the busiest page's most consequential
              button; Button shrinks to its text by default, so make it
              full-width on mobile only so it reads as clearly primary next
              to the secondary Back/Save & Exit buttons above it in the
              column-reversed mobile stack. */}
          {step < TOTAL_STEPS ? (
            <Button type="button" onClick={handleContinue} disabled={isPending} className="w-full sm:w-auto">
              {isPending ? "Saving…" : "Save & Continue"}
            </Button>
          ) : (
            <Button type="button" onClick={handleCompleteProfile} disabled={isPending} className="w-full sm:w-auto">
              {isPending ? "Saving…" : "Complete My Profile"}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
