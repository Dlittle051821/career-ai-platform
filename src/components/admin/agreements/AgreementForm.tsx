"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/forms/Input";
import { Select } from "@/components/forms/Select";
import { Textarea } from "@/components/forms/Textarea";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { FormError } from "@/components/admin/FormError";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/admin/form-state";
import { nextStatusOptions, AGREEMENT_STATUS_TRANSITIONS, SIGNATURE_STATUS_TRANSITIONS } from "@/lib/admin/status";
import { SIGNATURE_STATUS_LABELS, type Agreement, type AgreementStatus, type SignatureStatus } from "@/types/admin";

export function AgreementForm({
  action,
  defaultValues,
  universityOptions,
  counsellorOptions,
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  defaultValues?: Partial<Agreement>;
  universityOptions: { id: string; name: string }[];
  counsellorOptions: { id: string; displayName: string }[];
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  const currentStatus = defaultValues?.status;
  const statusOptions: AgreementStatus[] = currentStatus ? [currentStatus, ...nextStatusOptions(AGREEMENT_STATUS_TRANSITIONS, currentStatus)] : [];
  const currentSignature = defaultValues?.signatureStatus;
  const signatureOptions: SignatureStatus[] = currentSignature
    ? [currentSignature, ...nextStatusOptions(SIGNATURE_STATUS_TRANSITIONS, currentSignature)]
    : ["not_started", "pending_signature", "signed"];

  return (
    <form action={formAction} className="space-y-6">
      <FormError error={state.error} />

      <Card className="space-y-5">
        <p className="rounded-[var(--radius-control)] border border-warning/30 bg-warning-light px-4 py-3 text-sm text-warning">
          This tracks agreement status honestly — there is no e-signature capability and no document storage beyond
          a reference URL you provide.
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="agreementType" label="Agreement type" required>
            <Input id="agreementType" name="agreementType" defaultValue={defaultValues?.agreementType} required placeholder="e.g. Counselling service agreement" />
          </FormField>
          <FormField id="version" label="Version">
            <Input id="version" name="version" defaultValue={defaultValues?.version ?? ""} placeholder="e.g. v1.2" />
          </FormField>
          <FormField id="studentEmail" label="Student email" hint="At least one party (student, counsellor, university) is required.">
            <Input id="studentEmail" name="studentEmail" type="email" />
          </FormField>
          <FormField id="counsellorId" label="Counsellor">
            <Select id="counsellorId" name="counsellorId" defaultValue={defaultValues?.counsellorId ?? ""}>
              <option value="">— None —</option>
              {counsellorOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="universityId" label="University">
            <Select id="universityId" name="universityId" defaultValue={defaultValues?.universityId ?? ""}>
              <option value="">— None —</option>
              {universityOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="effectiveDate" label="Effective date">
            <Input id="effectiveDate" name="effectiveDate" type="date" defaultValue={defaultValues?.effectiveDate ?? ""} />
          </FormField>
          <FormField id="expiryDate" label="Expiry date">
            <Input id="expiryDate" name="expiryDate" type="date" defaultValue={defaultValues?.expiryDate ?? ""} />
          </FormField>
          {currentStatus ? (
            <FormField id="status" label="Status">
              <Select id="status" name="status" defaultValue={currentStatus}>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : null}
          <FormField id="signatureStatus" label="Signature status" hint="Manually tracked, never an automated e-signature event.">
            <Select id="signatureStatus" name="signatureStatus" defaultValue={currentSignature ?? "not_started"}>
              {signatureOptions.map((s) => (
                <option key={s} value={s}>
                  {SIGNATURE_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <FormField id="documentReferenceUrl" label="Document reference URL" hint="A link to where the document is stored elsewhere — not uploaded here.">
          <Input id="documentReferenceUrl" name="documentReferenceUrl" type="url" defaultValue={defaultValues?.documentReferenceUrl ?? ""} placeholder="https://" />
        </FormField>

        <FormField id="internalNotes" label="Internal notes" hint="Never shown to the student.">
          <Textarea id="internalNotes" name="internalNotes" defaultValue={defaultValues?.internalNotes ?? ""} rows={3} />
        </FormField>
      </Card>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
