import "server-only";

/**
 * Milestone 10 (F-122) — central place that reads the signature-provider
 * environment variables and decides which SignatureProvider implementation
 * to use. Mirrors src/lib/payments/env.ts's role for Razorpay: reads
 * everything from process.env, never throws on missing values, and every
 * value is optional/undefined-safe — spec requirement: "the app must run
 * with none of these set, defaulting to the mock provider". This module
 * never hard-codes an assumption about which real provider is configured —
 * `provider` is a plain string switched on by getSignatureProvider()
 * (src/lib/signatures/get-provider.ts), not a type union baked in here.
 */

export interface SignatureProviderEnvConfig {
  /** e.g. 'mock' (default), or a real provider's own identifier once one is wired up (see docs/milestones/M10-electronic-signature.md "Future provider integration"). Never assumed to be any particular value beyond 'mock' by this module itself. */
  provider: string;
  apiKey: string | null;
  apiSecret: string | null;
  webhookSecret: string | null;
  /** e.g. 'sandbox' | 'production' — purely descriptive, passed through to whichever real provider adapter reads it; never interpreted by this module. */
  environment: string | null;
}

const DEFAULT_PROVIDER = "mock";

/**
 * A fixed, clearly-labeled development-only fallback webhook secret, used
 * ONLY when SIGNATURE_WEBHOOK_SECRET is unset AND NODE_ENV is not
 * 'production' — so the mock provider's full create-request -> webhook
 * loop works out of the box in local dev/tests without any .env setup,
 * while production always fails closed (returns null) when genuinely
 * unconfigured, exactly like every other secret in this codebase. NEVER
 * used when NODE_ENV === 'production', checked explicitly below — not
 * merely "unlikely to be set in production".
 */
const DEV_ONLY_FALLBACK_WEBHOOK_SECRET = "dev-only-mock-signature-webhook-secret-do-not-use-in-production";

export function getSignatureProviderEnvConfig(): SignatureProviderEnvConfig {
  const provider = (process.env.SIGNATURE_PROVIDER || DEFAULT_PROVIDER).trim().toLowerCase();
  const apiKey = process.env.SIGNATURE_API_KEY || null;
  const apiSecret = process.env.SIGNATURE_API_SECRET || null;
  const environment = process.env.SIGNATURE_ENVIRONMENT || null;

  let webhookSecret = process.env.SIGNATURE_WEBHOOK_SECRET || null;
  if (!webhookSecret && process.env.NODE_ENV !== "production") {
    webhookSecret = DEV_ONLY_FALLBACK_WEBHOOK_SECRET;
  }

  return { provider, apiKey, apiSecret, webhookSecret, environment };
}

export function getSignatureWebhookSecret(): string | null {
  return getSignatureProviderEnvConfig().webhookSecret;
}

export function isSignatureWebhookConfigured(): boolean {
  return !!getSignatureWebhookSecret();
}

export function getSignatureProviderName(): string {
  return getSignatureProviderEnvConfig().provider;
}
