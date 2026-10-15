import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { JourneySteps } from "@/components/sections/JourneySteps";
import { JOURNEY_STAGES } from "@/data/journey";
import { HOW_IT_WORKS_STEPS, type HowItWorksStep } from "@/data/how-it-works-steps";
import { cn } from "@/lib/utils";

/**
 * UX10-HW01 — the reference image's "5-Step Journey" section: five
 * connected, numbered, color-coded steps (reference annotation #2). Each
 * step's circle/icon tone reuses the SAME `surface-soft-*` pastel system
 * (plus `--brand-primary` / `--brand-ink`) already approved for the
 * pricing page's per-plan accents — no new color invented, see
 * `src/lib/pricing/plan-accent.ts` for the precedent this follows.
 *
 * Connecting line: a static gradient bar behind the circles, desktop only
 * (`lg:` and up). Below `lg:` the steps stack in a single column — the
 * same "numbered circle + card, no explicit connector" convention this
 * codebase's own `JourneySteps` "detailed" variant already uses — so
 * mobile reads unambiguously top-to-bottom without needing a drawn line.
 *
 * The full 10-stage breakdown (free vs. paid support per real stage) is
 * kept reachable, not dropped, via a native `<details>` disclosure at the
 * bottom reusing `JourneySteps` exactly as the old page did — no new
 * client-side JS needed for the expand/collapse.
 */

const TONE_CLASSES: Record<HowItWorksStep["tone"], { circle: string; chip: string }> = {
  blue: { circle: "bg-primary", chip: "bg-[var(--surface-soft-blue)] text-[var(--surface-soft-blue-strong)]" },
  lavender: {
    circle: "bg-[var(--surface-soft-lavender-strong)]",
    chip: "bg-[var(--surface-soft-lavender)] text-[var(--surface-soft-lavender-strong)]",
  },
  cyan: {
    circle: "bg-[var(--surface-soft-cyan-strong)]",
    chip: "bg-[var(--surface-soft-cyan)] text-[var(--surface-soft-cyan-strong)]",
  },
  amber: {
    circle: "bg-[var(--surface-soft-amber-strong)]",
    chip: "bg-[var(--surface-soft-amber)] text-[var(--surface-soft-amber-strong)]",
  },
  ink: { circle: "bg-[var(--brand-ink)]", chip: "bg-[var(--brand-ink)]/10 text-[var(--brand-ink)]" },
};

export function JourneyStepFlow() {
  return (
    <div>
      <ol className="relative grid gap-8 lg:grid-cols-5 lg:gap-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[10%] right-[10%] top-5 hidden h-[3px] rounded-full bg-[linear-gradient(90deg,var(--brand-primary),var(--surface-soft-lavender-strong),var(--surface-soft-cyan-strong),var(--surface-soft-amber-strong),var(--brand-ink))] opacity-40 lg:block"
        />
        {HOW_IT_WORKS_STEPS.map((step, index) => {
          const tone = TONE_CLASSES[step.tone];
          const Icon = step.icon;
          return (
            <li key={step.id} className="relative flex flex-col">
              <span
                className={cn(
                  "relative z-10 flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white shadow-soft",
                  tone.circle
                )}
              >
                {String(step.order).padStart(2, "0")}
              </span>
              <Card className="mt-4 flex h-full flex-col">
                <span className={cn("flex h-11 w-11 items-center justify-center rounded-full", tone.chip)}>
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-primary">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.description}</p>
              </Card>
              {index < HOW_IT_WORKS_STEPS.length - 1 ? <span className="sr-only">, then</span> : null}
            </li>
          );
        })}
      </ol>

      <details className="group mt-10 rounded-[var(--radius-card)] border border-border bg-surface-alt px-5 py-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-primary marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          See the full 10-stage plan behind these 5 steps
          <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" />
        </summary>
        <div className="mt-6">
          <JourneySteps stages={JOURNEY_STAGES} variant="detailed" />
        </div>
      </details>
    </div>
  );
}
