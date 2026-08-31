import type { Metadata } from "next";
import { Cpu, UserCheck, ClipboardList, TriangleAlert } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Card } from "@/components/ui/Card";
import { PageHero } from "@/components/sections/PageHero";
import { JourneySteps } from "@/components/sections/JourneySteps";
import { FaqAccordion } from "@/components/sections/FaqAccordion";
import { CTASection } from "@/components/sections/CTASection";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { JOURNEY_STAGES } from "@/data/journey";
import { HOME_FAQS } from "@/data/faqs";
import { BRAND_NAME } from "@/config/site";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "See the full career-first journey — from understanding yourself to job readiness — and what's available free versus with paid support.",
};

const TECH_VS_HUMAN = [
  {
    icon: Cpu,
    title: "Where technology helps",
    points: [
      "Organising your goals, notes, and shortlist in one place",
      "Structuring comparisons across careers, courses, and countries",
      "Surfacing a broad library of options to consider (in development)",
    ],
  },
  {
    icon: UserCheck,
    title: "Where a human counsellor helps",
    points: [
      "Interpreting your specific situation and trade-offs",
      "Answering nuanced questions technology can't reliably judge",
      "Supporting you and your family through decisions and setbacks",
    ],
  },
];

const YOU_PROVIDE = [
  "Honest information about your academics, interests, and constraints",
  "Timely documents needed for shortlisting and applications",
  "Decisions at each stage — we support the process, not replace your judgment",
  "Availability for counselling touchpoints relevant to your package",
];

const LIMITATIONS = [
  "We don't control admission, visa, scholarship, or hiring decisions — those rest with institutions, authorities, and employers.",
  "Timelines depend on external processes (institutions, embassies) that can change without notice.",
  "Some tools described here, like the full career-discovery assessment, are still in development.",
  "Guidance is based on information available at the time; always verify critical details with official sources.",
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        eyebrow="How it works"
        title="One connected journey from career clarity to job readiness"
        description={`${BRAND_NAME} is built as a modular journey. Move through it stage by stage, using free resources and paid support where it helps most.`}
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "How It Works" }]}
      />

      <Section tone="surface">
        <SectionHeading eyebrow="The full journey" title="Ten stages, one connected plan" />
        <div className="mt-10">
          <JourneySteps stages={JOURNEY_STAGES} variant="detailed" />
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading eyebrow="How support is delivered" title="Technology and people, working together" />
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {TECH_VS_HUMAN.map(({ icon: Icon, title, points }) => (
            <Card key={title}>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
                <Icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-primary">{title}</h3>
              <ul className="mt-3 space-y-2 text-sm text-text-soft">
                {points.map((point) => (
                  <li key={point}>• {point}</li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </Section>

      <Section tone="surface">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <SectionHeading
              eyebrow="Your part in it"
              title="What we ask you to provide"
              className="max-w-none"
              as="h2"
            />
            <ul className="mt-6 space-y-3">
              {YOU_PROVIDE.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-text-soft">
                  <ClipboardList aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <SectionHeading
              eyebrow="Being upfront"
              title="Honest limitations"
              className="max-w-none"
              as="h2"
            />
            <ul className="mt-6 space-y-3">
              {LIMITATIONS.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-text-soft">
                  <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  {item}
                </li>
              ))}
            </ul>
            <DemoNotice className="mt-5">
              This page describes the intended service model. Some features, like the full assessment engine, are
              still in development in this milestone.
            </DemoNotice>
          </div>
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading eyebrow="Questions" title="Frequently asked questions" align="center" className="mx-auto" />
        <div className="mx-auto mt-10 max-w-2xl">
          <FaqAccordion items={HOME_FAQS} />
        </div>
      </Section>

      <CTASection />
    </>
  );
}
