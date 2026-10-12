import { Apple, BadgeCheck, Bookmark, Compass, Scale, Send, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { JourneyProgress, JourneyStageKey } from "@/lib/dashboard/journey-progress";
import { cn } from "@/lib/utils";

/**
 * UX10-D01 — "Your Nextwise Journey" tracker.
 *
 * Renders the REAL six stages this product already computes
 * (`computeJourneyProgress`, src/lib/dashboard/journey-progress.ts):
 * Explore / Build Profile / Recommendations / Saved Options / Decide /
 * Apply — not the reference mockup's own example labels (Profile /
 * Discovery / Recommendations / Shortlist / Applications / Decision),
 * per this milestone's explicit "map to existing data, don't hardcode
 * the mockup's stage values" instruction. Only the horizontal
 * circle-and-line visual treatment is taken from the reference; every
 * label, state, and description is the real computed value.
 */

const STAGE_ICONS: Record<JourneyStageKey, LucideIcon> = {
  explore: Compass,
  build_profile: UserRound,
  recommendations: Apple,
  saved_options: Bookmark,
  decide: Scale,
  apply: Send,
};

export function JourneyTracker({ progress }: { progress: JourneyProgress }) {
  const { stages } = progress;

  return (
    <section aria-labelledby="journey-heading" className="rounded-[1.5rem] border border-border bg-surface p-5 shadow-soft sm:p-7">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-intelligence-light text-intelligence-strong">
          <UserRound aria-hidden="true" className="h-5 w-5" />
        </span>
        <div>
          <h2 id="journey-heading" className="font-sans text-lg font-semibold text-text">
            Your Nextwise Journey
          </h2>
          <p className="mt-0.5 text-sm text-muted">Track your progress from exploration to your global future.</p>
        </div>
      </div>

      {/* Six stages don't fit at 390px without either shrinking labels
          below legibility or scrolling — a horizontal, snap-scrolling
          strip (with a trailing spacer so the last item lands clear of
          the card edge, never mid-word, plus a fade hint on the right
          edge) keeps every stage reachable rather than silently
          truncating the journey with no indication there's more. */}
      <div className="relative mt-6">
        <ol className="flex snap-x snap-mandatory gap-6 overflow-x-auto pb-1 sm:gap-0 sm:overflow-visible sm:snap-none">
          {stages.map((stage, index) => {
            const Icon = STAGE_ICONS[stage.key];
            const isLast = index === stages.length - 1;
            return (
              <li key={stage.key} className="flex flex-1 shrink-0 basis-28 snap-start flex-col items-center text-center sm:basis-0">
                <div className="flex w-full items-center">
                  <span className={cn("h-px flex-1", index === 0 ? "opacity-0" : stage.state === "upcoming" ? "bg-border-strong" : "bg-primary/40")} aria-hidden="true" />
                  <Link
                    href={stage.href}
                    className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                      stage.state === "complete" && "border-success bg-success-light text-success",
                      stage.state === "current" && "border-primary bg-primary text-on-primary shadow-[0_0_0_6px_rgba(37,99,235,0.12)]",
                      stage.state === "upcoming" && "border-border-strong bg-surface-alt text-muted"
                    )}
                    aria-current={stage.state === "current" ? "step" : undefined}
                  >
                    {stage.state === "complete" ? <BadgeCheck aria-hidden="true" className="h-5 w-5" /> : <Icon aria-hidden="true" className="h-5 w-5" />}
                  </Link>
                  <span className={cn("h-px flex-1", isLast ? "opacity-0" : stage.state === "upcoming" ? "bg-border-strong" : "bg-primary/40")} aria-hidden="true" />
                </div>
                <p className="mt-2 font-sans text-sm font-semibold text-text">{stage.label}</p>
                <p
                  className={cn(
                    "text-xs font-medium",
                    stage.state === "complete" && "text-success",
                    stage.state === "current" && "text-primary",
                    stage.state === "upcoming" && "text-muted"
                  )}
                >
                  {stage.state === "complete" ? "Complete" : stage.state === "current" ? "In progress" : stage.informational ? "Coming soon" : "Upcoming"}
                </p>
              </li>
            );
          })}
          {/* trailing spacer so the last stage can snap fully into view, clear of the card's edge, instead of being cut off mid-label */}
          <li aria-hidden="true" className="shrink-0 basis-4 sm:hidden" />
        </ol>
        {/* right-edge fade — a visual hint that the strip scrolls, so a
            partially-visible next stage reads as "swipe for more" rather
            than looking like clipped/broken content */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-surface to-transparent sm:hidden" />
      </div>
    </section>
  );
}
