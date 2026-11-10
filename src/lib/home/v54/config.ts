/**
 * NW-V5.4 — the single source of truth for the organic thought motion:
 * the student questions, their icons and pathways, each card's own
 * authored path through 3D space (ThoughtMotionConfig), the portrait
 * placement, the clarity columns, the timing and the hero copy.
 *
 * Geometry is in STAGE px (the V4 stage: 1440 × 900 desktop, 390 × 844
 * mobile). Depth z runs from −1 (far behind the student) to 1 (nearest the
 * viewer); z < 0 means the card is behind the portrait layer.
 */
import type { V4Mode } from "@/lib/home/v4/engine";

export const REF_SCALE = 1440 / 1586;
/** reference px → stage px */
export const ref = (v: number) => Math.round(v * REF_SCALE * 10) / 10;

export type V54Pathway = "career" | "abroad";
export type V54Icon = "book" | "cap" | "shield" | "coins" | "check" | "bars" | "trend" | "globe" | "compass";

/** A point a card's path passes through: stage px and depth. */
export type V54Waypoint = readonly [x: number, y: number, z: number];

/**
 * How one card moves. The path is a closed, smooth (Catmull-Rom) loop
 * through the waypoints; each card has its own duration and phase, so no
 * two cards share a trajectory or a rhythm.
 */
export type ThoughtMotionConfig = {
  /** closed loop through these points (first point = where the card is at phase 0) */
  waypoints: readonly V54Waypoint[];
  /** one lap, ms */
  duration: number;
  /** 0…1 — where on its loop the card is when the orbit clock starts */
  phaseOffset: number;
  /** multiplies the depth-driven scale (variation between cards) */
  scaleRange: readonly [min: number, max: number];
  /** perspective turn (rotateY) and in-plane tilt (rotateZ), degrees */
  rotationRange: { yaw: readonly [number, number]; roll: readonly [number, number] };
  /** depth-of-field blur at the focal plane and at the far limit, px */
  blurRange: readonly [min: number, max: number];
  /**
   * "depth": behind the portrait when z < 0, in front when z ≥ 0 (the path
   * only changes sign outside the student's silhouette). "front": always
   * in front (cards that never pass behind him).
   */
  zIndexBehaviour: "depth" | "front";
  /**
   * A moment of focus: near this point of its loop (0…1) the card slows,
   * comes into the focal plane (crisp, slightly larger) and shows the
   * readable; `hold` is the share of the loop it stays in focus. (V5.3: no colour
   * accent — every card keeps the same blue-and-white treatment.)
   */
  focusHold?: { at: number; hold: number };
};

export type V54Card = {
  id: string;
  /** the question, as two balanced lines */
  lines: readonly [string, string];
  /** what Nextwise offers for it — shown once the questions organise (truthful, no figures) */
  answer: string;
  /** the same, short enough for a phone column */
  answerShort: string;
  icon: V54Icon;
  pathway: V54Pathway;
  /** card size at depth 0, desktop and mobile (mobile absent → not shown on phones) */
  size: { d: readonly [w: number, h: number]; m?: readonly [w: number, h: number] };
  motion: { d: ThoughtMotionConfig; m?: ThoughtMotionConfig };
};

const DEPTH: Pick<ThoughtMotionConfig, "blurRange" | "zIndexBehaviour"> = { blurRange: [0, 2.8], zIndexBehaviour: "depth" };
/** Phones: smaller cards and text, so a gentler depth-of-field. */
const DEPTH_M: Pick<ThoughtMotionConfig, "blurRange" | "zIndexBehaviour"> = { blurRange: [0, 1.4], zIndexBehaviour: "depth" };

/**
 * The questions students struggle with BEFORE they find Nextwise. No product
 * names. Career, salary and direction questions resolve into Career
 * Intelligence; university, subject and international-study questions into
 * Study Abroad.
 *
 * Desktop paths were authored on the 1440 × 900 stage around the student's
 * head (face ≈ x 640–870, y 420–640): deliberately asymmetric, at different
 * distances and heights, crossing behind him only beside or above his face.
 */
