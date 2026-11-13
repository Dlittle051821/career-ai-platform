/**
 * CIUX-01B — where the global header sits and how large it is, for every
 * public page.
 *
 * The approved V5.4 homepage places its header with the stage geometry in
 * src/lib/home/v54/motion.ts (layout()): the header follows the authored
 * stage (1440 × 900 desktop, 390 × 844 portrait), scaled to the viewport,
 * clamped for legibility, and aligned with the stage's content columns.
 * Internal pages use the same numbers, so the header has the same height,
 * inset and logo position on every route. The homepage engine keeps setting
 * its own variables (--v54-hz/-hx/-hy); this module sets the page-context
 * equivalents (--nwh-z/-x/-y) on <html> before the first paint, through
 * HEADER_GEOMETRY_SCRIPT (no flash, no layout shift).
 *
 * Mode rule = stageModeFor() in src/lib/home/v54/stage.ts: phones (< 700 px)
 * get the portrait stage; wider viewports get whichever stage fills more of
 * the screen. A test checks the two stay in step.
 */
import { stageModeFor } from "@/lib/home/v54/stage";

export type HeaderGeometry = {
  mode: "d" | "m";
  /** zoom applied to the header (its authored size is 86 px desktop, 56 px portrait) */
  z: number;
  /** left/right inset and top offset, in the header's zoomed px (as the homepage engine sets them) */
  x: number;
  y: number;
  /** distance in screen px from the top of the viewport to the header's bottom edge (unscrolled) */
  offset: number;
};

/** Authored header heights (v54 stage px): desktop and portrait. */
export const HEADER_HEIGHT = { d: 86, m: 56 } as const;

export function headerGeometry(vw: number, vh: number): HeaderGeometry {
  const mode = stageModeFor(vw, vh);
  const W = mode === "d" ? 1440 : 390;
  const H = mode === "d" ? 900 : 844;
  const sc = Math.min(vw / W, vh / H);
  const z = Math.min(2, Math.max(mode === "d" ? 0.62 : 0.85, sc));
  const ox = (vw - W * sc) / 2;
  const inset = mode === "d" ? 40 : 14;
  const top = (mode === "d" ? 24 : 14) * sc;
  return {
    mode,
    z: round(z, 4),
    x: round((ox + inset * sc) / z, 2),
    y: round(top / z, 2),
    offset: Math.round(top + HEADER_HEIGHT[mode] * z),
  };
}

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

/**
 * The same calculation as a dependency-free inline script for the site
 * layout. It runs before the header is parsed, sets the variables on <html>
 * and keeps them current on resize. Kept in step with headerGeometry() by
 * src/lib/navigation/header-geometry.test.ts (both are evaluated over a grid
 * of viewports).
 */
export const HEADER_GEOMETRY_SCRIPT = `(function(){var d=document.documentElement;function f(m,w,h){var W=m==="d"?1440:390,H=m==="d"?900:844,s=Math.min(w/W,h/H);return W*s*H*s/Math.max(1,w*h)}function g(w,h){var m=w<700?"m":(f("m",w,h)>f("d",w,h)?"m":"d");var W=m==="d"?1440:390,H=m==="d"?900:844,s=Math.min(w/W,h/H),z=Math.min(2,Math.max(m==="d"?.62:.85,s)),o=(w-W*s)/2,t=(m==="d"?24:14)*s;return{m:m,z:Math.round(z*1e4)/1e4,x:Math.round((o+(m==="d"?40:14)*s)/z*100)/100,y:Math.round(t/z*100)/100,o:Math.round(t+(m==="d"?86:56)*z)}}function a(){var r=g(d.clientWidth||innerWidth,innerHeight),s=d.style;s.setProperty("--nwh-z",r.z);s.setProperty("--nwh-x",r.x+"px");s.setProperty("--nwh-y",r.y+"px");s.setProperty("--nwh-offset",r.o+"px");d.setAttribute("data-nwh-mode",r.m)}a();addEventListener("resize",a,{passive:true});window.__nwhGeometry=g})();`;
