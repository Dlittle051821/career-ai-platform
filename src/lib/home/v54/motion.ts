/**
 * NW-V5.4 — ThoughtMotionController: the organic thought motion around the
 * student, layered on the UNCHANGED V4 engine (the N reveal and the N-led
 * scroll story are the engine's; this file never touches its elements).
 *
 *   intro               0 – 3.15 s   the V4 N reveal, unchanged
 *   questions-emerge    3.15 – 7.7 s the portrait resolves (V4 photo timing); the questions emerge one by
 *                                    one from behind the student's head and drift out to their own paths
 *   thoughts-in-motion  afterwards   every card follows its OWN authored loop through 3D space (own
 *                                    waypoints, duration, phase and speed changes); from time to time one
 *                                    question slows into the focal plane — crisp and slightly larger,
 *                                    with no colour accent — then drifts on
 *   clarity-transition  first scroll: the questions leave their paths (front ones dip under his chin,
 *                       rear ones slide behind his head) and line up under Career Intelligence and
 *                       Study Abroad, each showing what Nextwise offers for it
 *   scroll-story        the approved V4 N-led story takes over unchanged
 *
 * Everything is a pure function of time, scroll and (desktop) pointer
 * position — no Math.random, no per-frame randomness — so a refresh, a
 * reverse scroll and a QA capture all land on exactly the same frame.
 */
import { stageModeFor } from "./stage";
import {
  EIO,
  EOUT,
  HOLD,
  INTRO,
  INTRO_STORAGE_KEY,
  LAST,
  TRANS,
  clamp,
  lerp,
  sceneStart,
  win,
  type V4Mode,
} from "@/lib/home/v4/engine";
import {
  V54_CARDS,
  V54_COLUMNS,
  V54_DEPTH,
  V54_HEAD,
  V54_SCENE,
  V54_TIMING,
  V54_TITLE_PX,
  type ThoughtMotionConfig,
  type V54Card,
  type V54Pathway,
  type V54Waypoint,
} from "./config";

export type V54State = "intro" | "questions-emerge" | "thoughts-in-motion" | "clarity-transition" | "scroll-story";
export const V54_STATES: readonly V54State[] = ["intro", "questions-emerge", "thoughts-in-motion", "clarity-transition", "scroll-story"];

/** Clarity happens over the hero's own scroll hold, and is complete before the wipe into Two Pathways shows. */
export const V54_CLARITY_SPAN = [0.04, HOLD[0] + 0.1 * TRANS] as const;

export type V54Frame = {
  x: number;
  y: number;
  w: number;
  h: number;
  rotZ: number;
  rotY: number;
  scale: number;
  opacity: number;
  /** depth-of-field blur, px */
  blur: number;
  /** 0…1 shadow strength (nearer cards cast a deeper shadow) */
  shadow: number;
  /** −1…1 where the specular highlight sits across the card (follows its turn) */
  highlight: number;
  /** −1 (far behind the student) … 1 (nearest the viewer) */
  z: number;
  /** true: in front of the portrait; false: behind it (the student occludes it) */
  front: boolean;
  /** 0…1: the card's moment of focus (crisp, a little larger) */
  focus: number;
  /** 0…1: how far the card has resolved into its pathway (shows the answer line) */
  resolved: number;
};

export function clarityProgress(s: number): number {
  const w = win(s, V54_CLARITY_SPAN[0], V54_CLARITY_SPAN[1]);
  return w <= 0 ? 0 : w >= 1 ? 1 : EIO(w);
}

/** Scroll units for a scene position t (and hold progress hp) — the inverse of the engine's mapScroll. */
export function scrollFromT(t: number, hp = 0): number {
  const k = Math.min(LAST, Math.floor(t));
  const f = t - k;
  if (f > 0) return sceneStart(k) + (HOLD[k] ?? 0) + f * TRANS;
  return sceneStart(k) + (HOLD[k] ?? 0) * clamp(hp);
}

export const V54_EMERGED = V54_TIMING.emerge + V54_TIMING.emergeDur + V54_TIMING.emergeStagger * (V54_CARDS.length - 1);

