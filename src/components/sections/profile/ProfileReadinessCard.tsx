import { Gauge } from "lucide-react";
import type { CompletionResult } from "@/types/student-profile";
import type { OnboardingDraftState } from "./onboarding/onboarding-types";
import { computeSectionProgress } from "@/lib/profile/section-progress";
import { cn } from "@/lib/utils";

function barTone(percent: number): string {
  if (percent >= 80) return "bg-success";
  if (percent >= 50) return "bg-primary";
  if (percent >= 20) return "bg-secondary";
  if (percent > 0) return "bg-accent";
  return "bg-border-strong";
}

/**
 * UX10-P01 — right column, card 2. The reference mockup shows seven
 * example sections with example percentages (100/70/40/20/0/0/10) — the
 * brief is explicit those are illustrative only. This renders the real 11
 * profile sections with a real, granular per-section percentage computed
 * by `computeSectionProgress()` (src/lib/profile/section-progress.ts),
 * which is itself built from `calculateCompletion()`'s own real section
 * data and real thresholds — never a second, hardcoded set of numbers.
 * Reads the wizard's live `draft` (not a static snapshot) so it updates
 * immediately as the student edits, in step with the completion ring.
 */
export function ProfileReadinessCard({ draft, completion }: { draft: OnboardingDraftState; completion: CompletionResult }) {
  const progress = computeSectionProgress(draft, completion);

  return (
    <section aria-labelledby="profile-readiness-heading" className="rounded-[1.5rem] border border-border bg-surface p-5 shadow-soft sm:p-6">
      <div className="flex items-center gap-2.5">
        <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-intelligence-light text-intelligence-strong">
          <Gauge aria-hidden="true" className="h-4 w-4" />
        </span>
        <h2 id="profile-readiness-heading" className="font-sans text-base font-semibold text-text">
          Profile Readiness
        </h2>
      </div>

      <ul className="mt-4 space-y-3">
        {progress.map((section) => (
          <li key={section.key}>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-text-soft">{section.label}</span>
              <span className={cn("font-semibold", section.complete ? "text-success" : "text-muted")}>{section.percent}%</span>
            </div>
            <div
              role="progressbar"
              aria-label={`${section.label} readiness`}
              aria-valuenow={section.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-alt"
            >
              <div className={cn("h-full rounded-full transition-all duration-300", barTone(section.percent))} style={{ width: `${section.percent}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
