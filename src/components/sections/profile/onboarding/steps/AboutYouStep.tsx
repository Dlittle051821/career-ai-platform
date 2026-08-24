"use client";

import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/forms/Input";
import { Select } from "@/components/forms/Select";
import { CURRENT_STATUS_OPTIONS, GENDER_OPTIONS } from "@/data/profile-options";
import type { AboutYouInput } from "@/lib/supabase/student-profile-actions";

interface AboutYouStepProps {
  value: AboutYouInput;
  onChange: (next: AboutYouInput) => void;
  errors: Record<string, string>;
}

export function AboutYouStep({ value, onChange, errors }: AboutYouStepProps) {
  function set<K extends keyof AboutYouInput>(key: K, next: AboutYouInput[K]) {
    onChange({ ...value, [key]: next });
  }

  return (
    <div className="space-y-5">
      <FormField id="about-current-status" label="Where are you right now?" required error={errors.currentStatus}>
        <Select
          id="about-current-status"
          value={value.currentStatus ?? ""}
          onChange={(e) => set("currentStatus", e.target.value || null)}
        >
          <option value="">Select one</option>
          {CURRENT_STATUS_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </Select>
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="about-dob" label="Date of birth" error={errors.dateOfBirth}>
          <Input
            id="about-dob"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={value.dateOfBirth ?? ""}
            onChange={(e) => set("dateOfBirth", e.target.value || null)}
            error={errors.dateOfBirth}
          />
        </FormField>

        <FormField id="about-gender" label="Gender">
          <Select id="about-gender" value={value.gender ?? ""} onChange={(e) => set("gender", e.target.value || null)}>
            <option value="">Prefer not to answer</option>
            {GENDER_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField id="about-city" label="City">
          <Input id="about-city" value={value.city ?? ""} onChange={(e) => set("city", e.target.value || null)} />
        </FormField>

        <FormField id="about-state" label="State">
          <Input id="about-state" value={value.state ?? ""} onChange={(e) => set("state", e.target.value || null)} />
        </FormField>

        <FormField id="about-country" label="Country">
          <Input id="about-country" value={value.country} onChange={(e) => set("country", e.target.value || "India")} />
        </FormField>

        <FormField id="about-language" label="Preferred language" hint="For future correspondence">
          <Input
            id="about-language"
            value={value.preferredLanguage ?? ""}
            onChange={(e) => set("preferredLanguage", e.target.value || null)}
          />
        </FormField>
      </div>
    </div>
  );
}
