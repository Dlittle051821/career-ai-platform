import { Compass, GraduationCap, Lightbulb, Briefcase } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

const NODES = [
  { icon: Lightbulb, label: "Interests", tone: "accent" as const },
  { icon: Compass, label: "Career direction", tone: "secondary" as const },
  { icon: GraduationCap, label: "Course & pathway", tone: "secondary" as const },
  { icon: Briefcase, label: "Job readiness", tone: "primary" as const },
];

const TONE_CLASSES = {
  accent: "bg-accent-light text-accent-dark ring-accent/15",
  secondary: "bg-secondary-light text-secondary-dark ring-secondary/15",
  primary: "bg-primary text-on-primary ring-primary/15",
};

/**
 * Original, component-built roadmap graphic — no stock imagery. Purely
 * illustrative; explicitly labelled as such for parents and students.
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
          <div key={label} className="relative flex flex-1 items-center gap-4 sm:flex-col sm:text-center">
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
              <span
                aria-hidden="true"
                className="hidden h-px flex-1 bg-border sm:absolute sm:left-[calc(50%+2rem)] sm:top-6 sm:block sm:w-[calc(100%-4rem)]"
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
