import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getStampProviderEnvConfig, getStampWebhookSecret, isStampWebhookConfigured, getStampProviderName } from "./config";

const ENV_KEYS = ["STAMP_PROVIDER", "STAMP_API_KEY", "STAMP_API_SECRET", "STAMP_WEBHOOK_SECRET", "STAMP_ENVIRONMENT", "NODE_ENV"] as const;

// @types/node marks process.env.NODE_ENV specifically as readonly; this
// cast is test-only plumbing, same as src/lib/signatures/config.test.ts.
const env = process.env as Record<string, string | undefined>;

describe("stamping/config", () => {
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

  it("defaults provider to 'mock' when STAMP_PROVIDER is unset", () => {
    clearAll();
    expect(getStampProviderName()).toBe("mock");
  });

  it("lowercases and trims a configured provider name", () => {
    clearAll();
    process.env.STAMP_PROVIDER = "  SHCIL  ";
    expect(getStampProviderName()).toBe("shcil");
  });

  it("defaults environment to 'test' when unset", () => {
    clearAll();
    expect(getStampProviderEnvConfig().environment).toBe("test");
  });

  it("leaves apiKey/apiSecret null when unset", () => {
    clearAll();
    const cfg = getStampProviderEnvConfig();
    expect(cfg.apiKey).toBeNull();
    expect(cfg.apiSecret).toBeNull();
  });

  it("reads apiKey/apiSecret/environment when set", () => {
    clearAll();
    process.env.STAMP_API_KEY = "key123";
    process.env.STAMP_API_SECRET = "secret456";
    process.env.STAMP_ENVIRONMENT = "sandbox";
    const cfg = getStampProviderEnvConfig();
    expect(cfg.apiKey).toBe("key123");
    expect(cfg.apiSecret).toBe("secret456");
    expect(cfg.environment).toBe("sandbox");
  });

  it("uses the real STAMP_WEBHOOK_SECRET when set, in any NODE_ENV", () => {
    clearAll();
    process.env.STAMP_WEBHOOK_SECRET = "real-secret";
    env.NODE_ENV = "production";
    expect(getStampWebhookSecret()).toBe("real-secret");
    expect(isStampWebhookConfigured()).toBe(true);
  });

  it("falls back to a dev-only webhook secret when unset and NODE_ENV is not production", () => {
    clearAll();
    env.NODE_ENV = "test";
    const secret = getStampWebhookSecret();
    expect(secret).toBeTruthy();
    expect(secret).toMatch(/dev-only/i);
    expect(isStampWebhookConfigured()).toBe(true);
  });

  it("NEVER falls back to the dev secret when NODE_ENV is production", () => {
    clearAll();
    env.NODE_ENV = "production";
    expect(getStampWebhookSecret()).toBeNull();
    expect(isStampWebhookConfigured()).toBe(false);
  });

  it("treats an empty-string STAMP_WEBHOOK_SECRET as unset", () => {
    clearAll();
    process.env.STAMP_WEBHOOK_SECRET = "";
    env.NODE_ENV = "production";
    expect(getStampWebhookSecret()).toBeNull();
  });
});
