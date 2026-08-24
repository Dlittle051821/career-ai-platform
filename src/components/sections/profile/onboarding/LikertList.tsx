"use client";

import type { OptionDef } from "@/data/profile-options";
import { RatingButtons } from "./RatingButtons";

interface LikertListProps {
  options: OptionDef[];
  value: Record<string, number>;
  onRate: (key: string, rating: number) => void;
  scaleLabels?: Record<number, string>;
  disabled?: boolean;
}

const DEFAULT_RATING = 3;

/**
 * Fixed statement list where every item always shows a rating (unlike
 * SelectableRatingList, there's no select/deselect step) — used for Work
 * Preferences. Defaults every statement to 3/"Neutral" so a student who
 * clicks Continue without touching anything still gets a complete, if
 * neutral, answer rather than missing data.
 */
export function LikertList({ options, value, onRate, scaleLabels, disabled }: LikertListProps) {
  return (
    <div className="space-y-3">
      {options.map((option) => (
        <div
          key={option.key}
          className="flex flex-col gap-3 rounded-[var(--radius-control)] border border-border-strong bg-surface p-3.5 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm font-medium text-text">{option.label}</p>
          <RatingButtons
            value={value[option.key] ?? DEFAULT_RATING}
            onChange={(rating) => onRate(option.key, rating)}
            labels={scaleLabels}
            ariaLabel={option.label}
            disabled={disabled}
          />
        </div>
      ))}
    </div>
  );
}

export { DEFAULT_RATING };