export function stateFor(ms: number, s: number, c: number, reduced = false): V54State {
  // the first few pixels of scroll (before the questions start to organise) still count as the hero
  if (s > 0.0005 && c > 0) return c < 1 ? "clarity-transition" : "scroll-story";
  if (ms < INTRO.photo[0]) return "intro";
  if (reduced) return ms < INTRO.photo[1] ? "questions-emerge" : "thoughts-in-motion";
  return ms < V54_EMERGED ? "questions-emerge" : "thoughts-in-motion";
}

const TAU = Math.PI * 2;
const frac = (v: number) => v - Math.floor(v);
const smooth = (v: number) => {
  const t = clamp(v);
  return t * t * (3 - 2 * t);
};
/** A stable per-card number in [0, 1) from its id — deterministic "randomness" (no Math.random). */
export function seedOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10007) / 10007;
}

/** Closed, uniform Catmull-Rom loop through the waypoints: smooth (C¹), and seamless at the loop boundary. */
export function loopPoint(pts: readonly V54Waypoint[], u: number): [number, number, number] {
  const n = pts.length;
  const s = frac(u) * n;
  const i = Math.floor(s),
    t = s - i;
  const P = (k: number) => pts[((k % n) + n) % n]!;
  const p0 = P(i - 1),
    p1 = P(i),
    p2 = P(i + 1),
    p3 = P(i + 2);
  const t2 = t * t,
    t3 = t2 * t;
  const out: [number, number, number] = [0, 0, 0];
  for (let d = 0; d < 3; d++)
    out[d] = 0.5 * (2 * p1[d]! + (-p0[d]! + p2[d]!) * t + (2 * p0[d]! - 5 * p1[d]! + 4 * p2[d]! - p3[d]!) * t2 + (-p0[d]! + 3 * p1[d]! - 3 * p2[d]! + p3[d]!) * t3);
  return out;
}

/** Open Catmull-Rom through a short list of points (end points repeated), q in 0…1. */
function routePoint(pts: readonly (readonly [number, number])[], q: number): [number, number] {
  const n = pts.length - 1;
  const s = clamp(q) * n;
  const i = Math.min(n - 1, Math.floor(s)),
    t = s - i;
  const P = (k: number) => pts[Math.max(0, Math.min(n, k))]!;
  const p0 = P(i - 1),
    p1 = P(i),
    p2 = P(i + 1),
    p3 = P(i + 2);
  const t2 = t * t,
    t3 = t2 * t;
  const o: [number, number] = [0, 0];
  for (let d = 0; d < 2; d++)
    o[d] = 0.5 * (2 * p1[d]! + (-p0[d]! + p2[d]!) * t + (2 * p0[d]! - 5 * p1[d]! + 4 * p2[d]! - p3[d]!) * t2 + (-p0[d]! + 3 * p1[d]! - 3 * p2[d]! + p3[d]!) * t3);
  return o;
}

/** Where the card is on its own loop (0…1, unwarped) at time ms. */
export function loopPhase(m: ThoughtMotionConfig, ms: number): number {
  return frac((ms - V54_TIMING.pathStart) / m.duration + m.phaseOffset);
}

/**
 * The card's own clock → its position along its path. Two gentle,
 * monotonic warps: it slows into its focus moment (if it has one), and every
 * card breathes with its own small acceleration and deceleration.
 */
export function warpedPhase(m: ThoughtMotionConfig, seed: number, p: number): number {
  let w = p;
  if (m.focusHold) w = w - (V54_TIMING.focusDwell * Math.sin(TAU * (w - m.focusHold.at))) / TAU;
  return w - (0.22 * Math.sin(2 * TAU * w + seed * TAU)) / (2 * TAU);
}

/** 0…1: how much the card is in its moment of focus at loop phase p. */
export function focusAt(m: ThoughtMotionConfig, p: number): number {
  if (!m.focusHold) return 0;
  const d0 = Math.abs(p - m.focusHold.at);
  const d = Math.min(d0, 1 - d0);
  const inner = m.focusHold.hold / 2 - 0.02;
  return 1 - smooth((d - inner) / 0.05);
}

