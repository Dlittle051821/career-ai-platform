"use client";

import { useActionState } from "react";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { FormError } from "@/components/admin/FormError";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/admin/form-state";
import type { PricingPlanVersionStatus } from "@/types/pricing";

type BoundWorkflowAction = (prevState: ActionState, formData: FormData) => Promise<ActionState>;

function WorkflowActionForm({ action, label, confirmLabel }: { action: BoundWorkflowAction; label: string; confirmLabel: string }) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <ConfirmSubmitButton confirmLabel={confirmLabel}>{label}</ConfirmSubmitButton>
      <FormError error={state.error} />
    </form>
  );
}

/**
 * draft -> published -> archived only (see PRICING_PLAN_VERSION_STATUS_TRANSITIONS
 * in src/lib/admin/status.ts — there is deliberately no "restore to draft"
 * for a version, since the immutability trigger in migration 0007 forbids
 * ever editing a version again once it has left draft). Every transition
 * here changes what students see as the live price, so both use
 * ConfirmSubmitButton (two-click confirm) rather than a single-click
 * SubmitButton — satisfies the spec's "confirm before publishing financial
 * changes" admin capability.
 */
export function PricingPlanVersionWorkflowCard({
  status,
  onPublish,
  onArchive,
}: {
  status: PricingPlanVersionStatus;
  onPublish: BoundWorkflowAction;
  onArchive: BoundWorkflowAction;
}) {
  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-primary">Version workflow</h2>
        <div className="mt-2">
          <StatusBadge status={status} />
        </div>
      </div>
      <div className="flex flex-wrap gap-6">
        {status === "draft" ? (
          <WorkflowActionForm action={onPublish} label="Publish this version" confirmLabel="Confirm: make this the live price" />
        ) : null}
        {status === "published" ? (
          <WorkflowActionForm action={onArchive} label="Archive this version" confirmLabel="Confirm: stop offering this price" />
        ) : null}
        {status === "archived" ? <p className="text-sm text-muted">Archived versions are permanent history and cannot be reactivated — create a new version instead.</p> : null}
      </div>
    </Card>
  );
}
