import type { Metadata } from "next";
import { CircleCheck, ShieldAlert } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Card } from "@/components/ui/Card";
import { PageHero } from "@/components/sections/PageHero";
import { CTASection } from "@/components/sections/CTASection";
import { PublicPricingPlanCard } from "@/components/sections/pricing/PublicPricingPlanCard";
import { PricingTabs, type PricingTab } from "@/components/sections/pricing/PricingTabs";
import { PricingComparisonTable } from "@/components/sections/pricing/PricingComparisonTable";
import { FaqAccordion } from "@/components/sections/FaqAccordion";
import { listPublicPricingPlans } from "@/lib/supabase/pricing/public-plans";
import { recordPricingAnalyticsEvent } from "@/lib/supabase/pricing/analytics";
import { isVersionCurrentlyEffective } from "@/lib/pricing/plan-versions";
import { PRICING_CATEGORY_LABELS, type PricingCategory, type PricingPlanWithVersion } from "@/types/pricing";
import { PRICING_FAQS } from "@/data/faqs";
import { BRAND_NAME } from "@/config/site";

export const metadata: Metadata = {
  title: "Pricing",
  description: `Official ${BRAND_NAME} pricing for school and college counselling, and Bachelor's/Master's abroad guidance — one-time payment, no subscriptions.`,
};

const TAB_GROUPS: { id: string; label: string; categories: PricingCategory[] }[] = [
  { id: "school-guidance", label: "School Guidance", categories: ["school_counselling", "class_11_counselling", "class_12_counselling"] },
  { id: "bachelor-abroad", label: "Bachelor Abroad", categories: ["bachelor_abroad"] },
  { id: "master-abroad", label: "Master Abroad", categories: ["master_abroad"] },
];

const MANDATORY_TERMS = [
  "University application fees, visa fees, examination fees, translations, courier costs, credential evaluations, insurance, deposits and other third-party charges are not included.",
  "Applications beyond the package allowance require a separately agreed fee.",
  `${BRAND_NAME} provides counselling and application support but does not guarantee admission, scholarships, visas, employment or immigration outcomes.`,
  "Visa information is general guidance and is not legal or immigration representation.",
  "Package validity begins on the purchase or onboarding date.",
  "Appointment cancellation and rescheduling follow the published appointment policy.",
];

function planCard(item: PricingPlanWithVersion) {
  const { plan, version, offer, inclusions } = item;
  return <PublicPricingPlanCard key={plan.id} plan={plan} version={version} offer={offer} inclusions={inclusions} highlight={plan.isRecommended} />;
}

export default async function PricingPage() {
  const plans = await listPublicPricingPlans();
  const hasAnyPlans = plans.some((p) => p.plan.isActive);

  const visibleLivePlanIds = plans.filter((p) => p.plan.isActive && p.version && isVersionCurrentlyEffective(p.version)).map((p) => p.plan.id);
  await Promise.allSettled(visibleLivePlanIds.map((planId) => recordPricingAnalyticsEvent({ eventType: "plan_view", planId })));

  const tabs: PricingTab[] = TAB_GROUPS.map((group) => {
    const items = plans.filter((p) => p.plan.isActive && group.categories.includes(p.plan.category)).sort((a, b) => a.plan.displayOrder - b.plan.displayOrder);
    const comparisonItems = items.filter((i): i is PricingPlanWithVersion & { version: NonNullable<PricingPlanWithVersion["version"]> } => i.version !== null && isVersionCurrentlyEffective(i.version));

    return {
      id: group.id,
      label: group.label,
      panel: (
        <div className="space-y-10">
          {group.categories.length > 1 ? (
            group.categories.map((category) => {
              const categoryItems = items.filter((i) => i.plan.category === category);
              if (categoryItems.length === 0) return null;
              return (
                <div key={category}>
                  <h3 className="mb-4 text-lg font-semibold text-primary">{PRICING_CATEGORY_LABELS[category]}</h3>
                  <div className={`grid gap-6 ${categoryItems.length > 1 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:max-w-md"}`}>{categoryItems.map(planCard)}</div>
                </div>
              );
            })
          ) : items.length === 0 ? (
            <p className="text-sm text-muted">Pricing for this category isn&rsquo;t published yet.</p>
          ) : (
            <div className={`grid gap-6 ${items.length > 1 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:max-w-md"}`}>{items.map(planCard)}</div>
          )}

          {comparisonItems.length > 1 ? (
            <div>
              <h3 className="mb-4 text-lg font-semibold text-primary">Compare Essential, Plus and Premium</h3>
              <PricingComparisonTable categoryLabel={group.label} items={comparisonItems.map((i) => ({ plan: i.plan, version: i.version }))} />
            </div>
          ) : null}
        </div>
      ),
    };
  });

  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title="Official NextWise pricing"
        description="A one-time payment, no subscriptions, no recurring charges. Every price below is exactly what you'll be charged — we never add fees you weren't shown first, and every session allowance and limit is stated up front, not buried in a tooltip."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Pricing" }]}
      />

      <Section tone="surface">
        {!hasAnyPlans ? (
          <Card className="py-14 text-center">
            <p className="text-sm text-muted">Pricing isn&rsquo;t published yet. Please check back shortly, or contact NextWise directly.</p>
          </Card>
        ) : (
          <PricingTabs tabs={tabs} />
        )}
      </Section>

      <Section tone="muted">
        <SectionHeading eyebrow="Please read" title="Terms that apply to every package" />
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
        <SectionHeading eyebrow="Questions" title="Pricing FAQ" align="center" className="mx-auto" />
        <div className="mx-auto mt-10 max-w-2xl">
          <FaqAccordion items={PRICING_FAQS} />
        </div>
      </Section>

      <CTASection />
    </>
  );
}
