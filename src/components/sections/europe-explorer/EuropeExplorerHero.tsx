import { ArrowRight, Calendar, Globe2, ShieldCheck, UserCheck, Wallet } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { LinkButton } from "@/components/ui/Button";
import { FADE_UP_CLASSES, HOVER_LIFT_CLASSES } from "@/lib/ui/motion";
import { getGraphicAriaProps } from "@/lib/graphics/accessible-graphic";
import { cn } from "@/lib/utils";

/**
 * UX10-EU01 "Europe Country Explorer" — compact hero matching the
 * reference's section 1 (clear modern headline, Europe-focused
 * positioning, primary + secondary CTA, trust points below).
 *
 * Same documented reasoning as UX10-HW01's `HowItWorksHero.tsx`: the
 * reference's own photo is not an asset that exists or is approved in
 * this repo, so this hero reuses the exact real, already-approved hero
 * assets (`/hero/campus-sky-backdrop.png`, `/hero/nextwise-student-
 * cutout.png`) and `CareersHero.tsx`'s generic `.careers-hero-*` layout
 * CSS, rather than fabricating new European stock photography — this
 * satisfies the brief's own priority #6/"same visual family" requirement
 * (shared with Homepage/Career Explorer/Pricing/How It Works) more
 * precisely than an unfamiliar new photo would.
 *
 * "Explore Countries" scrolls to the Country Cards section (`#europe-
 * countries`, this page's own real section) rather than linking anywhere
 * new; "Talk to an Expert" goes to the existing public `/book-counselling`
 * route, same destination every other hero's secondary CTA already uses.
 */
const TRUST_POINTS = [
  { icon: ShieldCheck, label: "Trusted official sources" },
  { icon: UserCheck, label: "Realistic guidance for your profile" },
  { icon: Wallet, label: "Focus on affordable quality education" },
  { icon: Globe2, label: "Support from experts when you need it" },
];

export function EuropeExplorerHero() {
  const decorative = getGraphicAriaProps({ kind: "decorative" });

  return (
    <section className="relative isolate overflow-hidden bg-background">
      <img {...decorative} src="/hero/campus-sky-backdrop.png" alt="" loading="eager" className="hero-campus-backdrop" />
      <div {...decorative} className="hero-backdrop-scrim" />
      <div {...decorative} className="hero-bottom-fade" />

      <Container className="relative pt-10 pb-6 sm:pt-14 sm:pb-8 lg:pt-16">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.05fr] lg:gap-14">
          <div className={cn(FADE_UP_CLASSES, "lg:self-center")}>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-secondary">Study in Europe</p>

            <h1 className="mt-5 font-sans text-[2.25rem] font-bold leading-[1.1] tracking-tight balance sm:text-[2.75rem] lg:text-[3.1rem] lg:leading-[1.07]">
              <span className="text-text">Explore Europe </span>
              <span className="text-primary">with Confidence</span>
            </h1>

            <p className="mt-5 max-w-lg text-lg leading-relaxed text-text-soft">
              Compare study destinations, understand costs and requirements, and use trusted official sources before
              making a decision.
            </p>

            <div className="mt-8 flex flex-row flex-wrap gap-3">
              <LinkButton
                href="#europe-countries"
                size="lg"
                trailingIcon={
                  <ArrowRight
                    aria-hidden="true"
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
                  />
                }
                className={cn("group", HOVER_LIFT_CLASSES)}
              >
                Explore Countries
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
