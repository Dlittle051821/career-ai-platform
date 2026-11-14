/**
 * NW-V5.6.2 — "Where are you in your journey?" (Two Pathways), approved 13 Nov 2026.
 *
 * Copy, destinations and the motion tables of the approved object-only
 * prototype (Discovery: Dreamscape Binoculars · Clarity: Journey Ticket).
 * Every number below is the approved prototype's, unchanged; the controller
 * (two-pathways.ts) and the markup (TwoPathways.tsx) only read them.
 */

/** Existing public routes (verified against src/app/(site) by v562.test.ts). */
export const V562_ROUTES = {
  /** the free Career Discovery flow */
  discovery: "/career-discovery",
  /** the Course Explorer (Study Options, real data, launch countries) */
  clarity: "/courses",
} as const;

export const V562_COPY = {
  kicker: "One platform · Two pathways",
  title: "Where are you in your journey?",
  hint: "Hover, focus or tap a pathway",
  back: "← Both pathways",
  discovery: {
    num: "01",
    eyebrow: "Discovery",
    lines: ["I don’t know", "where to start."],
    identity: "Find a career that suits you.",
    text: "Explore your interests, discover possible careers, understand suitable courses and find a direction that fits your ambitions.",
    list: ["Your interests", "Possible careers", "Suitable courses", "Your direction"],
    cta: "Discover My Path",
    opening: "Career Discovery",
  },
  clarity: {
    num: "02",
    eyebrow: "Clarity",
    lines: ["I know what I", "want to study."],
    identity: "Study in Europe.",
    text: "Explore suitable programmes and universities, compare study options and understand your pathway toward admission.",
    countries: ["Germany", "Ireland", "Netherlands", "France", "Sweden", "Denmark"],
    cta: "Explore Study Options",
    opening: "Study Options",
  },
} as const;

export type V562Path = "discovery" | "clarity";
export type V562Mode = "rest" | "hover-d" | "hover-c" | "exp-d" | "exp-c";

/** Share of the frame taken by Discovery, per state (measured from the approved reference). */
export const SPLIT: Record<V562Mode, number> = { rest: 0.5, "hover-d": 0.64, "hover-c": 0.36, "exp-d": 0.93, "exp-c": 0.07 };
/** Stacked (phone / portrait) layout: activation only, no detail view. */
export const SPLIT_STACKED: Record<V562Mode, number> = { rest: 0.5, "hover-d": 0.66, "hover-c": 0.34, "exp-d": 0.66, "exp-c": 0.34 };
/** Durations (s) and curves of the approved prototype. */
export const DUR = { hover: 0.75, expand: 1.0, swap: 1.0, rest: 0.85, cta: 0.35 } as const;

