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

  it("renders the secondary button with the dark-surface outline variant, so its label stays readable on the band", () => {
    // UX10-HW01 guarded against the outline label rendering in the band's own
    // colour (it used a "!text-on-primary" override). CIUX-01 supersedes the
    // override with a dedicated variant: outline-inverse carries white text and
    // a white hairline and no conflicting text-primary class, so there is no
    // stylesheet-order race left to guard. The same intent is asserted here.
    expect(source).toMatch(/variant="outline-inverse"/);
    const button = readFileSync(path.resolve(import.meta.dirname, "../ui/Button.tsx"), "utf8");
    const line = button.split("\n").find((l) => l.includes('"outline-inverse":')) ?? "";
    expect(line).toContain("text-white");
    expect(line).not.toMatch(/text-primary/);
  });
});
