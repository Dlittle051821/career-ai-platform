/**
 * NW-V5.4 FORK of src/lib/home/v4/engine.ts (the approved V4 engine, which is left
 * untouched). Exactly these things differ, each marked `V5.4:` below and checked by
 * src/lib/home/v54/v54.test.ts against the original: (1) the stage is chosen by
 * stageModeFor() (portrait tablets get the portrait stage); (2) scene links and
 * keyboard focus ask the chapter controller to navigate (options.navigate)
 * instead of scrolling by themselves; (3) this header and the images import path. N geometry, the intro,
 * every transition and every timing are byte-identical to V4.
 *
 * NW-V4 "Connected Experience" — the stage engine.
 *
 * A faithful port of the approved V4 prototype's choreography. Every timing,
 * easing curve, position and transition rule below is carried over
 * unchanged; only the plumbing differs:
 *   - DOM lookups are scoped to the homepage root (no global ids);
 *   - the scroll position is measured relative to the story's scroller, so
 *     the site header/footer around it never shift the timeline;
 *   - the stage scales against the visible viewport (clientWidth, 100svh)
 *     instead of innerWidth/innerHeight, so desktop scrollbars and mobile
 *     browser toolbars never crop or rescale it mid-scroll;
 *   - the site header's intro fade is driven through a CSS variable on
 *     <html> (the prototype faded its own in-stage nav capsule);
 *   - frames are only drawn while something is actually moving.
 *
 * Framework-free on purpose: the React component renders the markup and
 * calls startV4Engine() once; cleanup restores every global it touched.
 */

import { stageModeFor } from "./stage"; // V5.4
import { HERO_BLEED } from "@/lib/home/v4/images"; // V5.4: path only

export type V4Mode = "d" | "m";
export type V4Point = { x: number; y: number };
export type V4NPos = V4Point & { s: number };

export const STAGE = { d: { w: 1440, h: 900 }, m: { w: 390, h: 844 } } as const;
export const MOBILE_MAX_WIDTH = 700;
export const LAST = 6;

/** Hold (scene at rest) and transition lengths, in viewport heights. */
export const HOLD = [0.55, 0.55, 0.75, 0.85, 0.75, 1.1, 0.6] as const;
export const TRANS = 0.95;
export const TOTAL = HOLD.reduce((a, b) => a + b, 0) + TRANS * LAST;

/** Transition type per incoming scene: 'wipe' grows from the N's arrow tip; 'rise' lifts a curved sheet. */
export const TR = [null, "wipe", "wipe", "wipe", "rise", "rise", "wipe"] as const;

/** The N: top-left of its 512 box in stage px, s = scale. Arrow tip = (452,108) in icon space. */
export const NPOS: Record<V4Mode, { form: V4NPos; rest: readonly V4NPos[] }> = {
  d: {
    form: { x: 515, y: 245, s: 0.8 },
    rest: [
      { x: 60, y: 150, s: 0.3 },
      { x: 663, y: 126, s: 0.22 },
      { x: 63, y: 150, s: 0.13 },
      { x: 843, y: 150, s: 0.13 },
      { x: 687, y: 122, s: 0.13 },
      { x: 687, y: 146, s: 0.13 },
      { x: 643, y: 168, s: 0.3 },
    ],
  },
  m: {
    form: { x: 67, y: 252, s: 0.5 },
    rest: [
      { x: 16, y: 380, s: 0.17 },
      { x: 154, y: 72, s: 0.16 },
      { x: 6, y: 84, s: 0.09 },
      { x: 6, y: 84, s: 0.09 },
      { x: 172, y: 62, s: 0.09 },
      { x: 172, y: 74, s: 0.09 },
      { x: 146, y: 200, s: 0.19 },
    ],
  },
};

/** Intro timeline (ms). */
export const INTRO = {
  draw: [650, 2350],
  ident: [1900, 2700],
  glide: [3000, 4150],
  sheen: [2150, 3050],
  photo: [3150, 4700],
  photoScale: [3150, 6200],
  nav: [3500, 4400],
  holdScroll: 4200,
  fastForwardUntil: 5200,
  done: 6400,
} as const;

