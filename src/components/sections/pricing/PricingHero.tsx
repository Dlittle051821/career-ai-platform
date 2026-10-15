import { Compass, Globe2, ShieldCheck } from "lucide-react";
import { Container } from "@/components/layout/Container";

/**
 * UX10-PR01B "Pricing Visual Correction Pass" — a compact, sans-serif hero
 * replacing the generic `<PageHero>` this page used before (a tall,
 * beige/`surface-alt` block using the sitewide serif `h1` rule from
 * globals.css). This milestone is visual-only — no pricing data, catalog,
 * or checkout logic changes — so this component renders no plan data at
 * all; it's pure presentation.
 *
 * The brief's own explicit hero spec (not the reference image's decorative
 * student photo, which the brief's text never asks for) is: an eyebrow
 * pill, a two-tone heading ("Plans for" neutral, "every journey" in the
 * real brand blue), a one-line subtitle, and three icon-led trust points.
 * `font-sans` on the heading mirrors the exact same deliberate override
 * HomeHero.tsx / CareersHero.tsx / ProfileWorkspace.tsx / DashboardPage
 * already use to opt out of the sitewide serif heading rule — see
 * HomeHero.tsx's own docblock for why that rule is sitewide-but-not-touched
 * and each "app surface" page overrides it locally instead.
 *
 * The three trust points are deliberately NOT "Trusted by 10,000+
 * students" / a star rating / a success percentage — this page's own
 * "Terms that apply to every package" section and PricingTrustStrip.tsx
 * both already carry the same never-fabricate-a-statistic discipline the
 * brief's sections 17/19 established for UX10-PR01, which this visual-only
 * pass does not relax.
 */
const TRUST_POINTS = [
  { icon: ShieldCheck, label: "Clear guidance" },
  { icon: Compass, label: "Expert support" },
  { icon: Globe2, label: "India & global opportunities" },
] as const;

export function PricingHero() {
  return (
    <section className="relative overflow-hidden bg-[linear-gradient(180deg,var(--surface-soft-blue)_0%,var(--color-background)_85%)] pt-14 pb-10 sm:pt-16 sm:pb-12">
      <Container className="max-w-[1500px]">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-primary shadow-soft">
            Pricing &amp; Plans
          </span>

          <h1 className="mt-5 font-sans text-[2.25rem] font-bold leading-[1.1] tracking-tight balance sm:text-[2.75rem] lg:text-[3.1rem]">
            <span className="text-text">Plans for </span>
            <span className="text-primary">every journey</span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted">
            Choose the right level of support for your India and abroad study goals. A one-time payment, no
            subscriptions, no recurring charges — every price below is exactly what you&rsquo;ll be charged.
          </p>

          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
            {TRUST_POINTS.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2 text-sm font-medium text-text-soft">
                <Icon aria-hidden="true" className="h-4 w-4 text-secondary" />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
