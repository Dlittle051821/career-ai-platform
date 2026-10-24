import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Globe2, MessageCircle, Scale, Sparkles } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { PageHero } from "@/components/sections/PageHero";
import { CTASection } from "@/components/sections/CTASection";
import { EUROPE_COUNTRIES } from "@/data/europe-explorer";

/**
 * NW03.2 — Abroad product landing page.
 *
 * Mirrors src/app/(site)/career/page.tsx's approach: additive front door,
 * no new data. The six-country list below is read directly from
 * EUROPE_COUNTRIES (src/data/europe-explorer.ts) — the exact NW02 launch
 * allowlist (Germany, Ireland, Netherlands, France, Sweden, Denmark) —
 * never a re-typed or expanded copy, so this page cannot silently drift
 * from the existing /study-europe allowlist. The country deep dive itself
 * stays on /study-europe; this page only teases the list and links out.
 */
export const metadata: Metadata = {
  title: "Study Abroad",
  description:
    "Research and plan studying abroad across six European countries — Germany, Ireland, Netherlands, France, Sweden, and Denmark — without needing a career assessment first.",
  alternates: { canonical: "/abroad" },
};

export default function AbroadProductPage() {
  return (
    <>
      <PageHero
        eyebrow="Study Abroad"
        title="Research study-abroad options, starting right away"
        description="Abroad is the study-abroad half of Nextwise: compare countries, universities, and courses across six European destinations — usable fully on its own, with no career assessment required first."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Study Abroad" }]}
      >
        <Badge tone="info">
          <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
          Works standalone — no career discovery sign-up needed
        </Badge>
      </PageHero>

      <Section tone="surface">
        <SectionHeading
          eyebrow="Six launch destinations"
          title="Compare countries at a glance"
          description="Every country below is one of the six Nextwise currently supports in depth. Open the full Country Explorer to compare tuition, English-taught programmes, admissions, and post-study options, then go straight to each country's official source."
          align="center"
          className="mx-auto max-w-2xl"
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EUROPE_COUNTRIES.map((country) => (
            <Card key={country.code} className="flex items-center justify-between gap-3">
              <span className="text-base font-semibold text-primary">{country.name}</span>
              {country.recommended ? <Badge tone="accent">Popular</Badge> : null}
            </Card>
          ))}
        </div>
        <div className="mt-8 text-center">
          <LinkButton href="/study-europe" variant="primary" trailingIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>
            Open the Country Explorer
          </LinkButton>
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading
          eyebrow="Also available"
          title="Keep researching across every destination"
          align="center"
          className="mx-auto max-w-2xl"
        />
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          <Card className="flex flex-col">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
              <Globe2 aria-hidden="true" className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-lg font-semibold text-primary">Courses & universities</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
              Search courses and universities across all seven launch destinations, India included.
            </p>
            <Link href="/courses" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-secondary-dark underline underline-offset-2">
              Find courses
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </Link>
          </Card>
          <Card className="flex flex-col">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
              <Scale aria-hidden="true" className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-lg font-semibold text-primary">India vs. abroad</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
              An honest, side-by-side comparison of studying in India against studying abroad.
            </p>
            <Link href="/study-options" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-secondary-dark underline underline-offset-2">
              Compare pathways
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </Link>
          </Card>
          <Card className="flex flex-col">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
              <MessageCircle aria-hidden="true" className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-lg font-semibold text-primary">Talk to a counsellor</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
              Book a free, no-obligation conversation about studying abroad.
            </p>
            <Link href="/book-counselling" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-secondary-dark underline underline-offset-2">
              Book counselling
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </Link>
          </Card>
        </div>
      </Section>

      <Section tone="surface">
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div>
            <SectionHeading
              eyebrow="Not sure which career to pursue yet?"
              title="That's a separate, optional path"
              description="Nextwise also runs Career Intelligence — a separate product for career discovery and India-focused counselling. You can use Abroad fully without ever touching it, and vice versa."
              className="max-w-none"
            />
            <div className="mt-6">
              <LinkButton href="/career" variant="outline" trailingIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>
                Explore Career Intelligence
              </LinkButton>
            </div>
          </div>
        </div>
      </Section>

      <CTASection
        title="Let's find the right country for you"
        description="Get personalised guidance, compare your options, and take the first step with confidence."
        primaryLabel="Open the Country Explorer"
        primaryHref="/study-europe"
        secondaryLabel="Talk to an expert"
        secondaryHref="/book-counselling"
        background="cinematic"
      />
    </>
  );
}
