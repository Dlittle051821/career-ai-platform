import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EIO, HOLD, LAST, TOTAL, TRANS, clamp, mapScroll, sceneStart } from "@/lib/home/v4/engine";
import { wipeRadius } from "./backdrop";
import { V54_CHAPTERS, V54_SCROLL, V54_SPANS, WheelIntent, chapterAt, chapterToward, planChapter, wheelPx } from "./chapters";
import { V54_ACCOUNT, V54_NAV } from "./config";
import { V54_CLARITY_SPAN } from "./motion";
import { stageFill, stageGeometry, stageModeFor } from "./stage";

const ROOT = path.resolve(import.meta.dirname, "../../../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");
const CSS = "src/components/sections/home/v54/v54.css";
const HOME = "src/components/sections/home/v54/NextwiseV54Home.tsx";
const HERO = "src/components/sections/home/v54/NextwiseV54Hero.tsx";

describe("NW-V5.4 — the approved N animation is preserved", () => {
  it("the engine fork is the V4 engine plus exactly the documented V5.4 edits (stage rule, delegated navigation, import path, header)", () => {
    const v4 = read("src/lib/home/v4/engine.ts");
    const edits: [string, string][] = [
      [
        "/**\n",
        "/**\n * NW-V5.4 FORK of src/lib/home/v4/engine.ts (the approved V4 engine, which is left\n * untouched). Exactly these things differ, each marked `V5.4:` below and checked by\n * src/lib/home/v54/v54.test.ts against the original: (1) the stage is chosen by\n * stageModeFor() (portrait tablets get the portrait stage); (2) scene links and\n * keyboard focus ask the chapter controller to navigate (options.navigate)\n * instead of scrolling by themselves; (3) this header and the images import path. N geometry, the intro,\n * every transition and every timing are byte-identical to V4.\n *\n",
      ],
      ['import { HERO_BLEED } from "./images";', 'import { stageModeFor } from "./stage"; // V5.4\nimport { HERO_BLEED } from "@/lib/home/v4/images"; // V5.4: path only'],
      [
        "export type V4EngineOptions = {\n",
        'export type V4EngineOptions = {\n  /** V5.4: scene links and keyboard focus delegate navigation to the chapter controller. */\n  navigate?: (scene: number, how: "smooth" | "instant") => void;\n',
      ],
      ['    mode = window.innerWidth < MOBILE_MAX_WIDTH ? "m" : "d";', "    mode = stageModeFor(window.innerWidth, sh); // V5.4: portrait tablets get the portrait stage"],
      [
        "      e.preventDefault();\n      introDone = true;\n      window.scrollTo(",
        '      e.preventDefault();\n      introDone = true;\n      if (options.navigate) return options.navigate(Number(a.dataset.go), reduced ? "instant" : "smooth"); // V5.4\n      window.scrollTo(',
      ],
      [
        '    introDone = true;\n    window.scrollTo({ top: scrollerTop + (sceneStart(j) + 0.02) * vh, behavior: "auto" });',
        '    introDone = true;\n    if (options.navigate) return options.navigate(j, "instant"); // V5.4\n    window.scrollTo({ top: scrollerTop + (sceneStart(j) + 0.02) * vh, behavior: "auto" });',
      ],
    ];
    let expected = v4;
    for (const [a, b] of edits) {
      expect(expected.includes(a), a.slice(0, 40)).toBe(true);
      expected = expected.replace(a, b);
    }
    expect(read("src/lib/home/v54/engine.ts")).toBe(expected);
  });

  it("the chapter controller only moves the scroll position — it never touches the N, a scene layer or the stage", () => {
    const ch = read("src/lib/home/v54/chapters.ts");
    expect(ch).not.toMatch(/data-nw4-n\b|\.style\.(transform|maskImage|filter|opacity)|data-nw4-stage/);
    expect(ch).toMatch(/window\.scrollTo\(\{ top: yOf\(s\), behavior: "instant" \}\)/);
    // the backdrop only reads the engine's layer styles and writes to its own panels
    const bd = read("src/lib/home/v54/backdrop.ts");
    expect(bd).toMatch(/new MutationObserver\(wake\)/);
    expect(bd).not.toMatch(/\bL\.style\.\w+\s*=/);
  });
});

