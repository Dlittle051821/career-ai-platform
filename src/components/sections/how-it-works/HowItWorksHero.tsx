import { ArrowRight, Calendar, Globe2, ShieldCheck, UserCheck, Wallet } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { LinkButton } from "@/components/ui/Button";
import { FADE_UP_CLASSES, HOVER_LIFT_CLASSES } from "@/lib/ui/motion";
import { getGraphicAriaProps } from "@/lib/graphics/accessible-graphic";
import { cn } from "@/lib/utils";

/**
 * UX10-HW01 "How It Works Redesign" — compact, modern hero matching the
 * approved reference image's section 1 (compact, Europe-first positioning,
 * strong blue emphasis, two CTAs, trust points below).
 *
 * The reference's own background photo (a student facing a European
 * skyline) is not an asset that exists or has been approved in this repo.
 * Rather than generate new, unapproved stock photography, this hero reuses
 * the EXACT real, already-approved hero assets `HomeHero.tsx` and
 * `CareersHero.tsx` both use (`/hero/campus-sky-backdrop.png`,
 * `/hero/nextwise-student-cutout.png`) and CareersHero's own generic
 * `.careers-hero-stage` / `.careers-hero-atmosphere` / `.careers-hero-
 * portrait` / `.careers-hero-portrait-img` CSS (pure layout/positioning,
 * no career-specific copy baked in — confirmed by reading globals.css
 * before reusing it here). This satisfies the brief's own priority #6
 * ("same visual family as Homepage/Career Explorer/Pricing/Dashboard/
 * Profile") more precisely than introducing an unfamiliar new photo would,
 * and ships zero new CSS. Documented as a deliberate interpretation choice
 * in UX10-HW01_REFERENCE_AUDIT.md, same pattern as UX10-PR01B's
 * `PricingHero.tsx` choosing no photo at all.
 *
 * Copy keeps the reference's "Europe-first" framing (headline + subtitle)
 * because it matches this product's own real, already-published
 * positioning — see `src/app/(site)/about/page.tsx`: "Our initial focus is
 * students and families across Odisha, with an early international lens
 * on Europe" — rather than inventing a new claim. India is named
 * alongside Europe in the subtitle and trust points, since the product is
 * not Europe-exclusive (see the dual-pathway section below). No stats,
 * counts, or partnership claims are added.
 */

const TRUST_POINTS = [
  { icon: Globe2, label: "Europe & India focus" },
  { icon: UserCheck, label: "Personalised guidance" },
  { icon: ShieldCheck, label: "Honest, no-pressure support" },
  { icon: Wallet, label: "Practical, affordable pathways" },
];

export function HowItWorksHero() {
  const decorative = getGraphicAriaProps({ kind: "decorative" });

  return (
    <section className="relative isolate overflow-hidden bg-background">
      <img {...decorative} src="/hero/campus-sky-backdrop.png" alt="" loading="eager" className="hero-campus-backdrop" />
      <div {...decorative} className="hero-backdrop-scrim" />
      <div {...decorative} className="hero-bottom-fade" />

      <Container className="relative pt-10 pb-6 sm:pt-14 sm:pb-8 lg:pt-16">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.05fr] lg:gap-14">
          <div className={cn(FADE_UP_CLASSES, "lg:self-center")}>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-secondary">
              A simple, personalised journey
            </p>

            <h1 className="mt-5 font-sans text-[2.25rem] font-bold leading-[1.1] tracking-tight balance sm:text-[2.75rem] lg:text-[3.1rem] lg:leading-[1.07]">
              <span className="text-text">From your goals to the right </span>
              <span className="text-primary">opportunity in Europe or India</span>
            </h1>

            <p className="mt-5 max-w-lg text-lg leading-relaxed text-text-soft">
              Clear guidance, personalised support and real pathways across India and our early international focus
              on Europe — all in one connected journey.
            </p>

            <div className="mt-8 flex flex-row flex-wrap gap-3">
              <LinkButton
                href="/pricing"
                size="lg"
                trailingIcon={
                  <ArrowRight
                    aria-hidden="true"
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
                  />
                }
                className={cn("group", HOVER_LIFT_CLASSES)}
              >
                View Plans
              </LinkButton>
              <LinkButton
                href="/book-counselling"
                size="lg"
                variant="outline"
                icon={<Calendar aria-hidden="true" className="h-4 w-4" />}
                className={cn(HOVER_LIFT_CLASSES, "!bg-white/90 backdrop-blur-sm")}
              >
                Talk to an Expert
              </LinkButton>
            </div>

            <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-3">
              {TRUST_POINTS.map(({ icon: Icon, label }) => (
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
                <img
                  src="/hero/nextwise-student-cutout.png"
                  alt=""
                  width={1086}
                  height={1448}
                  loading="eager"
                  className="careers-hero-portrait-img"
                />
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
