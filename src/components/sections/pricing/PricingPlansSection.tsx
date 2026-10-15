import { SectionHeading } from "@/components/ui/SectionHeading";
import { Card } from "@/components/ui/Card";
import { PublicPricingPlanCard } from "@/components/sections/pricing/PublicPricingPlanCard";
import { PricingCategoryFilter, type PricingFilterItem } from "@/components/sections/pricing/PricingCategoryFilter";
import { PricingComparisonTabs } from "@/components/sections/pricing/PricingComparisonTabs";
import { PricingTrustStrip } from "@/components/sections/pricing/PricingTrustStrip";
import { isVersionCurrentlyEffective } from "@/lib/pricing/plan-versions";
import type { PricingPlanWithVersion } from "@/types/pricing";

/**
 * UX10-PR01 — the real plan grid + filter chips + comparison table + trust
 * strip, extracted into its own component so the real `/pricing` page
 * (which fetches `plans` from Supabase) and the temporary dev-preview QA
 * harness (`src/app/dev-preview/pricing/page.tsx` — deleted before
 * packaging, same convention every prior milestone's sandbox-only QA
 * harness used) render the EXACT SAME markup from the exact same shape of
 * data, with zero duplicated pricing/presentation logic between them. The
 * harness exists only because this sandbox has no live Supabase project to
 * screenshot against, not because the real page needs a second code path.
 *
 * Filter groups (see PricingCategoryFilter's own docblock) are derived from
 * each plan's real `category` and `isRecommended` fields — no new ad-hoc
 * taxonomy. The two Premium plans get the reference mockup's dark card
 * treatment via `premium={plan.isRecommended}`, reusing the same real flag
 * that already drives their badge rather than hardcoding their slugs here.
 */
export function PricingPlansSection({ plans }: { plans: PricingPlanWithVersion[] }) {
  const active = plans.filter((p) => p.plan.isActive).sort((a, b) => a.plan.displayOrder - b.plan.displayOrder);

  const filterItems: PricingFilterItem[] = active.map((item) => {
    const groups: string[] = [];
    if (item.plan.category === "school_counselling") groups.push("india");
    if (item.plan.category === "bachelor_abroad" || item.plan.category === "master_abroad") groups.push("abroad");
    if (item.plan.isRecommended) groups.push("high-support");

    return {
      key: item.plan.id,
      groups,
      node: (
        <PublicPricingPlanCard
          plan={item.plan}
          version={item.version}
          offer={item.offer}
          inclusions={item.inclusions}
          highlight={item.plan.isRecommended}
          premium={item.plan.isRecommended}
        />
      ),
    };
  });

  const abroadComparisonItems = active
    .filter((p) => (p.plan.category === "bachelor_abroad" || p.plan.category === "master_abroad") && p.version && isVersionCurrentlyEffective(p.version))
    .map((p) => ({ plan: p.plan, version: p.version! }));

  if (active.length === 0) {
    return (
      <Card className="py-14 text-center">
        <p className="text-sm text-muted">Pricing isn&rsquo;t published yet. Please check back shortly, or contact NextWise directly.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-14">
      <PricingCategoryFilter items={filterItems} />

      <PricingTrustStrip />

      {abroadComparisonItems.length > 1 ? (
        <div>
          <SectionHeading
            eyebrow="Compare"
            title="Compare Plans"
            titleClassName="font-sans text-text"
            className="max-w-none"
          />
          <p className="mt-2 max-w-2xl text-sm text-muted">See what&rsquo;s included in each plan and choose the one that fits your goals.</p>
          <div className="mt-6">
            <PricingComparisonTabs categoryLabel="Bachelor & Master Abroad" items={abroadComparisonItems} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
