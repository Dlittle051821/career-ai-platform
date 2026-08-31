"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/forms/Input";
import { Select } from "@/components/forms/Select";
import { Checkbox } from "@/components/forms/Checkbox";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { FormError } from "@/components/admin/FormError";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/admin/form-state";

/**
 * Inline "Add scholarship" form on the course detail page. Scope and
 * courseId are fixed via hidden inputs — never editable. No edit page
 * (delete-and-recreate is the accepted MVP for this sub-entity), mirroring
 * src/components/admin/universities/AddScholarshipForm.tsx.
 *
 * `isActive` needs the same hidden fallback as that university-side form:
 * parseScholarshipForm (src/lib/supabase/admin/education-scholarships.ts)
 * treats a MISSING field as active (`!== "off"`), so an unchecked plain
 * checkbox (which submits nothing at all) would silently save as active.
 * Putting the checkbox before a same-named hidden "off" input relies on
 * FormData.get returning the FIRST value for a repeated name — checked
 * sends ["on","off"] (get -> "on"), unchecked sends only ["off"] (get ->
 * "off").
 */
export function AddScholarshipForm({
  action,
  courseId,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  courseId: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="scope" value="course" />
      <input type="hidden" name="courseId" value={courseId} />
      <FormError error={state.error} />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="cscholarship-name" label="Name" required>
          <Input id="cscholarship-name" name="name" required />
        </FormField>
        <FormField id="cscholarship-deadline" label="Deadline">
          <Input id="cscholarship-deadline" name="deadline" type="date" />
        </FormField>
        <FormField id="cscholarship-awardAmount" label="Award amount">
          <Input id="cscholarship-awardAmount" name="awardAmount" type="number" min={0} step="0.01" />
        </FormField>
        <FormField id="cscholarship-currencyCode" label="Currency" hint="3-letter ISO 4217 code, required if an amount is set">
          <Input id="cscholarship-currencyCode" name="currencyCode" maxLength={3} />
        </FormField>
        <FormField id="cscholarship-scholarshipUrl" label="Scholarship URL">
          <Input id="cscholarship-scholarshipUrl" name="scholarshipUrl" type="url" placeholder="https://" />
        </FormField>
        <FormField id="cscholarship-internationalEligible" label="International students eligible">
          <Select id="cscholarship-internationalEligible" name="internationalEligible" defaultValue="">
            <option value="">— Unspecified —</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </Select>
        </FormField>
      </div>

      <FormField id="cscholarship-eligibility" label="Eligibility">
        <Input id="cscholarship-eligibility" name="eligibility" />
      </FormField>

      <FormField id="cscholarship-awardDescription" label="Award description">
        <Input id="cscholarship-awardDescription" name="awardDescription" />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="cscholarship-dataSource" label="Data source">
          <Input id="cscholarship-dataSource" name="dataSource" />
        </FormField>
        <FormField id="cscholarship-sourceUrl" label="Source URL">
          <Input id="cscholarship-sourceUrl" name="sourceUrl" type="url" placeholder="https://" />
        </FormField>
      </div>

      <div>
        <Checkbox id="cscholarship-isActive" name="isActive" defaultChecked label="Active" />
        <input type="hidden" name="isActive" value="off" />
      </div>

      <SubmitButton>Add scholarship</SubmitButton>
    </form>
  );
}