export const INTRO_STORAGE_KEY = "nw4-intro";
export const NAV_VAR = "--nw4-nav";
export const HX_VAR = "--nw4-hx";
export const HY_VAR = "--nw4-hy";
export const HZ_VAR = "--nw4-hz";

export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
export const win = (p: number, a: number, b: number) => clamp((p - a) / (b - a));

/** CSS cubic-bezier(x1,y1,x2,y2) as a function of x (bisection, as in the prototype). */
export function bez(x1: number, y1: number, x2: number, y2: number) {
  return (t: number) => {
    let lo = 0,
      hi = 1,
      u = t;
    for (let i = 0; i < 22; i++) {
      u = (lo + hi) / 2;
      const x = 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u * u * u;
      if (x < t) lo = u;
      else hi = u;
    }
    return 3 * (1 - u) * (1 - u) * u * y1 + 3 * (1 - u) * u * u * y2 + u * u * u;
  };
}
export const EOUT = bez(0.22, 1, 0.36, 1);
export const EIO = bez(0.65, 0, 0.35, 1);
export const EIN = bez(0.55, 0, 0.75, 0.2);

/** Scroll map: hold → transition → hold … (input and hp in viewport heights / hold progress). */
export function mapScroll(s: number): { t: number; hp: number } {
  for (let k = 0; k <= LAST; k++) {
    const hold = HOLD[k] ?? 0;
    if (s < hold) return { t: k, hp: s / hold };
    s -= hold;
    if (k < LAST) {
      if (s < TRANS) return { t: k + s / TRANS, hp: 0 };
      s -= TRANS;
    }
  }
  return { t: LAST, hp: 1 };
}

export function sceneStart(k: number): number {
  let s = 0;
  for (let j = 0; j < k; j++) s += (HOLD[j] ?? 0) + TRANS;
  return s;
}

export const ctr = (n: V4NPos): V4Point => ({ x: n.x + 256 * n.s, y: n.y + 256 * n.s });

/** Anchors near the top: the path dips through the content instead of grazing the nav. */
export function arcPoint(a: V4Point, b: V4Point, q: number, lift: number, H: number): V4Point {
  const cx = (a.x + b.x) / 2;
  const cy = Math.min(a.y, b.y) < H * 0.34 ? Math.max(a.y, b.y) + lift : Math.min(a.y, b.y) - lift;
  const u = 1 - q;
  return { x: u * u * a.x + 2 * u * q * cx + q * q * b.x, y: u * u * a.y + 2 * u * q * cy + q * q * b.y };
}

export type V4Guide = { cx: number; cy: number; s: number; r: number; lift: number };

export function guideN(mode: V4Mode, k: number, q: number): V4Guide {
  const P = NPOS[mode];
  const A = P.rest[k] ?? P.rest[0]!;
  const B = P.rest[k + 1] ?? A;
  const H = STAGE[mode].h;
  const e = EIO(win(q, 0.04, 0.92));
  const pa = ctr(A),
    pb = ctr(B);
  const dist = Math.hypot(pb.x - pa.x, pb.y - pa.y);
  const lift = (mode === "d" ? 150 : 80) * clamp(dist / 500, 0.35, 1);
  const c = arcPoint(pa, pb, e, lift, H);
  const s = lerp(A.s, B.s, e) * (1 + 0.18 * Math.sin(Math.PI * e));
  const dir = Math.sign(pb.x - pa.x) || 1;
  const r = -8 * dir * Math.sin(Math.PI * e) * clamp(dist / 300);
  return { cx: c.x, cy: c.y, s, r, lift: Math.sin(Math.PI * e) };
}

export function rotTip(g: V4Guide): V4Point {
  const dx = (452 - 256) * g.s,
    dy = (108 - 256) * g.s,
    a = (g.r * Math.PI) / 180;
  return { x: g.cx + dx * Math.cos(a) - dy * Math.sin(a), y: g.cy + dx * Math.sin(a) + dy * Math.cos(a) };
}

type SwitchState = { cur: string; prev: string | null; p: number };
type Item = { el: HTMLElement; sec: number; i: number; intro: number | null; lines: HTMLElement[] };
export type V4FrameOptions = { hp?: number; reduced?: boolean } & Partial<Record<"career" | "country" | "studio", [string, string | null, number]>>;

