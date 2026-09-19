"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Compass } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { ChipToggleGroup } from "@/components/sections/profile/onboarding/ChipToggleGroup";
import { RatingButtons } from "@/components/sections/profile/onboarding/RatingButtons";
import { CURRENT_STATUS_OPTIONS } from "@/data/profile-options";
import { DECISION_FOCUS_OPTIONS, HELP_NEEDED_OPTIONS, INTEREST_AREA_OPTIONS, LOCATION_PREFERENCE_OPTIONS, CONFIDENCE_LABELS } from "@/data/guided-discovery";
import { buildOrientationSummary, EMPTY_DISCOVERY_SELECTIONS, type GuidedDiscoverySelections } from "@/lib/career-discovery/orientation";

/**
 * UX05B — the guided discovery mini-flow. Purely client-side: no Server
 * Action, no persistence, nothing sent to the network. Every answer lives
 * only in this component's own React state for the lifetime of the page
 * view, matching the spec's "orientation, not a psychometric assessment"
 * intent and the page's existing honest framing that the real, scored
 * assessment engine is still in development (see the DemoNotice above and
 * the waitlist/FAQ section below, both left unchanged).
 *
 * Every step is skippable via "Skip this question" — the flow never
 * blocks progress on an answer, per the spec's "low-pressure" requirement
 * — and a "Skip the rest" link is always available so a student can jump
 * straight to the reflection (which itself still degrades gracefully to
 * an encouraging message when nothing was answered; see
 * src/lib/career-discovery/orientation.ts's EMPTY_DISCOVERY_SELECTIONS
 * handling).
 */

type StepKey = "focus" | "stage" | "interests" | "location" | "confidence" | "help" | "reflection";
const STEP_ORDER: StepKey[] = ["focus", "stage", "interests", "location", "confidence", "help", "reflection"];

function toggleSingle(current: string | null, key: string): string | null {
  return current === key ? null : key;
}

