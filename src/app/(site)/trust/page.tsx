import type { Metadata } from "next";
import { publicPageMetadata } from "@/config/seo";
import Link from "next/link";
import { Fingerprint, Handshake, Lock, Mail, Phone, ScrollText, ShieldOff } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Card } from "@/components/ui/Card";
import { PageHero } from "@/components/sections/PageHero";
import { CTASection } from "@/components/sections/CTASection";
import { FaqAccordion } from "@/components/sections/FaqAccordion";
import { DATA_PROTECTION_PRINCIPLES, PAYMENT_PROTECTION_STEPS, WE_NEVER_PROMISE, WE_PROMISE } from "@/data/trust";
import { TRUST_FAQS } from "@/data/faqs";
import { CONTACT_PEOPLE, OFFICIAL_CONTACT } from "@/config/contact";

export const metadata: Metadata = publicPageMetadata(
  "/trust",
  "Trust Center",
  "Who to contact, how payments and refunds work, and our no-guarantees policy — trust made visible, not just claimed.",
);

/**
 * V5.6.2 public launch: removed the unverified company rows, the unfilled team roles, the sample agreement with
 * its disabled download, the future application tracker and the pending-legal-review wording. What remains is
 * true of the service today. See docs/release/V562-LEGAL-REVIEW.md for what the owner still has to confirm.
 */
export default function TrustCenterPage() {
  return (
    <>
      <PageHero
        eyebrow="Trust Center"
        title="Trust should be verifiable, not requested."
        description="Who to contact, how paid services and refunds work, and what we will never promise. Where something isn't in place yet, we say so."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Trust Center" }]}
      />

      <Section tone="surface">
        <SectionHeading eyebrow="Contact" title="Talk to the people responsible" />
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
        <p className="mt-6 text-sm text-muted">
          To raise a concern, write to either founder or call. We&apos;ll reply in writing.
        </p>
      </Section>

      <Section tone="muted">
        <SectionHeading eyebrow="Payments" title="How paid services work" />
        <p className="mt-3 max-w-2xl text-sm text-muted">
          You can&apos;t pay on this website: online payment isn&apos;t open. For any paid service, this is what happens
          before you pay.
        </p>
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
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
        <Card className="mt-5 flex items-start gap-3">
          <ScrollText aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
          <p className="text-sm leading-relaxed text-text-soft">
            The written agreement names the service, the fee, what is and isn&apos;t included, and the refund and
            cancellation terms. Read the{" "}
            <Link href="/refund-policy" className="text-secondary-dark underline underline-offset-2">
              Refund Policy
            </Link>
            .
          </p>
        </Card>
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
        <SectionHeading eyebrow="Your data" title="How we handle your information" />
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {DATA_PROTECTION_PRINCIPLES.map((item) => (
            <li key={item} className="flex items-start gap-3 rounded-[var(--radius-control)] border border-border bg-surface p-4 text-sm text-text-soft">
              <Lock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-5 text-sm text-muted">
          Read the{" "}
          <Link href="/privacy" className="text-secondary-dark underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </p>
      </Section>

      <Section tone="muted">
        <SectionHeading eyebrow="Questions" title="Trust Center FAQ" align="center" className="mx-auto" />
        <div className="mx-auto mt-10 max-w-2xl">
          <FaqAccordion items={TRUST_FAQS} />
        </div>
      </Section>

      <CTASection />
    </>
  );
}
