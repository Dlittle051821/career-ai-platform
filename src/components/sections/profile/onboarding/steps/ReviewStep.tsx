"use client";

import type { ReactNode } from "react";
import { CheckCircle2, Circle, Pencil } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { DemoNotice } from "@/components/ui/DemoNotice";
import {
  BUDGET_BAND_OPTIONS,
  CAREER_GOAL_CLARITY_OPTIONS,
  CAREER_PRIORITY_OPTIONS,
  CURRENT_STATUS_OPTIONS,
  COUNTRY_OPTIONS,
  EDUCATION_LEVEL_OPTIONS,
  FUNDING_SOURCE_OPTIONS,
  GENDER_OPTIONS,
  INTEREST_OPTIONS,
  SUBJECT_OPTIONS,
  TECHNICAL_SKILL_OPTIONS,
  TRANSFERABLE_SKILL_OPTIONS,
  WORK_PREFERENCE_OPTIONS,
  YES_NO_MAYBE_OPTIONS,
  labelFor,
} from "@/data/profile-options";
import type { CompletionResult } from "@/types/student-profile";
import type { OnboardingDraftState } from "../onboarding-types";

interface ReviewStepProps {
  draft: OnboardingDraftState;
  completion: CompletionResult;
  onEditSection: (step: number) => void;
}

const SECTION_STEP: Record<string, number> = {
  about_you: 1,
  education: 2,
  subject_strengths: 3,
  interests: 4,
  skills: 5,
  work_preferences: 6,
  career_priorities: 7,
  career_goals: 8,
  study_location: 9,
  budget_funding: 10,
  experience: 11,
};

function ReviewSection({
  title,
  step,
  complete,
  required,
  onEdit,
  children,
}: {
  title: string;
  step: number;
  complete: boolean;
  required: boolean;
  onEdit: (step: number) => void;
  children: ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {complete ? (
            <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-success" />
          ) : (
            <Circle aria-hidden="true" className="h-4 w-4 shrink-0 text-muted" />
          )}
          <h3 className="text-sm font-semibold text-primary">
            {title}
            {!required ? <span className="ml-1.5 font-normal text-muted">(optional)</span> : null}
          </h3>
        </div>
        <button
          type="button"
          onClick={() => onEdit(step)}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-secondary-dark hover:bg-secondary-light"
        >
          <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
          Edit
        </button>
      </div>
      <div className="mt-3 text-sm text-text-soft">{children}</div>
    </Card>
  );
}

function Empty() {
  return <p className="text-muted italic">Not filled in yet</p>;
}

