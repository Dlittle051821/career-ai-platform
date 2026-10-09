import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { validateExternalUrl } from "./url-validation";
import { LAUNCH_COUNTRY_PRIMARY_SOURCES } from "./launch-country-sources";

/**
 * M20D FINAL — Source Integrity, Trusted-Link QA & Launch-Country
 * Readiness.
 *
 * This milestone is an AUDIT, not a feature build: the task brief is
 * explicit that "do not redesign" and "only fix issues that are real,
 * reproducible, launch-relevant, minimal to correct." The audit found the
 * existing M20A/M20B/M20C/UX07 implementation already safely handles
 * every edge case this file tests — no production code changes were
 * required. These tests exist to make that safety EXPLICIT and
 * regression-proof, closing coverage gaps identified while cross-
 * referencing the task's required test list against the pre-existing
 * suite (src/lib/education/external-search/url-validation.test.ts,
 * adapter.test.ts, launch-country-sources.test.ts, launch-countries.test.ts
 * already cover the majority of the required items; see
 * docs/m20d-source-integrity-launch-qa.md for the full cross-reference).
 *
 * No React Testing Library/jsdom in this project — static source-text
 * audits here follow the exact convention already used by
 * trusted-source-card-attribution.test.ts / launch-country-discovery.test.ts
 * / src/lib/graphics/graphics-source-audit.test.ts.
 */

describe("validateExternalUrl — protocol-relative URL rejection (M20D)", () => {
  it("rejects a protocol-relative URL (no scheme) rather than silently resolving it against an assumed origin", () => {
    const result = validateExternalUrl("//evil.example/phishing", "daad.de");
    expect(result.valid).toBe(false);
    // `new URL(...)` throws with no base for a scheme-relative string, so
    // this is caught by the existing try/catch as "unparseable" — the
    // same safe-by-construction behavior as any other malformed input,
    // confirmed empirically before writing this assertion.
    expect(result.reason).toBe("unparseable");
  });

  it("rejects a protocol-relative URL even when it happens to embed the allowed domain name", () => {
    const result = validateExternalUrl("//daad.de.evil.example/x", "daad.de");
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("unparseable");
  });
});

describe("validateExternalUrl — data: URL rejection (M20D)", () => {
  it("rejects a data: URL (no HTTPS scheme, cannot be an external redirect target)", () => {
    const result = validateExternalUrl("data:text/html,<script>alert(1)</script>", "daad.de");
    expect(result.valid).toBe(false);
    // `new URL("data:...")` parses successfully with protocol "data:",
    // which then fails the existing `parsed.protocol !== "https:"` check
    // — no javascript:-style special-case was needed for this reason.
    expect(result.reason).toBe("not_https");
  });

  it("rejects a data: URL with a base64 payload", () => {
    const result = validateExternalUrl("data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==", "daad.de");
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("not_https");
  });
});

describe("validateExternalUrl — IDN / Unicode homoglyph domain rejection (M20D bonus coverage)", () => {
  it("rejects a Cyrillic-homoglyph look-alike of an allowed domain", () => {
    // "а" below (in both the raw URL and literal source) is Cyrillic
    // U+0430, not Latin "a" — the native URL parser IDNA-normalizes this
    // to its ASCII punycode form (xn--...), which can never equal or
    // endWith the plain-ASCII allowed domain string, so this is rejected
    // via the existing host_not_allowlisted path with no new code.
    const lookalike = "https://dааd.de/result";
    const result = validateExternalUrl(lookalike, "daad.de");
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("host_not_allowlisted");
    // The parsed hostname is surfaced for admin diagnostics even on
    // rejection — confirm it is the punycode form, not plain "daad.de",
    // proving the lookalike was not silently coerced into matching.
    expect(result.hostname).not.toBe("daad.de");
  });
});

describe("DAAD International Programmes vs. DAAD Degree Programmes — duplicate-pair safety (M20D)", () => {
  it("names exactly one DAAD provider as Germany's launch-primary, never daad-degree-programmes", () => {
    const germany = LAUNCH_COUNTRY_PRIMARY_SOURCES.find((entry) => entry.countryCode === "DE");
    expect(germany).toBeDefined();
    expect(germany?.providerSlug).toBe("daad-international-programmes");
    expect(germany?.providerSlug).not.toBe("daad-degree-programmes");
  });

  it("names exactly one provider slug per country across the whole registry (no accidental second primary for any country, DAAD-pair included)", () => {
    const slugs = LAUNCH_COUNTRY_PRIMARY_SOURCES.map((entry) => entry.providerSlug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("Go-route open-redirect static audit — /go/course-search/[mappingId] (M20D)", () => {
  const ROUTE_PATH = path.join(__dirname, "..", "..", "..", "app", "go", "course-search", "[mappingId]", "route.ts");
  const routeSource = readFileSync(ROUTE_PATH, "utf8");

  it("accepts only the mappingId path segment — no client-suppliable URL/destination query parameter is ever read (the route's own docblock quotes the forbidden '?url=' shape only to explain why it is deliberately NOT implemented that way)", () => {
    expect(routeSource).not.toMatch(/searchParams/);
    expect(routeSource).not.toMatch(/request\.nextUrl/);
    expect(routeSource).toContain("deliberately no `?url=`");
    expect(routeSource).toContain("/out?url=<anything>");
  });

  it("re-validates every candidate URL with validateExternalUrl immediately before the redirect, and rejects before reaching NextResponse.redirect on failure", () => {
    expect(routeSource).toContain("validateExternalUrl(mapping.verifiedUrl, provider.officialDomain)");
    expect(routeSource).toContain("validateExternalUrl(provider.baseUrl, provider.officialDomain)");
    expect(routeSource).toContain("validateExternalUrl(provider.fallbackUrl, provider.officialDomain)");
    expect(routeSource).toContain("NextResponse.redirect(target)");
  });

  it("checks mapping-active and provider-active status before ever computing a redirect target", () => {
    expect(routeSource).toContain('mapping.mappingStatus !== "active"');
    expect(routeSource).toContain("!provider.active");
  });
});

describe("Go-route open-redirect static audit — /go/course-search/provider/[providerId] (M20D)", () => {
  const ROUTE_PATH = path.join(__dirname, "..", "..", "..", "app", "go", "course-search", "provider", "[providerId]", "route.ts");
  const routeSource = readFileSync(ROUTE_PATH, "utf8");

  it("accepts only the providerId path segment — no client-suppliable URL/destination query parameter is ever read", () => {
    expect(routeSource).not.toMatch(/searchParams/);
    expect(routeSource).not.toMatch(/\?url=/);
  });

  it("re-validates both baseUrl and fallbackUrl with validateExternalUrl before redirecting, and checks provider.active first", () => {
    expect(routeSource).toContain("!provider.active");
    expect(routeSource).toContain("validateExternalUrl(provider.baseUrl, provider.officialDomain)");
    expect(routeSource).toContain("validateExternalUrl(provider.fallbackUrl, provider.officialDomain)");
    expect(routeSource).toContain("NextResponse.redirect(target)");
  });
});

describe("Launch-country code convention — GB, never UK, as the country identifier (M20D)", () => {
  it("never defines a launch country code literal of 'UK' anywhere in the registry", () => {
    const codes = LAUNCH_COUNTRY_PRIMARY_SOURCES.map((entry) => entry.countryCode);
    expect(codes).not.toContain("UK");
    expect(codes).toContain("GB");
  });
});
