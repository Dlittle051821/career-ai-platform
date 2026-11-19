"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowRight, Info, ShieldCheck, X } from "lucide-react";
import { DISCOVERY_SESSION_CTA } from "@/config/site";
import { rememberPlanChoice } from "@/lib/career-intelligence/assessment/guest-store";
import { ASSESSMENT_SECTION_COUNT } from "@/lib/career-intelligence/assessment/model";

export interface UnlockPlan {
  slug: string;
  name: string;
  price: string;
  priceNote: string;
}

/**
 * What happens when a student chooses to unlock. Nothing here charges,
 * grants or records an entitlement:
 *  - signed out: save the results to an account first (existing Supabase
 *    sign-up / log-in), keeping the chosen plan and the way back;
 *  - signed in, online payment open: continue to the existing checkout,
 *    whose server-side charge guard fixes the amount;
 *  - signed in, online payment not open: say so, and offer the free
 *    Discovery Session instead.
 * Access itself follows only from a paid invoice, read on the server.
 */
export function UnlockDialog({ plan, signedIn, purchasesOpen, onClose }: { plan: UnlockPlan; signedIn: boolean; purchasesOpen: boolean; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    rememberPlanChoice(plan.slug);
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [plan.slug, onClose]);

  const back = `/career/plans?plan=${encodeURIComponent(plan.slug)}`;

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="ci-unlock-title">
      <div className="scrim" onClick={onClose} />
      <div className="dialog">
        <button ref={closeRef} type="button" className="x" aria-label="Close" onClick={onClose}>
          <X className="icon" aria-hidden="true" />
        </button>
        {!signedIn ? (
          <>
            <span className="eyebrow">Unlock Career Intelligence</span>
            <h2 id="ci-unlock-title" className="display">
              One step: save your results to an account
            </h2>
            <p>Your report is linked to your account so it stays with you. Your {ASSESSMENT_SECTION_COUNT} completed sections come with you, and nothing is charged at this step.</p>
            <div className="sumline">
              <span>{plan.name}</span>
              <b>{plan.price}</b>
            </div>
            <p style={{ fontSize: 13 }}>{plan.priceNote.charAt(0).toUpperCase() + plan.priceNote.slice(1)}.</p>
            <div className="acts">
              <Link className="btn btn-primary" href={`/register?next=${encodeURIComponent(back)}`}>
                Create a free account <ArrowRight className="icon" aria-hidden="true" />
              </Link>
              <Link className="btn btn-quiet" href={`/login?next=${encodeURIComponent(back)}`}>
                I already have an account
              </Link>
            </div>
          </>
        ) : purchasesOpen ? (
          <>
            <span className="eyebrow">Unlock Career Intelligence</span>
            <h2 id="ci-unlock-title" className="display">
              Confirm your plan
            </h2>
            <p>You’ll review the order before anything is charged. Your report unlocks once the payment is confirmed as paid.</p>
            <div className="sumline">
              <span>{plan.name}</span>
              <b>{plan.price}</b>
            </div>
            <p style={{ fontSize: 13 }}>{plan.priceNote.charAt(0).toUpperCase() + plan.priceNote.slice(1)}.</p>
            <div className="acts">
              <Link className="btn btn-primary" href={`/pricing/checkout/${encodeURIComponent(plan.slug)}`}>
                Continue to secure checkout <ArrowRight className="icon" aria-hidden="true" />
              </Link>
            </div>
            <p className="notice">
              <ShieldCheck className="icon" aria-hidden="true" />
              <span>Access is granted only when Nextwise’s own records show a paid invoice, never from the payment page alone.</span>
            </p>
          </>
        ) : (
          <>
            <span className="eyebrow">Unlock Career Intelligence</span>
            <h2 id="ci-unlock-title" className="display">
              Online payment isn’t open yet
            </h2>
            <p>Nothing can be charged here yet, and nothing has been. Your answers are saved. A counsellor can help you take the next step with {plan.name} in a free Discovery Session.</p>
            <div className="sumline">
              <span>{plan.name}</span>
              <b>{plan.price}</b>
            </div>
            <div className="acts">
              <Link className="btn btn-primary" href={DISCOVERY_SESSION_CTA.href}>
                Book a free Discovery Session <ArrowRight className="icon" aria-hidden="true" />
              </Link>
              <button type="button" className="btn btn-quiet" onClick={onClose}>
                Back to my preview
              </button>
            </div>
            <p className="notice">
              <Info className="icon" aria-hidden="true" />
              <span>Your report unlocks automatically once an eligible plan is paid. You will not need to repeat the assessment.</span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