export const V54_CARDS: readonly V54Card[] = [
  {
    id: "good-career",
    lines: ["Is this a", "good career?"],
    answer: "Careers matched to your profile",
    answerShort: "Matched careers",
    icon: "check",
    pathway: "career",
    size: { d: [262, 96], m: [150, 52] },
    motion: {
      d: { ...DEPTH, waypoints: [[452, 716, 0.85], [334, 680, 0.7], [290, 626, 0.35], [380, 592, 0.25], [478, 666, 0.6]], duration: 26000, phaseOffset: 0.25, scaleRange: [1, 1.06], rotationRange: { yaw: [-16, -6], roll: [-7, -2] }, focusHold: { at: 0.02, hold: 0.12 } },
      m: { ...DEPTH_M, zIndexBehaviour: "front", waypoints: [[102, 718, 0.85], [94, 700, 0.5], [102, 690, 0.35], [122, 710, 0.7]], duration: 22000, phaseOffset: 0.05, scaleRange: [1, 1.04], rotationRange: { yaw: [-14, -6], roll: [-6, -2] }, focusHold: { at: 0.02, hold: 0.14 } },
    },
  },
  {
    id: "earn",
    lines: ["How much", "could I earn?"],
    answer: "Salary potential, per career",
    answerShort: "Salary potential",
    icon: "coins",
    pathway: "career",
    size: { d: [250, 92], m: [146, 50] },
    motion: {
      d: { ...DEPTH, waypoints: [[1066, 592, 0.55], [1136, 646, 0.75], [1058, 702, 0.85], [1020, 636, 0.4]], duration: 22000, phaseOffset: 0.65, scaleRange: [0.98, 1.04], rotationRange: { yaw: [8, 18], roll: [2, 7] }, focusHold: { at: 0.25, hold: 0.12 } },
      m: { ...DEPTH_M, zIndexBehaviour: "front", waypoints: [[290, 712, 0.6], [298, 734, 0.8], [276, 748, 0.7], [262, 724, 0.45]], duration: 19000, phaseOffset: 0.4, scaleRange: [0.98, 1.02], rotationRange: { yaw: [8, 16], roll: [2, 6] } },
    },
  },
  {
    id: "salary",
    lines: ["What’s the", "average salary?"],
    answer: "Compare careers side by side",
    answerShort: "Side by side",
    icon: "bars",
    pathway: "career",
    size: { d: [258, 92] },
    motion: {
      d: { ...DEPTH, waypoints: [[1092, 484, -0.15], [972, 450, -0.55], [790, 428, -0.85], [640, 446, -0.7], [850, 500, -0.6], [1040, 520, -0.3]], duration: 33000, phaseOffset: 0.3, scaleRange: [0.94, 1], rotationRange: { yaw: [10, 22], roll: [3, 9] } },
    },
  },
  {
    id: "trust-ai",
    lines: ["Should I trust", "AI advice?"],
    answer: "AI guidance with clear limits",
    answerShort: "Clear limits",
    icon: "shield",
    pathway: "career",
    size: { d: [256, 92] },
    motion: {
      d: { ...DEPTH, waypoints: [[566, 444, -0.55], [470, 470, -0.2], [392, 436, -0.05], [514, 412, -0.75]], duration: 31000, phaseOffset: 0.62, scaleRange: [0.94, 1], rotationRange: { yaw: [-20, -8], roll: [-9, -4] } },
    },
  },
  {
    id: "grow",
    lines: ["Will this", "career grow?"],
    answer: "Career outlook summaries",
    answerShort: "Career outlooks",
    icon: "trend",
    pathway: "career",
    size: { d: [236, 88] },
    motion: {
      d: { ...DEPTH, waypoints: [[900, 486, -0.9], [1110, 548, -0.45], [1238, 604, -0.08], [1214, 668, -0.2], [1020, 580, -0.75]], duration: 28000, phaseOffset: 0.15, scaleRange: [0.96, 1.02], rotationRange: { yaw: [14, 26], roll: [4, 10] } },
    },
  },
  {
    id: "right-path",
    lines: ["Am I choosing", "the right path?"],
    answer: "A step-by-step plan, explained",
    answerShort: "A clear plan",
    icon: "compass",
    pathway: "career",
    size: { d: [272, 98], m: [158, 54] },
    motion: {
      d: { ...DEPTH, zIndexBehaviour: "front", waypoints: [[666, 790, 0.95], [600, 760, 0.75], [640, 730, 0.6], [730, 770, 0.9]], duration: 23000, phaseOffset: 0.3, scaleRange: [1.02, 1.08], rotationRange: { yaw: [-6, 4], roll: [-3, 2] }, focusHold: { at: 0.0, hold: 0.12 } },
      m: { ...DEPTH_M, zIndexBehaviour: "front", waypoints: [[196, 800, 0.95], [176, 792, 0.8], [214, 788, 0.75]], duration: 21000, phaseOffset: 0.35, scaleRange: [1, 1.04], rotationRange: { yaw: [-4, 4], roll: [-2, 2] }, focusHold: { at: 0.0, hold: 0.14 } },
    },
  },
  {
    id: "university",
    lines: ["Which university", "is right for me?"],
    answer: "Universities & programmes",
    answerShort: "Universities",
    icon: "cap",
    pathway: "abroad",
    size: { d: [270, 98], m: [156, 54] },
    motion: {
      d: { ...DEPTH, waypoints: [[906, 748, 0.9], [984, 728, 0.8], [1008, 774, 0.95], [934, 794, 1.0]], duration: 27000, phaseOffset: 0, scaleRange: [1.02, 1.08], rotationRange: { yaw: [4, 14], roll: [1, 5] }, focusHold: { at: 0.0, hold: 0.12 } },
      m: { ...DEPTH_M, zIndexBehaviour: "front", waypoints: [[284, 404, 0.4], [294, 438, 0.6], [266, 452, 0.45], [252, 418, 0.25]], duration: 24000, phaseOffset: 0.1, scaleRange: [0.98, 1.02], rotationRange: { yaw: [8, 16], roll: [2, 6] }, focusHold: { at: 0.25, hold: 0.14 } },
    },
  },
  {
    id: "study",
    lines: ["What should", "I study?"],
    answer: "Courses behind each career",
    answerShort: "Course pathways",
    icon: "book",
    pathway: "abroad",
    size: { d: [232, 88] },
    motion: {
      d: { ...DEPTH, waypoints: [[232, 452, 0.3], [182, 508, 0.1], [246, 552, 0.45], [318, 482, 0.55]], duration: 21000, phaseOffset: 0.45, scaleRange: [0.96, 1.02], rotationRange: { yaw: [-24, -14], roll: [-10, -5] }, focusHold: { at: 0.75, hold: 0.12 } },
    },
  },
  {
    id: "abroad",
    lines: ["Should I", "study abroad?"],
    answer: "Six European destinations",
    answerShort: "Six destinations",
    icon: "globe",
    pathway: "abroad",
    size: { d: [244, 92], m: [140, 50] },
    motion: {
      d: { ...DEPTH, waypoints: [[936, 474, -0.45], [1104, 476, 0.55], [1182, 436, 0.3], [1064, 410, -0.25]], duration: 25000, phaseOffset: 0.65, scaleRange: [0.98, 1.04], rotationRange: { yaw: [12, 22], roll: [3, 8] }, focusHold: { at: 0.25, hold: 0.12 } },
      m: { ...DEPTH_M, zIndexBehaviour: "front", waypoints: [[80, 574, 0.2], [78, 604, 0.45], [82, 626, 0.3], [84, 592, 0.1]], duration: 20000, phaseOffset: 0.6, scaleRange: [0.98, 1.02], rotationRange: { yaw: [-14, -6], roll: [-6, -2] } },
    },
  },
] as const;

