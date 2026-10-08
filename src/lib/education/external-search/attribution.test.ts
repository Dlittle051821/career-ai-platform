import { describe, expect, it } from "vitest";
import {
  CONTINUE_ON_OFFICIAL_SOURCE_LABEL,
  EXTERNAL_LINK_BADGE_LABEL,
  TRUSTED_NATIONAL_SOURCE_LABEL,
  TRUSTED_SOURCE_ATTRIBUTION_LABEL,
  UNSUPPORTED_PARTNERSHIP_PHRASES,
  buildTrustedSourceAttribution,
  containsUnsupportedPartnershipLanguage,
} from "./attribution";

describe("buildTrustedSourceAttribution", () => {
  it("builds the consistent {label, sourceName, badge} triple from a source's display name alone", () => {
    expect(buildTrustedSourceAttribution("DAAD — German Academic Exchange Service")).toEqual({
      label: "Official study source",
      sourceName: "DAAD — German Academic Exchange Service",
      badge: "External website",
    });
  });

  it("never rewrites the source's own name", () => {
    const result = buildTrustedSourceAttribution("EducationUSA");
    expect(result.sourceName).toBe("EducationUSA");
  });

  it("always uses the shared label/badge constants, never a one-off string", () => {
    const result = buildTrustedSourceAttribution("Study Australia");
    expect(result.label).toBe(TRUSTED_SOURCE_ATTRIBUTION_LABEL);
    expect(result.badge).toBe(EXTERNAL_LINK_BADGE_LABEL);
  });
});

describe("the task's own approved wording constants", () => {
  it("match the task brief's example phrases exactly", () => {
    expect(TRUSTED_SOURCE_ATTRIBUTION_LABEL).toBe("Official study source");
    expect(TRUSTED_NATIONAL_SOURCE_LABEL).toBe("Trusted national source");
    expect(CONTINUE_ON_OFFICIAL_SOURCE_LABEL).toBe("Continue on the official source");
  });
});

describe("containsUnsupportedPartnershipLanguage", () => {
  it("catches every phrase in UNSUPPORTED_PARTNERSHIP_PHRASES, case-insensitively", () => {
    for (const phrase of UNSUPPORTED_PARTNERSHIP_PHRASES) {
      expect(containsUnsupportedPartnershipLanguage(phrase)).toBe(true);
      expect(containsUnsupportedPartnershipLanguage(phrase.toUpperCase())).toBe(true);
      expect(containsUnsupportedPartnershipLanguage(`Some sentence mentioning ${phrase} in context.`)).toBe(true);
    }
  });

  it("catches the task's own named forbidden examples", () => {
    expect(containsUnsupportedPartnershipLanguage("DAAD is our partner")).toBe(true);
    expect(containsUnsupportedPartnershipLanguage("Nextwise official partner")).toBe(true);
    expect(containsUnsupportedPartnershipLanguage("Verified by Nextwise")).toBe(true);
  });

  it("does not flag the approved wording", () => {
    expect(containsUnsupportedPartnershipLanguage("Official study source")).toBe(false);
    expect(containsUnsupportedPartnershipLanguage("Trusted national source")).toBe(false);
    expect(containsUnsupportedPartnershipLanguage("Continue on the official source")).toBe(false);
    expect(containsUnsupportedPartnershipLanguage("DAAD — German Academic Exchange Service")).toBe(false);
  });

  it("does not flag ordinary, unrelated text", () => {
    expect(containsUnsupportedPartnershipLanguage("Study in Germany with DAAD's international programmes.")).toBe(false);
  });

  it("returns false for empty/null/undefined input rather than throwing", () => {
    expect(containsUnsupportedPartnershipLanguage("")).toBe(false);
    expect(containsUnsupportedPartnershipLanguage(null)).toBe(false);
    expect(containsUnsupportedPartnershipLanguage(undefined)).toBe(false);
  });
});
