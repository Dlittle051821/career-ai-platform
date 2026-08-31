"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/forms/Input";
import { Select } from "@/components/forms/Select";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { FormError } from "@/components/admin/FormError";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/admin/form-state";
import { COURSE_INTAKE_CAPACITY_STATUSES, COURSE_INTAKE_STATUSES, type CourseIntake } from "@/types/education";

/**
 * Shared by the inline "Add intake" form on the course detail page and the
 * standalone intake edit page — same fields, same FormData shape read by
 * parseCourseIntakeForm in src/lib/supabase/admin/education-course-intakes.ts.
 * No boolean/checkbox fields here (capacityStatus/intakeStatus are plain
 * Selects), so the isActive-style "missing means true" hidden-input fix
 * used elsewhere doesn't apply to this form.
 */
export function IntakeForm({
  action,
  courseId,
  defaultValues,
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  courseId: string;
  defaultValues?: Partial<CourseIntake>;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="courseId" value={courseId} />
      <FormError error={state.error} />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="intake-intakeName" label="Intake name" required>
          <Input id="intake-intakeName" name="intakeName" defaultValue={defaultValues?.intakeName} required placeholder="e.g. Fall 2026" />
        </FormField>
        <FormField id="intake-startMonth" label="Start month" hint="1–12">
          <Input id="intake-startMonth" name="startMonth" type="number" min={1} max={12} defaultValue={defaultValues?.startMonth ?? ""} />
        </FormField>
        <FormField id="intake-startYear" label="Start year">
          <Input id="intake-startYear" name="startYear" type="number" min={1900} defaultValue={defaultValues?.startYear ?? ""} />
        </FormField>
        <FormField id="intake-applicationsOpenAt" label="Applications open">
          <Input id="intake-applicationsOpenAt" name="applicationsOpenAt" type="date" defaultValue={defaultValues?.applicationsOpenAt ?? ""} />
        </FormField>
        <FormField id="intake-priorityDeadline" label="Priority deadline">
          <Input id="intake-priorityDeadline" name="priorityDeadline" type="date" defaultValue={defaultValues?.priorityDeadline ?? ""} />
        </FormField>
        <FormField id="intake-finalDeadline" label="Final deadline">
          <Input id="intake-finalDeadline" name="finalDeadline" type="date" defaultValue={defaultValues?.finalDeadline ?? ""} />
        </FormField>
        <FormField id="intake-internationalDeadline" label="International deadline">
          <Input
            id="intake-internationalDeadline"
            name="internationalDeadline"
            type="date"
            defaultValue={defaultValues?.internationalDeadline ?? ""}
          />
        </FormField>
        <FormField id="intake-capacityStatus" label="Capacity status">
          <Select id="intake-capacityStatus" name="capacityStatus" defaultValue={defaultValues?.capacityStatus ?? "unknown"}>
            {COURSE_INTAKE_CAPACITY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="intake-intakeStatus" label="Intake status">
          <Select id="intake-intakeStatus" name="intakeStatus" defaultValue={defaultValues?.intakeStatus ?? "upcoming"}>
            {COURSE_INTAKE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="intake-dataSource" label="Data source">
          <Input id="intake-dataSource" name="dataSource" defaultValue={defaultValues?.dataSource ?? ""} />
        </FormField>
        <FormField id="intake-sourceUrl" label="Source URL">
          <Input id="intake-sourceUrl" name="sourceUrl" type="url" defaultValue={defaultValues?.sourceUrl ?? ""} placeholder="https://" />
        </FormField>
        <FormField id="intake-lastVerifiedAt" label="Last verified at">
          <Input id="intake-lastVerifiedAt" name="lastVerifiedAt" type="date" defaultValue={defaultValues?.lastVerifiedAt ?? ""} />
        </FormField>
      </div>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
