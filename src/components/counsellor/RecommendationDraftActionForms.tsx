"use client";

import { useActionState } from "react";
import { Textarea } from "@/components/forms/Textarea";
import { FormField } from "@/components/forms/FormField";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { FormError } from "@/components/admin/FormError";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/admin/form-state";
import type { RecommendationDraftContent } from "@/lib/recommendations/drafts";

type BoundAction = (prevState: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * NW07.6 — the Recommendation Review page's action forms. Every button
 * here is a thin trigger for a staff_* RPC (src/lib/supabase/admin/
 * recommendation-drafts.ts) — none of these re-implement the state machine
 * or the self-approval-prevention check client-side; the page itself only
 * renders the forms whose action is currently allowed
 * (getAllowedRecommendationDraftActions()/canReviewOwnDraft()), and the
 * database is the real, final authority either way.
 */

export function EditRecommendationDraftContentForm({ action, content }: { action: BoundAction; content: RecommendationDraftContent }) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  return (
    <form action={formAction} className="space-y-3">
      <FormError error={state.error} />
      <FormField id="summary" label="Summary">
        <Textarea id="summary" name="summary" rows={2} defaultValue={content.summary ?? ""} />
      </FormField>
      <FormField id="careerGuidance" label="Career guidance">
        <Textarea id="careerGuidance" name="careerGuidance" rows={3} defaultValue={content.careerGuidance ?? ""} />
      </FormField>
      <FormField id="courseGuidance" label="Course guidance">
        <Textarea id="courseGuidance" name="courseGuidance" rows={3} defaultValue={content.courseGuidance ?? ""} />
      </FormField>
      <FormField id="collegeGuidance" label="College guidance">
        <Textarea id="collegeGuidance" name="collegeGuidance" rows={3} defaultValue={content.collegeGuidance ?? ""} />
      </FormField>
      <FormField id="pathwayGuidance" label="Pathway guidance">
        <Textarea id="pathwayGuidance" name="pathwayGuidance" rows={3} defaultValue={content.pathwayGuidance ?? ""} />
      </FormField>
      <FormField
        id="counsellorRationale"
        label="Counsellor rationale"
        hint="Your own professional reasoning — never a fabricated admissions eligibility claim or a guarantee of admission."
      >
        <Textarea id="counsellorRationale" name="counsellorRationale" rows={3} defaultValue={content.counsellorRationale ?? ""} />
      </FormField>
      <SubmitButton>Save changes</SubmitButton>
    </form>
  );
}

export function SubmitForReviewForm({ action }: { action: BoundAction }) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  return (
    <form action={formAction} className="space-y-2">
      <FormError error={state.error} />
      <p className="text-xs text-muted">Sends this report to an independent reviewer. You won&apos;t be able to edit it until they approve or request changes.</p>
      <SubmitButton>Submit for review</SubmitButton>
    </form>
  );
}

export function ApproveDraftForm({ action }: { action: BoundAction }) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  return (
    <form action={formAction} className="space-y-2">
      <FormError error={state.error} />
      <ConfirmSubmitButton confirmLabel="Click to confirm approval">Approve</ConfirmSubmitButton>
    </form>
  );
}

export function RequestChangesForm({ action }: { action: BoundAction }) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  return (
    <form action={formAction} className="space-y-3">
      <FormError error={state.error} />
      <FormField id="reviewNotes" label="What needs to change?" required>
        <Textarea id="reviewNotes" name="reviewNotes" rows={3} required />
      </FormField>
      <SubmitButton>Request changes</SubmitButton>
    </form>
  );
}

export function ReleaseDraftForm({ action }: { action: BoundAction }) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  return (
    <form action={formAction} className="space-y-2">
      <FormError error={state.error} />
      <p className="text-xs text-muted">The student will be able to read this report immediately — this cannot be undone.</p>
      <ConfirmSubmitButton confirmLabel="Click to confirm release">Release to student</ConfirmSubmitButton>
    </form>
  );
}

export function WithdrawDraftForm({ action }: { action: BoundAction }) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  return (
    <form action={formAction} className="space-y-2">
      <FormError error={state.error} />
      <ConfirmSubmitButton confirmLabel="Click to confirm withdrawal">Withdraw from review</ConfirmSubmitButton>
    </form>
  );
}

export function ArchiveDraftForm({ action }: { action: BoundAction }) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  return (
    <form action={formAction} className="space-y-2">
      <FormError error={state.error} />
      <ConfirmSubmitButton confirmLabel="Click to confirm archiving">Archive</ConfirmSubmitButton>
    </form>
  );
}
