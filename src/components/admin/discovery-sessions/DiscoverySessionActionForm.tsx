"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/FormField";
import { Select } from "@/components/forms/Select";
import { Input } from "@/components/forms/Input";
import { Textarea } from "@/components/forms/Textarea";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { FormError } from "@/components/admin/FormError";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/admin/form-state";
import { nextStatusOptions, DISCOVERY_SESSION_STATUS_TRANSITIONS } from "@/lib/admin/status";
import { DISCOVERY_SESSION_STATUS_LABELS, type DiscoverySession, type DiscoverySessionStatus } from "@/types/discovery-session";

function toLocalDateTimeInputValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function DiscoverySessionActionForm({
  action,
  session,
  counsellorOptions,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  session: DiscoverySession;
  counsellorOptions: { id: string; displayName: string }[];
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  const statusOptions: DiscoverySessionStatus[] = [session.status, ...nextStatusOptions(DISCOVERY_SESSION_STATUS_TRANSITIONS, session.status)];

  return (
    <form action={formAction} className="space-y-5">
      <FormError error={state.error} />

      <Card className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="assignedCounsellorId" label="Assigned counsellor">
            <Select id="assignedCounsellorId" name="assignedCounsellorId" defaultValue={session.assignedCounsellorId ?? ""}>
              <option value="">— Unassigned —</option>
              {counsellorOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField id="status" label="Status">
            <Select id="status" name="status" defaultValue={session.status}>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {DISCOVERY_SESSION_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField id="scheduledAt" label="Scheduled date/time" hint="Required before moving to 'Scheduled'.">
            <Input id="scheduledAt" name="scheduledAt" type="datetime-local" defaultValue={toLocalDateTimeInputValue(session.scheduledAt)} />
          </FormField>
        </div>

        <FormField id="cancellationReason" label="Cancellation reason" hint="Only used when moving to 'Cancelled'.">
          <Textarea id="cancellationReason" name="cancellationReason" rows={2} defaultValue={session.cancellationReason ?? ""} />
        </FormField>

        {session.studentNotes ? (
          <FormField id="studentNotesReadOnly" label="What the student shared when booking">
            <Textarea id="studentNotesReadOnly" value={session.studentNotes} readOnly rows={3} className="bg-surface-alt" />
          </FormField>
        ) : null}
      </Card>

      <SubmitButton>Save changes</SubmitButton>
    </form>
  );
}
