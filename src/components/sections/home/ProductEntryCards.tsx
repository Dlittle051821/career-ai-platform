import Link from "next/link";
import { ArrowRight, Compass, Plane } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { LinkButton } from "@/components/ui/Button";
import { FADE_UP_CLASSES, HOVER_LIFT_CLASSES, getStaggerDelayMs } from "@/lib/ui/motion";
import { HOMEPAGE_CONTAINER_CLASSNAME } from "./homepage-layout";
import { cn } from "@/lib/utils";

/**
 * NW04.2 — Homepage, "two equal product entry points" section.
 *
 * NW03 introduced /career and /abroad as the canonical, equally-weighted
 * public entry point for each of Nextwise's two products (see
 * docs/milestones/NW03/NW03_02_ROUTES.md), but the homepage itself never
 * got a section presenting them as a deliberate choice — HomeHero.tsx's
 * own CTAs still point at /career-discovery and /study-europe (specific
 * flagship features within each product, not the product fronts
 * themselves), and DiscoveryPillars.tsx links to individual pages
 * (Careers/Study in India/Study in Europe) rather than the two products as
 * a whole. This is the gap the NW04 brief's AC-02 ("equally clear
 * independent entry points") calls out directly.
 *
 * Rather than rewrite HomeHero.tsx's own CTAs (which would cascade into
 * at least four existing, already-reviewed regression tests that assert
 * those exact hrefs/labels — see NW04_01_UX_AUDIT.md for the full list),
 * this ships as a new, additive section placed directly under the hero:
 * the one place on the homepage that explicitly frames "Career
 * Intelligence" and "Nextwise Abroad" as two equal, independent choices,
 * matching the approved NW04 reference image's own layout (two cards of
 * identical size, directly below the headline). The hero's existing CTAs
 * are untouched and still work exactly as before.
 *
 * Both cards are the same size, same visual weight, same CTA treatment —
 * neither is a "primary"/"recommended" option over the other, per AC-02.
 */

const PRODUCTS = [
  {
    key: "career",
    icon: Compass,
    title: "Career Intelligence",
    description: "Explore careers, courses and colleges with guided discovery and personalised recommendations.",
    href: "/career",
    cta: "Explore Career Intelligence",
    tone: {
      iconBg: "bg-secondary-light text-secondary-dark",
      ring: "ring-secondary/15",
    },
  },
  {
    key: "abroad",
    icon: Plane,
    title: "Nextwise Abroad",
    description: "Plan your international education journey across six study destinations, with expert guidance.",
    href: "/abroad",
    cta: "Explore Nextwise Abroad",
    tone: {
      iconBg: "bg-info-light text-info",
      ring: "ring-info/15",
    },
  },
] as const;

export function ProductEntryCards() {
  return (
    <Section tone="default" containerClassName={HOMEPAGE_CONTAINER_CLASSNAME} className="!py-10 sm:!py-12 lg:!py-16">
      <div className="mx-auto max-w-2xl text-center">
        <p className="mb-3 flex items-center justify-center gap-2 text-sm font-semibold uppercase tracking-wide text-secondary">
          <span aria-hidden="true" className="h-px w-6 bg-secondary" />
          One platform. Two pathways.
        </p>
        <h2 className="text-2xl font-semibold text-primary sm:text-3xl">Choose where to start</h2>
        <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">
          Same Nextwise account either way — pick a product below, or explore both. Neither requires the other.
        </p>
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {PRODUCTS.map(({ key, icon: Icon, title, description, href, cta, tone }, index) => (
          <div
            key={key}
            className={cn(
              "flex flex-col rounded-[var(--radius-card)] border border-border bg-surface p-7 shadow-soft",
              FADE_UP_CLASSES
            )}
            style={{ animationDelay: `${getStaggerDelayMs(index)}ms` }}
          >
            <span className={cn("flex h-14 w-14 items-center justify-center rounded-2xl ring-4", tone.iconBg, tone.ring)}>
              <Icon aria-hidden="true" className="h-7 w-7" />
            </span>
            <h3 className="mt-5 text-xl font-semibold text-primary">{title}</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{description}</p>
            <LinkButton
              href={href}
              variant="primary"
              className={cn("mt-6 w-full justify-center sm:w-auto", HOVER_LIFT_CLASSES)}
              trailingIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}
            >
              {cta}
            </LinkButton>
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-muted">
        Not sure yet? <Link href="/how-it-works" className="font-medium text-secondary-dark underline underline-offset-2">See how Nextwise works</Link>.
      </p>
    </Section>
  );
}
