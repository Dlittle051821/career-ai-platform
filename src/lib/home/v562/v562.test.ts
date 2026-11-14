import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TwoPathways } from "@/components/sections/home/v562/TwoPathways";
import {
  BINOCULARS,
  BINOCULAR_SIZES,
  CARDS,
  CHIPS,
  LENSES,
  SPLIT,
  SPLIT_STACKED,
  V562_COPY,
  V562_ROUTES,
  binocularSrcSet,
  cardPose,
  chipVisibility,
  contentOffset,
  ease,
  routeProgress,
  splitState,
  trailDraw,
  trailFor,
} from "./content";
import { routeTiming } from "./route-transition";

const ROOT = path.resolve(import.meta.dirname, "../../../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");
const HOME = "src/components/sections/home/v54/NextwiseV54Home.tsx";
const CSS = "src/components/sections/home/v562/two-pathways.css";
const CONTROLLER = "src/lib/home/v562/two-pathways.ts";
const PUBLIC = path.join(ROOT, "public/home-v562");

describe("V5.6.2 Two Pathways — destinations", () => {
  it("both pathways open existing public routes (no invented URLs)", () => {
    expect(V562_ROUTES).toEqual({ discovery: "/career-discovery", clarity: "/courses" });
    for (const href of Object.values(V562_ROUTES)) expect(existsSync(path.join(ROOT, "src/app/(site)", href, "page.tsx"))).toBe(true);
  });
  it("the routes are public: not behind the auth middleware", () => {
    const mw = read("middleware.ts");
    for (const href of Object.values(V562_ROUTES)) expect(mw).not.toMatch(new RegExp(`["'\`]${href}["'\`/]`));
  });
});

describe("V5.6.2 Two Pathways — markup", () => {
  const html = renderToStaticMarkup(createElement(TwoPathways));
  it("renders the approved copy as real, readable text", () => {
    expect(html).toContain(V562_COPY.title);
    expect(html).toContain("I don’t know");
    expect(html).toContain("where to start.");
    expect(html).toContain("I know what I");
    expect(html).toContain("want to study.");
    expect(html).toContain("Discover My Path");
    expect(html).toContain("Explore Study Options");
    expect(html).toContain("YOU <span");
    expect(html).toContain("WHERE YOU<br/>WANT TO GO");
    for (const c of V562_COPY.clarity.countries) expect(html).toContain(c);
  });
  it("has one h2 and an h3 per pathway, and each pathway is labelled by its heading", () => {
    expect(html.match(/<h2/g)).toHaveLength(1);
    expect(html.match(/<h3/g)).toHaveLength(2);
    expect(html).toContain('aria-labelledby="tp562-h-d"');
    expect(html).toContain('aria-labelledby="tp562-h-c"');
  });
  it("the CTAs are real links to the existing routes", () => {
    expect(html).toMatch(/<a[^>]*class="tp-cta"[^>]*href="\/career-discovery"|<a[^>]*href="\/career-discovery"[^>]*class="tp-cta"/);
    expect(html).toMatch(/<a[^>]*class="tp-cta"[^>]*href="\/courses"|<a[^>]*href="\/courses"[^>]*class="tp-cta"/);
  });
  it("decorative objects are hidden from assistive tech and every image has an empty alt", () => {
    expect(html).toMatch(/class="tp-obj tp-disc" aria-hidden="true"/);
    expect(html).toMatch(/class="tp-obj tp-jt" aria-hidden="true"/);
    for (const m of html.matchAll(/<img [^>]*>/g)) expect(m[0]).toContain('alt=""');
    // the detail-view backgrounds are not requested at page load
    expect(html).not.toMatch(/<img[^>]* src="\/home-v562\/(contours|europe)\.svg"/);
    expect(html).toContain('data-tp-src="/home-v562/europe.svg"');
  });
  it("controls that only exist in the detail view start out of the tab order", () => {
    for (const m of html.matchAll(/<button[^>]*>/g)) {
      expect(m[0]).toContain('tabindex="-1"');
      expect(m[0]).toContain('aria-hidden="true"');
    }
  });
  it("renders all six career-field chips and the three route cards", () => {
    for (const [label] of CHIPS) expect(html).toContain(label);
    for (const t of ["Country", "Programme", "University"]) expect(html).toContain(t);
  });
});

