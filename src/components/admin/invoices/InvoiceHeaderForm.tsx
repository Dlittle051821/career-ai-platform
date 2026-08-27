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
import type { Invoice } from "@/types/payments";

export function InvoiceHeaderForm({
  action,
  defaultValues,
  studentOptions,
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  defaultValues?: Partial<Invoice>;
  studentOptions: { id: string; label: string }[];
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-6">
      <FormError error={state.error} />

      <Card className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="studentUserId" label="Student" required>
            <Select id="studentUserId" name="studentUserId" required defaultValue={defaultValues?.studentUserId ?? ""}>
              <option value="" disabled>
                Select a student…
              </option>
              {studentOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="currency" label="Currency">
            <Input id="currency" name="currency" defaultValue={defaultValues?.currency ?? "INR"} maxLength={3} />
          </FormField>
          <FormField id="applicationId" label="Related application ID" hint="Optional — paste an application's ID if this invoice relates to one.">
            <Input id="applicationId" name="applicationId" defaultValue={defaultValues?.applicationId ?? ""} />
          </FormField>
          <FormField id="dueDate" label="Due date">
            <Input id="dueDate" name="dueDate" type="date" defaultValue={defaultValues?.dueDate ?? ""} />
          </FormField>
        </div>

        <FormField id="studentNotes" label="Notes to student" hint="Shown to the student on their invoice.">
          <Textarea id="studentNotes" name="studentNotes" defaultValue={defaultValues?.studentNotes ?? ""} rows={2} />
        </FormField>
        <FormField id="internalNotes" label="Internal notes" hint="Never shown to the student.">
          <Textarea id="internalNotes" name="internalNotes" defaultValue={defaultValues?.internalNotes ?? ""} rows={2} />
        </FormField>
      </Card>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
