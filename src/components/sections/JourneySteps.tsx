import { Check, Users } from "lucide-react";
import type { JourneyStage } from "@/types";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

interface JourneyStepsProps {
  stages: JourneyStage[];
  variant?: "compact" | "detailed";
}

/**
 * Renders the career-first journey as a responsive vertical/grid sequence.
 * `compact` is used on the Home page; `detailed` powers How It Works with
 * free-vs-paid breakdowns and parent involvement notes.
 */
export function JourneySteps({ stages, variant = "compact" }: JourneyStepsProps) {
  if (variant === "compact") {
    return (
      <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {stages.map((stage) => (
          <li key={stage.id}>
            <Card className="h-full">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary-light text-sm font-semibold text-secondary-dark">
                {stage.order}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-primary">{stage.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{stage.summary}</p>
            </Card>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <ol className="space-y-5">
      {stages.map((stage, index) => (
        <li key={stage.id} className="relative">
          <Card className="sm:pl-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:gap-8">
              <div className="flex shrink-0 items-start gap-3 sm:w-56">
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                    "bg-primary text-on-primary"
                  )}
                >
                  {stage.order}
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-primary">{stage.title}</h3>
                  <p className="mt-1 text-sm text-muted">{stage.summary}</p>
                </div>
              </div>

              <div className="grid flex-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-secondary-dark">Available free</p>
                  <ul className="mt-2 space-y-1.5">
                    {stage.freeSupport.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-text-soft">
                        <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-accent-dark">With paid support</p>
                  <ul className="mt-2 space-y-1.5">
                    {stage.paidSupport.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-text-soft">
                        <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            {stage.parentInvolvement ? (
              <p className="mt-4 flex items-start gap-2 rounded-[var(--radius-control)] bg-surface-alt px-3 py-2 text-sm text-text-soft">
                <Users aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                {stage.parentInvolvement}
              </p>
            ) : null}
          </Card>
          {index < stages.length - 1 ? <span className="sr-only">, then</span> : null}
        </li>
      ))}
    </ol>
  );
}