/** Depth → scale (shared curve, then each card's own range). */
export function depthScale(m: ThoughtMotionConfig, z: number): number {
  const zs = [-1, -0.3, 0, 0.55, 1];
  const sc = V54_DEPTH.scale;
  let base: number = sc[4];
  for (let i = 0; i < 4; i++)
    if (z <= zs[i + 1]!) {
      base = lerp(sc[i]!, sc[i + 1]!, clamp((z - zs[i]!) / (zs[i + 1]! - zs[i]!)));
      break;
    }
  return base * lerp(m.scaleRange[0], m.scaleRange[1], (z + 1) / 2);
}

/** Depth → depth-of-field blur: sharpest at the focal plane, a little soft in front, softer behind. */
export function depthBlur(m: ThoughtMotionConfig, z: number): number {
  const fp = V54_DEPTH.focalPlane;
  const [b0, b1] = m.blurRange;
  return z >= fp ? b0 + ((z - fp) / (1 - fp)) * 0.5 : b0 + ((fp - z) / (1 + fp)) * (b1 - b0);
}

export const depthOpacity = (z: number) =>
  z >= V54_DEPTH.fadeFrom ? 1 : lerp(1, V54_DEPTH.farOpacity, (V54_DEPTH.fadeFrom - z) / (1 + V54_DEPTH.fadeFrom));

/**
 * Scene C — one moment of focus at a time: of the cards whose own focus
 * window is open, only the one most in focus shows it (ties: the earlier
 * card in V54_CARDS). Pure, so every card agrees on the same winner.
 */
export function focusWinner(mode: V4Mode, ms: number): string | null {
  let best: string | null = null,
    bestF = 0;
  for (const c of V54_CARDS) {
    const m = c.motion[mode];
    if (!m?.focusHold) continue;
    const f = focusAt(m, loopPhase(m, ms));
    if (f > bestF + 1e-9) {
      bestF = f;
      best = c.id;
    }
  }
  return best;
}

/** Everything a card's look derives from its point on its own path. */
export function pathPose(mode: V4Mode, card: V54Card, ms: number): Omit<V54Frame, "opacity" | "resolved"> & { p: number } {
  const m = card.motion[mode]!;
  const seed = seedOf(card.id);
  const p = loopPhase(m, ms);
  const w = warpedPhase(m, seed, p);
  const [x, y, zRaw] = loopPoint(m.waypoints, w);
  // the smooth curve can overshoot a waypoint slightly; depth stays within −1…1
  const z = clamp(zRaw, -1, 1);
  const focus = focusWinner(mode, ms) === card.id ? focusAt(m, p) : 0;
  const [cw, ch] = card.size[mode]!;
  const yaw = lerp(m.rotationRange.yaw[0], m.rotationRange.yaw[1], 0.5 + 0.5 * Math.sin(TAU * w + seed * 7));
  const roll = lerp(m.rotationRange.roll[0], m.rotationRange.roll[1], 0.5 + 0.5 * Math.sin(TAU * w + seed * 13 + 1.7));
  return {
    p,
    x,
    y,
    w: cw,
    h: ch,
    // in focus a card turns a little more toward the viewer
    rotY: yaw * (1 - 0.5 * focus),
    rotZ: roll * (1 - 0.5 * focus),
    scale: depthScale(m, z) * (1 + 0.05 * focus),
    blur: depthBlur(m, z) * (1 - focus),
    shadow: 0.2 + 0.8 * ((z + 1) / 2),
    highlight: clamp(yaw / 26, -1, 1),
    z,
    front: m.zIndexBehaviour === "front" || z >= 0,
    focus,
  };
}

export type V54CardInput = {
  mode: V4Mode;
  card: V54Card;
  /** index in emergence / clarity order */
  idx: number;
  /** slot in its pathway column */
  slot: number;
  ms: number;
  s: number;
  reduced: boolean;
  /** pointer parallax, −1…1 on each axis (0 when off) */
  pointer?: { x: number; y: number };
};

