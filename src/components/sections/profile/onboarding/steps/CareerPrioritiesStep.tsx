"use client";

import { CAREER_PRIORITY_OPTIONS } from "@/data/profile-options";
import { SelectableRatingList } from "../SelectableRatingList";

interface CareerPrioritiesStepProps {
  value: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
}

const MINIMUM = 5;
const IMPORTANCE_LABELS: Record<number, string> = {
  1: "Not important",
  2: "Slightly important",
  3: "Important",
  4: "Very important",
  5: "Essential",
};

export function CareerPrioritiesStep({ value, onChange }: CareerPrioritiesStepProps) {
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
        What matters most to you in a future career? Choose your top priorities — at least {MINIMUM} — and rate how
        important each one is.{" "}
        <span className={count >= MINIMUM ? "font-medium text-success" : "font-medium text-muted"}>
          {count} selected
        </span>
      </p>
      <SelectableRatingList
        options={CAREER_PRIORITY_OPTIONS}
        value={value}
        onToggle={toggle}
        onRate={rate}
        ratingLabels={IMPORTANCE_LABELS}
      />
    </div>
  );
}
