"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/forms/Input";
import { Textarea } from "@/components/forms/Textarea";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { FormError } from "@/components/admin/FormError";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/admin/form-state";

type BoundAction = (prevState: ActionState, formData: FormData) => Promise<ActionState>;

/** Moves a `requested` case to `under_review` — the first review step, no data entered. */
export function MarkUnderReviewForm({ action }: { action: BoundAction }) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  return (
    <form action={formAction} className="space-y-2">
      <FormError error={state.error} />
      <SubmitButton>Start review</SubmitButton>
    </form>
  );
}

/**
 * Approves a refund for processing — the commercial/policy decision point.
 * The amount field lets an admin adjust the amount one last time before it
 * becomes immutable (supabase/migrations/0016_refund_operations.sql PART 2)
 * — leaving it blank keeps the currently-requested amount unchanged.
 */
export function ApproveRefundForm({ action, currency, currentAmountMinorUnits }: { action: BoundAction; currency: string; currentAmountMinorUnits: number }) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  return (
    <form action={formAction} className="space-y-3">
      <FormError error={state.error} />
      <FormField id="approveAmount" label={`Amount (${currency})`} hint={`Leave blank to approve the requested ${(currentAmountMinorUnits / 100).toFixed(2)}. Cannot be changed once approved.`}>
        <Input id="approveAmount" name="amount" inputMode="decimal" placeholder={(currentAmountMinorUnits / 100).toFixed(2)} />
      </FormField>
      <ConfirmSubmitButton confirmLabel="Click to confirm approval">Approve refund</ConfirmSubmitButton>
    </form>
  );
}

/** Rejects a case — rejection_reason is required (also enforced at the database level) and is shown to the student verbatim. */
export function RejectRefundForm({ action }: { action: BoundAction }) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  return (
    <form action={formAction} className="space-y-3">
      <FormError error={state.error} />
      <FormField id="rejectionReason" label="Reason (shown to the student)" required>
        <Textarea id="rejectionReason" name="rejectionReason" required rows={3} />
      </FormField>
      <ConfirmSubmitButton confirmLabel="Click to confirm rejection">Reject refund</ConfirmSubmitButton>
    </form>
  );
}

/** Cancels a case before it has been claimed for processing. */
export function CancelRefundForm({ action }: { action: BoundAction }) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  return (
    <form action={formAction} className="space-y-2">
      <FormError error={state.error} />
      <ConfirmSubmitButton confirmLabel="Click to confirm cancellation">Cancel this case</ConfirmSubmitButton>
    </form>
  );
}

/**
 * The financial-safety-critical action — claims the case for processing
 * (a database-authoritative re-validation immediately before the gateway
 * call) and sends it to Razorpay. Two-click confirm because it is the one
 * button in this whole workspace that can actually move money.
 */
export function ProcessApprovedRefundForm({ action }: { action: BoundAction }) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  return (
    <form action={formAction} className="space-y-2">
      <FormError error={state.error} />
      <p className="text-xs text-muted">
        Re-checks the remaining refundable balance against current data immediately before contacting Razorpay, then sends the refund.
      </p>
      <ConfirmSubmitButton confirmLabel="Click to confirm — this sends the refund" savingLabel="Processing…">
        Process this refund
      </ConfirmSubmitButton>
    </form>
  );
}

/** Manual reconciliation — for a case stuck in `processing` after an uncertain gateway outcome (a network timeout/lost response), asks Razorpay directly what actually happened. Never guesses; a still-pending result leaves the case exactly as it was. */
export function ReconcileRefundForm({ action }: { action: BoundAction }) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  return (
    <form action={formAction} className="inline-flex flex-col items-start gap-1">
      <FormError error={state.error} />
      <SubmitButton savingLabel="Checking…">Check with Razorpay</SubmitButton>
    </form>
  );
}
