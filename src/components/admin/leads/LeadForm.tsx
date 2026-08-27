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
import { nextStatusOptions } from "@/lib/admin/status";
import { LEAD_STAGE_TRANSITIONS } from "@/lib/admin/status";
import { LEAD_STAGE_LABELS, type Lead, type LeadStage } from "@/types/admin";

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export function LeadForm({
  action,
  defaultValues,
  counsellorOptions,
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  defaultValues?: Partial<Lead>;
  counsellorOptions: { id: string; displayName: string }[];
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  const currentStage = defaultValues?.stage;
  const stageOptions: LeadStage[] = currentStage ? [currentStage, ...nextStatusOptions(LEAD_STAGE_TRANSITIONS, currentStage)] : [];

  return (
    <form action={formAction} className="space-y-6">
      <FormError error={state.error} />

      <Card className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="fullName" label="Full name" required>
            <Input id="fullName" name="fullName" defaultValue={defaultValues?.fullName} required />
          </FormField>
          <FormField id="priority" label="Priority" hint="A deterministic default — set consciously, not auto-scored.">
            <Select id="priority" name="priority" defaultValue={defaultValues?.priority ?? "medium"}>
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="email" label="Email" hint="Email or phone is required.">
            <Input id="email" name="email" type="email" defaultValue={defaultValues?.email ?? ""} />
          </FormField>
          <FormField id="phone" label="Phone">
            <Input id="phone" name="phone" defaultValue={defaultValues?.phone ?? ""} />
          </FormField>
          <FormField id="source" label="Source">
            <Input id="source" name="source" defaultValue={defaultValues?.source ?? ""} placeholder="e.g. website, referral" />
          </FormField>
          <FormField id="campaign" label="Campaign">
            <Input id="campaign" name="campaign" defaultValue={defaultValues?.campaign ?? ""} />
          </FormField>
          {currentStage ? (
            <FormField id="stage" label="Stage">
              <Select id="stage" name="stage" defaultValue={currentStage}>
                {stageOptions.map((s) => (
                  <option key={s} value={s}>
                    {LEAD_STAGE_LABELS[s]}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : null}
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
          <FormField id="nextFollowUpDate" label="Next follow-up date">
            <Input id="nextFollowUpDate" name="nextFollowUpDate" type="date" defaultValue={defaultValues?.nextFollowUpDate ?? ""} />
          </FormField>
          <FormField id="lastContactDate" label="Last contact date">
            <Input id="lastContactDate" name="lastContactDate" type="date" defaultValue={defaultValues?.lastContactDate ?? ""} />
          </FormField>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <FormField id="utmSource" label="UTM source">
            <Input id="utmSource" name="utmSource" defaultValue={defaultValues?.utmSource ?? ""} />
          </FormField>
          <FormField id="utmMedium" label="UTM medium">
            <Input id="utmMedium" name="utmMedium" defaultValue={defaultValues?.utmMedium ?? ""} />
          </FormField>
          <FormField id="utmCampaign" label="UTM campaign">
            <Input id="utmCampaign" name="utmCampaign" defaultValue={defaultValues?.utmCampaign ?? ""} />
          </FormField>
        </div>
        <FormField id="landingPage" label="Landing page">
          <Input id="landingPage" name="landingPage" defaultValue={defaultValues?.landingPage ?? ""} />
        </FormField>

        <Checkbox
          id="consentMarketing"
          name="consentMarketing"
          defaultChecked={defaultValues?.consentMarketing ?? false}
          label="Consented to marketing contact"
        />

        <FormField id="notes" label="Notes" hint="Never shown to the lead. No real SMS/email/WhatsApp is sent from this form.">
          <Textarea id="notes" name="notes" defaultValue={defaultValues?.notes ?? ""} rows={3} />
        </FormField>
      </Card>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
