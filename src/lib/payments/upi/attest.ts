import { createHmac } from "node:crypto";

/**
 * NW-PAYMENT-V1 — signs a fact the server read from Razorpay's API before
 * handing it to public.apply_upi_gateway_record(), which re-derives the same
 * HMAC-SHA256 from the key secret stored in payment_gateway_config and refuses
 * anything else. The browser never sees the secret, so it cannot produce a
 * record the database will accept. `ts` bounds replay to 15 minutes.
 */
export type GatewayRecord =
  | { type: "qr_created"; attempt_id: string; qr_id: string; image_url: string; close_by: number; amount: number; currency: string; fixed_amount: boolean; usage: string }
  | { type: "order_created"; attempt_id: string; order_id: string; amount: number; currency: string }
  | { type: "attempt_closed"; attempt_id: string; reason: string }
  | { type: "payments_observed"; attempt_id: string; payments: ObservedPayment[] }
  | { type: "list_reconcile" };

export interface ObservedPayment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  captured: boolean;
  method: string | null;
  error_description: string | null;
}

export function attestRecord(record: GatewayRecord, keySecret: string, nowSeconds: number = Math.floor(Date.now() / 1000)): { payload: string; signature: string } {
  const payload = JSON.stringify({ ...record, ts: nowSeconds });
  const signature = createHmac("sha256", keySecret).update(payload).digest("hex");
  return { payload, signature };
}
