"use client";

import { COUNTRY_OPTIONS } from "@/data/profile-options";
import type { StudyPreferencesInput } from "@/lib/supabase/student-profile-actions";
import { ChipToggleGroup, YesNoMaybeToggle } from "../ChipToggleGroup";

interface StudyLocationStepProps {
  value: StudyPreferencesInput;
  onChange: (next: StudyPreferencesInput) => void;
}

export function StudyLocationStep({ value, onChange }: StudyLocationStepProps) {
  function set<K extends keyof StudyPreferencesInput>(key: K, next: StudyPreferencesInput[K]) {
    onChange({ ...value, [key]: next });
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2.5 text-sm font-medium text-text">Are you willing to study further?</p>
        <YesNoMaybeToggle value={value.studyFurther} onChange={(v) => set("studyFurther", v)} ariaLabel="Willing to study further" />
      </div>

      <div>
        <p className="mb-2.5 text-sm font-medium text-text">Interested in studying abroad?</p>
        <YesNoMaybeToggle value={value.studyAbroad} onChange={(v) => set("studyAbroad", v)} ariaLabel="Interested in studying abroad" />
      </div>

      <div>
        <p className="mb-2.5 text-sm font-medium text-text">Preferred study destinations</p>
        <ChipToggleGroup
          options={COUNTRY_OPTIONS}
          value={value.preferredStudyDestinations}
          onChange={(v) => set("preferredStudyDestinations", v)}
          ariaLabel="Preferred study destinations"
        />
      </div>

      <div>
        <p className="mb-2.5 text-sm font-medium text-text">Preferred work destinations</p>
        <ChipToggleGroup
          options={COUNTRY_OPTIONS}
          value={value.preferredWorkDestinations}
          onChange={(v) => set("preferredWorkDestinations", v)}
          ariaLabel="Preferred work destinations"
        />
      </div>

      <div>
        <p className="mb-2.5 text-sm font-medium text-text">Willing to relocate within India?</p>
        <YesNoMaybeToggle
          value={value.relocateWithinIndia}
          onChange={(v) => set("relocateWithinIndia", v)}
          ariaLabel="Willing to relocate within India"
        />
      </div>

      <div>
        <p className="mb-2.5 text-sm font-medium text-text">Willing to relocate internationally?</p>
        <YesNoMaybeToggle
          value={value.relocateInternational}
          onChange={(v) => set("relocateInternational", v)}
          ariaLabel="Willing to relocate internationally"
        />
      </div>
    </div>
  );
}