export function ReviewStep({ draft, completion, onEditSection }: ReviewStepProps) {
  const isComplete = (key: string) => completion.sections.find((s) => s.key === key)?.complete ?? false;
  const isRequired = (key: string) => completion.sections.find((s) => s.key === key)?.required ?? true;

  return (
    <div className="space-y-4">
      <DemoNotice>
        Your information is used to personalize your career guidance and is not visible to other students.
      </DemoNotice>

      <ReviewSection title="About You" step={SECTION_STEP.about_you} complete={isComplete("about_you")} required onEdit={onEditSection}>
        {draft.aboutYou.currentStatus ? (
          <ul className="space-y-1">
            <li>{labelFor(CURRENT_STATUS_OPTIONS, draft.aboutYou.currentStatus)}</li>
            {draft.aboutYou.dateOfBirth ? <li>Born {draft.aboutYou.dateOfBirth}</li> : null}
            {draft.aboutYou.gender ? <li>{labelFor(GENDER_OPTIONS, draft.aboutYou.gender)}</li> : null}
            {draft.aboutYou.city || draft.aboutYou.state ? (
              <li>
                {[draft.aboutYou.city, draft.aboutYou.state, draft.aboutYou.country].filter(Boolean).join(", ")}
              </li>
            ) : null}
          </ul>
        ) : (
          <Empty />
        )}
      </ReviewSection>

      <ReviewSection title="Education" step={SECTION_STEP.education} complete={isComplete("education")} required onEdit={onEditSection}>
        {draft.education.length > 0 ? (
          <ul className="space-y-1">
            {draft.education.map((r) => (
              <li key={r.draftId}>
                {labelFor(EDUCATION_LEVEL_OPTIONS, r.educationLevel || "other")}
                {r.institutionName ? ` — ${r.institutionName}` : ""}
                {r.startYear || r.endYear ? ` (${r.startYear ?? "?"}–${r.endYear ?? "?"})` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <Empty />
        )}
      </ReviewSection>

      <ReviewSection
        title="Subject Strengths"
        step={SECTION_STEP.subject_strengths}
        complete={isComplete("subject_strengths")}
        required
        onEdit={onEditSection}
      >
        {Object.keys(draft.subjectStrengths).length > 0 ? (
          <p>
            {Object.entries(draft.subjectStrengths)
              .map(([key, rating]) => `${labelFor(SUBJECT_OPTIONS, key)} (${rating}/5)`)
              .join(", ")}
          </p>
        ) : (
          <Empty />
        )}
      </ReviewSection>

      <ReviewSection title="Interests" step={SECTION_STEP.interests} complete={isComplete("interests")} required onEdit={onEditSection}>
        {Object.keys(draft.interests).length > 0 ? (
          <p>
            {Object.entries(draft.interests)
              .map(([key, strength]) => `${labelFor(INTEREST_OPTIONS, key)} (${strength}/5)`)
              .join(", ")}
          </p>
        ) : (
          <Empty />
        )}
      </ReviewSection>

      <ReviewSection title="Skills" step={SECTION_STEP.skills} complete={isComplete("skills")} required onEdit={onEditSection}>
        {Object.keys(draft.skills).length > 0 ? (
          <p>
            {Object.entries(draft.skills)
              .map(([key, level]) => `${labelFor([...TECHNICAL_SKILL_OPTIONS, ...TRANSFERABLE_SKILL_OPTIONS], key)} (${level})`)
              .join(", ")}
          </p>
        ) : (
          <Empty />
        )}
      </ReviewSection>

      <ReviewSection
        title="Work Preferences"
        step={SECTION_STEP.work_preferences}
        complete={isComplete("work_preferences")}
        required
        onEdit={onEditSection}
      >
        <p>
          {Object.keys(draft.workPreferences).length} of {WORK_PREFERENCE_OPTIONS.length} statements answered.
        </p>
      </ReviewSection>

      <ReviewSection
        title="Career Priorities"
        step={SECTION_STEP.career_priorities}
        complete={isComplete("career_priorities")}
        required
        onEdit={onEditSection}
      >
        {Object.keys(draft.careerPriorities).length > 0 ? (
          <p>
            {Object.entries(draft.careerPriorities)
              .map(([key, rating]) => `${labelFor(CAREER_PRIORITY_OPTIONS, key)} (${rating}/5)`)
              .join(", ")}
          </p>
        ) : (
          <Empty />
        )}
      </ReviewSection>

      <ReviewSection title="Career Goals" step={SECTION_STEP.career_goals} complete={isComplete("career_goals")} required onEdit={onEditSection}>
        {draft.careerGoals.clarity ? (
          <ul className="space-y-1">
            <li>{labelFor(CAREER_GOAL_CLARITY_OPTIONS, draft.careerGoals.clarity)}</li>
            {draft.careerGoals.dreamJobTitle ? <li>Dream role: {draft.careerGoals.dreamJobTitle}</li> : null}
            {draft.careerGoals.careerIdeas.filter(Boolean).length > 0 ? (
              <li>Ideas: {draft.careerGoals.careerIdeas.filter(Boolean).join(", ")}</li>
            ) : null}
          </ul>
        ) : (
          <Empty />
        )}
      </ReviewSection>

      <ReviewSection
        title="Study & Location"
        step={SECTION_STEP.study_location}
        complete={isComplete("study_location")}
        required
        onEdit={onEditSection}
      >
        {draft.studyPreferences.studyFurther ? (
          <ul className="space-y-1">
            <li>Study further: {labelFor(YES_NO_MAYBE_OPTIONS, draft.studyPreferences.studyFurther)}</li>
            {draft.studyPreferences.studyAbroad ? (
              <li>Study abroad: {labelFor(YES_NO_MAYBE_OPTIONS, draft.studyPreferences.studyAbroad)}</li>
            ) : null}
            {draft.studyPreferences.preferredStudyDestinations.length > 0 ? (
              <li>
                Study destinations:{" "}
                {draft.studyPreferences.preferredStudyDestinations.map((d) => labelFor(COUNTRY_OPTIONS, d)).join(", ")}
              </li>
            ) : null}
          </ul>
        ) : (
          <Empty />
        )}
      </ReviewSection>

      <ReviewSection
        title="Budget & Funding"
        step={SECTION_STEP.budget_funding}
        complete={isComplete("budget_funding")}
        required
        onEdit={onEditSection}
      >
        {draft.fundingPreferences.budgetBand ? (
          <ul className="space-y-1">
            <li>{labelFor(BUDGET_BAND_OPTIONS, draft.fundingPreferences.budgetBand)}</li>
            {draft.fundingPreferences.fundingSource ? (
              <li>{labelFor(FUNDING_SOURCE_OPTIONS, draft.fundingPreferences.fundingSource)}</li>
            ) : null}
          </ul>
        ) : (
          <Empty />
        )}
      </ReviewSection>

      <ReviewSection
        title="Experience"
        step={SECTION_STEP.experience}
        complete={isComplete("experience")}
        required={isRequired("experience")}
        onEdit={onEditSection}
      >
        {draft.experience.length > 0 ? (
          <ul className="space-y-1">
            {draft.experience.map((r) => (
              <li key={r.draftId}>
                {r.title || "Untitled"}
                {r.organization ? ` — ${r.organization}` : ""}
                {r.year ? ` (${r.year})` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">No entries added — that&apos;s okay, this section is optional.</p>
        )}
      </ReviewSection>
    </div>
  );
}
