import type { Metadata } from "next";
import { CircleCheck, ShieldAlert } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Card } from "@/components/ui/Card";
import { PricingHero } from "@/components/sections/pricing/PricingHero";
import { CTASection } from "@/components/sections/CTASection";
import { PricingPlansSection } from "@/components/sections/pricing/PricingPlansSection";
import { FaqAccordion } from "@/components/sections/FaqAccordion";
import { listPublicPricingPlans } from "@/lib/supabase/pricing/public-plans";
import { recordPricingAnalyticsEvent } from "@/lib/supabase/pricing/analytics";
import { isVersionCurrentlyEffective } from "@/lib/pricing/plan-versions";
import { PRICING_FAQS } from "@/data/faqs";
import { BRAND_NAME } from "@/config/site";

export const metadata: Metadata = {
  title: "Pricing",
  description: `Official ${BRAND_NAME} pricing — from free career exploration through fully-coordinated Bachelor's/Master's abroad guidance. One-time payment, no subscriptions.`,
  alternates: { canonical: "/pricing" },
};

const MANDATORY_TERMS = [
  "University application fees, visa fees, examination fees, translations, courier costs, credential evaluations, insurance, deposits and other third-party charges are not included.",
  "Applications beyond the package allowance require a separately agreed fee.",
  `${BRAND_NAME} provides counselling and application support but does not guarantee admission, scholarships, visas, employment or immigration outcomes.`,
  "Visa information is general guidance and is not legal or immigration representation.",
  "Package validity begins on the purchase or onboarding date.",
  "Appointment cancellation and rescheduling follow the published appointment policy.",
];

export default async function PricingPage() {
  const plans = await listPublicPricingPlans();

  const visibleLivePlanIds = plans.filter((p) => p.plan.isActive && p.version && isVersionCurrentlyEffective(p.version)).map((p) => p.plan.id);
  await Promise.allSettled(visibleLivePlanIds.map((planId) => recordPricingAnalyticsEvent({ eventType: "plan_view", planId })));

  return (
    <>
      <PricingHero />

      <Section tone="surface" containerClassName="max-w-[1500px]">
        <PricingPlansSection plans={plans} />
      </Section>

      <Section tone="muted">
        <SectionHeading eyebrow="Please read" title="Terms that apply to every package" titleClassName="font-sans text-text" />
        <Card className="mt-8">
          <ul className="space-y-3 text-sm text-text-soft">
            {MANDATORY_TERMS.map((term) => (
              <li key={term} className="flex items-start gap-2.5">
                <ShieldAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-coral)]" />
                <span>{term}</span>
              </li>
            ))}
          </ul>
        </Card>
        <div className="mt-6 flex items-start gap-2.5 text-sm text-text-soft">
          <CircleCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
          <p>Every service listed on this page is genuinely offered by NextWise — nothing here is a placeholder, a fake review, or a limited-time countdown.</p>
        </div>
      </Section>

      <Section tone="surface">
        <SectionHeading eyebrow="Questions" title="Pricing FAQ" align="center" className="mx-auto" titleClassName="font-sans text-text" />
        <div className="mx-auto mt-10 max-w-2xl">
          <FaqAccordion items={PRICING_FAQS} />
        </div>
      </Section>

      <CTASection />
    </>
  );
}
