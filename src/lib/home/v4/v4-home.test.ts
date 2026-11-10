import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { V4_DESTINATIONS, V4_ROUTES, coursesForDestination } from "./content";
import {
  EIO,
  EOUT,
  HOLD,
  INTRO,
  LAST,
  NPOS,
  TOTAL,
  TR,
  TRANS,
  ctr,
  guideN,
  mapScroll,
  rotTip,
  sceneStart,
} from "./engine";
import * as images from "./images";
import { coverWidth, desktopSizes, mobileSizes, type V4ImageSet } from "./images";

const ROOT = path.resolve(import.meta.dirname, "../../../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const COMPONENT = "src/components/sections/home/v4/V4ConnectedHome.tsx";
const CSS = "src/components/sections/home/v4/v4-home.css";

describe("NW-V4 — the homepage renders the Connected Experience", () => {
  // V5.4: `/` renders the V5.4 homepage, which runs on this V4 engine, content and imagery (all unchanged and still
  // tested below). V4ConnectedHome stays on disk. Line endings are normalised so Windows checkouts pass too.
  it("`/` renders the V5.4 homepage (built on the V4 engine) and keeps its public metadata", () => {
    const page = read("src/app/(site)/page.tsx").replace(/\r\n/g, "\n");
    expect(page).toContain("<NextwiseV54Home />");
    expect(page).toContain('publicPageMetadata(\n  "/",');
  });

  it("has exactly one h1 and seven labelled scenes in story order", () => {
    const src = read(COMPONENT);
    expect(src.match(/<h1\b/g)?.length).toBe(1);
    const scenes = [...src.matchAll(/className="nw4-layer (L\d)" id="nw4-scene-(\d)" aria-label="[^"]+"/g)].map((m) => [m[1], m[2]]);
    expect(scenes).toEqual([0, 1, 2, 3, 4, 5, 6].map((i) => [`L${i}`, String(i)]));
  });
});

describe("NW-V4 — routes and links", () => {
  const pageFor = (href: string) => {
    const pathname = href.split("?")[0]!;
    return path.join(ROOT, "src/app/(site)", pathname === "/" ? "" : pathname, "page.tsx");
  };

  it("every V4 route is an existing page in this repository", () => {
    for (const href of Object.values(V4_ROUTES)) expect(existsSync(pageFor(href)), href).toBe(true);
  });

  it("every internal href literal in the component resolves to an existing page", () => {
    const src = read(COMPONENT);
    const literals = [...src.matchAll(/href="(\/[^"#]*)"/g)].map((m) => m[1]!);
    for (const href of literals) expect(existsSync(pageFor(href)), href).toBe(true);
  });

  it("destination 'Explore programmes' links use launch-country codes understood by /courses", () => {
    const launch = read("src/lib/education/external-search/launch-countries.ts");
    for (const d of V4_DESTINATIONS) {
      expect(launch).toContain(`"${d.code}"`);
      expect(coursesForDestination(d.code)).toBe(`/courses?destination=${d.code}`);
    }
  });

  it("each destination summary links to an https official source and opens safely in a new tab", () => {
    for (const d of V4_DESTINATIONS) expect(d.sourceUrl).toMatch(/^https:\/\//);
    expect(read(COMPONENT)).toMatch(/target="_blank" rel="noopener noreferrer"/);
  });

  it("the programme search is a real GET form to /courses using its own q/degree params", () => {
    const src = read(COMPONENT);
    expect(src).toMatch(/<form className="search" action=\{V4_ROUTES\.courses\} method="get" role="search">/);
    expect(src).toMatch(/name="q"/);
    expect(src).toMatch(/name="degree" value="bachelors"/);
    expect(src).toMatch(/name="degree" value="masters"/);
    expect(read("src/lib/education/external-search/taxonomy.ts")).toMatch(/"bachelors", "masters"/);
  });
});

describe("NW-V4 — content integrity", () => {
  const visibleText = () =>
    read(COMPONENT)
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");

  it("contains no fabricated statistics, ratings, percentages or testimonials", () => {
    // object-position values ("50% 30%") and inline styles are layout, not claims
    const text = (visibleText() + read("src/lib/home/v4/content.ts").replace(/\/\*[\s\S]*?\*\//g, "")).replace(/objectPosition[=:]\s*"[^"]*"/g, "").replace(/style=\{\{[^}]*\}\}/g, "");
    expect(text).not.toMatch(/\d+\s?%|\d[\d,]*\+\s|\b\d+(\.\d)?\/5\b|★|testimonial|rated\s|trusted by/i);
  });

  it("labels every in-product preview as illustrative", () => {
    const src = read(COMPONENT);
    expect(src).toContain('aria-label="Career profile preview (illustrative)"');
    expect(src).toContain("Illustrative preview");
    expect(src).toContain('aria-label="Student Studio preview (illustrative)"');
    expect(src).toContain("Illustrative UI");
    expect(src).toContain("Orientation summary");
  });

  it("uses the official, unmodified brand icon for the N (no recolour)", () => {
    const src = read(COMPONENT);
    expect(src).toContain("href={BRAND_LOGO.icon}");
    expect(read("src/config/site.ts")).toContain('icon: "/brand/nextwise-icon.png"');
    expect(src).not.toMatch(/feColorMatrix|hue-rotate/);
  });
});

describe("NW-V4 — engine choreography is the approved V4 timeline", () => {
  it("keeps the V4 scroll map (holds, transition length, total)", () => {
    expect([...HOLD]).toEqual([0.55, 0.55, 0.75, 0.85, 0.75, 1.1, 0.6]);
    expect(TRANS).toBe(0.95);
    expect(TOTAL).toBeCloseTo(5.15 + 0.95 * 6, 10);
    expect([...TR]).toEqual([null, "wipe", "wipe", "wipe", "rise", "rise", "wipe"]);
  });

  it("maps scroll positions to scenes: holds are at rest, transitions interpolate", () => {
    expect(mapScroll(0)).toEqual({ t: 0, hp: 0 });
    for (let k = 0; k <= LAST; k++) {
      const m = mapScroll(sceneStart(k) + 0.01);
      expect(m.t).toBe(k);
    }
    const mid = mapScroll(sceneStart(2) + HOLD[2] + TRANS / 2);
    expect(mid.t).toBeCloseTo(2.5, 10);
    expect(mapScroll(1e6)).toEqual({ t: LAST, hp: 1 });
  });

  it("keeps the intro timings and the V4 N rest positions", () => {
    expect(INTRO.draw).toEqual([650, 2350]);
    expect(INTRO.glide).toEqual([3000, 4150]);
    expect(INTRO.photo).toEqual([3150, 4700]);
    expect(NPOS.d.form).toEqual({ x: 515, y: 245, s: 0.8 });
    expect(NPOS.d.rest[0]).toEqual({ x: 60, y: 150, s: 0.3 });
    expect(NPOS.m.rest[0]).toEqual({ x: 16, y: 380, s: 0.17 });
    expect(NPOS.d.rest).toHaveLength(7);
    expect(NPOS.m.rest).toHaveLength(7);
  });

  it("easing curves are monotonic and hit their endpoints", () => {
    for (const f of [EOUT, EIO]) {
      expect(f(0)).toBeCloseTo(0, 5);
      expect(f(1)).toBeCloseTo(1, 5);
      let prev = -1;
      for (let x = 0; x <= 1.0001; x += 0.05) {
        const y = f(Math.min(1, x));
        expect(y).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = y;
      }
    }
  });

  it("the guided N starts and ends exactly at the rest positions (no jump at either end)", () => {
    for (const mode of ["d", "m"] as const) {
      for (let k = 0; k < LAST; k++) {
        const a = guideN(mode, k, 0),
          b = guideN(mode, k, 1);
        const A = ctr(NPOS[mode].rest[k]!),
          B = ctr(NPOS[mode].rest[k + 1]!);
        expect(a.cx).toBeCloseTo(A.x, 6);
        expect(a.cy).toBeCloseTo(A.y, 6);
        expect(b.cx).toBeCloseTo(B.x, 6);
        expect(b.cy).toBeCloseTo(B.y, 6);
        expect(a.s).toBeCloseTo(NPOS[mode].rest[k]!.s, 6);
        expect(Number.isFinite(rotTip(guideN(mode, k, 0.5)).x)).toBe(true);
      }
    }
  });
});

describe("NW-V4 — photography assets", () => {
  const sets = Object.entries(images).filter(([, v]) => typeof v === "object" && v !== null && "avif" in v) as [string, V4ImageSet][];

  it("every srcset entry and fallback exists in /public and matches its declared width", () => {
    expect(sets.length).toBeGreaterThanOrEqual(11);
    for (const [, set] of sets) {
      for (const list of [set.avif, set.webp]) {
        for (const entry of list.split(", ")) {
          const [url, w] = entry.split(" ");
          expect(existsSync(path.join(ROOT, "public", url!)), url).toBe(true);
          expect(url).toContain(`-${parseInt(w!, 10)}.`);
        }
      }
      expect(existsSync(path.join(ROOT, "public", set.fallback))).toBe(true);
    }
  });

  it("the hero ladders reach Retina/4K widths without upscaling the masters", () => {
    // the hero covers the photo's inner box (stage + 3% inset each side): 1526.4 desktop / 413.4 mobile stage px
    expect(images.heroDesktop.avif).toContain("3053w");
    expect(images.heroDesktop.width).toBe(3053);
    expect(images.heroMobile.avif).toContain("1447w");
    for (const [, set] of sets) {
      const widths = set.avif.split(", ").map((e) => parseInt(e.split(" ")[1]!, 10));
      expect(Math.max(...widths)).toBeLessThanOrEqual(set.width);
    }
  });

  it("no single delivered file is unreasonably heavy (≤ 1.5 MB)", () => {
    for (const [, set] of sets)
      for (const entry of set.avif.split(", ")) {
        const url = entry.split(" ")[0]!;
        expect(statSync(path.join(ROOT, "public", url)).size, url).toBeLessThanOrEqual(1.5 * 1024 * 1024);
      }
  });

  it("`sizes` encode the stage scale on both axes", () => {
    expect(desktopSizes(848)).toBe("min(58.89vw, 94.22vh)");
    expect(mobileSizes(413)).toBe("min(105.9vw, 48.93vh)");
    expect(coverWidth(760, 760, images.destNl)).toBeGreaterThan(1100);
    expect(coverWidth(760, 760, images.destIe)).toBe(760);
  });
});

describe("NW-V4 — hero uses the approved mockup scene", () => {
  it("the retired hero photography is gone from the code and from /public", () => {
    const sources = [COMPONENT, CSS, "src/lib/home/v4/images.ts"].map(read).join("\n");
    expect(sources).not.toMatch(/hero-(desktop|mobile)-\d/);
    expect(sources).not.toMatch(/twilight/i);
    for (const f of ["hero-desktop-1696.jpg", "hero-desktop-2714.avif", "hero-mobile-826.jpg", "hero-mobile-1446.avif"])
      expect(existsSync(path.join(ROOT, "public/home-v4", f)), f).toBe(false);
  });

  it("every hero and bleed file the ladders name exists", () => {
    for (const set of [images.heroDesktop, images.heroMobile, images.heroBleedDesktop, images.heroBleedMobile]) {
      expect(set.avif).toContain("hero-v5-");
      for (const list of [set.avif, set.webp])
        for (const entry of list.split(", ")) expect(existsSync(path.join(ROOT, "public", entry.split(" ")[0]!)), entry).toBe(true);
      expect(existsSync(path.join(ROOT, "public", set.fallback)), set.fallback).toBe(true);
    }
  });

  it("the bleed images have the aspect of the regions the engine places them in", () => {
    const { desktop, mobile } = images.HERO_BLEED;
    expect(images.heroBleedDesktop.width / images.heroBleedDesktop.height).toBeCloseTo(desktop.w / desktop.h, 2);
    expect(images.heroBleedMobile.width / images.heroBleedMobile.height).toBeCloseTo(mobile.w / mobile.h, 2);
    // the regions fully contain the stage
    expect(desktop.x).toBeLessThan(0);
    expect(desktop.x + desktop.w).toBeGreaterThan(1440);
    expect(desktop.y + desktop.h).toBeGreaterThan(900);
    expect(mobile.x + mobile.w).toBeGreaterThan(390);
    expect(mobile.y + mobile.h).toBeGreaterThan(844);
  });

  it("the hero is restyled in the Nextwise palette, scoped to L0", () => {
    const css = read(CSS);
    for (const hex of ["#F9F9FC", "#D4D9E1", "#7D8EA6", "#344D7D", "#1A3262", "#282A2D"]) expect(css).toContain(hex);
    expect(css).not.toMatch(/\.L0\{background:radial-gradient\([^)]*#2A1E4D/);
    const c = read(COMPONENT);
    expect(c).toContain("data-nw4-bleed");
    expect(c).toMatch(/alt="A student with a backpack looks up at the sunrise/);
  });
});

describe("NW-V4 — styles stay scoped and smooth", () => {
  it("every rule is scoped to .nw4 except the homepage-only header treatment", () => {
    const css = read(CSS).replace(/\/\*[\s\S]*?\*\//g, "");
    const selectors = [...css.matchAll(/(^|})\s*([^{}@]+)\{/g)].map((m) => m[2]!.trim()).filter((s) => !/^(from|to|\d+%)$/.test(s));
    for (const sel of selectors)
      for (const part of sel.split(",")) expect(part.trim(), part).toMatch(/^(\.nw4\b|body:has\(\.nw4)/);
  });

  it("ships the dithering overlay and the real Fraunces italic", () => {
    expect(read(CSS)).toContain("/home-v4/dither-256.png");
    expect(existsSync(path.join(ROOT, "public/home-v4/dither-256.png"))).toBe(true);
    expect(read("src/components/sections/home/v4/fonts.ts")).toMatch(/style: "italic"/);
  });

  it("honours reduced motion in both the engine and the stylesheet", () => {
    expect(read("src/lib/home/v4/engine.ts")).toContain("(prefers-reduced-motion: reduce)");
    expect(read(CSS)).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
