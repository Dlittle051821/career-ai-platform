import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Compass, GraduationCap, MessageCircle, Sparkles } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { PageHero } from "@/components/sections/PageHero";
import { CTASection } from "@/components/sections/CTASection";

/**
 * NW03.2 — Career Intelligence product landing page.
 *
 * This is a lightweight, additive entry point into the existing Career
 * surface area, not a rebuild of it. Every link below points at a route
 * that already exists and was already reachable before NW03 (see
 * docs/milestones/NW03/NW03_01_AUDIT.md section 2) — this page's only job
 * is to give "Career Intelligence" its own front door and a single place
 * that frames those existing pieces as one product, ahead of /studio/career
 * (the authenticated workspace, added in NW03.3) existing to receive a
 * signed-in visitor who clicks through from here.
 *
 * No new data, no new Supabase query, no fabricated content — purely
 * presentational composition of existing Section/Card/CTASection
 * primitives, matching the pattern already used by
 * src/app/(site)/career-discovery/page.tsx and
 * src/app/(site)/study-europe/page.tsx.
 */
export const metadata: Metadata = {
  title: "Career Intelligence",
  description:
    "Explore careers, compare paths, get a guided career discovery orientation, and talk to a counsellor — all in one place, whether or not you ever study abroad.",
  alternates: { canonical: "/career" },
};

const CAREER_LINKS = [
  {
    icon: Compass,
    title: "Career Discovery",
    description: "A short, interactive orientation to help you get your bearings before choosing a career and course.",
    href: "/career-discovery",
    linkLabel: "Start discovery",
  },
  {
    icon: Sparkles,
    title: "Explore careers",
    description: "Browse careers, what they actually involve day to day, and how to get there.",
    href: "/careers",
    linkLabel: "Browse careers",
  },
  {
    icon: GraduationCap,
    title: "Courses & universities",
    description: "Find courses and universities in India that match a path you're considering.",
    href: "/courses",
    linkLabel: "Find courses",
  },
  {
    icon: MessageCircle,
    title: "Talk to a counsellor",
    description: "Book a free counselling conversation about your goals — no pressure, no obligation to buy anything.",
    href: "/book-counselling",
    linkLabel: "Book counselling",
  },
] as const;

export default function CareerProductPage() {
  return (
    <>
      <PageHero
        eyebrow="Career Intelligence"
        title="Figure out your career direction, on your own terms"
        description="Career Intelligence is the India-focused half of Nextwise: career discovery, course and university research, and counselling — usable fully on its own, with no study-abroad purchase required."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Career Intelligence" }]}
      >
        <Badge tone="info">
          <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
          Works standalone — study abroad is a separate, optional path
        </Badge>
      </PageHero>

      <Section tone="surface">
        <SectionHeading
          eyebrow="Where to start"
          title="Everything you need for your career direction"
          description="Each of these already exists on Nextwise today — this page just brings them together under Career Intelligence."
          align="center"
          className="mx-auto max-w-2xl"
        />
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {CAREER_LINKS.map(({ icon: Icon, title, description, href, linkLabel }) => (
            <Card key={href} className="flex flex-col">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
                <Icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-primary">{title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{description}</p>
              <Link
                href={href}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-secondary-dark underline underline-offset-2"
              >
                {linkLabel}
                <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
              </Link>
            </Card>
          ))}
        </div>
      </Section>

      <Section tone="muted">
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div>
            <SectionHeading
              eyebrow="Also considering studying abroad?"
              title="That's a separate, optional path"
              description="Nextwise also runs Abroad — a separate product for researching and planning study abroad in six European countries. You can use Career Intelligence fully without ever touching it, and vice versa."
              className="max-w-none"
            />
            <div className="mt-6">
              <LinkButton href="/abroad" variant="outline" trailingIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>
                Explore Abroad
              </LinkButton>
            </div>
          </div>
        </div>
      </Section>

      <CTASection
        title="Ready to get a clearer picture?"
        description="Start with a free, no-pressure counselling conversation, or jump straight into career discovery."
        primaryLabel="Book free counselling"
        primaryHref="/book-counselling"
        secondaryLabel="Start career discovery"
        secondaryHref="/career-discovery"
      />
    </>
  );
}
