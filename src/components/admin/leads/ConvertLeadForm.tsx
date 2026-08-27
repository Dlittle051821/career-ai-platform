"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/forms/Input";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { FormError } from "@/components/admin/FormError";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/admin/form-state";

export function ConvertLeadForm({ action }: { action: (prevState: ActionState, formData: FormData) => Promise<ActionState> }) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  return (
    <form action={formAction} className="space-y-3">
      <FormError error={state.error} />
      <FormField id="studentEmail" label="Registered student email" hint="Looks up an existing student account by email — this never creates one.">
        <Input id="studentEmail" name="studentEmail" type="email" required />
      </FormField>
      <SubmitButton>Record conversion</SubmitButton>
    </form>
  );
}
