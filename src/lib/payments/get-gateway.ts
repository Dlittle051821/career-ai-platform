import "server-only";
import type { PaymentGateway } from "./gateway";
import { RazorpayGateway } from "./providers/razorpay";
import { getRazorpayServerConfig } from "./env";

/**
 * The one place application code asks for "the current payment gateway."
 * Returns null when unconfigured — every caller must handle that by
 * surfacing a "Payment gateway is not configured" state, never by
 * crashing (spec requirement — see src/lib/payments/env.ts).
 */
export function getPaymentGateway(): PaymentGateway | null {
  const config = getRazorpayServerConfig();
  if (!config) return null;
  return new RazorpayGateway(config);
}
