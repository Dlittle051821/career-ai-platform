/**
 * NW08.7 — scroll-progress mapping for the signature homepage hero.
 *
 * One number drives everything: story progress p (0 at the top of the
 * hero, 1 when its pinned stage releases). Every visual value is a pure
 * function of p, so scrolling back replays the story exactly in reverse.
 * Kept here as data so the choreography can be reviewed and tested
 * without a browser.
 */

export type Window = readonly [number, number];

export const SCENES = [
  { id: "beginning", name: "The beginning", range: [0, 0.1] },
  { id: "emerges", name: "The ribbon emerges", range: [0.1, 0.3] },
  { id: "reveal", name: "The photographic reveal", range: [0.3, 0.5] },
  { id: "expands", name: "The dream expands", range: [0.5, 0.8] },
  { id: "pathways", name: "The path becomes clear", range: [0.8, 0.95] },
  { id: "continuation", name: "Into the homepage", range: [0.95, 1] },
] as const satisfies readonly { id: string; name: string; range: Window }[];

export type SceneId = (typeof SCENES)[number]["id"];

export const TIMELINE = {
  /** How far along the ribbon (t) is drawn before any scrolling: the delicate opening line. */
  restingReveal: 0.11,
  /** Ribbon reveal sweeps from restingReveal to the end of the ribbon. */
  reveal: [0.02, 0.4],
  /** Gentle camera settle while the ribbon forms. */
  camera: [0, 0.44],
  /** Shadows and the edge highlight gain strength as the ribbon gains substance. */
  depth: [0.2, 0.42],
  /** First photograph (ambition) sweeps into the lobe. */
  portraitIn: [0.27, 0.39],
  /** Slow photographic drift while framed. */
  portraitDrift: [0.27, 0.66],
  /** Second photograph (educational opportunity) sweeps in over the first. */
  campusIn: [0.58, 0.69],
  /** Spatial pan across the campus towards the city: international possibility. */
  campusPan: [0.7, 0.85],
  /** The two pathways appear along the line where the journey began. */
  pathways: [0.84, 0.93],
  /** The continuation thread is drawn into the next section. */
  continuation: [0.93, 1],
} as const satisfies Record<string, Window | number>;

/** Height of the pinned story, in small-viewport-height units, per layout. Phones get a shorter pin. */
export const STORY_HEIGHT_SVH = { wide: 320, compact: 250 } as const;

export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** Local 0–1 progress of p within a window. */
export function windowProgress(p: number, [start, end]: Window): number {
  if (end <= start) return p >= end ? 1 : 0;
  return clamp01((p - start) / (end - start));
}

export function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - clamp01(t), 4);
}

/** How far along the ribbon (0–1 of its length) is drawn at story progress p. */
export function revealAt(p: number): number {
  const local = easeInOutCubic(windowProgress(p, TIMELINE.reveal));
  return TIMELINE.restingReveal + (1 - TIMELINE.restingReveal) * local;
}

/**
 * Split a ribbon-wide reveal into the two mask lengths: the front layer
 * covers t ∈ [0, backFrom], the back layer t ∈ [backFrom, 1]. Each mask is
 * a pathLength fraction of its own sub-path.
 */
export function splitReveal(reveal: number, backFrom: number): { front: number; back: number } {
  const r = clamp01(reveal);
  return { front: clamp01(r / backFrom), back: clamp01((r - backFrom) / (1 - backFrom)) };
}

export function sceneAt(p: number): SceneId {
  const x = clamp01(p);
  for (let i = SCENES.length - 1; i >= 0; i -= 1) if (x >= SCENES[i].range[0]) return SCENES[i].id;
  return SCENES[0].id;
}

/** Scroll position (px) that puts a story of the given geometry at progress p. Used by the preview-only dev bar. */
export function scrollTopForProgress(p: number, storyTop: number, storyHeight: number, viewportHeight: number): number {
  return Math.round(storyTop + clamp01(p) * Math.max(0, storyHeight - viewportHeight));
}
