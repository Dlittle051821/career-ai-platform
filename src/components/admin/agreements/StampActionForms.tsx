"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/forms/Input";
import { Select } from "@/components/forms/Select";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { FormError } from "@/components/admin/FormError";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/admin/form-state";
import type { AgreementVersion } from "@/types/signatures";

type BoundAction = (prevState: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Milestone 11-A (F-123) — mirrors src/components/admin/agreements/
 * SignatureActionForms.tsx's structure and styling exactly. `eligibleVersions`
 * is deliberately broader than SendForSignatureForm's `draftVersions`: a
 * stamp request can target a version that is already `locked` (e.g. by an
 * earlier signature request) as well as `draft` — see
 * public.create_stamp_request() (0012 PART 3) — so this list is filtered by
 * the caller to exclude only `superseded` versions.
 */
export function RequestStampForm({
  action,
  eligibleVersions,
  agreementType,
}: {
  action: BoundAction;
  eligibleVersions: AgreementVersion[];
  agreementType: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);

  if (eligibleVersions.length === 0) {
    return <p className="text-sm text-muted">Create an agreement version above before requesting an e-stamp.</p>;
  }

  return (
    <form action={formAction} className="space-y-3">
      <FormError error={state.error} />
      <p className="rounded-[var(--radius-control)] border border-info/25 bg-info-light px-3.5 py-2.5 text-xs text-info">
        This will request electronic stamping of this agreement using the configured stamping provider. It is a
        technical capability only — it does not assert that this satisfies any particular jurisdiction&apos;s
        stamp-duty requirement.
      </p>
      <FormField id="agreementVersionId" label="Version to stamp" required>
        <Select id="agreementVersionId" name="agreementVersionId" required defaultValue={eligibleVersions[0]?.id}>
          {eligibleVersions.map((v) => (
            <option key={v.id} value={v.id}>
              Version #{v.versionNumber} ({v.status})
            </option>
          ))}
        </Select>
      </FormField>
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField id="jurisdiction" label="Jurisdiction" hint="Free text — never validated against a hardcoded list.">
          <Input id="jurisdiction" name="jurisdiction" placeholder="e.g. India" />
        </FormField>
        <FormField id="state" label="State">
          <Input id="state" name="state" placeholder="e.g. Karnataka" />
        </FormField>
        <FormField id="documentType" label="Document type">
          <Input id="documentType" name="documentType" placeholder="e.g. counselling_agreement" />
        </FormField>
      </div>
      <div className="rounded-[var(--radius-control)] border border-border-strong bg-surface-alt px-3.5 py-2.5 text-xs text-text-soft">
        <p className="font-medium text-text">
          Agreement: <span className="font-medium text-text">{agreementType}</span>
        </p>
      </div>
      <ConfirmSubmitButton confirmLabel="Click to confirm request">Request E-Stamp</ConfirmSubmitButton>
    </form>
  );
}

export function RetryStampRequestForm({ action }: { action: BoundAction }) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  return (
    <form action={formAction} className="space-y-2">
      <FormError error={state.error} />
      <SubmitButton>Retry</SubmitButton>
    </form>
  );
}

export function CancelStampRequestForm({ action }: { action: BoundAction }) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  return (
    <form action={formAction} className="space-y-2">
      <FormError error={state.error} />
      <ConfirmSubmitButton confirmLabel="Click to confirm cancel">Cancel Request</ConfirmSubmitButton>
    </form>
  );
}
