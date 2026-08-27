"use client";

import { useActionState } from "react";
import { Link as LinkIcon, Copy } from "lucide-react";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/forms/Input";
import { Textarea } from "@/components/forms/Textarea";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { FormError } from "@/components/admin/FormError";
import { Button } from "@/components/ui/Button";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/admin/form-state";
import { INITIAL_PAYMENT_LINK_STATE, type PaymentLinkActionState } from "@/lib/admin/payment-link-state";

type BoundAction = (prevState: ActionState, formData: FormData) => Promise<ActionState>;

/** A confirm-then-issue button — irreversible in the sense that line items lock afterward, so it gets the two-click confirm pattern. */
export function IssueInvoiceForm({ action }: { action: BoundAction }) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  return (
    <form action={formAction} className="space-y-2">
      <FormError error={state.error} />
      <p className="text-xs text-muted">Assigns an invoice number, freezes billing details, and locks line items from further editing.</p>
      <ConfirmSubmitButton confirmLabel="Click to confirm issue">Issue invoice</ConfirmSubmitButton>
    </form>
  );
}

export function VoidInvoiceForm({ action }: { action: BoundAction }) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  return (
    <form action={formAction} className="space-y-3">
      <FormError error={state.error} />
      <FormField id="voidReason" label="Reason" required hint="Recorded permanently — the invoice stays visible with status Void, never deleted.">
        <Textarea id="voidReason" name="voidReason" required rows={2} />
      </FormField>
      <ConfirmSubmitButton confirmLabel="Click to confirm void">Void invoice</ConfirmSubmitButton>
    </form>
  );
}

export function RecordOfflinePaymentForm({ action, currency, dueMinorUnits }: { action: BoundAction; currency: string; dueMinorUnits: number }) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  return (
    <form action={formAction} className="space-y-3">
      <FormError error={state.error} />
      <p className="rounded-[var(--radius-control)] border border-warning/30 bg-warning-light px-3.5 py-2.5 text-xs text-warning">
        Only use this for a payment genuinely received outside the payment gateway (e.g. bank transfer) that you have
        personally verified. It is recorded as an offline payment and always shown as such — never mixed up with a
        gateway-verified one.
      </p>
      <FormField id="amount" label={`Amount (${currency})`} required hint={`Amount still due: ${(dueMinorUnits / 100).toFixed(2)}`}>
        <Input id="amount" name="amount" inputMode="decimal" required placeholder="0.00" />
      </FormField>
      <FormField id="note" label="Note" hint="e.g. bank reference number">
        <Input id="note" name="note" />
      </FormField>
      <SubmitButton>Record offline payment</SubmitButton>
    </form>
  );
}

export function CreatePaymentLinkForm({ action }: { action: (prevState: PaymentLinkActionState, formData: FormData) => Promise<PaymentLinkActionState> }) {
  const [state, formAction] = useActionState(action, INITIAL_PAYMENT_LINK_STATE);
  return (
    <form action={formAction} className="space-y-3">
      {state.error ? (
        <p role="alert" className="text-sm text-error">
          {state.error}
        </p>
      ) : null}
      {state.url ? (
        <div className="space-y-2 rounded-[var(--radius-control)] border border-border-strong bg-surface-alt p-3">
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate text-xs text-text">{state.url}</code>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(state.url ?? "")}
              className="inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-control)] border border-border-strong px-2.5 py-1.5 text-xs font-medium text-text-soft hover:bg-surface"
            >
              <Copy aria-hidden="true" className="h-3.5 w-3.5" />
              Copy
            </button>
          </div>
          <p className="text-xs text-muted">Expires {state.expiresAt ? new Date(state.expiresAt).toLocaleString("en-IN") : "—"}. Share this with the student directly.</p>
        </div>
      ) : null}
      <Button type="submit" variant="outline" size="sm" icon={<LinkIcon aria-hidden="true" className="h-4 w-4" />}>
        Generate payment link
      </Button>
    </form>
  );
}

export function ReconcileAttemptForm({ action }: { action: BoundAction }) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  return (
    <form action={formAction} className="inline-flex flex-col items-start gap-1">
      {state.error ? (
        <p role="alert" className="text-xs text-error">
          {state.error}
        </p>
      ) : null}
      <SubmitButton savingLabel="Checking…">Refresh from gateway</SubmitButton>
    </form>
  );
}

export function InitiateRefundForm({ action, transactionId, remainingMinorUnits, currency }: { action: BoundAction; transactionId: string; remainingMinorUnits: number; currency: string }) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  return (
    <form action={formAction} className="space-y-2 rounded-[var(--radius-control)] border border-border-strong p-3">
      <FormError error={state.error} />
      <input type="hidden" name="paymentTransactionId" value={transactionId} />
      <FormField id={`refundAmount-${transactionId}`} label={`Amount (${currency})`} hint={`Leave blank for a full refund of the remaining ${(remainingMinorUnits / 100).toFixed(2)}.`}>
        <Input id={`refundAmount-${transactionId}`} name="amount" inputMode="decimal" placeholder={(remainingMinorUnits / 100).toFixed(2)} />
      </FormField>
      <FormField id={`refundReason-${transactionId}`} label="Reason">
        <Input id={`refundReason-${transactionId}`} name="reason" />
      </FormField>
      <ConfirmSubmitButton confirmLabel="Click to confirm refund" className="text-sm">
        Initiate refund
      </ConfirmSubmitButton>
    </form>
  );
}
