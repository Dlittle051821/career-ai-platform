import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";

/**
 * UX09 Part B/C — static source-text audit of the graphics system.
 *
 * This project has no React Testing Library / jsdom environment (see the
 * "pure, framework-free" convention documented throughout
 * vitest.config.mts), so these components are not render-tested. What
 * CAN be verified without rendering — and what the task's own rules make
 * into real, checkable invariants rather than style preferences — is
 * audited here by reading the component source as plain text, the same
 * technique src/config/favicon-brand-consistency.test.ts already uses
 * for the favicon fix.
 */

const GRAPHICS_DIR = path.join(__dirname, "..", "..", "components", "graphics");
const GLOBALS_CSS_PATH = path.join(__dirname, "..", "..", "app", "globals.css");

const GRAPHICS_FILES = ["PathwayGraphic.tsx", "NetworkGraphic.tsx", "GeometricBackdrop.tsx"];

function readGraphicsFile(name: string): string {
  return readFileSync(path.join(GRAPHICS_DIR, name), "utf8");
}

describe("graphics system — no external image dependency", () => {
  it.each(GRAPHICS_FILES)("%s contains no http(s):// URL — every graphic is inline SVG/CSS, never a remote asset", (file) => {
    const source = readGraphicsFile(file);
    expect(source).not.toMatch(/https?:\/\//);
  });

  it.each(GRAPHICS_FILES)("%s renders no <img> or next/image — these graphics are pure SVG, never raster images", (file) => {
    const source = readGraphicsFile(file);
    expect(source).not.toMatch(/<img[\s>]/);
    expect(source).not.toMatch(/from ["']next\/image["']/);
  });
});

describe("graphics system — never imitates or reuses the approved logo", () => {
  it.each(GRAPHICS_FILES)("%s does not reference any brand/logo asset path", (file) => {
    const source = readGraphicsFile(file);
    expect(source).not.toMatch(/\/brand\//);
    expect(source).not.toMatch(/nextwise-icon|nextwise-logo/i);
  });
});

describe("graphics system — accessibility wiring", () => {
  it.each(["PathwayGraphic.tsx", "NetworkGraphic.tsx"])(
    "%s resolves its aria props through the shared getGraphicAriaProps() helper, rather than a hand-rolled ternary",
    (file) => {
      const source = readGraphicsFile(file);
      expect(source).toMatch(/getGraphicAriaProps/);
    }
  );

  it.each(GRAPHICS_FILES)("%s marks its own internal visual markup aria-hidden, so a meaningful usage's role=img isn't double-narrated", (file) => {
    const source = readGraphicsFile(file);
    expect(source).toMatch(/aria-hidden="true"/);
  });
});

describe("graphics system — ambient motion stays explicitly reduced-motion-safe", () => {
  const globalsCss = readFileSync(GLOBALS_CSS_PATH, "utf8");
  const reducedMotionBlockMatch = globalsCss.match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\}/);
  const reducedMotionBlock = reducedMotionBlockMatch?.[0] ?? "";

  it("globals.css actually has a (prefers-reduced-motion: reduce) block to check against", () => {
    expect(reducedMotionBlock.length).toBeGreaterThan(0);
  });

  it.each(GRAPHICS_FILES)("%s never applies .animate-flow-dash directly — only through the FLOW_DASH_CLASSES constant, which already carries motion-reduce:animate-none", (file) => {
    const source = readGraphicsFile(file);
    const appliesBareClassName = /className=["'][^"']*\banimate-flow-dash\b/.test(source);
    expect(appliesBareClassName).toBe(false);
  });

  it("the .animate-flow-dash and .animate-fade-up classes each have an explicit override inside the reduced-motion media block", () => {
    expect(reducedMotionBlock).toMatch(/\.animate-flow-dash\s*\{[^}]*animation:\s*none/);
    expect(reducedMotionBlock).toMatch(/\.animate-fade-up\s*\{[^}]*animation:\s*none/);
  });
});
