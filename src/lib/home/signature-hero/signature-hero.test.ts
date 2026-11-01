import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MAIN_NAV } from "@/config/site";
import { EUROPE_COUNTRIES } from "@/data/europe-explorer";
import { applyRegistrationPromptHold } from "@/lib/registration-prompt/event-bus";
import {
  buildRibbon,
  distanceToPolyline,
  placeImage,
  pointInPolygon,
  profileAt,
  projectImagePoint,
  sampleCentreline,
  shadeRibbon,
  type Vec2,
} from "./geometry";
import { COMPACT_SPEC, LAYOUTS, WIDE_SPEC } from "./layouts";
import { HERO_ACTIONS, HERO_COPY, PATHWAYS, PHOTOGRAPHS } from "./content";
import { SCENES, TIMELINE, revealAt, sceneAt, scrollTopForProgress, splitReveal, windowProgress } from "./timeline";
import { HOMEPAGE_HERO_ENV, getHomepageHeroVariant, isHomepagePreviewEnabled } from "./variant";

const ROOT = path.resolve(__dirname, "../../../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const SIGNATURE_DIR = "src/components/sections/home/signature";
const SIGNATURE_FILES = readdirSync(path.join(ROOT, SIGNATURE_DIR)).filter((f) => /\.(tsx?|css)$/.test(f));
const LIB_FILES = readdirSync(__dirname).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
const ALL_SOURCES = [...SIGNATURE_FILES.map((f) => `${SIGNATURE_DIR}/${f}`), ...LIB_FILES.map((f) => `src/lib/home/signature-hero/${f}`)];

/** Does a public (site) route exist for this href? */
function routeExists(href: string): boolean {
  const clean = href.split("?")[0].replace(/^\//, "");
  return existsSync(path.join(ROOT, "src/app/(site)", clean, "page.tsx"));
}

describe("homepage integration — off by default, previewable locally", () => {
  it("renders the current hero unless NEXTWISE_HOMEPAGE_HERO is exactly 'signature'", () => {
    expect(HOMEPAGE_HERO_ENV).toBe("NEXTWISE_HOMEPAGE_HERO");
    expect(getHomepageHeroVariant(undefined)).toBe("current");
    expect(getHomepageHeroVariant("")).toBe("current");
    expect(getHomepageHeroVariant("true")).toBe("current");
    expect(getHomepageHeroVariant("Signature")).toBe("current");
    expect(getHomepageHeroVariant("signature")).toBe("signature");
  });

  it("the flag is server-only and not set anywhere in the repository", () => {
    expect(HOMEPAGE_HERO_ENV.startsWith("NEXT_PUBLIC_")).toBe(false);
    for (const env of [".env", ".env.example", ".env.production", "vercel.json"]) {
      if (existsSync(path.join(ROOT, env))) expect(read(env)).not.toContain(HOMEPAGE_HERO_ENV);
    }
  });

  it("page.tsx keeps HomeHero as the default and the existing section order", () => {
    const page = read("src/app/(site)/page.tsx");
    expect(page).toMatch(/heroVariant === "signature" \? <SignatureHero \/> : <HomeHero \/>/);
    const order = ["<HomeHero", "<ProductEntryCards", "<StudioIntro", "<DiscoveryPillars", "<TrustedStudyExplorer", "<HowItWorks", "<WhyNextwise", "<HomeFinalCTA"].map((t) => page.indexOf(t));
    expect(order.every((i) => i > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("the homepage never receives the preview-only dev controls", () => {
    expect(read("src/app/(site)/page.tsx")).not.toMatch(/devControls/);
  });

  it("the preview route exists only in development and test, and is never indexed", () => {
    expect(isHomepagePreviewEnabled("development")).toBe(true);
    expect(isHomepagePreviewEnabled("test")).toBe(true);
    expect(isHomepagePreviewEnabled("production")).toBe(false);
    expect(isHomepagePreviewEnabled("")).toBe(false);
    const preview = read("src/app/(site)/homepage-preview/page.tsx");
    expect(preview).toMatch(/if \(!isHomepagePreviewEnabled\(\)\) notFound\(\);/);
    expect(preview).toMatch(/robots = \{ index: false, follow: false, nocache: true \}/);
    expect(preview).toMatch(/isHomepagePreviewEnabled\(\) \? \{ title: "Homepage preview", robots \} : \{ robots \}/);
  });

  it("the preview renders the same sections as the homepage, in the same order", () => {
    const preview = read("src/app/(site)/homepage-preview/page.tsx");
    const order = ["<SignatureHero devControls", "<ProductEntryCards", "<StudioIntro", "<DiscoveryPillars", "<TrustedStudyExplorer", "<HowItWorks", "<WhyNextwise", "<HomeFinalCTA"].map((t) => preview.indexOf(t));
    expect(order.every((i) => i > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("the preview is linked from nowhere public", () => {
    for (const rel of ["src/app/sitemap.ts", "src/app/robots.ts", "src/config/site.ts", "src/components/navigation/Header.tsx", "src/components/navigation/Footer.tsx", "src/components/navigation/MobileNav.tsx"]) {
      expect(read(rel)).not.toContain("homepage-preview");
    }
  });
});

describe("navigation and destinations", () => {
  it("the approved six-item primary navigation is unchanged", () => {
    expect(MAIN_NAV.map((l) => [l.label, l.href])).toEqual([
      ["Home", "/"],
      ["Explore Careers", "/careers"],
      ["Career Intelligence", "/career"],
      ["Study Abroad", "/abroad"],
      ["Universities", "/universities"],
      ["Courses", "/courses"],
    ]);
  });

  it("every hero action and pathway leads to an existing public route", () => {
    const hrefs = [HERO_ACTIONS.primary.href, HERO_ACTIONS.secondary.href, PATHWAYS.career.href, PATHWAYS.abroad.href];
    expect(hrefs).toEqual(["/career-discovery", "/study-europe", "/career", "/abroad"]);
    for (const href of hrefs) expect(routeExists(href), href).toBe(true);
  });

  it("the two pathways take their labels from MAIN_NAV and the destination count from the registry", () => {
    expect(PATHWAYS.career.label).toBe(MAIN_NAV.find((l) => l.href === "/career")!.label);
    expect(PATHWAYS.abroad.label).toBe(MAIN_NAV.find((l) => l.href === "/abroad")!.label);
    expect(PATHWAYS.abroad.note).toBe(`${EUROPE_COUNTRIES.length} European countries`);
    expect(EUROPE_COUNTRIES).toHaveLength(6);
  });

  it("the copy makes no statistical claims", () => {
    expect(`${HERO_COPY.headlineLead} ${HERO_COPY.headlineEmphasis} ${HERO_COPY.body}`).not.toMatch(/\d/);
    expect(HERO_COPY.headlineLead + " " + HERO_COPY.headlineEmphasis).toBe("Turn ambition into opportunity.");
  });

  it("photographs are existing repository assets and are described as illustrative", () => {
    for (const photo of Object.values(PHOTOGRAPHS)) {
      expect(existsSync(path.join(ROOT, "public", photo.src))).toBe(true);
      expect(photo.alt.startsWith("Illustrative image:")).toBe(true);
      expect(photo.alt).not.toMatch(/student of nextwise|nextwise student/i);
    }
  });

  it("the hero never renders or references the logo files (the shared Logo in the header stays the only logo)", () => {
    for (const rel of ALL_SOURCES) expect(read(rel)).not.toMatch(/nextwise-(logo|icon)/);
  });
});

describe("ribbon geometry", () => {
  it("profiles interpolate between stops and clamp at the ends", () => {
    const stops = [
      { t: 0, value: 2 },
      { t: 0.5, value: 10 },
      { t: 1, value: 4 },
    ];
    expect(profileAt(stops, -1)).toBe(2);
    expect(profileAt(stops, 0.5)).toBe(10);
    expect(profileAt(stops, 2)).toBe(4);
    const mid = profileAt(stops, 0.25);
    expect(mid).toBeGreaterThan(2);
    expect(mid).toBeLessThan(10);
  });

  it("resamples the centreline at (near) equal arc-length steps, through both end points", () => {
    const line = sampleCentreline(WIDE_SPEC.points, 200);
    expect(line[0]).toEqual(WIDE_SPEC.points[0]);
    const last = line[line.length - 1];
    const end = WIDE_SPEC.points[WIDE_SPEC.points.length - 1];
    expect(Math.hypot(last[0] - end[0], last[1] - end[1])).toBeLessThan(0.5);
    const steps = line.slice(1).map((p, i) => Math.hypot(p[0] - line[i][0], p[1] - line[i][1]));
    const mean = steps.reduce((a, b) => a + b, 0) / steps.length;
    for (const s of steps) expect(Math.abs(s - mean) / mean).toBeLessThan(0.15);
  });

  it("shading: facing the viewer shows the top surface; turned past 90° shows the underside", () => {
    expect(shadeRibbon([1, 0], 0, 0.5).underside).toBe(false);
    expect(shadeRibbon([1, 0], 60, 0.5).underside).toBe(false);
    expect(shadeRibbon([1, 0], 120, 0.5).underside).toBe(true);
    expect(shadeRibbon([1, 0], 180, 0.5).underside).toBe(true);
    expect(shadeRibbon([1, 0], 0, 0.5).fill).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("is deterministic (same input, same geometry)", () => {
    expect(buildRibbon(WIDE_SPEC).front.map((q) => q.d)).toEqual(buildRibbon(WIDE_SPEC).front.map((q) => q.d));
  });

  for (const key of ["wide", "compact"] as const) {
    const layout = LAYOUTS[key];
    const g = layout.geometry;
    const [vw, vh] = g.spec.viewBox;

    it(`${key}: front quads are before backFrom, back quads after; the loop really turns over behind the photograph`, () => {
      expect(g.front.length + g.back.length).toBe(g.spec.samples - 1);
      expect(g.front.every((q) => q.t < g.spec.backFrom)).toBe(true);
      expect(g.back.every((q) => q.t >= g.spec.backFrom)).toBe(true);
      expect(g.back.some((q) => q.underside)).toBe(true);
      expect(g.front.filter((q) => q.t < 0.1).every((q) => !q.underside)).toBe(true);
    });

    it(`${key}: the whole ribbon stays inside its art board (nothing is cut by the frame)`, () => {
      const coords = [...g.front, ...g.back].flatMap((q) => q.d.match(/-?\d+(\.\d+)?/g)!.map(Number));
      for (let i = 0; i < coords.length; i += 2) {
        expect(coords[i]).toBeGreaterThanOrEqual(-2);
        expect(coords[i]).toBeLessThanOrEqual(vw + 2);
        expect(coords[i + 1]).toBeGreaterThanOrEqual(-2);
        expect(coords[i + 1]).toBeLessThanOrEqual(vh + 2);
      }
    });

    it(`${key}: the line starts thin and grows into a substantial ribbon`, () => {
      expect(profileAt(g.spec.halfWidth, 0)).toBeLessThan(2);
      expect(profileAt(g.spec.halfWidth, TIMELINE.restingReveal)).toBeLessThan(8);
      expect(g.maxHalfWidth).toBeGreaterThan(30);
    });

    it(`${key}: the photographic lobe is a large closed window`, () => {
      expect(g.lobePolygon.length).toBeGreaterThan(50);
      expect(g.lobeBox.width).toBeGreaterThan(vw * 0.35);
      expect(g.lobeBox.height).toBeGreaterThan(vh * 0.7);
      expect(g.lobePath.endsWith("Z")).toBe(true);
    });

    it(`${key}: the portrait's face is never cut by the ribbon, across its whole drift`, () => {
      const portrait = PHOTOGRAPHS.portrait;
      const placement = placeImage(g.lobeBox, portrait.size, portrait.focal, layout.portraitTarget, 1.06);
      const faceRadius = portrait.face.radius * placement.width;
      // The drift scales 1.07 → 1.00 about (50%, 40%) of the image and moves −10 → +10 units vertically.
      const origin: Vec2 = [placement.x + placement.width * 0.5, placement.y + placement.height * 0.4];
      const frontLine = g.centreline.filter((_, i) => i / (g.centreline.length - 1) < g.spec.backFrom);
      for (const [scale, dy] of [
        [1.07, -10],
        [1.035, 0],
        [1, 10],
      ]) {
        const [fx, fy] = projectImagePoint(placement, portrait.face.centre);
        const centre: Vec2 = [origin[0] + (fx - origin[0]) * scale, origin[1] + (fy - origin[1]) * scale + dy];
        const r = faceRadius * scale;
        expect(pointInPolygon(centre, g.lobePolygon)).toBe(true);
        expect(distanceToPolyline(centre, [...g.lobePolygon, g.lobePolygon[0]])).toBeGreaterThan(r);
        expect(distanceToPolyline(centre, frontLine)).toBeGreaterThan(r + g.maxHalfWidth);
      }
    });

    it(`${key}: photographs always cover the lobe (no empty corners), including the campus pan`, () => {
      const box = g.lobeBox;
      for (const placement of [
        placeImage(box, PHOTOGRAPHS.portrait.size, PHOTOGRAPHS.portrait.focal, layout.portraitTarget, 1.06),
        placeImage(box, PHOTOGRAPHS.campus.size, PHOTOGRAPHS.campus.focal, [0.5, 0.55], 1.08),
        placeImage(box, PHOTOGRAPHS.campus.size, PHOTOGRAPHS.campus.panTo, [0.5, 0.56], 1.08),
      ]) {
        expect(placement.x).toBeLessThanOrEqual(box.x + 0.01);
        expect(placement.y).toBeLessThanOrEqual(box.y + 0.01);
        expect(placement.x + placement.width).toBeGreaterThanOrEqual(box.x + box.width - 0.01);
        expect(placement.y + placement.height).toBeGreaterThanOrEqual(box.y + box.height - 0.01);
      }
    });

    it(`${key}: pathway nodes sit on the opening line, before the ribbon gains substance`, () => {
      for (const w of layout.waypoints) {
        expect(w.t).toBeGreaterThan(0);
        expect(w.t).toBeLessThan(0.13);
        if (w.label) {
          expect(w.label[0]).toBeGreaterThanOrEqual(0);
          expect(w.label[0]).toBeLessThan(vw * 0.3);
        }
      }
      expect(layout.waypoints.map((w) => w.pathway).sort()).toEqual(["abroad", "career"]);
    });
  }

  it("the two compositions are genuinely different, not a scaled copy", () => {
    expect(COMPACT_SPEC.viewBox).not.toEqual(WIDE_SPEC.viewBox);
    expect(COMPACT_SPEC.points.length).not.toBe(WIDE_SPEC.points.length);
  });
});

describe("scroll-progress mapping", () => {
  it("six scenes tile 0–1 in story order", () => {
    expect(SCENES.map((s) => s.id)).toEqual(["beginning", "emerges", "reveal", "expands", "pathways", "continuation"]);
    expect(SCENES[0].range[0]).toBe(0);
    expect(SCENES[SCENES.length - 1].range[1]).toBe(1);
    for (let i = 1; i < SCENES.length; i += 1) expect(SCENES[i].range[0]).toBe(SCENES[i - 1].range[1]);
    expect(sceneAt(0)).toBe("beginning");
    expect(sceneAt(0.4)).toBe("reveal");
    expect(sceneAt(0.7)).toBe("expands");
    expect(sceneAt(1)).toBe("continuation");
    expect(sceneAt(-3)).toBe("beginning");
  });

  it("every timeline window is inside 0–1 and runs forwards", () => {
    for (const [name, value] of Object.entries(TIMELINE)) {
      if (typeof value === "number") continue;
      expect(value[0], name).toBeGreaterThanOrEqual(0);
      expect(value[1], name).toBeLessThanOrEqual(1);
      expect(value[1], name).toBeGreaterThan(value[0]);
    }
  });

  it("the story order holds: ribbon formed → portrait → campus → pan → pathways → continuation", () => {
    expect(TIMELINE.portraitIn[0]).toBeLessThan(TIMELINE.reveal[1]);
    expect(TIMELINE.portraitIn[1]).toBeLessThan(TIMELINE.campusIn[0]);
    expect(TIMELINE.campusIn[0] - TIMELINE.portraitIn[1]).toBeGreaterThanOrEqual(0.12); // the portrait is held, not flashed
    expect(TIMELINE.campusIn[1]).toBeLessThanOrEqual(TIMELINE.campusPan[0]);
    expect(TIMELINE.campusPan[1]).toBeLessThanOrEqual(TIMELINE.pathways[1]);
    expect(TIMELINE.pathways[1]).toBeLessThanOrEqual(TIMELINE.continuation[0]);
  });

  it("the ribbon reveal starts at the resting line, only grows, and completes", () => {
    expect(revealAt(0)).toBeCloseTo(TIMELINE.restingReveal);
    expect(revealAt(1)).toBe(1);
    let previous = -1;
    for (let p = 0; p <= 1.0001; p += 0.01) {
      const r = revealAt(p);
      expect(r).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = r;
    }
  });

  it("is reversible: every value is a pure function of progress", () => {
    const forward = [0.1, 0.3, 0.5, 0.7, 0.9].map((p) => [revealAt(p), windowProgress(p, TIMELINE.campusIn), sceneAt(p)]);
    const backward = [0.9, 0.7, 0.5, 0.3, 0.1].map((p) => [revealAt(p), windowProgress(p, TIMELINE.campusIn), sceneAt(p)]).reverse();
    expect(backward).toEqual(forward);
  });

  it("splits the reveal into front and back masks without a gap", () => {
    const b = 0.635;
    expect(splitReveal(0, b)).toEqual({ front: 0, back: 0 });
    expect(splitReveal(b, b)).toEqual({ front: 1, back: 0 });
    expect(splitReveal(1, b)).toEqual({ front: 1, back: 1 });
    const mid = splitReveal(b + (1 - b) / 2, b);
    expect(mid.front).toBe(1);
    expect(mid.back).toBeCloseTo(0.5);
  });

  it("dev bar scroll maths", () => {
    expect(scrollTopForProgress(0, 100, 3000, 900)).toBe(100);
    expect(scrollTopForProgress(1, 100, 3000, 900)).toBe(2200);
    expect(scrollTopForProgress(2, 0, 500, 900)).toBe(0);
  });
});

describe("reduced motion, fallback and performance (source audits)", () => {
  const hero = stripComments(read(`${SIGNATURE_DIR}/SignatureHero.tsx`));
  const css = read(`${SIGNATURE_DIR}/signature-hero.css`);

  it("reduced motion shows the finished composition without pinning or scroll-linked motion", () => {
    expect(hero).toContain("useReducedMotion()");
    expect(hero).toMatch(/const progress = reduced \? finished : smooth;/);
    expect(hero).toMatch(/reduced \? "relative h-\[calc\(100svh-4rem\)\]/);
    expect(hero).toMatch(/data-motion-mode=\{reduced \? "reduced" : "animated"\}/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none/);
  });

  it("the headline and actions are server-renderable markup, readable before any script", () => {
    const copy = read(`${SIGNATURE_DIR}/SignatureHeroCopy.tsx`);
    expect(copy).not.toMatch(/^"use client"/);
    expect(copy).toContain("<h1");
    expect(copy).toContain("HERO_ACTIONS.primary.href");
    // The opening reveal moves text, it never hides it.
    expect(css).not.toMatch(/\.nw-sig-line[^}]*opacity/);
  });

  it("uses native scrolling: CSS sticky, no wheel/touch interception, no preventDefault", () => {
    expect(hero).toContain("sticky top-16");
    for (const rel of ALL_SOURCES) {
      const src = stripComments(read(rel));
      expect(src, rel).not.toMatch(/addEventListener\(\s*["'](wheel|touchmove|scroll)["']/);
      expect(src, rel).not.toMatch(/preventDefault\(/);
    }
  });

  it("no per-frame React state: motion-value handlers never call a state setter except the one-time photo load", () => {
    const art = stripComments(read(`${SIGNATURE_DIR}/SignatureRibbonArt.tsx`));
    const handlers = art.match(/useMotionValueEvent\([\s\S]*?\}\);/g) ?? [];
    expect(handlers).toHaveLength(1);
    expect(handlers[0]).toMatch(/if \(!campusWanted && v > 0\.24\) setCampusWanted\(true\)/);
  });

  it("no heavy graphics or animation library", () => {
    for (const rel of ALL_SOURCES) expect(read(rel), rel).not.toMatch(/from ["'](gsap|three|@react-three\/[\w-]+|lottie[\w-]*|pixi\.js)["']/);
  });

  it("only the layout on screen downloads photographs", () => {
    const art = stripComments(read(`${SIGNATURE_DIR}/SignatureRibbonArt.tsx`));
    expect(art).toMatch(/const portraitHref = active \?/);
    expect(art).toMatch(/const campusHref = active && campusWanted \?/);
  });
});

describe("registration prompt coexistence", () => {
  it("holds are tracked per source", () => {
    let holds: Set<string> = new Set();
    holds = applyRegistrationPromptHold(holds, { source: "signature-hero", held: true });
    holds = applyRegistrationPromptHold(holds, { source: "other", held: true });
    holds = applyRegistrationPromptHold(holds, { source: "signature-hero", held: false });
    expect([...holds]).toEqual(["other"]);
    expect([...applyRegistrationPromptHold(holds, { source: "other", held: false })]).toEqual([]);
  });

  it("the prompt's timed path waits while a hold is raised; contextual requests and eligibility are untouched", () => {
    const prompt = read("src/components/registration-prompt/RegistrationPrompt.tsx");
    expect(prompt).toMatch(/engagedMsRef\.current >= ENGAGED_THRESHOLD_MS && holdsRef\.current\.size === 0/);
    expect(prompt).toMatch(/function handleContextualRequest\(\) \{\s*tryOpen\("contextual"\);/);
    expect(prompt).toContain("canShowRegistrationPrompt");
    expect(prompt).toContain("window.removeEventListener(REGISTRATION_PROMPT_HOLD_EVENT, handleHold)");
  });

  it("the hero raises the hold only while it is on screen and always releases it", () => {
    const hero = stripComments(read(`${SIGNATURE_DIR}/SignatureHero.tsx`));
    expect(hero).toMatch(/setRegistrationPromptHold\("signature-hero", entry\.isIntersecting\)/);
    expect(hero).toMatch(/observer\.disconnect\(\);\s*setRegistrationPromptHold\("signature-hero", false\);/);
  });
});

describe("source tree hygiene", () => {
  it("all signature-hero files exist where the docs say", () => {
    for (const f of ["SignatureHero.tsx", "SignatureHeroCopy.tsx", "SignatureRibbonArt.tsx", "SignatureHeroDevBar.tsx", "fonts.ts", "signature-hero.css"]) {
      expect(statSync(path.join(ROOT, SIGNATURE_DIR, f)).isFile()).toBe(true);
    }
  });
});
