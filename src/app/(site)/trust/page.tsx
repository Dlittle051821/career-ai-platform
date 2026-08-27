import type { Metadata } from "next";
import Link from "next/link";
import { Download, Fingerprint, Handshake, Lock, ScrollText, ShieldOff, Siren } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TrustBadge } from "@/components/ui/TrustBadge";
import { PageHero } from "@/components/sections/PageHero";
import { CTASection } from "@/components/sections/CTASection";
import { FaqAccordion } from "@/components/sections/FaqAccordion";
import { ComingSoon } from "@/components/ui/ComingSoon";
import { DemoNotice } from "@/components/ui/DemoNotice";
import {
  APPLICATION_STATUS_PREVIEW,
  COMPANY_VERIFICATION_ITEMS,
  DATA_PROTECTION_PRINCIPLES,
  ESCALATION_STEPS,
  PAYMENT_PROTECTION_STEPS,
  TEAM_PLACEHOLDERS,
  WE_NEVER_PROMISE,
  WE_PROMISE,
} from "@/data/trust";
import { TRUST_FAQS } from "@/data/faqs";
import { LEGAL_STATUS } from "@/config/site";

export const metadata: Metadata = {
  title: "Trust Center",
  description:
    "Verification status, payment protection, refund and escalation processes, and our no-guarantees policy — trust made visible, not just claimed.",
};

