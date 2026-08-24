import type { Metadata } from "next";
import { GraduationCap, Handshake, Siren, UsersRound } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Card } from "@/components/ui/Card";
import { PageHero } from "@/components/sections/PageHero";
import { ContactForm } from "@/components/sections/contact/ContactForm";
import { CONTACT_PURPOSES } from "@/data/contact";
import { CONTACT } from "@/config/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "Reach CareerPath AI for student guidance, parent questions, partnership enquiries, or complaints.",
};

const ICONS = {
  student: GraduationCap,
  parent: UsersRound,
  partner: Handshake,
  complaint: Siren,
} as const;

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Get in touch"
        description="Whether you have a quick question or want to raise a concern, here's how to reach us."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Contact" }]}
      />

      <Section tone="surface">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {CONTACT_PURPOSES.map((purpose) => {
            const Icon = ICONS[purpose.icon];
            return (
              <Card key={purpose.title}>
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-primary">{purpose.title}</h3>
                <p className="mt-2 text-sm text-muted">{purpose.description}</p>
              </Card>
            );
          })}
        </div>
      </Section>

      <Section tone="muted">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <SectionHeading eyebrow="Send a message" title="Tell us what you need" className="max-w-none" />
            <div className="mt-6">
              <ContactForm />
            </div>
          </div>
          <div>
            <SectionHeading eyebrow="Other ways to reach us" title="Contact details" className="max-w-none" />
            <Card className="mt-6 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Email</p>
                <p className="mt-1 text-sm text-text-soft">{CONTACT.emailLabel}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Phone</p>
                <p className="mt-1 text-sm text-text-soft">{CONTACT.phoneLabel}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Support hours</p>
                <p className="mt-1 text-sm text-text-soft">{CONTACT.supportHours}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Where we work</p>
                <p className="mt-1 text-sm text-text-soft">{CONTACT.cityStatement}</p>
              </div>
            </Card>
          </div>
        </div>
      </Section>
    </>
  );
}
