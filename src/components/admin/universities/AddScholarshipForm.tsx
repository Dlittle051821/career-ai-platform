"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/forms/Input";
import { Select } from "@/components/forms/Select";
import { Checkbox } from "@/components/forms/Checkbox";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { FormError } from "@/components/admin/FormError";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/admin/form-state";
import { createScholarshipAction } from "@/app/admin/universities/[id]/scholarships/actions";

/**
 * Inline "Add scholarship" form on the university detail page. Scope and
 * universityId are fixed via hidden inputs — never editable — matching the
 * spec's "don't expose those as editable fields" instruction. No edit page
 * (delete-and-recreate is the accepted MVP for this sub-entity); see
 * ScholarshipsTable's per-row delete form.
 */
export function AddScholarshipForm({ universityId }: { universityId: string }) {
  const [state, formAction] = useActionState(createScholarshipAction, INITIAL_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="scope" value="university" />
      <input type="hidden" name="universityId" value={universityId} />
      <FormError error={state.error} />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="scholarship-name" label="Name" required>
          <Input id="scholarship-name" name="name" required />
        </FormField>
        <FormField id="scholarship-deadline" label="Deadline">
          <Input id="scholarship-deadline" name="deadline" type="date" />
        </FormField>
        <FormField id="scholarship-awardAmount" label="Award amount">
          <Input id="scholarship-awardAmount" name="awardAmount" type="number" min={0} step="0.01" />
        </FormField>
        <FormField id="scholarship-currencyCode" label="Currency" hint="3-letter ISO 4217 code, required if an amount is set">
          <Input id="scholarship-currencyCode" name="currencyCode" maxLength={3} />
        </FormField>
        <FormField id="scholarship-scholarshipUrl" label="Scholarship URL">
          <Input id="scholarship-scholarshipUrl" name="scholarshipUrl" type="url" placeholder="https://" />
        </FormField>
        <FormField id="scholarship-internationalEligible" label="International students eligible">
          <Select id="scholarship-internationalEligible" name="internationalEligible" defaultValue="">
            <option value="">— Unspecified —</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </Select>
        </FormField>
      </div>

      <FormField id="scholarship-eligibility" label="Eligibility">
        <Input id="scholarship-eligibility" name="eligibility" />
      </FormField>

      <FormField id="scholarship-awardDescription" label="Award description">
        <Input id="scholarship-awardDescription" name="awardDescription" />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="scholarship-dataSource" label="Data source">
          <Input id="scholarship-dataSource" name="dataSource" />
        </FormField>
        <FormField id="scholarship-sourceUrl" label="Source URL">
          <Input id="scholarship-sourceUrl" name="sourceUrl" type="url" placeholder="https://" />
        </FormField>
      </div>

      <div>
        <Checkbox id="scholarship-isActive" name="isActive" defaultChecked label="Active" />
        <input type="hidden" name="isActive" value="off" />
      </div>

      <SubmitButton>Add scholarship</SubmitButton>
    </form>
  );
}
