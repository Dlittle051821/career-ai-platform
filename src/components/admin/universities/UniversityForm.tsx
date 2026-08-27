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
import type { AccreditationStatus, University } from "@/types/admin";

const INSTITUTION_TYPES = ["university", "college", "institute", "online_platform", "other"] as const;
const ACCREDITATION_OPTIONS: { value: AccreditationStatus; label: string }[] = [
  { value: "unverified", label: "Unverified" },
  { value: "self_reported", label: "Self-reported" },
  { value: "verified", label: "Verified" },
];

export function UniversityForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  defaultValues?: Partial<University>;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-6">
      <FormError error={state.error} />

      <Card className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="name" label="Name" required>
            <Input id="name" name="name" defaultValue={defaultValues?.name} required />
          </FormField>
          <FormField id="slug" label="Slug" required hint="Lowercase letters, numbers, single hyphens.">
            <Input id="slug" name="slug" defaultValue={defaultValues?.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" />
          </FormField>
          <FormField id="country" label="Country">
            <Input id="country" name="country" defaultValue={defaultValues?.country ?? ""} />
          </FormField>
          <FormField id="city" label="City">
            <Input id="city" name="city" defaultValue={defaultValues?.city ?? ""} />
          </FormField>
          <FormField id="website" label="Website" hint="Must start with http:// or https://">
            <Input id="website" name="website" type="url" defaultValue={defaultValues?.website ?? ""} placeholder="https://" />
          </FormField>
          <FormField id="institutionType" label="Institution type">
            <Select id="institutionType" name="institutionType" defaultValue={defaultValues?.institutionType ?? ""}>
              <option value="">— Not set —</option>
              {INSTITUTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <FormField id="summary" label="Summary">
          <Textarea id="summary" name="summary" defaultValue={defaultValues?.summary ?? ""} rows={3} />
        </FormField>

        <FormField
          id="accreditationStatus"
          label="Accreditation status"
          hint="Never mark 'Verified' unless you have supporting evidence on file — see docs/admin-system-guide.md §9."
        >
          <Select id="accreditationStatus" name="accreditationStatus" defaultValue={defaultValues?.accreditationStatus ?? "unverified"}>
            {ACCREDITATION_OPTIONS.map((o) => (
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
            label="Visible (reserved for future public display — see docs/admin-system-guide.md §9)"
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
