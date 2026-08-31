"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/forms/Input";
import { Checkbox } from "@/components/forms/Checkbox";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { FormError } from "@/components/admin/FormError";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/admin/form-state";
import type { PricingInclusion } from "@/types/pricing";

/**
 * Create/edit form for one pricing_plan_inclusions row. Field names match
 * parseInclusionForm() in src/lib/supabase/admin/pricing.ts exactly. Only
 * ever rendered for a version whose status is "draft" (see the two
 * inclusions/[...]/page.tsx callers) — the database rejects a write against
 * a non-draft parent regardless, but the page itself never offers the form
 * once a version is published.
 */
export function PricingInclusionForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  defaultValues?: Partial<PricingInclusion>;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-6">
      <FormError error={state.error} />

      <Card className="space-y-5">
        <FormField id="title" label="Title" required hint="Shown verbatim on the public pricing card and its full-list disclosure.">
          <Input id="title" name="title" defaultValue={defaultValues?.title} required />
        </FormField>
        <FormField id="explanation" label="Explanation (optional)" hint="One extra line shown under the title, if useful.">
          <Input id="explanation" name="explanation" defaultValue={defaultValues?.explanation ?? ""} />
        </FormField>
        <div className="grid gap-5 sm:grid-cols-3">
          <FormField id="category" label="Category (optional)" hint='Internal grouping, e.g. "support", "shortlist".'>
            <Input id="category" name="category" defaultValue={defaultValues?.category ?? ""} />
          </FormField>
          <FormField id="numericAllowance" label="Numeric allowance (optional)">
            <Input id="numericAllowance" name="numericAllowance" inputMode="decimal" defaultValue={defaultValues?.numericAllowance ?? ""} />
          </FormField>
          <FormField id="unit" label="Unit (optional)" hint='e.g. "days", "universities".'>
            <Input id="unit" name="unit" defaultValue={defaultValues?.unit ?? ""} />
          </FormField>
        </div>
        <div className="flex flex-wrap gap-6">
          <Checkbox id="isHighlight" name="isHighlight" defaultChecked={defaultValues?.isHighlight ?? false} label="Mark as a highlight" />
          <Checkbox id="isActive" name="isActive" defaultChecked={defaultValues?.isActive ?? true} label="Active (visible on the public page)" />
        </div>
      </Card>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
