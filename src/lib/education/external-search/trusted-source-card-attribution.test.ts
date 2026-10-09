import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { containsUnsupportedPartnershipLanguage } from "./attribution";

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
