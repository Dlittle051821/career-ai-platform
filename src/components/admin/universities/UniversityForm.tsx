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
import type { AccreditationStatus } from "@/types/admin";
import {
  EDUCATION_VERIFICATION_STATUSES,
  EDUCATION_VERIFICATION_STATUS_LABELS,
  UNIVERSITY_OWNERSHIP_TYPES,
  type University,
} from "@/types/education";

const INSTITUTION_TYPES = ["university", "college", "institute", "online_platform", "other"] as const;
const ACCREDITATION_OPTIONS: { value: AccreditationStatus; label: string }[] = [
  { value: "unverified", label: "Unverified" },
  { value: "self_reported", label: "Self-reported" },
  { value: "verified", label: "Verified" },
];

interface CountryOption {
  id: string;
  name: string;
  isoAlpha2: string;
}

export function UniversityForm({
  action,
  defaultValues,
  countryOptions,
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  defaultValues?: Partial<University>;
  countryOptions: CountryOption[];
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

      <Card className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-primary">Global data platform details</h2>
          <p className="mt-1 text-sm text-muted">
            Milestone 9 structured fields — power the public university/course search and data-quality reporting.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="countryId" label="Country" hint="Structured country — primary going forward; the legacy 'Country' text field above is kept for backward compat.">
            <Select id="countryId" name="countryId" defaultValue={defaultValues?.countryId ?? ""}>
              <option value="">— Not set —</option>
              {countryOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.isoAlpha2})
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="stateRegion" label="State / region">
            <Input id="stateRegion" name="stateRegion" defaultValue={defaultValues?.stateRegion ?? ""} />
          </FormField>
          <FormField id="streetAddress" label="Street address">
            <Input id="streetAddress" name="streetAddress" defaultValue={defaultValues?.streetAddress ?? ""} />
          </FormField>
          <FormField id="postalCode" label="Postal code">
            <Input id="postalCode" name="postalCode" defaultValue={defaultValues?.postalCode ?? ""} />
          </FormField>
          <FormField id="admissionsUrl" label="Admissions URL" hint="Must start with http:// or https://">
            <Input id="admissionsUrl" name="admissionsUrl" type="url" defaultValue={defaultValues?.admissionsUrl ?? ""} placeholder="https://" />
          </FormField>
          <FormField id="internationalAdmissionsUrl" label="International admissions URL" hint="Must start with http:// or https://">
            <Input
              id="internationalAdmissionsUrl"
              name="internationalAdmissionsUrl"
              type="url"
              defaultValue={defaultValues?.internationalAdmissionsUrl ?? ""}
              placeholder="https://"
            />
          </FormField>
          <FormField id="ownershipType" label="Ownership type">
            <Select id="ownershipType" name="ownershipType" defaultValue={defaultValues?.ownershipType ?? ""}>
              <option value="">— Not set —</option>
              {UNIVERSITY_OWNERSHIP_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="foundingYear" label="Founding year">
            <Input
              id="foundingYear"
              name="foundingYear"
              type="number"
              min={800}
              max={2100}
              defaultValue={defaultValues?.foundingYear ?? ""}
            />
          </FormField>
          <FormField id="accreditationOrganization" label="Accreditation organization">
            <Input id="accreditationOrganization" name="accreditationOrganization" defaultValue={defaultValues?.accreditationOrganization ?? ""} />
          </FormField>
          <FormField id="logoUrl" label="Logo URL" hint="Must start with http:// or https://">
            <Input id="logoUrl" name="logoUrl" type="url" defaultValue={defaultValues?.logoUrl ?? ""} placeholder="https://" />
          </FormField>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="studyLevels" label="Study levels" hint="Comma-separated, e.g. undergraduate, postgraduate">
            <Input id="studyLevels" name="studyLevels" defaultValue={(defaultValues?.studyLevels ?? []).join(", ")} />
          </FormField>
          <FormField id="studyModes" label="Study modes" hint="Comma-separated, e.g. on_campus, online, hybrid">
            <Input id="studyModes" name="studyModes" defaultValue={(defaultValues?.studyModes ?? []).join(", ")} />
          </FormField>
        </div>

        <FormField id="campusInfo" label="Campus info">
          <Textarea id="campusInfo" name="campusInfo" defaultValue={defaultValues?.campusInfo ?? ""} rows={3} />
        </FormField>

        <FormField id="internationalStudentSupport" label="International student support">
          <Textarea
            id="internationalStudentSupport"
            name="internationalStudentSupport"
            defaultValue={defaultValues?.internationalStudentSupport ?? ""}
            rows={3}
          />
        </FormField>

        <Checkbox
          id="scholarshipsAvailable"
          name="scholarshipsAvailable"
          defaultChecked={defaultValues?.scholarshipsAvailable ?? false}
          label="Scholarships available"
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="applicationFeeAmount" label="Application fee amount">
            <Input
              id="applicationFeeAmount"
              name="applicationFeeAmount"
              type="number"
              min={0}
              step="0.01"
              defaultValue={
                defaultValues?.applicationFeeMinorUnits != null ? (defaultValues.applicationFeeMinorUnits / 100).toString() : ""
              }
            />
          </FormField>
          <FormField id="applicationFeeCurrency" label="Application fee currency" hint="3-letter ISO 4217 code, e.g. EUR">
            <Input id="applicationFeeCurrency" name="applicationFeeCurrency" defaultValue={defaultValues?.applicationFeeCurrency ?? ""} maxLength={3} />
          </FormField>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="dataSource" label="Data source">
            <Input id="dataSource" name="dataSource" defaultValue={defaultValues?.dataSource ?? ""} />
          </FormField>
          <FormField id="sourceUrl" label="Source URL" hint="Must start with http:// or https://">
            <Input id="sourceUrl" name="sourceUrl" type="url" defaultValue={defaultValues?.sourceUrl ?? ""} placeholder="https://" />
          </FormField>
          <FormField id="lastVerifiedAt" label="Last verified at">
            <Input id="lastVerifiedAt" name="lastVerifiedAt" type="date" defaultValue={defaultValues?.lastVerifiedAt ?? ""} />
          </FormField>
          <FormField id="verificationStatus" label="Verification status">
            <Select id="verificationStatus" name="verificationStatus" defaultValue={defaultValues?.verificationStatus ?? "unverified"}>
              {EDUCATION_VERIFICATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {EDUCATION_VERIFICATION_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        {defaultValues?.sourceAccessDate ? (
          <p className="text-xs text-muted">
            Source access date (set automatically the first time a source URL is recorded): {defaultValues.sourceAccessDate}
          </p>
        ) : null}
      </Card>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
