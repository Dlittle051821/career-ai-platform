"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, ChevronDown, CreditCard, Landmark, Loader2, QrCode, RefreshCw, Repeat, ShieldCheck, Smartphone, TriangleAlert, Wallet } from "lucide-react";
import { formatInr } from "@/lib/pricing/v3/quote";
import type { CheckoutPhase, CheckoutState } from "@/lib/payments/upi/state";
import { getUpiIntentOptionsAction, prepareUpiAction, refreshUpiStatusAction, type CheckoutSnapshot, type IntentOptions } from "@/app/(site)/checkout/actions";
import { OrderSummary, SecurityNote, Steps, UniversityDots, shortReference, taxNoteFor, type SummaryPackage } from "./parts";

/**
 * NW-PAYMENT-V1 — the payment step of the approved design, wired to the real
 * gateway. UPI is the only enabled method: a single-use, fixed-amount QR from
 * Razorpay on desktop, and Razorpay Checkout restricted to UPI (Intent) on a
 * phone. Card, Netbanking and Other methods are shown, disabled, as
 * "Coming soon".
 *
 * Nothing on this page can make a payment succeed. "I've approved the
 * payment" only moves the student to the waiting screen and asks the server
 * to check with Razorpay; the page shows success only after the server
 * renders it from an invoice the database has marked paid.
 */

type RazorpayCtor = new (options: Record<string, unknown>) => { open: () => void; on?: (event: string, cb: (r: unknown) => void) => void };
const razorpayCtor = (): RazorpayCtor | undefined => (window as unknown as { Razorpay?: RazorpayCtor }).Razorpay;

const DISABLED_METHODS = [
  { id: "card", label: "Debit or credit card", sub: "Visa, Mastercard, RuPay", icon: CreditCard },
  { id: "netbanking", label: "Netbanking", sub: "Pay from your bank account", icon: Landmark },
  { id: "other", label: "Other methods", sub: "Wallets and other options", icon: Wallet },
] as const;

const POLL_MS = 4000;
const POLL_SLOW_MS = 15000;

function useIsPhone() {
  const q = "(max-width: 760px)";
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return m;
}

