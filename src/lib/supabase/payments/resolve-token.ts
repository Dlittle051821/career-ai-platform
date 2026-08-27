import "server-only";
import { createClient } from "../server";
import { getCurrentUser } from "../profile";
import { hashPaymentLinkToken } from "@/lib/payments/tokens";

/**
 * Resolves a raw "/pay/[token]" URL token to an invoice id — ONLY if the
 * token is unexpired/unrevoked AND belongs to the signed-in student. Relies
 * entirely on payment_request_tokens' own RLS policy ("Students can read
 * tokens for their own invoices") to enforce the ownership check: a token
 * hash that matches a row belonging to a DIFFERENT student simply returns
 * no rows here, exactly as if the token didn't exist — this function never
 * distinguishes "wrong student" from "token doesn't exist" in its return
 * value, so it can't be used to enumerate or fingerprint other students'
 * tokens. A token is a lookup convenience only, never a bypass of RLS
 * ownership (see 0005_payments_billing.sql PART 9's table comment).
 */
export async function resolvePaymentLinkToken(rawToken: string): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const tokenHash = hashPaymentLinkToken(rawToken);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_request_tokens")
    .select("invoice_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    console.error("[payments/resolve-token] resolvePaymentLinkToken:", error);
    return null;
  }
  if (!data) return null;
  if (data.revoked_at) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;

  return data.invoice_id;
}