/** The student's head and face in stage px (from the portrait layer), for clearance rules and tests. */
export const V54_HEAD: Record<V4Mode, { cx: number; cy: number; face: { x0: number; x1: number; y0: number; y1: number }; hair: { x0: number; x1: number; y0: number; y1: number } }> = {
  d: { cx: 716, cy: 500, face: { x0: 640, x1: 870, y0: 420, y1: 640 }, hair: { x0: 520, x1: 900, y0: 360, y1: 700 } },
  m: { cx: 214, cy: 560, face: { x0: 159, x1: 326, y0: 509, y1: 669 }, hair: { x0: 60, x1: 345, y0: 465, y1: 690 } },
};

/** Portrait layer (the approved subject, reconstructed from the reference) in stage px. Unchanged since V5. */
export const V54_PORTRAIT: Record<V4Mode, { x: number; y: number; w: number; h: number }> = {
  d: { x: ref(320), y: ref(370), w: ref(930), h: ref(587) },
  m: { x: -95, y: 448, w: 614, h: 387.5 },
};

/** Where the questions line up once they organise (clarity). */
export const V54_COLUMNS: Record<V4Mode, Record<V54Pathway, { x: number; y: number; gap: number; w: number; h: number }>> = {
  d: { career: { x: 296, y: 386, gap: 72, w: 300, h: 64 }, abroad: { x: 1144, y: 458, gap: 72, w: 300, h: 64 } },
  m: { career: { x: 102, y: 530, gap: 64, w: 178, h: 56 }, abroad: { x: 290, y: 562, gap: 64, w: 178, h: 56 } },
};

