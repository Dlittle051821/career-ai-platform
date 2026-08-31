"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Scale, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Matches getCoursesByIds' default cap (src/lib/supabase/education/courses.ts) — the comparison page can never usefully hold more than this many courses, so the tray refuses to select a fifth. */
export const MAX_COMPARE_COURSES = 4;

interface SelectedCourse {
  id: string;
  name: string;
}

interface CompareContextValue {
  selected: SelectedCourse[];
  toggle: (course: SelectedCourse) => void;
  isSelected: (id: string) => boolean;
  isFull: boolean;
}

const CompareContext = createContext<CompareContextValue | null>(null);

/**
 * Client-only "compare tray" for the /courses results grid. Selection is
 * ordinary React state, deliberately not persisted anywhere (no
 * localStorage, no query string until the viewer actually clicks "Compare
 * selected") — it's fine for the selection to reset on a page reload, same
 * as a one-page shopping-cart-style selector. Wrap the results grid and
 * <CompareBar /> in one <CompareProvider> so every <CompareCheckbox />
 * inside shares the same selection.
 */
export function CompareProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<SelectedCourse[]>([]);

  const value = useMemo<CompareContextValue>(
    () => ({
      selected,
      isSelected: (id: string) => selected.some((c) => c.id === id),
      isFull: selected.length >= MAX_COMPARE_COURSES,
      toggle: (course: SelectedCourse) => {
        setSelected((prev) => {
          if (prev.some((c) => c.id === course.id)) return prev.filter((c) => c.id !== course.id);
          if (prev.length >= MAX_COMPARE_COURSES) return prev;
          return [...prev, course];
        });
      },
    }),
    [selected],
  );

  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}

function useCompare(): CompareContextValue {
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error("CompareCheckbox/CompareBar must be rendered within a CompareProvider");
  return ctx;
}

/** Small "Compare" checkbox rendered on each CourseCard. */
export function CompareCheckbox({ courseId, courseName }: { courseId: string; courseName: string }) {
  const { isSelected, toggle, isFull } = useCompare();
  const checked = isSelected(courseId);
  const disabled = !checked && isFull;

  return (
    <label className={cn("flex cursor-pointer items-center gap-1.5 text-xs font-medium text-text-soft", disabled && "cursor-not-allowed opacity-50")}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={() => toggle({ id: courseId, name: courseName })}
        aria-label={checked ? `Remove ${courseName} from comparison` : `Add ${courseName} to comparison`}
        className="h-4 w-4 shrink-0 rounded border-border-strong text-secondary accent-secondary"
      />
      Compare
    </label>
  );
}

/** Sticky bar summarizing the running selection, with a link to /courses/compare?ids=... once at least two courses are picked. */
export function CompareBar() {
  const { selected, toggle } = useCompare();
  if (selected.length === 0) return null;

  const canCompare = selected.length >= 2;
  const href = `/courses/compare?ids=${selected.map((c) => c.id).join(",")}`;

  return (
    <div className="sticky bottom-4 z-10 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border-strong bg-surface px-4 py-3 shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        <Scale aria-hidden="true" className="h-4 w-4 shrink-0 text-secondary-dark" />
        <span className="text-sm font-medium text-text-soft">
          {selected.length} course{selected.length === 1 ? "" : "s"} selected to compare
        </span>
        {selected.map((course) => (
          <button
            key={course.id}
            type="button"
            onClick={() => toggle(course)}
            className="inline-flex max-w-[12rem] items-center gap-1 truncate rounded-full border border-border-strong bg-surface-alt px-2.5 py-1 text-xs text-muted hover:text-error"
          >
            <X aria-hidden="true" className="h-3 w-3 shrink-0" />
            <span className="truncate">{course.name}</span>
          </button>
        ))}
      </div>
      {canCompare ? (
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-control)] bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary-light"
        >
          Compare selected ({selected.length})
        </Link>
      ) : (
        <span className="shrink-0 text-xs text-muted">Pick at least one more to compare</span>
      )}
    </div>
  );
}
