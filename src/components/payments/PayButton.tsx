"use client";

import { useState } from "react";
import Script from "next/script";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createCheckoutSessionAction, verifyCheckoutAction } from "@/app/(site)/payments/actions";
import { BRAND_LOGO, BRAND_NAME } from "@/config/site";

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description?: string;
  image?: string;
  handler: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
  modal?: { ondismiss?: () => void };
  theme?: { color?: string };
}

/**
 * The one client-JS-heavy piece of the student payment flow — everything
 * else in this module is a plain server-rendered page. Loads Razorpay's own
 * Checkout.js (their official hosted script — required by Razorpay's
 * integration model; there is no server-side-only way to open their
 * payment modal) and drives it against a server-created order. The success
 * handler NEVER assumes payment succeeded on its own — it always calls
 * verifyCheckoutAction, which is the only path that can mark anything
 * "authorized" (see public.verify_checkout_payment() in
 * 0005_payments_billing.sql). Guards against double-submission with a
 * `busy` flag disabling the button while a checkout is in flight.
 */
export function PayButton({ invoiceId, invoiceNumber }: { invoiceId: string; invoiceNumber: string | null }) {
  const [scriptReady, setScriptReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "verifying" | "verified">("idle");

  async function handlePay() {
    if (busy || !scriptReady || !window.Razorpay) return;
    setBusy(true);
    setError(null);

    const { session, error: sessionError } = await createCheckoutSessionAction(invoiceId);
    if (!session) {
      setError(sessionError ?? "Could not start checkout.");
      setBusy(false);
      return;
    }

    const razorpay = new window.Razorpay({
      key: session.razorpayKeyId,
      amount: session.amountMinorUnits,
      currency: session.currency,
      order_id: session.providerOrderId,
      name: BRAND_NAME,
      description: session.invoiceNumber ? `Invoice ${session.invoiceNumber}` : "Invoice payment",
      image: BRAND_LOGO.icon512,
      theme: { color: "#0f4c3a" },
      modal: {
        ondismiss: () => setBusy(false),
      },
      handler: async (response) => {
        setStatus("verifying");
        const result = await verifyCheckoutAction(invoiceId, {
          paymentAttemptId: session.paymentAttemptId,
          providerPaymentId: response.razorpay_payment_id,
          providerOrderId: response.razorpay_order_id,
          signature: response.razorpay_signature,
        });
        setBusy(false);
        if (result.error) {
          setError(result.error);
          setStatus("idle");
        } else {
          setStatus("verified");
        }
      },
    });
    razorpay.open();
  }

  return (
    <div className="space-y-3">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" onReady={() => setScriptReady(true)} strategy="afterInteractive" />
      {error ? (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      ) : null}
      {status === "verified" ? (
        <p className="flex items-center gap-2 rounded-[var(--radius-control)] border border-success/25 bg-success-light px-3.5 py-2.5 text-sm text-success">
          <ShieldCheck aria-hidden="true" className="h-4 w-4" />
          Payment submitted and verified. It may take a few minutes to fully reflect while the gateway confirms
          capture.
        </p>
      ) : (
        <Button onClick={handlePay} disabled={busy || !scriptReady} icon={busy ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : undefined}>
          {busy ? (status === "verifying" ? "Verifying…" : "Starting checkout…") : `Pay ${invoiceNumber ? `invoice ${invoiceNumber}` : "now"}`}
        </Button>
      )}
    </div>
  );
}
