import { Compass, GitCompareArrows, Rocket, Target, UserCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { FADE_UP_CLASSES, FLOW_DASH_CLASSES, getStaggerDelayMs } from "@/lib/ui/motion";
import { HOMEPAGE_CONTAINER_CLASSNAME } from "./homepage-layout";
import { cn } from "@/lib/utils";

/**
 * UX10A — Homepage Section 4, "How it works". Five numbered steps with a
 * thin connecting line, horizontal on desktop and a clean vertical
 * progression on mobile — the same structural pattern RoadmapVisual.tsx
 * (the homepage's pre-existing four-node journey graphic) already
 * established and that this component deliberately reuses rather than
 * inventing a second journey-graphic convention.
 *
 * The task allows the connecting line to "reveal/fill subtly... as the
 * section enters the viewport" but also explicitly forbids "scrolling
 * hijack." Rather than add a new IntersectionObserver-driven scroll
 * effect (new client-side complexity this milestone's own "do not
 * introduce new business logic/complexity just to match the mockup" rule
 * argues against), this reuses the exact ambient technique RoadmapVisual
 * already shipped and this codebase already reviewed: FLOW_DASH_CLASSES,
 * a slow (6s) non-blocking stroke animation on exactly one connecting
 * segment (never every segment — "a graphic where every line moves reads
 * as busy rather than calm"), with its own explicit reduced-motion
 * override already defined in globals.css.
 *
 * UX10-H02 "HOMEPAGE PREMIUM VISUAL REFINEMENT" — wrapped the step row in
 * its own white, rounded, soft-shadowed panel, and moved the previously-
 * separate "icon on its own row above the title" into a small badge
 * overlapping the corner of the numbered circle.
 *
 * UX10-H03 "EXACT HOMEPAGE REFERENCE MATCH" — the reference shows this
 * section as ONE compact horizontal row: the title sits to the LEFT of
 * the five steps (not stacked above them), there is no separate panel
 * box, and the whole section is noticeably shorter than H02's version.
 * Two scoped changes, the five steps/copy/icon-badge/connecting-line
 * logic from H02 otherwise untouched: (1) the H02 white panel wrapper
 * (`rounded-[1.75rem] border bg-surface p-6 shadow-soft`) is removed —
 * the steps now sit directly on this section's existing muted page wash,
 * same as the reference; (2) the title block ("YOUR JOURNEY WITH
 * NEXTWISE" / "How it works") moves from a full-width row above the
 * steps to a narrow left-hand column beside them in one `lg:flex-row`
 * layout, and the standalone "A simple path to a brighter future" byline
 * is dropped as redundant now that the title sits inline with its own
 * steps rather than needing a second line of context. Vertical padding
 * on the section itself is also tightened via `containerClassName`/
 * `className` overrides for the brief's own "compact vertical density."
 *
 * UX10-H04 "EXACT MATCH TO FINAL APPROVED HOMEPAGE MOCKUP" — `tone`
 * changes from "muted" (`bg-surface-alt`, a warm #f3efe7 cream — visible
 * in visual QA as a contrasting beige band between the white sections
 * above and below it) to "surface" (the same pale tone
 * TrustedStudyExplorer already uses directly above this section). The
 * final reference shows no such contrasting band — the whole page reads
 * as one continuous pale surface with density coming from spacing, not
 * section-by-section background color changes. Steps/copy/icon-badge/
 * connecting-line logic untouched.
 *
 * UX10-H07 "LOWER HOMEPAGE REFERENCE MATCH" — a correction pass, not a
 * rebuild: the title/steps/left-right composition H03 established is
 * already the right shape (confirmed against this milestone's own
 * reference), so nothing structural changes. Four scoped refinements:
 * (1) the reference's own supporting line under "How it works" — dropped
 * in H03 as "redundant" once the title moved inline with the steps — is
 * reinstated, since this milestone's reference shows it and a short
 * byline reads as more "polished product explainer" than a bare heading;
 * (2) the title column widens slightly (`lg:w-[16%]` -> `lg:w-[20%]`) to
 * give that extra line room without wrapping awkwardly; (3) each step's
 * numbered circle drops its `ring-primary/10` (a soft halo that read as
 * slightly heavy/dated next to the reference's cleaner circles) in favor
 * of a crisper `shadow-soft`; (4) the connecting line's default (inactive)
 * segments lighten from `text-border` to a softer `text-border/70` so the
 * one animated segment reads as more clearly "the current step" against a
 * quieter rest of the path, and the line itself gains a subtle rounded
 * line-cap for a less schematic, more hand-finished feel. Icons, step
 * copy, the five-step order, the icon-badge-on-the-circle treatment, and
 * which segment animates (index 2, between steps 3 and 4 — matching the
 * reference's own dashed segment) are all unchanged.
 */
const STEPS: { icon: LucideIcon; title: string; description: string }[] = [
  { icon: Compass, title: "Explore", description: "Discover careers, courses, and destinations that match your interests." },
  { icon: Target, title: "Discover your direction", description: "Take assessments and get personalised insights about your path." },
  { icon: GitCompareArrows, title: "Compare study paths", description: "Explore programmes from trusted global sources side by side." },
  { icon: UserCheck, title: "Get guidance", description: "Book a free session or get a personalised strategy from our counsellors." },
  { icon: Rocket, title: "Take action", description: "Build your plan and move forward with confidence." },
];

const ANIMATED_SEGMENT_INDEX = 2;

export function HowItWorks() {
  return (
    <Section
      tone="surface"
      containerClassName={HOMEPAGE_CONTAINER_CLASSNAME}
      className="!py-8 sm:!py-10 lg:!py-12"
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:gap-10">
        <div className="lg:w-[20%] lg:shrink-0">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-secondary">
            <span aria-hidden="true" className="h-px w-5 bg-secondary" />
            Your journey with Nextwise
          </p>
          <h2 className="text-2xl font-semibold text-primary sm:text-3xl">How it works</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            A simple, personalised journey to help you explore, plan, and reach your global opportunities with
            confidence.
          </p>
        </div>

        <div className="flex flex-1 flex-col gap-6 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          {STEPS.map(({ icon: Icon, title, description }, index) => (
            <div
              key={title}
              className={cn("relative flex flex-1 items-start gap-4 sm:flex-col sm:items-center sm:text-center", FADE_UP_CLASSES)}
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
                <svg
                  aria-hidden="true"
                  className={cn(
                    "hidden h-px flex-1 sm:absolute sm:left-[calc(50%+2.25rem)] sm:top-[1.6rem] sm:block sm:w-[calc(100%-4.5rem)]",
                    index === ANIMATED_SEGMENT_INDEX ? "text-primary/50" : "text-border/70"
                  )}
                >
                  <line
                    x1="0"
                    y1="0.5"
                    x2="100%"
                    y2="0.5"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeDasharray={index === ANIMATED_SEGMENT_INDEX ? "4 4" : undefined}
                    className={index === ANIMATED_SEGMENT_INDEX ? FLOW_DASH_CLASSES : undefined}
                  />
                </svg>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
