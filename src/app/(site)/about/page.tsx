import type { Metadata } from "next";
import { publicPageMetadata } from "@/config/seo";
import Link from "next/link";
import { Compass, Globe2, Mail, Phone, ScaleIcon, Users } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Card } from "@/components/ui/Card";
import { PageHero } from "@/components/sections/PageHero";
import { CTASection } from "@/components/sections/CTASection";
import { CONTACT_PEOPLE, OFFICIAL_CONTACT } from "@/config/contact";
import { isPublicMarketingMode } from "@/lib/launch/launch-mode";
import { BRAND_NAME } from "@/config/site";

export const metadata: Metadata = publicPageMetadata(
  "/about",
  "About",
  `Why career-first guidance matters, ${BRAND_NAME}'s Odisha focus, our operating principles, and an honest look at what's built so far.`,
);

const PRINCIPLES = [
  { icon: Compass, title: "Career before course", description: "We start from where a student is headed, not which course is trending this year." },
  { icon: ScaleIcon, title: "Transparency over persuasion", description: "We'd rather explain trade-offs honestly than oversell a single option." },
  { icon: Users, title: "Families decide together", description: "Students and parents are both part of the conversation, not just the payer and the customer." },
];

export default function AboutPage() {
  const publicLaunch = isPublicMarketingMode();
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
        {/* V5.6.2 public launch: the unverified team cards are replaced by the
            people who can be reached today. No names, photographs or credentials are published until the owner
            approves them (docs/release/V562-LEGAL-REVIEW.md). */}
        <SectionHeading eyebrow="Who's behind this" title="Talk to the founders" />
        <p className="mt-3 max-w-2xl text-sm text-muted">
          {BRAND_NAME} is founder-led. Write to either founder or call, and you&apos;ll speak with the people
          responsible for the service.
        </p>
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {CONTACT_PEOPLE.map((person) => (
            <Card key={person.email}>
              <p className="text-base font-semibold text-primary">{person.role}</p>
              <a href={person.mailto} className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-link underline underline-offset-2">
                <Mail aria-hidden="true" className="h-4 w-4" />
                {person.email}
              </a>
            </Card>
          ))}
          <Card>
            <p className="text-base font-semibold text-primary">Phone</p>
            <a href={OFFICIAL_CONTACT.phone.tel} className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-link underline underline-offset-2">
              <Phone aria-hidden="true" className="h-4 w-4" />
              {OFFICIAL_CONTACT.phone.display}
            </a>
          </Card>
        </div>
      </Section>

      <Section tone="muted">
        <Card>
          <h2 className="text-lg font-semibold text-primary">Mission versus what&apos;s live today</h2>
          {publicLaunch ? (
            <p className="mt-2 text-sm leading-relaxed text-text-soft">
              Today this website shares career and education information, and we arrange the free Discovery Session by
              email or phone. Online accounts, booking, applications and payments are not open on the website yet. The
              career discovery questions reflect your own answers back to you; they don&apos;t run a scored,
              personalised AI assessment. We&apos;d rather be clear about that than let the site imply otherwise.
            </p>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-text-soft">
              Account creation, student applications, discovery sessions, counselling, and payments on this site are
              real, not a mock-up. What is not yet live is a student-facing AI recommendation engine — the career
              discovery preview on this site today reflects your own answers back to you; it does not run a scored,
              personalised AI assessment yet. We&apos;d rather be clear about that than let the site imply otherwise.
            </p>
          )}
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
