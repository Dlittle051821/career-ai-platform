/**
 * NW08.7 — Signature N-ribbon geometry.
 *
 * Pure, deterministic, framework-free. Turns a short list of control
 * points plus width and twist profiles into everything the renderer needs:
 *
 *  - an arc-length-resampled centreline (so "progress along the ribbon"
 *    means the same thing everywhere on the curve),
 *  - a strip of quads with flat Lambert + Blinn-Phong shading computed for
 *    a ribbon twisting in 3D (a 2D centreline whose width vector rotates
 *    out of the screen plane by the twist angle) — this is what gives the
 *    ribbon real-looking folds, a darker underside and edge highlights
 *    without WebGL,
 *  - the two reveal paths (front and back layers) used as stroke masks,
 *  - the closed "lobe" the ribbon loops around, used to clip photography,
 *  - cover/focal-point placement for images inside that lobe.
 *
 * Everything is computed once per layout (module load), never per frame.
 * Scroll animation only changes mask stroke lengths, transforms and
 * opacity — see SignatureHero.tsx.
 */

export type Vec2 = readonly [number, number];

export interface Stop {
  /** Position along the ribbon, 0–1 (arc-length fraction). */
  t: number;
  value: number;
}

export interface RibbonSpec {
  /** Art-board size; all coordinates below live in this space. */
  viewBox: readonly [number, number];
  /** Control points the centreline passes through, in order. */
  points: readonly Vec2[];
  /** Half-width of the ribbon in art-board units. */
  halfWidth: readonly Stop[];
  /** Rotation of the ribbon's width vector out of the screen plane, degrees. 0 = facing the viewer, 180 = underside facing the viewer. */
  twist: readonly Stop[];
  /** Ribbon after this t is drawn behind the photography (the loop passes behind the image). */
  backFrom: number;
  /** Portion of the centreline that encloses the photographic lobe. */
  lobe: { from: number; to: number };
  /** Number of samples along the ribbon. */
  samples: number;
}

export interface RibbonQuad {
  d: string;
  fill: string;
  /** Mid-t of the quad, for layer assignment and tests. */
  t: number;
  /** True when the underside faces the viewer. */
  underside: boolean;
}

export interface RibbonGeometry {
  spec: RibbonSpec;
  centreline: Vec2[];
  /** Quads drawn in front of the photography. */
  front: RibbonQuad[];
  /** Quads drawn behind the photography. */
  back: RibbonQuad[];
  /** SVG path data for the front and back reveal masks (centreline sub-paths). */
  frontPath: string;
  backPath: string;
  /** Polyline of the ribbon's lit outer edge where it faces the viewer (edge highlight). */
  highlightPath: string;
  /** Closed lobe polygon (centreline between lobe.from and lobe.to), as path data and as points. */
  lobePath: string;
  lobePolygon: Vec2[];
  lobeBox: { x: number; y: number; width: number; height: number };
  /** Largest half-width, for mask stroke sizing. */
  maxHalfWidth: number;
  start: Vec2;
}

// ---------------------------------------------------------------------------
// Small maths helpers
// ---------------------------------------------------------------------------

export function clamp(value: number, min = 0, max = 1): number {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smooth(t: number): number {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
}

/** Piecewise interpolation of a profile with smoothstep easing between stops. */
export function profileAt(stops: readonly Stop[], t: number): number {
  if (stops.length === 0) return 0;
  if (t <= stops[0].t) return stops[0].value;
  for (let i = 1; i < stops.length; i += 1) {
    const a = stops[i - 1];
    const b = stops[i];
    if (t <= b.t) return lerp(a.value, b.value, smooth((t - a.t) / (b.t - a.t || 1)));
  }
  return stops[stops.length - 1].value;
}

const round = (n: number) => Math.round(n * 10) / 10;
const pt = ([x, y]: Vec2) => `${round(x)} ${round(y)}`;

// ---------------------------------------------------------------------------
// Centreline: centripetal Catmull-Rom through the control points, then
// resampled to equal arc-length steps.
// ---------------------------------------------------------------------------

function catmullRom(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, u: number): Vec2 {
  const alpha = 0.5;
  const tj = (ti: number, a: Vec2, b: Vec2) => ti + Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]), alpha) + 1e-6;
  const t0 = 0;
  const t1 = tj(t0, p0, p1);
  const t2 = tj(t1, p1, p2);
  const t3 = tj(t2, p2, p3);
  const t = lerp(t1, t2, u);
  const mix = (a: Vec2, b: Vec2, ta: number, tb: number): Vec2 => [
    ((tb - t) / (tb - ta)) * a[0] + ((t - ta) / (tb - ta)) * b[0],
    ((tb - t) / (tb - ta)) * a[1] + ((t - ta) / (tb - ta)) * b[1],
  ];
  const a1 = mix(p0, p1, t0, t1);
  const a2 = mix(p1, p2, t1, t2);
  const a3 = mix(p2, p3, t2, t3);
  const b1 = mix(a1, a2, t0, t2);
  const b2 = mix(a2, a3, t1, t3);
  return mix(b1, b2, t1, t2);
}

