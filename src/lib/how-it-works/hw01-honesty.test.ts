import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UX10-HW01 — the brief is explicit and repeated: no fake statistics,
 * partnerships, testimonials, or outcomes anywhere on the redesigned
 * How It Works page. Same "regression tripwire on real source text"
 * convention as `pricing-trust-strip-honesty.test.ts`, extended to every
 * new component this milestone adds. Block comments are stripped first so
 * this file's own (and those components') explanatory docblocks never
 * false-positive the check.
 */
const SOURCE_FILES = [
  "src/components/sections/how-it-works/HowItWorksHero.tsx",
  "src/components/sections/how-it-works/JourneyStepFlow.tsx",
  "src/components/sections/how-it-works/StudyPathwaysSection.tsx",
  "src/components/sections/how-it-works/WhyChooseStrip.tsx",
  "src/data/how-it-works-steps.ts",
];

function readCode(relativePath: string): string {
  const source = readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
  return source.replace(/\/\*[\s\S]*?\*\//g, "");
}

// Tailwind arbitrary-value brackets (e.g. `left-[10%]`, `top-[32%]`) are
// layout positioning, not a claimed statistic — stripped before the
// percentage check only, so a real "95%" dropped into visible copy still
// fails the check while CSS positioning never false-positives it.
function stripArbitraryValues(code: string): string {
  return code.replace(/\[[^\]]*\]/g, "");
}

describe("UX10-HW01 How It Works components — no fabricated claims", () => {
  for (const file of SOURCE_FILES) {
    const code = readCode(file);

    it(`${file} never claims a specific student/customer count`, () => {
      expect(code).not.toMatch(/\d[\d,]*\+?\s*(students|families|customers|users)/i);
      expect(code).not.toMatch(/10,?000\+?/);
    });

    it(`${file} never claims a success/visa percentage or star rating`, () => {
      expect(stripArbitraryValues(code)).not.toMatch(/\d{1,3}%/);
      expect(code).not.toMatch(/\b[1-5](\.\d)?\s*(\/|out of)\s*5\b/i);
      expect(code).not.toMatch(/rating/i);
    });

    it(`${file} never names a fabricated partner institution or testimonial`, () => {
      expect(code).not.toMatch(/testimonial/i);
      expect(code).not.toMatch(/partner\s*(universit|institution)/i);
      expect(code).not.toMatch(/(said|says|review(ed)?)\s*["“]/i);
    });
  }
});
