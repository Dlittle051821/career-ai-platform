/**
 * NW-V5.6.2 — the Two Pathways controller (approved object-only prototype, ported).
 *
 * One number drives the whole scene: `split`, the share of the frame taken by
 * Discovery (0.50 rest · 0.64 / 0.36 hover · 0.93 / 0.07 expanded). Every
 * visual — field widths, content offsets, the binoculars, chips and trails,
 * the route cards and ticket, CTA fill, strips, counter — is a pure function
 * of `split` and the entrance value `objIn` (prototype `render()`), so rapid
 * moves between Discovery and Clarity can never leave two animations
 * fighting: a new target simply retargets the one tween from wherever it is.
 *
 * It owns no scrolling. V5.4's chapter controller stays the single authority
 * over the story's position (one gesture → one complete chapter); this module
 * only reads the two attributes it publishes on the root:
 *   data-v54-moving  — the chapter a move is heading to (while moving)
 *   data-v54-chapter — the chapter the story has settled on
 * Arriving from the hero, the approved entrance plays to completion on its
 * own; arriving from below, the settled scene is already in place; leaving
 * resets the choice.
 *
 * Frames run only while something moves or while the scene is on screen
 * (ambient lens drift / route flow); never while the panel is hidden or the
 * tab is in the background. Measured frame pacing lowers effects on devices
 * that cannot keep up.
 */
import { stageModeFor } from "@/lib/home/v54/stage";
import { playRouteTransition } from "./route-transition";
import {
  CARDS,
  CHIPS,
  DUR,
  SPLIT,
  SPLIT_STACKED,
  V562_COPY,
  chipVisibility,
  clamp,
  contentOffset,
  ease,
  lerp,
  routeProgress,
  smooth,
  splitState,
  trailDraw,
  type EaseName,
  type V562Mode,
  type V562Path,
} from "./content";

const CHAPTER = "pathways";

type Prop = "split" | "objIn" | "ctaD" | "ctaC" | "boost";
type Tween = { from: number; to: number; t0: number; dur: number; ease: EaseName };
type EntranceItem = { el: HTMLElement; at: number; dur: number; ease: EaseName; kind: "fade" | "line" };

export type TwoPathwaysOptions = {
  navigate: (href: string) => void;
  prefetch?: (href: string) => void;
};

