import Link from "next/link";
import { EXPLORER_JOURNEY_STEPS } from "@/lib/careers/explorer-journey";
import { FAMILY_TONE_CLASSES, type FamilyTone } from "@/lib/careers/family-presentation";
import { cn } from "@/lib/utils";

/**
 * UX10-C01 — the flat, numbered "1. Interests -> 2. Career -> 3. Courses ->
 * 4. Universities -> 5. Outcomes" strip under the filter bar. Every chip
 * is a real `<Link>` to a real, pre-existing public route (see
 * `src/lib/careers/explorer-journey.ts`) — clicking "3. Courses" actually
 * goes to `/courses`, not a decoration.
 *
 * Below `sm` this renders as a 3-column grid (row of 3, then the
 * remaining 2) instead of a single flex row. A single-row layout with
 * `overflow-x-auto` was tried first, but at a real 390px viewport the
 * five `basis-24` items (480px+ of minimum content) don't fit and the
 * Card's own padding clips the row right after item 3, leaving a bare
 * "4" peeking out with no visible scrollbar or affordance — confusing,
 * not a working scroll interaction. The grid keeps every step visible
 * and legible without needing to discover a horizontal scroll — found
 * and fixed during this milestone's own visual-QA pass at 390px.
 */
export function JourneyMiniMap() {
  return (
    <nav aria-label="Your career exploration journey" className="mt-6">
      <ol className="grid grid-cols-3 gap-x-2 gap-y-6 sm:flex sm:items-start sm:justify-between sm:gap-2">
        {EXPLORER_JOURNEY_STEPS.map((step, index) => {
          const tone = FAMILY_TONE_CLASSES[step.tone as FamilyTone];
          const Icon = step.icon;
          const isLast = index === EXPLORER_JOURNEY_STEPS.length - 1;
          return (
            <li key={step.id} className="flex items-start sm:flex-1 sm:shrink-0 sm:basis-0">
              <div className="flex w-full flex-col items-center text-center">
                <Link href={step.href} className="group flex flex-col items-center gap-2">
                  <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform duration-150 group-hover:-translate-y-0.5", tone.bg, tone.fg)}>
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-semibold text-text">
                    {step.order}. {step.label}
                  </span>
                  <span className="hidden text-xs text-muted sm:block">{step.blurb}</span>
                </Link>
              </div>
              {!isLast ? (
                <div aria-hidden="true" className="mt-5 hidden h-px flex-1 border-t-2 border-dotted border-border-strong sm:block" />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
