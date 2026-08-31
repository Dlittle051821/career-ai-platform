import { describe, expect, it } from "vitest";
import {
  validateExternalUrl,
  hostnameMatchesAllowedDomain,
  isVerificationStale,
  STALE_VERIFICATION_THRESHOLD_MONTHS,
} from "./url-validation";

describe("hostnameMatchesAllowedDomain", () => {
  it("matches the domain itself and subdomains", () => {
    expect(hostnameMatchesAllowedDomain("daad.de", "daad.de")).toBe(true);
    expect(hostnameMatchesAllowedDomain("www2.daad.de", "daad.de")).toBe(true);
    expect(hostnameMatchesAllowedDomain("WWW2.DAAD.DE", "daad.de")).toBe(true);
  });

  it("rejects a host that merely contains the allowed domain as a substring", () => {
    expect(hostnameMatchesAllowedDomain("daad.de.evil.example", "daad.de")).toBe(false);
    expect(hostnameMatchesAllowedDomain("notdaad.de", "daad.de")).toBe(false);
    expect(hostnameMatchesAllowedDomain("evil-daad.de", "daad.de")).toBe(false);
  });

  it("rejects an unrelated domain", () => {
    expect(hostnameMatchesAllowedDomain("ucas.com", "daad.de")).toBe(false);
  });
});

describe("validateExternalUrl — allow-list enforcement", () => {
  it("accepts the exact verified DAAD URL against the www2.daad.de allow-list", () => {
    const url =
      "https://www2.daad.de/deutschland/studienangebote/international-programmes/en/result/?degree%5B0%5D=1&fos%5B0%5D=96&subjectGroup%5B0%5D=56";
    const result = validateExternalUrl(url, "www2.daad.de");
    expect(result.valid).toBe(true);
  });

  it("rejects a URL whose host is on a different domain than the provider's allow-list", () => {
    const result = validateExternalUrl("https://evil.example/phishing", "daad.de");
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("host_not_allowlisted");
  });

  it("rejects a URL on a look-alike domain", () => {
    const result = validateExternalUrl("https://daad.de.evil.example/", "daad.de");
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("host_not_allowlisted");
  });
});

describe("validateExternalUrl — non-HTTPS rejection", () => {
  it("rejects http:// URLs", () => {
    const result = validateExternalUrl("http://daad.de/", "daad.de");
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("not_https");
  });

  it("rejects ftp:// and other non-http(s) protocols", () => {
    expect(validateExternalUrl("ftp://daad.de/", "daad.de").valid).toBe(false);
  });
});

describe("validateExternalUrl — credential/script rejection", () => {
  it("rejects a URL containing embedded credentials", () => {
    const result = validateExternalUrl("https://user:pass@daad.de/", "daad.de");
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("has_credentials");
  });

  it("rejects a javascript: URL", () => {
    const result = validateExternalUrl("javascript:alert(1)", "daad.de");
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("javascript_protocol");
  });

  it("rejects an empty or missing URL", () => {
    expect(validateExternalUrl("", "daad.de").valid).toBe(false);
    expect(validateExternalUrl(null, "daad.de").valid).toBe(false);
    expect(validateExternalUrl(undefined, "daad.de").valid).toBe(false);
  });

  it("rejects an unparseable string", () => {
    expect(validateExternalUrl("not a url at all", "daad.de").valid).toBe(false);
  });
});

describe("isVerificationStale", () => {
  const now = new Date("2026-08-30T00:00:00Z");

  it("is not stale when verified recently", () => {
    expect(isVerificationStale("2026-06-01", now)).toBe(false);
  });

  it(`is stale when verified more than ${STALE_VERIFICATION_THRESHOLD_MONTHS} months ago`, () => {
    expect(isVerificationStale("2025-01-01", now)).toBe(true);
  });

  it("is not stale exactly at the threshold boundary (a bit under 12 months)", () => {
    expect(isVerificationStale("2025-09-15", now)).toBe(false);
  });

  it("treats a null/undefined/unparseable last-verified date as stale (safe default)", () => {
    expect(isVerificationStale(null, now)).toBe(true);
    expect(isVerificationStale(undefined, now)).toBe(true);
    expect(isVerificationStale("not-a-date", now)).toBe(true);
  });

  it("treats a future-dated verification as not stale (clock skew tolerance)", () => {
    expect(isVerificationStale("2026-09-15", now)).toBe(false);
  });
});
