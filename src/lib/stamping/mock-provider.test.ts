import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { MockStampProvider } from "./mock-provider";

const ENV_KEYS = ["STAMP_WEBHOOK_SECRET", "NODE_ENV"] as const;

// @types/node marks process.env.NODE_ENV specifically as readonly; this
// cast is test-only plumbing, same as src/lib/signatures/mock-provider.test.ts.
const env = process.env as Record<string, string | undefined>;

describe("stamping/mock-provider", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) saved[key] = process.env[key];
    process.env.STAMP_WEBHOOK_SECRET = "test-webhook-secret";
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else env[key] = saved[key];
    }
  });

  const baseParams = {
    agreementId: "agreement-1",
    agreementVersionId: "version-1",
    documentTitle: "Counselling Services Agreement",
    jurisdiction: "India",
    state: "Karnataka",
    documentType: "counselling_agreement",
  };

  it("createStampRequest returns a unique provider request id and status 'processing', with no invented stamp value", async () => {
    const provider = new MockStampProvider();
    const result = await provider.createStampRequest(baseParams);
    expect(result.providerRequestId).toMatch(/^mock_stamp_/);
    expect(result.status).toBe("processing");
    expect(result.stampValue).toBeNull();

    const status = await provider.getStampStatus(result.providerRequestId);
    expect(status.status).toBe("processing");
  });

  it("two created requests get different provider request ids", async () => {
    const provider = new MockStampProvider();
    const a = await provider.createStampRequest(baseParams);
    const b = await provider.createStampRequest(baseParams);
    expect(a.providerRequestId).not.toBe(b.providerRequestId);
  });

  it("getStampStatus throws for an unknown request id", async () => {
    const provider = new MockStampProvider();
    await expect(provider.getStampStatus("nope")).rejects.toThrow(/no request/i);
  });

  it("cancelStampRequest flips status to 'cancelled'", async () => {
    const provider = new MockStampProvider();
    const { providerRequestId } = await provider.createStampRequest(baseParams);
    await provider.cancelStampRequest(providerRequestId);
    const status = await provider.getStampStatus(providerRequestId);
    expect(status.status).toBe("cancelled");
  });

  it("cancelStampRequest throws for an unknown request id", async () => {
    const provider = new MockStampProvider();
    await expect(provider.cancelStampRequest("nope")).rejects.toThrow(/no request/i);
  });

  it("retrieveStampedDocument returns a non-empty PDF-shaped buffer", async () => {
    const provider = new MockStampProvider();
    const { providerRequestId } = await provider.createStampRequest(baseParams);
    const doc = await provider.retrieveStampedDocument(providerRequestId);
    expect(doc.contentType).toBe("application/pdf");
    expect(doc.bytes.byteLength).toBeGreaterThan(100);
    // %PDF magic bytes
    expect(String.fromCharCode(doc.bytes[0], doc.bytes[1], doc.bytes[2], doc.bytes[3])).toBe("%PDF");
  });

  it("getAvailableStampOptions returns a small, clearly-illustrative set — never claims to be real jurisdiction values", async () => {
    const provider = new MockStampProvider();
    const options = await provider.getAvailableStampOptions();
    expect(options.length).toBeGreaterThan(0);
    for (const option of options) {
      expect(option.jurisdiction).toMatch(/mock/i);
      expect(option.stampValue).toBeGreaterThan(0);
    }
  });

  describe("verifyWebhook", () => {
    it("accepts a correctly-signed body", () => {
      const provider = new MockStampProvider();
      const rawBody = JSON.stringify({ eventType: "stamp_request.completed" });
      const signature = createHmac("sha256", "test-webhook-secret").update(rawBody).digest("hex");
      expect(provider.verifyWebhook({ rawBody, signature })).toBe(true);
    });

    it("rejects a tampered body", () => {
      const provider = new MockStampProvider();
      const rawBody = JSON.stringify({ eventType: "stamp_request.completed" });
      const signature = createHmac("sha256", "test-webhook-secret").update(rawBody).digest("hex");
      expect(provider.verifyWebhook({ rawBody: rawBody + "tampered", signature })).toBe(false);
    });

    it("rejects a signature signed with the wrong secret", () => {
      const provider = new MockStampProvider();
      const rawBody = JSON.stringify({ eventType: "stamp_request.completed" });
      const signature = createHmac("sha256", "wrong-secret").update(rawBody).digest("hex");
      expect(provider.verifyWebhook({ rawBody, signature })).toBe(false);
    });

    it("returns false (never throws) when no webhook secret is configured", () => {
      delete process.env.STAMP_WEBHOOK_SECRET;
      env.NODE_ENV = "production";
      const provider = new MockStampProvider();
      expect(provider.verifyWebhook({ rawBody: "{}", signature: "anything" })).toBe(false);
    });
  });

  describe("simulateEvent (test harness)", () => {
    it("produces a webhook envelope whose signature this provider's own verifyWebhook accepts", async () => {
      const provider = new MockStampProvider();
      const { providerRequestId } = await provider.createStampRequest(baseParams);
      const delivery = provider.simulateEvent(providerRequestId, "completed");
      expect(provider.verifyWebhook(delivery)).toBe(true);

      const parsed = JSON.parse(delivery.rawBody);
      expect(parsed.eventType).toBe("stamp_request.completed");
      expect(parsed.provider).toBe("mock");
      expect(parsed.providerRequestId).toBe(providerRequestId);
    });

    it("updates internal state so getStampStatus reflects the simulated event, with a stamp value only on completion", async () => {
      const provider = new MockStampProvider();
      const { providerRequestId } = await provider.createStampRequest(baseParams);
      provider.simulateEvent(providerRequestId, "completed");
      const status = await provider.getStampStatus(providerRequestId);
      expect(status.status).toBe("completed");
      expect(status.completedAt).toBeTruthy();
      expect(status.stampValue).toBeGreaterThan(0);
    });

    it("does not set a stamp value on a 'failed' event", async () => {
      const provider = new MockStampProvider();
      const { providerRequestId } = await provider.createStampRequest(baseParams);
      provider.simulateEvent(providerRequestId, "failed");
      const status = await provider.getStampStatus(providerRequestId);
      expect(status.status).toBe("failed");
      expect(status.stampValue).toBeNull();
    });

    it("throws for an unknown request id", () => {
      const provider = new MockStampProvider();
      expect(() => provider.simulateEvent("nope", "completed")).toThrow(/no request/i);
    });

    it("throws when no webhook secret is configured", async () => {
      const provider = new MockStampProvider();
      const { providerRequestId } = await provider.createStampRequest(baseParams);
      delete process.env.STAMP_WEBHOOK_SECRET;
      env.NODE_ENV = "production";
      expect(() => provider.simulateEvent(providerRequestId, "completed")).toThrow(/not configured/i);
    });

    it("carries a custom stamp value through the envelope metadata", async () => {
      const provider = new MockStampProvider();
      const { providerRequestId } = await provider.createStampRequest(baseParams);
      const delivery = provider.simulateEvent(providerRequestId, "completed", { stampValue: 50000 });
      const parsed = JSON.parse(delivery.rawBody);
      expect(parsed.metadata.stampValue).toBe(50000);
    });
  });
});
