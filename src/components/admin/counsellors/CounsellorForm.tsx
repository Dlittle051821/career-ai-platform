"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/forms/Input";
import { Textarea } from "@/components/forms/Textarea";
import { Checkbox } from "@/components/forms/Checkbox";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { FormError } from "@/components/admin/FormError";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/admin/form-state";
import type { Counsellor } from "@/types/admin";

export function CounsellorForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  defaultValues?: Partial<Counsellor>;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-6">
      <FormError error={state.error} />

      <Card className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="displayName" label="Display name" required>
            <Input id="displayName" name="displayName" defaultValue={defaultValues?.displayName} required />
          </FormField>
          <FormField id="email" label="Email">
            <Input id="email" name="email" type="email" defaultValue={defaultValues?.email ?? ""} />
          </FormField>
          <FormField id="phone" label="Phone">
            <Input id="phone" name="phone" defaultValue={defaultValues?.phone ?? ""} />
          </FormField>
          <FormField id="capacity" label="Capacity" hint="Maximum active students/leads/applications, if tracked.">
            <Input id="capacity" name="capacity" inputMode="numeric" defaultValue={defaultValues?.capacity != null ? String(defaultValues.capacity) : ""} />
          </FormField>
          <FormField id="specializations" label="Specializations" hint="Comma-separated, e.g. Engineering, MBA">
            <Input id="specializations" name="specializations" defaultValue={defaultValues?.specializations?.join(", ") ?? ""} />
          </FormField>
          <FormField id="regions" label="Regions" hint="Comma-separated, e.g. North India, Gulf">
            <Input id="regions" name="regions" defaultValue={defaultValues?.regions?.join(", ") ?? ""} />
          </FormField>
        </div>

        <Checkbox id="isActive" name="isActive" defaultChecked={defaultValues?.isActive ?? true} label="Active (available for new assignments)" />

        <FormField
          id="internalNotes"
          label="Internal notes"
          hint="Never shown to students. This record has no role field and no self-edit path — a counsellor can never grant themselves privileges by editing it."
        >
          <Textarea id="internalNotes" name="internalNotes" defaultValue={defaultValues?.internalNotes ?? ""} rows={3} />
        </FormField>
      </Card>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
