"use client";

import { Check } from "lucide-react";
import type { OptionDef } from "@/data/profile-options";
import { cn } from "@/lib/utils";
import { RatingButtons } from "./RatingButtons";

interface SelectableRatingListProps {
  options: OptionDef[];
  value: Record<string, number>;
  onToggle: (key: string) => void;
  onRate: (key: string, rating: number) => void;
  ratingLabels?: Record<number, string>;
  disabled?: boolean;
}

/**
 * "Pick the ones that apply, then rate each 1–5" pattern — used for
 * Subject Strengths, Interests, and Career Priorities. Selecting a chip
 * reveals its rating control (default 3, "comfortable"/"neutral" middle
 * value) so a student never accidentally submits a rating for something
 * they never chose.
 */
export function SelectableRatingList({
  options,
  value,
  onToggle,
  onRate,
  ratingLabels,
  disabled,
}: SelectableRatingListProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {options.map((option) => {
        const selected = option.key in value;
        return (
          <div
            key={option.key}
            className={cn(
              "rounded-[var(--radius-control)] border p-3.5 transition-colors",
              selected ? "border-secondary/40 bg-secondary-light/40" : "border-border-strong bg-surface"
            )}
          >
            <button
              type="button"
              onClick={() => onToggle(option.key)}
              disabled={disabled}
              aria-pressed={selected}
              className="flex w-full items-center gap-2.5 text-left disabled:cursor-not-allowed"
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                  selected ? "border-secondary bg-secondary text-white" : "border-border-strong bg-surface"
                )}
                aria-hidden="true"
              >
                {selected ? <Check className="h-3.5 w-3.5" /> : null}
              </span>
              <span className="text-sm font-medium text-text">{option.label}</span>
            </button>
            {selected ? (
              <div className="mt-3 pl-[1.875rem]">
                <RatingButtons
                  value={value[option.key]}
                  onChange={(rating) => onRate(option.key, rating)}
                  labels={ratingLabels}
                  ariaLabel={`Rate ${option.label}`}
                  disabled={disabled}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
