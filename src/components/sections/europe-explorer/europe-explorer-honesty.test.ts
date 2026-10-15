import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { containsUnsupportedPartnershipLanguage } from "@/lib/education/external-search/attribution";

/**
 * UX10-EU01 — regression tripwire on real source text, same convention as
 * `src/lib/how-it-works/hw01-honesty.test.ts`. Covers every new Europe
 * Country Explorer component plus the `/study-europe` page itself, and the
 * two shared files this milestone deliberately re-pointed
 * (`/study-options`'s pathway card, HW01's `StudyPathwaysSection.tsx`).
 *
 * This is the enforcement layer for the brief's own repeated,
 * non-negotiable rules: no UK/USA/Canada/Australia anywhere on this
 * Europe-first page, no fabricated star ratings or statistics, no implied
 * partnership/endorsement with any official portal, and every external
 * official-source link marked and routed safely.
 */
const EUROPE_EXPLORER_SOURCE_FILES = [
  "src/components/sections/europe-explorer/EuropeExplorerHero.tsx",
  "src/components/sections/europe-explorer/EuropeCountryCards.tsx",
  "src/components/sections/europe-explorer/WhyEuropeSection.tsx",
  "src/components/sections/europe-explorer/EuropeComparisonSection.tsx",
  "src/components/sections/europe-explorer/EuropeOfficialSourcesSection.tsx",
  "src/components/sections/europe-explorer/EuropeHowNextwiseHelps.tsx",
  "src/app/(site)/study-europe/page.tsx",
];

const SHARED_FILES_TOUCHED_BY_EU01 = [
  "src/app/(site)/study-options/page.tsx",
  "src/components/sections/how-it-works/StudyPathwaysSection.tsx",
];

// Matched as whole words/phrases so this never false-positives on an
// unrelated substring (e.g. "Ireland" does not contain "IE" as a word).
const FORBIDDEN_COUNTRY_MENTIONS = [
  /\bUnited Kingdom\b/i,
  /\bUSA\b/,
  /\bUnited States\b/i,
  /\bCanada\b/i,
  /\bAustralia\b/i,
];

function readCode(relativePath: string): string {
  const source = readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
  return source.replace(/\/\*[\s\S]*?\*\//g, "");
}

function stripArbitraryValues(code: string): string {
  return code.replace(/\[[^\]]*\]/g, "");
}

describe("UX10-EU01 Europe Explorer components — Europe-only launch countries", () => {
  for (const file of EUROPE_EXPLORER_SOURCE_FILES) {
    it(`${file} never mentions the UK, USA, Canada, or Australia`, () => {
      const code = readCode(file);
      for (const pattern of FORBIDDEN_COUNTRY_MENTIONS) {
        expect(code).not.toMatch(pattern);
      }
    });
  }
});

describe("UX10-EU01 Europe Explorer components — no fabricated claims", () => {
  for (const file of EUROPE_EXPLORER_SOURCE_FILES) {
    const code = readCode(file);

    it(`${file} never claims a specific student/customer count`, () => {
      expect(code).not.toMatch(/\d[\d,]*\+?\s*(students|families|customers|users)/i);
    });

    it(`${file} never fabricates a star rating or bare success percentage`, () => {
      expect(stripArbitraryValues(code)).not.toMatch(/\d{1,3}%/);
      expect(code).not.toMatch(/\b[1-5](\.\d)?\s*(\/|out of)\s*5\b/i);
      expect(code).not.toMatch(/\brating/i);
      expect(code).not.toMatch(/★/);
    });

    it(`${file} never names a fabricated testimonial or review`, () => {
      expect(code).not.toMatch(/testimonial/i);
      expect(code).not.toMatch(/(said|says|review(ed)?)\s*["“]/i);
    });

    it(`${file} contains no unsupported partnership/endorsement language`, () => {
      expect(containsUnsupportedPartnershipLanguage(code)).toBe(false);
    });
  }
});

describe("UX10-EU01 EuropeOfficialSourcesSection — external link safety", () => {
  const code = readCode("src/components/sections/europe-explorer/EuropeOfficialSourcesSection.tsx");

  it('opens official sources in a new tab with rel="noopener noreferrer"', () => {
    expect(code).toMatch(/target="_blank"/);
    expect(code).toMatch(/rel="noopener noreferrer"/);
  });

  it("marks each link as leaving Nextwise, and discloses no affiliation with the official portals", () => {
    expect(code).toMatch(/EXTERNAL_LINK_BADGE_LABEL/);
    expect(code).toMatch(/not affiliated with/i);
  });
});

describe("UX10-EU01 — navigation/route reference integrity", () => {
  it("StudyPathwaysSection.tsx's Europe CTA now points at the new /study-europe route", () => {
    const code = readCode("src/components/sections/how-it-works/StudyPathwaysSection.tsx");
    expect(code).toMatch(/href:\s*"\/study-europe"/);
    expect(code).not.toMatch(/\/study-options#europe/);
  });

  it("/study-options's Europe pathway card links to /study-europe", () => {
    const code = readCode("src/app/(site)/study-options/page.tsx");
    expect(code).toMatch(/href="\/study-europe"/);
  });

  for (const file of SHARED_FILES_TOUCHED_BY_EU01) {
    it(`${file} (a shared file this milestone touched) still contains no fabricated claims`, () => {
      const code = readCode(file);
      expect(stripArbitraryValues(code)).not.toMatch(/\d{1,3}%/);
      expect(containsUnsupportedPartnershipLanguage(code)).toBe(false);
    });
  }
});
