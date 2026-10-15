import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UX10-HW01 — CTASection.tsx gained one new, optional `background` prop
 * ("default" | "cinematic") to support this milestone's "cinematic final
 * CTA" requirement, following the same additive-prop convention as
 * Card.tsx's `style`/`id` and SectionHeading.tsx's `titleClassName`. This
 * project doesn't use React Testing Library/jsdom (see vitest.config.mts),
 * so — matching every other component-contract test in this codebase —
 * this is a source-text check rather than a render assertion: it confirms
 * the new prop defaults to "default" (so every one of this component's
 * 7+ existing callers, which all omit the prop, keeps rendering with no
 * cinematic overlay) and that the overlay is only ever added, never
 * replacing the existing `tone="primary"` Section background.
 */
const SOURCE_PATH = path.resolve(process.cwd(), "src/components/sections/CTASection.tsx");
const source = readFileSync(SOURCE_PATH, "utf8");

describe("CTASection — additive `background` prop", () => {
  it("defaults to \"default\" (no behavior change for existing callers)", () => {
    expect(source).toMatch(/background\s*=\s*"default"/);
  });

  it("still renders Section tone=\"primary\" regardless of background", () => {
    expect(source).toMatch(/<Section tone="primary"/);
  });

  it("only adds the cinematic glow conditionally, never unconditionally", () => {
    expect(source).toMatch(/background === "cinematic" \?/);
  });

  it("forces the secondary button's on-primary text color with !important", () => {
    // UX10-HW01 visual QA regression guard: `cn()` is plain string
    // concatenation in this codebase (not tailwind-merge), so
    // `variant="outline"`'s own `text-primary` class and this button's
    // `text-on-primary` override are two conflicting color utilities whose
    // winner is decided by Tailwind's generated stylesheet order, not JSX
    // order — `text-on-primary` alone silently lost before this fix,
    // rendering the label the same blue as the `tone="primary"` section
    // background (confirmed via computed-style screenshot QA). Without
    // `!`, a future edit could innocently "clean up" the `!` away and
    // reintroduce the invisible-button regression.
    expect(source).toMatch(/!text-on-primary/);
  });
});
