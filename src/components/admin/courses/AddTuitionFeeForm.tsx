"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/forms/Input";
import { Select } from "@/components/forms/Select";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { FormError } from "@/components/admin/FormError";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/admin/form-state";
import { LIVING_COSTS_PERIODS, TUITION_BILLING_PERIODS, TUITION_STUDENT_CATEGORIES } from "@/types/education";

/**
 * Inline "Add tuition fee" form on the course detail page. No edit page
 * (delete-and-recreate is the accepted MVP for this sub-entity, matching the
 * scholarship sub-entity precedent on the universities side). Currency is
 * always the institution's own original currency — NEVER converted or
 * compared across records, per src/lib/supabase/admin/education-tuition-fees.ts.
 */
export function AddTuitionFeeForm({ action, courseId }: { action: (prevState: ActionState, formData: FormData) => Promise<ActionState>; courseId: string }) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="courseId" value={courseId} />
      <FormError error={state.error} />
      <p className="text-xs text-muted">
        Amounts are recorded in the institution&rsquo;s own original currency and are never converted or compared across records.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="tf-studentCategory" label="Student category" required>
          <Select id="tf-studentCategory" name="studentCategory" defaultValue="" required>
            <option value="" disabled>
              — Select —
            </option>
            {TUITION_STUDENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="tf-academicYear" label="Academic year" required hint='e.g. "2026/2027" or "2026"'>
          <Input id="tf-academicYear" name="academicYear" required />
        </FormField>
        <FormField id="tf-amount" label="Tuition amount" required>
          <Input id="tf-amount" name="amount" type="number" min={0} step="0.01" required />
        </FormField>
        <FormField id="tf-currencyCode" label="Currency" required hint="3-letter ISO 4217 code, e.g. EUR">
          <Input id="tf-currencyCode" name="currencyCode" maxLength={3} required />
        </FormField>
        <FormField id="tf-billingPeriod" label="Billing period">
          <Select id="tf-billingPeriod" name="billingPeriod" defaultValue="">
            <option value="">— Not set —</option>
            {TUITION_BILLING_PERIODS.map((p) => (
              <option key={p} value={p}>
                {p.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="tf-mandatoryFeesAmount" label="Mandatory fees amount" hint="Same currency as tuition; defaults to 0">
          <Input id="tf-mandatoryFeesAmount" name="mandatoryFeesAmount" type="number" min={0} step="0.01" />
        </FormField>
        <FormField id="tf-estimatedLivingCostsAmount" label="Estimated living costs">
          <Input id="tf-estimatedLivingCostsAmount" name="estimatedLivingCostsAmount" type="number" min={0} step="0.01" />
        </FormField>
        <FormField id="tf-estimatedLivingCostsPeriod" label="Living costs period">
          <Select id="tf-estimatedLivingCostsPeriod" name="estimatedLivingCostsPeriod" defaultValue="">
            <option value="">— Not set —</option>
            {LIVING_COSTS_PERIODS.map((p) => (
              <option key={p} value={p}>
                {p.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="tf-dataSource" label="Data source">
          <Input id="tf-dataSource" name="dataSource" />
        </FormField>
        <FormField id="tf-sourceUrl" label="Source URL">
          <Input id="tf-sourceUrl" name="sourceUrl" type="url" placeholder="https://" />
        </FormField>
        <FormField id="tf-lastVerifiedAt" label="Last verified at">
          <Input id="tf-lastVerifiedAt" name="lastVerifiedAt" type="date" />
        </FormField>
      </div>

      <SubmitButton>Add tuition fee</SubmitButton>
    </form>
  );
}
