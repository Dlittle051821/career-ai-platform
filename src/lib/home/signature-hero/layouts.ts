import { buildRibbon, type RibbonGeometry, type RibbonSpec, type Vec2 } from "./geometry";

/**
 * NW08.7 — the two composed ribbon layouts.
 *
 * Not one drawing scaled down: the wide layout (laptop and desktop,
 * ≥1024px) sweeps across the whole hero behind the headline, like the
 * approved reference; the compact layout (phones and tablet portrait) is
 * drawn for a stacked composition — shorter lead line, taller loop, so the
 * photograph stays large on a narrow screen.
 *
 * In both, a thin line starts at a single point, thickens, dips, rises
 * steeply up and to the right (the N-arrow's gesture), crests, falls down
 * the right side turning over to show its underside, and runs back under
 * itself — so the loop it makes is a closed window for photography and its
 * tail passes behind its own base.
 */

export type LayoutKey = "wide" | "compact";

export interface WaypointSpec {
  /** Which pathway this node belongs to (see content.ts). */
  pathway: "career" | "abroad";
  /** Node position along the ribbon (t). */
  t: number;
  /** Label anchor in art-board units (top-left of the label box). Compact layouts show labels in a strip under the art instead. */
  label?: Vec2;
}

export interface Layout {
  key: LayoutKey;
  geometry: RibbonGeometry;
  waypoints: readonly WaypointSpec[];
  /** Where in the lobe (0–1 of the lobe box) a portrait's face should sit. */
  portraitTarget: Vec2;
  /** Mask stroke width, art-board units. */
  maskStroke: number;
}

export const WIDE_SPEC: RibbonSpec = {
  viewBox: [1200, 760],
  points: [
    [24, 712],
    [200, 700],
    [380, 630],
    [470, 624],
    [560, 684],
    [640, 646],
    [700, 470],
    [760, 262],
    [840, 112],
    [960, 52],
    [1080, 92],
    [1146, 230],
    [1146, 430],
    [1088, 590],
    [980, 668],
    [850, 690],
    [742, 672],
    [668, 638],
  ],
  halfWidth: [
    { t: 0, value: 1.1 },
    { t: 0.07, value: 1.6 },
    { t: 0.12, value: 5 },
    { t: 0.165, value: 19 },
    { t: 0.235, value: 27 },
    { t: 0.3, value: 35 },
    { t: 0.45, value: 41 },
    { t: 0.6, value: 43 },
    { t: 0.76, value: 39 },
    { t: 0.88, value: 32 },
    { t: 0.96, value: 22 },
    { t: 1, value: 9 },
  ],
  twist: [
    { t: 0, value: 0 },
    { t: 0.14, value: 0 },
    { t: 0.2, value: -34 },
    { t: 0.236, value: -70 },
    { t: 0.285, value: -30 },
    { t: 0.35, value: -14 },
    { t: 0.46, value: -6 },
    { t: 0.56, value: 0 },
    { t: 0.64, value: 42 },
    { t: 0.7, value: 102 },
    { t: 0.79, value: 160 },
    { t: 1, value: 178 },
  ],
  backFrom: 0.635,
  lobe: { from: 0.27, to: 1 },
  samples: 260,
};

export const COMPACT_SPEC: RibbonSpec = {
  viewBox: [800, 760],
  points: [
    [16, 736],
    [150, 730],
    [250, 712],
    [318, 724],
    [368, 672],
    [410, 500],
    [460, 300],
    [540, 140],
    [640, 72],
    [728, 104],
    [770, 226],
    [772, 420],
    [724, 592],
    [620, 684],
    [500, 704],
    [414, 690],
    [366, 664],
  ],
  halfWidth: [
    { t: 0, value: 1.4 },
    { t: 0.08, value: 2.2 },
    { t: 0.13, value: 8 },
    { t: 0.17, value: 22 },
    { t: 0.25, value: 31 },
    { t: 0.45, value: 35 },
    { t: 0.6, value: 35 },
    { t: 0.8, value: 31 },
    { t: 0.94, value: 22 },
    { t: 1, value: 8 },
  ],
  twist: [
    { t: 0, value: 0 },
    { t: 0.1, value: 0 },
    { t: 0.15, value: -58 },
    { t: 0.2, value: -28 },
    { t: 0.3, value: -12 },
    { t: 0.46, value: -4 },
    { t: 0.52, value: 0 },
    { t: 0.6, value: 44 },
    { t: 0.66, value: 104 },
    { t: 0.74, value: 160 },
    { t: 1, value: 176 },
  ],
  backFrom: 0.595,
  lobe: { from: 0.186, to: 1 },
  samples: 220,
};

export const LAYOUTS: Record<LayoutKey, Layout> = {
  wide: {
    key: "wide",
    geometry: buildRibbon(WIDE_SPEC),
    waypoints: [
      { pathway: "career", t: 0.06, label: [100, 532] },
      { pathway: "abroad", t: 0.1, label: [100, 606] },
    ],
    portraitTarget: [0.5, 0.33],
    maskStroke: 104,
  },
  compact: {
    key: "compact",
    geometry: buildRibbon(COMPACT_SPEC),
    waypoints: [
      { pathway: "career", t: 0.075 },
      { pathway: "abroad", t: 0.11 },
    ],
    portraitTarget: [0.5, 0.34],
    maskStroke: 92,
  },
};
