import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getSignatureProviderEnvConfig, getSignatureWebhookSecret, isSignatureWebhookConfigured, getSignatureProviderName } from "./config";

const ENV_KEYS = ["SIGNATURE_PROVIDER", "SIGNATURE_API_KEY", "SIGNATURE_API_SECRET", "SIGNATURE_WEBHOOK_SECRET", "SIGNATURE_ENVIRONMENT", "NODE_ENV"] as const;

// @types/node marks process.env.NODE_ENV specifically as readonly; this
// cast is test-only plumbing so this file can still exercise the
// dev-vs-production fallback behavior.
const env = process.env as Record<string, string | undefined>;

describe("signatures/config", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) saved[key] = process.env[key];
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else env[key] = saved[key];
    }
  });

  function clearAll() {
    for (const key of ENV_KEYS) delete process.env[key];
  }

  it("defaults provider to 'mock' when SIGNATURE_PROVIDER is unset", () => {
    clearAll();
    expect(getSignatureProviderName()).toBe("mock");
  });

  it("lowercases and trims a configured provider name", () => {
    clearAll();
    process.env.SIGNATURE_PROVIDER = "  DocuSign  ";
    expect(getSignatureProviderName()).toBe("docusign");
  });

  it("leaves apiKey/apiSecret/environment null when unset", () => {
    clearAll();
    const cfg = getSignatureProviderEnvConfig();
    expect(cfg.apiKey).toBeNull();
    expect(cfg.apiSecret).toBeNull();
    expect(cfg.environment).toBeNull();
  });

  it("reads apiKey/apiSecret/environment when set", () => {
    clearAll();
    process.env.SIGNATURE_API_KEY = "key123";
    process.env.SIGNATURE_API_SECRET = "secret456";
    process.env.SIGNATURE_ENVIRONMENT = "sandbox";
    const cfg = getSignatureProviderEnvConfig();
    expect(cfg.apiKey).toBe("key123");
    expect(cfg.apiSecret).toBe("secret456");
    expect(cfg.environment).toBe("sandbox");
  });

  it("uses the real SIGNATURE_WEBHOOK_SECRET when set, in any NODE_ENV", () => {
    clearAll();
    process.env.SIGNATURE_WEBHOOK_SECRET = "real-secret";
    env.NODE_ENV = "production";
    expect(getSignatureWebhookSecret()).toBe("real-secret");
    expect(isSignatureWebhookConfigured()).toBe(true);
  });

  it("falls back to a dev-only webhook secret when unset and NODE_ENV is not production", () => {
    clearAll();
    env.NODE_ENV = "test";
    const secret = getSignatureWebhookSecret();
    expect(secret).toBeTruthy();
    expect(secret).toMatch(/dev-only/i);
    expect(isSignatureWebhookConfigured()).toBe(true);
  });

  it("NEVER falls back to the dev secret when NODE_ENV is production", () => {
    clearAll();
    env.NODE_ENV = "production";
    expect(getSignatureWebhookSecret()).toBeNull();
    expect(isSignatureWebhookConfigured()).toBe(false);
  });

  it("treats an empty-string SIGNATURE_WEBHOOK_SECRET as unset", () => {
    clearAll();
    process.env.SIGNATURE_WEBHOOK_SECRET = "";
    env.NODE_ENV = "production";
    expect(getSignatureWebhookSecret()).toBeNull();
  });
});