/**
 * The whole card choreography as a pure function of time, scroll and
 * pointer — a refresh, a reverse scroll and a QA capture all land on the
 * same frame.
 */
export function cardFrame(i: V54CardInput): V54Frame {
  const c = clarityProgress(i.s);
  const head = V54_HEAD[i.mode];
  // reduced motion: every card holds its pose from the reference keyframe
  const t = i.reduced ? V54_TIMING.keyframe : i.ms;
  const pose = pathPose(i.mode, i.card, t);
  let f: V54Frame = { ...pose, opacity: depthOpacity(pose.z), resolved: 0 };

  if (i.reduced) f.opacity *= win(i.ms, INTRO.photo[0], INTRO.photo[1]);
  else {
    // Scene A: the question emerges from behind the student's head and drifts out to its path
    const a0 = V54_TIMING.emerge + i.idx * V54_TIMING.emergeStagger;
    const e = EOUT(win(i.ms, a0, a0 + V54_TIMING.emergeDur));
    if (e < 1) {
      const fx = head.cx + (pose.x - head.cx) * 0.22,
        fy = head.cy + (pose.y - head.cy) * 0.22;
      f = {
        ...f,
        x: lerp(fx, pose.x, e),
        y: lerp(fy, pose.y, e),
        z: lerp(-0.8, pose.z, e),
        scale: f.scale * lerp(0.8, 1, e),
        blur: Math.max(f.blur, (1 - e) * 2.5),
        front: pose.front && e >= 0.8,
        focus: f.focus * e,
        opacity: f.opacity * EIO(win(i.ms, a0, a0 + V54_TIMING.emergeDur * 0.5)),
      };
    }
    // subtle pointer parallax: nearer cards move more (desktop, fine pointers)
    if (i.pointer) {
      const k = (f.z + 1) / 2;
      f.x += i.pointer.x * V54_TIMING.parallax.x * k;
      f.y += i.pointer.y * V54_TIMING.parallax.y * k;
    }
  }

  if (c > 0) {
    const col = V54_COLUMNS[i.mode][i.card.pathway as V54Pathway];
    const target = { x: col.x, y: col.y + i.slot * col.gap };
    if (i.reduced) {
      // no travel: cross-fade from the keyframe pose to the column
      f =
        c < 0.5
          ? { ...f, opacity: f.opacity * (1 - c * 2) }
          : { x: target.x, y: target.y, w: col.w, h: col.h, rotZ: 0, rotY: 0, scale: 1, opacity: (c - 0.5) * 2, blur: 0, shadow: 0.55, highlight: 0, z: 1, front: true, focus: 0, resolved: 1 };
    } else {
      const q = EIO(clamp(c * 1.3 - (i.idx / V54_CARDS.length) * 0.3));
      // the route never crosses his face: a card in front that must cross to the other side first dips
      // below his chin; a card behind him slides across behind his head, then comes forward at the side
      const sideX = i.mode === "d" ? (i.card.pathway === "career" ? head.face.x0 - 250 : head.face.x1 + 250) : i.card.pathway === "career" ? 84 : 306;
      const chinY = head.face.y1 + (i.mode === "d" ? 78 : 56);
      const crossing = Math.sign(f.x - head.cx) !== Math.sign(sideX - head.cx) || Math.abs(f.x - head.cx) < 160;
      const pts: (readonly [number, number])[] = [[f.x, f.y]];
      if (crossing && f.front && f.y < chinY) pts.push([f.x, chinY]);
      pts.push([sideX, crossing && f.front ? Math.max(f.y, chinY) : f.y], [target.x, target.y]);
      const [x, y] = routePoint(pts, q);
      const outside = x < head.hair.x0 - f.w * 0.4 || x > head.hair.x1 + f.w * 0.4;
      f = {
        x,
        y,
        w: lerp(f.w, col.w, q),
        h: lerp(f.h, col.h, q),
        rotZ: lerp(f.rotZ, 0, q),
        rotY: lerp(f.rotY, 0, q),
        scale: lerp(f.scale, 1, q),
        opacity: lerp(f.opacity, 1, q),
        blur: lerp(f.blur, 0, Math.min(1, q * 1.6)),
        shadow: lerp(f.shadow, 0.55, q),
        highlight: lerp(f.highlight, 0, q),
        z: lerp(f.z, 1, q),
        front: f.front || (q > 0.35 && outside) || q > 0.9,
        focus: f.focus * (1 - Math.min(1, q * 3)),
        resolved: clamp((q - 0.6) / 0.35),
      };
    }
  }
  return f;
}

