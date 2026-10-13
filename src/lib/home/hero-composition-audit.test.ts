import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Originally UX10-H01B "Hero Composition Refinement", extended by
 * UX10-H02 "Homepage Premium Visual Refinement" — static source-text
 * audit, same convention as src/lib/home/homepage-source-audit.test.ts
 * and src/lib/home/orbit-journey-audit.test.ts (no React Testing
 * Library/jsdom in this project).
 *
 * Both milestones are explicit that the APPROVED orbit from UX10-H01
 * must not be redesigned, re-timed, re-sequenced, or have its motion
 * logic touched — only its on-page POSITION may change. These tests
 * exist to catch a regression on exactly that promise, alongside
 * verifying the hero-visual-stage composition (now the real approved
 * student photo, with UX10-H01B's own placeholder kept only as an
 * on-disk-asset-missing fallback) and the "no decorative text clutter"
 * requirement.
 */
const HOME_DIR = path.join(__dirname, "..", "..", "components", "sections", "home");
const CSS_PATH = path.join(__dirname, "..", "..", "app", "globals.css");

function readSection(name: string): string {
  return readFileSync(path.join(HOME_DIR, name), "utf8");
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const HERO_SOURCE = readSection("HomeHero.tsx");
const HERO_CODE_ONLY = stripComments(HERO_SOURCE);
const ORBIT_SOURCE = readSection("OrbitJourney.tsx");
const ORBIT_CODE_ONLY = stripComments(ORBIT_SOURCE);
const GLOBALS_CSS = readFileSync(CSS_PATH, "utf8");

describe("hero composition — handwritten annotation images (UX10-H05B deliberate, documented reversal)", () => {
  // Every milestone through UX10-H04 banned this exact copy
  // ("clearer, brighter" / "curiosity to global" / "handwritten") because
  // an earlier pass decided hand-drawn annotation text didn't belong on
  // this hero. UX10-H05B's own brief explicitly instructs the opposite —
  // reproduce both annotations, with explicit permission to crop them
  // from the reference screenshot as non-interactive decorative images
  // since no separate asset exists for them. This is treated as a
  // deliberate, informed new instruction superseding the old one (the
  // same way H03/H04 each reversed earlier decisions when a newer, more
  // specific brief called for it) — see HomeHero.tsx's own docblock and
  // UX10-H05B_REFERENCE_AUDIT.md for the full reasoning. The orbit itself
  // (OrbitJourney.tsx) is NOT part of this reversal — it must still never
  // gain decorative annotation text of its own.
  it("the hero renders both annotation images, as decorative image crops (aria-hidden, empty alt) rather than real rendered text", () => {
    expect(HERO_CODE_ONLY).toContain("/hero/annotation-clearer-brighter.png");
    expect(HERO_CODE_ONLY).toContain("/hero/annotation-curiosity-global.png");
    expect(HERO_CODE_ONLY).toMatch(/className="hero-annotation hero-annotation-left"/);
    expect(HERO_CODE_ONLY).toMatch(/className="hero-annotation hero-annotation-right"/);
    // Decorative crops, not real text nodes — no literal annotation copy
    // is ever rendered as a text string in this file.
    expect(HERO_CODE_ONLY).not.toMatch(/>\s*A clearer/i);
    expect(HERO_CODE_ONLY).not.toMatch(/>\s*From curiosity/i);
  });

  it("OrbitJourney.tsx itself still never gains handwritten-annotation text or styling of its own", () => {
    expect(ORBIT_CODE_ONLY).not.toMatch(/clearer,?\s*brighter/i);
    expect(ORBIT_CODE_ONLY).not.toMatch(/curiosity to global/i);
    expect(ORBIT_CODE_ONLY).not.toMatch(/handwritten/i);
  });
});

describe("hero composition — right column rebalanced to the UX10-H03 reference's wider visual column, left column intact", () => {
  it("HomeHero.tsx declares an explicit, right-weighted grid split, not a plain 50/50 lg:grid-cols-2", () => {
    const match = HERO_CODE_ONLY.match(/lg:grid-cols-\[([\d.]+)fr_([\d.]+)fr\]/);
    expect(match, "expected an explicit lg:grid-cols-[<left>fr_<right>fr] arbitrary value").not.toBeNull();
    const left = Number(match![1]);
    const right = Number(match![2]);
    const rightShare = right / (left + right);
    // UX10-H01B's original 45-50/50-55 band was tuned against an abstract,
    // placeholder-era brief. UX10-H03 "Exact Homepage Reference Match"
    // targets THIS specific reference image instead, whose visual column
    // (large student + wide orbit ring) is noticeably more dominant —
    // ~59% right-share (lg:grid-cols-[0.82fr_1.18fr]). Band widened to
    // 55-65% to match that intentional, documented change rather than
    // leave a stale assertion fighting it.
    expect(rightShare).toBeGreaterThanOrEqual(0.55);
    expect(rightShare).toBeLessThanOrEqual(0.65);
  });

  it("the left column's headline, both CTAs, and all three trust cues are untouched", () => {
    expect(HERO_SOURCE).toContain("Your future has possibilities.");
    expect(HERO_SOURCE).toContain("Find the right one.");
    expect(HERO_SOURCE).toContain("Explore Your Future — Free");
    expect(HERO_SOURCE).toContain("Book a Free Discovery Session");
    expect(HERO_SOURCE).toContain("Trusted study sources");
    expect(HERO_SOURCE).toContain("Personalised guidance");
    expect(HERO_SOURCE).toContain("Student-first approach");
  });
});

describe("hero composition — the real approved student photo is wired in, with a documented missing-asset fallback (never a silent substitute)", () => {
  it("HomeHero.tsx references the UX10-H05B real transparent cutout asset path, and never next/image", () => {
    // UX10-H05B supersedes H02's generated "nextwise-student-hero.png"
    // (a plain rectangular photo, masked in CSS to fake a soft edge) with
    // the brief's own real, already-transparent cutout — see this
    // component's own docblock.
    expect(HERO_CODE_ONLY).not.toMatch(/from ["']next\/image["']/);
    expect(HERO_CODE_ONLY).toContain('"/hero/nextwise-student-cutout.png"');
  });

  it("the image is only ever rendered as a plain <img>, gated behind an on-disk existence check — never assumed present", () => {
    expect(HERO_CODE_ONLY).toMatch(/existsSync\(/);
    expect(HERO_CODE_ONLY).toContain("HERO_STUDENT_IMAGE_EXISTS");
    expect(HERO_CODE_ONLY).toMatch(/HERO_STUDENT_IMAGE_EXISTS\s*\?/);
    expect(HERO_CODE_ONLY).toMatch(/<img\b/);
  });

  it("the <img> is decorative (aria-hidden via the shared accessible-graphic helper) with empty alt, not a fabricated description", () => {
    expect(HERO_CODE_ONLY).toContain('getGraphicAriaProps({ kind: "decorative" })');
    expect(HERO_CODE_ONLY).toMatch(/\{\.\.\.decorative\}\s*className="hero-student-portrait"/);
    expect(HERO_CODE_ONLY).toMatch(/alt=""/);
  });

  it("HomeHero.tsx still keeps .hero-student-slot as the fallback markup if the asset is ever missing, rather than silently substituting another image or breaking the page", () => {
    expect(HERO_CODE_ONLY).toContain("hero-student-slot");
    expect(HERO_CODE_ONLY).toMatch(/\{\.\.\.decorative\}\s*className="hero-student-slot"/);
  });

  it("globals.css still labels the fallback slot as a developer placeholder, not finished art", () => {
    const afterRuleMatch = GLOBALS_CSS.match(/\.hero-student-slot::after\s*\{[^}]*\}/);
    expect(afterRuleMatch, "expected a .hero-student-slot::after rule").not.toBeNull();
    expect(afterRuleMatch![0]).toMatch(/content:\s*"[^"]*replacement asset[^"]*"/i);
  });

  it("UX10-H05B — the portrait image no longer carries the old radial CSS mask, since the real supplied cutout is already a transparent PNG with no hard edge to blend", () => {
    const portraitImgRule = GLOBALS_CSS.match(/\.hero-student-portrait-img\s*\{[^}]*\}/);
    expect(portraitImgRule, "expected a .hero-student-portrait-img rule").not.toBeNull();
    // The old mask-image/-webkit-mask-image radial fade existed to soften
    // a plain rectangular photo's hard edge — masking an already-
    // transparent cutout again would clip real pixels of her own shape
    // for no reason, so it's removed; object-fit moves to `contain` so
    // the whole real cutout renders at its own aspect ratio.
    expect(portraitImgRule![0]).not.toMatch(/mask-image:/);
    expect(portraitImgRule![0]).toMatch(/object-fit:\s*contain/);
  });
});

describe("hero composition — the orbit's position may change, but nothing about its motion, sequence, or content does", () => {
  const EXPECTED_STAGES = ["Interests", "Career", "Course", "University", "Guidance", "Your Future"];

  it("OrbitJourney.tsx's six stages, in order, are byte-identical to the approved UX10-H01 set", () => {
    const matches = [...ORBIT_CODE_ONLY.matchAll(/title:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(matches).toEqual(EXPECTED_STAGES);
  });

  it("every approved orbit keyframe, duration, and depth value is still present verbatim", () => {
    // Timing per tier (unchanged from UX10-H01):
    expect(GLOBALS_CSS).toContain("--orbit-duration: 30s;");
    expect(GLOBALS_CSS).toContain("--orbit-duration: 26s;");
    expect(GLOBALS_CSS).toContain("--orbit-duration: 22s;");
    // Radius per tier: the two larger (tablet/desktop) tiers are unchanged
    // from UX10-H01. The base (<769px, mobile) tier was deliberately
    // widened by UX10-M01 — see globals.css's own comment on `.orbit-stage`
    // — to fix a real, confirmed card-overlap bug at 390px (verified via a
    // reduced-motion screenshot before this pinned value was touched).
    // This is the one intentional exception to "nothing about its motion,
    // sequence, or content does" above: only the mobile-tier radius changed,
    // and only to fix a genuine mobile layout defect, not a redesign.
    expect(GLOBALS_CSS).toContain("--orbit-rx: 118px;");
    expect(GLOBALS_CSS).toContain("--orbit-rx: 152px;");
    expect(GLOBALS_CSS).toContain("--orbit-rx: 212px;");
    // Linear travel + eased depth split, and the depth range itself:
    expect(GLOBALS_CSS).toContain("animation: orbit-arm-spin var(--orbit-duration, 26s) linear infinite;");
    expect(GLOBALS_CSS).toContain("animation: orbit-depth var(--orbit-duration, 26s) cubic-bezier(0.45, 0, 0.55, 1) infinite;");
    expect(GLOBALS_CSS).toMatch(/0%\s*\{\s*transform:\s*scale\(0\.93\);\s*opacity:\s*0\.8;\s*filter:\s*blur\(0\.5px\);/);
    expect(GLOBALS_CSS).toMatch(/25%\s*\{\s*transform:\s*scale\(1\.1\);\s*opacity:\s*1;\s*filter:\s*blur\(0\);/);
    expect(GLOBALS_CSS).toMatch(/75%\s*\{\s*transform:\s*scale\(0\.82\);\s*opacity:\s*0\.58;\s*filter:\s*blur\(1\.5px\);/);
  });

  it("the new hero-visual-stage CSS only positions a wrapper — it never redefines .orbit-arm/.orbit-counter/.orbit-depth or any @keyframes orbit-*", () => {
    const heroStageBlockMatch = GLOBALS_CSS.match(
      /UX10-H01B — hero visual stage[\s\S]*?(?=@media \(prefers-reduced-motion: reduce\))/
    );
    expect(heroStageBlockMatch, "expected to find the UX10-H01B hero-visual-stage CSS block").not.toBeNull();
    const block = heroStageBlockMatch![0];
    expect(block).not.toMatch(/@keyframes orbit-/);
    expect(block).not.toMatch(/\.orbit-arm\s*\{/);
    expect(block).not.toMatch(/\.orbit-counter\s*\{/);
    expect(block).not.toMatch(/\.orbit-depth\s*\{/);
    expect(block).not.toMatch(/\.orbit-stage\s*\{/);
  });

  it("OrbitJourney.tsx itself is completely unmodified by this milestone (HomeHero.tsx only wraps it, never edits its internals)", () => {
    expect(ORBIT_CODE_ONLY).not.toMatch(
      /hero-student-slot|hero-orbit-wrap|hero-visual-stage|hero-student-portrait|hero-atmosphere/
    );
  });
});

describe("hero composition — single H1 regression guard still holds", () => {
  it("HomeHero.tsx still renders exactly one <h1>", () => {
    expect((HERO_SOURCE.match(/<h1[\s>]/g) ?? []).length).toBe(1);
  });
});
