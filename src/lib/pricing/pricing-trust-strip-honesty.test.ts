import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The brief for this milestone is explicit and repeated (its reference
 * spec's own "trust strip" sections) that nothing resembling an unverified
 * social-proof statistic — a student count, a success percentage, a star
 * rating — may appear on the pricing page, since none of that is real,
 * verified business data in this codebase. This is a static text check
 * against the trust-strip component's source, the same "regression tripwire
 * on real source text" convention as pr01-seed-catalogue.test.ts.
 */
const SOURCE_PATH = path.resolve(process.cwd(), "src/components/sections/pricing/PricingTrustStrip.tsx");
const source = readFileSync(SOURCE_PATH, "utf8");
// Strip block (/* ... */) comments before checking — this file's own
// docblock explicitly NAMES the forbidden examples ("10,000+ students",
// "95% visa success", "a star rating") as illustrations of what NOT to
// render, so a naive text search over the whole file would false-positive
// on its own explanatory prose. The checks below must only ever look at
// code that actually executes/renders.
const code = source.replace(/\/\*[\s\S]*?\*\//g, "");

describe("PricingTrustStrip — no fabricated social-proof statistics", () => {
  it("never claims a specific student/customer count", () => {
    expect(code).not.toMatch(/\d[\d,]*\+?\s*students/i);
    expect(code).not.toMatch(/10,?000\+?/);
  });

  it("never claims a success/visa percentage", () => {
    expect(code).not.toMatch(/\d{1,3}%/);
  });

  it("never renders a star rating or review score", () => {
    expect(code).not.toMatch(/\b[1-5](\.\d)?\s*(\/|out of)\s*5\b/i);
    expect(code).not.toMatch(/rating/i);
  });

  it("every trust-item label is one of the four truthful, already-real claims this milestone approved", () => {
    const labelMatches = [...code.matchAll(/label:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(labelMatches.sort()).toEqual(["Clear Deliverables", "Expert Counsellors", "Secure Process", "Transparent Pricing"].sort());
  });
});
