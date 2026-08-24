"use client";

import { RATING_SCALE_LABELS, WORK_PREFERENCE_OPTIONS } from "@/data/profile-options";
import { LikertList } from "../LikertList";

interface WorkPreferencesStepProps {
  value: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
}

export function WorkPreferencesStep({ value, onChange }: WorkPreferencesStepProps) {
  function rate(key: string, rating: number) {
    onChange({ ...value, [key]: rating });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Rate how much each statement sounds like you, from 1 (strongly disagree) to 5 (strongly agree). Every
        statement starts at 3 (neutral) — adjust the ones that don&apos;t fit.
      </p>
      <LikertList options={WORK_PREFERENCE_OPTIONS} value={value} onRate={rate} scaleLabels={RATING_SCALE_LABELS} />
    </div>
  );
}
