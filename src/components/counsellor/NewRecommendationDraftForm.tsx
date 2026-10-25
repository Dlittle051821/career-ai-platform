"use client";

import { useActionState } from "react";
import { Input } from "@/components/forms/Input";
import { Select } from "@/components/forms/Select";
import { Textarea } from "@/components/forms/Textarea";
import { FormField } from "@/components/forms/FormField";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { FormError } from "@/components/admin/FormError";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/admin/form-state";
import { RECOMMENDATION_DRAFT_TYPES } from "@/lib/recommendations/drafts";

const RECOMMENDATION_DRAFT_TYPE_LABELS: Record<string, string> = {
  career: "Career",
  course: "Course",
  college: "College",
  pathway: "Pathway",
};

/**
 * NW07.6 — starts a new recommendation draft from the Student Case
 * Workspace's "Recommendations" panel. Submits straight to
 * createRecommendationDraftAction (already bound to this student), which
 * calls staff_create_recommendation_draft() — the draft is created in
 * "draft" status, visible only to staff, never the student, until a
 * reviewer later approves and releases it. Every content field here is the
 * counsellor's own professional synthesis, written and saved as a draft
 * first; nothing here is submitted for review or released by this form.
 */
export function NewRecommendationDraftForm({ action }: { action: (prevState: ActionState, formData: FormData) => Promise<ActionState> }) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  return (
    <form action={formAction} className="space-y-3">
      <FormError error={state.error} />
      <FormField id="title" label="Report title">
        <Input id="title" name="title" placeholder="e.g. Career & college guidance — Term 1" required />
      </FormField>
      <FormField id="recommendationType" label="Type" hint="Optional — helps categorize the report; the content below is what the student eventually sees.">
        <Select id="recommendationType" name="recommendationType" defaultValue="">
          <option value="">— Not specified —</option>
          {RECOMMENDATION_DRAFT_TYPES.map((t) => (
            <option key={t} value={t}>
              {RECOMMENDATION_DRAFT_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField id="summary" label="Summary">
        <Textarea id="summary" name="summary" rows={2} />
      </FormField>
      <FormField id="careerGuidance" label="Career guidance">
        <Textarea id="careerGuidance" name="careerGuidance" rows={3} />
      </FormField>
      <FormField id="courseGuidance" label="Course guidance">
        <Textarea id="courseGuidance" name="courseGuidance" rows={3} />
      </FormField>
      <FormField id="collegeGuidance" label="College guidance">
        <Textarea id="collegeGuidance" name="collegeGuidance" rows={3} />
      </FormField>
      <FormField id="pathwayGuidance" label="Pathway guidance">
        <Textarea id="pathwayGuidance" name="pathwayGuidance" rows={3} />
      </FormField>
      <FormField
        id="counsellorRationale"
        label="Counsellor rationale"
        hint="Your own professional reasoning — never a fabricated admissions eligibility claim or a guarantee of admission."
      >
        <Textarea id="counsellorRationale" name="counsellorRationale" rows={3} />
      </FormField>
      <SubmitButton>Save as draft</SubmitButton>
    </form>
  );
}
