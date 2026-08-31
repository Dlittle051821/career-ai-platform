import Link from "next/link";
import { Search } from "lucide-react";
import { inputClasses, fieldBorder } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { CANONICAL_DEGREE_LEVELS, DEGREE_LEVEL_LABELS } from "@/lib/education/external-search/taxonomy";
import type { Country } from "@/types/education";

const STUDY_MODE_OPTIONS = [
  { value: "on_campus", label: "On campus" },
  { value: "online", label: "Online" },
  { value: "hybrid", label: "Hybrid" },
];

const DURATION_UNIT_OPTIONS = [
  { value: "years", label: "Years" },
  { value: "months", label: "Months" },
  { value: "weeks", label: "Weeks" },
];

interface CourseFilterBarProps {
  query: string;
  countryIds: string[];
  universityId: string;
  subjectArea: string;
  qualificationLevel: string;
  studyModes: string[];
  teachingLanguage: string;
  currency: string;
  minTuition: string;
  maxTuition: string;
  durationUnit: string;
  intakePeriod: string;
  scholarshipsAvailable: boolean;
  countries: Country[];
  /** Trusted Global Course Search — destination country ISO alpha-2 code, free-text taxonomy-normalized subject, and canonical degree level. Deliberately separate from countryIds/subjectArea/qualificationLevel above (which drive the internal-catalogue filters only): destination/subject/degree also drive the "Trusted external search" section, and destination must be a single ISO code (not a university-country uuid) for that lookup. */
  destination: string;
  subject: string;
  degree: string;
}

/**
 * Same plain `method="get"` philosophy as UniversityFilterBar (see that
 * file's docblock) — works without JavaScript, every filter combination is
 * a shareable URL, and submitting resets back to page 1. `universityId`
 * (set via the University detail page's "View courses" link) is carried
 * through as a hidden field so it survives every other filter change,
 * with an explicit "Clear" link since there's no picker UI for it here.
 * `subjectArea`, `qualificationLevel`, and `teachingLanguage` are free-text
 * fields — unlike `country`/`studyMode` there is no fixed enum for these in
 * the schema (see courses.ts's PublicCourseRow), so a checkbox list isn't
 * possible; CourseSearchFilters still accepts them as repeatable params,
 * this form just only ever submits at most one value each.
 */
export function CourseFilterBar({
  query,
  countryIds,
  universityId,
  subjectArea,
  qualificationLevel,
  studyModes,
  teachingLanguage,
  currency,
  minTuition,
  maxTuition,
  durationUnit,
  intakePeriod,
  scholarshipsAvailable,
  countries,
  destination,
  subject,
  degree,
}: CourseFilterBarProps) {
  return (
    <form method="get" action="/courses" className="space-y-5">
      <fieldset className="rounded-[var(--radius-control)] border border-border-strong p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-secondary-dark">
          Find a trusted official portal
        </legend>
        <p className="mb-3 text-xs text-muted">
          Destination, subject, and degree level here also power the &quot;Trusted external search&quot; result below —
          a link straight to the official government/institutional course-search portal for your destination.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="destination" className="mb-1 block text-xs font-medium text-muted">
              Destination country
            </label>
            <select
              id="destination"
              name="destination"
              defaultValue={destination}
              className={`${inputClasses} ${fieldBorder(undefined)}`}
            >
              <option value="">Any destination</option>
              {countries.map((c) => (
                <option key={c.id} value={c.isoAlpha2}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="subject" className="mb-1 block text-xs font-medium text-muted">
              Subject or discipline
            </label>
            <input
              id="subject"
              type="text"
              name="subject"
              defaultValue={subject}
              placeholder="e.g. Mechanical Engineering"
              className={`${inputClasses} ${fieldBorder(undefined)}`}
            />
          </div>
          <div>
            <label htmlFor="degree" className="mb-1 block text-xs font-medium text-muted">
              Degree level
            </label>
            <select id="degree" name="degree" defaultValue={degree} className={`${inputClasses} ${fieldBorder(undefined)}`}>
              <option value="">Any degree level</option>
              {CANONICAL_DEGREE_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {DEGREE_LEVEL_LABELS[level]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      {universityId ? (
        <div className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-border-strong bg-surface-alt px-3.5 py-2.5 text-sm text-text-soft">
          <input type="hidden" name="universityId" value={universityId} />
          <span>Showing courses from one university</span>
          <Link href="/courses" className="font-semibold text-secondary-dark hover:text-primary">
            Clear
          </Link>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search course names"
            aria-label="Search courses"
            className={`${inputClasses} ${fieldBorder(undefined)} pl-10`}
          />
        </div>
        <input
          type="text"
          name="intakePeriod"
          defaultValue={intakePeriod}
          placeholder="Intake period (e.g. Fall 2026)"
          aria-label="Filter by intake period"
          className={`${inputClasses} ${fieldBorder(undefined)}`}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <input
          type="text"
          name="subjectArea"
          defaultValue={subjectArea}
          placeholder="Subject area"
          aria-label="Filter by subject area"
          className={`${inputClasses} ${fieldBorder(undefined)}`}
        />
        <input
          type="text"
          name="qualificationLevel"
          defaultValue={qualificationLevel}
          placeholder="Qualification level"
          aria-label="Filter by qualification level"
          className={`${inputClasses} ${fieldBorder(undefined)}`}
        />
        <input
          type="text"
          name="teachingLanguage"
          defaultValue={teachingLanguage}
          placeholder="Teaching language"
          aria-label="Filter by teaching language"
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

      <div className="grid gap-3 sm:grid-cols-5">
        <input
          type="text"
          name="currency"
          defaultValue={currency}
          placeholder="Currency (e.g. USD)"
          maxLength={3}
          aria-label="Filter by tuition currency code"
          className={`${inputClasses} ${fieldBorder(undefined)}`}
        />
        <input
          type="number"
          min={0}
          name="minTuition"
          defaultValue={minTuition}
          placeholder="Min tuition"
          aria-label="Minimum tuition, in the currency's smallest unit (e.g. cents or paise)"
          className={`${inputClasses} ${fieldBorder(undefined)}`}
        />
        <input
          type="number"
          min={0}
          name="maxTuition"
          defaultValue={maxTuition}
          placeholder="Max tuition"
          aria-label="Maximum tuition, in the currency's smallest unit (e.g. cents or paise)"
          className={`${inputClasses} ${fieldBorder(undefined)}`}
        />
        <select
          name="durationUnit"
          defaultValue={durationUnit}
          aria-label="Filter by duration unit"
          className={`${inputClasses} ${fieldBorder(undefined)}`}
        >
          <option value="">Any duration unit</option>
          {DURATION_UNIT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-text-soft">
          <input
            type="checkbox"
            name="scholarshipsAvailable"
            value="true"
            defaultChecked={scholarshipsAvailable}
            className="h-4 w-4 shrink-0 rounded border-border-strong text-secondary accent-secondary"
          />
          Scholarships only
        </label>
      </div>
      <p className="text-xs text-muted">Min/max tuition are compared in the currency&apos;s smallest unit (e.g. cents or paise) — pair with the currency filter above for a meaningful range.</p>

      <div className="flex items-center gap-3">
        <Button type="submit">Search</Button>
        <Link href="/courses" className="text-sm font-medium text-muted transition-colors hover:text-primary">
          Clear filters
        </Link>
      </div>
    </form>
  );
}