describe("V5.6.2 Two Pathways — assets (object-only, original)", () => {
  const files = readdirSync(PUBLIC);
  it("ships only the binoculars render derivatives and the two vector backgrounds", () => {
    for (const f of files) expect(f).toMatch(/^(binoculars-\d+\.(avif|webp)|contours\.svg|europe\.svg)$/);
  });
  it("every srcset entry exists, in both formats, and no derivative is upscaled beyond the master", () => {
    for (const w of BINOCULARS.widths) {
      expect(w).toBeLessThanOrEqual(BINOCULARS.w);
      for (const fmt of ["avif", "webp"]) expect(files).toContain(`binoculars-${w}.${fmt}`);
    }
    expect(binocularSrcSet("avif").split(",")).toHaveLength(BINOCULARS.widths.length);
    expect(BINOCULAR_SIZES).toMatch(/vw|px/);
  });
  it("keeps the raster weight phone-friendly", () => {
    const kb = (f: string) => statSync(path.join(PUBLIC, f)).size / 1024;
    expect(kb("binoculars-480.avif")).toBeLessThan(40);
    expect(kb("binoculars-720.avif")).toBeLessThan(60);
    expect(Math.max(...files.filter((f) => f.endsWith(".avif")).map(kb))).toBeLessThan(120);
  });
  it("lens viewports sit inside the binoculars image", () => {
    for (const l of LENSES) {
      expect(l.left).toBeGreaterThanOrEqual(0);
      expect(l.top).toBeGreaterThanOrEqual(0);
      expect(l.left + l.width).toBeLessThanOrEqual(100);
      expect(l.top + l.height).toBeLessThanOrEqual(100);
    }
  });
});

describe("V5.6.2 Two Pathways — motion tables (approved prototype values)", () => {
  it("split targets are the approved ones", () => {
    expect(SPLIT).toEqual({ rest: 0.5, "hover-d": 0.64, "hover-c": 0.36, "exp-d": 0.93, "exp-c": 0.07 });
    expect(SPLIT_STACKED["hover-d"]).toBe(0.66);
    expect(SPLIT_STACKED["hover-c"]).toBe(0.34);
  });
  it("activation and expansion are pure functions of the split", () => {
    expect(splitState(0.5)).toMatchObject({ a: 0, aD: 0, aC: 0, expD: 0, expC: 0 });
    expect(splitState(0.64).aD).toBeCloseTo(1);
    expect(splitState(0.36).aC).toBeCloseTo(1);
    expect(splitState(0.93).expD).toBeCloseTo(1);
    expect(splitState(0.07).expC).toBeCloseTo(1);
    // around a phone's content-fitted resting split, rest is still neutral
    expect(splitState(0.47, 0.47).a).toBe(0);
  });
  it("is continuous: retargeting mid-move can never jump", () => {
    let prev = splitState(0.07);
    for (let s = 0.07; s <= 0.93; s += 0.001) {
      const cur = splitState(s);
      for (const k of ["a", "expD", "expC"] as const) expect(Math.abs(cur[k] - prev[k])).toBeLessThan(0.02);
      prev = cur;
    }
  });
  it("content stays centred at rest and returns to the edge when expanded", () => {
    expect(contentOffset(960, 1920, 0)).toBe(0);
    expect(contentOffset(0.93 * 1920, 1920, 1)).toBe(0);
  });
  it("Design and Science show at rest; the other fields reveal in order with Discovery", () => {
    const rest = CHIPS.map(([, , , , th]) => chipVisibility(th, 1, 0, 0));
    expect(rest.slice(0, 2)).toEqual([1, 1]);
    expect(rest.slice(2).every((v) => v === 0)).toBe(true);
    const active = CHIPS.map(([, , , , th]) => chipVisibility(th, 1, 1, 0));
    expect(active.every((v) => v === 1)).toBe(true);
    const ths = CHIPS.map((c) => c[4]).filter((t) => t > 0);
    expect([...ths].sort()).toEqual(ths);
    expect(trailDraw(0, 1, 0)).toBe(1);
    expect(trailDraw(0.6, 0, 0)).toBe(0);
  });
  it("trails start at the right lens", () => {
    expect(trailFor(300, 112).d.startsWith("M364.69 567.61")).toBe(true);
  });
  it("route cards fan out at rest and align on Clarity", () => {
    const rest = [0, 1, 2].map((i) => cardPose(i, 0, 1));
    const on = [0, 1, 2].map((i) => cardPose(i, 1, 1));
    expect(rest.map((p) => p.r)).toEqual(CARDS.map((c) => c[2]));
    expect(on.every((p) => p.r === 0 && p.on)).toBe(true);
    expect(rest.some((p) => p.on)).toBe(false);
  });
  it("the ticket route completes before the destination transition", () => {
    expect(routeProgress(0, 0)).toBe(0);
    expect(routeProgress(1, 0)).toBeCloseTo(0.86);
    expect(routeProgress(1, 1)).toBe(1);
  });
  it("easing curves are GSAP's power curves (monotonic, 0 → 1)", () => {
    for (const f of Object.values(ease)) {
      expect(f(0)).toBeCloseTo(0);
      expect(f(1)).toBeCloseTo(1);
      for (let t = 0; t < 1; t += 0.05) expect(f(t + 0.05)).toBeGreaterThanOrEqual(f(t));
    }
  });
  it("the coral transition is shorter after the first time in a session", () => {
    const full = routeTiming(false),
      short = routeTiming(true);
    expect(full.wipe).toBe(850);
    expect(short.wipe + short.delay + short.lift).toBeLessThan(full.wipe + full.delay + full.lift + full.hold);
    expect(short.label).toBe(false);
  });
});

