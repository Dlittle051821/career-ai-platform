"use client";

import type { OptionDef } from "@/data/profile-options";
import { cn } from "@/lib/utils";

interface ChipToggleGroupProps {
  options: OptionDef[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  ariaLabel: string;
}

/** Plain multi-select chip list — no rating attached. Used for destination countries. */
export function ChipToggleGroup({ options, value, onChange, disabled, ariaLabel }: ChipToggleGroupProps) {
  function toggle(key: string) {
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
  }

  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = value.includes(option.key);
        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => toggle(option.key)}
            className={cn(
              "rounded-full border px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              selected
                ? "border-secondary bg-secondary text-white"
                : "border-border-strong bg-surface text-text-soft hover:border-secondary hover:text-secondary-dark"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

interface YesNoMaybeToggleProps {
  value: string | null;
  onChange: (value: string) => void;
  ariaLabel: string;
  disabled?: boolean;
}

const YES_NO_MAYBE = [
  { key: "yes", label: "Yes" },
  { key: "no", label: "No" },
  { key: "maybe", label: "Maybe" },
];

/** Three-way Yes / No / Maybe control used across Study & Location and Budget & Funding. */
export function YesNoMaybeToggle({ value, onChange, ariaLabel, disabled }: YesNoMaybeToggleProps) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex gap-2">
      {YES_NO_MAYBE.map((option) => (
        <button
          key={option.key}
          type="button"
          role="radio"
          aria-checked={value === option.key}
          disabled={disabled}
          onClick={() => onChange(option.key)}
          className={cn(
            "min-w-[4.5rem] rounded-[var(--radius-control)] border px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            value === option.key
              ? "border-secondary bg-secondary text-white"
              : "border-border-strong bg-surface text-text-soft hover:border-secondary hover:text-secondary-dark"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