export function GuidedDiscoveryFlow() {
  const [stepIndex, setStepIndex] = useState(0);
  const [selections, setSelections] = useState<GuidedDiscoverySelections>(EMPTY_DISCOVERY_SELECTIONS);

  const step = STEP_ORDER[stepIndex];
  const isLastQuestion = stepIndex === STEP_ORDER.length - 2;
  const summary = useMemo(() => buildOrientationSummary(selections), [selections]);

  function goNext() {
    setStepIndex((i) => Math.min(i + 1, STEP_ORDER.length - 1));
  }
  function goBack() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }
  function skipToReflection() {
    setStepIndex(STEP_ORDER.length - 1);
  }
  function startOver() {
    setSelections(EMPTY_DISCOVERY_SELECTIONS);
    setStepIndex(0);
  }

  const questionNumber = step === "reflection" ? null : stepIndex + 1;
  const totalQuestions = STEP_ORDER.length - 1;

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-intelligence-light text-intelligence-strong">
            <Compass aria-hidden="true" className="h-4.5 w-4.5" />
          </span>
          <p className="text-sm font-semibold text-primary">A few quick questions to get oriented</p>
        </div>
        {questionNumber ? (
          <Badge tone="neutral">
            {questionNumber} of {totalQuestions}
          </Badge>
        ) : null}
      </div>

      {questionNumber ? (
        <div aria-hidden="true" className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-intelligence-strong transition-[width]"
            style={{ width: `${(questionNumber / totalQuestions) * 100}%` }}
          />
        </div>
      ) : null}

      <div className="mt-6" aria-live="polite">
        {step === "focus" ? (
          <fieldset>
            <legend className="text-lg font-semibold text-primary">What are you trying to decide right now?</legend>
            <p className="mt-1 text-sm text-muted">Pick as many as apply — there&apos;s no single right answer.</p>
            <div className="mt-4">
              <ChipToggleGroup
                ariaLabel="What are you trying to decide right now?"
                options={DECISION_FOCUS_OPTIONS}
                value={selections.decisionFocus}
                onChange={(next) => setSelections((s) => ({ ...s, decisionFocus: next }))}
              />
            </div>
          </fieldset>
        ) : null}

        {step === "stage" ? (
          <fieldset>
            <legend className="text-lg font-semibold text-primary">Where are you right now?</legend>
            <p className="mt-1 text-sm text-muted">Your current stage of education or work.</p>
            <div className="mt-4">
              <ChipToggleGroup
                ariaLabel="Where are you right now?"
                options={CURRENT_STATUS_OPTIONS}
                value={selections.educationStage ? [selections.educationStage] : []}
                onChange={(next) => setSelections((s) => ({ ...s, educationStage: next.length > 0 ? next[next.length - 1] : null }))}
              />
            </div>
          </fieldset>
        ) : null}

        {step === "interests" ? (
          <fieldset>
            <legend className="text-lg font-semibold text-primary">Which broad areas interest you?</legend>
            <p className="mt-1 text-sm text-muted">Just a rough sense — you&apos;ll go into detail later if you build a full profile.</p>
            <div className="mt-4">
              <ChipToggleGroup
                ariaLabel="Which broad areas interest you?"
                options={INTEREST_AREA_OPTIONS}
                value={selections.interestAreas}
                onChange={(next) => setSelections((s) => ({ ...s, interestAreas: next }))}
              />
            </div>
          </fieldset>
        ) : null}

        {step === "location" ? (
          <fieldset>
            <legend className="text-lg font-semibold text-primary">India, abroad, or still deciding?</legend>
            <p className="mt-1 text-sm text-muted">Whatever you&apos;re leaning towards today — this isn&apos;t final.</p>
            <div className="mt-4">
              <ChipToggleGroup
                ariaLabel="India, abroad, or still deciding?"
                options={LOCATION_PREFERENCE_OPTIONS}
                value={selections.locationPreference ? [selections.locationPreference] : []}
                onChange={(next) => setSelections((s) => ({ ...s, locationPreference: next.length > 0 ? next[next.length - 1] : null }))}
              />
            </div>
          </fieldset>
        ) : null}

        {step === "confidence" ? (
          <fieldset>
            <legend className="text-lg font-semibold text-primary">How confident do you feel about your direction right now?</legend>
            <p className="mt-1 text-sm text-muted">1 is very unsure, 5 is confident — most people start somewhere in the middle.</p>
            <div className="mt-4">
              <RatingButtons
                ariaLabel="How confident do you feel about your direction right now?"
                value={selections.confidence}
                labels={CONFIDENCE_LABELS}
                onChange={(rating) => setSelections((s) => ({ ...s, confidence: rating }))}
              />
            </div>
          </fieldset>
        ) : null}

        {step === "help" ? (
          <fieldset>
            <legend className="text-lg font-semibold text-primary">What would help you most right now?</legend>
            <p className="mt-1 text-sm text-muted">Pick as many as apply.</p>
            <div className="mt-4">
              <ChipToggleGroup
                ariaLabel="What would help you most right now?"
                options={HELP_NEEDED_OPTIONS}
                value={selections.helpNeeded}
                onChange={(next) => setSelections((s) => ({ ...s, helpNeeded: next }))}
              />
            </div>
          </fieldset>
        ) : null}

        {step === "reflection" ? (
          <div>
            <h3 className="text-lg font-semibold text-primary">{summary.headline}</h3>
            <ul className="mt-3 space-y-2">
              {summary.bullets.map((bullet, i) => (
                <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-text-soft">
                  <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-intelligence-strong" />
                  {bullet}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted">
              This is a reflection of your own answers, not a scored assessment or an AI-generated recommendation —
              the full career-matching engine described above is still in development.
            </p>

            <div className="mt-6 rounded-[var(--radius-control)] border border-secondary/25 bg-secondary-light/40 p-4">
              <p className="text-sm font-semibold text-primary">You&apos;ve started building your direction.</p>
              <p className="mt-1 text-sm text-muted">Create your free NextWise profile to continue and build a more complete picture of your goals.</p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <LinkButton href="/register" size="md" trailingIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>
                  Create my free profile
                </LinkButton>
                <LinkButton href="/careers" size="md" variant="outline">
                  Continue exploring without an account
                </LinkButton>
              </div>
            </div>
            <button type="button" onClick={startOver} className="mt-4 text-sm font-medium text-secondary-dark underline underline-offset-2">
              Start over
            </button>
          </div>
        ) : null}
      </div>

      {step !== "reflection" ? (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
          <div className="flex items-center gap-2">
            {stepIndex > 0 ? (
              <Button type="button" variant="ghost" size="sm" onClick={goBack} icon={<ArrowLeft aria-hidden="true" className="h-4 w-4" />}>
                Back
              </Button>
            ) : null}
            <button type="button" onClick={goNext} className="text-sm font-medium text-muted underline underline-offset-2">
              Skip this question
            </button>
          </div>
          <div className="flex items-center gap-3">
            {!isLastQuestion ? (
              <button type="button" onClick={skipToReflection} className="text-sm font-medium text-muted underline underline-offset-2">
                Skip the rest
              </button>
            ) : null}
            <Button type="button" size="sm" onClick={goNext} trailingIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>
              {isLastQuestion ? "See my reflection" : "Next"}
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}




