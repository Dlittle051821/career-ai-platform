"use server";

import { createClient } from "@/lib/supabase/server";
import { beginCheckout, ensureUpiAttempt, getCheckoutState, refreshCheckout, UpiCheckoutError } from "@/lib/payments/upi/checkout-service";
import { resolveUpiCheckout } from "@/lib/payments/upi/config";
import { checkoutPhase, type CheckoutPhase, type CheckoutState, type UpiChannel } from "@/lib/payments/upi/state";

/**
 * NW-PAYMENT-V1 — the checkout page's server actions. The browser sends only
 * a quote id (which the database checks belongs to the signed-in student)
 * and a channel name. It never sends an amount, and nothing it sends can
 * mark a payment as successful.
 */

export interface CheckoutSnapshot {
  state: CheckoutState | null;
  phase: CheckoutPhase;
  error: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isChannel = (c: unknown): c is UpiChannel => c === "upi_qr" || c === "upi_checkout";

async function session() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function snapshot(state: CheckoutState | null, error: string | null = null): CheckoutSnapshot {
  return { state, phase: checkoutPhase(state), error };
}

/** Creates (or reuses) the invoice for this quote and the live QR / order for the chosen UPI channel. */
export async function prepareUpiAction(quoteId: string, channel: string): Promise<CheckoutSnapshot> {
  if (!UUID.test(quoteId) || !isChannel(channel)) return snapshot(null, "This checkout was not found.");
  const { supabase, user } = await session();
  if (!user) return snapshot(null, "Please sign in again to continue.");
  try {
    const { invoiceId } = await beginCheckout(supabase, quoteId);
    await ensureUpiAttempt(supabase, invoiceId, channel);
    return snapshot(await getCheckoutState(supabase, quoteId));
  } catch (err) {
    // messages from the checkout RPCs are written for students; gateway/internal failures are not shown
    const message = err instanceof UpiCheckoutError && !err.message.startsWith("Gateway record") ? err.message : "We couldn't prepare the payment. Please try again.";
    if (!(err instanceof UpiCheckoutError)) console.error("[checkout] prepare failed:", err instanceof Error ? err.name : "unknown");
    return snapshot(await getCheckoutState(supabase, quoteId).catch(() => null), message);
  }
}

/** "Has it been paid yet?" — answered from Razorpay's API by the server and settled in the database. */
export async function refreshUpiStatusAction(quoteId: string): Promise<CheckoutSnapshot> {
  if (!UUID.test(quoteId)) return snapshot(null, "This checkout was not found.");
  const { supabase, user } = await session();
  if (!user) return snapshot(null, "Please sign in again to continue.");
  try {
    return snapshot(await refreshCheckout(supabase, quoteId));
  } catch {
    return snapshot(await getCheckoutState(supabase, quoteId).catch(() => null), "We couldn't check the payment just now. We'll keep trying.");
  }
}

export interface IntentOptions {
  keyId: string;
  orderId: string;
  amountMinor: number;
  currency: string;
  description: string;
  prefill: { name: string | null; email: string | null };
  scriptUrl: string;
}

/** Options for Razorpay Standard Checkout restricted to UPI (Intent on mobile), for the server-created order. */
export async function getUpiIntentOptionsAction(quoteId: string): Promise<{ options: IntentOptions | null; error: string | null }> {
  const cfg = resolveUpiCheckout();
  if (!cfg.open) return { options: null, error: "Online payment is not open yet." };
  const prepared = await prepareUpiAction(quoteId, "upi_checkout");
  if (prepared.error || !prepared.state?.attempt) return { options: null, error: prepared.error ?? "We couldn't prepare the payment." };
  if (prepared.phase === "paid") return { options: null, error: null };
  const { supabase, user } = await session();
  const { data: attempt } = await supabase.from("payment_attempts").select("provider_order_id, amount_minor_units, currency, channel").eq("id", prepared.state.attempt.id).maybeSingle();
  const row = attempt as { provider_order_id: string | null; amount_minor_units: number; currency: string; channel: string | null } | null;
  if (!row?.provider_order_id || row.channel !== "upi_checkout") return { options: null, error: "We couldn't prepare the payment. Please try again." };
  const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", user?.id ?? "").maybeSingle();
  return {
    options: {
      keyId: cfg.keyId,
      orderId: row.provider_order_id,
      amountMinor: Number(row.amount_minor_units),
      currency: row.currency,
      description: prepared.state.quote.planName,
      prefill: { name: (profile as { full_name?: string | null } | null)?.full_name ?? null, email: (profile as { email?: string | null } | null)?.email ?? user?.email ?? null },
      scriptUrl: cfg.checkoutScriptUrl,
    },
    error: null,
  };
}
