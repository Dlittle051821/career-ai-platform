import type { Metadata } from "next";
import { CircleCheck, LifeBuoy, TriangleAlert } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHero } from "@/components/sections/PageHero";
import { CTASection } from "@/components/sections/CTASection";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { STUDY_OPTIONS_FAQS } from "@/data/faqs";
import { FaqAccordion } from "@/components/sections/FaqAccordion";
import {
  COMPARISON_CRITERIA,
  COST_CATEGORIES,
  COURSE_SELECTION_CHECKLIST,
  PATHWAY_CARDS,
} from "@/data/study-options";

export const metadata: Metadata = {
  title: "India and Abroad Study Options",
  description:
    "Compare India, Europe, and other international study pathways on career fit, cost, and realistic outcomes — not marketing claims.",
};

export default function StudyOptionsPage() {
  return (
    <>
      <PageHero
        eyebrow="Study options"
        title="Comparing India and abroad, honestly"
        description="We're not here to push every student abroad. This page helps you compare pathways on the categories that actually affect your outcome and budget."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Study Options" }]}
      />

      <Section tone="surface">
        <SectionHeading eyebrow="How we compare" title="Comparison criteria we use" />
        <ul className="mt-6 flex flex-wrap gap-3">
          {COMPARISON_CRITERIA.map((criterion) => (
            <li key={criterion}>
              <Badge tone="info">{criterion}</Badge>
            </li>
          ))}
        </ul>
      </Section>

      <Section tone="muted">
        <SectionHeading eyebrow="Pathways" title="Where students in Odisha typically look" />
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {PATHWAY_CARDS.map((pathway) => (
            <Card key={pathway.id} className="flex h-full flex-col">
              <h3 className="text-lg font-semibold text-primary">{pathway.title}</h3>
              <p className="mt-2 text-sm text-muted">{pathway.summary}</p>
              <ul className="mt-4 flex-1 space-y-2">
                {pathway.points.map((point) => (
                  <li key={point} className="flex items-start gap-2 text-sm text-text-soft">
                    <CircleCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                    {point}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </Section>

      <Section tone="surface">
        <SectionHeading eyebrow="Choosing a course" title="A checklist worth working through" />
        <ol className="mt-8 grid gap-3 sm:grid-cols-2">
          {COURSE_SELECTION_CHECKLIST.map((item, index) => (
            <li key={item} className="flex items-start gap-3 rounded-[var(--radius-control)] border border-border bg-surface p-4 text-sm text-text-soft">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary-light text-xs font-semibold text-secondary-dark">
                {index + 1}
              </span>
              {item}
            </li>
          ))}
        </ol>
      </Section>

      <Section tone="muted">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="Budgeting" title="Total-cost planning categories" className="max-w-none" />
            <ul className="mt-6 space-y-3">
              {COST_CATEGORIES.map((category) => (
                <li key={category.label} className="rounded-[var(--radius-control)] border border-border bg-surface p-4">
                  <p className="text-sm font-semibold text-primary">{category.label}</p>
                  <p className="mt-1 text-sm text-muted">{category.note}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <SectionHeading eyebrow="Return on investment" title="Understand ROI without the false promises" className="max-w-none" />
            <Card className="mt-6 flex items-start gap-3">
              <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              <p className="text-sm leading-relaxed text-text-soft">
                A degree can improve your odds, but salary and employment outcomes are never guaranteed by any
                institution or consultancy. Treat ROI as a planning exercise — comparing realistic cost against
                realistic prospects — not a promise.
              </p>
            </Card>

            <Card className="mt-6 flex items-start gap-3">
              <LifeBuoy aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
              <div>
                <p className="text-sm font-semibold text-primary">Always have a backup plan</p>
                <p className="mt-1 text-sm leading-relaxed text-text-soft">
                  Visa decisions, admission outcomes, and job markets can shift. A resilient plan considers what
                  happens if your first-choice pathway doesn&apos;t work out — a backup course, country, or timeline.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </Section>

      <Section tone="surface">
        <SectionHeading eyebrow="Illustrative UI" title="What a personalised comparison could look like" />
        <DemoNotice className="mt-4">
          This is a sample layout only. Your actual comparison would be calculated from your specific shortlist
          during counselling — no figures are fabricated here.
        </DemoNotice>
        <Card className="mt-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {["Career fit", "Total cost", "Work exposure"].map((label) => (
              <div key={label} className="rounded-[var(--radius-control)] bg-surface-alt p-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
                <p className="mt-2 text-sm font-medium text-text-soft">Calculated from selected pathway</p>
              </div>
            ))}
          </div>
        </Card>
      </Section>

      <Section tone="muted">
        <SectionHeading eyebrow="Questions" title="Study options FAQ" align="center" className="mx-auto" />
        <div className="mx-auto mt-10 max-w-2xl">
          <FaqAccordion items={STUDY_OPTIONS_FAQS} />
        </div>
      </Section>

      <CTASection />
    </>
  );
}