export function sampleCentreline(points: readonly Vec2[], count: number): Vec2[] {
  if (points.length < 2) throw new Error("A ribbon needs at least two control points");
  // Dense raw sampling of the spline.
  const ext: Vec2[] = [
    [2 * points[0][0] - points[1][0], 2 * points[0][1] - points[1][1]],
    ...points,
    [2 * points[points.length - 1][0] - points[points.length - 2][0], 2 * points[points.length - 1][1] - points[points.length - 2][1]],
  ];
  const raw: Vec2[] = [];
  const perSegment = 40;
  for (let i = 1; i < ext.length - 2; i += 1) {
    for (let k = 0; k < perSegment; k += 1) raw.push(catmullRom(ext[i - 1], ext[i], ext[i + 1], ext[i + 2], k / perSegment));
  }
  raw.push(points[points.length - 1]);

  // Cumulative arc length, then resample at equal steps.
  const cumulative = [0];
  for (let i = 1; i < raw.length; i += 1) cumulative.push(cumulative[i - 1] + Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]));
  const total = cumulative[cumulative.length - 1];
  const out: Vec2[] = [];
  let j = 1;
  for (let s = 0; s < count; s += 1) {
    const target = (s / (count - 1)) * total;
    while (j < cumulative.length - 1 && cumulative[j] < target) j += 1;
    const span = cumulative[j] - cumulative[j - 1] || 1;
    const u = (target - cumulative[j - 1]) / span;
    out.push([lerp(raw[j - 1][0], raw[j][0], u), lerp(raw[j - 1][1], raw[j][1], u)]);
  }
  return out;
}

function tangentAt(line: readonly Vec2[], i: number): Vec2 {
  const a = line[Math.max(0, i - 1)];
  const b = line[Math.min(line.length - 1, i + 1)];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  return [dx / len, dy / len];
}

// ---------------------------------------------------------------------------
// Shading
// ---------------------------------------------------------------------------

type RGB = readonly [number, number, number];

const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const toHex = ([r, g, b]: RGB) => `#${[r, g, b].map((c) => Math.round(clamp(c, 0, 255)).toString(16).padStart(2, "0")).join("")}`;
const mixRGB = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/**
 * Surface colours follow the official N-arrow: cyan where the ribbon is
 * young and thin, cobalt as it gains substance, deep navy as it turns
 * away. The underside is always navy.
 */
export const RIBBON_PALETTE = {
  cyan: "#32D5E8",
  cobalt: "#1759F3",
  primary: "#1454D9",
  navy: "#071D4A",
  undersideLight: "#123A9C",
} as const;

const FACE_STOPS: readonly { t: number; c: RGB }[] = [
  { t: 0, c: hex(RIBBON_PALETTE.cyan) },
  { t: 0.3, c: hex("#22B8F0") },
  { t: 0.46, c: hex(RIBBON_PALETTE.cobalt) },
  { t: 0.66, c: hex(RIBBON_PALETTE.primary) },
  { t: 1, c: hex("#0E2F86") },
];

function faceColourAt(t: number): RGB {
  for (let i = 1; i < FACE_STOPS.length; i += 1) {
    if (t <= FACE_STOPS[i].t) return mixRGB(FACE_STOPS[i - 1].c, FACE_STOPS[i].c, (t - FACE_STOPS[i - 1].t) / (FACE_STOPS[i].t - FACE_STOPS[i - 1].t));
  }
  return FACE_STOPS[FACE_STOPS.length - 1].c;
}

/** Light from the upper left, slightly in front of the screen (screen y points down). */
const LIGHT = (() => {
  const v = [-0.38, -0.72, 0.58];
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l] as const;
})();
const HALF = (() => {
  const v = [LIGHT[0], LIGHT[1], LIGHT[2] + 1];
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l] as const;
})();

