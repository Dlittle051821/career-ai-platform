import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { containsUnsupportedPartnershipLanguage } from "./attribution";
import { getLaunchCountryPrimarySource } from "./launch-country-sources";

/**
 * M20B — static source-text audit of
 * src/components/sections/education/TrustedExternalSearchCard.tsx. No
 * React Testing Library/jsdom in this project (same reason documented
 * throughout vitest.config.mts and used by
 * src/lib/graphics/graphics-source-audit.test.ts for the UX09 graphics
 * components) — this reads the component's source as plain text instead
 * of rendering it.
 */
const CARD_PATH = path.join(__dirname, "..", "..", "..", "components", "sections", "education", "TrustedExternalSearchCard.tsx");
const cardSource = readFileSync(CARD_PATH, "utf8");

describe("TrustedExternalSearchCard — M20B attribution integration", () => {
  it("imports and uses M20A's attribution label and M20B's launch-primary detector, rather than a one-off re-implementation", () => {
    expect(cardSource).toContain('from "@/lib/education/external-search/attribution"');
    expect(cardSource).toContain("TRUSTED_SOURCE_ATTRIBUTION_LABEL");
    expect(cardSource).toContain('from "@/lib/education/external-search/launch-primary-result"');
    expect(cardSource).toContain("isLaunchPrimaryResult");
  });

  it("still falls back to the pre-existing generic label for a non-launch-primary result (not removed, only made conditional)", () => {
    expect(cardSource).toContain("Official external portal");
  });

  it("still carries the pre-existing non-partnership disclosure ('is not part of NextWise') — M20B did not remove UX07's own existing disclosure", () => {
    expect(cardSource).toContain("is not part of NextWise");
  });

  it("contains no unsupported partnership/endorsement/affiliation language anywhere in its own source text", () => {
    expect(containsUnsupportedPartnershipLanguage(cardSource)).toBe(false);
  });

  it("never links directly to result.url — every click still goes through the internal /go/course-search/** redirect route (M20B did not introduce a bypass)", () => {
    expect(cardSource).toContain("/go/course-search/");
    expect(cardSource).not.toMatch(/href=\{result\.url\}/);
  });
});

/**
 * M20C — Trusted Country Discovery UX: refines (never rebuilds) this same
 * card. Every new assertion below is about a REFINEMENT of existing
 * wiring — the eyebrow label, the goHref/CTA routing, and the
 * launch-primary gate are all M20B's, untouched by this pass (covered by
 * the describe block above, re-run unchanged).
 */
describe("TrustedExternalSearchCard — M20C discovery-UX refinement", () => {
  it("imports the two remaining previously-unused approved wording constants and the M20A primary-source registry, rather than inventing new copy", () => {
    expect(cardSource).toContain("CONTINUE_ON_OFFICIAL_SOURCE_LABEL");
    expect(cardSource).toContain("EXTERNAL_LINK_BADGE_LABEL");
    expect(cardSource).toContain("TRUSTED_NATIONAL_SOURCE_LABEL");
    expect(cardSource).toContain('from "@/lib/education/external-search/launch-country-sources"');
    expect(cardSource).toContain("getLaunchCountryPrimarySource");
  });

  it("uses the approved CONTINUE_ON_OFFICIAL_SOURCE_LABEL as the CTA's own text, built from the pre-existing goHref — never a second, parallel link to result.url", () => {
    expect(cardSource).toContain("{CONTINUE_ON_OFFICIAL_SOURCE_LABEL}");
    expect(cardSource).toContain("href={goHref}");
  });

  it("gates the short per-country description and the 'Trusted national source' badge on isLaunchPrimary — never rendered for a launch country's own non-primary specialist provider (e.g. UCAS for GB, CRICOS for AU)", () => {
    expect(cardSource).toMatch(/const primarySource = isLaunchPrimary \? getLaunchCountryPrimarySource\(result\.countryCode\) : null/);
    expect(cardSource).toContain("{primarySource.purpose}");
  });

  it("never fabricates its own country-source description — the only text source for a launch-primary's short description is the M20A registry's own already-approved `purpose` field", () => {
    // Every registry purpose string is already asserted non-partnership by
    // launch-country-sources.test.ts; this just confirms the card surfaces
    // that exact field rather than a hand-written string of its own.
    for (const code of ["DE", "GB", "US", "CA", "AU", "IE"] as const) {
      const primary = getLaunchCountryPrimarySource(code);
      expect(primary).not.toBeNull();
      expect(containsUnsupportedPartnershipLanguage(primary?.purpose)).toBe(false);
    }
  });

  it("still contains no unsupported partnership language anywhere in its own source text after the M20C refinement (re-run, not just inherited)", () => {
    expect(containsUnsupportedPartnershipLanguage(cardSource)).toBe(false);
  });

  it("DAAD remains Germany's launch-primary source, unchanged by M20C", () => {
    expect(getLaunchCountryPrimarySource("DE")?.providerSlug).toBe("daad-international-programmes");
  });
});
