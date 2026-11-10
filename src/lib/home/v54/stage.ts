/**
 * NW-V5.4 — stage geometry shared by the engine adapter, the thought-card
 * controller, the full-bleed backdrop and the chapter controller.
 *
 * The approved story is authored on two fixed stages (desktop 1440 × 900,
 * portrait 390 × 844) and scaled to fit the viewport. V5.3 framed that stage
 * as a "website inside a website". V5.4 keeps the authored stage for the
 * content (so every N position, card path and scene layout stays exactly as
 * approved) but:
 *   - chooses the stage that fills more of the viewport, so a portrait tablet
 *     gets the portrait composition instead of a 768 × 480 strip;
 *   - centres the stage, splitting any spare height above and below, and
 *     continues the student's torso through the band below (v54.css,
 *     --v54-band), so the portrait always meets the bottom edge;
 *   - paints every scene's background edge to edge behind the stage
 *     (src/lib/home/v54/backdrop.ts).
 */
import { MOBILE_MAX_WIDTH, STAGE } from "@/lib/home/v4/engine";
import type { V4Mode } from "@/lib/home/v4/engine";

export type V54StageGeometry = {
  mode: V4Mode;
  /** stage size in stage px */
  W: number;
  H: number;
  /** stage → screen scale */
  sc: number;
  /** screen position of the stage's top-left corner */
  ox: number;
  oy: number;
  /** viewport (sticky) size in screen px */
  vw: number;
  vh: number;
};

/** Fraction of the viewport a stage covers when it is scaled to fit. */
export function stageFill(mode: V4Mode, vw: number, vh: number): number {
  const { w, h } = STAGE[mode];
  const sc = Math.min(vw / w, vh / h);
  return (w * sc * h * sc) / Math.max(1, vw * vh);
}

/**
 * Phones (narrower than 700 px) always get the portrait stage, as in V5.3.
 * Wider viewports get whichever stage fills more of the screen: a 768 × 1024
 * tablet now shows the portrait composition (62 % filled instead of 47 %);
 * landscape tablets, laptops and monitors keep the desktop composition.
 */
export function stageModeFor(vw: number, vh: number): V4Mode {
  if (vw < MOBILE_MAX_WIDTH) return "m";
  return stageFill("m", vw, vh) > stageFill("d", vw, vh) ? "m" : "d";
}

/** Centred stage placement (the engine's own flex centring); `band` is the spare height below the stage, in stage px. */
export function stageGeometry(vw: number, vh: number, mode: V4Mode = stageModeFor(vw, vh)): V54StageGeometry {
  const W = STAGE[mode].w,
    H = STAGE[mode].h;
  const sc = Math.min(vw / W, vh / H);
  return { mode, W, H, sc, ox: (vw - W * sc) / 2, oy: (vh - H * sc) / 2, vw, vh };
}
