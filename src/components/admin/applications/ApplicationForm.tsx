"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/forms/Input";
import { Select } from "@/components/forms/Select";
import { Textarea } from "@/components/forms/Textarea";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { FormError } from "@/components/admin/FormError";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/admin/form-state";
import { nextStatusOptions, APPLICATION_STAGE_TRANSITIONS } from "@/lib/admin/status";
import { APPLICATION_STAGE_LABELS, type Application, type ApplicationStage } from "@/types/admin";

const DECISION_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "offer", label: "Offer" },
  { value: "waitlist", label: "Waitlist" },
  { value: "rejected", label: "Rejected" },
  { value: "deferred", label: "Deferred" },
];

export function ApplicationForm({
  action,
  defaultValues,
  studentEmail,
  universityOptions,
  courseOptions,
  counsellorOptions,
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  defaultValues?: Partial<Application>;
  /** Only asked for on create — an existing application's student is fixed. */
  studentEmail?: string;
  universityOptions: { id: string; name: string }[];
  courseOptions: { id: string; name: string }[];
  counsellorOptions: { id: string; displayName: string }[];
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  const currentStage = defaultValues?.stage;
  const stageOptions: ApplicationStage[] = currentStage ? [currentStage, ...nextStatusOptions(APPLICATION_STAGE_TRANSITIONS, currentStage)] : [];

  return (
    <form action={formAction} className="space-y-6">
      <FormError error={state.error} />

      <Card className="space-y-5">
        {defaultValues ? (
          <p className="text-sm text-muted">
            Student: <span className="font-medium text-text">{defaultValues.studentName ?? defaultValues.studentUserId}</span> (not editable here)
          </p>
        ) : (
          <FormField id="studentEmail" label="Student email" required hint="Looks up an existing registered student account — this never creates one.">
            <Input id="studentEmail" name="studentEmail" type="email" required defaultValue={studentEmail} />
          </FormField>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="universityId" label="University">
            <Select id="universityId" name="universityId" defaultValue={defaultValues?.universityId ?? ""}>
              <option value="">— Not set —</option>
              {universityOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="courseId" label="Course">
            <Select id="courseId" name="courseId" defaultValue={defaultValues?.courseId ?? ""}>
              <option value="">— Not set —</option>
              {courseOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="assignedCounsellorId" label="Assigned counsellor">
            <Select id="assignedCounsellorId" name="assignedCounsellorId" defaultValue={defaultValues?.assignedCounsellorId ?? ""}>
              <option value="">— Unassigned —</option>
              {counsellorOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="intake" label="Intake">
            <Input id="intake" name="intake" defaultValue={defaultValues?.intake ?? ""} placeholder="e.g. Fall 2027" />
          </FormField>
          <FormField id="submissionDate" label="Submission date">
            <Input id="submissionDate" name="submissionDate" type="date" defaultValue={defaultValues?.submissionDate ?? ""} />
          </FormField>
          <FormField id="decisionStatus" label="Decision status">
            <Select id="decisionStatus" name="decisionStatus" defaultValue={defaultValues?.decisionStatus ?? "pending"}>
              {DECISION_STATUSES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="offerType" label="Offer type">
            <Input id="offerType" name="offerType" defaultValue={defaultValues?.offerType ?? ""} placeholder="e.g. Conditional, Unconditional" />
          </FormField>
          {currentStage ? (
            <FormField id="stage" label="Stage" hint="No direct university integration — this is a manually maintained record.">
              <Select id="stage" name="stage" defaultValue={currentStage}>
                {stageOptions.map((s) => (
                  <option key={s} value={s}>
                    {APPLICATION_STAGE_LABELS[s]}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : null}
          <FormField id="nextAction" label="Next action">
            <Input id="nextAction" name="nextAction" defaultValue={defaultValues?.nextAction ?? ""} />
          </FormField>
          <FormField id="nextActionDate" label="Next action date">
            <Input id="nextActionDate" name="nextActionDate" type="date" defaultValue={defaultValues?.nextActionDate ?? ""} />
          </FormField>
          <FormField id="lastContactDate" label="Last contact date">
            <Input id="lastContactDate" name="lastContactDate" type="date" defaultValue={defaultValues?.lastContactDate ?? ""} />
          </FormField>
        </div>

        <FormField id="internalNotes" label="Internal notes" hint="Never shown to the student.">
          <Textarea id="internalNotes" name="internalNotes" defaultValue={defaultValues?.internalNotes ?? ""} rows={3} />
        </FormField>
      </Card>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
