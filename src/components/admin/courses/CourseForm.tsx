"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/forms/Input";
import { Select } from "@/components/forms/Select";
import { Textarea } from "@/components/forms/Textarea";
import { Checkbox } from "@/components/forms/Checkbox";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { FormError } from "@/components/admin/FormError";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/admin/form-state";
import type { Course } from "@/types/admin";

const DELIVERY_MODES = [
  { value: "", label: "— Not set —" },
  { value: "on_campus", label: "On campus" },
  { value: "online", label: "Online" },
  { value: "hybrid", label: "Hybrid" },
];
const TUITION_PERIODS = [
  { value: "", label: "— Not set —" },
  { value: "per_year", label: "Per year" },
  { value: "per_semester", label: "Per semester" },
  { value: "per_program", label: "Per program" },
  { value: "per_credit", label: "Per credit" },
];
const DATA_QUALITY_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "reviewed", label: "Reviewed" },
  { value: "approved", label: "Approved" },
];

export function CourseForm({
  action,
  defaultValues,
  universityOptions,
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  defaultValues?: Partial<Course>;
  universityOptions: { id: string; name: string }[];
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-6">
      <FormError error={state.error} />

      <Card className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="universityId" label="University" required>
            <Select id="universityId" name="universityId" defaultValue={defaultValues?.universityId ?? ""} required>
              <option value="">— Select a university —</option>
              {universityOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="name" label="Course name" required>
            <Input id="name" name="name" defaultValue={defaultValues?.name} required />
          </FormField>
          <FormField id="slug" label="Slug" required hint="Lowercase letters, numbers, single hyphens.">
            <Input id="slug" name="slug" defaultValue={defaultValues?.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" />
          </FormField>
          <FormField id="educationLevel" label="Education level">
            <Input id="educationLevel" name="educationLevel" defaultValue={defaultValues?.educationLevel ?? ""} placeholder="e.g. Bachelor's" />
          </FormField>
          <FormField id="fieldOfStudy" label="Field of study">
            <Input id="fieldOfStudy" name="fieldOfStudy" defaultValue={defaultValues?.fieldOfStudy ?? ""} />
          </FormField>
          <FormField id="durationText" label="Duration">
            <Input id="durationText" name="durationText" defaultValue={defaultValues?.durationText ?? ""} placeholder="e.g. 4 years" />
          </FormField>
          <FormField id="deliveryMode" label="Delivery mode">
            <Select id="deliveryMode" name="deliveryMode" defaultValue={defaultValues?.deliveryMode ?? ""}>
              {DELIVERY_MODES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="campusLocation" label="Campus location">
            <Input id="campusLocation" name="campusLocation" defaultValue={defaultValues?.campusLocation ?? ""} />
          </FormField>
          <FormField id="intakeInfo" label="Intake info">
            <Input id="intakeInfo" name="intakeInfo" defaultValue={defaultValues?.intakeInfo ?? ""} placeholder="e.g. Fall, Spring" />
          </FormField>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <FormField id="tuitionAmount" label="Tuition amount" hint="Numeric only, e.g. 250000">
            <Input
              id="tuitionAmount"
              name="tuitionAmount"
              inputMode="decimal"
              defaultValue={defaultValues?.tuitionAmountMinorUnits != null ? (defaultValues.tuitionAmountMinorUnits / 100).toString() : ""}
            />
          </FormField>
          <FormField id="tuitionCurrency" label="Currency">
            <Input id="tuitionCurrency" name="tuitionCurrency" defaultValue={defaultValues?.tuitionCurrency ?? "INR"} maxLength={3} />
          </FormField>
          <FormField id="tuitionPeriod" label="Tuition period">
            <Select id="tuitionPeriod" name="tuitionPeriod" defaultValue={defaultValues?.tuitionPeriod ?? ""}>
              {TUITION_PERIODS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <FormField id="entryRequirementsSummary" label="Entry requirements summary" hint="Do not invent guarantees — describe stated requirements only.">
          <Textarea id="entryRequirementsSummary" name="entryRequirementsSummary" defaultValue={defaultValues?.entryRequirementsSummary ?? ""} rows={3} />
        </FormField>

        <FormField id="applicationUrl" label="Application URL" hint="Must start with http:// or https://. This is not a live integration.">
          <Input id="applicationUrl" name="applicationUrl" type="url" defaultValue={defaultValues?.applicationUrl ?? ""} placeholder="https://" />
        </FormField>

        <FormField id="dataQualityStatus" label="Data quality status">
          <Select id="dataQualityStatus" name="dataQualityStatus" defaultValue={defaultValues?.dataQualityStatus ?? "draft"}>
            {DATA_QUALITY_STATUSES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </FormField>

        <div className="flex flex-wrap gap-6">
          <Checkbox id="isActive" name="isActive" defaultChecked={defaultValues?.isActive ?? true} label="Active" />
          <Checkbox
            id="isVisible"
            name="isVisible"
            defaultChecked={defaultValues?.isVisible ?? false}
            label="Visible (reserved for future public display)"
          />
        </div>

        <FormField id="internalNotes" label="Internal notes" hint="Never shown to students.">
          <Textarea id="internalNotes" name="internalNotes" defaultValue={defaultValues?.internalNotes ?? ""} rows={3} />
        </FormField>
      </Card>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
