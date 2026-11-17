import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, ClipboardList, Lock, Sparkles, Timer } from "lucide-react";
import { AUTH_LINKS, DISCOVERY_SESSION_CTA } from "@/config/site";
import { formatMoney } from "@/lib/admin/money";
import { arePaidFeaturesForcedOff } from "@/lib/launch/launch-mode";
import { NEXTWISE_VERIFIED } from "@/lib/payments/checkout-charge-guard";
import { getMyProductEntitlements } from "@/lib/products/entitlements";
import { getCurrentUser } from "@/lib/supabase/profile";
import "@/styles/career-explorer.css";

export const metadata: Metadata = {
  title: "Career Intelligence — part of Nextwise Verified",
  description: "Career Intelligence is the personalised career assessment included in Nextwise Verified. Career Explorer stays free.",
  alternates: { canonical: "/career/access" },
  robots: { index: false, follow: true },
};

const WORKSPACE_HREF = "/studio/career";

/** ₹1,999 — the whole amount the student pays, GST included. Never shown with tax added on top. */
function verifiedPrice(): string {
  return formatMoney(NEXTWISE_VERIFIED.payableMinorUnits, NEXTWISE_VERIFIED.currency).replace(/\.00$/, "");
}

/**
 * Career Explorer V5 (approved, locked) — the Nextwise Verified access screen
 * for Career Intelligence ("Go beyond exploring. Understand your potential.").
 *
 * This page only explains and routes. It does not sell, charge or grant
 * anything itself:
 *  - Access is decided on the server from paid invoices
 *    (getMyProductEntitlements) — never from this page or the browser.
 *  - The price is the single approved figure (NEXTWISE_VERIFIED), GST included.
 *  - Buying happens in the existing /pricing checkout, which keeps its own
 *    charge guard. While paid features are switched off for the deployment
 *    (arePaidFeaturesForcedOff), no purchase action is offered here at all.
 * There is no ₹199 plan and no separate Career Intelligence plan.
 */
export default async function CareerIntelligenceAccessPage() {
  const [user, entitlements] = await Promise.all([getCurrentUser(), getMyProductEntitlements()]);
  const verified = entitlements.hasCareerEntitlement;
  const purchasesOpen = !arePaidFeaturesForcedOff();
  const price = verifiedPrice();

  return (
    <div className="ce">
      <section className="ce-verified" aria-labelledby="ce-verified-title">
        <div className="ce-wrap ce-verified-grid">
          <div>
            <p className="ce-eyebrow" data-tone="coral">
              Career Intelligence · part of Nextwise Verified
            </p>
            <h1 id="ce-verified-title">
              Go beyond exploring.
              <br />
              Understand your potential.
            </h1>
            <p className="ce-verified-lede">
              Take a guided assessment of your interests, academic background and reasoning skills to receive personalized career direction.
            </p>
            <ul className="ce-verified-list">
              <li>
                <ClipboardList aria-hidden="true" />
                <div>
                  <strong>Guided assessment</strong>
                  <span>Your background, interests and preferences, answered at your own pace.</span>
                </div>
              </li>
              <li>
                <Timer aria-hidden="true" />
                <div>
                  <strong>Reasoning diagnostic</strong>
                  <span>A short set of reasoning questions.</span>
                </div>
              </li>
              <li>
                <Sparkles aria-hidden="true" />
                <div>
                  <strong>Personalised results and roadmap</strong>
                  <span>Directions that fit you, with reasons and next steps.</span>
                </div>
              </li>
            </ul>
            <p className="ce-verified-foot">Career Explorer stays free. Your first discovery session with a counsellor is free too.</p>
          </div>

          <aside className="ce-plan" aria-label="Nextwise Verified">
            <span className="ce-plan-tag">{NEXTWISE_VERIFIED.name}</span>
            <p className="ce-plan-price">
              <strong>{price}</strong>
              <span>
                final price
                <br />
                includes applicable GST
              </span>
            </p>
            <ul>
              <li>
                <Check aria-hidden="true" />
                Career Intelligence assessment
              </li>
              <li>
                <Check aria-hidden="true" />
                Personalised results and roadmap
              </li>
              <li>
                <Check aria-hidden="true" />
                Everything else in Nextwise Verified
              </li>
            </ul>

            {verified ? (
              <Link href={WORKSPACE_HREF} className="ce-btn" data-variant="primary" data-block="">
                Open Career Intelligence
                <ArrowRight aria-hidden="true" />
              </Link>
            ) : purchasesOpen ? (
              <Link href="/pricing" className="ce-btn" data-variant="primary" data-block="">
                Get Nextwise Verified — {price}
                <ArrowRight aria-hidden="true" />
              </Link>
            ) : (
              <span className="ce-btn" data-variant="primary" data-block="" aria-disabled="true">
                Online purchase isn&rsquo;t open yet
              </span>
            )}
            <Link href={DISCOVERY_SESSION_CTA.href} className="ce-btn" data-variant="outline" data-block="">
              Book a Free Discovery Session
            </Link>

            {!user ? (
              <p className="ce-plan-alt">
                Already Verified? <Link href={`${AUTH_LINKS.login.href}?next=${encodeURIComponent(WORKSPACE_HREF)}`}>Log in to open Career Intelligence</Link>
              </p>
            ) : null}

            <p className="ce-plan-state" role="status">
              {verified ? <Check aria-hidden="true" /> : <Lock aria-hidden="true" />}
              {verified
                ? "Nextwise Verified is active on this account."
                : user
                  ? "You don't have Nextwise Verified on this account yet."
                  : purchasesOpen
                    ? "You'll be asked to log in or sign up before paying."
                    : "To get started now, book a free discovery session and a counsellor will guide you."}
            </p>
          </aside>
        </div>
      </section>
    </div>
  );
}
