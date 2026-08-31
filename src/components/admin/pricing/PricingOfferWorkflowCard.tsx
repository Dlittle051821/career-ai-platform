"use client";

import { useActionState } from "react";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Badge } from "@/components/ui/Badge";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { FormError } from "@/components/admin/FormError";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/admin/form-state";
import type { PricingOfferStatus } from "@/types/pricing";

type BoundWorkflowAction = (prevState: ActionState, formData: FormData) => Promise<ActionState>;

function WorkflowActionForm({ action, label, confirm, confirmLabel }: { action: BoundWorkflowAction; label: string; confirm?: boolean; confirmLabel?: string }) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      {confirm ? <ConfirmSubmitButton confirmLabel={confirmLabel}>{label}</ConfirmSubmitButton> : <SubmitButton>{label}</SubmitButton>}
      <FormError error={state.error} />
    </form>
  );
}

/**
 * Two independent axes for an offer: publication status
 * (draft/published/archived, matching PRICING_OFFER_STATUS_TRANSITIONS —
 * archived can return to draft, unlike a plan version) and is_active
 * (whether a published offer is actually live right now). An offer can only
 * ever be activated while published — setPricingOfferActive() enforces this
 * server-side too. Publishing/activating both use ConfirmSubmitButton since
 * either one can start applying a real discount to student checkouts;
 * archiving/deactivating/restoring-to-draft use the plain single-click
 * SubmitButton since they only ever remove a live discount, never add one.
 */
export function PricingOfferWorkflowCard({
  status,
  isActive,
  onPublish,
  onArchive,
  onRestore,
  onActivate,
  onDeactivate,
}: {
  status: PricingOfferStatus;
  isActive: boolean;
  onPublish: BoundWorkflowAction;
  onArchive: BoundWorkflowAction;
  onRestore: BoundWorkflowAction;
  onActivate: BoundWorkflowAction;
  onDeactivate: BoundWorkflowAction;
}) {
  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-primary">Offer workflow</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={status} />
          <Badge tone={isActive ? "success" : "neutral"}>{isActive ? "Active — live now" : "Inactive"}</Badge>
        </div>
      </div>
      <div className="flex flex-wrap gap-6">
        {status === "draft" ? <WorkflowActionForm action={onPublish} label="Publish offer" confirm confirmLabel="Confirm: publish this offer" /> : null}
        {status === "published" ? <WorkflowActionForm action={onArchive} label="Archive offer" /> : null}
        {status === "archived" ? <WorkflowActionForm action={onRestore} label="Restore to draft" /> : null}
        {status === "published" && !isActive ? (
          <WorkflowActionForm action={onActivate} label="Activate — start applying this discount" confirm confirmLabel="Confirm: make this discount live" />
        ) : null}
        {status === "published" && isActive ? <WorkflowActionForm action={onDeactivate} label="Deactivate" /> : null}
      </div>
    </Card>
  );
}
