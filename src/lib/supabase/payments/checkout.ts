import "server-only";
import { randomBytes } from "node:crypto";
import { createClient } from "../server";
import { getCurrentUser } from "../profile";
import { getPaymentGateway } from "@/lib/payments/get-gateway";
import { getRazorpayServerConfig } from "@/lib/payments/env";
import { PAYABLE_INVOICE_STATUSES } from "@/types/payments";
import {
  CHECKOUT_CHARGE_BLOCKED_MESSAGE,
  validateCheckoutCharge,
  type ChargeInput,
  type ChargePurchase,
} from "@/lib/payments/checkout-charge-guard";

/**
 * The student checkout flow: create (or safely reuse) a Razorpay order for
 * an invoice, then verify the browser's checkout-success callback against
 * the database (never trusting it on its own — see
 * public.verify_checkout_payment() in 0005_payments_billing.sql). Every
 * function here operates as the SIGNED-IN STUDENT'S OWN session; there is
 * no service-role key or admin bypass anywhere in this file. Amount is
 * always the server-computed amount still due on the invoice — never a
 * number supplied by the client (spec: "never accept amount... from client
 * input").
 */

export class CheckoutError extends Error {}

function logDbError(context: string, error: unknown) {
  console.error(`[payments/checkout] ${context}:`, error);
}

export interface CheckoutSession {
  paymentAttemptId: string;
  providerOrderId: string;
  amountMinorUnits: number;
  currency: string;
  razorpayKeyId: string;
  invoiceNumber: string | null;
}

/**
 * Creates a new Razorpay order for this invoice, or returns the existing
 * still-open one if the student already started (or re-opened) checkout.
 * `payment_attempts_one_active_per_invoice` is the actual concurrency
 * guard — a race between two near-simultaneous calls (double-click, two
 * tabs) is resolved by that partial unique index rejecting the second
 * INSERT, which this function catches and falls back to re-reading the
 * now-existing row.
 */
type SessionClient = Awaited<ReturnType<typeof createClient>>;
const TAX_STATUSES = ["unconfigured", "tax_exclusive", "tax_inclusive"] as const;

/**
 * Reads everything validateCheckoutCharge() needs, with the student's own
 * session (RLS). Any read error becomes "unknown" (undefined/null), which the
 * guard treats as a failure — never as a pass.
 */
async function loadChargeContext(
  supabase: SessionClient,
  invoiceId: string,
): Promise<Pick<ChargeInput, "lineItems" | "purchase">> {
  const { data: lines, error: linesError } = await supabase
    .from("invoice_line_items")
    .select("tax_rate_bps, tax_minor_units, line_total_minor_units")
    .eq("invoice_id", invoiceId);
  const lineItems = linesError || !lines
    ? null
    : lines.map((l) => ({ taxRateBps: l.tax_rate_bps, taxMinorUnits: l.tax_minor_units, lineTotalMinorUnits: l.line_total_minor_units }));
  if (linesError) logDbError("loadChargeContext:lines", linesError);

  const { data: purchases, error: purchaseError } = await supabase
    .from("pricing_purchases")
    .select("plan_id, plan_version_id, plan_name_at_purchase, original_amount_minor_units, discount_minor_units, tax_minor_units, final_amount_minor_units, currency")
    .eq("invoice_id", invoiceId);
  if (purchaseError || !purchases || purchases.length > 1) {
    if (purchaseError) logDbError("loadChargeContext:purchase", purchaseError);
    return { lineItems, purchase: undefined };
  }
  const row = purchases[0];
  if (!row) return { lineItems, purchase: null };

  let planSlug: string | null = null;
  if (row.plan_id) {
    const { data: plan } = await supabase.from("pricing_plans").select("slug").eq("id", row.plan_id).maybeSingle();
    planSlug = plan?.slug ?? null;
  }
  let versionTaxStatus: ChargePurchase["versionTaxStatus"] = null;
  if (row.plan_version_id) {
    const { data: version } = await supabase.from("pricing_plan_versions").select("tax_status").eq("id", row.plan_version_id).maybeSingle();
    versionTaxStatus = TAX_STATUSES.find((status) => status === version?.tax_status) ?? null;
  }
  return {
    lineItems,
    purchase: {
      planSlug,
      planNameAtPurchase: row.plan_name_at_purchase,
      originalMinorUnits: row.original_amount_minor_units,
      discountMinorUnits: row.discount_minor_units,
      taxMinorUnits: row.tax_minor_units,
      finalMinorUnits: row.final_amount_minor_units,
      currency: row.currency,
      versionTaxStatus,
    },
  };
}

