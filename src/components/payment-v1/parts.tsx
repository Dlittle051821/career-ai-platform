import { Check, Lock, ShieldCheck } from "lucide-react";
import { formatInr } from "@/lib/pricing/v3/quote";

/**
 * NW-PAYMENT-V1 — shared pieces of the approved payment design
 * (steps, package summary, security note, university dots). Server-safe:
 * no hooks, so both server pages and the client checkout can use them.
 */

/** The four steps of the journey. They are a real sequence, so they are numbered. */
export function Steps({ at }: { at: 1 | 2 | 3 | 4 }) {
  const steps = ["Package", "Account", "Payment", "Confirmation"];
  return (
    <ol className="nwp-steps" aria-label="Checkout progress">
      {steps.map((label, i) => {
        const n = i + 1;
        const state = n < at ? "done" : n === at ? "current" : "next";
        return (
          <li key={label} data-state={state} aria-current={state === "current" ? "step" : undefined}>
            <span className="nwp-step-n">{state === "done" ? <Check aria-hidden="true" /> : n}</span>
            <span className="nwp-step-l">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export interface SummaryPackage {
  planSlug: string;
  planName: string;
  baseMinor: number;
  includedUniversities: number | null;
  additionalUniversities: number;
  addonUnitMinor: number | null;
  addonMinor: number;
  totalMinor: number;
}

export function UniversityDots({ included, extra }: { included: number; extra: number }) {
  return (
    <span className="nwp-dots" aria-hidden="true">
      {Array.from({ length: Math.min(included, 40) }).map((_, i) => (
        <i key={`i${i}`} />
      ))}
      {Array.from({ length: Math.min(extra, 40) }).map((_, i) => (
        <i key={`a${i}`} data-added="" />
      ))}
    </span>
  );
}

/** Package summary: the amount and the university coverage are always shown together. Every figure comes from the server-frozen quote. */
export function OrderSummary({ pkg, reference, compact = false, taxNote }: { pkg: SummaryPackage; reference?: string | null; compact?: boolean; taxNote: string }) {
  const total = pkg.includedUniversities === null ? null : pkg.includedUniversities + pkg.additionalUniversities;
  return (
    <section className="nwp-summary" data-compact={compact ? "" : undefined} aria-label="Your package">
      <div className="nwp-summary-head">
        <span className="nwp-kicker">Your package</span>
        <h2 className="nwp-summary-plan">{pkg.planName}</h2>
        {total !== null ? (
          <p className="nwp-cover">
            <UniversityDots included={pkg.includedUniversities ?? 0} extra={pkg.additionalUniversities} />
            <span>
              <b>{total} universities</b> · {pkg.includedUniversities} included + {pkg.additionalUniversities} additional
            </span>
          </p>
        ) : (
          <p className="nwp-cover">
            <span>Career guidance package · no university applications</span>
          </p>
        )}
      </div>
      {!compact ? (
        <dl className="nwp-lines">
          <div>
            <dt>{pkg.planName.replace("Nextwise ", "")} package</dt>
            <dd>{formatInr(pkg.baseMinor)}</dd>
          </div>
          {pkg.addonUnitMinor !== null ? (
            <div>
              <dt>
                Additional universities {pkg.additionalUniversities} × {formatInr(pkg.addonUnitMinor)}
              </dt>
              <dd>{formatInr(pkg.addonMinor)}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      <div className="nwp-total">
        <span>Total payable</span>
        <b className="nwp-total-amt" data-amount={pkg.totalMinor}>
          {formatInr(pkg.totalMinor)}
        </b>
      </div>
      {!compact ? <p className="nwp-tax">{taxNote}</p> : null}
      {reference ? (
        <p className="nwp-ref">
          Order reference <code>{reference}</code>
        </p>
      ) : null}
    </section>
  );
}

export function taxNoteFor(planSlug: string): string {
  return planSlug === "nextwise-verified"
    ? "Final price, GST included."
    : "Package price as shown on Pricing. The tax treatment for this package is confirmed on your invoice; nothing is added at payment.";
}

export function SecurityNote() {
  return (
    <section className="nwp-secure" aria-label="Payment security">
      <p>
        <ShieldCheck aria-hidden="true" /> Your payment is processed by Nextwise&apos;s payment partner, Razorpay, over an encrypted connection.
      </p>
      <p>
        <Lock aria-hidden="true" /> Nextwise never asks for your UPI PIN, card PIN or OTP. You approve the payment in your UPI app.
      </p>
      <p>
        <Check aria-hidden="true" /> Your plan is activated only after the payment is confirmed by the payment partner, not by this page.
      </p>
    </section>
  );
}

/** A short, readable order reference derived from the attempt's idempotency key (never a secret). */
export function shortReference(key: string | null | undefined): string | null {
  if (!key) return null;
  const hex = key.replace(/^upi-/, "").replace(/[^0-9a-f]/gi, "");
  return hex ? `NW-${hex.slice(0, 4).toUpperCase()}-${hex.slice(4, 8).toUpperCase()}` : null;
}
