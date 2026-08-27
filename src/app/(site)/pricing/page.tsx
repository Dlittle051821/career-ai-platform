import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Card } from "@/components/ui/Card";
import { PageHero } from "@/components/sections/PageHero";
import { CTASection } from "@/components/sections/CTASection";
import { PricingCard } from "@/components/sections/PricingCard";
import { ComparisonTable } from "@/components/sections/ComparisonTable";
import { FaqAccordion } from "@/components/sections/FaqAccordion";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { PRICING_DISCLOSURE, PRICING_PACKAGES } from "@/data/pricing";
import { PRICING_FAQS } from "@/data/faqs";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Provisional, sample pricing for three CareerPath AI packages — Admit, Global, and Global 360 — with full scope shared before payment.",
};

// Explicit, fully-expanded feature set per package (each tier includes everything
// from the one before it) so the comparison table doesn't rely on parsing the
// "Everything in X" shorthand used in the marketing copy.
const PACKAGE_FEATURES: Record<string, string[]> = {
  admit: [
    "Profile review",
    "Course and university shortlist support",
    "Application-planning support",
    "Document checklist",
    "Defined counselling touchpoints",
  ],
  global: [
    "Profile review",
    "Course and university shortlist support",
    "Application-planning support",
    "Document checklist",
    "Defined counselling touchpoints",
    "Deeper country/pathway comparison",
    "Finance and application planning",
    "Visa-preparation guidance",
    "Pre-departure planning",
  ],
  "global-360": [
    "Profile review",
    "Course and university shortlist support",
    "Application-planning support",
    "Document checklist",
    "Defined counselling touchpoints",
    "Deeper country/pathway comparison",
    "Finance and application planning",
    "Visa-preparation guidance",
    "Pre-departure planning",
    "Higher-touch end-to-end coordination",
    "Skills and employability roadmap",
    "Internship/job-readiness planning",
    "Parent progress reviews",
  ],
};

const ALL_FEATURES = PACKAGE_FEATURES["global-360"] ?? [];

export default function PricingPage() {
  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title="Provisional packages to help you plan"
        description="These prices are sample and provisional. Final scope, taxes, and refund terms are confirmed in writing before you pay anything."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Pricing" }]}
      >
        <DemoNotice>
          Buttons on this page lead to a free counselling booking, not to payment. We don&apos;t take payment in this
          milestone.
        </DemoNotice>
      </PageHero>

      <Section tone="surface">
        <div className="grid gap-6 lg:grid-cols-3">
          {PRICING_PACKAGES.map((pkg, index) => (
            <PricingCard key={pkg.id} pkg={pkg} highlight={index === 1} />
          ))}
        </div>
        <Card className="mt-8">
          <ul className="space-y-2 text-sm text-text-soft">
            {PRICING_DISCLOSURE.map((line) => (
              <li key={line} className="flex items-start gap-2">
                <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" />
                {line}
              </li>
            ))}
          </ul>
        </Card>
      </Section>

      <Section tone="muted">
        <SectionHeading eyebrow="Compare packages" title="What each package includes" />
        <div className="mt-8">
          <ComparisonTable
            caption="Feature comparison across Admit, Global, and Global 360 packages"
            columns={PRICING_PACKAGES.map((pkg) => pkg.name)}
            rows={ALL_FEATURES.map((feature) => ({
              label: feature,
              values: PRICING_PACKAGES.map((pkg) =>
                PACKAGE_FEATURES[pkg.id]?.includes(feature) ? (
                  <span key={pkg.id} className="inline-flex items-center gap-1.5 text-secondary-dark">
                    <Check aria-hidden="true" className="h-4 w-4" /> Included
                  </span>
                ) : (
                  <span key={pkg.id} className="inline-flex items-center gap-1.5 text-muted">
                    <Minus aria-hidden="true" className="h-4 w-4" /> Not included
                  </span>
                )
              ),
            }))}
          />
        </div>
      </Section>

      <Section tone="surface">
        <SectionHeading eyebrow="Before you pay" title="What happens before any payment" />
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            "You receive a full written scope of what's included.",
            "Applicable taxes, exclusions, and third-party fees are confirmed with you.",
            "Refund and cancellation conditions are shared and agreed in writing.",
          ].map((line) => (
            <Card key={line}>
              <p className="text-sm text-text-soft">{line}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading eyebrow="Questions" title="Pricing FAQ" align="center" className="mx-auto" />
        <div className="mx-auto mt-10 max-w-2xl">
          <FaqAccordion items={PRICING_FAQS} />
        </div>
      </Section>

      <CTASection />
    </>
  );
}
