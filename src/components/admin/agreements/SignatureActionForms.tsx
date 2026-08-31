"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/forms/Input";
import { Textarea } from "@/components/forms/Textarea";
import { Select } from "@/components/forms/Select";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { FormError } from "@/components/admin/FormError";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/admin/form-state";
import type { AgreementVersion } from "@/types/signatures";

type BoundAction = (prevState: ActionState, formData: FormData) => Promise<ActionState>;

export function CreateAgreementVersionForm({ action }: { action: BoundAction }) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  return (
    <form action={formAction} className="space-y-3">
      <FormError error={state.error} />
      <FormField id="contentReferenceUrl" label="Document reference URL" hint="A link to where the unsigned document lives (this codebase does not upload the unsigned document itself — see docs/milestones/M10-electronic-signature.md).">
        <Input id="contentReferenceUrl" name="contentReferenceUrl" type="url" placeholder="https://..." />
      </FormField>
      <FormField id="contentNotes" label="Notes">
        <Textarea id="contentNotes" name="contentNotes" rows={2} />
      </FormField>
      <SubmitButton>Create new version</SubmitButton>
    </form>
  );
}

export function SendForSignatureForm({
  action,
  draftVersions,
  studentName,
  agreementType,
  defaultSignerEmail,
}: {
  action: BoundAction;
  draftVersions: AgreementVersion[];
  studentName: string | null;
  agreementType: string;
  defaultSignerEmail?: string | null;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);

  if (draftVersions.length === 0) {
    return <p className="text-sm text-muted">Create a draft version above before sending this agreement for signature.</p>;
  }

  return (
    <form action={formAction} className="space-y-3">
      <FormError error={state.error} />
      <p className="rounded-[var(--radius-control)] border border-info/25 bg-info-light px-3.5 py-2.5 text-xs text-info">
        This will electronically sign this agreement using the configured signature provider. It is a technical capability only — it does not assert legal validity in any particular jurisdiction.
      </p>
      <FormField id="agreementVersionId" label="Version to send" required>
        <Select id="agreementVersionId" name="agreementVersionId" required defaultValue={draftVersions[0]?.id}>
          {draftVersions.map((v) => (
            <option key={v.id} value={v.id}>
              Version #{v.versionNumber}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField id="signerName" label="Signer name" required>
        <Input id="signerName" name="signerName" required defaultValue={studentName ?? ""} />
      </FormField>
      <FormField id="signerEmail" label="Signer email" required>
        <Input id="signerEmail" name="signerEmail" type="email" required defaultValue={defaultSignerEmail ?? ""} />
      </FormField>
      <div className="rounded-[var(--radius-control)] border border-border-strong bg-surface-alt px-3.5 py-2.5 text-xs text-text-soft">
        <p className="font-medium text-text">Confirm before sending:</p>
        <p className="mt-1">
          Agreement: <span className="font-medium text-text">{agreementType}</span>
          {studentName ? (
            <>
              {" "}
              · Student: <span className="font-medium text-text">{studentName}</span>
            </>
          ) : null}
        </p>
      </div>
      <ConfirmSubmitButton confirmLabel="Click to confirm send">Send for Signature</ConfirmSubmitButton>
    </form>
  );
}

export function ResendSignatureRequestForm({ action }: { action: BoundAction }) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  return (
    <form action={formAction} className="space-y-2">
      <FormError error={state.error} />
      <SubmitButton>Resend</SubmitButton>
    </form>
  );
}

export function CancelSignatureRequestForm({ action }: { action: BoundAction }) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  return (
    <form action={formAction} className="space-y-2">
      <FormError error={state.error} />
      <ConfirmSubmitButton confirmLabel="Click to confirm cancel">Cancel Request</ConfirmSubmitButton>
    </form>
  );
}
