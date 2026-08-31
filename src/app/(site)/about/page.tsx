import type { Metadata } from "next";
import Link from "next/link";
import { Compass, Globe2, ScaleIcon, Users } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Card } from "@/components/ui/Card";
import { PageHero } from "@/components/sections/PageHero";
import { CTASection } from "@/components/sections/CTASection";
import { TrustBadge } from "@/components/ui/TrustBadge";
import { TEAM_PLACEHOLDERS } from "@/data/trust";
import { BRAND_NAME } from "@/config/site";

export const metadata: Metadata = {
  title: "About",
  description: `Why career-first guidance matters, ${BRAND_NAME}'s Odisha focus, our operating principles, and an honest look at what's built so far.`,
};

const PRINCIPLES = [
  { icon: Compass, title: "Career before course", description: "We start from where a student is headed, not which course is trending this year." },
  { icon: ScaleIcon, title: "Transparency over persuasion", description: "We'd rather explain trade-offs honestly than oversell a single option." },
  { icon: Users, title: "Families decide together", description: "Students and parents are both part of the conversation, not just the payer and the customer." },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About"
        title={`Why ${BRAND_NAME} exists`}
        description="We started with a simple observation: too many families in Odisha choose a course before they understand the career it leads to — often after spending money they can't easily get back."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "About" }]}
      />

      <Section tone="surface">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="Our mission" title="Career-first guidance, made practical" className="max-w-none" />
            <p className="mt-4 text-sm leading-relaxed text-muted">
              {BRAND_NAME} exists to help students figure out where they&apos;re headed before locking in a course,
              university, or country — and to help parents understand the real cost and risk involved, in plain
              language.
            </p>
          </div>
          <div>
            <SectionHeading eyebrow="Where we start" title="Rooted in Odisha, built to extend further" className="max-w-none" />
            <p className="mt-4 flex items-start gap-2 text-sm leading-relaxed text-muted">
              <Globe2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
              Our initial focus is students and families across Odisha, with an early international lens on Europe.
              The platform is designed to extend to more regions and destinations over time.
            </p>
          </div>
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading eyebrow="How we operate" title="Operating principles" />
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {PRINCIPLES.map(({ icon: Icon, title, description }) => (
            <Card key={title}>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
                <Icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-primary">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section tone="surface">
        <SectionHeading eyebrow="Who's behind this" title="Our team" />
        <p className="mt-3 max-w-2xl text-sm text-muted">
          We won&apos;t invent founder biographies or credentials. Verified team information will appear here as
          it&apos;s confirmed.
        </p>
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {TEAM_PLACEHOLDERS.map((member) => (
            <Card key={member.roleTitle}>
              <p className="text-base font-semibold text-primary">{member.roleTitle}</p>
              <div className="mt-3">
                <TrustBadge status={member.status} />
              </div>
              <p className="mt-3 text-sm text-muted">{member.note}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section tone="muted">
        <Card>
          <h2 className="text-lg font-semibold text-primary">Mission versus what&apos;s live today</h2>
          <p className="mt-2 text-sm leading-relaxed text-text-soft">
            This website reflects our Milestone 1 build: a public website and UI foundation with mock content and
            frontend-only interactions. Features described as future plans — like the full career assessment, an
            application tracker, or an AI recommendation engine — are not yet functional. We&apos;d rather be clear about
            that than let the site imply otherwise.
          </p>
          <p className="mt-4 text-sm text-text-soft">
            Read more about how we intend to earn trust on our{" "}
            <Link href="/trust" className="text-secondary-dark underline underline-offset-2">
              Trust Center
            </Link>
            .
          </p>
        </Card>
      </Section>

      <CTASection />
    </>
  );
}