/** Column order: the questions read top-down in a sensible sequence. */
const COLUMN_ORDER: Record<V54Pathway, readonly string[]> = {
  career: ["good-career", "earn", "salary", "grow", "trust-ai", "right-path"],
  abroad: ["study", "university", "abroad"],
};

/** Emergence order: the nearest questions first, then outwards. */
const EMERGE_ORDER = ["right-path", "good-career", "university", "earn", "abroad", "study", "grow", "trust-ai", "salary"];

/** Cards shown in a mode, in emergence order, with their pathway-column slots. */
export function cardsFor(mode: V4Mode): { card: V54Card; idx: number; slot: number }[] {
  const shown = V54_CARDS.filter((c) => c.motion[mode] !== undefined && c.size[mode] !== undefined);
  const order = [...shown].sort((a, b) => EMERGE_ORDER.indexOf(a.id) - EMERGE_ORDER.indexOf(b.id));
  return order.map((card, idx) => ({
    card,
    idx,
    slot: COLUMN_ORDER[card.pathway].filter((id) => shown.some((c) => c.id === id)).indexOf(card.id),
  }));
}

/** The title size for a mode (CSS px at depth 0). */
export const titlePx = (mode: V4Mode) => V54_TITLE_PX[mode];

type FrameHook = (ms: number, t: number, opts?: Record<string, unknown>) => void;

/**
 * Starts the ThoughtMotionController on the V5.3 root. Call AFTER
 * startV4Engine(root) (it follows the engine's QA hook). Returns cleanup.
 */
