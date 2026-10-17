import { describe, expect, it } from "vitest";
import { getSafeRedirectPath } from "./safe-redirect";

/**
 * UX10-DS02 — dedicated unit coverage for the shared internal-redirect
 * validator. This is the single place every `?next=...` consumer in this
 * codebase (the auth callback route, LoginForm, the login/register pages'
 * own link-building) now routes through — see safe-redirect.ts's own
 * docblock for why the two previous inline `next.startsWith("/")` checks
 * were not sufficient.
 */
describe("getSafeRedirectPath", () => {
  const FALLBACK = "/dashboard";

  it("accepts a plain internal path", () => {
    expect(getSafeRedirectPath("/discovery-session/book", FALLBACK)).toBe("/discovery-session/book");
    expect(getSafeRedirectPath("/dashboard", FALLBACK)).toBe("/dashboard");
    expect(getSafeRedirectPath("/welcome", FALLBACK)).toBe("/welcome");
  });

  it("accepts an internal path carrying its own query string", () => {
    expect(getSafeRedirectPath("/discovery-session/book?utm_source=x", FALLBACK)).toBe(
      "/discovery-session/book?utm_source=x"
    );
  });

  it("falls back on null, undefined, or an empty string", () => {
    expect(getSafeRedirectPath(null, FALLBACK)).toBe(FALLBACK);
    expect(getSafeRedirectPath(undefined, FALLBACK)).toBe(FALLBACK);
    expect(getSafeRedirectPath("", FALLBACK)).toBe(FALLBACK);
  });

  it("rejects a protocol-relative URL (the open-redirect case `startsWith('/')` alone misses)", () => {
    expect(getSafeRedirectPath("//evil.example", FALLBACK)).toBe(FALLBACK);
    expect(getSafeRedirectPath("//evil.example/phish", FALLBACK)).toBe(FALLBACK);
  });

  it("rejects a backslash-prefixed value a browser can also treat as protocol-relative", () => {
    expect(getSafeRedirectPath("/\\evil.example", FALLBACK)).toBe(FALLBACK);
  });

  it("rejects a fully-qualified external URL", () => {
    expect(getSafeRedirectPath("https://evil.example", FALLBACK)).toBe(FALLBACK);
    expect(getSafeRedirectPath("http://evil.example/anything", FALLBACK)).toBe(FALLBACK);
  });

  it("rejects a javascript: or data: scheme value", () => {
    expect(getSafeRedirectPath("javascript:alert(1)", FALLBACK)).toBe(FALLBACK);
    expect(getSafeRedirectPath("data:text/html,<script>alert(1)</script>", FALLBACK)).toBe(FALLBACK);
  });

  it("rejects a value with no leading slash at all", () => {
    expect(getSafeRedirectPath("discovery-session/book", FALLBACK)).toBe(FALLBACK);
    expect(getSafeRedirectPath("evil.example", FALLBACK)).toBe(FALLBACK);
  });

  it("rejects malformed percent-encoding instead of throwing", () => {
    expect(() => getSafeRedirectPath("/%", FALLBACK)).not.toThrow();
    expect(getSafeRedirectPath("/%", FALLBACK)).toBe(FALLBACK);
  });

  it("rejects a percent-encoded value that decodes to an unsafe path", () => {
    // decodeURIComponent("%2F%2Fevil.example") === "//evil.example"
    expect(getSafeRedirectPath("%2F%2Fevil.example", FALLBACK)).toBe(FALLBACK);
  });

  it("rejects a value embedding a scheme separator after an otherwise-safe-looking prefix", () => {
    expect(getSafeRedirectPath("/redirect?url=https://evil.example", FALLBACK)).toBe(FALLBACK);
  });
});
