"use client";

import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/forms/Input";
import { INTEREST_OPTIONS, INTEREST_STRENGTH_LABELS } from "@/data/profile-options";
import { SelectableRatingList } from "../SelectableRatingList";

interface InterestsStepProps {
  value: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
  otherText: string;
  onOtherTextChange: (next: string) => void;
}

const MINIMUM = 3;

export function InterestsStep({ value, onChange, otherText, onOtherTextChange }: InterestsStepProps) {
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
        This isn&apos;t a career recommendation yet — just what genuinely interests you. Select as many as apply and
        rate your interest 1–5. Choose at least {MINIMUM}.{" "}
        <span className={count >= MINIMUM ? "font-medium text-success" : "font-medium text-muted"}>
          {count} selected
        </span>
      </p>
      <SelectableRatingList
        options={INTEREST_OPTIONS}
        value={value}
        onToggle={toggle}
        onRate={rate}
        ratingLabels={INTEREST_STRENGTH_LABELS}
      />
      {"other" in value ? (
        <FormField id="interests-other-text" label="Tell us more about your other interest" hint="Optional">
          <Input id="interests-other-text" value={otherText} onChange={(e) => onOtherTextChange(e.target.value)} />
        </FormField>
      ) : null}
    </div>
  );
}
