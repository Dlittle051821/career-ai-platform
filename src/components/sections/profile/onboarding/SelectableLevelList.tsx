"use client";

import { Check } from "lucide-react";
import type { OptionDef } from "@/data/profile-options";
import { SKILL_LEVEL_OPTIONS } from "@/data/profile-options";
import { cn } from "@/lib/utils";

interface SelectableLevelListProps {
  options: OptionDef[];
  value: Record<string, string>;
  onToggle: (key: string) => void;
  onSetLevel: (key: string, level: string) => void;
  disabled?: boolean;
}

/** Same select-then-detail pattern as SelectableRatingList, but for skills: level is beginner/intermediate/advanced instead of a 1–5 rating. */
export function SelectableLevelList({ options, value, onToggle, onSetLevel, disabled }: SelectableLevelListProps) {
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
              <div role="radiogroup" aria-label={`Level for ${option.label}`} className="mt-3 flex gap-2 pl-[1.875rem]">
                {SKILL_LEVEL_OPTIONS.map((level) => (
                  <button
                    key={level.key}
                    type="button"
                    role="radio"
                    aria-checked={value[option.key] === level.key}
                    disabled={disabled}
                    onClick={() => onSetLevel(option.key, level.key)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                      value[option.key] === level.key
                        ? "border-secondary bg-secondary text-white"
                        : "border-border-strong bg-surface text-text-soft hover:border-secondary hover:text-secondary-dark"
                    )}
                  >
                    {level.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
