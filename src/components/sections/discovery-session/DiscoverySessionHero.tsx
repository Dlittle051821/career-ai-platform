import { ArrowRight, Calendar, GraduationCap, Landmark, LineChart, Wallet } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { LinkButton } from "@/components/ui/Button";
import { FADE_UP_CLASSES, HOVER_LIFT_CLASSES } from "@/lib/ui/motion";
import { getGraphicAriaProps } from "@/lib/graphics/accessible-graphic";
import { cn } from "@/lib/utils";

/**
 * UX10-DS01 "Discovery Session Redesign" — compact, reassuring hero for the
 * redesigned /discovery-session/book page, matching the approved reference
 * image's hero section (eyebrow, headline with "Discovery Session"
 * highlighted, supporting copy, two CTAs, a 4-item trust row, and
 * decorative floating question bubbles around the student visual).
 *
 * Same asset-reuse decision HowItWorksHero.tsx and CareersHero.tsx already
 * made: the reference's own background photo is not an asset that exists or
 * has been approved in this repo, so rather than generate new, unapproved
 * stock photography this hero reuses the exact real, already-approved hero
 * assets (`/hero/campus-sky-backdrop.png`, `/hero/nextwise-student-cutout.png`)
 * and the generic `.careers-hero-stage` / `.careers-hero-atmosphere` /
 * `.careers-hero-portrait` / `.careers-hero-portrait-img` CSS already shipped
 * for that same pattern. Zero new CSS, zero new photography.
 *
 * Primary CTA scrolls to the real booking form further down this same page
 * (`href="#discovery-session-form"`, a same-page anchor — not a navigation
 * to a different route) rather than linking out, since this milestone
 * integrates the real form into this one page (see this component's own
 * page.tsx docblock for the route-architecture decision). Secondary CTA
 * goes to the existing `/how-it-works` route, exactly as the brief specifies.
 *
 * The question bubbles ("Career options?", "Which country?", etc.) are
 * decorative conversation prompts, not promises — aria-hidden so they never
 * clutter the screen-reader flow, same convention as every other decorative
 * graphic in this codebase (see getGraphicAriaProps' own docblock).
 */

const TRUST_ROW = [
  { icon: GraduationCap, label: "Free session" },
  { icon: Wallet, label: "No pressure to buy" },
  { icon: Landmark, label: "India & Europe guidance" },
  { icon: LineChart, label: "Parents welcome" },
];

/**
 * UX10-DS01 visual QA caught two real bugs here, fixed in two passes:
 *
 * 1. `right-*` positioning — two bubbles ("Is it affordable?", "What are
 *    my chances?") originally sat at a `right-` value low enough that
 *    this section's own `overflow-hidden` clipped their text mid-word.
 *    `right-*` pushes an absolutely-positioned element further LEFT/inward
 *    as the value increases — these needed larger `right-*` values, not
 *    smaller/negative ones, to stay fully inside the visible stage.
 *
 * 2. Stacking order — even after the positioning fix, a careful recheck
 *    (bounding-box measurement via a throwaway Playwright script, not
 *    just the overflow-report's page-level scrollWidth check, which this
 *    bug never tripped) showed "What are my chances?" still rendering
 *    partly hidden behind the student portrait photo in the live page,
 *    even though its box was fully inside the section's bounds. Root
 *    cause: `.careers-hero-portrait` carries an explicit `z-index: 2`
 *    (globals.css), while these bubbles had no z-index of their own
 *    (auto == 0 in the same stacking context), so the opaque photo
 *    painted on top of the bubble wherever the two boxes overlapped —
 *    not a clipping/overflow issue at all. Fixed by giving the bubbles
 *    their own `z-20` so these "floating" prompts always render in front
 *    of the portrait, which also matches the reference image's intent
 *    (bubbles floating around the person, not tucked behind them).
 */
const QUESTION_BUBBLES = [
  { label: "Career options?", className: "left-[6%] top-[14%] sm:left-[8%]" },
  { label: "Which country?", className: "left-[2%] top-[46%] sm:left-[4%]" },
  { label: "Which course?", className: "right-[6%] top-[10%] sm:right-[8%]" },
  { label: "Is it affordable?", className: "right-[6%] top-[42%] sm:right-[8%]" },
  { label: "What are my chances?", className: "right-[16%] bottom-[10%] sm:right-[18%]" },
];

export function DiscoverySessionHero() {
  const decorative = getGraphicAriaProps({ kind: "decorative" });

  return (
    <section className="relative isolate overflow-hidden bg-background">
      <img {...decorative} src="/hero/campus-sky-backdrop.png" alt="" loading="eager" className="hero-campus-backdrop" />
      <div {...decorative} className="hero-backdrop-scrim" />
      <div {...decorative} className="hero-bottom-fade" />

      <Container className="relative pt-10 pb-6 sm:pt-14 sm:pb-8 lg:pt-16">
        <div className="grid gap-10 lg:grid-cols-[0.95fr_1fr] lg:gap-14">
          <div className={cn(FADE_UP_CLASSES, "lg:self-center")}>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-secondary">
              Free · No pressure · Get clarity
            </p>

            <h1 className="mt-5 font-sans text-[2.25rem] font-bold leading-[1.1] tracking-tight balance sm:text-[2.75rem] lg:text-[3.1rem] lg:leading-[1.07]">
              <span className="text-text">Start with a free </span>
              <span className="text-primary">Discovery Session</span>
            </h1>

            <p className="mt-5 max-w-lg text-lg leading-relaxed text-text-soft">
              Get personalised guidance from a Nextwise counsellor to help you make confident decisions about your
              career, courses and study options in India and Europe.
            </p>

            <div className="mt-8 flex flex-row flex-wrap gap-3">
              <LinkButton
                href="#discovery-session-form"
                size="lg"
                trailingIcon={
                  <ArrowRight
                    aria-hidden="true"
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
                  />
                }
                className={cn("group", HOVER_LIFT_CLASSES)}
              >
                Book Free Session
              </LinkButton>
              <LinkButton
                href="/how-it-works"
                size="lg"
                variant="outline"
                icon={<Calendar aria-hidden="true" className="h-4 w-4" />}
                className={cn(HOVER_LIFT_CLASSES, "!bg-white/90 backdrop-blur-sm")}
              >
                How It Works
              </LinkButton>
            </div>

            <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-3">
              {TRUST_ROW.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2 text-sm font-medium text-text-soft">
                  <Icon aria-hidden="true" className="h-4 w-4 text-secondary" />
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <div className={cn(FADE_UP_CLASSES, "relative lg:self-end")}>
            <div className="careers-hero-stage relative">
              <div {...decorative} className="careers-hero-atmosphere" />
              <div {...decorative} className="careers-hero-portrait">
                <img
                  src="/hero/nextwise-student-cutout.png"
                  alt=""
                  width={1086}
                  height={1448}
                  loading="eager"
                  className="careers-hero-portrait-img"
                />
              </div>

              {QUESTION_BUBBLES.map(({ label, className }) => (
                <span
                  key={label}
                  aria-hidden="true"
                  className={cn(
                    "absolute z-20 hidden rounded-full border border-border/70 bg-white/90 px-3.5 py-2 text-xs font-medium text-text-soft shadow-soft backdrop-blur-sm lg:block",
                    className
                  )}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
