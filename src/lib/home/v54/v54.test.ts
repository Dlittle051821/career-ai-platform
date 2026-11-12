import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { HOLD, INTRO, STAGE, TRANS, mapScroll } from "@/lib/home/v4/engine";
import { MASTER_LOGO } from "@/lib/brand/master-logo";
import { REF_SCALE, V54_ACTION, V54_CARDS, V54_COLUMNS, V54_COPY, V54_HEAD, V54_PORTRAIT, V54_SCENE, V54_TIMING } from "./config";
import {
  V54_CLARITY_SPAN,
  V54_EMERGED,
  V54_STATES,
  cardFrame,
  cardsFor,
  clarityProgress,
  focusWinner,
  loopPoint,
  scrollFromT,
  stateFor,
  warpedPhase,
} from "./motion";

const ROOT = path.resolve(import.meta.dirname, "../../../..");
// line endings normalised: Windows checkouts (core.autocrlf) must give the same results
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");
const textHash = (rel: string) => createHash("sha256").update(read(rel).replace(/\r\n/g, "\n")).digest("hex");

const PAGE = "src/app/(site)/page.tsx";
const HOME = "src/components/sections/home/v54/NextwiseV54Home.tsx";
const HERO = "src/components/sections/home/v54/NextwiseV54Hero.tsx";
const MOTION = "src/components/sections/home/v54/V54Motion.tsx";
const CSS = "src/components/sections/home/v54/v54.css";
const ORBIT = "src/lib/home/v54/motion.ts";
const CONFIG = "src/lib/home/v54/config.ts";

/** The approved V4 files exactly as installed (V4 Connected Experience + final hero background). */
const V4_LOCKED: Record<string, string> = {
  "src/lib/home/v4/engine.ts": "f77f7ab04551597ad2272805ee36ee68c9a3011b37ad2b0b9a9cea4b88606d2e",
  "src/components/sections/home/v4/v4-home.css": "d69ab4ca24be5cb40497be7ef3f5507b3a218b3cf1d3a4511739e7584210d6ee",
};

type Mode = "d" | "m";
const MODES: readonly Mode[] = ["d", "m"];
const entry = (mode: Mode, id: string) => cardsFor(mode).find((e) => e.card.id === id)!;
/** sample the settled thought motion: 2 minutes from the end of emergence */
const T0 = V54_EMERGED;
const samples = (step = 100, span = 120000) => Array.from({ length: Math.floor(span / step) }, (_, k) => T0 + k * step);
const frame = (mode: Mode, id: string, ms: number, s = 0, reduced = false) => cardFrame({ mode, ...entry(mode, id), ms, s, reduced });
const faceShare = (mode: Mode, f: ReturnType<typeof cardFrame>) => {
  const F = V54_HEAD[mode].face;
  const hw = (f.w * f.scale) / 2,
    hh = (f.h * f.scale) / 2;
  const ox = Math.min(f.x + hw, F.x1) - Math.max(f.x - hw, F.x0);
  const oy = Math.min(f.y + hh, F.y1) - Math.max(f.y - hh, F.y0);
  return ox > 0 && oy > 0 ? (ox * oy) / ((F.x1 - F.x0) * (F.y1 - F.y0)) : 0;
};

