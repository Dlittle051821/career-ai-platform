import { Check, Info, Star, Users, Clock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { ViewAllServicesDialog } from "@/components/sections/pricing/ViewAllServicesDialog";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/admin/money";
import { formatComparisonCell, hasApprovedBenefits, isVersionCurrentlyEffective, NEUTRAL_SCOPE_FALLBACK, paymentTypeLabel, visibleInclusionsInOrder } from "@/lib/pricing/plan-versions";
import { isOfferCurrentlyRedeemable, isOfferExhausted, computeOfferDiscount } from "@/lib/pricing/offers";
import { recommendedBadgeLabel } from "@/lib/pricing/recommended-badge";
import { planEyebrowLabel } from "@/lib/pricing/plan-eyebrow";
import { planAccent } from "@/lib/pricing/plan-accent";
import { PLAN_ICON_BY_SLUG, DEFAULT_PLAN_ICON } from "@/lib/pricing/plan-icon";
import type { PricingInclusion, PricingOffer, PricingPlan, PricingPlanVersion } from "@/types/pricing";

/** A real ₹0 plan (Nextwise Explore) reads as "FREE", never "₹0.00" — formatMoney is for a real charge amount; zero is a distinct, honest case the reference spec calls out by name. */
function formatPlanPrice(amountMinorUnits: number, currency: string): string {
  return amountMinorUnits === 0 ? "FREE" : formatMoney(amountMinorUnits, currency);
}

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
  premium = false,
}: {
  plan: PricingPlan;
  version: PricingPlanVersion | null;
  offer: PricingOffer | null;
  inclusions: PricingInclusion[];
  highlight?: boolean;
  /**
   * UX10-PR01 — the reference mockup's two dark "Premium" cards (Bachelor
   * Abroad Premium, Master Abroad Premium) get a visually distinct deep
   * navy/cyan-glow treatment, not just a thicker border like a merely
   * "highlighted" card. Deliberately a separate prop from `highlight`
   * (which still drives the outline/shadow on a normal card and the primary
   * vs. outline CTA variant) — a future plan could be `highlight`ed without
   * being a dark Premium-tier card, or vice versa.
   */
  premium?: boolean;
}) {
  const hasLiveVersion = version !== null && isVersionCurrentlyEffective(version);
  const validOffer = hasLiveVersion && version && offer && isOfferCurrentlyRedeemable(offer) && !isOfferExhausted(offer) ? offer : null;
  const discountMinorUnits = validOffer && version ? computeOfferDiscount(version, validOffer) : 0;
  const taxWording = version ? TAX_WORDING[version.taxStatus] : null;
  const orderedInclusions = visibleInclusionsInOrder(inclusions);
  const initialInclusions = orderedInclusions.slice(0, INITIAL_VISIBLE_COUNT);
  const remainingCount = orderedInclusions.length - initialInclusions.length;
  const Icon = PLAN_ICON_BY_SLUG[plan.slug] ?? DEFAULT_PLAN_ICON;
  const eyebrow = planEyebrowLabel(plan.slug);
  const accent = planAccent(plan.slug);

  return (
    <Card
      className={cn(
        "flex h-full flex-col rounded-[20px]",
        premium
          ? "border-2 border-[color:rgb(56_189_248/0.55)] bg-[linear-gradient(165deg,#0a1b35_0%,#12294d_50%,#0a1b35_100%)] text-white shadow-[0_24px_60px_-14px_rgba(6,16,38,0.65),0_0_0_1px_rgba(56,189,248,0.22),0_0_38px_-6px_rgba(56,189,248,0.35)]"
          : highlight
            ? "border-2 border-primary shadow-lifted"
            : "border border-border/80 shadow-[0_10px_28px_-12px_rgba(15,23,42,0.16)]"
      )}
      style={!premium ? { borderTopWidth: "3px", borderTopColor: accent.strong } : undefined}
    >
      {plan.isRecommended ? (
        <Badge
          tone={premium ? undefined : "accent"}
          className={cn("mb-4 self-start gap-1", premium && "border-0 bg-[#f5b942] text-[#2a1a00]")}
        >
          <Star aria-hidden="true" className="h-3 w-3 fill-current" />
          {recommendedBadgeLabel(plan.slug)}
        </Badge>
      ) : (
        <div className="mb-4 h-[26px]" aria-hidden="true" />
      )}

      <div className="mb-3 flex items-start justify-between gap-3">
        {eyebrow ? (
          <span
            className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide", premium && "bg-white/10 text-[#7dd3fc]")}
            style={!premium ? { backgroundColor: accent.pale, color: accent.strong } : undefined}
          >
            {eyebrow}
          </span>
        ) : (
          <span />
        )}
        <span
          aria-hidden="true"
          className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", premium && "bg-white/10 text-[#7dd3fc]")}
          style={!premium ? { backgroundColor: accent.pale, color: accent.strong } : undefined}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>

      <h3 className={cn("font-sans text-2xl font-bold", premium ? "text-white" : "text-text")}>{version?.publicTitle ?? plan.internalName}</h3>
      {version?.shortDescription ? <p className={cn("mt-1.5 text-sm", premium ? "text-white/70" : "text-muted")}>{version.shortDescription}</p> : null}

      <div className="mt-5">
        {!hasLiveVersion || !version ? (
          <p className={cn("text-sm", premium ? "text-white/70" : "text-muted")}>Pricing for this plan isn&rsquo;t published yet — contact NextWise for details.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-2">
              {validOffer ? (
                <>
                  <span className={cn("text-lg font-medium line-through", premium ? "text-white/50" : "text-muted")}>
                    {formatPlanPrice(version.amountMinorUnits, version.currency)}
                  </span>
                  <span className={cn("text-4xl font-bold", premium ? "text-white" : "text-primary")}>
                    {formatPlanPrice(version.amountMinorUnits - discountMinorUnits, version.currency)}
                  </span>
                  <Badge tone="accent">{validOffer.publicOfferName}</Badge>
                </>
              ) : (
                <span className={cn("text-4xl font-bold", premium ? "text-white" : "text-primary")}>
                  {formatPlanPrice(version.amountMinorUnits, version.currency)}
                </span>
              )}
            </div>
            <p className={cn("mt-1 text-xs font-medium uppercase tracking-wide", premium ? "text-white/60" : "text-muted")}>
              {version.amountMinorUnits === 0 ? "No cost to start" : `${paymentTypeLabel(version)} · no subscription`}
            </p>
            {validOffer?.couponCode ? <p className="mt-1 text-xs text-muted">Use code {validOffer.couponCode} at checkout.</p> : null}
            {taxWording ? <p className={cn("mt-2 text-xs", premium ? "text-white/60" : "text-muted")}>{taxWording}</p> : null}

            {/* Session allowance, audience, and key limits — near the top, per spec. */}
            <dl
              className={cn(
                "mt-4 grid grid-cols-2 gap-x-3 gap-y-2 rounded-[var(--radius-control)] border px-4 py-3 text-xs",
                premium ? "border-white/15 bg-white/5" : "border-border bg-surface-alt/60"
              )}
            >
              {version.sessionCount !== null ? (
                <div>
                  <dt className={cn("flex items-center gap-1 font-medium", premium ? "text-white/60" : "text-muted")}>
                    <Clock aria-hidden="true" className="h-3.5 w-3.5" />
                    Sessions
                  </dt>
                  <dd className={cn("mt-0.5 font-semibold", premium ? "text-white" : "text-text")}>
                    {version.sessionCount}
                    {version.sessionDurationNote ? <span className={cn("block font-normal", premium ? "text-white/60" : "text-muted")}>{version.sessionDurationNote}</span> : null}
                  </dd>
                </div>
              ) : null}
              {version.audienceLabel ? (
                <div>
                  <dt className={cn("flex items-center gap-1 font-medium", premium ? "text-white/60" : "text-muted")}>
                    <Users aria-hidden="true" className="h-3.5 w-3.5" />
                    For
                  </dt>
                  <dd className={cn("mt-0.5 font-semibold", premium ? "text-white" : "text-text")}>{version.audienceLabel}</dd>
                </div>
              ) : null}
              {version.universityShortlistLimit !== null ? (
                <div>
                  <dt className={cn("font-medium", premium ? "text-white/60" : "text-muted")}>University shortlist</dt>
                  <dd className={cn("mt-0.5 font-semibold", premium ? "text-white" : "text-text")}>up to {version.universityShortlistLimit}</dd>
                </div>
              ) : null}
              {version.applicationSupportLimit !== null ? (
                <div>
                  <dt className={cn("font-medium", premium ? "text-white/60" : "text-muted")}>Applications supported</dt>
                  <dd className={cn("mt-0.5 font-semibold", premium ? "text-white" : "text-text")}>up to {version.applicationSupportLimit}</dd>
                </div>
              ) : null}
              {version.supportDurationNote ? (
                <div className="col-span-2">
                  <dt className={cn("font-medium", premium ? "text-white/60" : "text-muted")}>Follow-up support</dt>
                  <dd className={cn("mt-0.5 font-semibold", premium ? "text-white" : "text-text")}>{formatComparisonCell(version.supportDurationNote)}</dd>
                </div>
              ) : null}
            </dl>
          </>
        )}
      </div>

      <div className={cn("mt-6 flex-1 space-y-4 text-sm", premium ? "text-white/80" : "text-text-soft")}>
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className={cn("text-xs font-semibold uppercase tracking-wide", premium ? "text-white/60" : "text-muted")}>What&rsquo;s included</p>
            {remainingCount > 0 && version ? <ViewAllServicesDialog planTitle={version.publicTitle} inclusions={orderedInclusions} /> : null}
          </div>
          {initialInclusions.length > 0 ? (
            <ul className="space-y-2">
              {initialInclusions.map((item) => (
                <li key={item.id} className="flex items-start gap-2">
                  {item.isHighlight ? (
                    <Star aria-hidden="true" className={cn("mt-0.5 h-4 w-4 shrink-0 fill-current", premium ? "text-[#7dd3fc]" : "text-[var(--brand-signal-strong)]")} />
                  ) : (
                    <Check aria-hidden="true" className={cn("mt-0.5 h-4 w-4 shrink-0", premium ? "text-[#7dd3fc]" : "text-secondary")} />
                  )}
                  <span>
                    {item.title}
                    {item.explanation ? <span className={cn("block text-xs", premium ? "text-white/60" : "text-muted")}>{item.explanation}</span> : null}
                  </span>
                </li>
              ))}
              {remainingCount > 0 ? (
                <li className={cn("text-xs", premium ? "text-white/60" : "text-muted")}>+ {remainingCount} more — see &ldquo;View all services&rdquo; above.</li>
              ) : null}
            </ul>
          ) : version && hasApprovedBenefits(version) ? (
            <ul className="space-y-2">
              {version.includedServices.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <Check aria-hidden="true" className={cn("mt-0.5 h-4 w-4 shrink-0", premium ? "text-[#7dd3fc]" : "text-secondary")} />
                  <span>
                    {item.label}
                    {item.description ? <span className={cn("block text-xs", premium ? "text-white/60" : "text-muted")}>{item.description}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-start gap-2">
              <Info aria-hidden="true" className={cn("mt-0.5 h-4 w-4 shrink-0", premium ? "text-white/60" : "text-muted")} />
              {NEUTRAL_SCOPE_FALLBACK}
            </p>
          )}
        </div>

        <div>
          <p className={cn("mb-2 text-xs font-semibold uppercase tracking-wide", premium ? "text-white/60" : "text-muted")}>Not included</p>
          {version && version.exclusions.length > 0 ? (
            <ul className="space-y-1.5">
              {version.exclusions.map((item, idx) => (
                <li key={idx}>
                  {item.label}
                  {item.description ? <span className={cn("block text-xs", premium ? "text-white/60" : "text-muted")}>{item.description}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className={cn("text-xs", premium ? "text-white/60" : "text-muted")}>{DEFAULT_EXCLUSIONS}</p>
          )}
        </div>
      </div>

      <div className="mt-7 space-y-2">
        {hasLiveVersion && version ? (
          <LinkButton
            href={`/pricing/checkout/${plan.slug}`}
            variant={premium ? "secondary" : "primary"}
            size="lg"
            className={cn("w-full justify-center font-semibold", premium && "bg-[#38bdf8] text-[#06273f] hover:bg-[#67d4fb]")}
          >
            {version.ctaText || "Choose package"}
          </LinkButton>
        ) : null}
        <LinkButton href="/book-counselling" variant="ghost" className={cn("w-full justify-center", premium && "text-white/70 hover:bg-white/10 hover:text-white")}>
          Book a free consultation
        </LinkButton>
      </div>
    </Card>
  );
}