function secondsLeft(expiresAt: string | null, now: number): number {
  if (!expiresAt) return 0;
  return Math.max(0, Math.round((Date.parse(expiresAt) - now) / 1000));
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (razorpayCtor()) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(`script[data-nw-rzp]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("script")));
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.dataset.nwRzp = "";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("script"));
    document.head.appendChild(s);
  });
}

export function CheckoutClient({ quoteId, initial, testMode }: { quoteId: string; initial: CheckoutSnapshot; testMode: boolean }) {
  const router = useRouter();
  const phone = useIsPhone();
  const [snap, setSnap] = useState<CheckoutSnapshot>(initial);
  const [view, setView] = useState<"pay" | "processing">(initial.phase === "processing" ? "processing" : "pay");
  const [busy, startBusy] = useTransition();
  const [qrOnPhone, setQrOnPhone] = useState(false);
  const [intentBusy, setIntentBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [paymentStartedAt, setPaymentStartedAt] = useState<number | null>(null);
  const prepared = useRef(false);

  const state = snap.state;
  const phase: CheckoutPhase = snap.phase;
  const attempt = state?.attempt ?? null;
  const pkg: SummaryPackage | null = state
    ? {
        planSlug: state.quote.planSlug,
        planName: state.quote.planName,
        baseMinor: state.quote.baseMinor,
        includedUniversities: state.quote.includedUniversities,
        additionalUniversities: state.quote.additionalUniversities,
        addonUnitMinor: state.quote.addonUnitMinor,
        addonMinor: state.quote.addonMinor,
        totalMinor: state.quote.totalMinor,
      }
    : null;
  const reference = shortReference(attempt?.reference);

  const apply = useCallback(
    (next: CheckoutSnapshot) => {
      setSnap(next);
      if (next.phase === "paid") router.refresh(); // the server renders the confirmation from the paid invoice
    },
    [router],
  );

  const prepareQr = useCallback(() => {
    startBusy(async () => apply(await prepareUpiAction(quoteId, "upi_qr")));
  }, [apply, quoteId]);

  // desktop (or "scan on another device"): make sure there is a live gateway QR
  const wantsQr = !phone || qrOnPhone;
  useEffect(() => {
    if (!wantsQr || prepared.current) return;
    const needsQr = phase === "not_started" || (attempt && (attempt.channel !== "upi_qr" || !attempt.hasGatewayObject) && phase !== "processing");
    if (needsQr && phase !== "paid" && phase !== "unavailable") {
      prepared.current = true;
      prepareQr();
    }
  }, [wantsQr, phase, attempt, prepareQr]);

  // countdown tick
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // ask the server (which asks Razorpay) whether the payment has arrived
  const polling = (phase === "awaiting_payment" || phase === "processing") && !!attempt?.hasGatewayObject;
  useEffect(() => {
    if (!polling) return;
    let stopped = false;
    let timer = 0;
    const started = Date.now();
    const tick = async () => {
      if (stopped) return;
      const next = await refreshUpiStatusAction(quoteId).catch(() => null);
      if (stopped) return;
      if (next?.state) apply(next);
      timer = window.setTimeout(tick, Date.now() - started > 10 * 60_000 ? POLL_SLOW_MS : POLL_MS);
    };
    timer = window.setTimeout(tick, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        window.clearTimeout(timer);
        void tick();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [polling, quoteId, apply]);

  const left = secondsLeft(attempt?.expiresAt ?? null, now);
  const qrExpired = attempt?.channel === "upi_qr" && attempt.hasGatewayObject && (left === 0 || phase === "expired");

  const newQr = () => {
    prepared.current = true;
    prepareQr();
  };

  const openUpiApp = async () => {
    if (intentBusy) return;
    setIntentBusy(true);
    try {
      const { options, error } = await getUpiIntentOptionsAction(quoteId);
      if (!options) {
        if (error) setSnap((s) => ({ ...s, error }));
        else apply(await refreshUpiStatusAction(quoteId));
        return;
      }
      await loadScript(options.scriptUrl);
      openRazorpay(options);
    } catch {
      setSnap((s) => ({ ...s, error: "We couldn't open the payment window. Check your connection and try again." }));
    } finally {
      setIntentBusy(false);
    }
  };

  const openRazorpay = (o: IntentOptions) => {
    const Ctor = razorpayCtor();
    if (!Ctor) return;
    const rzp = new Ctor({
      key: o.keyId,
      order_id: o.orderId,
      amount: o.amountMinor,
      currency: o.currency,
      name: "Nextwise",
      description: o.description,
      prefill: { name: o.prefill.name ?? undefined, email: o.prefill.email ?? undefined },
      theme: { color: "#03045f" },
      // UPI only: one UPI block, default blocks hidden, UPI collect (deprecated by NPCI) hidden
      config: {
        display: {
          blocks: { upi: { name: "Pay using any UPI app", instruments: [{ method: "upi" }] } },
          sequence: ["block.upi"],
          hide: [{ method: "upi", flows: ["collect"] }],
          preferences: { show_default_blocks: false },
        },
      },
      handler: () => {
        // The handler's fields are not trusted: the server re-reads the order's payments from Razorpay.
        setPaymentStartedAt(Date.now());
        setView("processing");
        void refreshUpiStatusAction(quoteId).then(apply);
      },
      modal: {
        ondismiss: () => {
          void refreshUpiStatusAction(quoteId).then(apply);
        },
      },
    });
    rzp.on?.("payment.failed", () => {
      void refreshUpiStatusAction(quoteId).then(apply);
    });
    rzp.open();
  };

  if (!state || !pkg) {
    return (
      <main className="nwp-main nwp-checkout" id="main-content">
        <div className="nwp-wrap">
          <p className="nwp-error">{snap.error ?? "This checkout was not found."}</p>
        </div>
      </main>
    );
  }

  if (phase === "unavailable") {
    return (
      <main className="nwp-main nwp-status" id="main-content">
        <div className="nwp-wrap nwp-wrap-narrow">
          <Steps at={3} />
          <section className="nwp-card nwp-failed" aria-labelledby="nwp-gone-title">
            <h1 id="nwp-gone-title" className="nwp-h1">
              This checkout is no longer active
            </h1>
            <p className="nwp-lede">You started a newer checkout, or the package details changed. Nothing was charged from this page. Please choose your package again.</p>
            <div className="nwp-success-actions">
              <Link className="nwp-btn nwp-btn-primary" href={`/pricing?plan=${pkg.planSlug}${pkg.additionalUniversities ? `&extra=${pkg.additionalUniversities}` : ""}`}>
                Back to pricing
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (view === "processing" || phase === "processing") {
    return <Processing pkg={pkg} reference={reference} startedAt={paymentStartedAt} lastFailure={phase === "failed"} onBack={() => setView("pay")} />;
  }

  if (phase === "failed") {
    return <Failed pkg={pkg} reference={reference} reason={state.lastPayment?.failureReason ?? null} onRetry={() => (phone && !qrOnPhone ? void openUpiApp() : newQr())} onSwitch={() => (phone ? setQrOnPhone((v) => !v) : newQr())} phone={phone} />;
  }

  const summary = <OrderSummary pkg={pkg} reference={reference} taxNote={taxNoteFor(pkg.planSlug)} />;

  return (
    <main className="nwp-main nwp-checkout" id="main-content" data-phone={phone ? "" : undefined}>
      <div className="nwp-wrap">
        <Steps at={3} />
        <div className="nwp-co-head">
          <Link className="nwp-link nwp-back" href={`/pricing?plan=${pkg.planSlug}${pkg.additionalUniversities ? `&extra=${pkg.additionalUniversities}` : ""}`}>
            <ArrowLeft aria-hidden="true" /> Back to pricing
          </Link>
          <h1 className="nwp-h1">Complete your payment {testMode ? <span className="nwp-testmode">TEST MODE</span> : null}</h1>
        </div>
        {phone ? <MobileSummary pkg={pkg} reference={reference} /> : null}
        {snap.error ? (
          <p className="nwp-error" role="alert">
            {snap.error}
          </p>
        ) : null}
        <div className="nwp-co-grid">
          <section className="nwp-methods" aria-label="Choose how to pay">
            <div className="nwp-method" data-on="" data-method="upi">
              <div className="nwp-method-head" id="nwp-method-upi" aria-expanded="true">
                <span className="nwp-radio" aria-hidden="true">
                  <i />
                </span>
                <span className="nwp-method-icon" aria-hidden="true">
                  <Smartphone />
                </span>
                <span className="nwp-method-text">
                  <b>
                    UPI <span className="nwp-pill">Recommended</span>
                  </b>
                  <span>Google Pay, PhonePe, BHIM and other UPI apps</span>
                </span>
                <ChevronDown className="nwp-chev" aria-hidden="true" />
              </div>
              <div className="nwp-method-body" id="nwp-panel-upi" data-open="">
                <div className="nwp-method-inner">
                  {phone && !qrOnPhone ? (
                    <UpiAppPanel onPay={openUpiApp} busy={intentBusy} onQr={() => setQrOnPhone(true)} reference={reference} />
                  ) : (
                    <UpiQrPanel
                      imageUrl={attempt?.channel === "upi_qr" ? attempt.qrImageUrl : null}
                      amountMinor={attempt?.amountMinor ?? pkg.totalMinor}
                      reference={reference}
                      left={left}
                      expired={!!qrExpired}
                      busy={busy}
                      onNewQr={newQr}
                      onApproved={() => {
                        setPaymentStartedAt(Date.now());
                        setView("processing");
                        void refreshUpiStatusAction(quoteId).then(apply);
                      }}
                      onApps={phone ? () => setQrOnPhone(false) : undefined}
                    />
                  )}
                </div>
              </div>
            </div>
            {DISABLED_METHODS.map((m) => {
              const Icon = m.icon;
              return (
                <div key={m.id} className="nwp-method" data-method={m.id} data-disabled="">
                  <button type="button" className="nwp-method-head" disabled aria-disabled="true" id={`nwp-method-${m.id}`}>
                    <span className="nwp-radio" aria-hidden="true" />
                    <span className="nwp-method-icon" aria-hidden="true">
                      <Icon />
                    </span>
                    <span className="nwp-method-text">
                      <b>
                        {m.label} <span className="nwp-soon">Coming soon</span>
                      </b>
                      <span>{m.sub}</span>
                    </span>
                  </button>
                </div>
              );
            })}
          </section>
          {!phone ? (
            <aside className="nwp-co-side">
              {summary}
              <SecurityNote />
            </aside>
          ) : (
            <SecurityNote />
          )}
        </div>
      </div>
      {phone ? (
        <div className="nwp-paybar">
          <span>
            <b data-amount={pkg.totalMinor}>{formatInr(pkg.totalMinor)}</b>
            <span>
              {pkg.planName.replace("Nextwise ", "")}
              {pkg.includedUniversities !== null ? ` · ${pkg.includedUniversities + pkg.additionalUniversities} universities` : ""}
            </span>
          </span>
          <button type="button" className="nwp-btn nwp-btn-primary" onClick={() => void openUpiApp()} disabled={intentBusy} id="nwp-paybar-btn">
            {intentBusy ? <Loader2 className="nwp-spin" aria-hidden="true" /> : null} Pay with UPI app
          </button>
        </div>
      ) : null}
    </main>
  );
}

function MobileSummary({ pkg, reference }: { pkg: SummaryPackage; reference: string | null }) {
  const [open, setOpen] = useState(false);
  const total = pkg.includedUniversities === null ? null : pkg.includedUniversities + pkg.additionalUniversities;
  return (
    <section className="nwp-msum" aria-label="Your package">
      <button type="button" className="nwp-msum-head" aria-expanded={open} onClick={() => setOpen((o) => !o)} id="nwp-msum-toggle">
        <span>
          <b>{pkg.planName}</b>
          {total !== null ? (
            <span className="nwp-msum-cover">
              <UniversityDots included={pkg.includedUniversities ?? 0} extra={pkg.additionalUniversities} /> {total} universities
            </span>
          ) : null}
        </span>
        <span className="nwp-msum-amt">
          <b data-amount={pkg.totalMinor}>{formatInr(pkg.totalMinor)}</b>
          <ChevronDown aria-hidden="true" />
        </span>
      </button>
      <div className="nwp-msum-body" data-open={open ? "" : undefined}>
        <div>
          <OrderSummary pkg={pkg} reference={reference} taxNote={taxNoteFor(pkg.planSlug)} />
        </div>
      </div>
    </section>
  );
}

function UpiQrPanel(props: {
  imageUrl: string | null;
  amountMinor: number;
  reference: string | null;
  left: number;
  expired: boolean;
  busy: boolean;
  onNewQr: () => void;
  onApproved: () => void;
  onApps?: () => void;
}) {
  const { imageUrl, amountMinor, reference, left, expired, busy, onNewQr, onApproved, onApps } = props;
  const mm = String(Math.floor(left / 60));
  const ss = String(left % 60).padStart(2, "0");
  return (
    <div className="nwp-upi" data-expired={expired ? "" : undefined}>
      <div className="nwp-upi-text">
        <h2 className="nwp-h2">Pay securely with UPI</h2>
        <p>Scan the QR code using any supported UPI application to complete your payment.</p>
      </div>
      <div className="nwp-qrcard">
        <div className="nwp-qrcard-top">
          <span>Pay Nextwise</span>
        </div>
        <div className="nwp-qr-wrap">
          <div className="nwp-qr" data-expired={expired ? "" : undefined}>
            {imageUrl && !busy ? (
              // eslint-disable-next-line @next/next/no-img-element -- Razorpay serves the single-use QR image; it is not a static asset Next can optimise
              <img className="nwp-qr-img" src={imageUrl} alt={`UPI QR code to pay Nextwise ${formatInr(amountMinor)}. Scan it with any UPI app.`} id="nwp-qr-img" />
            ) : (
              <div className="nwp-qr-loading" role="status">
                <Loader2 className="nwp-spin" aria-hidden="true" /> Preparing a secure QR code…
              </div>
            )}
            {imageUrl && !expired && !busy ? <i className="nwp-qr-scan" aria-hidden="true" /> : null}
          </div>
          {expired && !busy ? (
            <div className="nwp-qr-expired" role="status">
              <b>This QR code has expired</b>
              <span>For your security each code works for a limited time.</span>
              <button type="button" className="nwp-btn nwp-btn-primary" onClick={onNewQr} id="nwp-newqr">
                <RefreshCw aria-hidden="true" /> Generate new QR
              </button>
            </div>
          ) : null}
        </div>
        <div className="nwp-qrcard-amt">
          <span>Amount</span>
          <b data-amount={amountMinor}>{formatInr(amountMinor)}</b>
        </div>
        <dl className="nwp-qrcard-meta">
          <div>
            <dt>Merchant</dt>
            <dd>Nextwise</dd>
          </div>
          <div>
            <dt>Reference</dt>
            <dd>
              <code>{reference ?? "…"}</code>
            </dd>
          </div>
          <div>
            <dt>Expires in</dt>
            <dd className="nwp-timer" data-low={left < 60 ? "" : undefined}>
              {expired ? "Expired" : imageUrl ? `${mm}:${ss}` : "…"}
            </dd>
          </div>
        </dl>
      </div>
      <ol className="nwp-howto">
        <li>Open any UPI app on your phone.</li>
        <li>Scan this code. The amount and Nextwise&apos;s reference are filled in for you.</li>
        <li>Check that it says Nextwise and {formatInr(amountMinor)}, then approve with your UPI PIN in the app.</li>
      </ol>
      <div className="nwp-waiting">
        <span className="nwp-live" aria-hidden="true" />
        <span>Waiting for your payment. This page updates by itself once your UPI app confirms.</span>
      </div>
      <div className="nwp-upi-actions">
        <button type="button" className="nwp-btn nwp-btn-primary" disabled={expired || !imageUrl} onClick={onApproved} id="nwp-upi-paid">
          I&apos;ve approved the payment in my UPI app
        </button>
        {onApps ? (
          <button type="button" className="nwp-link" onClick={onApps}>
            <Smartphone aria-hidden="true" /> Pay with a UPI app on this phone instead
          </button>
        ) : null}
      </div>
    </div>
  );
}

function UpiAppPanel({ onPay, busy, onQr, reference }: { onPay: () => void; busy: boolean; onQr: () => void; reference: string | null }) {
  return (
    <div className="nwp-upi nwp-upi-m">
      <div className="nwp-upi-text">
        <h2 className="nwp-h2">Pay with your UPI app</h2>
        <p>Choose your UPI app in the secure payment window. The amount and Nextwise&apos;s payment reference are filled in for you, and you approve with your UPI PIN inside the app.</p>
      </div>
      <button type="button" className="nwp-btn nwp-btn-primary nwp-btn-block" onClick={onPay} disabled={busy} id="nwp-open-upi">
        {busy ? <Loader2 className="nwp-spin" aria-hidden="true" /> : <Smartphone aria-hidden="true" />} Choose UPI app
      </button>
      <p className="nwp-fine">The apps shown are the UPI apps installed on this phone, listed by our payment partner.</p>
      <button type="button" className="nwp-link" onClick={onQr} id="nwp-qr-other">
        <QrCode aria-hidden="true" /> Scan QR on another device
      </button>
      {reference ? (
        <p className="nwp-ref">
          Reference <code>{reference}</code>
        </p>
      ) : null}
    </div>
  );
}

function Processing({ pkg, reference, startedAt, onBack }: { pkg: SummaryPackage; reference: string | null; startedAt: number | null; lastFailure: boolean; onBack: () => void }) {
  const [stage, setStage] = useState(1);
  useEffect(() => {
    const t = window.setTimeout(() => setStage(2), 1400);
    return () => window.clearTimeout(t);
  }, []);
  const when = startedAt ? new Date(startedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : null;
  return (
    <main className="nwp-main nwp-status" id="main-content">
      <div className="nwp-wrap">
        <Steps at={4} />
        <div className="nwp-status-grid">
          <section className="nwp-card nwp-processing" aria-labelledby="nwp-proc-title" aria-live="polite">
            <div className="nwp-orbit" aria-hidden="true">
              <i />
              <ShieldCheck />
            </div>
            <h1 id="nwp-proc-title" className="nwp-h1">
              Confirming your payment
            </h1>
            <p className="nwp-lede">We&apos;re securely checking your payment status. Please keep this page open or return to your dashboard later.</p>
            <ol className="nwp-track">
              <li data-state="done">
                <span className="nwp-track-dot">
                  <Check aria-hidden="true" />
                </span>
                <span>
                  <b>Payment started</b>
                  <span>UPI{when ? ` · ${when}` : ""}</span>
                </span>
              </li>
              <li data-state={stage >= 2 ? "current" : "next"}>
                <span className="nwp-track-dot">{stage >= 2 ? <Loader2 className="nwp-spin" aria-hidden="true" /> : null}</span>
                <span>
                  <b>Waiting for confirmation from the payment partner</b>
                  <span>Usually a few seconds. UPI can sometimes take a few minutes.</span>
                </span>
              </li>
              <li data-state="next">
                <span className="nwp-track-dot" />
                <span>
                  <b>Verified by Nextwise</b>
                  <span>Amount and reference matched, then your plan is activated.</span>
                </span>
              </li>
            </ol>
            {reference ? (
              <p className="nwp-ref">
                Payment reference <code>{reference}</code>
              </p>
            ) : null}
            <p className="nwp-fine">Nothing is unlocked until the payment partner confirms the payment to Nextwise&apos;s server. Closing this page doesn&apos;t cancel anything: you&apos;ll see the result in Student Studio.</p>
            <div className="nwp-success-actions">
              <Link className="nwp-btn nwp-btn-quiet" href="/studio">
                Go to Student Studio
              </Link>
              <button type="button" className="nwp-link" onClick={onBack} id="nwp-back-to-qr">
                Back to the QR code
              </button>
            </div>
          </section>
          <aside>
            <OrderSummary pkg={pkg} reference={reference} taxNote={taxNoteFor(pkg.planSlug)} />
          </aside>
        </div>
      </div>
    </main>
  );
}

function Failed({ pkg, reference, reason, onRetry, onSwitch, phone }: { pkg: SummaryPackage; reference: string | null; reason: string | null; onRetry: () => void; onSwitch: () => void; phone: boolean }) {
  return (
    <main className="nwp-main nwp-status" id="main-content">
      <div className="nwp-wrap">
        <Steps at={3} />
        <div className="nwp-status-grid">
          <section className="nwp-card nwp-failed" aria-labelledby="nwp-fail-title" role="alert">
            <span className="nwp-fail-icon" aria-hidden="true">
              <TriangleAlert />
            </span>
            <h1 id="nwp-fail-title" className="nwp-h1">
              Your payment didn&apos;t go through
            </h1>
            <p className="nwp-lede">The payment partner reported that this payment was not completed. Your package is still selected, so you can try again in a moment.</p>
            <ul className="nwp-fail-list">
              <li>If your bank shows a deduction, it is normally reversed automatically. Keep the reference below in case you need to contact us.</li>
              <li>{reason ? `Reason given: ${reason}` : "Common causes: the payment was declined in the app, the request timed out, or the daily UPI limit was reached."}</li>
            </ul>
            {reference ? (
              <p className="nwp-ref">
                Reference <code>{reference}</code> · UPI
              </p>
            ) : null}
            <div className="nwp-success-actions">
              <button type="button" className="nwp-btn nwp-btn-primary" onClick={onRetry} id="nwp-retry">
                <RefreshCw aria-hidden="true" /> Retry payment
              </button>
              <button type="button" className="nwp-btn nwp-btn-quiet" onClick={onSwitch} id="nwp-change-method">
                <Repeat aria-hidden="true" /> {phone ? "Pay by QR on another device" : "Show a new QR code"}
              </button>
            </div>
          </section>
          <aside>
            <OrderSummary pkg={pkg} reference={reference} taxNote={taxNoteFor(pkg.planSlug)} />
          </aside>
        </div>
      </div>
    </main>
  );
}
