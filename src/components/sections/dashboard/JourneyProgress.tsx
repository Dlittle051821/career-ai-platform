import Link from "next/link";
import { CheckCircle2, Circle, Info } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import type { JourneyProgress as JourneyProgressData, JourneyStage } from "@/lib/dashboard/journey-progress";

const STATE_LABEL: Record<JourneyStage["state"], string> = {
  complete: "Complete",
  current: "Current step",
  upcoming: "Upcoming",
};

function StageIcon({ stage }: { stage: JourneyStage }) {
  if (stage.informational) {
    return <Info aria-hidden="true" className="h-5 w-5 text-muted" />;
  }
  if (stage.state === "complete") {
    return <CheckCircle2 aria-hidden="true" className="h-5 w-5 text-success" />;
  }
  if (stage.state === "current") {
    return (
      <span className="relative flex h-5 w-5 items-center justify-center">
        <span className="absolute h-5 w-5 rounded-full bg-primary/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-primary" />
      </span>
    );
  }
  return <Circle aria-hidden="true" className="h-5 w-5 text-border-strong" />;
}

/**
 * UX04 — dashboard "where am I now?" orientation. Renders the six
 * conceptual journey stages (Explore, Build Profile, Recommendations,
 * Saved Options, Decide, Apply) with their real, derived state — see
 * src/lib/dashboard/journey-progress.ts for exactly how each stage's
 * state is computed and why. This component only visualises that data;
 * it never invents its own completion logic or its own call-to-action —
 * "Your next step" (getNextBestAction) already owns the CTA on this page.
 *
 * Two layouts, same data: a horizontal connected stepper from `sm` up,
 * and a compact vertical list below it. No overall percentage is shown —
 * per spec, an aggregate "% through your journey" would imply a single
 * linear score this six-stage, partly-informational model doesn't
 * honestly have.
 */
export function JourneyProgress({ progress }: { progress: JourneyProgressData }) {
  return (
    <Card as="section" aria-label="Your journey" className="mt-6">
      <h2 className="text-lg font-semibold text-primary">Your journey</h2>
      <p className="mt-1 text-sm text-muted">Where you are today — explore in any order, at your own pace.</p>

      {/* Desktop / tablet: horizontal connected stepper */}
      <ol className="mt-6 hidden sm:flex sm:items-start">
        {progress.stages.map((stage, index) => (
          <li key={stage.key} className="flex flex-1 items-start last:flex-none">
            <Link
              href={stage.href}
              aria-current={stage.state === "current" ? "step" : undefined}
              className="group flex w-24 flex-col items-center gap-2 rounded-[var(--radius-control)] text-center focus-visible:outline-none"
            >
              <StageIcon stage={stage} />
              <span
                className={cn(
                  "text-xs font-medium leading-tight",
                  stage.state === "current" ? "text-primary" : stage.state === "complete" ? "text-text" : "text-muted"
                )}
              >
                {stage.label}
              </span>
              <span className="sr-only">
                {" "}
                — {stage.informational ? "Optional" : STATE_LABEL[stage.state]}. {stage.description}
              </span>
            </Link>
            {index < progress.stages.length - 1 ? (
              <div
                aria-hidden="true"
                className={cn("mt-2.5 h-px flex-1", stage.state === "complete" ? "bg-success/40" : "bg-border")}
              />
            ) : null}
          </li>
        ))}
      </ol>

      {/* Mobile: compact vertical list */}
      <ol className="mt-5 space-y-1 sm:hidden">
        {progress.stages.map((stage) => (
          <li key={stage.key}>
            <Link
              href={stage.href}
              aria-current={stage.state === "current" ? "step" : undefined}
              className="flex min-h-[44px] items-center gap-3 rounded-[var(--radius-control)] py-2 focus-visible:outline-none"
            >
              <StageIcon stage={stage} />
              <span className="flex-1">
                <span
                  className={cn(
                    "block text-sm font-medium",
                    stage.state === "current" ? "text-primary" : stage.state === "complete" ? "text-text" : "text-muted"
                  )}
                >
                  {stage.label}
                  {stage.informational ? <span className="ml-1.5 text-xs font-normal text-muted">(optional)</span> : null}
                </span>
                <span className="block text-xs text-muted">{stage.description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}
