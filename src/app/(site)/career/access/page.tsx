import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BarChart3, Check, CheckCircle2, ClipboardList, Lock, Map, Sparkles } from "lucide-react";
import { CAREER_INTELLIGENCE_MINIMUM_PLAN_SLUG, planHasCapability } from "@/config/plan-capabilities";
import { AUTH_LINKS, DISCOVERY_SESSION_CTA } from "@/config/site";
import { formatMoney } from "@/lib/admin/money";
import { canViewCareerIntelligence, type CareerIntelligenceAccessState } from "@/lib/career-intelligence/access";
import { arePaidFeaturesForcedOff } from "@/lib/launch/launch-mode";
import { NEXTWISE_VERIFIED } from "@/lib/payments/checkout-charge-guard";
import { hasMinimumProfileDataForRecommendations } from "@/lib/recommendations";
import { getCareerIntelligenceAccess } from "@/lib/supabase/career-intelligence-access";
import { listPublicPricingPlans } from "@/lib/supabase/pricing/public-plans";
import { getStudentProfileSnapshot } from "@/lib/supabase/student-profile";
import "@/styles/career-explorer.css";

export const metadata: Metadata = {
  title: "Unlock your Career Intelligence",
  description: "Career Intelligence is the personalised career analysis included in Nextwise Verified and above. Career Explorer and the assessment stay free.",
  alternates: { canonical: "/career/access" },
  robots: { index: false, follow: true },
};

const RESULTS_HREF = "/recommendations";
const STUDIO_HREF = "/studio";
// Career Intelligence V2: the free assessment now has its own eight-section flow.
const ASSESSMENT_HREF = "/career/assessment";

/** Whole rupees, no decimals: the amount the student pays in total, GST included. */
const money = (minor: number, currency: string) => formatMoney(minor, currency).replace(/\.00$/, "");

const STATE_LINE: Record<Exclude<CareerIntelligenceAccessState, "active" | "staff">, string> = {
  anonymous: "The assessment is free and needs no account to start. You only need a plan to see your full results.",
  free: "Career Intelligence is not active on this account yet.",
  payment_pending: "A payment for an eligible plan has been started but not confirmed. Results unlock only once the payment is confirmed.",
  expired: "Your Career Intelligence access has ended. Your answers are still saved.",
  revoked: "Career Intelligence is no longer active on this account. Your answers are still saved.",
};

/**
 * The Career Intelligence upgrade screen.
 *
 * A student reaches it after finishing the free assessment, at the moment
 * personalised results would appear, when the server finds no paid access.
 * It explains and routes; it does not sell, charge or grant anything:
 *
 *  - Access comes only from getCareerIntelligenceAccess() (paid invoices),
 *    read again on every request. Clicking anything here changes nothing.
 *  - A student who already has access is told so and sent to their results —
 *    never asked to buy again.
 *  - Nothing personalised is on this page: no match, score or preview, real
 *    or illustrative. The benefits are described in words only.
 *  - The price is the one approved figure, ₹1,999 with GST included. Other
 *    eligible plans come from the live catalogue, filtered by capability.
 *  - Buying goes through the existing /pricing checkout and its charge
 *    guard, and is offered only when paid features are switched on for the
 *    deployment. Otherwise the action is the free discovery session.
 */