export default function TrustCenterPage() {
  return (
    <>
      <PageHero
        eyebrow="Trust Center"
        title="Trust should be verifiable, not requested."
        description="This page is meant to show who we are, how our services work, what fees cover, and what happens if something goes wrong. Where something isn't verified yet, we say so."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Trust Center" }]}
      />

      <Section tone="surface">
        <SectionHeading eyebrow="Company" title="Verify the company" />
        <div className="mt-8 divide-y divide-border rounded-[var(--radius-card)] border border-border bg-surface">
          {COMPANY_VERIFICATION_ITEMS.map((item) => (
            <div key={item.label} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <p className="text-sm font-semibold text-primary">{item.label}</p>
                <p className="text-sm text-muted">{item.value}</p>
              </div>
              <TrustBadge status={item.status} />
            </div>
          ))}
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading eyebrow="Team" title="Meet the people responsible" />
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {TEAM_PLACEHOLDERS.map((member) => (
            <Card key={member.roleTitle}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-base font-semibold text-primary">{member.roleTitle}</p>
              </div>
              <div className="mt-3">
                <TrustBadge status={member.status} />
              </div>
              <p className="mt-3 text-sm text-muted">{member.note}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section tone="surface">
        <SectionHeading eyebrow="Payments" title="How payment protection is planned" />
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {PAYMENT_PROTECTION_STEPS.map((step) => (
            <Card key={step.title} className="flex items-start gap-3">
              <Handshake aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
              <div>
                <p className="text-sm font-semibold text-primary">{step.title}</p>
                <p className="mt-1 text-sm text-muted">{step.description}</p>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading eyebrow="Agreements" title="The service agreement concept" />
        <Card className="mt-8 flex items-start gap-3">
          <ScrollText aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
          <p className="text-sm leading-relaxed text-text-soft">
            Families will receive a written agreement identifying both parties, the fee, service scope,
            responsibilities, exclusions, refund triggers, and dispute process — before any payment is finalised.
          </p>
        </Card>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col items-start gap-3 rounded-[var(--radius-card)] border border-dashed border-border-strong bg-surface-alt p-6">
            <Badge tone="neutral">
              <Download aria-hidden="true" className="h-3.5 w-3.5" />
              Sample agreement
            </Badge>
            <p className="text-base font-semibold text-primary">Coming after legal review</p>
            <button
              type="button"
              disabled
              className="inline-flex cursor-not-allowed items-center gap-2 rounded-[var(--radius-control)] border border-border-strong px-4 py-2 text-sm font-medium text-muted opacity-60"
            >
              <Download aria-hidden="true" className="h-4 w-4" />
              Download sample (unavailable)
            </button>
          </div>
          <Card className="flex items-start gap-3 border-warning/25 bg-warning-light">
            <ShieldOff aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <p className="text-sm leading-relaxed text-text-soft">
              Stamp paper does not equal a government guarantee. Enforceability depends on applicable law and careful
              drafting — our documents will be professionally reviewed before commercial launch.
            </p>
          </Card>
        </div>
      </Section>

      <Section tone="surface">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="Our commitments" title="What we promise" className="max-w-none" />
            <ul className="mt-6 space-y-3">
              {WE_PROMISE.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-text-soft">
                  <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <SectionHeading eyebrow="No exceptions" title="What we never promise" className="max-w-none" />
            <ul className="mt-6 space-y-3">
              {WE_NEVER_PROMISE.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-text-soft">
                  <ShieldOff aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-error" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading eyebrow="Transparency" title="How recommendations and commissions work" />
        <Card className="mt-8 flex items-start gap-3">
          <Fingerprint aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
          <p className="text-sm leading-relaxed text-text-soft">
            Our intended policy is straightforward: a commercial relationship relevant to a recommendation — such as
            a referral arrangement with an institution — should never be hidden from your family. This disclosure
            policy is not yet finalised or independently audited, and we won&apos;t claim otherwise.
          </p>
        </Card>
      </Section>

      <Section tone="surface">
        <SectionHeading eyebrow="Coming later" title="Application progress visibility" />
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-start">
          <ComingSoon
            title="Track your application status"
            description="A future product feature will let you see where things stand at a glance. Shown below is a preview of the planned statuses — not a live tracker."
          />
          <ol className="flex flex-wrap gap-2">
            {APPLICATION_STATUS_PREVIEW.map((status) => (
              <li key={status}>
                <Badge tone="info">{status}</Badge>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading eyebrow="If things go wrong" title="Refund and cancellation process" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {["Request", "Acknowledgement", "Review", "Written decision", "Applicable refund"].map((step, index) => (
            <Card key={step} className="text-center">
              <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-on-primary">
                {index + 1}
              </span>
              <p className="mt-3 text-sm font-medium text-text-soft">{step}</p>
            </Card>
          ))}
        </div>
        <p className="mt-5 text-sm text-muted">
          See the full{" "}
          <Link href="/refund-policy" className="text-secondary-dark underline underline-offset-2">
            Refund Policy
          </Link>{" "}
          placeholder for the categories the final policy will cover.
        </p>
      </Section>

      <Section tone="surface">
        <SectionHeading eyebrow="Have a concern" title="Complaint and escalation path" />
        <ol className="mt-8 grid gap-5 sm:grid-cols-3">
          {ESCALATION_STEPS.map((step) => (
            <li key={step.step}>
              <Card className="flex h-full items-start gap-3">
                <Siren aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                <div>
                  <p className="text-sm font-semibold text-primary">{step.step}</p>
                  <p className="mt-1 text-sm text-muted">{step.description}</p>
                </div>
              </Card>
            </li>
          ))}
        </ol>
        <DemoNotice className="mt-6">
          Contact details for escalation remain placeholders until verified — see the Contact page for what&apos;s
          currently available.
        </DemoNotice>
      </Section>

      <Section tone="muted">
        <SectionHeading eyebrow="Your data" title="Data and document protection" />
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {DATA_PROTECTION_PRINCIPLES.map((item) => (
            <li key={item} className="flex items-start gap-3 rounded-[var(--radius-control)] border border-border bg-surface p-4 text-sm text-text-soft">
              <Lock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-5 text-xs text-muted">Last updated: {LEGAL_STATUS.lastUpdated}</p>
      </Section>

      <Section tone="surface">
        <SectionHeading eyebrow="Questions" title="Trust Center FAQ" align="center" className="mx-auto" />
        <div className="mx-auto mt-10 max-w-2xl">
          <FaqAccordion items={TRUST_FAQS} />
        </div>
      </Section>

      <CTASection />
    </>
  );
}