export type V4EngineOptions = {
  /** V5.4: scene links and keyboard focus delegate navigation to the chapter controller. */
  navigate?: (scene: number, how: "smooth" | "instant") => void;
  /** Enables window.__nw4Frame(introMs, sceneT, opts) for deterministic QA capture. */
  capture?: boolean;
};

export function startV4Engine(root: HTMLElement, options: V4EngineOptions = {}): () => void {
  const q = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel);
  const qa = <T extends Element = HTMLElement>(sel: string) => Array.from(root.querySelectorAll<T>(sel));
  const need = <T extends Element>(el: T | null, name: string): T => {
    if (!el) throw new Error(`NW-V4: missing ${name}`);
    return el;
  };

  const doc = document.documentElement;
  const scroller = need(q<HTMLElement>("[data-nw4-scroller]"), "scroller");
  const sticky = need(q<HTMLElement>("[data-nw4-sticky]"), "sticky");
  const stage = need(q<HTMLElement>("[data-nw4-stage]"), "stage");
  const nmark = need(q<HTMLElement>("[data-nw4-n]"), "N");
  const nmPath = need(q<SVGPathElement>("[data-nw4-n-path]"), "N path");
  const nmFull = need(q<SVGRectElement>("[data-nw4-n-full]"), "N fill");
  const feb = need(q<SVGFEGaussianBlurElement>("[data-nw4-n-blur]"), "N blur");
  const sheen = need(q<SVGRectElement>("[data-nw4-n-sheen]"), "N sheen");
  const glow = need(q<HTMLElement>("[data-nw4-glow]"), "glow");
  const heroPhoto = need(q<HTMLElement>("[data-nw4-hero-photo]"), "hero photo");
  const heroPhotoInner = need(heroPhoto.firstElementChild as HTMLElement | null, "hero photo inner");
  // optional: the hero scene continued beyond the stage (behind it), so letterbox bands show sky, not black
  const bleed = q<HTMLElement>("[data-nw4-bleed]");
  const bleedPhoto = q<HTMLElement>("[data-nw4-bleed-photo]");
  const layers = qa(".nw4-layer");
  const items: Item[] = qa("[data-sec]").map((el) => ({
    el,
    sec: Number(el.dataset.sec),
    i: Number(el.dataset.i ?? 0),
    intro: el.dataset.intro ? Number(el.dataset.intro) : null,
    lines: Array.from(el.querySelectorAll<HTMLElement>(".ln>span")),
  }));
  const heroLines = qa("[data-line]");
  const words = qa("[data-nw4-word]");
  const swGroups = ["career", "country", "studio"] as const;
  const swPanels = Object.fromEntries(swGroups.map((g) => [g, qa(`[data-pn="${g}"]`)])) as Record<(typeof swGroups)[number], HTMLElement[]>;
  const swButtons = Object.fromEntries(swGroups.map((g) => [g, qa(`[data-sw="${g}"]`)])) as Record<(typeof swGroups)[number], HTMLElement[]>;
  const sideItems = qa("[data-side]");

  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = mql.matches;
  let mode: V4Mode = "d";
  let W: number = STAGE.d.w;
  let H: number = STAGE.d.h;
  let vh = window.innerHeight;
  let scrollerTop = 0;
  let lastLayoutW = -1;
  let stageSc = 1,
    stageOx = 0,
    stageOy = 0;
  let lastLayoutH = -1;

  const SW: Record<(typeof swGroups)[number], SwitchState> = {
    career: { cur: "overview", prev: null, p: 1 },
    country: { cur: "de", prev: null, p: 1 },
    studio: { cur: "career", prev: null, p: 1 },
  };

  let sS = 0,
    tS = 0,
    hpS = 0,
    introMs = 0,
    introDone = false,
    introStart = performance.now(),
    frozen = false,
    running = true,
    raf = 0,
    started = false,
    dirty = true,
    nGlow = 0;
  try {
    if (!options.capture && window.sessionStorage.getItem(INTRO_STORAGE_KEY)) introDone = true;
  } catch {
    /* storage unavailable (privacy mode) — play the intro */
  }

  const setNav = (p: number) => {
    const v = p >= 0.999 ? "" : p.toFixed(3);
    if (doc.style.getPropertyValue(NAV_VAR) !== v) {
      if (v) doc.style.setProperty(NAV_VAR, v);
      else doc.style.removeProperty(NAV_VAR);
    }
  };

  function setSw(g: (typeof swGroups)[number], k: string) {
    const s = SW[g];
    if (s.cur === k) return;
    s.prev = s.cur;
    s.cur = k;
    s.p = reduced ? 1 : 0;
    wake();
  }

  function drawSw() {
    for (const g of swGroups) {
      const s = SW[g],
        e = EOUT(s.p);
      for (const el of swPanels[g]) {
        const isImg = !!el.dataset.img;
        const key = el.dataset.key;
        let o = 0,
          ty = 0,
          sc = 1;
        if (key === s.cur) {
          o = isImg ? 1 : e;
          ty = isImg ? 0 : (1 - e) * 10;
          sc = isImg ? lerp(1.06, 1, e) : 1;
        } else if (key === s.prev && s.p < 1) {
          o = isImg ? 1 : clamp(1 - s.p * 2.2);
          ty = isImg ? 0 : -s.p * 6;
        }
        if (isImg) {
          el.style.zIndex = key === s.cur ? "2" : key === s.prev ? "1" : "0";
          el.style.opacity = String(key === s.cur ? e : key === s.prev ? 1 : 0);
          (el.firstElementChild as HTMLElement | null)?.style.setProperty("transform", `scale(${sc})`);
        } else {
          el.style.opacity = String(o);
          el.style.transform = `translateY(${ty}px)`;
          // "" (inherit), never "visible": a panel must not override a hidden scene and catch clicks through it
          el.style.visibility = o <= 0.001 ? "hidden" : "";
          el.style.pointerEvents = key === s.cur ? "" : "none";
        }
      }
      for (const b of swButtons[g]) {
        const on = b.dataset.key === s.cur;
        b.setAttribute("aria-selected", String(on));
        b.tabIndex = on ? 0 : -1;
      }
      if (g === "studio") for (const x of sideItems) x.classList.toggle("on", x.dataset.side === s.cur);
    }
  }

  function placeN(cx: number, cy: number, s: number, r: number, lift: number, op = 1) {
    nmark.style.transform = `translate(${cx}px,${cy}px) rotate(${r}deg) scale(${s}) translate(-256px,-256px)`;
    nmark.style.opacity = String(op);
    const k = lift || 0,
      f: string[] = [];
    if (nGlow > 0.01) f.push(`drop-shadow(0 0 ${46 * nGlow}px rgba(74,125,178,${0.6 * nGlow}))`);
    if (k > 0.01) f.push(`drop-shadow(0 ${24 * k}px ${32 * k}px rgba(14,11,29,${0.28 * k}))`);
    nmark.style.filter = f.length ? f.join(" ") : "none";
  }

  function draw() {
    const P = NPOS[mode];
    /* Behaviour 1: formation — the N surfaces from its own ribbon (no line, no tracer) */
    const im = introDone ? 1e9 : introMs;
    const drawP = reduced ? 1 : EIO(win(im, INTRO.draw[0], INTRO.draw[1]));
    const ident = reduced ? 1 : EOUT(win(im, INTRO.ident[0], INTRO.ident[1]));
    const glide = reduced ? 1 : EIO(win(im, INTRO.glide[0], INTRO.glide[1]));
    nmPath.style.strokeDashoffset = String(1 - drawP);
    nmPath.style.opacity = drawP <= 0.002 ? "0" : "1";
    nmFull.setAttribute("opacity", String(ident));
    feb.setAttribute("stdDeviation", lerp(22, 6, drawP).toFixed(1));
    const sh = reduced ? 0 : win(im, INTRO.sheen[0], INTRO.sheen[1]);
    sheen.setAttribute("x", lerp(-260, 560, EIO(sh)).toFixed(1));
    sheen.setAttribute("opacity", String(sh > 0 && sh < 1 ? Math.sin(Math.PI * sh) * 0.9 : 0));
    nGlow = reduced ? 0 : EOUT(win(im, 500, 1800)) * (1 - EIO(win(im, 2700, 4200)));
    const gp = reduced ? 0 : EOUT(win(im, 200, 2000)) * (1 - 0.55 * EIO(win(im, 3000, 4600)));
    glow.style.opacity = String(gp * (tS < 1 ? 1 : 0));
    const fc = ctr(P.form),
      r0 = ctr(P.rest[0]!);
    const gc = { x: lerp(fc.x, r0.x + 120, glide), y: lerp(fc.y, r0.y + 60, glide) };
    glow.style.left = `${gc.x}px`;
    glow.style.top = `${gc.y}px`;
    glow.style.transform = `scale(${lerp(1, 0.7, glide)})`;
    const photoP = reduced ? 1 : EOUT(win(im, INTRO.photo[0], INTRO.photo[1]));
    heroPhoto.style.opacity = String(photoP);
    heroPhotoInner.style.transform = `scale(${lerp(1.1, 1, reduced ? 1 : EOUT(win(im, INTRO.photoScale[0], INTRO.photoScale[1])))})`;
    heroPhotoInner.style.filter = photoP < 1 && !reduced ? `blur(${(1 - photoP) * 14}px)` : "none";
    if (bleedPhoto) {
      const pk = lerp(1.1, 1, reduced ? 1 : EOUT(win(im, INTRO.photoScale[0], INTRO.photoScale[1])));
      bleedPhoto.style.transform = bleedTransform(pk);
      bleedPhoto.style.opacity = String(photoP);
      bleedPhoto.style.filter = heroPhotoInner.style.filter;
    }
    heroLines.forEach((l, i) => {
      const p = reduced ? 1 : EOUT(win(im, 3250 + i * 140, 4300 + i * 140));
      l.style.transform = `translateY(${(1 - p) * 125}%)`;
      l.style.opacity = p > 0.001 ? "1" : "0";
    });
    setNav(reduced ? 1 : EOUT(win(im, INTRO.nav[0], INTRO.nav[1])));

    /* scroll-driven */
    const t = tS,
      k = Math.min(LAST - 1, Math.floor(t)),
      qq = t - k,
      atRest = Math.abs(t - Math.round(t)) < 1e-4;
    if (t <= 0.0001) {
      const R = P.rest[0]!,
        fcc = ctr(P.form),
        rc = ctr(R);
      const c = arcPoint(fcc, rc, glide, mode === "d" ? 70 : 30, H);
      const s = lerp(P.form.s, R.s, glide) * (reduced ? 1 : lerp(1.05, 1, EOUT(win(im, 650, 2600))));
      placeN(c.x, c.y, s, 0, 0, reduced ? EOUT(win(im, 100, 700)) : 1);
    } else if (reduced) {
      const R = P.rest[Math.round(t)]!,
        c = ctr(R);
      placeN(c.x, c.y, R.s, 0, 0, atRest ? 1 : clamp(Math.abs(qq - 0.5) * 2.4));
    } else if (atRest) {
      /* Behaviour 3: rest — perfectly still */
      const R = P.rest[Math.round(t)]!,
        c = ctr(R);
      placeN(c.x, c.y, R.s, 0, 0);
    } else {
      /* Behaviour 2: guide */
      const g = guideN(mode, k, qq);
      placeN(g.cx, g.cy, g.s, g.r, g.lift);
    }

    layers.forEach((L, j) => {
      const covered = t >= j + 1 && j < LAST; // fully hidden under the next scene
      const pr = j === 0 ? 1 : t >= j ? 1 : t <= j - 1 ? 0 : t - (j - 1);
      let visible = !(pr <= 0 || covered);
      let mask = "",
        radius = "",
        opacity = "",
        tf = "translateZ(0)",
        flt = "none";
      if (j > 0 && pr > 0 && pr < 1) {
        if (reduced) {
          opacity = String(win(pr, 0.3, 0.7));
        } else if (TR[j] === "wipe") {
          const e = EIN(win(pr, 0.06, 0.86));
          const o = rotTip(guideN(mode, j - 1, pr));
          const R = Math.hypot(Math.max(o.x, W - o.x), Math.max(o.y, H - o.y)) * 1.02,
            rr = e * R;
          if (e <= 0) visible = false;
          mask = `radial-gradient(circle at ${o.x.toFixed(1)}px ${o.y.toFixed(1)}px, #000 ${rr.toFixed(1)}px, transparent ${(rr + 1.5).toFixed(1)}px)`;
        } else {
          const e = EIO(win(pr, 0.04, 0.9));
          tf = `translateY(${((1 - e) * H).toFixed(1)}px) translateZ(0)`;
          const ry = (1 - e) * (mode === "d" ? 220 : 120);
          radius = `50% 50% 0 0 / ${ry.toFixed(1)}px ${ry.toFixed(1)}px 0 0`;
        }
      }
      // outgoing scene recedes: slight scale, dim and defocus
      if (!reduced && j < LAST && t > j && t < j + 1) {
        const e = EIO(win(t - j, 0.1, 0.9));
        if (TR[j + 1] === "rise") tf = `scale(${1 - 0.04 * e}) translateZ(0)`;
        flt = `brightness(${1 - 0.32 * e}) blur(${(e * 5).toFixed(2)}px)`;
      }
      L.style.visibility = visible ? "visible" : "hidden";
      L.style.webkitMaskImage = mask;
      L.style.maskImage = mask;
      L.style.borderRadius = radius;
      L.style.opacity = opacity;
      L.style.transform = tf;
      L.style.filter = flt;
      L.style.zIndex = String(j);
      if (j === 0 && bleed) {
        // the bleed follows the hero scene: same recede filter (in screen px), gone once the next scene has covered the stage
        const away = t <= 0 ? 0 : t >= 1 ? 1 : reduced ? win(t, 0.3, 0.7) : EIN(win(t, 0.06, 0.86));
        bleed.style.opacity = String(1 - away);
        bleed.style.visibility = away >= 1 ? "hidden" : "visible";
        bleed.style.filter = flt === "none" ? "none" : flt.replace(/blur\(([\d.]+)px\)/, (_m, b: string) => `blur(${(Number(b) * stageSc).toFixed(2)}px)`);
      }
      // hidden scenes leave the accessibility tree and the tab order with their visibility
      const ah = L.hasAttribute("aria-hidden");
      if (visible && ah) L.removeAttribute("aria-hidden");
      else if (!visible && !ah) L.setAttribute("aria-hidden", "true");
    });

    // content: rises in after the transition passes; headings reveal line by line; outgoing drifts up
    for (const it of items) {
      let o = 1,
        ty = 0,
        lp = 1;
      if (it.sec > 0) {
        const st = TR[it.sec] === "rise" ? 0.32 : 0.44;
        const p = t >= it.sec ? 1 : t <= it.sec - 1 ? 0 : win(t - (it.sec - 1), st + it.i * 0.06, st + 0.42 + it.i * 0.04);
        const e = EOUT(p);
        if (reduced) {
          o = Math.round(t) >= it.sec ? 1 : t > it.sec - 1 ? win(t - (it.sec - 1), 0.3, 0.7) : 0;
          ty = 0;
        } else {
          o = it.lines.length ? 1 : e;
          ty = it.lines.length ? 0 : (1 - e) * 26;
          lp = e;
        }
      }
      if (it.sec < LAST && t > it.sec && !reduced) {
        const p = EIO(win(t - it.sec, 0, 0.8));
        ty -= p * 36 * (it.i * 0.25 + 0.6);
      }
      if (it.sec === 0 && it.intro !== null && !reduced) {
        const p = EOUT(win(im, it.intro, it.intro + 800));
        o *= p;
        ty += (1 - p) * 16;
      }
      it.el.style.opacity = String(o);
      it.el.style.transform = `translateY(${ty.toFixed(2)}px)`;
      if (it.lines.length && it.sec > 0)
        it.lines.forEach((l, i) => {
          const pp = reduced ? 1 : EOUT(clamp(lp * 1.25 - i * 0.18));
          l.style.transform = `translateY(${((1 - pp) * 120).toFixed(1)}%)`;
        });
    }

    // trust: the statement fills word by word as you read (hold progress)
    const fill = reduced ? 1 : t > 5.0001 ? 1 : atRest && Math.round(t) === 5 ? EIO(clamp(hpS * 1.15)) : 0;
    const n = words.length;
    words.forEach((w, i) => {
      const v = clamp((fill * (n + 3) - i) / 3);
      w.style.color = `rgba(224,225,221,${(0.2 + 0.8 * v).toFixed(3)})`;
    });
    drawSw();
  }

  /** Screen transform for a bleed child: stage coords → screen, with the hero photo's own zoom k about the stage centre. */
  function bleedTransform(k: number) {
    const B = HERO_BLEED[mode === "d" ? "desktop" : "mobile"];
    const cx = W / 2,
      cy = H / 2;
    const tx = stageOx + stageSc * cx - stageSc * k * (cx - B.x),
      ty = stageOy + stageSc * cy - stageSc * k * (cy - B.y);
    return `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${(stageSc * k).toFixed(5)})`;
  }

  function layout() {
    const vw = doc.clientWidth || window.innerWidth;
    const sh = sticky.clientHeight || window.innerHeight;
    if (vw === lastLayoutW && sh === lastLayoutH) return;
    lastLayoutW = vw;
    lastLayoutH = sh;
    mode = stageModeFor(window.innerWidth, sh); // V5.4: portrait tablets get the portrait stage
    W = STAGE[mode].w;
    H = STAGE[mode].h;
    vh = sh;
    stage.classList.toggle("d", mode === "d");
    stage.classList.toggle("m", mode === "m");
    stage.style.width = `${W}px`;
    stage.style.height = `${H}px`;
    const sc = Math.min(vw / W, sh / H);
    stage.style.transform = `scale(${sc})`;
    // the site header capsule aligns to the stage's own nav inset (40/24 px desktop, 14/14 px mobile)
    const ox = (vw - W * sc) / 2,
      oy = (sh - H * sc) / 2;
    // on screens larger than the stage the capsule grows with it (never shrinks below its native size)
    const hz = clamp(sc, 1, 2);
    doc.style.setProperty(HZ_VAR, hz.toFixed(4));
    doc.style.setProperty(HX_VAR, `${((ox + (mode === "d" ? 40 : 14) * sc) / hz).toFixed(2)}px`);
    doc.style.setProperty(HY_VAR, `${((oy + (mode === "d" ? 24 : 14) * sc) / hz).toFixed(2)}px`);
    stageSc = sc;
    stageOx = ox;
    stageOy = oy;
    if (bleed) {
      const B = HERO_BLEED[mode === "d" ? "desktop" : "mobile"];
      bleed.classList.toggle("m", mode === "m");
      // the base sky continues L0's vertical gradient (stage y 0…H) above and below the stage
      const base = bleed.firstElementChild === bleedPhoto ? null : (bleed.firstElementChild as HTMLElement | null);
      for (const el of [base, bleedPhoto]) {
        if (!el) continue;
        el.style.width = `${B.w}px`;
        el.style.height = `${B.h}px`;
      }
      if (base) base.style.transform = bleedTransform(1);
    }
    scroller.style.height = `${(TOTAL + 1) * vh}px`;
    scrollerTop = scroller.getBoundingClientRect().top + window.scrollY;
    dirty = true;
  }

  function scrollUnits() {
    return Math.max(0, window.scrollY - scrollerTop) / vh;
  }

  let last = performance.now();
  function tick(now: number) {
    raf = 0;
    if (frozen || !running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    let animating = false;
    if (!introDone) {
      animating = true;
      introMs = now - introStart;
      // scrolling early fast-forwards the intro — it never blocks
      if (scrollUnits() > 4 / vh && introMs < INTRO.fastForwardUntil) introStart -= dt * 1000 * 3;
      if (introMs > INTRO.done) {
        introDone = true;
        try {
          window.sessionStorage.setItem(INTRO_STORAGE_KEY, "1");
        } catch {
          /* ignore */
        }
      }
    }
    const target = !introDone && introMs < INTRO.holdScroll ? 0 : scrollUnits();
    sS = reduced ? target : sS + (target - sS) * Math.min(1, dt * 6);
    if (Math.abs(sS - target) < 1e-4) sS = target;
    else animating = true;
    const m = mapScroll(sS);
    if (m.t !== tS || m.hp !== hpS) dirty = true;
    tS = m.t;
    hpS = m.hp;
    for (const g of swGroups) {
      if (SW[g].p < 1) {
        SW[g].p = Math.min(1, SW[g].p + dt / 0.6);
        animating = true;
        dirty = true;
      }
    }
    if (animating || dirty) {
      draw();
      dirty = false;
    }
    if (animating) raf = requestAnimationFrame(tick);
  }
  function wake() {
    if (!started || frozen || !running || raf) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }

  /* listeners */
  const onScroll = () => wake();
  const onResize = () => {
    layout();
    wake();
  };
  const onMotion = () => {
    reduced = mql.matches;
    dirty = true;
    wake();
  };
  const swHandlers: Array<[HTMLElement, () => void]> = [];
  for (const g of swGroups)
    for (const b of swButtons[g]) {
      const h = () => setSw(g, b.dataset.key ?? "");
      b.addEventListener("click", h);
      swHandlers.push([b, h]);
    }
  // arrow-key navigation inside each tablist (WAI-ARIA tabs pattern)
  const onTabKey = (e: KeyboardEvent) => {
    const b = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-sw]");
    if (!b || !root.contains(b)) return;
    const g = b.dataset.sw as (typeof swGroups)[number];
    const list = swButtons[g].filter((x) => x.offsetParent !== null);
    const i = list.indexOf(b);
    if (i < 0) return;
    let j = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") j = (i + 1) % list.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") j = (i - 1 + list.length) % list.length;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = list.length - 1;
    if (j < 0) return;
    e.preventDefault();
    const nb = list[j]!;
    setSw(g, nb.dataset.key ?? "");
    nb.focus();
  };
  root.addEventListener("keydown", onTabKey);
  const goHandlers: Array<[HTMLElement, (e: MouseEvent) => void]> = [];
  for (const a of qa("[data-go]")) {
    const h = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      introDone = true;
      if (options.navigate) return options.navigate(Number(a.dataset.go), reduced ? "instant" : "smooth"); // V5.4
      window.scrollTo({ top: scrollerTop + (sceneStart(Number(a.dataset.go)) + 0.02) * vh, behavior: reduced ? "auto" : "smooth" });
      wake();
    };
    a.addEventListener("click", h);
    goHandlers.push([a, h]);
  }
  // keyboard users: focusing something inside a scene that is not on screen brings that scene to rest
  const onFocusIn = (e: FocusEvent) => {
    const layer = (e.target as HTMLElement | null)?.closest<HTMLElement>(".nw4-layer");
    if (!layer || !root.contains(layer)) return;
    const j = layers.indexOf(layer);
    if (j < 0 || Math.round(tS) === j) return;
    introDone = true;
    if (options.navigate) return options.navigate(j, "instant"); // V5.4
    window.scrollTo({ top: scrollerTop + (sceneStart(j) + 0.02) * vh, behavior: "auto" });
    wake();
  };
  root.addEventListener("focusin", onFocusIn);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);
  mql.addEventListener("change", onMotion);

  layout();
  drawSw();
  draw();
  root.dataset.nw4Ready = "1";

  const begin = () => {
    if (!running) return;
    started = true;
    introStart = performance.now();
    last = introStart;
    raf = requestAnimationFrame(tick);
  };
  if (document.fonts && document.fonts.status !== "loaded") document.fonts.ready.then(begin, begin);
  else begin();

  type FrameHook = (ms: number, t: number, o?: V4FrameOptions) => void;
  const w = window as unknown as { __nw4Frame?: FrameHook };
  if (options.capture) {
    w.__nw4Frame = (ms, t, o = {}) => {
      frozen = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      introDone = false;
      introMs = ms;
      tS = t;
      hpS = o.hp ?? 0;
      reduced = !!o.reduced;
      for (const g of swGroups) {
        const v = o[g];
        if (v) SW[g] = { cur: v[0], prev: v[1], p: v[2] };
      }
      draw();
    };
  }

  return () => {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onResize);
    mql.removeEventListener("change", onMotion);
    root.removeEventListener("keydown", onTabKey);
    root.removeEventListener("focusin", onFocusIn);
    for (const [b, h] of swHandlers) b.removeEventListener("click", h);
    for (const [a, h] of goHandlers) a.removeEventListener("click", h);
    doc.style.removeProperty(NAV_VAR);
    doc.style.removeProperty(HX_VAR);
    doc.style.removeProperty(HY_VAR);
    doc.style.removeProperty(HZ_VAR);
    delete root.dataset.nw4Ready;
    if (w.__nw4Frame) delete w.__nw4Frame;
  };
}
