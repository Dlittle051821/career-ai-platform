"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/forms/Input";
import { Select } from "@/components/forms/Select";
import { Checkbox } from "@/components/forms/Checkbox";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { FormError } from "@/components/admin/FormError";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/admin/form-state";

interface CountryOption {
  id: string;
  name: string;
  isoAlpha2: string;
}

/**
 * Inline "Add admission requirement" form on the course detail page. No
 * edit page (delete-and-recreate is the accepted MVP for this sub-entity).
 * portfolioRequired/interviewRequired are read by parseAdmissionRequirementForm
 * as plain `formData.get(key) === "on"` (src/lib/supabase/admin/education-admission-requirements.ts)
 * — a missing/unchecked checkbox correctly parses to `false` here, so this
 * does NOT need the isActive-style hidden-input fallback.
 */
export function AddAdmissionRequirementForm({
  action,
  courseId,
  countryOptions,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  courseId: string;
  countryOptions: CountryOption[];
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="courseId" value={courseId} />
      <FormError error={state.error} />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="ar-acceptedQualification" label="Accepted qualification" required>
          <Input id="ar-acceptedQualification" name="acceptedQualification" required />
        </FormField>
        <FormField id="ar-countryContextId" label="Country context" hint="Leave unset if the requirement applies regardless of country.">
          <Select id="ar-countryContextId" name="countryContextId" defaultValue="">
            <option value="">— Not set —</option>
            {countryOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.isoAlpha2})
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="ar-minimumGrade" label="Minimum grade">
          <Input id="ar-minimumGrade" name="minimumGrade" />
        </FormField>
        <FormField id="ar-minimumGpa" label="Minimum GPA" hint="0–100">
          <Input id="ar-minimumGpa" name="minimumGpa" type="number" min={0} max={100} step="any" />
        </FormField>
        <FormField id="ar-languageTest" label="Language test">
          <Input id="ar-languageTest" name="languageTest" placeholder="e.g. IELTS" />
        </FormField>
        <FormField id="ar-languageTestMinScore" label="Language test minimum score" hint="0–990">
          <Input id="ar-languageTestMinScore" name="languageTestMinScore" type="number" min={0} max={990} step="any" />
        </FormField>
        <FormField id="ar-standardizedTest" label="Standardized test">
          <Input id="ar-standardizedTest" name="standardizedTest" placeholder="e.g. GRE" />
        </FormField>
        <FormField id="ar-standardizedTestMinScore" label="Standardized test minimum score">
          <Input id="ar-standardizedTestMinScore" name="standardizedTestMinScore" type="number" min={0} max={9999} step="any" />
        </FormField>
        <FormField id="ar-workExperienceRequired" label="Work experience required">
          <Input id="ar-workExperienceRequired" name="workExperienceRequired" />
        </FormField>
      </div>

      <FormField id="ar-requiredSubjects" label="Required subjects" hint="Comma-separated">
        <Input id="ar-requiredSubjects" name="requiredSubjects" />
      </FormField>

      <FormField id="ar-additionalDocuments" label="Additional documents" hint="Comma-separated">
        <Input id="ar-additionalDocuments" name="additionalDocuments" />
      </FormField>

      <div className="flex flex-wrap gap-6">
        <Checkbox id="ar-portfolioRequired" name="portfolioRequired" label="Portfolio required" />
        <Checkbox id="ar-interviewRequired" name="interviewRequired" label="Interview required" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="ar-dataSource" label="Data source">
          <Input id="ar-dataSource" name="dataSource" />
        </FormField>
        <FormField id="ar-sourceUrl" label="Source URL">
          <Input id="ar-sourceUrl" name="sourceUrl" type="url" placeholder="https://" />
        </FormField>
        <FormField id="ar-lastVerifiedAt" label="Last verified at">
          <Input id="ar-lastVerifiedAt" name="lastVerifiedAt" type="date" />
        </FormField>
      </div>

      <SubmitButton>Add admission requirement</SubmitButton>
    </form>
  );
}
