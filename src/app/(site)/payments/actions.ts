"use server";

import { revalidatePath } from "next/cache";
import { createOrReuseCheckoutSession, verifyCheckoutPayment, CheckoutError, type CheckoutSession } from "@/lib/supabase/payments/checkout";

export interface CheckoutSessionResult {
  session: CheckoutSession | null;
  error: string | null;
}

/** Called from the client "Pay now" button — never trusts anything from the client beyond which invoice to pay; the amount charged is always recomputed server-side from the invoice's actual due balance. */
export async function createCheckoutSessionAction(invoiceId: string): Promise<CheckoutSessionResult> {
  try {
    const session = await createOrReuseCheckoutSession(invoiceId);
    return { session, error: null };
  } catch (error) {
    return { session: null, error: error instanceof CheckoutError ? error.message : "Could not start checkout. Please try again." };
  }
}

export interface VerifyCheckoutResult {
  status: string | null;
  error: string | null;
}

/** Called from the client after Razorpay Checkout's own success handler fires. Never itself decides the payment succeeded — delegates entirely to public.verify_checkout_payment(), which independently re-verifies the signature. See src/lib/supabase/payments/checkout.ts. */
export async function verifyCheckoutAction(invoiceId: string, params: { paymentAttemptId: string; providerPaymentId: string; providerOrderId: string; signature: string }): Promise<VerifyCheckoutResult> {
  try {
    const result = await verifyCheckoutPayment(params);
    revalidatePath(`/payments/${invoiceId}`);
    revalidatePath("/payments");
    return { status: result.status, error: null };
  } catch (error) {
    return { status: null, error: error instanceof CheckoutError ? error.message : "We could not verify this payment." };
  }
}