/** Title size at depth 0, CSS px. */
export const V54_TITLE_PX: Record<V4Mode, number> = { d: 19, m: 12.5 };

export const V54_TIMING = {
  /** the questions emerge from behind the student while he resolves (V4 INTRO.photo = 3150–4700 ms) */
  emerge: 4000,
  emergeStagger: 170,
  emergeDur: 2300,
  /** the reference composition used for the settled screenshot and the reduced-motion frame */
  keyframe: 9000,
  /** the paths' clock starts here (cards are already drifting as they emerge) */
  pathStart: 4000,
  /** how strongly each card slows into its focus moment (0…1) */
  focusDwell: 0.6,
  /** pointer parallax, px at the nearest depth (desktop, fine pointers only) */
  parallax: { x: 14, y: 8, smoothing: 4 },
} as const;

/** Depth response shared by all cards (multiplied by each card's scaleRange). */
export const V54_DEPTH = {
  /** z where cards are sharpest */
  focalPlane: 0.55,
  /** scale at z = −1, −0.3, 0, 0.55, 1 */
  scale: [0.82, 0.93, 0.98, 1.05, 1.16] as const,
  /** below this z a card starts to fade, down to `farOpacity` at z = −1 */
  fadeFrom: -0.35,
  farOpacity: 0.55,
} as const;

/**
 * Electric Coral is an ACTION colour in V5.3: the primary "Get started"
 * buttons (header and hero) and Sign in's hover/focus underline only —
 * never the headline, the question cards or decorative details.
 * Navy text on coral: 5.5:1 (WCAG AA); white on coral would be 3.2:1, so it is not used.
 */
export const V54_ACTION = { primary: "#FF4D6D", primaryText: "#03045F" } as const;

/** The Future Horizon scene behind the student (an original rendered landscape — no people, no landmarks). */
export const V54_SCENE = {
  /** opacity of the scene IMAGE only (the hero itself is never made translucent). The rendered scene is very
   *  pale (mean luminance ≈ 0.88), so 30 % shifts the page by only a few % — measured, see the V5.3 report. */
  opacity: 0.3,
  /** subtle parallax: px the scene rises and the scale it settles to as the questions organise */
  scrollRise: 14,
  /** the scene eases from this scale to 1.03 while the hero reveals, then holds still */
  introScale: 1.06,
} as const;

export const V54_COPY = {
  eyebrow: "From confusion to clarity",
  headline: ["Too many choices.", "One clearer direction"] as const,
  /** the full stop of the second line (set like the first: Ocean Blue, optically hung) */
  headlineStop: ".",
  support: "Nextwise turns your questions, options and ambitions into a clearer path forward.",
  primary: "Get started free",
  secondary: "Watch how it works",
  trust: "Built for students — and for the families who support them.",
  /** the official brand tagline, unchanged wording, once, as a quiet sign-off */
  signature: "Know What’s Next.",
  badge: "EXPLORE · GROW · DECIDE · STUDY · ",
  columns: { career: "Career Intelligence", abroad: "Study Abroad" },
} as const;

/** Typography options for review (?type=b shows B). A is the recommendation. */
export type V54Type = "a" | "b";

/**
 * V5.4 — header navigation and account actions. Every href is an existing
 * route (checked by v54.test.ts against src/app): registration is /register
 * (RegisterForm), log-in is /login (LoginForm keeps its own safe `next` and
 * role-aware default redirect). No auth logic is added here.
 */
export const V54_NAV = [
  { label: "Explore", href: "/careers" },
  { label: "How it works", href: "/how-it-works" },
  { label: "Study Abroad", href: "/abroad" },
  { label: "Pricing", href: "/pricing" },
] as const;

export const V54_ACCOUNT = {
  login: { label: "Log in", href: "/login" },
  signup: { label: "Sign up", href: "/register" },
  start: { label: "Get started free", href: "/register" },
} as const;