/**
 * Shade one ribbon element. The width vector is b = cosθ·n + sinθ·ẑ (n is
 * the in-plane normal), so the surface normal is N = T × b. Its z
 * component tells which side faces the viewer.
 */
export function shadeRibbon(tangent: Vec2, twistDeg: number, t: number): { fill: string; underside: boolean; projectedScale: number } {
  const th = (twistDeg * Math.PI) / 180;
  const c = Math.cos(th);
  const s = Math.sin(th);
  const [tx, ty] = tangent;
  const n: Vec2 = [-ty, tx];
  // b = c·(n, 0) + s·(0,0,1);  N = T × b with T = (tx, ty, 0)
  const b = [c * n[0], c * n[1], s];
  let N = [ty * b[2] - 0 * b[1], 0 * b[0] - tx * b[2], tx * b[1] - ty * b[0]];
  const len = Math.hypot(N[0], N[1], N[2]) || 1;
  N = [N[0] / len, N[1] / len, N[2] / len];
  const underside = N[2] < 0;
  if (underside) N = [-N[0], -N[1], -N[2]];

  const diffuse = Math.max(0, N[0] * LIGHT[0] + N[1] * LIGHT[1] + N[2] * LIGHT[2]);
  const spec = Math.pow(Math.max(0, N[0] * HALF[0] + N[1] * HALF[1] + N[2] * HALF[2]), 28);
  const base = underside ? mixRGB(hex(RIBBON_PALETTE.navy), hex(RIBBON_PALETTE.undersideLight), 0.25 + 0.5 * diffuse) : faceColourAt(t);
  const lit = mixRGB([0, 0, 0], base, 0.62 + 0.48 * diffuse);
  const withSpec = mixRGB(lit, [255, 255, 255], (underside ? 0.12 : 0.42) * spec);
  return { fill: toHex(withSpec), underside, projectedScale: c };
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

function pathFrom(points: readonly Vec2[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${pt(p)}`).join(" ");
}

export function buildRibbon(spec: RibbonSpec): RibbonGeometry {
  const line = sampleCentreline(spec.points, spec.samples);
  const count = line.length;
  const ts = line.map((_, i) => i / (count - 1));
  const tangents = line.map((_, i) => tangentAt(line, i));

  const edges = line.map((p, i) => {
    const w = profileAt(spec.halfWidth, ts[i]);
    const twist = profileAt(spec.twist, ts[i]);
    const shade = shadeRibbon(tangents[i], twist, ts[i]);
    const n: Vec2 = [-tangents[i][1], tangents[i][0]];
    const k = w * shade.projectedScale;
    // A tiny floor keeps the ribbon continuous through a fold (no gap at 90°).
    const kk = Math.abs(k) < 0.35 ? (k < 0 ? -0.35 : 0.35) : k;
    return { a: [p[0] + n[0] * kk, p[1] + n[1] * kk] as Vec2, b: [p[0] - n[0] * kk, p[1] - n[1] * kk] as Vec2, shade, w };
  });

  const front: RibbonQuad[] = [];
  const back: RibbonQuad[] = [];
  for (let i = 0; i < count - 1; i += 1) {
    const tMid = (ts[i] + ts[i + 1]) / 2;
    const twist = profileAt(spec.twist, tMid);
    const tan: Vec2 = [(tangents[i][0] + tangents[i + 1][0]) / 2, (tangents[i][1] + tangents[i + 1][1]) / 2];
    const shade = shadeRibbon(tan, twist, tMid);
    const e0 = edges[i];
    const e1 = edges[i + 1];
    const quad: RibbonQuad = { d: `M${pt(e0.a)} L${pt(e1.a)} L${pt(e1.b)} L${pt(e0.b)}Z`, fill: shade.fill, t: tMid, underside: shade.underside };
    (tMid >= spec.backFrom ? back : front).push(quad);
  }

  const splitIndex = Math.round(spec.backFrom * (count - 1));
  const frontPath = pathFrom(line.slice(0, splitIndex + 1));
  const backPath = pathFrom(line.slice(splitIndex));

  // Highlight along the lit (upper) edge where the face is toward the viewer and reasonably wide.
  const highlightPoints: Vec2[] = [];
  const highlightRuns: Vec2[][] = [];
  edges.forEach((e, i) => {
    const visible = !e.shade.underside && e.shade.projectedScale > 0.55 && e.w > 6 && ts[i] < spec.backFrom;
    if (visible) highlightPoints.push(e.a);
    else if (highlightPoints.length) {
      highlightRuns.push(highlightPoints.splice(0));
    }
  });
  if (highlightPoints.length) highlightRuns.push(highlightPoints.splice(0));
  const highlightPath = highlightRuns.filter((r) => r.length > 2).map(pathFrom).join(" ");

  // The photograph is clipped to the centreline where the ribbon passes in front of it (the front
  // band then overlaps the image edge, hiding any seam), and to the band's INNER edge where the
  // ribbon runs behind it, so the back band is never half-covered (no visible step at the layer join).
  const from = Math.round(spec.lobe.from * (count - 1));
  const to = Math.round(spec.lobe.to * (count - 1));
  const centreLobe = line.slice(from, to + 1);
  const cx = centreLobe.reduce((acc, p) => acc + p[0], 0) / centreLobe.length;
  const cy = centreLobe.reduce((acc, p) => acc + p[1], 0) / centreLobe.length;
  // The switch is blended over a short run that is still under the front band, so it never shows.
  const BLEND = 0.05;
  const lobePolygon: Vec2[] = centreLobe.map((p, k) => {
    const i = from + k;
    const mixIn = smooth((ts[i] - (spec.backFrom - BLEND)) / BLEND);
    if (mixIn <= 0) return p;
    const { a, b } = edges[i];
    const inner = Math.hypot(a[0] - cx, a[1] - cy) < Math.hypot(b[0] - cx, b[1] - cy) ? a : b;
    return [lerp(p[0], inner[0], mixIn), lerp(p[1], inner[1], mixIn)];
  });
  const xs = lobePolygon.map((p) => p[0]);
  const ys = lobePolygon.map((p) => p[1]);
  const lobeBox = { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };

  return {
    spec,
    centreline: line,
    front,
    back,
    frontPath,
    backPath,
    highlightPath,
    lobePath: `${pathFrom(lobePolygon)} Z`,
    lobePolygon,
    lobeBox,
    maxHalfWidth: Math.max(...spec.halfWidth.map((s) => s.value)),
    start: line[0],
  };
}

/** Point on the centreline at arc-length fraction t. */
export function pointAt(geometry: RibbonGeometry, t: number): Vec2 {
  const i = Math.round(clamp(t) * (geometry.centreline.length - 1));
  return geometry.centreline[i];
}

// ---------------------------------------------------------------------------
// Lobe tests and image placement
// ---------------------------------------------------------------------------

export function pointInPolygon([x, y]: Vec2, polygon: readonly Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function distanceToPolyline([x, y]: Vec2, polyline: readonly Vec2[]): number {
  let best = Infinity;
  for (let i = 1; i < polyline.length; i += 1) {
    const [ax, ay] = polyline[i - 1];
    const [bx, by] = polyline[i];
    const dx = bx - ax;
    const dy = by - ay;
    const u = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1));
    best = Math.min(best, Math.hypot(x - (ax + u * dx), y - (ay + u * dy)));
  }
  return best;
}

export interface ImagePlacement {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Size an image to cover `box` (scaled by `zoom` ≥ 1), then shift it so the
 * image's focal point (0–1 in image space) lands on `target` (0–1 in box
 * space) — clamped so the image always still covers the box.
 */
export function placeImage(
  box: { x: number; y: number; width: number; height: number },
  imageSize: readonly [number, number],
  focal: Vec2,
  target: Vec2 = [0.5, 0.5],
  zoom = 1,
): ImagePlacement {
  const scale = Math.max(box.width / imageSize[0], box.height / imageSize[1]) * zoom;
  const width = imageSize[0] * scale;
  const height = imageSize[1] * scale;
  const desiredX = box.x + target[0] * box.width - focal[0] * width;
  const desiredY = box.y + target[1] * box.height - focal[1] * height;
  const x = clamp(desiredX, box.x + box.width - width, box.x);
  const y = clamp(desiredY, box.y + box.height - height, box.y);
  return { x, y, width, height };
}

/** Where an image-space point ends up on the art board for a placement. */
export function projectImagePoint(placement: ImagePlacement, point: Vec2): Vec2 {
  return [placement.x + point[0] * placement.width, placement.y + point[1] * placement.height];
}
