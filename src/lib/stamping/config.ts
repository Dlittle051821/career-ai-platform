import "server-only";

/**
 * Milestone 11-A (F-123) — central place that reads the stamping-provider
 * environment variables and decides which StampProvider implementation to
 * use. Mirrors src/lib/signatures/config.ts's role for the signature
 * gateway exactly: reads everything from process.env, never throws on
 * missing values, every value is optional/undefined-safe — same spec
 * requirement carried over: "the app must run with none of these set,
 * defaulting to the mock provider." This module never hard-codes an
 * assumption about which real provider is configured — `provider` is a
 * plain string switched on by getStampProvider()
 * (src/lib/stamping/get-provider.ts), not a type union baked in here.
 */

export interface StampProviderEnvConfig {
  /** e.g. 'mock' (default), or a real provider's own identifier once one is wired up. Never assumed to be any particular value beyond 'mock' by this module itself. */
  provider: string;
  apiKey: string | null;
  apiSecret: string | null;
  webhookSecret: string | null;
  /** e.g. 'test' (default) | 'sandbox' | 'production' — purely descriptive, passed through to whichever real provider adapter reads it; never interpreted by this module. Staging must remain test/sandbox — spec §30. */
  environment: string | null;
}

const DEFAULT_PROVIDER = "mock";
const DEFAULT_ENVIRONMENT = "test";

/**
 * A fixed, clearly-labeled development-only fallback webhook secret, used
 * ONLY when STAMP_WEBHOOK_SECRET is unset AND NODE_ENV is not 'production'
 * — so the mock provider's full request -> webhook loop works out of the
 * box for local testing without any .env setup, while production always
 * fails closed (returns null) when genuinely unconfigured, exactly like
 * every other secret in this codebase (see
 * src/lib/signatures/config.ts's identical DEV_ONLY_FALLBACK_WEBHOOK_SECRET
 * for the established precedent). NEVER used when NODE_ENV === 'production',
 * checked explicitly below — not merely "unlikely to be set in production".
 */
const DEV_ONLY_FALLBACK_WEBHOOK_SECRET = "dev-only-mock-stamp-webhook-secret-do-not-use-in-production";

export function getStampProviderEnvConfig(): StampProviderEnvConfig {
  const provider = (process.env.STAMP_PROVIDER || DEFAULT_PROVIDER).trim().toLowerCase();
  const apiKey = process.env.STAMP_API_KEY || null;
  const apiSecret = process.env.STAMP_API_SECRET || null;
  const environment = process.env.STAMP_ENVIRONMENT || DEFAULT_ENVIRONMENT;

  let webhookSecret = process.env.STAMP_WEBHOOK_SECRET || null;
  if (!webhookSecret && process.env.NODE_ENV !== "production") {
    webhookSecret = DEV_ONLY_FALLBACK_WEBHOOK_SECRET;
  }

  return { provider, apiKey, apiSecret, webhookSecret, environment };
}

export function getStampWebhookSecret(): string | null {
  return getStampProviderEnvConfig().webhookSecret;
}

export function isStampWebhookConfigured(): boolean {
  return !!getStampWebhookSecret();
}

export function getStampProviderName(): string {
  return getStampProviderEnvConfig().provider;
}