export function startThoughtMotion(root: HTMLElement, options: { capture?: boolean } = {}): () => void {
  const sticky = root.querySelector<HTMLElement>("[data-nw4-sticky]");
  const scroller = root.querySelector<HTMLElement>("[data-nw4-scroller]");
  if (!sticky || !scroller) return () => {};
  const els = new Map<string, HTMLElement>();
  root.querySelectorAll<HTMLElement>("[data-v54-card]").forEach((el) => els.set(el.dataset.v54Card!, el));
  const fades = Array.from(root.querySelectorAll<HTMLElement>("[data-v54-fade]"));
  const labels = Array.from(root.querySelectorAll<HTMLElement>("[data-v54-label]"));
  const veil = root.querySelector<HTMLElement>("[data-v54-veil]");
  const scene = root.querySelector<HTMLElement>("[data-v54-scene]");

  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
  let reduced = mql.matches;
  // pointer parallax: target and smoothed value, -1..1 on each axis
  const ptr = { tx: 0, ty: 0, x: 0, y: 0 };
  let ptrOn = false;
  let mode: V4Mode = "d";
  let list = cardsFor(mode);
  let raf = 0,
    running = true,
    frozen = false;
  const start = performance.now();
  let skip = false;
  try {
    skip = !options.capture && window.sessionStorage.getItem(INTRO_STORAGE_KEY) === "1";
  } catch {
    /* no storage: play the intro */
  }
  let clockOffset = skip ? V54_EMERGED : 0;
  let ms = clockOffset,
    sS = 0,
    last = start,
    scrollerTop = 0,
    vh = 1;

  // last written size per card: width/height are only touched when they change (clarity), never per orbit frame
  const sizes = new Map<string, string>();

  function layout() {
    vh = sticky!.clientHeight || window.innerHeight;
    mode = stageModeFor(window.innerWidth, vh); // V5.4: same stage rule as the engine adapter
    list = cardsFor(mode);
    scrollerTop = scroller!.getBoundingClientRect().top + window.scrollY;
    root.dataset.v54Mode = mode;
    // header scale: unlike the V4 capsule (never smaller than native), the V5 navigation is part of the
    // approved composition, so it follows the stage both ways (clamped for legibility)
    const W = mode === "d" ? 1440 : 390,
      H = mode === "d" ? 900 : 844;
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const sc = Math.min(vw / W, vh / H);
    const z = clamp(sc, mode === "d" ? 0.62 : 0.85, 2);
    // V5.4: the stage is bottom-anchored and full-bleed; the header aligns with the stage's content
    // columns horizontally and always sits at the top of the viewport
    const ox = (vw - W * sc) / 2;
    const inset = mode === "d" ? 40 : 14;
    root.style.setProperty("--v54-hz", z.toFixed(4));
    root.style.setProperty("--v54-hx", `${((ox + inset * sc) / z).toFixed(2)}px`);
    root.style.setProperty("--v54-hy", `${(((mode === "d" ? 24 : 14) * sc) / z).toFixed(2)}px`);
    root.style.setProperty("--v54-fs", `${titlePx(mode)}px`);
    ptrOn = mode === "d" && fine.matches && !options.capture;
    sizes.clear();
    for (const [id, el] of els) el.style.display = list.some((l) => l.card.id === id) ? "" : "none";
  }

  const scrollUnits = () => Math.max(0, window.scrollY - scrollerTop) / vh;

  function draw() {
    const c = clarityProgress(sS);
    const pointer = ptrOn && !reduced ? { x: ptr.x, y: ptr.y } : undefined;
    let focused = "";
    for (const { card, idx, slot } of list) {
      const el = els.get(card.id);
      if (!el) continue;
      const f = cardFrame({ mode, card, idx, slot, ms, s: sS, reduced, pointer });
      if (f.focus > 0.5) focused = card.id;
      const size = `${f.w.toFixed(1)}x${f.h.toFixed(1)}`;
      if (sizes.get(card.id) !== size) {
        sizes.set(card.id, size);
        el.style.width = `${f.w.toFixed(1)}px`;
        el.style.height = `${f.h.toFixed(1)}px`;
      }
      el.style.transform = `translate3d(${(f.x - f.w / 2).toFixed(1)}px,${(f.y - f.h / 2).toFixed(1)}px,0) perspective(1000px) rotateY(${f.rotY.toFixed(2)}deg) rotateZ(${f.rotZ.toFixed(2)}deg) scale(${f.scale.toFixed(4)})`;
      el.style.opacity = f.opacity.toFixed(3);
      // depth-of-field: quantised so the blur only repaints when it visibly changes; 0 for every near card
      const b = Math.round(f.blur * 10) / 10;
      el.style.filter = b >= 0.1 ? `blur(${b}px)` : "";
      // occlusion: cards behind the student sit under the portrait (z 10), the rest above it; depth orders each group
      el.style.zIndex = String(f.front ? 20 + Math.round((f.z + 1) * 4) : 2 + Math.round((f.z + 1) * 3));
      el.style.setProperty("--v54-sh", f.shadow.toFixed(3));
      el.style.setProperty("--v54-hl", f.highlight.toFixed(3));
      el.style.setProperty("--v54-resolved", f.resolved.toFixed(3));
      el.style.setProperty("--v54-focus", f.focus.toFixed(3));
      el.dataset.resolved = f.resolved > 0.98 ? "true" : "false";
      el.dataset.focus = f.focus > 0.5 ? "true" : "false";
    }
    const settle = reduced ? win(ms, INTRO.photo[0], INTRO.photo[1]) : EOUT(win(ms, 3600, 5600));
    for (const el of fades) el.style.opacity = (settle * (1 - c)).toFixed(3);
    const lp = clamp((c - 0.4) / 0.45);
    for (const l of labels) {
      l.style.opacity = lp.toFixed(3);
      l.style.transform = `translateY(${((1 - EOUT(lp)) * 12).toFixed(1)}px)`;
    }
    if (veil) veil.style.opacity = (c * (mode === "m" ? 0.8 : 0.35)).toFixed(3);
    if (scene) {
      // the horizon fades in with the portrait, settles from a slightly closer view during the reveal, and
      // rises a few px as the questions organise — transform and opacity only; static for reduced motion
      const zoom = reduced ? 1.03 : lerp(V54_SCENE.introScale, 1.03, EOUT(win(ms, 3000, 7600)));
      const rise = reduced ? 0 : -V54_SCENE.scrollRise * c;
      scene.style.opacity = settle.toFixed(3);
      scene.style.transform = `translate3d(0,${rise.toFixed(1)}px,0) scale(${(zoom - 0.015 * c).toFixed(4)})`;
    }
    if (root.dataset.v54Focus !== focused) root.dataset.v54Focus = focused;
    const st = stateFor(ms, sS, c, reduced);
    if (root.dataset.v54State !== st) root.dataset.v54State = st;
  }

  function tick(now: number) {
    raf = 0;
    if (!running || frozen) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ms = now - start + clockOffset;
    const engineIntroMs = skip ? Infinity : now - start;
    const target = engineIntroMs < INTRO.holdScroll ? 0 : scrollUnits();
    sS = reduced ? target : sS + (target - sS) * Math.min(1, dt * 6);
    const pk = Math.min(1, dt * V54_TIMING.parallax.smoothing);
    ptr.x += (ptr.tx - ptr.x) * pk;
    ptr.y += (ptr.ty - ptr.y) * pk;
    if (Math.abs(sS - target) < 1e-4) sS = target;
    if (!skip && scrollUnits() > 4 / vh && ms < INTRO.fastForwardUntil) clockOffset += dt * 1000 * 3;
    draw();
    const heroVisible = sS < V54_CLARITY_SPAN[1] + TRANS;
    if (heroVisible || Math.abs(sS - target) > 1e-4) raf = requestAnimationFrame(tick);
  }
  function wake() {
    if (!raf && running && !frozen) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
  }
  const onScroll = () => wake();
  const onPointer = (e: PointerEvent) => {
    if (!ptrOn || e.pointerType !== "mouse") return;
    ptr.tx = clamp((e.clientX / window.innerWidth) * 2 - 1, -1, 1);
    ptr.ty = clamp((e.clientY / window.innerHeight) * 2 - 1, -1, 1);
    wake();
  };
  const onResize = () => {
    layout();
    draw();
    wake();
  };
  const onMotion = () => {
    reduced = mql.matches;
    draw();
    wake();
  };
  const onVisibility = () => {
    if (document.hidden) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    } else wake();
  };

  layout();
  draw();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("pointermove", onPointer, { passive: true });
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);
  mql.addEventListener("change", onMotion);
  document.addEventListener("visibilitychange", onVisibility);
  wake();

  const w = window as unknown as { __nw4Frame?: FrameHook; __nw54Frame?: FrameHook };
  const engineFrame = options.capture ? w.__nw4Frame : undefined;
  if (engineFrame) {
    w.__nw4Frame = (fms, t, o = {}) => {
      engineFrame(fms, t, o);
      frozen = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      reduced = Boolean(o.reduced) || mql.matches;
      layout();
      ms = fms;
      sS = scrollFromT(t, typeof o.hp === "number" ? o.hp : 0);
      draw();
    };
    w.__nw54Frame = w.__nw4Frame;
  }

  return () => {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("pointermove", onPointer);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("orientationchange", onResize);
    mql.removeEventListener("change", onMotion);
    document.removeEventListener("visibilitychange", onVisibility);
    if (engineFrame) {
      w.__nw4Frame = engineFrame;
      delete w.__nw54Frame;
    }
    delete root.dataset.v54State;
    delete root.dataset.v54Focus;
    if (scene) {
      scene.style.opacity = "";
      scene.style.transform = "";
    }
  };
}
