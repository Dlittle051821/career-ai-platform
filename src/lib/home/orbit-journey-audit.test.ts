import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * UX10-H01 "Hero Orbit Motion" — static source-text audit of
 * OrbitJourney.tsx and its integration into HomeHero.tsx, following the
 * same convention as src/lib/home/homepage-source-audit.test.ts (no React
 * Testing Library/jsdom in this project; `fs.readFileSync` + string/regex
 * assertions instead). Kept as its own file rather than folded into
 * homepage-source-audit.test.ts's SECTION_FILES list, because several of
 * that file's checks assume a different structural pattern than this
 * component uses (e.g. its "mobile-safe responsive structure" check looks
 * for Tailwind `sm:grid-cols`/`flex-wrap` classes — OrbitJourney.tsx's
 * responsiveness instead comes from plain CSS custom-property tiers in
 * globals.css, a deliberate, documented difference, not an omission).
 */
const HOME_DIR = path.join(__dirname, "..", "..", "components", "sections", "home");
const CSS_PATH = path.join(__dirname, "..", "..", "app", "globals.css");

function readSection(name: string): string {
  return readFileSync(path.join(HOME_DIR, name), "utf8");
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const ORBIT_SOURCE = readSection("OrbitJourney.tsx");
const ORBIT_CODE_ONLY = stripComments(ORBIT_SOURCE);
const HERO_SOURCE = readSection("HomeHero.tsx");
const GLOBALS_CSS = readFileSync(CSS_PATH, "utf8");

const EXPECTED_STAGES = ["Interests", "Career", "Course", "University", "Guidance", "Your Future"];

describe("hero orbit — all six journey stages present, in the brief's exact order", () => {
  it("STAGES lists exactly the six required stage titles, in sequence", () => {
    const matches = [...ORBIT_CODE_ONLY.matchAll(/title:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(matches).toEqual(EXPECTED_STAGES);
  });

  it("every stage has a short support label (never empty, never a full sentence)", () => {
    const labels = [...ORBIT_CODE_ONLY.matchAll(/label:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(labels).toHaveLength(6);
    for (const label of labels) {
      expect(label.length).toBeGreaterThan(0);
      expect(label.length).toBeLessThanOrEqual(24);
    }
  });
});

describe("hero orbit — every route is real and public, never invented or protected", () => {
  // Mirrors src/lib/supabase/middleware.ts's PROTECTED_PATHS at the time
  // this test was written — a route that moves into that list later
  // should be caught by this test failing, not silently left broken.
  const PROTECTED_PATHS = [
    "/dashboard",
    "/roadmap",
    "/profile",
    "/recommendations",
    "/admin",
    "/payments",
    "/pay",
    "/saved",
    "/applications",
    "/pricing/checkout",
    "/agreements",
    "/welcome",
    "/discovery-session",
  ];
  const ALLOWED_ROUTES = new Set(["/career-discovery", "/careers", "/courses", "/universities", "/book-counselling"]);

  it("every orbit card href is in the allowed real-route set", () => {
    const hrefs = [...ORBIT_CODE_ONLY.matchAll(/href:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs).toHaveLength(6);
    for (const href of hrefs) {
      expect(ALLOWED_ROUTES.has(href), `unexpected OrbitJourney href: ${href}`).toBe(true);
    }
  });

  it("no orbit card links to a protected (login-redirecting) path", () => {
    const hrefs = [...ORBIT_CODE_ONLY.matchAll(/href:\s*"([^"]+)"/g)].map((m) => m[1]);
    for (const href of hrefs) {
      const isProtected = PROTECTED_PATHS.some((p) => href === p || href.startsWith(`${p}/`));
      expect(isProtected, `OrbitJourney href ${href} is behind a login redirect`).toBe(false);
    }
  });
});

describe("hero orbit — reduced motion is handled explicitly, not left to a blanket rule alone", () => {
  it("globals.css defines explicit @media (prefers-reduced-motion: reduce) overrides for the orbit's three animated layers", () => {
    const reducedMotionBlockMatch = GLOBALS_CSS.match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\}/);
    expect(reducedMotionBlockMatch).not.toBeNull();
    const block = reducedMotionBlockMatch![0];
    expect(block).toContain(".orbit-arm");
    expect(block).toContain(".orbit-counter");
    expect(block).toContain(".orbit-depth");
    // The static state must set every card to equal, full clarity — no
    // fake "foreground" card once there is no motion left to justify one.
    expect(block).toMatch(/\.orbit-depth\s*\{[^}]*opacity:\s*1;/);
    expect(block).toMatch(/\.orbit-depth\s*\{[^}]*filter:\s*none;/);
  });

  it("every card gets its own static angle via --orbit-static-angle, inherited for the reduced-motion arrangement", () => {
    expect(ORBIT_CODE_ONLY).toContain("--orbit-static-angle");
  });

  it("the decorative travelling-glow path stroke carries its own motion-reduce companion", () => {
    // Checked against comment-stripped source: OrbitJourney.tsx's own
    // JSX docblocks mention ".animate-flow-dash" by name in prose (to
    // explain the reuse), which would otherwise false-positive this
    // line-scan the same way homepage-source-audit.test.ts's own
    // stripComments() helper exists to prevent.
    const lines = ORBIT_CODE_ONLY.split("\n").filter((line) => /\banimate-(?!none)[\w-]+/.test(line));
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line, `expected a motion-reduce: companion on: ${line.trim()}`).toMatch(/motion-reduce:/);
    }
  });
});

describe("hero orbit — no fabricated statistics, no fake dashboard content", () => {
  it("OrbitJourney.tsx's rendered copy never invents a student-count or similar unverified metric", () => {
    expect(ORBIT_CODE_ONLY).not.toMatch(/500\s*[kK]\+?/);
    expect(ORBIT_CODE_ONLY).not.toMatch(/500,000/);
  });

  it("none of the six visible card titles/labels contains a digit (no illustrative-looking stat on any card)", () => {
    const titles = [...ORBIT_CODE_ONLY.matchAll(/title:\s*"([^"]+)"/g)].map((m) => m[1]);
    const labels = [...ORBIT_CODE_ONLY.matchAll(/label:\s*"([^"]+)"/g)].map((m) => m[1]);
    for (const text of [...titles, ...labels]) {
      expect(text, `unexpected digit in orbit card text: "${text}"`).not.toMatch(/\d/);
    }
  });

  it("never renders dashboard-style content (no 'Welcome back', no stat-tile/progress language borrowed from HeroProductPreview.tsx)", () => {
    expect(ORBIT_CODE_ONLY).not.toMatch(/Welcome back/i);
    expect(ORBIT_CODE_ONLY).not.toMatch(/Illustrative preview/i);
    expect(ORBIT_CODE_ONLY).not.toMatch(/Your Nextwise Journey/i);
  });
});

describe("hero orbit — the straight-line hero visual no longer renders in the hero", () => {
  it("HomeHero.tsx imports and renders OrbitJourney, not HeroProductPreview", () => {
    expect(HERO_SOURCE).toContain("OrbitJourney");
    expect(HERO_SOURCE).toMatch(/<OrbitJourney\s*\/>/);
    // Checked against comment-stripped source: HomeHero.tsx's own
    // docblock explains the retirement and legitimately names
    // "HeroProductPreview.tsx" in prose — the real invariant is that no
    // CODE line imports or renders it any more.
    expect(stripComments(HERO_SOURCE)).not.toMatch(/HeroProductPreview/);
  });

  it("HeroProductPreview.tsx itself still exists on disk (retired from the hero, not deleted — other tests/guards still read it by filename)", () => {
    expect(() => readSection("HeroProductPreview.tsx")).not.toThrow();
  });
});

describe("hero orbit — single H1 regression guard", () => {
  it("HomeHero.tsx still renders exactly one <h1>, and OrbitJourney.tsx renders none", () => {
    expect((HERO_SOURCE.match(/<h1[\s>]/g) ?? []).length).toBe(1);
    expect((ORBIT_SOURCE.match(/<h1[\s>]/g) ?? []).length).toBe(0);
  });
});

describe("hero orbit — the approved master logo is never recreated or substituted", () => {
  it("OrbitJourney.tsx imports no next/image and references no logo asset path", () => {
    expect(ORBIT_SOURCE).not.toMatch(/from ["']next\/image["']/);
    expect(ORBIT_SOURCE).not.toMatch(/nextwise-(logo|icon)/);
  });
});

describe("hero orbit — performance discipline: only transform/opacity/filter are animated", () => {
  it.each(["orbit-arm-spin", "orbit-counter-spin", "orbit-depth"])(
    "@keyframes %s never animates a layout-affecting property (top/left/width/height)",
    (keyframeName) => {
      // Matches just this ONE @keyframes block, up to its own closing
      // brace at 2-space indent (this file's consistent formatting) —
      // deliberately NOT a wider sweep through the surrounding static
      // positioning rules (.orbit-arm/.orbit-counter/.orbit-card-anchor
      // DO set top/left/width once, statically, to lay the orbit out at
      // all — that's required and fine; the brief's rule is about never
      // *animating* those properties through a transition/keyframe).
      const match = GLOBALS_CSS.match(new RegExp(`@keyframes ${keyframeName} \\{[\\s\\S]*?\\n  \\}`));
      expect(match, `@keyframes ${keyframeName} not found`).not.toBeNull();
      const block = match![0];
      expect(block).not.toMatch(/\n\s*(top|left|width|height):/);
    }
  );

  it("the static positioning rules (.orbit-arm/.orbit-counter/.orbit-card-anchor) set top/left/width only once, never inside a keyframe", () => {
    // Sanity check that the test above isn't vacuously passing because
    // top/left/width don't appear anywhere at all.
    expect(GLOBALS_CSS).toMatch(/\.orbit-arm \{[\s\S]*?\n\s*left: 50%;/);
    expect(GLOBALS_CSS).toMatch(/\.orbit-card-anchor \{[\s\S]*?\n\s*width: var\(--orbit-card-w/);
  });
});