export async function createOrReuseCheckoutSession(invoiceId: string): Promise<CheckoutSession> {
  const user = await getCurrentUser();
  if (!user) throw new CheckoutError("You must be signed in to pay an invoice.");

  const config = getRazorpayServerConfig();
  const gateway = getPaymentGateway();
  if (!config || !gateway) {
    throw new CheckoutError("Payment gateway is not configured. Please contact support.");
  }

  const supabase = await createClient();
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, invoice_number, status, currency, subtotal_minor_units, discount_minor_units, tax_minor_units, total_minor_units, student_user_id")
    .eq("id", invoiceId)
    .eq("student_user_id", user.id)
    .maybeSingle();
  if (invoiceError) {
    logDbError("createOrReuseCheckoutSession:invoice", invoiceError);
    throw new CheckoutError("Could not load this invoice.");
  }
  if (!invoice) throw new CheckoutError("Invoice not found.");
  if (!PAYABLE_INVOICE_STATUSES.includes(invoice.status as (typeof PAYABLE_INVOICE_STATUSES)[number])) {
    throw new CheckoutError(`This invoice is not payable (status: ${invoice.status}).`);
  }

  // Amount due = total minus whatever has already been captured — always
  // recomputed server-side here, never taken from the client.
  const { data: attempts, error: attemptsError } = await supabase.from("payment_attempts").select("id, status, provider_order_id, amount_minor_units").eq("invoice_id", invoiceId);
  if (attemptsError) {
    logDbError("createOrReuseCheckoutSession:attempts", attemptsError);
    throw new CheckoutError(CHECKOUT_CHARGE_BLOCKED_MESSAGE);
  }
  const existingActive = (attempts ?? []).find((a) => a.status === "created" || a.status === "pending" || a.status === "authorized");

  const attemptIds = (attempts ?? []).map((a) => a.id);
  let capturedTotal = 0;
  if (attemptIds.length > 0) {
    const { data: txns, error: txnsError } = await supabase
      .from("payment_transactions")
      .select("amount_minor_units")
      .in("payment_attempt_id", attemptIds)
      .in("status", ["captured", "refunded", "partially_refunded"]);
    if (txnsError) {
      logDbError("createOrReuseCheckoutSession:transactions", txnsError);
      throw new CheckoutError(CHECKOUT_CHARGE_BLOCKED_MESSAGE);
    }
    capturedTotal = (txns ?? []).reduce((sum, t) => sum + t.amount_minor_units, 0);
  }
  const dueMinorUnits = Math.max(0, invoice.total_minor_units - capturedTotal);
  if (dueMinorUnits <= 0) throw new CheckoutError("This invoice has already been paid in full.");

  // Fail closed: never create or reuse a gateway order for an amount that
  // cannot be proven correct (see checkout-charge-guard.ts). A reused order
  // must also be for exactly the amount due now.
  const context = await loadChargeContext(supabase, invoiceId);
  const charge = validateCheckoutCharge({
    invoice: {
      currency: invoice.currency,
      subtotalMinorUnits: invoice.subtotal_minor_units,
      discountMinorUnits: invoice.discount_minor_units,
      taxMinorUnits: invoice.tax_minor_units,
      totalMinorUnits: invoice.total_minor_units,
    },
    ...context,
    chargeMinorUnits: dueMinorUnits,
  });
  if (!charge.ok) {
    console.error(`[payments/checkout] charge blocked for invoice ${invoiceId}: ${charge.reason}`);
    throw new CheckoutError(CHECKOUT_CHARGE_BLOCKED_MESSAGE);
  }

  // CC-18: the database's authoritative check (trusted billing_settings GST
  // configuration, Verified inclusive-tax rules, exact amount due) runs BEFORE
  // any gateway order is created or reused. Any error, a missing RPC, or a
  // non-null reason blocks checkout — never fall back to the app-only guard.
  const { data: dbProblem, error: dbCheckError } = await supabase.rpc("check_invoice_charge", {
    p_invoice_id: invoiceId,
    p_amount: dueMinorUnits,
    p_currency: invoice.currency,
  });
  if (dbCheckError || dbProblem !== null) {
    if (dbCheckError) logDbError("createOrReuseCheckoutSession:check_invoice_charge", dbCheckError);
    else console.error(`[payments/checkout] charge blocked for invoice ${invoiceId}: ${String(dbProblem)}`);
    throw new CheckoutError(CHECKOUT_CHARGE_BLOCKED_MESSAGE);
  }

  if (existingActive && existingActive.provider_order_id) {
    if (existingActive.amount_minor_units !== dueMinorUnits) {
      console.error(`[payments/checkout] charge blocked for invoice ${invoiceId}: open order amount differs from amount due`);
      throw new CheckoutError(CHECKOUT_CHARGE_BLOCKED_MESSAGE);
    }
    return {
      paymentAttemptId: existingActive.id,
      providerOrderId: existingActive.provider_order_id,
      amountMinorUnits: existingActive.amount_minor_units,
      currency: invoice.currency,
      razorpayKeyId: config.keyId,
      invoiceNumber: invoice.invoice_number,
    };
  }

  const idempotencyKey = `${invoiceId}-${randomBytes(12).toString("hex")}`;
  const receipt = idempotencyKey.replace(/-/g, "").slice(0, 56);

  let order;
  try {
   order = await gateway.createOrder({
  amountMinorUnits: dueMinorUnits,
  currency: invoice.currency,
  receipt,
  notes: { invoice_id: invoiceId, invoice_number: invoice.invoice_number ?? "" },
});
  } catch (gatewayError) {
    logDbError("createOrReuseCheckoutSession:gateway", gatewayError);
    throw new CheckoutError("Could not start checkout with the payment gateway. Please try again in a moment.");
  }

  const { data: inserted, error: insertError } = await supabase
    .from("payment_attempts")
    .insert({
      invoice_id: invoiceId,
      provider: "razorpay",
      provider_order_id: order.providerOrderId,
      idempotency_key: idempotencyKey,
      status: "created",
      amount_minor_units: dueMinorUnits,
      currency: invoice.currency,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insertError) {
    // Most likely payment_attempts_one_active_per_invoice — someone else
    // (another tab, a race) created the active attempt first. Fall back to
    // reading it rather than erroring the student out.
    logDbError("createOrReuseCheckoutSession:insert", insertError);
    const { data: retryAttempts } = await supabase
      .from("payment_attempts")
      .select("id, status, provider_order_id, amount_minor_units")
      .eq("invoice_id", invoiceId)
      .in("status", ["created", "pending", "authorized"])
      .limit(1);
    const retry = (retryAttempts ?? [])[0];
    if (retry && retry.provider_order_id && retry.amount_minor_units === dueMinorUnits) {
      return {
        paymentAttemptId: retry.id,
        providerOrderId: retry.provider_order_id,
        amountMinorUnits: retry.amount_minor_units,
        currency: invoice.currency,
        razorpayKeyId: config.keyId,
        invoiceNumber: invoice.invoice_number,
      };
    }
    throw new CheckoutError("Could not start checkout. Please refresh and try again.");
  }

  return {
    paymentAttemptId: inserted.id,
    providerOrderId: order.providerOrderId,
    amountMinorUnits: dueMinorUnits,
    currency: invoice.currency,
    razorpayKeyId: config.keyId,
    invoiceNumber: invoice.invoice_number,
  };
}

export interface VerifyCheckoutParams {
  paymentAttemptId: string;
  providerPaymentId: string;
  providerOrderId: string;
  signature: string;
}

/**
 * The ONLY path a "checkout completed" signal from the browser can reach
 * the database through. Delegates the actual verification entirely to
 * public.verify_checkout_payment() (0005_payments_billing.sql PART 6.6),
 * which independently re-derives Razorpay's HMAC signature using the
 * secret in payment_gateway_config — this function cannot be tricked into
 * accepting a forged or mismatched signature just because the caller is a
 * genuinely signed-in student, since the RPC itself re-verifies
 * cryptographically regardless of who's asking.
 */
export async function verifyCheckoutPayment(params: VerifyCheckoutParams): Promise<{ status: string }> {
  const user = await getCurrentUser();
  if (!user) throw new CheckoutError("You must be signed in to verify a payment.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("verify_checkout_payment", {
    p_payment_attempt_id: params.paymentAttemptId,
    p_provider_payment_id: params.providerPaymentId,
    p_provider_order_id: params.providerOrderId,
    p_signature: params.signature,
  });

  if (error) {
    logDbError("verifyCheckoutPayment", error);
    throw new CheckoutError("We could not verify this payment. If money was deducted, it will be reconciled automatically — contact support if it isn't reflected within a few minutes.");
  }

  return { status: data?.status ?? "authorized" };
}
