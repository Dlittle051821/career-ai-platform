"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/forms/Input";
import { Select } from "@/components/forms/Select";
import { Checkbox } from "@/components/forms/Checkbox";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { FormError } from "@/components/admin/FormError";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/admin/form-state";
import type { Campus } from "@/types/education";

interface CountryOption {
  id: string;
  name: string;
  isoAlpha2: string;
}

/**
 * Shared by the inline "Add campus" form on the university detail page and
 * the standalone campus edit page — same fields, same FormData shape read
 * by parseCampusForm in src/lib/supabase/admin/education-campuses.ts.
 *
 * `isActive` needs a hidden fallback: parseCampusForm treats a MISSING field
 * as active (`!== "off"`), so an unchecked plain checkbox (which submits
 * nothing at all) would silently save as active. Putting the checkbox
 * before a same-named hidden "off" input relies on FormData.get returning
 * the FIRST value for a repeated name — checked sends ["on","off"] (get ->
 * "on"), unchecked sends only ["off"] (get -> "off").
 */
export function CampusForm({
  action,
  universityId,
  countryOptions,
  defaultValues,
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  universityId: string;
  countryOptions: CountryOption[];
  defaultValues?: Partial<Campus>;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="universityId" value={universityId} />
      <FormError error={state.error} />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="campus-name" label="Name" required>
          <Input id="campus-name" name="name" defaultValue={defaultValues?.name} required />
        </FormField>
        <FormField id="campus-countryId" label="Country">
          <Select id="campus-countryId" name="countryId" defaultValue={defaultValues?.countryId ?? ""}>
            <option value="">— Not set —</option>
            {countryOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.isoAlpha2})
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="campus-stateRegion" label="State / region">
          <Input id="campus-stateRegion" name="stateRegion" defaultValue={defaultValues?.stateRegion ?? ""} />
        </FormField>
        <FormField id="campus-city" label="City">
          <Input id="campus-city" name="city" defaultValue={defaultValues?.city ?? ""} />
        </FormField>
        <FormField id="campus-address" label="Address">
          <Input id="campus-address" name="address" defaultValue={defaultValues?.address ?? ""} />
        </FormField>
        <FormField id="campus-latitude" label="Latitude" hint="-90 to 90">
          <Input id="campus-latitude" name="latitude" type="number" step="any" min={-90} max={90} defaultValue={defaultValues?.latitude ?? ""} />
        </FormField>
        <FormField id="campus-longitude" label="Longitude" hint="-180 to 180">
          <Input
            id="campus-longitude"
            name="longitude"
            type="number"
            step="any"
            min={-180}
            max={180}
            defaultValue={defaultValues?.longitude ?? ""}
          />
        </FormField>
      </div>

      <div className="flex flex-wrap gap-6">
        <Checkbox id="campus-isMain" name="isMain" defaultChecked={defaultValues?.isMain ?? false} label="Main campus" />
        <div>
          <Checkbox id="campus-isActive" name="isActive" defaultChecked={defaultValues?.isActive ?? true} label="Active" />
          <input type="hidden" name="isActive" value="off" />
        </div>
      </div>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
