"use client";

import { useActionState } from "react";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { FormError } from "@/components/admin/FormError";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/admin/form-state";
import { EDUCATION_PUBLICATION_STATUS_LABELS, type EducationPublicationStatus } from "@/types/education";

type BoundWorkflowAction = (prevState: ActionState, formData: FormData) => Promise<ActionState>;

function WorkflowActionForm({ action, label }: { action: BoundWorkflowAction; label: string }) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <SubmitButton>{label}</SubmitButton>
      <FormError error={state.error} />
    </form>
  );
}

/**
 * draft -> in_review -> published -> archived (or archived -> draft). Only
 * the transition(s) valid for the CURRENT status render — matches
 * isContentEditorWritableStatus's narrow, per-transition design in
 * src/lib/supabase/admin/universities.ts. A permission denial (e.g. a
 * content_editor trying to publish) surfaces inline via FormError rather
 * than crashing the page, since the RLS policy — not this UI — is the real
 * enforcement boundary.
 */
export function PublicationWorkflowCard({
  status,
  onSubmitForReview,
  onPublish,
  onArchive,
  onRestore,
}: {
  status: EducationPublicationStatus;
  onSubmitForReview: BoundWorkflowAction;
  onPublish: BoundWorkflowAction;
  onArchive: BoundWorkflowAction;
  onRestore: BoundWorkflowAction;
}) {
  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-primary">Publication workflow</h2>
        <div className="mt-2">
          <StatusBadge status={status} labelOverride={EDUCATION_PUBLICATION_STATUS_LABELS[status]} />
        </div>
      </div>
      <div className="flex flex-wrap gap-6">
        {status === "draft" ? <WorkflowActionForm action={onSubmitForReview} label="Submit for review" /> : null}
        {status === "in_review" ? <WorkflowActionForm action={onPublish} label="Publish" /> : null}
        {status === "published" ? <WorkflowActionForm action={onArchive} label="Archive" /> : null}
        {status === "archived" ? <WorkflowActionForm action={onRestore} label="Restore to draft" /> : null}
      </div>
    </Card>
  );
}
