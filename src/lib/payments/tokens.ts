import "server-only";
import { randomBytes, createHash } from "node:crypto";

/**
 * Opaque payment-link tokens (0005_payments_billing.sql PART 9,
 * payment_request_tokens). The raw token is 256 bits of CSPRNG output,
 * base64url-encoded — it carries no sequential id, no user id, and nothing
 * derived from the invoice it points to, satisfying the spec's explicit
 * "must not expose sequential IDs, user IDs or sensitive data." Only the
 * SHA-256 hash of the raw token is ever persisted (see
 * src/lib/supabase/admin/invoices.ts's createPaymentLink); the raw value
 * exists only in the URL handed to the admin for that one moment.
 */
export function generatePaymentLinkToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashPaymentLinkToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

const DEFAULT_TOKEN_TTL_DAYS = 30;

export function defaultTokenExpiry(now: Date = new Date()): string {
  const expires = new Date(now.getTime());
  expires.setDate(expires.getDate() + DEFAULT_TOKEN_TTL_DAYS);
  return expires.toISOString();
}
