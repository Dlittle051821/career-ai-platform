import Link from "next/link";
import { Search } from "lucide-react";
import { inputClasses, fieldBorder } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import type { Country } from "@/types/education";

const STUDY_MODE_OPTIONS = [
  { value: "on_campus", label: "On campus" },
  { value: "online", label: "Online" },
  { value: "hybrid", label: "Hybrid" },
];

interface UniversityFilterBarProps {
  query: string;
  countryIds: string[];
  city: string;
  studyModes: string[];
  countries: Country[];
}

/**
 * Same plain `method="get"` pattern as CareerFilterBar (see that file's
 * docblock) — works without JavaScript, every filter combination is a
 * shareable URL, and submitting resets back to page 1 since there's no
 * `page` field in this form. `country` and `studyMode` are repeatable
 * checkbox groups (both filters are `string[]` in UniversitySearchFilters),
 * unlike CareerFilterBar's single-select dropdowns.
 */
export function UniversityFilterBar({ query, countryIds, city, studyModes, countries }: UniversityFilterBarProps) {
  return (
    <form method="get" action="/universities" className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search university names"
            aria-label="Search universities"
            className={`${inputClasses} ${fieldBorder(undefined)} pl-10`}
          />
        </div>
        <input
          type="text"
          name="city"
          defaultValue={city}
          placeholder="City"
          aria-label="Filter by city"
          className={`${inputClasses} ${fieldBorder(undefined)}`}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
        <fieldset>
          <legend className="text-xs font-medium uppercase tracking-wide text-muted">Country</legend>
          <div className="mt-2 grid max-h-40 grid-cols-2 gap-x-4 gap-y-1.5 overflow-y-auto rounded-[var(--radius-control)] border border-border-strong p-3 sm:grid-cols-3">
            {countries.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm text-text-soft">
                <input
                  type="checkbox"
                  name="country"
                  value={c.id}
                  defaultChecked={countryIds.includes(c.id)}
                  className="h-4 w-4 shrink-0 rounded border-border-strong text-secondary accent-secondary"
                />
                {c.name}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-xs font-medium uppercase tracking-wide text-muted">Study mode</legend>
          <div className="mt-2 flex flex-col gap-1.5">
            {STUDY_MODE_OPTIONS.map((mode) => (
              <label key={mode.value} className="flex cursor-pointer items-center gap-2 text-sm text-text-soft">
                <input
                  type="checkbox"
                  name="studyMode"
                  value={mode.value}
                  defaultChecked={studyModes.includes(mode.value)}
                  className="h-4 w-4 shrink-0 rounded border-border-strong text-secondary accent-secondary"
                />
                {mode.label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit">Search</Button>
        <Link href="/universities" className="text-sm font-medium text-muted transition-colors hover:text-primary">
          Clear filters
        </Link>
      </div>
    </form>
  );
}