describe("NW-V5.4 — chapters: one gesture, one complete chapter", () => {
  it("seven chapters, one per approved scene, in story order", () => {
    expect(V54_CHAPTERS.map((c) => c.id)).toEqual(["hero", "pathways", "career", "abroad", "studio", "trust", "conversion"]);
    expect(V54_CHAPTERS).toHaveLength(LAST + 1);
  });

  it("inside a chapter's span the story is completely at rest (the engine shows that scene, fully, with no transition)", () => {
    for (let k = 0; k <= LAST; k++) {
      const sp = V54_SPANS[k]!;
      expect(sp.lo).toBeLessThanOrEqual(sp.rest);
      expect(sp.rest).toBeLessThanOrEqual(sp.hi);
      for (let i = 0; i <= 20; i++) expect(mapScroll(sp.lo + ((sp.hi - sp.lo) * i) / 20).t).toBeCloseTo(k, 9);
      expect(mapScroll(sp.rest).t).toBe(k);
    }
    // the hero rests before the questions start to organise; the trust statement rests fully filled
    expect(V54_SPANS[0]!.hi).toBeLessThan(V54_CLARITY_SPAN[0]);
    const trust = V54_SPANS[5]!;
    const hp = (trust.rest - sceneStart(5)) / HOLD[5]!;
    expect(hp * 1.15).toBeGreaterThanOrEqual(1);
    expect(EIO(clamp(hp * 1.15))).toBeCloseTo(1, 9);
  });

  it("between two chapters lies exactly the approved transition, so stopping there is never a resting state", () => {
    for (let k = 0; k < LAST; k++) {
      const gapLo = V54_SPANS[k]!.hi,
        gapHi = V54_SPANS[k + 1]!.lo;
      expect(gapHi).toBeGreaterThan(gapLo);
      expect(chapterAt((gapLo + gapHi) / 2)).toBeNull();
    }
    expect(V54_SPANS[LAST]!.hi).toBeCloseTo(TOTAL, 6);
  });

  it("a forward step plays only the transition: jump to the end of the still span, play to the start of the next, settle", () => {
    for (let k = 0; k < LAST; k++) {
      const p = planChapter(V54_SPANS[k]!.rest, k + 1);
      expect(p.start).toBe(V54_SPANS[k]!.hi);
      expect(p.end).toBe(V54_SPANS[k + 1]!.lo);
      expect(p.rest).toBe(V54_SPANS[k + 1]!.rest);
      expect(p.durationMs).toBeGreaterThanOrEqual(V54_SCROLL.minMs);
      expect(p.durationMs).toBeLessThanOrEqual(V54_SCROLL.maxMs);
    }
    // one N transition (0.95 viewport heights) plays in ≈ 1.15 s — no several hundred pixels of extra scrolling
    expect(planChapter(V54_SPANS[2]!.rest, 3).durationMs).toBeCloseTo(1150, -1);
  });

  it("a backward step plays the same transition in reverse and settles on the previous chapter", () => {
    for (let k = LAST; k > 0; k--) {
      const p = planChapter(V54_SPANS[k]!.rest, k - 1);
      expect(p.start).toBe(V54_SPANS[k]!.lo);
      expect(p.end).toBe(V54_SPANS[k - 1]!.hi);
      expect(p.rest).toBe(V54_SPANS[k - 1]!.rest);
    }
  });

  it("from anywhere between chapters, the nearest chapter in the direction of travel is found", () => {
    const mid = (sceneStart(3) + (HOLD[3] ?? 0) + sceneStart(4)) / 2;
    expect(chapterToward(mid, 1)).toBe(4);
    expect(chapterToward(mid, -1)).toBe(3);
    expect(chapterToward(-1, 1)).toBe(0);
    expect(chapterToward(TOTAL + 5, -1)).toBe(LAST);
  });
});

