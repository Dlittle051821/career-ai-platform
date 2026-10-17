import { Compass, FileText, Globe2, HelpCircle, MapPinned } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { FADE_UP_CLASSES, getStaggerDelayMs } from "@/lib/ui/motion";
import { cn } from "@/lib/utils";

/**
 * UX10-DS01 — "What happens in the session?" 5-step connected process,
 * matching the reference image's section 2. Same numbered-circle-with-
 * icon-badge treatment and connecting-line convention already established
 * by the homepage's own HowItWorks.tsx (src/components/sections/home/),
 * reused here as a fresh, page-scoped component rather than importing that
 * homepage-specific one directly — this section's steps/copy are specific
 * to the Discovery Session conversation, not the sitewide journey.
 *
 * Customer-facing simplification only: none of this copy claims the
 * session produces a guaranteed recommendation or outcome.
 */

const STEPS: { icon: LucideIcon; title: string; description: string }[] = [
  { icon: Compass, title: "Understand your goals", description: "Your interests, strengths and aspirations." },
  { icon: FileText, title: "Review your profile", description: "Academics, achievements and background." },
  { icon: Globe2, title: "Discuss options in India & Europe", description: "Courses, universities and pathways." },
  { icon: HelpCircle, title: "Identify uncertainties", description: "Get answers to your key questions." },
  { icon: MapPinned, title: "Define next steps", description: "A clear plan based on your profile and goals." },
];

export function SessionStepsSection() {
  return (
    <Section tone="surface" className="!py-10 sm:!py-12 lg:!py-16">
      <SectionHeading
        eyebrow="A friendly conversation"
        title="What happens in the session?"
        description="A friendly, one-to-one conversation to understand your goals, explore your options and plan your next steps."
      />

      <div className="mt-10 flex flex-col gap-6 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4">
        {STEPS.map(({ icon: Icon, title, description }, index) => (
          <div
            key={title}
            className={cn(
              "relative flex flex-1 basis-[11rem] items-start gap-4 sm:flex-col sm:items-center sm:text-center",
              FADE_UP_CLASSES
            )}
            style={{ animationDelay: `${getStaggerDelayMs(index)}ms` }}
          >
            {index > 0 ? (
              <span aria-hidden="true" className="absolute -top-3 left-6 h-3 w-px bg-border sm:left-1/2 sm:-top-[1.9rem] sm:hidden" />
            ) : null}

            <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary shadow-soft sm:h-14 sm:w-14">
              {index + 1}
              <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-primary shadow-soft ring-2 ring-white">
                <Icon aria-hidden="true" className="h-3.5 w-3.5" />
              </span>
            </span>

            <div className="sm:mt-3">
              <p className="text-sm font-semibold text-text sm:text-[15px]">{title}</p>
              <p className="mt-1 max-w-[11rem] text-xs leading-relaxed text-muted sm:mx-auto">{description}</p>
            </div>

            {index < STEPS.length - 1 ? (
              <span aria-hidden="true" className="hidden h-px flex-1 bg-border/70 sm:block sm:w-full" />
            ) : null}
          </div>
        ))}
      </div>
    </Section>
  );
}
