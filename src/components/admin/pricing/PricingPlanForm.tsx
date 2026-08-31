"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/forms/Input";
import { Select } from "@/components/forms/Select";
import { Checkbox } from "@/components/forms/Checkbox";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { FormError } from "@/components/admin/FormError";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/admin/form-state";
import { PRICING_CATEGORIES, PRICING_CATEGORY_LABELS, type PricingCategory, type PricingPlan } from "@/types/pricing";

/** Admin capability: "Add plan" / catalog-identity editing. Never contains a price field — see PricingPlanVersionForm for that (immutable-once-published, so it lives on its own dedicated page). */
export function PricingPlanForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  defaultValues?: Partial<PricingPlan>;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-6">
      <FormError error={state.error} />
      <Card className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="internalName" label="Internal / temporary name" required hint='Shown to admins everywhere. For the Bachelor/Master Abroad tiers this starts as the temporary name (e.g. "Bachelor Abroad — Tier 1") until you publish a version with a permanent public title.'>
            <Input id="internalName" name="internalName" defaultValue={defaultValues?.internalName} required />
          </FormField>
          <FormField id="slug" label="Slug" required hint="Lowercase letters, numbers, single hyphens. Stable — used by the public pricing page and every purchase forever.">
            <Input id="slug" name="slug" defaultValue={defaultValues?.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" />
          </FormField>
          <FormField id="category" label="Category" required>
            <Select id="category" name="category" defaultValue={defaultValues?.category ?? "school_counselling"} required>
              {PRICING_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {PRICING_CATEGORY_LABELS[c as PricingCategory]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="displayOrder" label="Display order" hint="Lower numbers appear first within their category section.">
            <Input id="displayOrder" name="displayOrder" inputMode="numeric" defaultValue={defaultValues?.displayOrder != null ? String(defaultValues.displayOrder) : "0"} />
          </FormField>
        </div>

        <Checkbox id="isActive" name="isActive" defaultChecked={defaultValues?.isActive ?? true} label="Active — offered at all (unpublishing a plan hides it from /pricing entirely, even if it has a published price)" />
        <Checkbox id="isRecommended" name="isRecommended" defaultChecked={defaultValues?.isRecommended ?? false} label='Mark as "Recommended" (only one plan per category should normally carry this)' />
      </Card>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
