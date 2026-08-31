import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { PageHero } from "@/components/sections/PageHero";
import { Section } from "@/components/layout/Section";
import { Card } from "@/components/ui/Card";
import { ConfirmCheckoutButton } from "@/components/sections/pricing/ConfirmCheckoutButton";
import { getPublicPricingPlanBySlug } from "@/lib/supabase/pricing/public-plans";
import { recordPricingAnalyticsEvent } from "@/lib/supabase/pricing/analytics";
import { formatMoney } from "@/lib/admin/money";
import { hasApprovedBenefits, isVersionCurrentlyEffective, NEUTRAL_SCOPE_FALLBACK, paymentTypeLabel, visibleInclusionsInOrder } from "@/lib/pricing/plan-versions";
import { isOfferCurrentlyRedeemable, isOfferExhausted, computePriceBreakdown } from "@/lib/pricing/offers";

interface PricingCheckoutPageProps {
  params: Promise<{ slug: string }>;
}

export const metadata: Metadata = { title: "Confirm your plan" };

/**
 * Order-summary / confirm step between "student picked a plan on /pricing"
 * and "a real invoice exists" (see src/app/(site)/pricing/checkout/actions.ts).
 * Protected by middleware (PROTECTED_PATHS includes "/pricing/checkout") —
 * a signed-out visitor is redirected to /login?next=... before this ever
 * renders, satisfying "login if needed" without any check duplicated here.
 * Every number shown here is a PREVIEW only — purchase_pricing_plan() is
 * what actually decides the amount server-side once confirmed.
 */
export default async function PricingCheckoutPage({ params }: PricingCheckoutPageProps) {
  const { slug } = await params;
  const item = await getPublicPricingPlanBySlug(slug);
  if (!item || !item.version || !isVersionCurrentlyEffective(item.version)) notFound();
  const { plan, version, offer, inclusions } = item;
  const orderedInclusions = visibleInclusionsInOrder(inclusions);

  const validOffer = offer && isOfferCurrentlyRedeemable(offer) && !isOfferExhausted(offer) ? offer : null;
  const breakdown = computePriceBreakdown(version, validOffer, null);

  await recordPricingAnalyticsEvent({ eventType: "plan_selected", planId: plan.id, offerId: validOffer?.id ?? null });

  return (
    <>
      <PageHero
        eyebrow="Checkout"
        title={version.publicTitle}
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Pricing", href: "/pricing" }, { label: "Confirm" }]}
      />
      <Section>
        <div className="mx-auto max-w-xl space-y-6">
          <Card>
            <h2 className="mb-4 text-base font-semibold text-primary">Order summary</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-text-soft">{version.publicTitle}</dt>
                <dd className="text-text">{formatMoney(breakdown.originalAmountMinorUnits, breakdown.currency)}</dd>
              </div>
              {breakdown.discountMinorUnits > 0 ? (
                <div className="flex items-center justify-between text-secondary-dark">
                  <dt>{validOffer?.publicOfferName ?? "Discount"}</dt>
                  <dd>-{formatMoney(breakdown.discountMinorUnits, breakdown.currency)}</dd>
                </div>
              ) : null}
              {breakdown.taxMinorUnits > 0 ? (
                <div className="flex items-center justify-between">
                  <dt className="text-text-soft">Tax</dt>
                  <dd className="text-text">{formatMoney(breakdown.taxMinorUnits, breakdown.currency)}</dd>
                </div>
              ) : null}
              <div className="flex items-center justify-between border-t border-border pt-3 text-base font-semibold text-primary">
                <dt>Total</dt>
                <dd>{formatMoney(breakdown.finalAmountMinorUnits, breakdown.currency)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-muted">{paymentTypeLabel(version)} — no recurring charge.</p>
          </Card>

          <Card>
            {version.sessionCount !== null ? (
              <p className="mb-3 text-sm font-semibold text-primary">
                {version.sessionCount} counselling session{version.sessionCount === 1 ? "" : "s"}
                {version.sessionDurationNote ? <span className="block text-xs font-normal text-muted">{version.sessionDurationNote}</span> : null}
              </p>
            ) : null}
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">What&rsquo;s included</p>
            {orderedInclusions.length > 0 ? (
              <ul className="space-y-1.5 text-sm text-text-soft">
                {orderedInclusions.map((item) => (
                  <li key={item.id}>{item.title}</li>
                ))}
              </ul>
            ) : hasApprovedBenefits(version) ? (
              <ul className="space-y-1.5 text-sm text-text-soft">
                {version.includedServices.map((s, idx) => (
                  <li key={idx}>{s.label}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{NEUTRAL_SCOPE_FALLBACK}</p>
            )}
          </Card>

          <Card className="flex items-start gap-3 border-secondary/20 bg-surface-alt">
            <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
            <p className="text-sm text-text-soft">
              You&rsquo;ll confirm and pay securely via Razorpay on the next step. We never see or store your card,
              UPI, or bank details. This creates a real invoice in your account.
            </p>
          </Card>

          <ConfirmCheckoutButton planId={plan.id} offerId={validOffer?.id ?? null} />
        </div>
      </Section>
    </>
  );
}