describe("V5.6.2 Two Pathways — integration guards", () => {
  const home = read(HOME);
  const css = read(CSS);
  const ctrl = read(CONTROLLER);
  it("scene 2 renders V5.6.2 in backdrop panel 1 and keeps the engine's scene slot", () => {
    expect(home).toContain("j === 1 ? <TwoPathways /> : null");
    expect(home).toContain('<section className="nw4-layer L1" id="nw4-scene-1" aria-labelledby="tp562-title" />');
    expect(home).toContain("<TwoPathwaysMotion rootId={ROOT_ID} />");
    expect(home).not.toContain("pathwayCareer");
  });
  it("adds no scroll controller of its own: it only reads the V5.4 chapter attributes", () => {
    expect(ctrl).not.toMatch(/addEventListener\(\s*["'](wheel|scroll|touchmove)["']/);
    expect(ctrl).not.toMatch(/scrollTo|scrollIntoView|scrollBy|dataset\.v54(Chapter|Moving)\s*=[^=]/);
    expect(ctrl).toContain('attributeFilter: ["data-v54-chapter", "data-v54-moving"]');
  });
  it("respects reduced motion and pauses when hidden", () => {
    expect(ctrl).toContain("prefers-reduced-motion: reduce");
    expect(ctrl).toContain("document.hidden");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });
  it("styles are scoped to the scene (and the N fade only while settled on this chapter)", () => {
    const selectors = css.replace(/\/\*[\s\S]*?\*\//g, "").match(/^[^@{}\s][^{}]*\{/gm) ?? [];
    for (const sel of selectors) {
      if (/^(from|to)\s*\{/.test(sel)) continue;
      expect(sel).toMatch(/\.tp562|\.nw4\.nw54/);
    }
    expect(css).toContain('.nw4.nw54[data-v54-chapter="pathways"]:not([data-v54-moving]) .nmark');
  });
  it("decorative layers never intercept input", () => {
    expect(css).toMatch(/\.tp562 \.tp-obj \{[^}]*pointer-events: none/);
    expect(css).toMatch(/\.tp562 \.tp-label \{[^}]*pointer-events: none/);
  });
  it("uses no people imagery: no photo assets, no portrait references", () => {
    const src = [read("src/components/sections/home/v562/TwoPathways.tsx"), read("src/lib/home/v562/content.ts"), css].join("\n");
    expect(src).not.toMatch(/\.(jpe?g|png)\b/i);
    expect(src).not.toMatch(/v54-portrait|portrait\.(png|jpe?g|webp|avif)|student-photo|unsplash|pexels|stock/i);
  });
});
