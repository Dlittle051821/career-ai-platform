"use client";

import { useActionState } from "react";
import { Select } from "@/components/forms/Select";
import { Textarea } from "@/components/forms/Textarea";
import { FormField } from "@/components/forms/FormField";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { FormError } from "@/components/admin/FormError";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/admin/form-state";
import { ADMIN_STUDENT_STATUS_LABELS, type AdminStudentStatus } from "@/types/admin";

const STATUSES: AdminStudentStatus[] = ["prospect", "active", "inactive", "archived"];

export function StudentStatusForm({
  action,
  currentStatus,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  currentStatus: AdminStudentStatus;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  return (
    <form action={formAction} className="space-y-3">
      <FormError error={state.error} />
      <FormField id="status" label="Status" hint="Archiving is preferred over any kind of deletion.">
        <Select id="status" name="status" defaultValue={currentStatus}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {ADMIN_STUDENT_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </FormField>
      <SubmitButton>Update status</SubmitButton>
    </form>
  );
}

export function AssignCounsellorForm({
  action,
  currentCounsellorId,
  counsellorOptions,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  currentCounsellorId: string | null;
  counsellorOptions: { id: string; displayName: string }[];
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  return (
    <form action={formAction} className="space-y-3">
      <FormError error={state.error} />
      <FormField id="assignedCounsellorId" label="Assigned counsellor">
        <Select id="assignedCounsellorId" name="assignedCounsellorId" defaultValue={currentCounsellorId ?? ""}>
          <option value="">— Unassigned —</option>
          {counsellorOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.displayName}
            </option>
          ))}
        </Select>
      </FormField>
      <SubmitButton>Save assignment</SubmitButton>
    </form>
  );
}

export function AddNoteForm({ action }: { action: (prevState: ActionState, formData: FormData) => Promise<ActionState> }) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  return (
    <form action={formAction} className="space-y-3">
      <FormError error={state.error} />
      <FormField id="note" label="Internal note" hint="Never shown to the student. Notes are append-only.">
        <Textarea id="note" name="note" rows={3} required />
      </FormField>
      <SubmitButton>Add note</SubmitButton>
    </form>
  );
}
