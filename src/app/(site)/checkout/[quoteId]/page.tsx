import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Download, FileText } from "lucide-react";
import { CheckoutClient } from "@/components/payment-v1/CheckoutClient";
import { Steps } from "@/components/payment-v1/parts";
import { getCheckoutState, refreshCheckout } from "@/lib/payments/upi/checkout-service";
import { resolveUpiCheckout } from "@/lib/payments/upi/config";
import { checkoutPhase, type CheckoutState } from "@/lib/payments/upi/state";
import { formatInr } from "@/lib/pricing/v3/quote";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * NW-PAYMENT-V1 — the payment and confirmation steps for one quote. The
 * confirmation is rendered here, on the server, and only when the database
 * reports the quote's invoice as paid by a verified gateway payment. If the
 * student comes back after closing the browser, this page asks Razorpay
 * again before deciding what to show.
 */
export default async function CheckoutPage({ params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  if (!UUID.test(quoteId)) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/checkout/${quoteId}`)}`);

  const cfg = resolveUpiCheckout();
  let state: CheckoutState | null = null;
  try {
    state = cfg.open ? await refreshCheckout(supabase, quoteId) : await getCheckoutState(supabase, quoteId);
  } catch {
    state = null;
  }
  if (!state) notFound();
  const phase = checkoutPhase(state);
  // A quote replaced before any invoice was made for it (e.g. the package page was opened twice): continue
  // with the student's current quote for the same package rather than showing a dead end.
  if (phase === "unavailable" && !state.invoice && state.quote.status === "superseded") {
    const { data: current } = await supabase
      .from("pricing_quotes")
      .select("id")
      .eq("student_user_id", user.id)
      .eq("status", "open")
      .eq("plan_slug_at_quote", state.quote.planSlug)
      .eq("additional_universities", state.quote.additionalUniversities)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (current?.id && current.id !== quoteId) redirect(`/checkout/${current.id}`);
  }

  if (phase === "paid" && state.invoice && state.settled) return <Confirmation state={state} />;
  if (!cfg.open) redirect(`/pricing?plan=${state.quote.planSlug}`);

  return <CheckoutClient quoteId={quoteId} initial={{ state, phase, error: null }} testMode={cfg.mode === "test"} />;
}

function Confirmation({ state }: { state: CheckoutState }) {
  const invoice = state.invoice!;
  const settled = state.settled!;
  const q = state.quote;
  const total = q.includedUniversities === null ? null : q.includedUniversities + q.additionalUniversities;
  const paidIso = settled.capturedAt ?? invoice.paidAt;
  const paidOn = paidIso ? new Date(paidIso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "";
  return (
    <main className="nwp-main nwp-status" id="main-content">
      <div className="nwp-wrap nwp-wrap-narrow">
        <Steps at={4} />
        <section className="nwp-card nwp-success" aria-labelledby="nwp-ok-title">
          <div className="nwp-success-mark" aria-hidden="true">
            <svg viewBox="0 0 52 52">
              <circle cx="26" cy="26" r="24" />
              <path d="M15 27l7.5 7.5L37.5 19" />
            </svg>
          </div>
          <h1 id="nwp-ok-title" className="nwp-h1">
            Payment confirmed. Your next step begins here.
          </h1>
          <p className="nwp-lede">Your {q.planName} services are now active in Student Studio. Your invoice and payment receipt are saved to your account.</p>
          <dl className="nwp-facts">
            <div>
              <dt>Plan</dt>
              <dd>{q.planName}</dd>
            </div>
            <div className="nwp-facts-amt">
              <dt>Amount paid</dt>
              <dd data-amount={settled.amountMinor}>{formatInr(settled.amountMinor)}</dd>
            </div>
            {total !== null ? (
              <div>
                <dt>University coverage</dt>
                <dd>
                  {total} universities ({q.includedUniversities} included + {q.additionalUniversities} additional)
                </dd>
              </div>
            ) : null}
            <div>
              <dt>Payment method</dt>
              <dd>{settled.method === "upi" ? "UPI" : (settled.method ?? "UPI")}</dd>
            </div>
            <div>
              <dt>Invoice number</dt>
              <dd>
                <code>{invoice.number}</code>
              </dd>
            </div>
            <div>
              <dt>Transaction reference</dt>
              <dd>
                <code>{settled.paymentId}</code>
              </dd>
            </div>
            <div>
              <dt>Payment date</dt>
              <dd>{paidOn}</dd>
            </div>
            <div>
              <dt>Payment status</dt>
              <dd>
                <span className="nwp-status-chip" data-s="paid">
                  Paid
                </span>
              </dd>
            </div>
          </dl>
          <div className="nwp-success-actions">
            <Link className="nwp-btn nwp-btn-primary" href="/studio/plan" id="nwp-go-studio">
              Go to Student Studio <ArrowRight aria-hidden="true" />
            </Link>
            <Link className="nwp-btn nwp-btn-quiet" href={`/payments/${invoice.id}`} id="nwp-view-invoice">
              <FileText aria-hidden="true" /> View invoice
            </Link>
            <a className="nwp-btn nwp-btn-quiet" href={`/payments/${invoice.id}/pdf`} id="nwp-dl-invoice">
              <Download aria-hidden="true" /> Download invoice
            </a>
            <a className="nwp-btn nwp-btn-quiet" href={`/payments/${invoice.id}/receipts/${settled.transactionId}`} id="nwp-dl-receipt">
              <Download aria-hidden="true" /> Download payment receipt
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
