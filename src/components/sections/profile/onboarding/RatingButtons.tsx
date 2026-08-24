"use client";

import { cn } from "@/lib/utils";

interface RatingButtonsProps {
  value: number | null;
  onChange: (rating: number) => void;
  labels?: Record<number, string>;
  ariaLabel: string;
  disabled?: boolean;
}

/**
 * Touch-friendly 1–5 rating control, used everywhere the profile collects a
 * strength/agreement rating (subjects, interests, work preferences, career
 * priorities). Reused instead of a native `<input type="range">` because a
 * row of five discrete, individually-labelled buttons is easier to tap
 * accurately on a phone and easier to read for screen readers than a slider.
 */
export function RatingButtons({ value, onChange, labels, ariaLabel, disabled }: RatingButtonsProps) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={labels?.[n] ? `${n} — ${labels[n]}` : `${n}`}
          title={labels?.[n]}
          disabled={disabled}
          onClick={() => onChange(n)}
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            value === n
              ? "border-secondary bg-secondary text-white"
              : "border-border-strong bg-surface text-text-soft hover:border-secondary hover:text-secondary-dark"
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
