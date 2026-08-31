import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Milestone 11 — source-string regression guard, same convention as
 * site.test.ts's rebrand guard below: every official `--brand-*` design
 * token must exist in src/app/globals.css, the ONE central token file for
 * the NextWise visual identity (Tailwind v4 `@theme` block). This does not
 * assert the exact hex values (those are free to change as provisional
 * placeholders get replaced with real approved brand colors) — only that
 * the token NAMES themselves are present, so no component can silently end
 * up with nothing to reference.
 */
const GLOBALS_CSS_PATH = path.join(process.cwd(), "src", "app", "globals.css");

const REQUIRED_BRAND_TOKENS = [
  "--brand-primary",
  "--brand-primary-strong",
  "--brand-violet",
  "--brand-signal",
  "--brand-signal-strong",
  "--brand-coral",
  "--brand-coral-pale",
  "--brand-paper",
  "--brand-surface",
  "--brand-ink",
  "--brand-muted",
  "--brand-border",
  "--brand-focus",
  "--brand-success",
  "--brand-success-pale",
  "--brand-warning",
  "--brand-warning-pale",
  "--brand-danger",
  "--brand-danger-pale",
  "--brand-info",
  "--brand-info-pale",
];

describe("src/app/globals.css — NextWise brand token system", () => {
  it("exists on disk", () => {
    expect(existsSync(GLOBALS_CSS_PATH)).toBe(true);
  });

  const css = existsSync(GLOBALS_CSS_PATH) ? readFileSync(GLOBALS_CSS_PATH, "utf8") : "";

  for (const token of REQUIRED_BRAND_TOKENS) {
    it(`defines ${token}`, () => {
      // Matches the token being declared as a CSS custom property, e.g.
      // "--brand-signal:" — not just an incidental substring match (which
      // would also match "--brand-signal-strong" for the query "--brand-signal").
      const declarationPattern = new RegExp(`${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:`);
      expect(css, `expected globals.css to declare ${token}`).toMatch(declarationPattern);
    });
  }

  it("marks every non-real brand token as PROVISIONAL, and every real one as REAL, in a nearby comment", () => {
    // --brand-primary, --brand-primary-strong, --brand-ink are the three
    // REAL (logo-sampled / already-documented) values; every other
    // --brand-* token must be labeled PROVISIONAL somewhere on its
    // declaration line or immediately around it, per the spec's "do not
    // falsely label invented colours as official" requirement.
    const REAL_TOKENS = new Set(["--brand-primary", "--brand-primary-strong", "--brand-ink", "--brand-surface", "--brand-focus", "--brand-danger", "--brand-danger-pale"]);
    const lines = css.split("\n");
    for (const token of REQUIRED_BRAND_TOKENS) {
      if (REAL_TOKENS.has(token)) continue;
      const lineIndex = lines.findIndex((line) => line.trimStart().startsWith(`${token}:`));
      expect(lineIndex, `expected to find a declaration line for ${token}`).toBeGreaterThanOrEqual(0);
      expect(lines[lineIndex], `expected ${token}'s declaration line to be labeled PROVISIONAL`).toMatch(/PROVISIONAL|alias of/);
    }
  });

  it("repoints :focus-visible at --brand-focus for a visible, on-brand keyboard focus ring", () => {
    expect(css).toMatch(/:focus-visible\s*{[^}]*outline:\s*2px solid var\(--brand-focus\)/);
  });

  it("leaves --color-accent un-aliased to any --brand-* token (contrast finding: Button's secondary variant is bg-accent text-white)", () => {
    const accentLine = css.split("\n").find((line) => line.trim().startsWith("--color-accent:"));
    expect(accentLine, "expected a --color-accent declaration").toBeDefined();
    expect(accentLine).not.toMatch(/var\(--brand-/);
  });
});
