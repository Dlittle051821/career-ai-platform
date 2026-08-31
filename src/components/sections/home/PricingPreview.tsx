import { Section } from "@/components/layout/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { PublicPricingPlanCard } from "@/components/sections/pricing/PublicPricingPlanCard";
import { LinkButton } from "@/components/ui/Button";
import { listPublicPricingPlans } from "@/lib/supabase/pricing/public-plans";
import { isVersionCurrentlyEffective } from "@/lib/pricing/plan-versions";

/**
 * Homepage teaser — up to three live, published plans (recommended ones
 * first). Deliberately sources the exact same Supabase-backed data as
 * /pricing (via PublicPricingPlanCard) rather than a second, hardcoded
 * price list, so this teaser can never drift out of sync with the real
 * pricing page. Renders nothing (not a broken/empty section) if no plan is
 * live yet.
 */
export async function PricingPreview() {
  const plans = await listPublicPricingPlans();
  const live = plans.filter((p) => p.plan.isActive && p.version && isVersionCurrentlyEffective(p.version));
  const highlighted = [...live.filter((p) => p.plan.isRecommended), ...live.filter((p) => !p.plan.isRecommended)].slice(0, 3);

  if (highlighted.length === 0) return null;

  return (
    <Section tone="surface">
      <SectionHeading
        eyebrow="Pricing"
        title="Official NextWise pricing"
        description="A one-time payment, no subscriptions. See the full price list for every plan across school counselling, college counselling, and Bachelor's/Master's abroad guidance."
      />
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {highlighted.map(({ plan, version, offer, inclusions }) => (
          <PublicPricingPlanCard key={plan.id} plan={plan} version={version} offer={offer} inclusions={inclusions} highlight={plan.isRecommended} />
        ))}
      </div>
      <div className="mt-8">
        <LinkButton href="/pricing" variant="outline">
          See full pricing details
        </LinkButton>
      </div>
    </Section>
  );
}
