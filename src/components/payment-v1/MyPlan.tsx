import Link from "next/link";
import { ArrowRight, Check, Download, FileCheck2, Hourglass, Lock } from "lucide-react";
import { formatInr } from "@/lib/pricing/v3/quote";
import type { MyPlanOverview } from "@/lib/payments/upi/my-plan";
import { UniversityDots } from "./parts";

/**
 * NW-PAYMENT-V1 — the "My plan" row and services list from the approved
 * Student Studio design, filled from the student's real purchase. Services
 * show as unlocked only when the invoice is paid.
 */

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");

export function PlanPendingBanner({ plan }: { plan: MyPlanOverview }) {
  if (plan.status !== "confirming" || !plan.quoteId) return null;
  return (
    <section className="nws-card nws-banner" data-tone="pending" aria-labelledby="nws-pending-title">
      <span className="nws-banner-icon" aria-hidden="true">
        <Hourglass />
      </span>
      <div>
        <h2 id="nws-pending-title">Your payment is not confirmed yet</h2>
        <p>
          {plan.planName} · {formatInr(plan.amountMinor)}. If you have paid, it is confirmed as soon as the payment partner tells Nextwise. Your services unlock then.
        </p>
        <div className="nws-actions">
          <Link className="nwp-btn nwp-btn-primary nwp-btn-sm" href={`/checkout/${plan.quoteId}`} id="nws-check-status">
            Check payment status
          </Link>
        </div>
      </div>
    </section>
  );
}

export function MyPlanCards({ plan }: { plan: MyPlanOverview | null }) {
  const active = plan?.status === "active";
  return (
    <div className="nws-grid4">
      <section className="nws-card nws-plan" data-active={active ? "" : undefined} aria-label="My current plan">
        <span className="nws-label">My current plan</span>
        {plan ? (
          <>
            <b className="nws-big">{plan.planName}</b>
            <span className="nws-chip" data-s={active ? "active" : plan.status === "refunded" ? "failed" : "pending"}>
              {active ? "Active" : plan.status === "refunded" ? "Refunded" : "Awaiting payment confirmation"}
            </span>
            <span className="nws-sub">{active ? `Activated ${day(plan.activatedAt)}` : "Services unlock after the payment is confirmed."}</span>
          </>
        ) : (
          <>
            <b className="nws-big">No plan yet</b>
            <Link className="nws-link" href="/pricing">
              See plans <ArrowRight aria-hidden="true" />
            </Link>
          </>
        )}
      </section>
      <section className="nws-card" aria-label="My university coverage">
        <span className="nws-label">My university coverage</span>
        {plan && plan.totalUniversities !== null ? (
          <>
            <b className="nws-big">{plan.totalUniversities} universities</b>
            <UniversityDots included={plan.includedUniversities ?? 0} extra={plan.additionalUniversities} />
            <span className="nws-sub">
              {plan.includedUniversities} included + {plan.additionalUniversities} additional
            </span>
          </>
        ) : (
          <span className="nws-sub">{plan ? "Not part of your plan" : "Comes with a Study Abroad package"}</span>
        )}
      </section>
      <section className="nws-card" aria-label="My payments">
        <span className="nws-label">My payments</span>
        {plan?.receipt ? (
          <>
            <b className="nws-big" data-amount={plan.receipt.amountMinor}>
              {formatInr(plan.receipt.amountMinor)} paid
            </b>
            <span className="nws-sub">
              UPI · {day(plan.receipt.capturedAt)}
            </span>
          </>
        ) : (
          <span className="nws-sub">{plan ? "Confirmation pending" : "No payments yet"}</span>
        )}
        <Link className="nws-link" href="/payments" id="nws-open-payments">
          Open my payments <ArrowRight aria-hidden="true" />
        </Link>
      </section>
      <section className="nws-card" aria-label="My documents">
        <span className="nws-label">My documents</span>
        {active && plan?.invoice ? (
          <ul className="nws-docs">
            <li>
              <Check aria-hidden="true" /> Invoice {plan.invoice.number}
            </li>
            {plan.receipt ? (
              <li>
                <Check aria-hidden="true" /> Payment receipt available
              </li>
            ) : null}
          </ul>
        ) : (
          <span className="nws-sub">Your invoice and receipt appear here after payment.</span>
        )}
      </section>
    </div>
  );
}

export function ServiceList({ plan, limit }: { plan: MyPlanOverview; limit?: number }) {
  const unlocked = plan.status === "active";
  const items = limit ? plan.services.filter((s) => s.isHighlight).slice(0, limit) : plan.services;
  const shown = items.length ? items : plan.services.slice(0, limit ?? plan.services.length);
  return (
    <div className="nws-svc">
      <div className="nws-svc-group">
        <ul>
          {shown.map((s) => (
            <li key={s.title} data-unlocked={unlocked ? "" : undefined}>
              <span className="nws-svc-icon" aria-hidden="true">
                {unlocked ? <Check /> : <Lock />}
              </span>
              <span>{s.title}</span>
              <span className="nws-chip nws-svc-chip" data-s={unlocked ? "active" : "locked"}>
                {unlocked ? "Unlocked" : "Locked"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function PlanDocuments({ plan }: { plan: MyPlanOverview }) {
  if (!plan.invoice) return <p className="nws-sub">Your invoice and receipt appear here once the payment is confirmed.</p>;
  return (
    <ul className="nws-doclist">
      <li>
        <FileCheck2 aria-hidden="true" />
        <span>
          <b>Invoice {plan.invoice.number}</b>
          <small>
            {formatInr(plan.invoice.totalMinor)} · {plan.invoice.status === "paid" ? "Paid" : plan.invoice.status} · {day(plan.invoice.paidAt)}
          </small>
        </span>
        <Link className="nwp-btn nwp-btn-quiet nwp-btn-sm" href={`/payments/${plan.invoice.id}`} id="nws-view-invoice">
          View invoice
        </Link>
        <a className="nws-icon" aria-label="Download invoice" href={`/payments/${plan.invoice.id}/pdf`} id="nws-dl-invoice">
          <Download aria-hidden="true" />
        </a>
      </li>
      {plan.receipt ? (
        <li>
          <FileCheck2 aria-hidden="true" />
          <span>
            <b>Payment receipt</b>
            <small>
              {formatInr(plan.receipt.amountMinor)} received · UPI · {plan.receipt.paymentId}
            </small>
          </span>
          <a className="nwp-btn nwp-btn-quiet nwp-btn-sm" href={`/payments/${plan.invoice.id}/receipts/${plan.receipt.transactionId}`} id="nws-view-receipt">
            Download receipt
          </a>
          <a className="nws-icon" aria-label="Download receipt" href={`/payments/${plan.invoice.id}/receipts/${plan.receipt.transactionId}`} id="nws-dl-receipt">
            <Download aria-hidden="true" />
          </a>
        </li>
      ) : null}
    </ul>
  );
}
