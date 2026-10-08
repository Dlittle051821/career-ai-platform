import { Compass, GraduationCap, Lightbulb, Briefcase } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { FADE_UP_CLASSES, FLOW_DASH_CLASSES, getStaggerDelayMs } from "@/lib/ui/motion";

const NODES = [
  { icon: Lightbulb, label: "Interests", tone: "accent" as const },
  { icon: Compass, label: "Career direction", tone: "secondary" as const },
  { icon: GraduationCap, label: "Course & pathway", tone: "secondary" as const },
  { icon: Briefcase, label: "Job readiness", tone: "primary" as const },
];

// UX09 Part D — exactly one connecting segment (between "Career direction"
// and "Course & pathway", the journey's conceptual midpoint) carries the
// slow, subtle flow-dash motion. Deliberately not every segment: the task's
// own rule is "animation on every card" is forbidden, and a graphic where
// every line moves reads as busy rather than calm.
const ANIMATED_SEGMENT_INDEX = 1;

const TONE_CLASSES = {
  accent: "bg-accent-light text-accent-dark ring-accent/15",
  secondary: "bg-secondary-light text-secondary-dark ring-secondary/15",
  primary: "bg-primary text-on-primary ring-primary/15",
};

/**
 * Original, component-built roadmap graphic — no stock imagery. Purely
 * illustrative; explicitly labelled as such for parents and students.
 *
 * UX09 Part B/D — each node now fades/rises in on a short stagger (one
 * single playthrough on mount, never looping), and the one marked segment
 * above carries the shared ambient pathway motion. This is a presentation
 * change only — the four labeled stages and their order are unchanged.
 */
export function RoadmapVisual() {
  return (
    <div className="relative rounded-[var(--radius-card)] border border-border bg-gradient-to-br from-surface to-surface-alt/60 p-6 shadow-lifted sm:p-8">
      <div className="flex items-center justify-between gap-3">
        <p className="font-serif text-base font-semibold text-primary">Sample roadmap</p>
        <Badge tone="neutral">Illustrative journey</Badge>
      </div>

      <div className="mt-9 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        {NODES.map(({ icon: Icon, label, tone }, index) => (
          <div
            key={label}
            className={cn("relative flex flex-1 items-center gap-4 sm:flex-col sm:text-center", FADE_UP_CLASSES)}
            style={{ animationDelay: `${getStaggerDelayMs(index)}ms` }}
          >
            {index > 0 ? (
              <span
                aria-hidden="true"
                className="absolute -top-4 left-6 h-4 w-px bg-border sm:left-1/2 sm:-top-[1.75rem] sm:hidden"
              />
            ) : null}
            <span
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-full ring-4",
                TONE_CLASSES[tone]
              )}
            >
              <Icon aria-hidden="true" className="h-5 w-5" />
            </span>
            <p className="text-sm font-medium text-text-soft sm:text-[13px]">{label}</p>
            {index < NODES.length - 1 ? (
              <svg
                aria-hidden="true"
                className={cn(
                  "hidden h-px flex-1 sm:absolute sm:left-[calc(50%+2rem)] sm:top-6 sm:block sm:w-[calc(100%-4rem)]",
                  index === ANIMATED_SEGMENT_INDEX ? "text-primary/50" : "text-border"
                )}
              >
                <line
                  x1="0"
                  y1="0.5"
                  x2="100%"
                  y2="0.5"
                  stroke="currentColor"
                  strokeWidth={1}
                  strokeDasharray={index === ANIMATED_SEGMENT_INDEX ? "4 4" : undefined}
                  className={index === ANIMATED_SEGMENT_INDEX ? FLOW_DASH_CLASSES : undefined}
                />
              </svg>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
