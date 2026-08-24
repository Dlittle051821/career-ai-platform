import type { Metadata } from "next";
import Link from "next/link";
import { HeartHandshake, MessageSquareText, ShieldAlert, ShieldOff, Wallet } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHero } from "@/components/sections/PageHero";
import { CTASection } from "@/components/sections/CTASection";
import { ComingSoon } from "@/components/ui/ComingSoon";
import { FaqAccordion } from "@/components/sections/FaqAccordion";
import { PARENTS_FAQS } from "@/data/faqs";
import { APPLICATION_STATUS_PREVIEW } from "@/data/trust";
import { COST_PLANNING_FRAMEWORK, FAMILY_QUESTIONS, FRAUD_WARNING_SIGNS, PARENT_PARTICIPATION } from "@/data/parents";

export const metadata: Metadata = {
  title: "For Parents",
  description:
    "Cost planning, questions to ask, fraud warning signs, and how CareerPath AI intends to document scope, payments, and refunds for families.",
};

export default function ParentsPage() {
  return (
    <>
      <PageHero
        eyebrow="For parents"
        title="Your questions about cost and safety deserve straight answers"
        description="Choosing a career and education pathway involves real money and real risk. This page is written for you — not to sell you something, but to help you ask the right questions."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "For Parents" }]}
      />

      <Section tone="surface">
        <SectionHeading eyebrow="Before you talk to anyone" title="Questions every family should ask" />
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {FAMILY_QUESTIONS.map((question) => (
            <li key={question} className="flex items-start gap-3 rounded-[var(--radius-control)] border border-border bg-surface p-4 text-sm text-text-soft">
              <MessageSquareText aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
              {question}
            </li>
          ))}
        </ul>
      </Section>

      <Section tone="muted">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="Staying involved" title="How you can participate" className="max-w-none" />
            <ul className="mt-6 space-y-3">
              {PARENT_PARTICIPATION.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-text-soft">
                  <HeartHandshake aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <SectionHeading eyebrow="Planning ahead" title="Education-cost planning framework" className="max-w-none" />
            <ul className="mt-6 space-y-3">
              {COST_PLANNING_FRAMEWORK.map((item) => (
                <li key={item.label} className="rounded-[var(--radius-control)] border border-border bg-surface p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <Wallet aria-hidden="true" className="h-4 w-4 text-secondary" />
                    {item.label}
                  </p>
                  <p className="mt-1 text-sm text-muted">{item.note}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section tone="surface">
        <SectionHeading eyebrow="Protect your family" title="Warning signs of irresponsible consultancies" />
        <div className="mt-8 rounded-[var(--radius-card)] border border-error/20 bg-error-light p-6">
          <ul className="grid gap-3 sm:grid-cols-2">
            {FRAUD_WARNING_SIGNS.map((sign) => (
              <li key={sign} className="flex items-start gap-3 text-sm text-error">
                <ShieldAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                {sign}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading eyebrow="How we intend to work" title="Documenting scope, payments, and refunds" />
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <Card>
            <p className="text-sm leading-relaxed text-text-soft">
              Before any payment, we intend to share a written service scope, an itemised fee breakdown, and clear
              refund conditions. A future service agreement will identify both parties, the fee, responsibilities,
              exclusions, and dispute process.
            </p>
          </Card>
          <Card>
            <p className="text-sm leading-relaxed text-text-soft">
              <span className="font-semibold text-primary">Important: </span>
              A service agreement on stamp paper is not itself a government guarantee. Enforceability depends on
              applicable law and careful drafting — our final legal documents will be professionally reviewed before
              commercial launch.
            </p>
          </Card>
        </div>
        <div className="mt-6">
          <Badge tone="warning">Planned protection framework — not yet legally finalised</Badge>
        </div>
      </Section>

      <Section tone="surface">
        <SectionHeading eyebrow="Coming later" title="Visibility into your child's progress" />
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-start">
          <ComingSoon
            title="Parent progress dashboard"
            description="A future feature will let parents see where an application stands — for example: planned, documents pending, submitted, institution response, decision. This is a product preview, not a live feature."
          />
          <ul className="flex flex-wrap gap-2">
            {APPLICATION_STATUS_PREVIEW.map((status) => (
              <li key={status}>
                <Badge tone="info">{status}</Badge>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section tone="muted">
        <Card className="flex items-start gap-4 border-error/20 bg-error-light">
          <ShieldOff aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-error" />
          <div>
            <h2 className="text-lg font-semibold text-primary">What we will never promise</h2>
            <p className="mt-2 text-sm leading-relaxed text-text-soft">
              We will never guarantee admission, scholarship, visa approval, or a job. Anyone who does is making a
              promise they cannot keep. See our{" "}
              <Link href="/trust" className="text-secondary-dark underline underline-offset-2">
                Trust Center
              </Link>{" "}
              for our full no-guarantees policy.
            </p>
          </div>
        </Card>
      </Section>

      <Section tone="surface">
        <SectionHeading eyebrow="Questions" title="Parent FAQ" align="center" className="mx-auto" />
        <div className="mx-auto mt-10 max-w-2xl">
          <FaqAccordion items={PARENTS_FAQS} />
        </div>
      </Section>

      <CTASection
        title="Book a family counselling call"
        description="Bring your questions — both parents and students are welcome on the call."
        primaryLabel="Book a family counselling call"
      />
    </>
  );
}
