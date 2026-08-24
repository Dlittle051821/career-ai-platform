"use client";

import { SUBJECT_OPTIONS, SUBJECT_RATING_LABELS } from "@/data/profile-options";
import { SelectableRatingList } from "../SelectableRatingList";

interface SubjectStrengthsStepProps {
  value: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
}

const MINIMUM = 3;

export function SubjectStrengthsStep({ value, onChange }: SubjectStrengthsStepProps) {
  function toggle(key: string) {
    const next = { ...value };
    if (key in next) delete next[key];
    else next[key] = 3;
    onChange(next);
  }

  function rate(key: string, rating: number) {
    onChange({ ...value, [key]: rating });
  }

  const count = Object.keys(value).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Select the subjects you&apos;ve studied and rate how comfortable you are with each, from 1 (weak/dislike) to 5
        (very strong/enjoy). Choose at least {MINIMUM}.{" "}
        <span className={count >= MINIMUM ? "font-medium text-success" : "font-medium text-muted"}>
          {count} selected
        </span>
      </p>
      <SelectableRatingList
        options={SUBJECT_OPTIONS}
        value={value}
        onToggle={toggle}
        onRate={rate}
        ratingLabels={SUBJECT_RATING_LABELS}
      />
    </div>
  );
}