export function startTwoPathways(root: HTMLElement, opts: TwoPathwaysOptions): () => void {
  const scene = root.querySelector<HTMLElement>("[data-tp]");
  if (!scene) return () => {};
  performance.mark?.("nw562-start");
  const panel = scene.closest<HTMLElement>("[data-v54-panel]");
  const header = root.querySelector<HTMLElement>(".v54-header");
  const live = root.querySelector<HTMLElement>("[data-v54-live]");
  const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = scene) => r.querySelector<T>(s);
  const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = scene) => Array.from(r.querySelectorAll<T>(s));

  const fD = $('[data-tp-path="discovery"]')!;
  const fC = $('[data-tp-path="clarity"]')!;
  const iD = $(".tp-inner", fD)!;
  const iC = $(".tp-inner", fC)!;
  const copyD = $(".tp-copy", fD)!;
  const copyC = $(".tp-copy", fC)!;
  const disc = $(".tp-disc")!;
  const binoc = $(".tp-binoc")!;
  const lenses = $$<SVGSVGElement>(".tp-lens");
  const lensPans = $$<SVGGElement>(".tp-lens .ls-pan");
  const trails = $$<SVGPathElement>(".tp-trail");
  const nodes = $$<SVGCircleElement>(".tp-tnode");
  const chips = $$(".tp-pchip");
  const trailsSvg = $<SVGSVGElement>(".tp-trails")!;
  const jt = $(".tp-jt")!;
  const cards = $$(".tp-jt-card");
  const ticket = $(".tp-jt-ticket")!;
  const prog = $<SVGPathElement>(".tp-jt-prog")!;
  const jdot = $<SVGCircleElement>(".tp-jt-dot")!;
  const stops = $$<SVGCircleElement>(".tp-jt-s");
  const dest = $<SVGGElement>(".tp-jt-d")!;
  const ctaD = $<HTMLAnchorElement>('[data-tp-cta="discovery"]')!;
  const ctaC = $<HTMLAnchorElement>('[data-tp-cta="clarity"]')!;
  const fillD = $(".tp-cta-fill", ctaD)!;
  const fillC = $(".tp-cta-fill", ctaC)!;
  const arrowD = $(".tp-cta-arrow", ctaD)!;
  const arrowC = $(".tp-cta-arrow", ctaC)!;
  const stripD = $<HTMLButtonElement>('[data-tp-strip="discovery"]')!;
  const stripC = $<HTMLButtonElement>('[data-tp-strip="clarity"]')!;
  const duoD = $(".tp-duo-d")!;
  const duoC = $(".tp-duo-c")!;
  const list = $(".tp-list")!;
  const seam = $(".tp-seam")!;
  const bar = $(".tp-bar i")!;
  const c1 = $(".tp-c1")!;
  const c2 = $(".tp-c2")!;
  const clabel = $(".tp-clabel")!;
  const counter = $(".tp-counter")!;
  const label = $(".tp-label")!;
  const back = $<HTMLButtonElement>("[data-tp-back]")!;
  const hint = $(".tp-hint")!;
  const collapsibleD = $$(".tp-desc, .tp-countries, .tp-cta", fD);
  const collapsibleC = $$(".tp-desc, .tp-countries, .tp-cta", fC);

  const trailLen = trails.map((p) => p.getTotalLength());
  trails.forEach((p, i) => (p.style.strokeDasharray = `${trailLen[i]!.toFixed(2)}`));
  const progLen = prog.getTotalLength();
  prog.style.strokeDasharray = `${progLen.toFixed(2)}`;

  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = mql.matches;

  /* ------------------------------------------------------------ state */
  // frame loop (declared first: setup below can already request a frame)
  let raf = 0,
    dirty = true,
    running = true,
    lastFrame = 0,
    lowfx = false;
  const pace: number[] = [];
  const stats = { frames: 0, long: 0, worst: 0 };
  const S: Record<Prop, number> = { split: 0.5, objIn: 0, ctaD: 0, ctaC: 0, boost: 0 };
  const tweens: Partial<Record<Prop, Tween>> = {};
  let mode: V562Mode = "rest";
  let phase: "pre" | "in" | "on" = "pre";
  let eT0 = 0;
  let navigating = false;
  let W = 1,
    H = 1,
    u = 1,
    m = 1,
    stacked = false,
    fieldsTop = 150,
    restStacked = SPLIT_STACKED.rest;
  let entrance: EntranceItem[] = [];
  const entr = new Map<HTMLElement, number>(); // element → entrance progress 0…1 (absent = 1)

  const setPhase = (p: typeof phase) => {
    phase = p;
    scene.dataset.tpPhase = p;
  };

  function to(prop: Prop, target: number, dur: number, e: EaseName) {
    const now = performance.now();
    if (reduced || dur <= 0) {
      delete tweens[prop];
      S[prop] = target;
    } else tweens[prop] = { from: S[prop], to: target, t0: now, dur: dur * 1000, ease: e };
    wake();
  }
  function stepTweens(now: number): boolean {
    let any = false;
    for (const k of Object.keys(tweens) as Prop[]) {
      const tw = tweens[k]!;
      const p = clamp((now - tw.t0) / tw.dur);
      S[k] = tw.from + (tw.to - tw.from) * ease[tw.ease](p);
      if (p >= 1) delete tweens[k];
      else any = true;
    }
    return any;
  }

  /* ------------------------------------------------------- entrance (approved intro, t0 = arrival) */
  function buildEntrance(): EntranceItem[] {
    const items: EntranceItem[] = [];
    const fade = (el: HTMLElement | null, at: number, dur: number) => el && items.push({ el, at, dur, ease: "power2.out", kind: "fade" });
    fade(label, 0, 0.6);
    $$(".tp-eyebrow").forEach((el, i) => fade(el, 0.12 + i * 0.12, 0.55));
    $$(".tp-ln > span").forEach((el, i) => items.push({ el, at: 0.18 + i * 0.07, dur: 0.8, ease: "power3.out", kind: "line" }));
    [...$$(".tp-identity"), ...$$(".tp-desc"), ...$$(".tp-countries"), ...$$(".tp-cta")].forEach((el, i) => fade(el, 0.42 + i * 0.06, 0.6));
    fade(counter, 0.7, 0.6);
    fade(hint, 0.7, 0.6);
    return items;
  }
  const OBJ_IN = { at: 0.3, dur: 1.0 };
  const ENTRANCE_END = 1.95;
  function stepEntrance(now: number): boolean {
    const e = (now - eT0) / 1000;
    for (const it of entrance) {
      const p = ease[it.ease](clamp((e - it.at) / it.dur));
      entr.set(it.el, p);
      if (it.kind === "line") it.el.style.transform = p >= 1 ? "" : `translateY(${((1 - p) * 110).toFixed(2)}%)`;
    }
    S.objIn = ease["power3.out"](clamp((e - OBJ_IN.at) / OBJ_IN.dur));
    if (e >= ENTRANCE_END) {
      settle();
      return false;
    }
    return true;
  }
  const eo = (el: HTMLElement) => (phase === "pre" ? 0 : (entr.get(el) ?? 1));
  const ey = (el: HTMLElement) => (1 - eo(el)) * 18 * (stacked ? m : u);

  function startEntrance() {
    if (reduced) return settle();
    entrance = buildEntrance();
    eT0 = performance.now();
    S.objIn = 0;
    stepEntrance(eT0);
    setPhase("in");
    render(eT0);
    wake();
  }
  function settle() {
    for (const it of entrance) if (it.kind === "line") it.el.style.transform = "";
    entrance = [];
    entr.clear();
    delete tweens.objIn;
    S.objIn = 1;
    setPhase("on");
    render(performance.now());
    wake();
    // a pointer already resting over a field gets its hover state without having to move
    if (!stacked && !expanded() && !navigating && chapterHere() && !root.dataset.v54Moving) {
      if (fD.matches(":hover")) go("hover-d");
      else if (fC.matches(":hover")) go("hover-c");
    }
  }
  function toPre() {
    for (const el of $$(".tp-ln > span")) el.style.transform = "";
    entrance = [];
    entr.clear();
    S.objIn = 0;
    go("rest", 0);
    setPhase("pre");
    // hand visibility back to the stylesheet (pre = hidden until the next arrival)
    for (const el of [label, counter, hint, disc, jt, ...$$(".tp-eyebrow, .tp-identity, .tp-desc, .tp-countries, .tp-cta")]) {
      el.style.opacity = "";
      memo.delete(el);
    }
  }

  /* ----------------------------------------------------------- layout */
  function layout() {
    W = scene!.clientWidth || window.innerWidth;
    H = scene!.clientHeight || window.innerHeight;
    stacked = stageModeFor(W, H) === "m";
    scene!.dataset.tpLayout = stacked ? "stacked" : "split";
    u = Math.min(W / 1920, H / 1080);
    m = clamp(Math.min(W / 390, H / 844), 0.88, 1.7);
    // the section label sits below the site header (which the V5.4 engine places and scales)
    const sceneTop = scene!.getBoundingClientRect().top;
    const hb = header ? header.getBoundingClientRect().bottom - sceneTop : 0;
    const labelTop = stacked ? Math.max(74 * m, hb + 12) : Math.max(128 * u, hb + 22);
    scene!.style.setProperty("--tp-label-top", `${labelTop.toFixed(1)}px`);
    fieldsTop = stacked ? Math.max(150 * m, labelTop + label.offsetHeight + 14 * m) : 0;
    if (stacked) {
      // at rest each pathway gets the room its own copy needs (equal halves when both fit, as approved)
      const avail = H - fieldsTop;
      const need = (copy: HTMLElement) => copy.offsetTop + copy.offsetHeight + 12 * m;
      const nD = need(copyD),
        nC = need(copyC);
      restStacked = nD <= avail / 2 && nC <= avail / 2 ? SPLIT_STACKED.rest : clamp(nD / (nD + nC), 0.42, 0.58);
      if (mode === "rest") {
        delete tweens.split;
        S.split = restStacked;
      }
    } else if (mode === "rest" && !tweens.split) S.split = SPLIT.rest;
    adjustObjects();
    render(performance.now());
  }

  /** Keeps both objects clear of their copy where floors make the text larger than the 1920 composition (laptops, tablets). */
  function adjustObjects() {
    for (const el of [disc, jt]) {
      el.style.removeProperty("--tp-ox");
      el.style.removeProperty("--tp-oy");
      el.style.removeProperty("--tp-os");
    }
    if (stacked) return;
    const box = disc.offsetParent as HTMLElement | null;
    if (!box) return;
    const boxH = box.offsetHeight;
    const boxTop = (H - boxH) / 2;
    const bottomLimit = H - boxTop - 14; // box coords
    const halfW = W / 2;
    const boxLeft = (halfW - box.offsetWidth) / 2;
    const gap = Math.max(14, 18 * u);
    const rectIn = (el: HTMLElement, stop: HTMLElement) => {
      let x = 0,
        y = 0;
      let n: HTMLElement | null = el;
      while (n && n !== stop) {
        x += n.offsetLeft;
        y += n.offsetTop;
        n = n.offsetParent as HTMLElement | null;
      }
      return { x, y, w: el.offsetWidth, h: el.offsetHeight };
    };
    const textRects = (copy: HTMLElement) =>
      $$(".tp-eyebrow, .tp-headline, .tp-identity, .tp-desc, .tp-countries, .tp-cta", copy).map((el) => {
        const r = rectIn(el, box);
        // block elements: measure the text's own width, not the column's
        const range = document.createRange();
        range.selectNodeContents(el);
        const rr = range.getBoundingClientRect();
        const er = el.getBoundingClientRect();
        return { x: r.x + (rr.left - er.left), y: r.y, w: Math.min(r.w, rr.width), h: r.h };
      });
    type Rect = { x: number; y: number; w: number; h: number };
    const area = (t: Rect, r: Rect) => Math.max(0, Math.min(t.x + t.w, r.x + r.w) - Math.max(t.x, r.x)) * Math.max(0, Math.min(t.y + t.h, r.y + r.h) - Math.max(t.y, r.y));
    const union = (rs: Rect[]): Rect => {
      const x = Math.min(...rs.map((r) => r.x)),
        y = Math.min(...rs.map((r) => r.y));
      return { x, y, w: Math.max(...rs.map((r) => r.x + r.w)) - x, h: Math.max(...rs.map((r) => r.y + r.h)) - y };
    };
    /** Moves `obj` only on a real collision of one of its visible parts with the copy (the approved 1920 composition lets text sit close to the objects' transparent margins). */
    const fit = (obj: HTMLElement, parts: Rect[], texts: Rect[], originY: number) => {
      const hits = texts.filter((t) => parts.some((p) => area(t, p) > 0.025 * p.w * p.h || area(t, p) > 0.2 * t.w * t.h));
      if (!hits.length) return;
      const rect = union(parts);
      const textBottom = Math.max(...hits.map((t) => t.y + t.h));
      const textRight = Math.max(...hits.map((t) => t.x + t.w));
      const dy = textBottom + gap - rect.y;
      if (rect.y + rect.h + dy <= bottomLimit) {
        obj.style.setProperty("--tp-oy", `${dy.toFixed(1)}px`);
        return;
      }
      const dx = textRight + gap - rect.x;
      if (boxLeft + rect.x + rect.w + dx <= halfW - 10) {
        obj.style.setProperty("--tp-ox", `${dx.toFixed(1)}px`);
        return;
      }
      const sc = clamp((bottomLimit - (textBottom + gap)) / rect.h, 0.7, 1);
      const oy = textBottom + gap - rect.y - (1 - sc) * originY * rect.h;
      obj.style.setProperty("--tp-os", sc.toFixed(3));
      obj.style.setProperty("--tp-oy", `${oy.toFixed(1)}px`);
    };
    fit(disc, [rectIn(binoc, box), ...chips.slice(0, 2).map((c) => rectIn(c, box))], textRects(copyD), 0.8);
    const j = rectIn(jt, box);
    fit(jt, [{ x: j.x, y: j.y - 0.18 * j.h, w: j.w, h: j.h * 1.18 }], textRects(copyC), 0.6);
  }

  /* ----------------------------------------------------------- render (prototype render(), objD(), objC()) */
  // style writes are memoised: a value that did not change is never written again (no needless style invalidation)
  const memo = new WeakMap<Element, Record<string, string>>();
  const set = (el: HTMLElement | SVGElement, prop: string, v: string) => {
    let m0 = memo.get(el);
    if (!m0) memo.set(el, (m0 = {}));
    if (m0[prop] === v) return;
    m0[prop] = v;
    if (prop.startsWith("--")) el.style.setProperty(prop, v);
    else (el.style as unknown as Record<string, string>)[prop] = v;
  };
  const attr = (el: Element, name: string, v: string) => {
    let m0 = memo.get(el);
    if (!m0) memo.set(el, (m0 = {}));
    if (m0["@" + name] === v) return;
    m0["@" + name] = v;
    el.setAttribute(name, v);
  };
  let amb = 0,
    lastReveal = 0;
  const chipV: number[] = [];
  function lensFlow() {
    const a = lastReveal;
    lensPans.forEach((pan, i) => {
      const dx = (i ? -26 : 26) - 18 * a + (reduced ? 0 : Math.sin(amb * 0.25 + i) * 3);
      const dy = -6 * a + (reduced ? 0 : Math.cos(amb * 0.2) * 2);
      attr(pan, "transform", `translate(${dx.toFixed(2)} ${dy.toFixed(2)}) scale(${(1 + 0.16 * a).toFixed(4)})`);
    });
    if (!reduced) {
      const flow = `${(-(amb * (6 + 26 * a)) % 9).toFixed(2)}`;
      for (const l of lenses) set(l, "--tp-flow", flow);
    }
  }

  function objD(aD: number, aC: number, expD: number) {
    const k = S.objIn;
    const U = stacked ? m : u;
    lastReveal = Math.max(aD, expD);
    set(disc, "opacity", `${k * eo(disc)}`);
    set(disc, "transform", stacked
      ? `translate3d(0,${((1 - k) * 18 * U).toFixed(2)}px,0) scale(${(1 + 0.03 * aD - 0.05 * aC).toFixed(4)})`
      : `translate3d(${((0.006 * aD + 0.08 * expD) * W).toFixed(2)}px,${((1 - k) * 30 * U).toFixed(2)}px,0) scale(${(1 - 0.05 * aC + 0.08 * expD).toFixed(4)})`);
    set(binoc, "transform", `translate3d(0,${(-8 * aD * U).toFixed(2)}px,0) scale(${((1.04 - 0.04 * k) * (1 + 0.05 * aD)).toFixed(4)}) rotate(${(-1.2 * aD).toFixed(3)}deg)`);
    if (stacked) return;
    const reveal = lastReveal;
    chips.forEach((c, i) => {
      const th = CHIPS[i]![4];
      const v = chipVisibility(th, k, reveal, aC);
      chipV[i] = v;
      set(c, "opacity", v.toFixed(3));
      set(c, "transform", `translate3d(${((1 - v) * -14 * U).toFixed(2)}px,${(((1 - v) * 10 + Math.sin(amb * 0.5 + i) * 2.5 * v) * U).toFixed(2)}px,0) scale(${(0.92 + 0.08 * v).toFixed(4)})`);
      const p = trails[i]!;
      set(p, "strokeDashoffset", `${(trailLen[i]! * (1 - trailDraw(th, v, reveal))).toFixed(2)}`);
      nodes[i]!.setAttribute("opacity", v.toFixed(3));
    });
    set(trailsSvg, "opacity", `${0.55 + 0.45 * reveal}`);
  }

  function objC(aC: number, aD: number, expC: number) {
    const k = S.objIn;
    const U = stacked ? m : u;
    const f = smooth(Math.max(aC, expC));
    set(jt, "opacity", `${k * eo(jt)}`);
    set(jt, "transform", stacked
      ? `translate3d(0,${((1 - k) * 18 * U).toFixed(2)}px,0) scale(${(1 + 0.03 * aC - 0.05 * aD).toFixed(4)})`
      : `translate3d(${((0.01 * aC + 0.16 * expC) * W).toFixed(2)}px,${((1 - k) * 30 * U - 0.05 * expC * H).toFixed(2)}px,0) scale(${(1 - 0.05 * aD + 0.1 * expC).toFixed(4)})`);
    cards.forEach((c, i) => {
      const e = smooth((k - 0.2 - i * 0.12) / 0.5);
      const row = CARDS[i]!;
      const x = lerp(row[0], row[3], f),
        y = lerp(row[1], row[4], f) + (1 - e) * 30,
        r = lerp(row[2], row[5], f);
      set(c, "transform", `translate3d(${x.toFixed(2)}%,${y.toFixed(2)}%,0) rotate(${r.toFixed(2)}deg)`);
      set(c, "opacity", (e * (0.9 + 0.1 * f)).toFixed(3));
      c.classList.toggle("on", f > 0.55 + i * 0.12);
    });
    set(ticket, "transform", `translate3d(0,${(((1 - k) * 20 - 6 * f) * U).toFixed(2)}px,0) rotate(${(-2.5 * (1 - f)).toFixed(3)}deg)`);
    const pr = routeProgress(f, S.boost);
    set(prog, "strokeDashoffset", `${(progLen * (1 - pr)).toFixed(2)}`);
    const pt = prog.getPointAtLength(progLen * pr);
    attr(jdot, "cx", pt.x.toFixed(2));
    attr(jdot, "cy", pt.y.toFixed(2));
    stops[0]?.classList.toggle("on", pr > 0.32);
    stops[1]?.classList.toggle("on", pr > 0.66);
    dest.classList.toggle("on", pr > 0.97);
  }

  const setInert = (el: HTMLElement, on: boolean) => {
    if (on !== el.hasAttribute("inert")) el.toggleAttribute("inert", on);
  };
  const reveal = (btn: HTMLButtonElement, v: number) => {
    set(btn, "opacity", v.toFixed(3));
    const on = v > 0.9;
    set(btn, "visibility", v > 0.01 ? "visible" : "hidden");
    set(btn, "pointerEvents", on ? "auto" : "none");
    btn.tabIndex = on ? 0 : -1;
    if (on) btn.removeAttribute("aria-hidden");
    else attr(btn, "aria-hidden", "true");
  };

  /** Ambient-only frame (nothing is moving): lens drift, route flow and the chips' float — nothing else is touched. */
  function renderAmbient() {
    lensFlow();
    if (stacked) return;
    const U = u;
    chips.forEach((c, i) => {
      const v = chipV[i] ?? 0;
      if (v <= 0) return;
      set(c, "transform", `translate3d(${((1 - v) * -14 * U).toFixed(2)}px,${(((1 - v) * 10 + Math.sin(amb * 0.5 + i) * 2.5 * v) * U).toFixed(2)}px,0) scale(${(0.92 + 0.08 * v).toFixed(4)})`);
    });
  }

  function render(_now: number) {
    const s = S.split;
    const { a, aD, aC, expD, expC } = splitState(s, stacked ? restStacked : SPLIT.rest);
    lensFlow();

    if (!stacked) {
      const wD = s * W,
        wC = W - wD;
      // both fields cover the scene and are clipped (paint only — no layout, no layout shift, no hit-testing outside)
      set(fD, "clipPath", `inset(0px ${(W - wD).toFixed(2)}px 0px 0px)`);
      set(fC, "clipPath", `inset(0px 0px 0px ${wD.toFixed(2)}px)`);
      set(iD, "transform", `translate3d(${contentOffset(wD, W, expD).toFixed(2)}px,0,0)`);
      set(iC, "transform", `translate3d(${(wD + contentOffset(wC, W, expC)).toFixed(2)}px,0,0)`);
      set(stripD, "transform", `translate3d(${(wD - W).toFixed(2)}px,0,0)`);
      set(stripC, "transform", `translate3d(${wD.toFixed(2)}px,0,0)`);
      const oD = 1 - smooth(expC * 1.4),
        oC = 1 - smooth(expD * 1.4);
      set(iD, "height", "");
      set(iC, "height", "");
      set(iD, "opacity", `${oD}`);
      set(iC, "opacity", `${oC}`);
      setInert(iD, oD < 0.05);
      setInert(iC, oC < 0.05);
      objD(aD, aC, expD);
      objC(aC, aD, expC);
      set(seam, "transform", `translate3d(${wD.toFixed(2)}px,0,0)`);
      set(seam, "opacity", `${(1 - Math.max(expD, expC)) * S.objIn}`);
      reveal(stripD, smooth((expC - 0.55) / 0.45));
      reveal(stripC, smooth((expD - 0.55) / 0.45));
      set(duoD, "opacity", `${0.2 * smooth(expD)}`);
      set(duoD, "transform", `translate3d(${((1 - expD) * 60 * u).toFixed(2)}px,0,0)`);
      set(duoC, "opacity", `${0.3 * smooth(expC)}`);
      set(duoC, "transform", `translate3d(${(wD + (1 - expC) * -60 * u).toFixed(2)}px,0,0)`);
      set(list, "maxHeight", `${(60 * Math.max(u, 0.8) * smooth(expD)).toFixed(1)}px`);
      set(list, "opacity", `${smooth((expD - 0.4) / 0.6)}`);
      const ex = Math.max(expD, expC);
      set(label, "opacity", `${eo(label) * (1 - smooth(ex * 1.6))}`);
      set(label, "transform", `translateX(-50%) translateY(${ey(label).toFixed(2)}px)`);
      reveal(back, smooth((ex - 0.5) / 0.5));
      set(hint, "opacity", `${Math.min(eo(hint), 0.8 * (1 - Math.max(aD, aC, ex)) * S.objIn)}`);
      set(hint, "transform", `translateY(${ey(hint).toFixed(2)}px)`);
      for (const el of [...collapsibleD, ...collapsibleC]) {
        set(el, "opacity", `${eo(el)}`);
        set(el, "pointerEvents", "");
      }
    } else {
      // stacked: the same model on the vertical axis, below the section label
      const avail = H - fieldsTop,
        hD = s * avail,
        hC = avail - hD,
        half = avail / 2;
      set(fD, "clipPath", `inset(${fieldsTop.toFixed(2)}px 0px ${(H - fieldsTop - hD).toFixed(2)}px 0px)`);
      set(fC, "clipPath", `inset(${(fieldsTop + hD).toFixed(2)}px 0px 0px 0px)`);
      set(iD, "height", `${half.toFixed(2)}px`);
      set(iC, "height", `${half.toFixed(2)}px`);
      set(iD, "transform", `translate3d(0,${(fieldsTop + Math.max(0, hD - half) * 0.35).toFixed(2)}px,0)`);
      set(iC, "transform", `translate3d(0,${(fieldsTop + hD + Math.max(0, hC - half) * 0.15).toFixed(2)}px,0)`);
      set(iD, "opacity", "1");
      set(iC, "opacity", "1");
      set(duoC, "transform", `translate3d(0,${(fieldsTop + hD).toFixed(2)}px,0)`);
      setInert(iD, false);
      setInert(iC, false);
      objD(aD, aC, 0);
      objC(aC, aD, 0);
      set(label, "opacity", `${eo(label)}`);
      set(label, "transform", `translateX(-50%) translateY(${ey(label).toFixed(2)}px)`);
      // an inactive pathway collapses to a title card (eyebrow, headline, identity); tapping it activates it
      for (const [els, k] of [
        [collapsibleD, aC],
        [collapsibleC, aD],
      ] as const) {
        const o = 1 - smooth(k * 1.6);
        for (const el of els) {
          set(el, "opacity", `${o * eo(el)}`);
          set(el, "pointerEvents", o < 0.5 ? "none" : "");
        }
      }
      reveal(stripD, 0);
      reveal(stripC, 0);
      reveal(back, 0);
    }
    for (const el of $$(".tp-eyebrow, .tp-identity")) {
      set(el, "opacity", `${eo(el)}`);
      set(el, "transform", eo(el) >= 1 ? "" : `translateY(${ey(el).toFixed(2)}px)`);
    }
    for (const el of [...collapsibleD, ...collapsibleC]) set(el, "transform", eo(el) >= 1 ? "" : `translateY(${ey(el).toFixed(2)}px)`);
    set(counter, "opacity", `${eo(counter)}`);
    // CTA: outlined at rest, coral-filled on the active pathway (and on direct hover / focus)
    const fd = smooth(Math.max(aD, expD, S.ctaD)),
      fc = smooth(Math.max(aC, expC, S.ctaC));
    set(fillD, "transform", `scaleX(${fd.toFixed(4)})`);
    set(fillC, "transform", `scaleX(${fc.toFixed(4)})`);
    set(ctaD, "borderColor", `rgba(255,${Math.round(255 - 178 * fd)},${Math.round(255 - 146 * fd)},${(0.85 + 0.15 * fd).toFixed(3)})`);
    set(ctaC, "borderColor", `rgba(255,${Math.round(255 - 178 * fc)},${Math.round(255 - 146 * fc)},${(0.85 + 0.15 * fc).toFixed(3)})`);
    set(arrowD, "transform", `translateX(${(6 * fd * (stacked ? m : Math.max(u, 0.8))).toFixed(2)}px)`);
    set(arrowC, "transform", `translateX(${(6 * fc * (stacked ? m : Math.max(u, 0.8))).toFixed(2)}px)`);
    // counter mirrors the split
    set(bar, "transform", `scaleX(${s.toFixed(4)})`);
    set(c1, "opacity", `${0.55 + 0.45 * Math.max(aD, 1 - Math.abs(a))}`);
    set(c2, "opacity", `${0.55 + 0.45 * Math.max(aC, 1 - Math.abs(a))}`);
    const lab = a > 0.5 ? "Discovery" : a < -0.5 ? "Clarity" : "Both pathways";
    if (clabel.textContent !== lab) clabel.textContent = lab;
    if (scene!.dataset.tpMode !== mode) scene!.dataset.tpMode = mode;
  }

  /* ----------------------------------------------------------- state machine */
  function go(next: V562Mode, dur?: number) {
    if (next === mode && dur === undefined) return;
    const from = mode;
    mode = next;
    const target = stacked ? (next === "rest" ? restStacked : SPLIT_STACKED[next]) : SPLIT[next];
    const d = dur ?? (next.startsWith("exp") ? (from.startsWith("exp") ? DUR.swap : DUR.expand) : next === "rest" ? DUR.rest : DUR.hover);
    to("split", target, d, next.startsWith("exp") ? "power3.inOut" : "power2.inOut");
  }
  const expanded = () => mode.startsWith("exp");
  const chapterHere = () => root.dataset.v54Chapter === CHAPTER;
  const interactive = () => phase !== "pre" && chapterHere() && !root.dataset.v54Moving && !navigating;
  const hoverable = (e: PointerEvent) => e.pointerType !== "touch" && !stacked && !expanded() && interactive();

  // the detail view's vector backgrounds load on first desktop intent only (never on phones, never at page load)
  let duoLoaded = false;
  const loadDuo = () => {
    if (duoLoaded || stacked) return;
    duoLoaded = true;
    for (const img of $$<HTMLImageElement>("img[data-tp-src]")) img.src = img.dataset.tpSrc!;
  };
  const onEnterD = (e: PointerEvent) => (loadDuo(), hoverable(e) && go("hover-d"));
  const onEnterC = (e: PointerEvent) => (loadDuo(), hoverable(e) && go("hover-c"));
  const onLeave = (e: PointerEvent) => hoverable(e) && go("rest");
  const onHeader = (e: PointerEvent) => hoverable(e) && go("rest");
  const onFocusIn = (e: FocusEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest("[data-tp-strip], [data-tp-back]")) return;
    const path = t.closest<HTMLElement>("[data-tp-path]")?.dataset.tpPath as V562Path | undefined;
    if (!path) return;
    if (phase === "pre" && chapterHere()) settle();
    if (!expanded() && !navigating) go(path === "discovery" ? "hover-d" : "hover-c");
  };
  const onFocusOut = (e: FocusEvent) => {
    const nxt = e.relatedTarget as Node | null;
    if (nxt && scene!.contains(nxt)) return;
    if (!expanded() && !navigating && !scene!.matches(":hover")) go("rest");
  };
  const ctaHover = (prop: "ctaD" | "ctaC", v: number) => () => {
    to(prop, v, DUR.cta, "power2.out");
    if (v) opts.prefetch?.(prop === "ctaD" ? ctaD.getAttribute("href")! : ctaC.getAttribute("href")!);
  };
  const onFieldClick = (path: V562Path) => (e: MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest("[data-tp-cta], [data-tp-strip]") || !interactive()) return;
    if (stacked) return go(path === "discovery" ? "hover-d" : "hover-c"); // tap = activate
    loadDuo();
    go(path === "discovery" ? "exp-d" : "exp-c");
  };
  const clickD = onFieldClick("discovery"),
    clickC = onFieldClick("clarity");
  const onStripC = (e: MouseEvent) => {
    e.stopPropagation();
    go("exp-c");
  };
  const onStripD = (e: MouseEvent) => {
    e.stopPropagation();
    go("exp-d");
  };
  const onBack = () => {
    const was = mode;
    go("rest");
    // keep keyboard focus on a visible control: the CTA of the pathway that was open
    (was === "exp-c" ? ctaC : ctaD).focus({ preventScroll: true });
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" && expanded() && interactive()) go("rest");
  };

  // CTA → complete the ticket route (Clarity) → coral transition → the real route
  const onCta = (path: V562Path, cta: HTMLAnchorElement) => (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // new tab / window: the browser's own
    e.preventDefault();
    e.stopPropagation();
    if (navigating) return;
    navigating = true;
    const href = cta.getAttribute("href")!;
    opts.prefetch?.(href);
    if (stacked) go(path === "discovery" ? "hover-d" : "hover-c");
    if (path === "clarity") to("boost", 1, 0.35, "power2.out");
    if (!reduced)
      cta.animate([{ transform: "scale(1)" }, { transform: "scale(0.96)", offset: 0.32 }, { transform: "scale(1)" }], {
        duration: 370,
        easing: "ease-out",
      });
    const r = cta.getBoundingClientRect();
    const name = V562_COPY[path].opening;
    if (live) live.textContent = `Opening ${name}`;
    const cs = getComputedStyle(scene!);
    playRouteTransition({
      href,
      x: r.left + r.width / 2,
      y: r.top + r.height / 2,
      label: name,
      reduced,
      navigate: opts.navigate,
      fontDisplay: cs.getPropertyValue("--display").trim() || undefined,
      fontBody: cs.getPropertyValue("--body").trim() || undefined,
    });
    // if the visitor comes back (history), the scene is usable again
    window.setTimeout(() => {
      navigating = false;
    }, 4000);
  };
  const ctaClickD = onCta("discovery", ctaD),
    ctaClickC = onCta("clarity", ctaC);
  const hoverInD = ctaHover("ctaD", 1),
    hoverOutD = ctaHover("ctaD", 0),
    hoverInC = ctaHover("ctaC", 1),
    hoverOutC = ctaHover("ctaC", 0);

  fD.addEventListener("pointerenter", onEnterD);
  fC.addEventListener("pointerenter", onEnterC);
  scene.addEventListener("pointerleave", onLeave);
  header?.addEventListener("pointerenter", onHeader);
  scene.addEventListener("focusin", onFocusIn);
  scene.addEventListener("focusout", onFocusOut);
  fD.addEventListener("click", clickD);
  fC.addEventListener("click", clickC);
  stripC.addEventListener("click", onStripC);
  stripD.addEventListener("click", onStripD);
  back.addEventListener("click", onBack);
  window.addEventListener("keydown", onKey);
  ctaD.addEventListener("click", ctaClickD);
  ctaC.addEventListener("click", ctaClickC);
  ctaD.addEventListener("pointerenter", hoverInD);
  ctaD.addEventListener("pointerleave", hoverOutD);
  ctaC.addEventListener("pointerenter", hoverInC);
  ctaC.addEventListener("pointerleave", hoverOutC);
  ctaD.addEventListener("focus", hoverInD);
  ctaD.addEventListener("blur", hoverOutD);
  ctaC.addEventListener("focus", hoverInC);
  ctaC.addEventListener("blur", hoverOutC);

  /* ----------------------------------------------------------- chapter wiring (read-only) */
  let lastChapter = root.dataset.v54Chapter ?? "hero";
  function onRootChange() {
    const moving = root.dataset.v54Moving;
    const chapter = root.dataset.v54Chapter ?? "hero";
    if (moving === CHAPTER && phase === "pre" && lastChapter !== "hero") settle(); // from below: already in place
    if (moving && moving !== CHAPTER && chapter === CHAPTER) go("rest"); // leaving: the choice resets
    if (!moving && chapter !== lastChapter) {
      if (chapter === CHAPTER) {
        lastInput = performance.now();
        layout();
        if (phase === "pre") startEntrance();
      } else if (chapter === "hero") toPre(); // the next arrival from the hero replays the entrance
      else go("rest", 0);
      lastChapter = chapter;
    }
    wake();
  }
  const mo = new MutationObserver(onRootChange);
  mo.observe(root, { attributes: true, attributeFilter: ["data-v54-chapter", "data-v54-moving"] });

  const onMql = () => {
    reduced = mql.matches;
    scene.dataset.tpReduced = reduced ? "true" : "false";
    if (reduced && phase === "in") settle();
    wake();
  };
  onMql();
  mql.addEventListener("change", onMql);
  const onShow = (e: PageTransitionEvent) => {
    if (!e.persisted) return;
    navigating = false;
    go("rest", 0);
    if (chapterHere()) settle();
    layout();
  };
  window.addEventListener("pageshow", onShow);

  /* ----------------------------------------------------------- frames */
  // power: ambient motion runs at full rate while the visitor is engaged, at 30 fps after 6 s without input, and rests after 30 s
  let lastInput = performance.now();
  const onInput = () => {
    lastInput = performance.now();
    wake();
  };
  const visible = () => (!panel || panel.style.visibility !== "hidden") && !document.hidden;
  const onScreen = () => chapterHere() || root.dataset.v54Moving === CHAPTER;

  function frame(now: number) {
    raf = 0;
    if (!running) return;
    if (lastFrame) {
      const dt = now - lastFrame;
      if (dt < 250) {
        stats.frames++;
        if (dt > 50) stats.long++;
        stats.worst = Math.max(stats.worst, dt);
        pace.push(dt);
        if (pace.length > 45) pace.shift();
        // adaptive quality: sustained slow frames → lighter chips, 30 fps ambient
        if (!lowfx && pace.length >= 45) {
          const sorted = [...pace].sort((x, y) => x - y);
          if (sorted[22]! > 24) {
            lowfx = true;
            scene!.dataset.tpLowfx = "true";
          }
        }
      }
    }
    lastFrame = now;
    amb = now / 1000;
    const moving = stepTweens(now);
    const entering = phase === "in" ? stepEntrance(now) : false;
    if (moving || entering || dirty) render(now);
    else renderAmbient();
    dirty = moving || entering;
    if (!visible()) {
      lastFrame = 0;
      return; // resumes on wake()
    }
    if (moving || entering) raf = requestAnimationFrame(frame);
    else if (!reduced && onScreen() && now - lastInput < 30000) {
      if (lowfx || now - lastInput > 6000) raf = requestAnimationFrame((t) => (t - now >= 30 ? frame(t) : (raf = requestAnimationFrame(frame))));
      else raf = requestAnimationFrame(frame);
    } else lastFrame = 0;
  }
  function wake() {
    dirty = true;
    if (!raf && running) raf = requestAnimationFrame(frame);
  }

  const po = panel ? new MutationObserver(wake) : null;
  po?.observe(panel!, { attributes: true, attributeFilter: ["style"] });
  // size changes (resize, web fonts, header scale) are measured once per frame, however many observers fire
  let layoutRaf = 0;
  const ro = new ResizeObserver(() => {
    if (!layoutRaf)
      layoutRaf = requestAnimationFrame(() => {
        layoutRaf = 0;
        if (running) layout();
      });
  });
  ro.observe(scene);
  ro.observe(copyD);
  ro.observe(copyC);
  if (header) ro.observe(header);
  const onVis = () => wake();
  document.addEventListener("visibilitychange", onVis);
  for (const t of ["pointermove", "pointerdown", "keydown", "focusin"] as const) scene.addEventListener(t, onInput, { passive: true });

  setPhase("pre");
  layout();
  void document.fonts?.ready.then(() => running && (layoutRaf || (layoutRaf = requestAnimationFrame(() => ((layoutRaf = 0), running && layout())))));
  if (chapterHere() && !root.dataset.v54Moving) settle();
  scene.dataset.tpReady = "true";
  try {
    performance.measure?.("nw562-init", "nw562-start");
  } catch {
    /* marks unsupported */
  }
  (window as unknown as { __nw562?: unknown }).__nw562 = {
    stats,
    mode: () => mode,
    phase: () => phase,
    state: () => ({ ...S }),
    lowfx: () => lowfx,
  };

  return () => {
    running = false;
    cancelAnimationFrame(raf);
    cancelAnimationFrame(layoutRaf);
    mo.disconnect();
    po?.disconnect();
    ro.disconnect();
    mql.removeEventListener("change", onMql);
    window.removeEventListener("pageshow", onShow);
    window.removeEventListener("keydown", onKey);
    document.removeEventListener("visibilitychange", onVis);
    for (const t of ["pointermove", "pointerdown", "keydown", "focusin"] as const) scene.removeEventListener(t, onInput);
    fD.removeEventListener("pointerenter", onEnterD);
    fC.removeEventListener("pointerenter", onEnterC);
    scene.removeEventListener("pointerleave", onLeave);
    header?.removeEventListener("pointerenter", onHeader);
    scene.removeEventListener("focusin", onFocusIn);
    scene.removeEventListener("focusout", onFocusOut);
    fD.removeEventListener("click", clickD);
    fC.removeEventListener("click", clickC);
    stripC.removeEventListener("click", onStripC);
    stripD.removeEventListener("click", onStripD);
    back.removeEventListener("click", onBack);
    ctaD.removeEventListener("click", ctaClickD);
    ctaC.removeEventListener("click", ctaClickC);
    for (const [el, a, b] of [
      [ctaD, hoverInD, hoverOutD],
      [ctaC, hoverInC, hoverOutC],
    ] as const) {
      el.removeEventListener("pointerenter", a);
      el.removeEventListener("pointerleave", b);
      el.removeEventListener("focus", a);
      el.removeEventListener("blur", b);
    }
    delete scene.dataset.tpReady;
  };
}
