"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Info } from "lucide-react";
import { useGuestProgress } from "@/lib/career-intelligence/assessment/use-guest-progress";
import { isAssessmentComplete } from "@/lib/career-intelligence/assessment/model";
import type { CiPlanCatalogue, CiPlan } from "@/lib/career-intelligence/plans";
import { UnlockDialog } from "./UnlockDialog";

type Level = "bachelor" | "master";
type Tier = "plus" | "premium";

const SUITS: Record<string, string> = {
  verified: "You want your full Career Intelligence report and a clear next step, without committing to admissions support yet.",
  essential: "You plan to study in India and want help from shortlist to admission.",
};

/**
 * The three-column plan choice. Every plan here carries the
 * career_intelligence capability; names, prices and inclusions come from the
 * live catalogue. Picking one opens the unlock step (account, then checkout
 * when online payment is open). It never grants access.
 */
export function PlanChooser({ catalogue, signedIn, assessmentCompleteOnAccount, initialPlan }: { catalogue: CiPlanCatalogue; signedIn: boolean; assessmentCompleteOnAccount: boolean; initialPlan: string | null }) {
  const firstAbroad = (["bachelor", "master"] as Level[]).find((l) => catalogue.abroad[l].plus || catalogue.abroad[l].premium) ?? "bachelor";
  const [level, setLevel] = useState<Level>(initialPlan?.startsWith("master-") ? "master" : firstAbroad);
  const [tier, setTier] = useState<Tier>(initialPlan?.endsWith("-premium") ? "premium" : "plus");
  const [chosen, setChosen] = useState<CiPlan | null>(null);
  const local = useGuestProgress();
  const complete = assessmentCompleteOnAccount || (!signedIn && Boolean(local && isAssessmentComplete(local.answers)));

  const close = useCallback(() => setChosen(null), []);
  const abroadPlan = catalogue.abroad[level][tier];
  const abroadAny = catalogue.abroad.bachelor.plus || catalogue.abroad.bachelor.premium || catalogue.abroad.master.plus || catalogue.abroad.master.premium;

  return (
    <section className="plans" aria-labelledby="ci-plans-title">
      <div className="wrap">
        <Link className="btn-link" href="/career/preview" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <ArrowLeft className="icon" aria-hidden="true" /> Back to my preview
        </Link>
        <div style={{ marginTop: 14 }}>
          <span className="eyebrow">Plans that include Career Intelligence</span>
        </div>
        <h1 id="ci-plans-title" className="display">
          Choose how you unlock your report.
        </h1>
        <p className="sub">Every plan below includes the full Career Intelligence report. Pick the one that matches what you need next.</p>
        {complete ? (
          <div className="carry">
            <Check className="icon" aria-hidden="true" /> Your completed assessment is saved. Choosing a plan won’t reset or repeat anything.
          </div>
        ) : null}

        <div className="plan-grid">
          <PlanCard
            id="verified"
            plan={catalogue.verified}
            category="Career and study decisions"
            flag="Best for Career Intelligence"
            suits={SUITS.verified}
            cta={`Unlock with ${catalogue.verified.name}`}
            primary
            onChoose={setChosen}
          />
          {catalogue.essential ? <PlanCard id="essential" plan={catalogue.essential} category="Study in India" suits={SUITS.essential} cta="Choose This Plan" onChoose={setChosen} /> : null}
          {abroadAny ? (
            <PlanCard
              id="abroad"
              plan={abroadPlan}
              category="Study abroad"
              suits={`You want to study abroad for a ${level === "bachelor" ? "bachelor’s" : "master’s"} degree with application support.`}
              cta="Choose This Plan"
              onChoose={setChosen}
            >
              <div className="seg" role="radiogroup" aria-label="Degree level">
                {(["bachelor", "master"] as Level[]).map((l) => (
                  <button key={l} type="button" role="radio" aria-checked={level === l} onClick={() => setLevel(l)} disabled={!catalogue.abroad[l].plus && !catalogue.abroad[l].premium}>
                    {l === "bachelor" ? "Bachelor’s" : "Master’s"}
                  </button>
                ))}
              </div>
              <div className="tiers" role="radiogroup" aria-label="Support level">
                {(["plus", "premium"] as Tier[]).map((t) => {
                  const p = catalogue.abroad[level][t];
                  if (!p) return null;
                  return (
                    <button key={t} type="button" className="tier" role="radio" aria-checked={tier === t} onClick={() => setTier(t)}>
                      <b>{p.name}</b>
                      <span>{p.price}</span>
                    </button>
                  );
                })}
              </div>
            </PlanCard>
          ) : null}
        </div>

        <p className="foot-note">
          <Info className="icon" aria-hidden="true" />
          <span>
            {catalogue.catalogueAvailable
              ? "Prices and inclusions are from the current Nextwise catalogue. Nextwise Explore (free) does not include Career Intelligence."
              : "The full plan catalogue couldn’t be loaded just now; see the Pricing page for every plan."}{" "}
            {catalogue.purchasesOpen ? "Your report unlocks once the payment is confirmed as paid." : "Online payment isn’t open yet, so nothing can be charged here."}
          </span>
        </p>
      </div>
      {chosen ? <UnlockDialog plan={chosen} signedIn={signedIn} purchasesOpen={catalogue.purchasesOpen} onClose={close} /> : null}
    </section>
  );
}

function PlanCard({
  id,
  plan,
  category,
  flag,
  suits,
  cta,
  primary = false,
  onChoose,
  children,
}: {
  id: string;
  plan: CiPlan | null;
  category: string;
  flag?: string;
  suits: string;
  cta: string;
  primary?: boolean;
  onChoose: (p: CiPlan) => void;
  children?: React.ReactNode;
}) {
  return (
    <article className={`plan ${flag ? "rec-plan" : ""}`} aria-labelledby={`pl-${id}`}>
      {flag ? <span className="flag">{flag}</span> : null}
      <span className="cat">{category}</span>
      <h2 id={`pl-${id}`} className="display">
        {plan?.name ?? "Study Abroad"}
      </h2>
      {plan?.description ? <p className="desc">{plan.description}</p> : null}
      {children}
      {plan ? (
        <>
          <div className="pr">
            <b>{plan.price}</b>
            <span>{plan.priceNote}</span>
          </div>
          <div className="ci-inc">
            <Check className="icon" aria-hidden="true" /> Career Intelligence included
          </div>
          {plan.inclusions.length > 0 ? (
            <>
              <h3>Also includes</h3>
              <ul>
                {plan.inclusions.map((inc) => (
                  <li key={inc}>
                    <Check className="icon" aria-hidden="true" />
                    <span>{inc}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      ) : null}
      <p className="suits">
        <b>Suits you if</b> {suits}
      </p>
      <div className="act">
        <button type="button" className={`btn ${primary ? "btn-primary" : "btn-quiet"}`} id={`buy-${id}`} disabled={!plan} onClick={() => plan && onChoose(plan)}>
          {cta} <ArrowRight className="icon" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}