describe("NW-V5.4 — gesture detection (wheel / trackpad)", () => {
  const run = (events: [number, number][]) => {
    const w = new WheelIntent();
    return events.map(([t, d]) => w.feed(t, d)).filter((x) => x !== 0);
  };
  const swipe = (t0: number, dir = 1, n = 80) => {
    const finger = [2, 4, 7, 11, 16, 22, 28, 33, 36, 38, 38, 36, 34, 31];
    const tail = Array.from({ length: n }, (_, i) => 31 * 0.93 ** (i + 1)).filter((d) => d >= 0.5);
    return [...finger, ...tail].map((d, i) => [t0 + i * 16, dir * d] as [number, number]);
  };

  it("one mouse-wheel notch is one intent", () => expect(run([[0, 100]])).toEqual([1]));
  it("a wheel spun several notches quickly is one gesture", () => expect(run(Array.from({ length: 8 }, (_, i) => [i * 40, 100] as [number, number]))).toEqual([1]));
  it("a trackpad swipe with a long inertia tail (≈ 80 events) is one gesture", () => expect(run(swipe(0))).toEqual([1]));
  it("tiny accidental deltas (< 30 px in total) are not intent", () => expect(run([[0, 4], [16, 6], [32, 5], [48, 3]])).toEqual([]));
  it("two swipes separated by a pause are two gestures", () => expect(run([...swipe(0, 1, 20), ...swipe(1200, 1, 20)])).toEqual([1, 1]));
  it("a fresh swipe that interrupts a decaying inertia tail is recognised as a new gesture", () => {
    const first = swipe(0, 1, 30); // decaying tail
    const t = first[first.length - 1]![0] + 16;
    const fresh: [number, number][] = [30, 45, 60].map((d, i) => [t + i * 16, d]);
    expect(run([...first, ...fresh])).toEqual([1, 1]);
  });
  it("reversing direction is a new gesture", () => expect(run([[0, 100], [40, -100]])).toEqual([1, -1]));
  it("line and page wheel modes are normalised to pixels", () => {
    expect(wheelPx({ deltaY: 3, deltaMode: 1 }, 900)).toBe(48);
    expect(wheelPx({ deltaY: 1, deltaMode: 2 }, 900)).toBe(900);
    expect(wheelPx({ deltaY: 53, deltaMode: 0 }, 900)).toBe(53);
  });

  it("the controller leaves zoom, horizontal scrolling, form fields, scrollable panels and the footer to the browser", () => {
    const ch = read("src/lib/home/v54/chapters.ts");
    expect(ch).toMatch(/if \(e\.defaultPrevented \|\| e\.ctrlKey \|\| !enabled\(\)\) return;/);
    expect(ch).toMatch(/Math\.abs\(e\.deltaX\) > Math\.abs\(dy\)/);
    expect(ch).toMatch(/if \(wantsNativeScroll\(e\.target, root, dy\)\) return;/);
    expect(ch).toMatch(/const EDITABLE = "input, textarea, select/);
    expect(ch).toMatch(/if \(!inStory\(s\)\) return;/);
    // wheel/touch input during a transition is consumed, never queued into extra skips
    expect(ch).toMatch(/if \(moving && source === "wheel"\) return;/);
    // touch is never prevented: phones scroll natively and a released swipe is completed afterwards
    expect(ch).toMatch(/addEventListener\("touchstart", onTouchStart, \{ passive: true \}\)/);
    expect(ch).not.toMatch(/touchmove/);
  });
});

describe("NW-V5.4 — full-bleed responsive layout", () => {
  it("the stage rule: phones and portrait tablets get the portrait composition; landscape screens the desktop one", () => {
    const cases: [number, number, "d" | "m"][] = [
      [360, 800, "m"],
      [390, 844, "m"],
      [768, 1024, "m"],
      [834, 1194, "m"],
      [1024, 768, "d"],
      [1366, 768, "d"],
      [1440, 900, "d"],
      [1920, 1080, "d"],
      [2560, 1440, "d"],
      [3440, 1440, "d"],
      [3840, 2160, "d"],
    ];
    for (const [w, h, m] of cases) expect(stageModeFor(w, h), `${w}×${h}`).toBe(m);
    expect(stageFill("m", 768, 1024)).toBeGreaterThan(stageFill("d", 768, 1024));
  });

  it("the stage is centred; spare height is split above and below, and the torso continues through the band below", () => {
    for (const [w, h] of [
      [1024, 768],
      [3440, 1440],
      [390, 844],
      [768, 1024],
    ] as const) {
      const g = stageGeometry(w, h);
      expect(g.oy * 2 + g.H * g.sc).toBeCloseTo(h, 6);
      expect(g.ox * 2 + g.W * g.sc).toBeCloseTo(w, 6);
      expect(g.oy).toBeGreaterThanOrEqual(-1e-9);
    }
  });

  it("the backdrop's wipe circle matches the stage's exactly until the stage is covered, then reaches the viewport corners", () => {
    const g = stageGeometry(3440, 1440);
    const x = 900,
      y = 200;
    const inside = wipeRadius(g, x, y, 400, 0);
    expect(inside.full).toBe(false);
    expect(inside.r).toBeCloseTo(400 * g.sc, 6);
    expect(inside.cx).toBeCloseTo(g.ox + x * g.sc, 6);
    const rFull = Math.hypot(Math.max(x, g.W - x), Math.max(y, g.H - y)) * 1.02;
    const done = wipeRadius(g, x, y, rFull, 1);
    expect(done.full).toBe(true);
    expect(done.r).toBeGreaterThanOrEqual(Math.hypot(Math.max(done.cx, g.vw - done.cx), Math.max(done.cy, g.vh - done.cy)));
    expect(wipeRadius(g, x, y, rFull, 0).r).toBeCloseTo(rFull * g.sc, 6);
  });

  it("no page frame: no rounded clip, no outer glow, no fixed mockup canvas; the hero and stage are transparent over the backdrop", () => {
    const css = read(CSS);
    expect(css).not.toMatch(/v54-frame|clip-path:inset\([^)]*round/);
    expect(css).not.toMatch(/0 0 16px 3px rgba\(0,119,182,\.30\)/);
    expect(css).toMatch(/\.nw4\.nw54 \.nw4-stage\{background:transparent;overflow:visible;clip-path:inset\(1px\)\}/);
    expect(css).toMatch(/:not\(\[data-v54-state="scroll-story"\]\) \.nw4-stage\{clip-path:inset\(1px 1px calc\(-1 \* var\(--v54-band,0px\)\) 1px\)\}/);
    expect(css).toMatch(/\.nw4\.nw54 \.L0\{background:transparent/);
    expect(css).toMatch(/\.nw4\.nw54 \.nw4-sticky\{background:#FFFFFF\}/);
    expect(css).toMatch(/height:calc\(32px \+ var\(--v54-band,0px\)\)/);
    expect(read("src/lib/home/v54/backdrop.ts")).toMatch(/root\.style\.setProperty\("--v54-band"/);
    expect(read(HERO)).not.toMatch(/v54-frame/);
  });

  it("every scene has an edge-to-edge panel whose colours are the scene's own", () => {
    const css = read(CSS);
    const home = read(HOME);
    expect(home).toMatch(/data-v54-backdrop=""/);
    expect(home).toMatch(/\[0, 1, 2, 3, 4, 5, 6\]\.map/);
    const layer = (k: number) => css.match(new RegExp(`\\.nw4\\.nw54 \\.L${k}\\{background:([^;]*);`))![1]!;
    const panel = (k: number) => css.match(new RegExp(`\\.nw4\\.nw54 \\.v54-p${k}\\{background:([^}]*)\\}`))![1]!;
    for (let k = 1; k <= 6; k++) {
      const colours = layer(k).match(/#[0-9A-F]{6}/gi)!;
      for (const c of colours) expect(panel(k).toUpperCase(), `L${k} ${c}`).toContain(c.toUpperCase());
    }
    // the Future Horizon lives in the hero's panel, edge to edge — not inside the stage
    expect(home).toMatch(/\{j === 0 \? <HorizonScene \/> : null\}/);
    expect(read(HERO)).not.toMatch(/<HorizonScene \/>/);
  });

  it("before the engine runs, the story already has its full height (a refresh restores the exact position)", () => {
    expect(read(CSS)).toContain(`.nw4.nw54 .nw4-scroller{height:${Math.round((TOTAL + 1) * 100)}vh;height:${Math.round((TOTAL + 1) * 100)}svh}`);
    expect(TOTAL).toBeCloseTo(HOLD.reduce((a, b) => a + b, 0) + TRANS * LAST, 9);
  });

  it("the torso continues to the bottom edge from the approved portrait's own pixels (no new imagery)", () => {
    expect(read(HERO)).toMatch(/<span className="v54-portrait-base" aria-hidden="true" \/>/);
    expect(read(CSS)).toMatch(/background:url\(\/home-v54\/v54-portrait-base\.png\) 0 0\/100% 100% no-repeat/);
    expect(existsSync(path.join(ROOT, "public/home-v54/v54-portrait-base.png"))).toBe(true);
    const png = readFileSync(path.join(ROOT, "public/home-v54/v54-portrait-base.png"));
    expect(png.readUInt32BE(16)).toBe(1860); // same width as the approved portrait
    expect(png.readUInt32BE(20)).toBe(1); // one row
  });
});

describe("NW-V5.4 — navigation and account actions", () => {
  it("the four navigation items are Electric Coral pills on hover / focus, with no layout shift (hover never changes size or spacing)", () => {
    const css = read(CSS);
    expect(V54_NAV.map((n) => n.label)).toEqual(["Explore", "How it works", "Study Abroad", "Pricing"]);
    expect(css).toMatch(/\.v54-pill:hover::before,\.nw4\.nw54 \.v54-pill:focus-visible::before\{opacity:1;transform:scale\(1\)/);
    const interactive = css
      .split("}")
      .filter((r) => /\.v54-(pill|login|signup)[^{]*:(hover|focus-visible|active)/.test(r.split("{")[0]!))
      .map((r) => r.split("{")[1] ?? "");
    expect(interactive.length).toBeGreaterThan(4);
    for (const body of interactive) expect(body).not.toMatch(/(^|;)\s*(padding|margin|width|height|font-size|font-weight|border-width|gap)\s*:/);
    // transitions ≈ 180–250 ms, no bounce
    expect(css).toMatch(/transition:opacity \.2s cubic-bezier\(\.2,\.8,\.2,1\),transform \.22s/);
    // touch devices: no sticky hover pill
    expect(css).toMatch(/@media \(hover:none\)\{\.nw4\.nw54 \.v54-pill:hover::before\{opacity:0/);
    // current page is shown by weight and a marker, not colour alone
    expect(css).toMatch(/\.v54-pill\[aria-current="page"\]\{font-weight:700/);
  });

  it("Sign up and Log in use the existing registration and authentication routes; Get started free stays the hero action", () => {
    expect(V54_ACCOUNT).toEqual({
      login: { label: "Log in", href: "/login" },
      signup: { label: "Sign up", href: "/register" },
      start: { label: "Get started free", href: "/register" },
    });
    for (const href of [...V54_NAV.map((n) => n.href), V54_ACCOUNT.login.href, V54_ACCOUNT.signup.href])
      expect(existsSync(path.join(ROOT, "src/app/(site)", href, "page.tsx")), href).toBe(true);
  });

  it("signed-in visitors get their own workspace link from the existing, read-only auth state (no auth logic added)", () => {
    const acc = read("src/components/sections/home/v54/V54Account.tsx");
    expect(acc).toMatch(/import \{ useAuthProfile \} from "@\/lib\/supabase\/use-auth-profile";/);
    expect(acc).toMatch(/import \{ getAccountMenuLinks \} from "@\/lib\/navigation\/account-menu";/);
    expect(acc).not.toMatch(/signIn|signUp|signOut|createClient|supabase\.auth|from\("profiles"\)/);
  });

  it("phones and portrait tablets: a menu button with the same links, Log in and Sign up; Escape closes and restores focus", () => {
    const acc = read("src/components/sections/home/v54/V54Account.tsx");
    expect(acc).toMatch(/aria-expanded=\{open\}/);
    expect(acc).toMatch(/aria-controls=\{panelId\}/);
    expect(acc).toMatch(/if \(e\.key === "Escape"\) \{\s*setOpen\(false\);\s*btn\.current\?\.focus\(\);/);
    // the chapter controller pauses while the menu is open
    expect(acc).toMatch(/root\?\.setAttribute\("data-v54-menu-open", ""\)/);
    expect(read("src/lib/home/v54/chapters.ts")).toMatch(/const enabled = \(\) => !root\.hasAttribute\("data-v54-menu-open"\);/);
    expect(read(CSS)).toMatch(/\.nw4\.nw54 \.v54-menu nav a\{display:flex;align-items:center;min-height:48px/);
  });
});
