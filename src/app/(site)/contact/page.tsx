import type { Metadata } from "next";
import { publicPageMetadata } from "@/config/seo";
import { CalendarCheck, GraduationCap, Handshake, Mail, Phone, Siren, UsersRound } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Card } from "@/components/ui/Card";
import { PageHero } from "@/components/sections/PageHero";
import { LinkButton } from "@/components/ui/Button";
import { ContactEmailComposer } from "@/components/sections/contact/ContactEmailComposer";
import { CONTACT_PURPOSES } from "@/data/contact";
import { BRAND_NAME, CONTACT, DISCOVERY_SESSION_CTA } from "@/config/site";

export const metadata: Metadata = publicPageMetadata(
  "/contact",
  "Contact",
  `Reach ${BRAND_NAME} by email or phone for student guidance, parent questions, partnership enquiries, or complaints.`,
);

const ICONS = {
  student: GraduationCap,
  parent: UsersRound,
  partner: Handshake,
  complaint: Siren,
} as const;

/**
 * CIUX-01 — the contact page, built from the official details in
 * src/config/contact.ts (founder and co-founder e-mail, the official phone
 * number) as working mailto:/tel: links. No office address, opening hours,
 * response-time promise or WhatsApp channel is shown: none is approved.
 */
export default function ContactPage() {
  return (
    <>
      <PageHero
        title="Talk to the people who run Nextwise"
        description="Email the founders directly or call us. For career and study guidance, the quickest start is a free Discovery Session."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Contact" }]}
      />

      <Section tone="surface">
        <ul className="grid gap-4 md:grid-cols-3">
          {CONTACT.people.map((person) => (
            <li key={person.email}>
              <a
                href={person.mailto}
                className="group flex h-full flex-col rounded-[var(--radius-card)] border border-primary/10 bg-surface p-6 transition-[box-shadow,border-color,transform] duration-[var(--duration-base)] hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-lifted motion-reduce:transform-none"
              >
                <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--brand-coral-pale)] text-[var(--brand-coral-strong)]">
                  <Mail className="h-5 w-5" />
                </span>
                <span className="mt-5 text-sm font-semibold text-secondary-dark">{person.role}</span>
                <span className="mt-1 break-all font-display text-lg font-semibold text-primary underline-offset-4 group-hover:underline">
                  {person.email}
                </span>
                <span className="mt-auto pt-4 text-[13px] text-muted">Opens your email app</span>
              </a>
            </li>
          ))}
          <li>
            <a
              href={CONTACT.phone.tel}
              className="group flex h-full flex-col rounded-[var(--radius-card)] border border-primary/10 bg-surface p-6 transition-[box-shadow,border-color,transform] duration-[var(--duration-base)] hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-lifted motion-reduce:transform-none"
            >
              <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--brand-ice-pale)] text-primary">
                <Phone className="h-5 w-5" />
              </span>
              <span className="mt-5 text-sm font-semibold text-secondary-dark">Phone</span>
              <span className="mt-1 font-display text-lg font-semibold text-primary underline-offset-4 group-hover:underline">
                {CONTACT.phone.display}
              </span>
              <span className="mt-auto pt-4 text-[13px] text-muted">Tap to call on a phone</span>
            </a>
          </li>
        </ul>
        <p className="mt-6 max-w-2xl text-[15px] text-muted">{CONTACT.cityStatement}</p>
      </Section>

      <Section tone="muted">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.15fr] lg:items-start">
          <div>
            <SectionHeading eyebrow="What to write about" title="We can help with" className="max-w-none" />
            <ul className="mt-6 grid gap-4 sm:grid-cols-2">
              {CONTACT_PURPOSES.map((purpose) => {
                const Icon = ICONS[purpose.icon];
                return (
                  <li key={purpose.title}>
                    <Card className="h-full">
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--brand-ice-pale)] text-primary">
                        <Icon aria-hidden="true" className="h-5 w-5" />
                      </span>
                      <h3 className="mt-4 font-sans text-base font-semibold tracking-normal text-primary">{purpose.title}</h3>
                      <p className="mt-2 text-sm text-muted">{purpose.description}</p>
                    </Card>
                  </li>
                );
              })}
            </ul>
            <div className="mt-8 rounded-[var(--radius-card)] bg-ink p-6 text-on-ink">
              <p className="font-display text-lg font-semibold text-on-ink">Planning your studies or career?</p>
              <p className="mt-2 text-[15px] text-on-ink-muted">{DISCOVERY_SESSION_CTA.description}</p>
              <LinkButton
                href={DISCOVERY_SESSION_CTA.href}
                className="mt-5"
                icon={<CalendarCheck aria-hidden="true" className="h-4 w-4" />}
              >
                {DISCOVERY_SESSION_CTA.label}
              </LinkButton>
            </div>
          </div>
          <ContactEmailComposer />
        </div>
      </Section>
    </>
  );
}
