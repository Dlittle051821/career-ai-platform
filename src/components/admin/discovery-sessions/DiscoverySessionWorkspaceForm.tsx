"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/forms/Input";
import { Select } from "@/components/forms/Select";
import { Textarea } from "@/components/forms/Textarea";
import { Checkbox } from "@/components/forms/Checkbox";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { FormError } from "@/components/admin/FormError";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/admin/form-state";
import type { DiscoverySessionWorkspace, RecommendationTypeForReadiness } from "@/types/discovery-session";

const RECOMMENDATION_TYPES: { key: RecommendationTypeForReadiness; label: string }[] = [
  { key: "career", label: "Career" },
  { key: "course", label: "Course" },
  { key: "college", label: "College" },
  { key: "pathway", label: "Pathway" },
];

function SectionCard({ letter, title, hint, children }: { letter: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Section {letter}</p>
        <h2 className="mt-0.5 text-base font-semibold text-primary">{title}</h2>
        {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

export function DiscoverySessionWorkspaceForm({
  action,
  workspace,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  workspace: DiscoverySessionWorkspace | null;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-6">
      <FormError error={state.error} />

      <SectionCard letter="A" title="Student Basics">
        <FormField id="sb-preferredName" label="Preferred name">
          <Input id="sb-preferredName" name="studentBasics.preferredName" defaultValue={workspace?.studentBasics.preferredName ?? ""} />
        </FormField>
        <FormField id="sb-currentCity" label="Current city">
          <Input id="sb-currentCity" name="studentBasics.currentCity" defaultValue={workspace?.studentBasics.currentCity ?? ""} />
        </FormField>
        <FormField id="sb-currentEducationStage" label="Current education stage">
          <Input id="sb-currentEducationStage" name="studentBasics.currentEducationStage" defaultValue={workspace?.studentBasics.currentEducationStage ?? ""} placeholder="e.g. Class 12, 2nd year B.Tech" />
        </FormField>
        <FormField id="sb-languageSpokenAtHome" label="Language spoken at home">
          <Input id="sb-languageSpokenAtHome" name="studentBasics.languageSpokenAtHome" defaultValue={workspace?.studentBasics.languageSpokenAtHome ?? ""} />
        </FormField>
        <FormField id="sb-howTheyHeardAboutUs" label="How they heard about NextWise">
          <Input id="sb-howTheyHeardAboutUs" name="studentBasics.howTheyHeardAboutUs" defaultValue={workspace?.studentBasics.howTheyHeardAboutUs ?? ""} />
        </FormField>
      </SectionCard>

      <SectionCard letter="B" title="Academics">
        <FormField id="ac-currentInstitution" label="Current institution">
          <Input id="ac-currentInstitution" name="academics.currentInstitution" defaultValue={workspace?.academics.currentInstitution ?? ""} />
        </FormField>
        <FormField id="ac-board" label="Board / university">
          <Input id="ac-board" name="academics.board" defaultValue={workspace?.academics.board ?? ""} />
        </FormField>
        <FormField id="ac-recentScoreSummary" label="Recent score summary">
          <Input id="ac-recentScoreSummary" name="academics.recentScoreSummary" defaultValue={workspace?.academics.recentScoreSummary ?? ""} placeholder="e.g. 88% in Class 12 boards" />
        </FormField>
        <FormField id="ac-backlogsOrGaps" label="Backlogs or gaps">
          <Input id="ac-backlogsOrGaps" name="academics.backlogsOrGaps" defaultValue={workspace?.academics.backlogsOrGaps ?? ""} />
        </FormField>
        <div className="sm:col-span-2">
          <FormField id="ac-strongSubjects" label="Strong subjects" hint="Comma-separated">
            <Input id="ac-strongSubjects" name="academics.strongSubjects" defaultValue={(workspace?.academics.strongSubjects ?? []).join(", ")} />
          </FormField>
        </div>
        <div className="sm:col-span-2">
          <FormField id="ac-weakSubjects" label="Weak subjects" hint="Comma-separated">
            <Input id="ac-weakSubjects" name="academics.weakSubjects" defaultValue={(workspace?.academics.weakSubjects ?? []).join(", ")} />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard letter="C" title="Interests">
        <FormField id="in-statedInterests" label="Stated interests" hint="Comma-separated — what the student says">
          <Input id="in-statedInterests" name="interests.statedInterests" defaultValue={(workspace?.interests.statedInterests ?? []).join(", ")} />
        </FormField>
        <FormField id="in-observedInterests" label="Observed interests" hint="Comma-separated — what the counsellor picked up on">
          <Input id="in-observedInterests" name="interests.observedInterests" defaultValue={(workspace?.interests.observedInterests ?? []).join(", ")} />
        </FormField>
        <div className="sm:col-span-2">
          <FormField id="in-extracurriculars" label="Extracurriculars">
            <Textarea id="in-extracurriculars" name="interests.extracurriculars" rows={2} defaultValue={workspace?.interests.extracurriculars ?? ""} />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard letter="D" title="Goals">
        <div className="sm:col-span-2">
          <FormField id="go-statedGoal" label="Stated goal">
            <Input id="go-statedGoal" name="goals.statedGoal" defaultValue={workspace?.goals.statedGoal ?? ""} />
          </FormField>
        </div>
        <FormField id="go-clarityLevel" label="Clarity level">
          <Select id="go-clarityLevel" name="goals.clarityLevel" defaultValue={workspace?.goals.clarityLevel ?? ""}>
            <option value="">Not assessed</option>
            <option value="clear">Clear</option>
            <option value="some_ideas">Some ideas</option>
            <option value="not_sure">Not sure</option>
          </Select>
        </FormField>
        <FormField id="go-shortTermGoal" label="Short-term goal">
          <Input id="go-shortTermGoal" name="goals.shortTermGoal" defaultValue={workspace?.goals.shortTermGoal ?? ""} />
        </FormField>
        <FormField id="go-longTermGoal" label="Long-term goal">
          <Input id="go-longTermGoal" name="goals.longTermGoal" defaultValue={workspace?.goals.longTermGoal ?? ""} />
        </FormField>
      </SectionCard>

      <SectionCard letter="E" title="Budget & Financial">
        <FormField id="bf-statedBudgetBand" label="Stated budget band">
          <Input id="bf-statedBudgetBand" name="budgetFinancial.statedBudgetBand" defaultValue={workspace?.budgetFinancial.statedBudgetBand ?? ""} />
        </FormField>
        <FormField id="bf-fundingSource" label="Funding source">
          <Input id="bf-fundingSource" name="budgetFinancial.fundingSource" defaultValue={workspace?.budgetFinancial.fundingSource ?? ""} />
        </FormField>
        <FormField id="bf-loanOpenness" label="Loan openness">
          <Input id="bf-loanOpenness" name="budgetFinancial.loanOpenness" defaultValue={workspace?.budgetFinancial.loanOpenness ?? ""} />
        </FormField>
        <FormField id="bf-notes" label="Notes">
          <Input id="bf-notes" name="budgetFinancial.notes" defaultValue={workspace?.budgetFinancial.notes ?? ""} />
        </FormField>
      </SectionCard>

      <SectionCard letter="F" title="Parent / Sponsor Input">
        <div className="sm:col-span-2">
          <Checkbox
            id="ps-parentPresent"
            name="parentSponsorInput.parentPresent"
            defaultChecked={workspace?.parentSponsorInput.parentPresent ?? false}
            label="A parent or sponsor was present for this conversation"
          />
        </div>
        <FormField id="ps-sponsorName" label="Sponsor name">
          <Input id="ps-sponsorName" name="parentSponsorInput.sponsorName" defaultValue={workspace?.parentSponsorInput.sponsorName ?? ""} />
        </FormField>
        <FormField id="ps-parentExpectations" label="Parent expectations">
          <Textarea id="ps-parentExpectations" name="parentSponsorInput.parentExpectations" rows={2} defaultValue={workspace?.parentSponsorInput.parentExpectations ?? ""} />
        </FormField>
        <FormField id="ps-parentConcerns" label="Parent concerns">
          <Textarea id="ps-parentConcerns" name="parentSponsorInput.parentConcerns" rows={2} defaultValue={workspace?.parentSponsorInput.parentConcerns ?? ""} />
        </FormField>
      </SectionCard>

      <SectionCard letter="G" title="Student Uncertainty">
        <div className="sm:col-span-2">
          <FormField id="su-primaryUncertainty" label="Primary uncertainty">
            <Input id="su-primaryUncertainty" name="studentUncertainty.primaryUncertainty" defaultValue={workspace?.studentUncertainty.primaryUncertainty ?? ""} />
          </FormField>
        </div>
        <FormField id="su-optionsBeingConsidered" label="Options being considered" hint="Comma-separated">
          <Input id="su-optionsBeingConsidered" name="studentUncertainty.optionsBeingConsidered" defaultValue={(workspace?.studentUncertainty.optionsBeingConsidered ?? []).join(", ")} />
        </FormField>
        <FormField id="su-emotionalReadiness" label="Emotional readiness">
          <Select id="su-emotionalReadiness" name="studentUncertainty.emotionalReadiness" defaultValue={workspace?.studentUncertainty.emotionalReadiness ?? ""}>
            <option value="">Not assessed</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </Select>
        </FormField>
      </SectionCard>

      <Card className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Section H</p>
          <h2 className="mt-0.5 text-base font-semibold text-primary">Counsellor Notes</h2>
          <p className="mt-1 text-xs text-muted">Free-form. Never shown to the student.</p>
        </div>
        <FormField id="counsellorNotes" label="Notes">
          <Textarea id="counsellorNotes" name="counsellorNotes" rows={4} defaultValue={workspace?.counsellorNotes ?? ""} />
        </FormField>
      </Card>

      <Card className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Section I</p>
          <h2 className="mt-0.5 text-base font-semibold text-primary">Recommendation Readiness Notes</h2>
          <p className="mt-1 text-xs text-muted">
            What you observed for each recommendation type — separate from the computed readiness level shown on the
            student&apos;s profile.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {RECOMMENDATION_TYPES.map((t) => (
            <FormField key={t.key} id={`rr-${t.key}`} label={t.label}>
              <Textarea
                id={`rr-${t.key}`}
                name={`recommendationReadinessNotes.${t.key}`}
                rows={2}
                defaultValue={workspace?.recommendationReadinessNotes.counsellorAssessment?.[t.key] ?? ""}
              />
            </FormField>
          ))}
        </div>
      </Card>

      <Card className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Section J</p>
          <h2 className="mt-0.5 text-base font-semibold text-primary">Missing Information</h2>
          <p className="mt-1 text-xs text-muted">One item per line — what still needs to be gathered before recommendations are reliable.</p>
        </div>
        <FormField id="missingInformation" label="Missing information">
          <Textarea id="missingInformation" name="missingInformation" rows={3} defaultValue={(workspace?.missingInformation ?? []).join("\n")} />
        </FormField>
      </Card>

      <SubmitButton>{workspace ? "Save workspace" : "Start workspace"}</SubmitButton>
    </form>
  );
}
