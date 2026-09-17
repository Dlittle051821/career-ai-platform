import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { getApplicationProgressStages, isTerminalWithoutProgress, type ProgressStageState } from "@/lib/applications/application-lifecycle";
import type { ApplicationStage } from "@/types/admin";

const STATE_DOT_CLASSES: Record<ProgressStageState, string> = {
  complete: "border-success bg-success text-white",
  current: "border-secondary bg-secondary text-white",
  upcoming: "border-border-strong bg-surface text-muted",
};

const STATE_LABEL_CLASSES: Record<ProgressStageState, string> = {
  complete: "text-text font-medium",
  current: "text-primary font-semibold",
  upcoming: "text-muted",
};

/**
 * Milestone 16 — the honest, discrete application progress timeline (spec
 * §10): five fixed milestones (Started/Preparing/Submitted/Under
 * review/Decision), each rendered as complete/current/upcoming — never a
 * fabricated completion percentage. Status is never communicated by color
 * alone: every stage also carries a visually-hidden text label ("Complete"/
 * "Current step"/"Upcoming") for screen reader users and anyone who cannot
 * distinguish the dot colors. Stacks vertically at every breakpoint (a
 * horizontal timeline is the thing most prone to overflow at 375px), so
 * "mobile-working timeline" is the DEFAULT layout, not a special case.
 */
export function ApplicationTimeline({ stage }: { stage: ApplicationStage }) {
  if (isTerminalWithoutProgress(stage)) {
    return (
      <div role="status" className="rounded-[var(--radius-control)] border border-border-strong bg-surface-alt px-4 py-3 text-sm text-text-soft">
        This application was withdrawn. Its earlier progress is preserved in the history below, not shown on a forward-moving timeline.
      </div>
    );
  }

  const stages = getApplicationProgressStages(stage);

  return (
    <ol className="space-y-4">
      {stages.map((s, i) => (
        <li key={s.key} className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs", STATE_DOT_CLASSES[s.state])}
          >
            {s.state === "complete" ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </span>
          <div>
            <p className={cn("text-sm", STATE_LABEL_CLASSES[s.state])}>
              {s.label}
              <span className="sr-only">
                {" — "}
                {s.state === "complete" ? "complete" : s.state === "current" ? "current step" : "upcoming"}
              </span>
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
