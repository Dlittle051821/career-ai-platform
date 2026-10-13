import Link from "next/link";
import { ArrowRight, Globe2, Play, ShieldCheck, UserCheck } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { LinkButton } from "@/components/ui/Button";
import { FADE_UP_CLASSES, HOVER_LIFT_CLASSES } from "@/lib/ui/motion";
import { getGraphicAriaProps } from "@/lib/graphics/accessible-graphic";
import { EXPLORER_JOURNEY_STEPS } from "@/lib/careers/explorer-journey";
import { FAMILY_TONE_CLASSES, type FamilyTone } from "@/lib/careers/family-presentation";
import { cn } from "@/lib/utils";

/**
 * UX10-C01 — Career Explorer hero. Reuses the exact real, already-approved
 * assets HomeHero.tsx's own hero uses (`/hero/campus-sky-backdrop.png`,
 * `/hero/nextwise-student-cutout.png`, the two `/hero/annotation-*.png`
 * crops — see that file's own docblock for how each was approved) rather
 * than fabricating new photography or new handwritten-text graphics. The
 * full-bleed backdrop/scrim/bottom-fade CSS classes (`.hero-campus-
 * backdrop`, `.hero-backdrop-scrim`, `.hero-bottom-fade`) are shared
 * verbatim with the homepage — they're section-width-independent, unlike
 * the column-proportion-dependent portrait/annotation rules, which get
 * their own `.careers-hero-*` scope instead (see globals.css for why).
 *
 * "Start Exploring" scrolls to this page's own real results list
 * (`#career-results`, the real server-rendered search below) rather than
 * linking anywhere new. "How it works" goes to the real, pre-existing
 * `/how-it-works` page — the same destination CareerJourneyPreview.tsx's
 * "See the full journey" link already uses on the homepage.
 *
 * The five journey-step chips beside the photo and the trust-cue row both
 * reuse real, pre-existing public routes and this codebase's own
 * icon-to-concept mapping — see `src/lib/careers/explorer-journey.ts`.
 */

const TRUST_CUES = [
  { icon: ShieldCheck, label: "Trusted global sources" },
  { icon: UserCheck, label: "Personalised guidance available" },
  { icon: Globe2, label: "From study to real careers" },
];

export function CareersHero() {
  const decorative = getGraphicAriaProps({ kind: "decorative" });

  return (
    <section className="relative isolate overflow-hidden bg-background">
      <img {...decorative} src="/hero/campus-sky-backdrop.png" alt="" loading="eager" className="hero-campus-backdrop" />
      <div {...decorative} className="hero-backdrop-scrim" />
      <div {...decorative} className="hero-bottom-fade" />

      <Container className="relative pt-10 pb-6 sm:pt-14 sm:pb-8 lg:pt-16">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.05fr] lg:gap-14">
          <div className={cn(FADE_UP_CLASSES, "lg:self-center")}>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-secondary">Explore · Discover · Plan · Grow</p>

            <h1 className="mt-5 font-sans text-[2.25rem] font-bold leading-[1.1] tracking-tight balance sm:text-[2.75rem] lg:text-[3.1rem] lg:leading-[1.07]">
              <span className="text-text">Explore </span>
              <span className="text-primary">Career Paths</span>
            </h1>

            <p className="mt-5 max-w-lg text-lg leading-relaxed text-text-soft">
              Move from your interests to real careers. Discover what working in different fields is like, the
              skills you&rsquo;ll need, and the study paths that can take you there.
            </p>

            <div className="mt-8 flex flex-row flex-wrap gap-3">
              <LinkButton
                href="#career-results"
                size="lg"
                trailingIcon={
                  <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
                }
                className={`group ${HOVER_LIFT_CLASSES}`}
              >
                Start Exploring
              </LinkButton>
              <LinkButton href="/how-it-works" size="lg" variant="outline" icon={<Play aria-hidden="true" className="h-4 w-4" />} className={cn(HOVER_LIFT_CLASSES, "!bg-white/90 backdrop-blur-sm")}>
                How it works
              </LinkButton>
            </div>

            <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-3">
              {TRUST_CUES.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2 text-sm font-medium text-text-soft">
                  <Icon aria-hidden="true" className="h-4 w-4 text-secondary" />
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <div className={cn(FADE_UP_CLASSES, "lg:self-end")}>
            <div className="careers-hero-stage">
              <div {...decorative} className="careers-hero-atmosphere" />

              <div {...decorative} className="careers-hero-portrait">
                <img src="/hero/nextwise-student-cutout.png" alt="" width={1086} height={1448} loading="eager" className="careers-hero-portrait-img" />
              </div>

              <img {...decorative} src="/hero/annotation-curiosity-global.png" alt="" loading="eager" className="careers-hero-annotation careers-hero-annotation-left" />
              <img {...decorative} src="/hero/annotation-clearer-brighter.png" alt="" loading="eager" className="careers-hero-annotation careers-hero-annotation-right" />

              {/* The same 5-step journey, as a loose cluster of small real
                  navigational chips around the portrait — a lighter echo
                  of the clearer numbered strip rendered again just below
                  the filter bar (JourneyMiniMap). Hidden below `sm:` where
                  there isn't room for both the portrait and the cluster
                  without overlap; the numbered strip below still covers
                  every breakpoint. */}
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[4] hidden sm:block">
                {EXPLORER_JOURNEY_STEPS.map((step, index) => {
                  const pos = JOURNEY_CHIP_POSITIONS[index];
                  const tone = FAMILY_TONE_CLASSES[step.tone as FamilyTone];
                  const Icon = step.icon;
                  return (
                    <div key={step.id} className={cn("pointer-events-auto absolute flex items-center gap-2 rounded-xl border border-border bg-surface/95 px-3 py-2 shadow-soft backdrop-blur-sm", pos)}>
                      <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", tone.bg, tone.fg)}>
                        <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                      </span>
                      <div className="leading-tight">
                        <p className="text-xs font-semibold text-text">{step.label}</p>
                        <p className="text-[10px] text-muted">{step.blurb}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

// Loose, hand-placed positions around the portrait — approximating the
// reference mockup's own scattered icon-chip cluster. Decorative only
// (the real, reachable version of this same data is JourneyMiniMap below).
const JOURNEY_CHIP_POSITIONS = [
  "left-0 top-2",
  "right-0 top-0",
  "right-[-6%] top-[32%]",
  "left-[2%] top-[58%]",
  "right-[4%] bottom-[2%]",
];