export default async function CareerIntelligenceAccessPage() {
  const [state, snapshot, plans] = await Promise.all([getCareerIntelligenceAccess(), getStudentProfileSnapshot(), listPublicPricingPlans()]);
  const unlocked = canViewCareerIntelligence(state);
  const signedIn = state !== "anonymous";
  const assessmentComplete = snapshot ? hasMinimumProfileDataForRecommendations(snapshot) : false;
  const purchasesOpen = !arePaidFeaturesForcedOff();
  const verifiedPrice = money(NEXTWISE_VERIFIED.payableMinorUnits, NEXTWISE_VERIFIED.currency);

  const otherPlans = plans
    .filter((p) => p.version && p.plan.slug !== CAREER_INTELLIGENCE_MINIMUM_PLAN_SLUG && planHasCapability(p.plan.slug, "career_intelligence"))
    .sort((a, b) => a.plan.displayOrder - b.plan.displayOrder);

  const heading = unlocked
    ? "Your Career Intelligence is unlocked."
    : assessmentComplete
      ? "Your career profile is ready. Unlock your Career Intelligence."
      : "Finish your assessment free. Unlock your Career Intelligence when you're ready.";
  const lede = unlocked
    ? "Your plan includes Career Intelligence. Your saved assessment is used as it is — there is nothing to repeat."
    : assessmentComplete
      ? "You've completed the assessment. Your answers are saved. Choose an eligible Nextwise plan to view personalized career matches, suitability insights, and recommendations."
      : "The assessment is free and your answers are saved as you go. An eligible Nextwise plan is needed only to view personalized career matches, suitability insights, and recommendations.";

  return (
    <div className="ce">
      <section className="ce-verified" aria-labelledby="ce-verified-title">
        <div className="ce-wrap ce-verified-grid">
          <div>
            <p className="ce-eyebrow" data-tone="coral">
              Career Intelligence · Nextwise Verified and above
            </p>
            <h1 id="ce-verified-title">{heading}</h1>
            <p className="ce-verified-lede">{lede}</p>

            {signedIn ? (
              <ul className="ce-verified-status" aria-label="Your assessment">
                <li data-done={assessmentComplete ? "" : undefined}>
                  {assessmentComplete ? <CheckCircle2 aria-hidden="true" /> : <ClipboardList aria-hidden="true" />}
                  {assessmentComplete ? "Assessment completed" : "Assessment not finished yet"}
                </li>
                <li data-done="">
                  <CheckCircle2 aria-hidden="true" />
                  {assessmentComplete ? "Your answers are saved" : "Answers so far are saved"}
                </li>
              </ul>
            ) : null}

            <ul className="ce-verified-list">
              <li>
                <Sparkles aria-hidden="true" />
                <div>
                  <strong>Personalized career matches</strong>
                  <span>Careers that fit your own answers, with the reasons for each.</span>
                </div>
              </li>
              <li>
                <BarChart3 aria-hidden="true" />
                <div>
                  <strong>Suitability insights</strong>
                  <span>Where your strengths line up, and the gaps worth working on.</span>
                </div>
              </li>
              <li>
                <Map aria-hidden="true" />
                <div>
                  <strong>Recommendations and next steps</strong>
                  <span>A personal comparison of careers and what to do next.</span>
                </div>
              </li>
            </ul>
            <p className="ce-verified-foot">
              Career Explorer stays free, and so does the assessment. Career Intelligence is guidance, not a guarantee of admission, employment or
              pay.
            </p>
          </div>

          <aside className="ce-plan" aria-label={unlocked ? "Your access" : "Minimum qualifying plan"}>
            <span className="ce-plan-tag">{NEXTWISE_VERIFIED.name}</span>
            <p className="ce-plan-price">
              <strong>{verifiedPrice}</strong>
              <span>
                final price
                <br />
                GST included
              </span>
            </p>
            <ul>
              <li>
                <Check aria-hidden="true" />
                Career Intelligence results from your saved assessment
              </li>
              <li>
                <Check aria-hidden="true" />
                Personal fit when you compare careers
              </li>
              <li>
                <Check aria-hidden="true" />
                Everything else in Nextwise Verified
              </li>
            </ul>

            {unlocked ? (
              <Link href={RESULTS_HREF} className="ce-btn" data-variant="primary" data-block="">
                View my Career Intelligence
                <ArrowRight aria-hidden="true" />
              </Link>
            ) : !signedIn ? (
              <Link href={ASSESSMENT_HREF} className="ce-btn" data-variant="primary" data-block="">
                Start the free assessment
                <ArrowRight aria-hidden="true" />
              </Link>
            ) : !assessmentComplete ? (
              <Link href={ASSESSMENT_HREF} className="ce-btn" data-variant="primary" data-block="">
                Continue my assessment
                <ArrowRight aria-hidden="true" />
              </Link>
            ) : purchasesOpen ? (
              <Link href="/career/plans" className="ce-btn" data-variant="primary" data-block="">
                See eligible plans — from {verifiedPrice}
                <ArrowRight aria-hidden="true" />
              </Link>
            ) : (
              <Link href={DISCOVERY_SESSION_CTA.href} className="ce-btn" data-variant="primary" data-block="">
                Talk to us about upgrading
                <ArrowRight aria-hidden="true" />
              </Link>
            )}
            {signedIn ? (
              <Link href={STUDIO_HREF} className="ce-btn" data-variant="outline" data-block="">
                Return to Student Studio
              </Link>
            ) : (
              <p className="ce-plan-alt">
                Already have a plan? <Link href={`${AUTH_LINKS.login.href}?next=${encodeURIComponent(RESULTS_HREF)}`}>Log in to view your results</Link>
              </p>
            )}
            {!unlocked && signedIn && assessmentComplete ? (
              <p className="ce-plan-alt">
                <Link href="/career/preview">See your free preview</Link>: one recommendation from your answers.
              </p>
            ) : null}
            {!unlocked && purchasesOpen ? (
              <p className="ce-plan-alt">
                Prefer to talk first? <Link href={DISCOVERY_SESSION_CTA.href}>Book a free discovery session</Link>
              </p>
            ) : null}

            <p className="ce-plan-state" role="status">
              {unlocked ? <Check aria-hidden="true" /> : <Lock aria-hidden="true" />}
              <span>
                {unlocked ? "Career Intelligence is active on this account." : STATE_LINE[state as keyof typeof STATE_LINE]}
                {!unlocked && signedIn && !purchasesOpen ? " Online payment is not open yet, so nothing can be charged here." : ""}
              </span>
            </p>
          </aside>
        </div>

        {!unlocked && otherPlans.length > 0 ? (
          <div className="ce-wrap ce-plans-more">
            <h2>Other plans that include Career Intelligence</h2>
            <ul>
              {otherPlans.map(({ plan, version }) => (
                <li key={plan.id}>
                  <strong>{version!.publicTitle}</strong>
                  {version!.shortDescription ? <span>{version!.shortDescription}</span> : null}
                  <em>{money(version!.amountMinorUnits, version!.currency)}</em>
                </li>
              ))}
            </ul>
            <p>
              Prices are the final amounts shown on the <Link href="/pricing">plans page</Link>.
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
