/**
 * NW-V5.4 — the full-bleed backdrop.
 *
 * The approved story is composed on a fixed stage that is scaled to fit the
 * viewport; whatever the viewport has beyond it (wider monitors, taller
 * windows) used to be empty page. V5.4 paints each scene's background across
 * the WHOLE viewport, behind the stage, and keeps it in step with the
 * engine's own transitions:
 *
 *   - it never computes a transition itself: it watches the inline styles the
 *     approved engine writes on each scene layer (MutationObserver), and
 *     repeats them in screen space — the same N-tip circle (wipe), the same
 *     rising sheet (rise), the same recede dimming, the same visibility;
 *   - while a wipe circle is still inside the stage it is drawn at exactly
 *     the same size, so the edge of the stage is never visible; once the
 *     stage is fully covered, the circle finishes growing to the viewport's
 *     corners over a short timed ease (and shrinks back first when the
 *     transition is reversed).
 *
 * Panel j sits behind layer j: the stage keeps the content, the backdrop
 * carries the atmosphere edge to edge.
 */
import { clamp } from "@/lib/home/v4/engine";
import { stageGeometry, type V54StageGeometry } from "./stage";

const TAIL_MS = 280;
const CIRCLE = /circle at (-?[\d.]+)px (-?[\d.]+)px, (?:rgb\(0, 0, 0\)|#000) (-?[\d.]+)px/;
const RISE = /translateY\((-?[\d.]+)px\)/;
const RADIUS_Y = /\/\s*(-?[\d.]+)px/;
const BRIGHT = /brightness\((-?[\d.]+)\)/;
const BLUR = /blur\((-?[\d.]+)px\)/;

type Tail = { v: number; target: number; prev: "rest" | "inside" | "full" };

/** Screen-space wipe radius for a stage-space circle (x, y, r): identical while the stage is not yet covered. */
export function wipeRadius(g: V54StageGeometry, x: number, y: number, r: number, tail: number): { cx: number; cy: number; r: number; full: boolean } {
  const rFull = Math.hypot(Math.max(x, g.W - x), Math.max(y, g.H - y)) * 1.02;
  const cx = g.ox + x * g.sc,
    cy = g.oy + y * g.sc;
  const full = r >= rFull - 0.5;
  if (!full) return { cx, cy, r: r * g.sc, full };
  const rView = Math.hypot(Math.max(cx, g.vw - cx), Math.max(cy, g.vh - cy)) + 2;
  return { cx, cy, r: rFull * g.sc + (Math.max(rView, rFull * g.sc) - rFull * g.sc) * tail, full };
}

export function startBackdrop(root: HTMLElement): () => void {
  const backdrop = root.querySelector<HTMLElement>("[data-v54-backdrop]");
  const sticky = root.querySelector<HTMLElement>("[data-nw4-sticky]");
  const stage = root.querySelector<HTMLElement>("[data-nw4-stage]");
  const layers = Array.from(root.querySelectorAll<HTMLElement>(".nw4-layer"));
  const panels = Array.from(root.querySelectorAll<HTMLElement>("[data-v54-panel]"));
  if (!backdrop || !sticky || !stage || panels.length !== layers.length) return () => {};

  let g: V54StageGeometry = stageGeometry(1440, 900);
  const tails: Tail[] = layers.map(() => ({ v: 1, target: 1, prev: "rest" }));
  let raf = 0,
    last = performance.now();

  function layout() {
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = sticky!.clientHeight || window.innerHeight;
    g = stageGeometry(vw, vh, stage!.classList.contains("m") ? "m" : "d");
    backdrop!.style.setProperty("--v54-sc", g.sc.toFixed(5));
    backdrop!.style.setProperty("--v54-oy", `${g.oy.toFixed(2)}px`);
    backdrop!.style.setProperty("--v54-sh", `${(g.H * g.sc).toFixed(2)}px`);
    // the torso continues through the band below the stage (stage px), so the portrait meets the bottom edge
    root.style.setProperty("--v54-band", `${Math.max(0, g.oy / g.sc).toFixed(2)}px`);
  }

  function sync() {
    let animating = false;
    layers.forEach((L, j) => {
      const P = panels[j]!;
      const ls = L.style;
      P.style.visibility = ls.visibility === "hidden" ? "hidden" : "visible";
      P.style.opacity = ls.opacity;
      P.style.zIndex = ls.zIndex;
      // recede: same dimming; only the hero panel carries imagery, so only it is blurred (scaled to screen px)
      const f = ls.filter || "";
      const b = BRIGHT.exec(f);
      const bl = j === 0 ? BLUR.exec(f) : null;
      const pf = [b ? `brightness(${b[1]})` : "", bl ? `blur(${(Number(bl[1]) * g.sc).toFixed(2)}px)` : ""].filter(Boolean).join(" ");
      if (P.style.filter !== (pf || "none")) P.style.filter = pf || "none";

      // wipe: the same circle from the N's arrow tip, in screen space
      const m = CIRCLE.exec(ls.maskImage || ls.webkitMaskImage || "");
      const t = tails[j]!;
      if (m) {
        const x = Number(m[1]),
          y = Number(m[2]),
          r = Number(m[3]);
        const probe = wipeRadius(g, x, y, r, 0);
        if (probe.full) {
          // entering from rest (reverse): shrink to the stage first; entering from inside (forward): grow to the corners
          if (t.prev === "rest") t.target = 0;
          else if (t.prev === "inside") {
            t.target = 1;
            if (t.v > 0.999) t.v = 0;
          }
          t.prev = "full";
        } else {
          t.v = 0;
          t.target = 0;
          t.prev = "inside";
        }
        if (Math.abs(t.v - t.target) > 1e-3) animating = true;
        const w = wipeRadius(g, x, y, r, t.v);
        const mask = `radial-gradient(circle at ${w.cx.toFixed(1)}px ${w.cy.toFixed(1)}px, #000 ${w.r.toFixed(1)}px, transparent ${(w.r + 1.5 * g.sc).toFixed(1)}px)`;
        P.style.maskImage = mask;
        P.style.webkitMaskImage = mask;
      } else {
        t.prev = "rest";
        t.v = 1;
        t.target = 1;
        if (P.style.maskImage) {
          P.style.maskImage = "";
          P.style.webkitMaskImage = "";
        }
      }

      // rise: the sheet's top edge — flat outside the stage, level with the sheet's rounded corners
      const rise = RISE.exec(ls.transform || "");
      if (rise && Number(rise[1]) > 0.01) {
        const ry = RADIUS_Y.exec(ls.borderRadius || "");
        const topPx = g.oy + (Number(rise[1]) + (ry ? Number(ry[1]) : 0)) * g.sc;
        P.style.clipPath = `inset(${clamp(topPx, 0, g.vh).toFixed(1)}px 0 0 0)`;
      } else if (P.style.clipPath) P.style.clipPath = "";
    });
    return animating;
  }

  function tick(now: number) {
    raf = 0;
    const dt = Math.min(64, now - last);
    last = now;
    for (const t of tails) {
      if (t.v < t.target) t.v = Math.min(t.target, t.v + dt / TAIL_MS);
      else if (t.v > t.target) t.v = Math.max(t.target, t.v - dt / TAIL_MS);
    }
    if (sync()) raf = requestAnimationFrame(tick);
  }
  const wake = () => {
    if (sync() && !raf) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
  };

  const mo = new MutationObserver(wake);
  for (const L of layers) mo.observe(L, { attributes: true, attributeFilter: ["style"] });
  const so = new MutationObserver(() => {
    layout();
    wake();
  });
  so.observe(stage, { attributes: true, attributeFilter: ["class", "style"] });
  const onResize = () => {
    layout();
    wake();
  };
  window.addEventListener("resize", onResize);
  layout();
  wake();
  root.dataset.v54Backdrop = "ready";

  return () => {
    mo.disconnect();
    so.disconnect();
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", onResize);
    delete root.dataset.v54Backdrop;
    root.style.removeProperty("--v54-band");
  };
}
