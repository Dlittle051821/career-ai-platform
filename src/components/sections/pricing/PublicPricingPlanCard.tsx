import { Check, Info, Star, Users, Clock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { ViewAllServicesDialog } from "@/components/sections/pricing/ViewAllServicesDialog";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/admin/money";
import { formatComparisonCell, hasApprovedBenefits, isVersionCurrentlyEffective, NEUTRAL_SCOPE_FALLBACK, paymentTypeLabel, visibleInclusionsInOrder } from "@/lib/pricing/plan-versions";
import { isOfferCurrentlyRedeemable, isOfferExhausted, computeOfferDiscount } from "@/lib/pricing/offers";
import type { PricingInclusion, PricingOffer, PricingPlan, PricingPlanVersion } from "@/types/pricing";

const DEFAULT_EXCLUSIONS =
  "University, visa, test, translation, courier, government, and other third-party fees are not included unless stated otherwise above.";

const TAX_WORDING: Record<string, string | null> = {
  unconfigured: null,
  tax_exclusive: "Applicable tax will be added at checkout.",
  tax_inclusive: "Tax is included in this price.",
};

/**
 * One plan's card on the public /pricing page. Never invents a price,
 * benefit, or exclusion — every string shown either comes straight from an
 * admin-published pricing_plan_versions row or falls back to
 * NEUTRAL_SCOPE_FALLBACK/DEFAULT_EXCLUSIONS, exactly as the spec requires.
 * A plan with no currently-effective published version renders a
 * "Coming soon" card instead of a broken price.
 */
const INITIAL_VISIBLE_COUNT = 5;

export function PublicPricingPlanCard({
  plan,
  version,
  offer,
  inclusions,
  highlight = false,
}: {
  plan: PricingPlan;
  version: PricingPlanVersion | null;
  offer: PricingOffer | null;
  inclusions: PricingInclusion[];
  highlight?: boolean;
}) {
  const hasLiveVersion = version !== null && isVersionCurrentlyEffective(version);
  const validOffer = hasLiveVersion && version && offer && isOfferCurrentlyRedeemable(offer) && !isOfferExhausted(offer) ? offer : null;
  const discountMinorUnits = validOffer && version ? computeOfferDiscount(version, validOffer) : 0;
  const taxWording = version ? TAX_WORDING[version.taxStatus] : null;
  const orderedInclusions = visibleInclusionsInOrder(inclusions);
  const initialInclusions = orderedInclusions.slice(0, INITIAL_VISIBLE_COUNT);
  const remainingCount = orderedInclusions.length - initialInclusions.length;

  return (
    <Card className={cn("flex h-full flex-col", highlight ? "border-2 border-primary shadow-lifted" : undefined)}>
      {plan.isRecommended ? (
        <Badge tone="accent" className="mb-4 self-start gap-1">
          <Star aria-hidden="true" className="h-3 w-3 fill-current" />
          Recommended
        </Badge>
      ) : (
        <div className="mb-4 h-[26px]" aria-hidden="true" />
      )}

      <h3 className="text-xl font-semibold text-primary">{version?.publicTitle ?? plan.internalName}</h3>
      {version?.shortDescription ? <p className="mt-1 text-sm text-muted">{version.shortDescription}</p> : null}

      <div className="mt-5">
        {!hasLiveVersion || !version ? (
          <p className="text-sm text-muted">Pricing for this plan isn&rsquo;t published yet — contact NextWise for details.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-2">
              {validOffer ? (
                <>
                  <span className="text-lg font-medium text-muted line-through">{formatMoney(version.amountMinorUnits, version.currency)}</span>
                  <span className="text-3xl font-semibold text-primary">{formatMoney(version.amountMinorUnits - discountMinorUnits, version.currency)}</span>
                  <Badge tone="accent">{validOffer.publicOfferName}</Badge>
                </>
              ) : (
                <span className="text-3xl font-semibold text-primary">{formatMoney(version.amountMinorUnits, version.currency)}</span>
              )}
            </div>
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted">{paymentTypeLabel(version)} · no subscription</p>
            {validOffer?.couponCode ? <p className="mt-1 text-xs text-muted">Use code {validOffer.couponCode} at checkout.</p> : null}
            {taxWording ? <p className="mt-2 text-xs text-muted">{taxWording}</p> : null}

            {/* Session allowance, audience, and key limits — near the top, per spec. */}
            <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 rounded-[var(--radius-control)] border border-border bg-surface-alt/60 px-4 py-3 text-xs">
              {version.sessionCount !== null ? (
                <div>
                  <dt className="flex items-center gap-1 font-medium text-muted">
                    <Clock aria-hidden="true" className="h-3.5 w-3.5" />
                    Sessions
                  </dt>
                  <dd className="mt-0.5 font-semibold text-text">
                    {version.sessionCount}
                    {version.sessionDurationNote ? <span className="block font-normal text-muted">{version.sessionDurationNote}</span> : null}
                  </dd>
                </div>
              ) : null}
              {version.audienceLabel ? (
                <div>
                  <dt className="flex items-center gap-1 font-medium text-muted">
                    <Users aria-hidden="true" className="h-3.5 w-3.5" />
                    For
                  </dt>
                  <dd className="mt-0.5 font-semibold text-text">{version.audienceLabel}</dd>
                </div>
              ) : null}
              {version.universityShortlistLimit !== null ? (
                <div>
                  <dt className="font-medium text-muted">University shortlist</dt>
                  <dd className="mt-0.5 font-semibold text-text">up to {version.universityShortlistLimit}</dd>
                </div>
              ) : null}
              {version.applicationSupportLimit !== null ? (
                <div>
                  <dt className="font-medium text-muted">Applications supported</dt>
                  <dd className="mt-0.5 font-semibold text-text">up to {version.applicationSupportLimit}</dd>
                </div>
              ) : null}
              {version.supportDurationNote ? (
                <div className="col-span-2">
                  <dt className="font-medium text-muted">Follow-up support</dt>
                  <dd className="mt-0.5 font-semibold text-text">{formatComparisonCell(version.supportDurationNote)}</dd>
                </div>
              ) : null}
            </dl>
          </>
        )}
      </div>

      <div className="mt-6 flex-1 space-y-4 text-sm text-text-soft">
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">What&rsquo;s included</p>
            {remainingCount > 0 && version ? <ViewAllServicesDialog planTitle={version.publicTitle} inclusions={orderedInclusions} /> : null}
          </div>
          {initialInclusions.length > 0 ? (
            <ul className="space-y-2">
              {initialInclusions.map((item) => (
                <li key={item.id} className="flex items-start gap-2">
                  {item.isHighlight ? (
                    <Star aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 fill-current text-[var(--brand-signal-strong)]" />
                  ) : (
                    <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                  )}
                  <span>
                    {item.title}
                    {item.explanation ? <span className="block text-xs text-muted">{item.explanation}</span> : null}
                  </span>
                </li>
              ))}
              {remainingCount > 0 ? <li className="text-xs text-muted">+ {remainingCount} more — see &ldquo;View all services&rdquo; above.</li> : null}
            </ul>
          ) : version && hasApprovedBenefits(version) ? (
            <ul className="space-y-2">
              {version.includedServices.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                  <span>
                    {item.label}
                    {item.description ? <span className="block text-xs text-muted">{item.description}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-start gap-2">
              <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
              {NEUTRAL_SCOPE_FALLBACK}
            </p>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Not included</p>
          {version && version.exclusions.length > 0 ? (
            <ul className="space-y-1.5">
              {version.exclusions.map((item, idx) => (
                <li key={idx}>
                  {item.label}
                  {item.description ? <span className="block text-xs text-muted">{item.description}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted">{DEFAULT_EXCLUSIONS}</p>
          )}
        </div>
      </div>

      <div className="mt-7 space-y-2">
        {hasLiveVersion && version ? (
          <LinkButton href={`/pricing/checkout/${plan.slug}`} variant={highlight ? "primary" : "outline"} className="w-full justify-center">
            {version.ctaText || "Choose package"}
          </LinkButton>
        ) : null}
        <LinkButton href="/book-counselling" variant="ghost" className="w-full justify-center">
          Book a free consultation
        </LinkButton>
      </div>
    </Card>
  );
}