describe("NW-V5.4 — isolation and preservation", () => {
  it("is the production homepage: / renders it in every environment (no development-only gate) with the site's public metadata", () => {
    const page = read(PAGE);
    // CIUX-01 — the page now renders the unchanged V5.4 story first, then the
    // "Start where you are" quick routes (QuickExplore) before the footer.
    expect(page).toMatch(/<NextwiseV54Home \/>\s*<QuickExplore \/>/);
    expect(page).not.toMatch(/isHomepagePreviewEnabled|notFound|homepage-preview/);
    expect(page).toMatch(/publicPageMetadata\(\s*"\/"/);
  });

  it("the release ships no development-only preview route for V5.4", () => {
    expect(existsSync(path.join(ROOT, "src/app/(site)/homepage-preview/v5-4"))).toBe(false);
  });

  it("the V4 engine (the N geometry, reveal and scroll choreography) and its styles are byte-for-byte the approved versions", () => {
    for (const [rel, hash] of Object.entries(V4_LOCKED)) expect(textHash(rel), rel).toBe(hash);
  });

  it("the N is the V4 engine's, started unchanged; one N element, no motion-path line, no extra animation library", () => {
    // V5.4 starts the engine fork (stage rule + delegated navigation only — see the engine-fork test below)
    expect(read(MOTION)).toMatch(/import \{ startV4Engine \} from "@\/lib\/home\/v54\/engine"/);
    expect(read(MOTION)).toMatch(/startV4Engine\(root, \{\s*capture,\s*navigate:/);
    expect(read(HOME).match(/data-nw4-n=""/g)?.length).toBe(1);
    expect(read(HOME)).not.toMatch(/nw4-trail|motion-path|data-nw4-line/);
    const v5 = [HOME, HERO, MOTION, ORBIT, "src/lib/home/v54/tour.ts", "src/lib/home/v54/chapters.ts", "src/lib/home/v54/backdrop.ts"].map(read).join("\n");
    expect(v5).not.toMatch(/from "(gsap|lenis|three|@react-three\/fiber|framer-motion|motion)"/);
  });

  it("the motion controller never writes to an element the V4 engine animates", () => {
    const orbit = read(ORBIT);
    expect(orbit).not.toMatch(/data-nw4-hero-photo|data-nw4-n\b|\.nw4-layer|data-line|data-sec/);
    expect(orbit).toMatch(/querySelectorAll<HTMLElement>\("\[data-v54-card\]"\)/);
  });

  it("every style is scoped to the V5.3 root", () => {
    const css = read(CSS)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/@keyframes[^{]*\{[^}]*\{[^}]*\}\s*\}/g, "")
      .replace(/@supports[^{]*\{/g, "");
    const selectors = css.split("}").map((r) => r.split("{").slice(-2, -1)[0]?.trim() ?? "");
    for (const sel of selectors.filter((s) => s && !s.startsWith("@")))
      for (const part of sel.split(",")) expect(part.trim(), part).toMatch(/^(\.nw4\.nw54\b|body:has\(\.nw54\)|to$|from$)/);
  });

  it("server-rendered markup with one small client component that reverts everything on unmount", () => {
    for (const f of [HOME, HERO, "src/components/sections/home/v54/ThoughtCard.tsx"]) expect(read(f)).not.toMatch(/^"use client"/);
    expect(read(MOTION)).toMatch(/^"use client"/);
    expect(read(MOTION)).toMatch(/return \(\) => \{\s*stopTour\(\);\s*chapters\?\.stop\(\);\s*stopBackdrop\(\);\s*stopMotion\(\);\s*stopEngine\(\);/);
    // the only other client component reads the existing auth state for the account actions
    expect(read("src/components/sections/home/v54/V54Account.tsx")).toMatch(/^"use client"/);
  });
});

describe("NW-V5.4 — hero copy, technology typography, coral actions and the horizon", () => {
  it("one headline hierarchy: eyebrow, the two statements, supporting line, actions; the tagline once, as a quiet sign-off", () => {
    expect(V54_COPY.eyebrow).toBe("From confusion to clarity");
    expect([V54_COPY.headline[0], V54_COPY.headline[1] + V54_COPY.headlineStop]).toEqual(["Too many choices.", "One clearer direction."]);
    expect(V54_COPY.signature).toBe("Know What’s Next.");
    const hero = read(HERO);
    expect(hero.match(/V54_COPY\.signature/g)?.length).toBe(1);
    expect([V54_COPY.primary, V54_COPY.secondary]).toEqual(["Get started free", "Watch how it works"]);
  });
  it("technology typography: Space Grotesk Bold display — navy statement, Ocean Blue resolution, optically hung full stops; Sora as Option B", () => {
    const fonts = read("src/components/sections/home/v54/fonts.ts");
    expect(fonts).toMatch(/Space_Grotesk\(/);
    expect(fonts).toMatch(/Sora\(/);
    expect(read(HOME)).toMatch(/data-v54-type="a"/);
    const css = read(CSS);
    expect(css).toMatch(/--v54-display:var\(--font-v54-grotesk\)/);
    const h1 = css.match(/\.v54-h1\{([^}]*)\}/)![1]!;
    expect(h1).toMatch(/font-family:var\(--v54-display\)/);
    expect(h1).toMatch(/font-weight:700/);
    expect(h1).toMatch(/color:var\(--nw-brand-navy\)/);
    const px = Number(h1.match(/font-size:(\d+)px/)![1]);
    expect(px).toBeGreaterThanOrEqual(54);
    expect(px).toBeLessThanOrEqual(76);
    const lh = Number(h1.match(/line-height:(\d+)px/)![1]) / px;
    expect(lh).toBeGreaterThanOrEqual(1.02);
    expect(lh).toBeLessThanOrEqual(1.1);
    expect(css).toMatch(/\.v54-accent\{color:var\(--nw-brand-ocean\)/);
    // both full stops are ordinary headline glyphs, optically hung — never coloured
    expect(read(HERO).match(/className="v54-p"/g)?.length).toBe(2);
    expect(css.match(/\.v54-p\{([^}]*)\}/)![1]).not.toMatch(/color|background/);
    expect(css).not.toMatch(/fraunces|italic/i);
  });
  it("Electric Coral is an ACTION colour only: Get started free, Sign up and the navigation pills (hover/focus/press) — navy text, AA contrast", () => {
    const css = read(CSS);
    expect(css.match(/#FF4D6D/gi)?.length).toBe(1);
    expect(css).toMatch(/--nw-action-primary:#FF4D6D;--nw-action-primary-hover:#FF5F7B;--nw-action-primary-text:#03045F/);
    const users = css
      .split("}")
      .filter((r) => /var\(--nw-action-primary(-hover)?\)|rgba\(255,77,109|rgba\(200,30,69/.test(r))
      .map((r) => r.split("{")[0]!.trim().replace(/\s+/g, " "));
    expect(users.length).toBeGreaterThan(0);
    for (const u of users) expect(u, u).toMatch(/v54-(btn-primary|signup|pill)/);
    // nothing coral on the questions, the headline, labels, badge or eyebrow
    expect(css).not.toMatch(/v54-coral/);
    for (const sel of ["v54-card", "v54-ic", "v54-h1", "v54-accent", "v54-p", "v54-eyebrow", "v54-label", "v54-badge-star", "v54-btn-ghost"])
      for (const rule of css.split("}").filter((r) => new RegExp(`\\.${sel}(?![\\w-])`).test(r.split("{")[0]!)))
        expect(rule, sel).not.toMatch(/--nw-action|255,77,109|FF4D6D/i);
    expect(read("src/components/sections/home/v54/ThoughtCard.tsx")).not.toMatch(/v54-q\b|coral/i);
    expect(read("src/components/brand/NextwiseBrandLogo.tsx")).not.toMatch(/FF4D6D|coral/i);
    // WCAG: navy text on coral ≥ 4.5:1 (white would fail at 3.2:1)
    const lum = (hex: string) => {
      const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
    };
    const ratio = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
    expect(ratio(V54_ACTION.primary, V54_ACTION.primaryText)).toBeGreaterThan(4.5);
    expect(ratio("#FF5F7B", V54_ACTION.primaryText)).toBeGreaterThan(4.5);
    expect(ratio(V54_ACTION.primary, "#FFFFFF")).toBeLessThan(4.5);
  });

  it("Log in is clearly secondary (quiet outline, no coral); Sign up is the single coral account action; phones keep Sign up and move Log in into the menu", () => {
    const css = read(CSS);
    const login = css.match(/\.nw4\.nw54 \.v54-login\{([^}]*)\}/)![1]!;
    expect(login).toMatch(/border:1px solid rgba\(3,4,95,\.18\)/);
    expect(login).not.toMatch(/--nw-action|FF4D6D|255,77,109/);
    expect(css).toMatch(/\.nw4\.nw54 \.v54-signup\{[^}]*background:var\(--nw-action-primary\)/);
    expect(css).toMatch(/@media \(max-width:699\.98px\),\(max-aspect-ratio:86\/100\)\{[\s\S]*?\.v54-header>\.v54-actions \.v54-login\{display:none\}/);
    expect(css).toMatch(/\.nw4\.nw54 \.v54-menu-btn\{display:block;flex:none\}/);
    expect(css).not.toMatch(/v54-signin|v54-start\b/);
  });

  it("every question card shares one blue-and-white treatment: no per-card or focus-moment accent colour", () => {
    const css = read(CSS);
    expect(css).not.toMatch(/\.v54-card\[data-focus="true"\]/);
    expect(css).not.toMatch(/\.v54-card\[data-pathway="[a-z]+"\][^\[{]*\{/);
    expect(read("src/components/sections/home/v54/ThoughtCard.tsx")).not.toMatch(/style=|className=\{/);
  });

  it("the Future Horizon scene: a separate, translucent, masked image layer under every card and the portrait, with responsive AVIF/WebP/JPEG", () => {
    const css = read(CSS);
    expect(css).toMatch(/\.v54-scene\{position:absolute;inset:0;z-index:1;/);
    const img = css.match(/\.v54-scene img\{object-fit[^}]*\}/)![0];
    expect(img).toContain(`opacity:${String(V54_SCENE.opacity).replace(/^0/, "")};`);
    expect(img).toMatch(/mask-image:linear-gradient\(180deg,transparent 0%,transparent 30%/);
    // only the image is translucent — never the hero, the frame or the stage
    expect(css).not.toMatch(/\.(v54-frame|L0)\{[^}]*opacity/);
    for (const f of ["desktop-1440.avif", "desktop-2160.avif", "desktop-2880.avif", "desktop-1440.webp", "desktop-2880.webp", "desktop-1440.jpg", "mobile-780.avif", "mobile-1170.avif", "mobile-780.webp", "mobile-780.jpg"])
      expect(existsSync(path.join(ROOT, "public/home-v54", `v54-horizon-${f}`)), f).toBe(true);
    const hero = read(HERO);
    expect(hero.indexOf("<HorizonScene />")).toBeLessThan(hero.indexOf("data-nw4-hero-photo"));
    expect(hero).toMatch(/fetchPriority="low"/);
    // subtle motion: transform/opacity only, small values, static for reduced motion
    expect(V54_SCENE.scrollRise).toBeLessThanOrEqual(20);
    expect(V54_SCENE.introScale).toBeLessThanOrEqual(1.08);
    expect(read(ORBIT)).toMatch(/const zoom = reduced \? 1\.03 :/);
  });

  it("the approved V5.2 motion is unchanged: same questions, sizes and every waypoint, duration, phase and focus hold", () => {
    const digest = createHash("sha256")
      .update(JSON.stringify(V54_CARDS.map((c) => [c.id, c.lines, c.pathway, c.size, c.motion])))
      .digest("hex");
    expect(digest).toBe("75ed825805b2610df5446d08e626f951b8d1b5e94ea6809c86e97e3db9c275e4");
  });
  it("no fabricated statistics or trust claims", () => {
    const text = [HERO, HOME, CONFIG].map(read).join("\n");
    expect(text).not.toMatch(/100,000|\d{2,3},\d{3}\+|Trusted by \d|\d+\+ students|guarantee/i);
  });

  it("the primary action goes to registration; the secondary runs a real guided tour (no dead end)", () => {
    const hero = read(HERO);
    expect(hero).toMatch(/<V54PrimaryCta label=\{V54_COPY\.primary\} \/>/);
    expect(read("src/components/sections/home/v54/V54Account.tsx")).toMatch(/className="v54-btn v54-btn-primary" href=\{signedIn \? home\.href : V54_ACCOUNT\.start\.href\}/);
    expect(hero).toMatch(/data-v54-tour=""/);
    // the tour plays every chapter through the chapter controller
    expect(read("src/lib/home/v54/tour.ts")).toMatch(/await chapters\.goTo\(k\)/);
  });

  it("the approved portrait is reused unchanged as its own alpha layer; the Master Logo component is used", () => {
    const b = readFileSync(path.join(ROOT, "public/home-v54/v54-portrait.png"));
    expect([b.readUInt32BE(16), b.readUInt32BE(20), b[25]]).toEqual([1860, 1174, 6]);
    expect(createHash("sha256").update(b).digest("hex").slice(0, 16)).toBe("bbaee9bcb7325d46");
    expect(V54_PORTRAIT.d.x).toBeCloseTo(320 * REF_SCALE, 0);
    expect(read(HERO)).toMatch(/data-nw4-hero-photo=""/);
    expect(read(HOME)).toContain("<NextwiseBrandLogo");
    expect(existsSync(path.join(ROOT, "public", MASTER_LOGO.horizontalLight.src))).toBe(true);
  });
});

describe("NW-V5.4 — the student questions", () => {
  it("nine genuine questions — no product names — each resolving to the right pathway", () => {
    expect(V54_CARDS.map((c) => c.lines.join(" ")).sort()).toEqual(
      [
        "Am I choosing the right path?",
        "How much could I earn?",
        "Is this a good career?",
        "Should I study abroad?",
        "Should I trust AI advice?",
        "What should I study?",
        "What’s the average salary?",
        "Which university is right for me?",
        "Will this career grow?",
      ].sort(),
    );
    for (const c of V54_CARDS) expect(c.lines.join(" ")).not.toMatch(/Nextwise|Career Intelligence|Study Abroad|Studio/);
    const by = (p: string) => V54_CARDS.filter((c) => c.pathway === p).map((c) => c.id).sort();
    expect(by("career")).toEqual(["earn", "good-career", "grow", "right-path", "salary", "trust-ai"]);
    expect(by("abroad")).toEqual(["abroad", "study", "university"]);
  });

  it("mobile: fewer moving cards (five), each with a shorter path than its desktop one", () => {
    const m = cardsFor("m");
    expect(m).toHaveLength(5);
    const span = (pts: readonly (readonly number[])[]) => Math.hypot(Math.max(...pts.map((p) => p[0]!)) - Math.min(...pts.map((p) => p[0]!)), Math.max(...pts.map((p) => p[1]!)) - Math.min(...pts.map((p) => p[1]!)));
    for (const { card } of m) expect(span(card.motion.m!.waypoints), card.id).toBeLessThan(span(card.motion.d.waypoints));
  });
});

describe("NW-V5.4 — organic motion: authored paths, not a carousel", () => {
  it("the cards do NOT share one circle or ellipse: no common centre fits their positions", () => {
    // fit the best ellipse centred anywhere (axis-aligned) to all card positions: residuals stay large
    const pts: [number, number][] = [];
    for (const ms of samples(500)) for (const { card } of cardsFor("d")) pts.push([frame("d", card.id, ms).x, frame("d", card.id, ms).y]);
    const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length,
      my = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    const sx = Math.sqrt(pts.reduce((a, p) => a + (p[0] - mx) ** 2, 0) / pts.length),
      sy = Math.sqrt(pts.reduce((a, p) => a + (p[1] - my) ** 2, 0) / pts.length);
    const r = pts.map((p) => Math.hypot((p[0] - mx) / sx, (p[1] - my) / sy));
    const mr = r.reduce((a, v) => a + v, 0) / r.length;
    const cv = Math.sqrt(r.reduce((a, v) => a + (v - mr) ** 2, 0) / r.length) / mr;
    // points on one common ellipse give cv ≈ 0 — the V5.1 ring measured 0.067 with this same test; V5.3 measures ≈ 0.20
    expect(cv).toBeGreaterThan(0.15);
  });

  it("every card has its own authored loop: distinct waypoints, duration and phase; no two paths alike", () => {
    const d = V54_CARDS.map((c) => c.motion.d);
    expect(new Set(d.map((m) => m.duration)).size).toBeGreaterThanOrEqual(7);
    expect(new Set(d.map((m) => JSON.stringify(m.waypoints))).size).toBe(d.length);
    for (const m of d) expect(m.waypoints.length).toBeGreaterThanOrEqual(4);
    // different distances from the head: the cards are not at one radius
    const H = V54_HEAD.d;
    const radii = d.map((m) => m.waypoints.reduce((a, w) => a + Math.hypot(w[0] - H.cx, w[1] - H.cy), 0) / m.waypoints.length);
    expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(150);
  });

  it("asymmetric composition: unequal card counts and spread either side of the student", () => {
    const H = V54_HEAD.d;
    const k = V54_TIMING.keyframe;
    const xs = cardsFor("d").map(({ card }) => frame("d", card.id, k).x - H.cx);
    const left = xs.filter((x) => x < 0),
      right = xs.filter((x) => x >= 0);
    expect(left.length).not.toBe(right.length);
    const meanAbs = (a: number[]) => a.reduce((s, v) => s + Math.abs(v), 0) / a.length;
    expect(Math.abs(meanAbs(left) - meanAbs(right))).toBeGreaterThan(40);
  });

  it("deterministic and seamless: no Math.random; same time → same frame; every loop closes smoothly", () => {
    const code = (read(ORBIT) + read(CONFIG)).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/Math\.random/);
    const a = frame("d", "abroad", 16384, 0.2);
    expect(frame("d", "abroad", 16384, 0.2)).toEqual(a);
    for (const c of V54_CARDS) {
      const m = c.motion.d;
      const at0 = loopPoint(m.waypoints, 0),
        at1 = loopPoint(m.waypoints, 1 - 1e-9);
      for (let i = 0; i < 3; i++) expect(at1[i]!).toBeCloseTo(at0[i]!, 4);
      // the warped clock never runs backwards (no reversals, no jumps)
      let prev = -Infinity;
      for (let p = 0; p <= 1; p += 0.002) {
        const w = warpedPhase(m, 0.37, p);
        expect(w).toBeGreaterThan(prev);
        prev = w;
      }
    }
  });

  it("smooth: no card ever jumps — frame-to-frame movement stays small at 60 fps, including at loop boundaries", () => {
    for (const mode of MODES)
      for (const { card } of cardsFor(mode)) {
        let prev = frame(mode, card.id, T0);
        for (let ms = T0 + 16; ms < T0 + 90000; ms += 16) {
          const f = frame(mode, card.id, ms);
          expect(Math.hypot(f.x - prev.x, f.y - prev.y), `${mode} ${card.id} @${ms}`).toBeLessThan(mode === "d" ? 4 : 2.5);
          prev = f;
        }
      }
  });

  it("depth, scale and blur vary naturally; blur follows depth and never reaches the near cards' text", () => {
    const zs: number[] = [],
      sc: number[] = [];
    for (const ms of samples(250))
      for (const { card } of cardsFor("d")) {
        const f = frame("d", card.id, ms);
        zs.push(f.z);
        sc.push(f.scale);
        if (f.z >= 0.5) expect(f.blur).toBeLessThanOrEqual(0.5 + 1e-9);
        if (f.z <= -0.5) expect(f.blur).toBeGreaterThanOrEqual(1.5);
        expect(f.blur).toBeLessThanOrEqual(3);
      }
    expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(1.5);
    expect(Math.max(...sc)).toBeGreaterThan(1.1);
    expect(Math.min(...sc)).toBeLessThan(0.85);
  });

  it("some cards pass behind the portrait, and they only switch sides beside or above his face — never across it", () => {
    const behind = new Set<string>();
    for (const { card } of cardsFor("d")) {
      let prev = frame("d", card.id, T0);
      for (const ms of samples(50)) {
        const f = frame("d", card.id, ms);
        if (!f.front) behind.add(card.id);
        if (f.front !== prev.front) {
          const H = V54_HEAD.d.hair;
          const insideHead = f.x > H.x0 - f.w * 0.3 && f.x < H.x1 + f.w * 0.3 && f.y < H.y1;
          expect(insideHead, `${card.id} switches layer over his head at ${ms}`).toBe(false);
        }
        prev = f;
      }
    }
    expect(behind.size).toBeGreaterThanOrEqual(3);
  });

  it("the student's face stays visible: no card in front of him covers his face", () => {
    for (const mode of MODES)
      for (const ms of samples(100))
        for (const { card } of cardsFor(mode)) {
          const f = frame(mode, card.id, ms);
          if (f.front) expect(faceShare(mode, f), `${mode} ${card.id} @${ms}`).toBeLessThan(0.02);
        }
  });

  it("Scene C — one moment of focus at a time, crisp and readable, recurring every few seconds", () => {
    for (const mode of MODES) {
      let gap = 0,
        maxGap = 0,
        on = 0;
      for (const ms of samples(100)) {
        const fs = cardsFor(mode).map(({ card }) => [card.id, frame(mode, card.id, ms)] as const);
        const focused = fs.filter(([, f]) => f.focus > 0.5);
        expect(focused.length).toBeLessThanOrEqual(1);
        if (focused.length) {
          const [id, f] = focused[0]!;
          expect(id).toBe(focusWinner(mode, ms));
          expect(f.blur).toBeLessThan(0.3);
          expect(f.opacity).toBe(1);
          expect(f.front).toBe(true);
          on++;
          gap = 0;
        } else maxGap = Math.max(maxGap, ++gap);
      }
      expect(maxGap * 100, mode).toBeLessThanOrEqual(8000);
      expect(on / samples(100).length, mode).toBeGreaterThan(0.3);
    }
  });

  it("cards stay clear of the headline, the actions and the side notes, and inside the frame", () => {
    const zones: Record<Mode, [number, number, number, number][]> = {
      d: [[0, 1440, 0, 362], [84, 364, 786, 866], [1176, 1366, 782, 862]],
      m: [[0, 390, 0, 304]],
    };
    for (const mode of MODES)
      for (const ms of samples(200))
        for (const { card } of cardsFor(mode)) {
          const f = frame(mode, card.id, ms);
          const hw = (f.w * f.scale) / 2,
            hh = (f.h * f.scale) / 2;
          for (const [x0, x1, y0, y1] of zones[mode]) {
            const ox = Math.min(f.x + hw, x1) - Math.max(f.x - hw, x0),
              oy = Math.min(f.y + hh, y1) - Math.max(f.y - hh, y0);
            expect(ox > 4 && oy > 4, `${mode} ${card.id} @${ms}`).toBe(false);
          }
          expect(f.x - hw).toBeGreaterThan(mode === "d" ? 27 : 0);
          expect(f.x + hw).toBeLessThan(mode === "d" ? 1413 : STAGE.m.w);
        }
  });

  it("Scene A: the questions emerge from behind the student, one after another", () => {
    const list = cardsFor("d");
    for (const { card, idx } of list) {
      const a0 = V54_TIMING.emerge + idx * V54_TIMING.emergeStagger;
      const f = frame("d", card.id, a0 + 60);
      expect(f.front, card.id).toBe(false);
      expect(f.opacity).toBeLessThan(0.1);
    }
    expect(V54_EMERGED).toBeLessThan(V54_TIMING.keyframe);
  });
});

describe("NW-V5.4 — story states, clarity and scroll", () => {
  it("states run intro → questions-emerge → thoughts-in-motion → clarity-transition → scroll-story, and back on reverse scroll", () => {
    expect(V54_STATES).toEqual(["intro", "questions-emerge", "thoughts-in-motion", "clarity-transition", "scroll-story"]);
    expect(stateFor(1000, 0, 0)).toBe("intro");
    expect(stateFor(INTRO.photo[0] + 50, 0, 0)).toBe("questions-emerge");
    expect(stateFor(V54_EMERGED + 1, 0, 0)).toBe("thoughts-in-motion");
    const mid = (V54_CLARITY_SPAN[0] + V54_CLARITY_SPAN[1]) / 2;
    expect(stateFor(20000, mid, clarityProgress(mid))).toBe("clarity-transition");
    expect(stateFor(20000, V54_CLARITY_SPAN[1], 1)).toBe("scroll-story");
    expect(stateFor(20000, 0, 0)).toBe("thoughts-in-motion");
    const nudge = V54_CLARITY_SPAN[0] * 0.5;
    expect(stateFor(20000, nudge, clarityProgress(nudge))).toBe("thoughts-in-motion");
  });

  it("clarity completes before the N wipe into Two Pathways, inside the hero's own scroll hold", () => {
    expect(clarityProgress(V54_CLARITY_SPAN[1])).toBe(1);
    expect(mapScroll(V54_CLARITY_SPAN[1]).t).toBeLessThanOrEqual(0.11);
    expect(V54_CLARITY_SPAN[1]).toBeLessThan(HOLD[0] + TRANS);
    for (const t of [0, 0.5, 1, 3.2, 6]) expect(mapScroll(scrollFromT(t)).t).toBeCloseTo(t, 6);
  });

  it("after clarity every question sits crisp in its pathway column, inside the stage, whatever moment scrolling began", () => {
    for (const mode of MODES)
      for (const ms of [12000, 19500, 33333])
        for (const { card, slot } of cardsFor(mode)) {
          const f = frame(mode, card.id, ms, V54_CLARITY_SPAN[1]);
          const col = V54_COLUMNS[mode][card.pathway];
          expect(f.x).toBeCloseTo(col.x, 6);
          expect(f.y).toBeCloseTo(col.y + slot * col.gap, 6);
          expect([f.resolved, f.blur, f.focus]).toEqual([1, 0, 0]);
          expect(f.x - f.w / 2).toBeGreaterThanOrEqual(0);
          expect(f.x + f.w / 2).toBeLessThanOrEqual(STAGE[mode].w);
        }
  });

  it("while the questions organise, no card in front of the student crosses his face (desktop; on phones the columns sit over the veiled portrait by design)", () => {
    for (const mode of ["d"] as const)
      for (const ms of samples(1700, 60000))
        for (let k = 0; k <= 30; k++) {
          const s = V54_CLARITY_SPAN[0] + ((V54_CLARITY_SPAN[1] - V54_CLARITY_SPAN[0]) * k) / 30;
          for (const { card } of cardsFor(mode)) {
            const f = frame(mode, card.id, ms, s);
            if (f.front) expect(faceShare(mode, f), `${mode} ${card.id} @${ms} k${k}`).toBeLessThan(0.06);
          }
        }
  });
});

describe("NW-V5.4 — reduced motion", () => {
  it("cards hold the reference keyframe: no paths, no emergence sweep, no parallax", () => {
    const { card, idx, slot } = entry("d", "university");
    const a = cardFrame({ mode: "d", card, idx, slot, ms: 9000, s: 0, reduced: true, pointer: { x: 1, y: 1 } });
    const b = cardFrame({ mode: "d", card, idx, slot, ms: 90000, s: 0, reduced: true });
    expect(a).toEqual(b);
    expect(stateFor(9000, 0, 0, true)).toBe("thoughts-in-motion");
  });

  it("clarity is a cross-fade between two fixed places, never a sweep", () => {
    const { card, idx, slot } = entry("d", "university");
    const span = V54_CLARITY_SPAN[1] - V54_CLARITY_SPAN[0];
    const at = (f: number) => cardFrame({ mode: "d", card, idx, slot, ms: 9000, s: V54_CLARITY_SPAN[0] + span * f, reduced: true });
    const p0 = cardFrame({ mode: "d", card, idx, slot, ms: 9000, s: 0, reduced: true });
    const col = V54_COLUMNS.d.abroad;
    for (const f of [0.1, 0.3]) expect([at(f).x, at(f).y]).toEqual([p0.x, p0.y]);
    for (const f of [0.7, 1]) expect([at(f).x, at(f).y]).toEqual([col.x, col.y + slot * col.gap]);
  });

  it("CSS, controller and tour all honour prefers-reduced-motion; parallax is desktop, fine-pointer and motion-allowed only", () => {
    expect(read(CSS)).toContain("@media (prefers-reduced-motion: reduce)");
    expect(read(ORBIT)).toContain('matchMedia("(prefers-reduced-motion: reduce)")');
    expect(read(ORBIT)).toMatch(/ptrOn = mode === "d" && fine\.matches && !options\.capture/);
    expect(read(ORBIT)).toMatch(/const pointer = ptrOn && !reduced/);
    // the tour goes through the chapter controller, which jumps instead of animating under reduced motion
    expect(read("src/lib/home/v54/chapters.ts")).toContain('matchMedia("(prefers-reduced-motion: reduce)")');
    expect(read("src/lib/home/v54/chapters.ts")).toMatch(/if \(how === "instant" \|\| mql\.matches \|\| plan\.durationMs === 0\)/);
  });
});
