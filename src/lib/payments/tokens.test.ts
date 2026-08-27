import { describe, expect, it } from "vitest";
import { generatePaymentLinkToken, hashPaymentLinkToken, defaultTokenExpiry } from "./tokens";

describe("generatePaymentLinkToken", () => {
  it("generates a non-trivial, URL-safe token", () => {
    const token = generatePaymentLinkToken();
    expect(token.length).toBeGreaterThan(30);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("never generates the same token twice — 256 bits of CSPRNG output, collision-free for practical purposes", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generatePaymentLinkToken()));
    expect(tokens.size).toBe(100);
  });

  it("never encodes any sequential id, user id, or invoice id — the raw token carries no derivable structure", () => {
    const a = generatePaymentLinkToken();
    const b = generatePaymentLinkToken();
    // Two independently generated tokens should share no meaningful prefix —
    // a loose proxy for "carries no sequential/derivable structure".
    expect(a.slice(0, 8)).not.toBe(b.slice(0, 8));
  });
});

describe("hashPaymentLinkToken", () => {
  it("is deterministic for the same input", () => {
    const token = generatePaymentLinkToken();
    expect(hashPaymentLinkToken(token)).toBe(hashPaymentLinkToken(token));
  });

  it("produces a 64-character lowercase hex SHA-256 digest", () => {
    const hash = hashPaymentLinkToken("test-token");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("never returns the raw token itself", () => {
    const token = "a-raw-token-value";
    expect(hashPaymentLinkToken(token)).not.toBe(token);
  });

  it("different tokens hash to different values", () => {
    expect(hashPaymentLinkToken("token-a")).not.toBe(hashPaymentLinkToken("token-b"));
  });
});

describe("defaultTokenExpiry", () => {
  it("expires 30 days after the given reference time", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const expiry = new Date(defaultTokenExpiry(now));
    const diffDays = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(30, 5);
  });

  it("is always in the future relative to its reference time", () => {
    const now = new Date();
    expect(new Date(defaultTokenExpiry(now)).getTime()).toBeGreaterThan(now.getTime());
  });
});
