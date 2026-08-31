import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { MockSignatureProvider } from "./mock-provider";

const ENV_KEYS = ["SIGNATURE_WEBHOOK_SECRET", "NODE_ENV"] as const;

// @types/node marks process.env.NODE_ENV specifically as readonly; this
// cast is test-only plumbing so this file can still exercise the
// webhook-secret-not-configured behavior across NODE_ENV values.
const env = process.env as Record<string, string | undefined>;

describe("signatures/mock-provider", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) saved[key] = process.env[key];
    process.env.SIGNATURE_WEBHOOK_SECRET = "test-webhook-secret";
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
    signerName: "Asha Verma",
    signerEmail: "asha@example.com",
    documentTitle: "Counselling Services Agreement",
  };

  it("createSignatureRequest returns a unique provider request id and status 'sent'", async () => {
    const provider = new MockSignatureProvider();
    const result = await provider.createSignatureRequest(baseParams);
    expect(result.providerRequestId).toMatch(/^mock_req_/);
    expect(result.status).toBe("sent");

    const status = await provider.getSignatureStatus(result.providerRequestId);
    expect(status.status).toBe("sent");
  });

  it("two created requests get different provider request ids", async () => {
    const provider = new MockSignatureProvider();
    const a = await provider.createSignatureRequest(baseParams);
    const b = await provider.createSignatureRequest(baseParams);
    expect(a.providerRequestId).not.toBe(b.providerRequestId);
  });

  it("getSignatureStatus throws for an unknown request id", async () => {
    const provider = new MockSignatureProvider();
    await expect(provider.getSignatureStatus("nope")).rejects.toThrow(/no request/i);
  });

  it("cancelSignatureRequest flips status to 'cancelled'", async () => {
    const provider = new MockSignatureProvider();
    const { providerRequestId } = await provider.createSignatureRequest(baseParams);
    await provider.cancelSignatureRequest(providerRequestId);
    const status = await provider.getSignatureStatus(providerRequestId);
    expect(status.status).toBe("cancelled");
  });

  it("cancelSignatureRequest throws for an unknown request id", async () => {
    const provider = new MockSignatureProvider();
    await expect(provider.cancelSignatureRequest("nope")).rejects.toThrow(/no request/i);
  });

  it("resendSignatureRequest does not change status", async () => {
    const provider = new MockSignatureProvider();
    const { providerRequestId } = await provider.createSignatureRequest(baseParams);
    await provider.resendSignatureRequest(providerRequestId);
    const status = await provider.getSignatureStatus(providerRequestId);
    expect(status.status).toBe("sent");
  });

  it("resendSignatureRequest throws for an unknown request id", async () => {
    const provider = new MockSignatureProvider();
    await expect(provider.resendSignatureRequest("nope")).rejects.toThrow(/no request/i);
  });

  it("getSignedDocument returns a non-empty PDF-shaped buffer", async () => {
    const provider = new MockSignatureProvider();
    const { providerRequestId } = await provider.createSignatureRequest(baseParams);
    const doc = await provider.getSignedDocument(providerRequestId);
    expect(doc.contentType).toBe("application/pdf");
    expect(doc.bytes.byteLength).toBeGreaterThan(100);
    // %PDF magic bytes
    expect(String.fromCharCode(doc.bytes[0], doc.bytes[1], doc.bytes[2], doc.bytes[3])).toBe("%PDF");
  });

  describe("verifyWebhook", () => {
    it("accepts a correctly-signed body", () => {
      const provider = new MockSignatureProvider();
      const rawBody = JSON.stringify({ eventType: "signature_request.signed" });
      const signature = createHmac("sha256", "test-webhook-secret").update(rawBody).digest("hex");
      expect(provider.verifyWebhook({ rawBody, signature })).toBe(true);
    });

    it("rejects a tampered body", () => {
      const provider = new MockSignatureProvider();
      const rawBody = JSON.stringify({ eventType: "signature_request.signed" });
      const signature = createHmac("sha256", "test-webhook-secret").update(rawBody).digest("hex");
      expect(provider.verifyWebhook({ rawBody: rawBody + "tampered", signature })).toBe(false);
    });

    it("rejects a signature signed with the wrong secret", () => {
      const provider = new MockSignatureProvider();
      const rawBody = JSON.stringify({ eventType: "signature_request.signed" });
      const signature = createHmac("sha256", "wrong-secret").update(rawBody).digest("hex");
      expect(provider.verifyWebhook({ rawBody, signature })).toBe(false);
    });

    it("returns false (never throws) when no webhook secret is configured", () => {
      delete process.env.SIGNATURE_WEBHOOK_SECRET;
      env.NODE_ENV = "production";
      const provider = new MockSignatureProvider();
      expect(provider.verifyWebhook({ rawBody: "{}", signature: "anything" })).toBe(false);
    });
  });

  describe("simulateEvent (test harness)", () => {
    it("produces a webhook envelope whose signature this provider's own verifyWebhook accepts", async () => {
      const provider = new MockSignatureProvider();
      const { providerRequestId } = await provider.createSignatureRequest(baseParams);
      const delivery = provider.simulateEvent(providerRequestId, "viewed");
      expect(provider.verifyWebhook(delivery)).toBe(true);

      const parsed = JSON.parse(delivery.rawBody);
      expect(parsed.eventType).toBe("signature_request.viewed");
      expect(parsed.provider).toBe("mock");
      expect(parsed.providerRequestId).toBe(providerRequestId);
    });

    it("updates internal state so getSignatureStatus reflects the simulated event", async () => {
      const provider = new MockSignatureProvider();
      const { providerRequestId } = await provider.createSignatureRequest(baseParams);
      provider.simulateEvent(providerRequestId, "signed");
      const status = await provider.getSignatureStatus(providerRequestId);
      expect(status.status).toBe("signed");
      expect(status.signedAt).toBeTruthy();
    });

    it("throws for an unknown request id", () => {
      const provider = new MockSignatureProvider();
      expect(() => provider.simulateEvent("nope", "signed")).toThrow(/no request/i);
    });

    it("throws when no webhook secret is configured", async () => {
      const provider = new MockSignatureProvider();
      const { providerRequestId } = await provider.createSignatureRequest(baseParams);
      delete process.env.SIGNATURE_WEBHOOK_SECRET;
      env.NODE_ENV = "production";
      expect(() => provider.simulateEvent(providerRequestId, "signed")).toThrow(/not configured/i);
    });

    it("carries through arbitrary metadata into the envelope", async () => {
      const provider = new MockSignatureProvider();
      const { providerRequestId } = await provider.createSignatureRequest(baseParams);
      const delivery = provider.simulateEvent(providerRequestId, "declined", { reason: "changed my mind" });
      const parsed = JSON.parse(delivery.rawBody);
      expect(parsed.metadata).toEqual({ reason: "changed my mind" });
    });
  });
});