/* ------------------------------------------------------------------ easing */
// GSAP's power curves, as the prototype used them: power2 = cubic, power3 = quartic.
export const ease = {
  "power2.inOut": (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  "power3.inOut": (t: number) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
  "power2.out": (t: number) => 1 - Math.pow(1 - t, 3),
  "power3.out": (t: number) => 1 - Math.pow(1 - t, 4),
  "power2.in": (t: number) => t * t * t,
} as const;
export type EaseName = keyof typeof ease;

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const smooth = (x: number) => {
  const c = clamp(x);
  return c * c * (3 - 2 * c);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Every visual is a pure function of `split` (prototype `render()`), so interrupted moves never fight. */
export function splitState(s: number, rest = 0.5) {
  const a = clamp((s - rest) / 0.14, -1, 1); // −1 Clarity active … +1 Discovery active (0 at the resting split)
  const expD = clamp((s - 0.64) / 0.29);
  const expC = clamp((0.36 - s) / 0.29);
  return { a, aD: Math.max(a, 0), aC: Math.max(-a, 0), expD, expC };
}

/** Content offset inside a field (desktop): centred while the field is ≤ hover width, back to the edge as it expands. */
export function contentOffset(fieldW: number, W: number, exp: number): number {
  return lerp((Math.min(fieldW, 0.64 * W) - W / 2) * (fieldW < W / 2 ? 0.34 : 0.5), 0, exp);
}

/* ------------------------------------------------------- Discovery object */

/** Design box of the Discovery object (prototype px at 1920 × 1080). */
export const DISC_BOX = { w: 691, h: 497 } as const;
/** Trail origin: the right lens (design px). */
export const DISC_ORIGIN = [252, 403] as const;
/** Lens viewports over the binoculars render, in % of the image (from the render's projected lens circles). */
export const LENSES = [
  { left: 4.136, top: 14.109, width: 31.504, height: 66.367, rot: 6.831 },
  { left: 44.208, top: 21.045, width: 37.064, height: 71.421, rot: 6.831 },
] as const;

export type ChipIcon = "pen" | "flask" | "gear" | "chat" | "plus" | "chart";
/** Career-field chips: [label, icon, x, y (design px), reveal threshold — 0 = visible at rest]. */
export const CHIPS: readonly (readonly [string, ChipIcon, number, number, number])[] = [
  ["Design", "pen", 300, 112, 0],
  ["Science", "flask", 322, 214, 0],
  ["Engineering", "gear", 432, 30, 0.12],
  ["Psychology", "chat", 486, 142, 0.28],
  ["Medicine", "plus", 504, 262, 0.44],
  ["Business", "chart", 446, 384, 0.6],
];
export const CHIP_ICON: Record<ChipIcon, string> = {
  pen: "M4 20l4-1 10-10-3-3L5 16zM14 6l3 3",
  flask: "M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3",
  gear: "M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2",
  chat: "M4 5h16v10H9l-5 4z",
  plus: "M12 5v14M5 12h14",
  chart: "M5 19V11M10 19V6M15 19v-6M20 19V9",
};

/** A chip's trail: from the right lens to the chip, in the trails SVG's 1000 × 700 space. */
export function trailFor(x: number, y: number): { d: string; end: readonly [number, number] } {
  const sx = (DISC_ORIGIN[0] / DISC_BOX.w) * 1000;
  const sy = (DISC_ORIGIN[1] / DISC_BOX.h) * 700;
  const ex = ((x - 6) / DISC_BOX.w) * 1000;
  const ey = ((y + 18) / DISC_BOX.h) * 700;
  const f = (n: number) => +n.toFixed(2);
  return { d: `M${f(sx)} ${f(sy)} C ${f(sx + 40)} ${f(sy - 140)}, ${f(ex - 160)} ${f(ey + 30)}, ${f(ex)} ${f(ey)}`, end: [f(ex), f(ey)] };
}

/** Chip visibility 0…1 (prototype objD). */
export function chipVisibility(threshold: number, objIn: number, reveal: number, aC: number): number {
  return threshold === 0 ? smooth((objIn - 0.35) / 0.65) * (1 - 0.85 * aC) : smooth((reveal - threshold) / 0.3);
}
/** Trail draw-in 0…1 (prototype objD). */
export function trailDraw(threshold: number, chipV: number, reveal: number): number {
  return smooth(threshold === 0 ? chipV : (reveal - threshold + 0.1) / 0.3);
}

/* --------------------------------------------------------- Clarity object */

/** Route cards in DOM (stacking) order — 03 University, 02 Programme, 01 Country: [restX, restY, restRot, activeX, activeY, activeRot] (% / deg). */
export const CARDS = [
  [-6, -30, -6, 2, -36, 0],
  [20, -40, 4, 24, -52, 0],
  [46, -26, 9, 46, -66, 0],
] as const;
export const CARD_LABELS = [
  { tag: "Country", icon: "pin", n: "01" },
  { tag: "Programme", icon: "book", n: "02" },
  { tag: "University", icon: "uni", n: "03" },
] as const;

export function cardPose(i: number, f: number, objIn: number) {
  const c = CARDS[i]!;
  const e = smooth((objIn - 0.2 - i * 0.12) / 0.5);
  return {
    x: lerp(c[0], c[3], f),
    y: lerp(c[1], c[4], f) + (1 - e) * 30,
    r: lerp(c[2], c[5], f),
    opacity: e * (0.9 + 0.1 * f),
    on: f > 0.55 + i * 0.12,
  };
}

/** Ticket route progress (prototype objC); `boost` completes it before the destination transition. */
export function routeProgress(f: number, boost: number): number {
  return Math.min(1, smooth(f) * 0.86 + boost * 0.14);
}

/* ---------------------------------------------------------------- images */

/** Binoculars: original three.js render (render/binoc.html), master 2332 × 1265. */
export const BINOCULARS = {
  w: 2332,
  h: 1265,
  widths: [480, 720, 960, 1280, 1600, 2048, 2332] as const,
  base: "/home-v562/binoculars",
} as const;

export function binocularSrcSet(format: "avif" | "webp"): string {
  return BINOCULARS.widths.map((w) => `${BINOCULARS.base}-${w}.${format} ${w}w`).join(", ");
}

/**
 * Rendered CSS width of the binoculars: split layout 58 % of a 691-unit box (unit = min(vw/1920, vh/1080)),
 * stacked layout 62 % of a 250-unit box (unit = clamp(.88, min(vw/390, vh/844), 1.7)).
 */
export const BINOCULAR_SIZES =
  "(max-width: 699px) 170px, (max-aspect-ratio: 86/100) 264px, min(20.9vw, 37.1vh)";
