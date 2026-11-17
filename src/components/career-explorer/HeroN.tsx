"use client";

import Image from "next/image";
import { useLayoutEffect, useRef } from "react";
import { MASTER_LOGO } from "@/lib/brand/master-logo";

/**
 * Career Explorer V5 — the Nextwise N entrance (approved, locked).
 *
 * The official N symbol travels from the N of the master logo in the header
 * to its resting place in the hero. Only the N moves: there is no path,
 * line, trail or arrow, and no second N waits in the hero while it flies.
 *
 * How: the N is laid out once, in its final place (so nothing shifts), and a
 * FLIP-style transform plays from the header logo's measured position and
 * size to that place — measured from the real elements at the real viewport,
 * so it holds at every width. X and Y use different easings, which bends
 * the route slightly without drawing anything.
 *
 *   homepage → Career Explorer, or a direct visit   the N flies in
 *   browser back / forward, or a scrolled page       the N is simply there
 *   prefers-reduced-motion                           a short fade, no travel
 *
 * The symbol is the master artwork (MASTER_LOGO.symbol), never redrawn.
 * State is written to the element (data-state) rather than React state, so
 * the server and client markup always match.
 */
const TRAVEL_MS = 1200;
/** The N occupies the left 32% of the horizontal lockup's width, at full height. */
const LOGO_N_SHARE = 0.32;

let arrivedViaHistory = false;
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    arrivedViaHistory = true;
  });
}

function cameFromHistory(): boolean {
  if (arrivedViaHistory) {
    arrivedViaHistory = false;
    return true;
  }
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  return nav?.type === "back_forward" && performance.now() < 4000;
}

function headerLogoN(): DOMRect | null {
  const img = document.querySelector<HTMLElement>("header.nwh .nwh-brand img");
  if (!img) return null;
  const r = img.getBoundingClientRect();
  if (r.width < 8 || r.height < 8) return null;
  return new DOMRect(r.left, r.top, r.width * LOGO_N_SHARE, r.height);
}

export function HeroN() {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const settle = (state: "done" | "fade") => {
      el.dataset.state = state;
    };
    if (cameFromHistory() || window.scrollY > 40) return settle("done");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || typeof el.animate !== "function") return settle("fade");

    const from = headerLogoN();
    const to = el.getBoundingClientRect();
    const x = el.querySelector<HTMLElement>(".ce-n-x");
    const y = el.querySelector<HTMLElement>(".ce-n-y");
    const img = el.querySelector<HTMLElement>("img");
    if (!from || !x || !y || !img || to.width < 8) return settle("fade");

    const dx = from.left - to.left;
    const dy = from.top - to.top;
    const scale = from.height / to.height;
    const timing = { duration: TRAVEL_MS, fill: "both" as const };
    const animations = [
      x.animate([{ transform: `translateX(${dx}px)` }, { transform: "translateX(0)" }], { ...timing, easing: "cubic-bezier(.66, 0, .34, 1)" }),
      y.animate([{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }], { ...timing, easing: "cubic-bezier(.45, 0, .15, 1)" }),
      img.animate([{ transform: `scale(${scale})` }, { transform: "scale(1)" }], { ...timing, easing: "cubic-bezier(.66, 0, .34, 1)" }),
    ];
    el.dataset.state = "run";
    let cancelled = false;
    Promise.all(animations.map((a) => a.finished))
      .then(() => {
        if (cancelled) return;
        animations.forEach((a) => a.cancel());
        settle("done");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      animations.forEach((a) => a.cancel());
    };
  }, []);

  const { src, width, height } = MASTER_LOGO.symbol;
  return (
    <span ref={ref} className="ce-n" data-state="pending" aria-hidden="true">
      <span className="ce-n-x">
        <span className="ce-n-y">
          <Image src={src} alt="" width={width} height={height} sizes="132px" priority draggable={false} />
        </span>
      </span>
    </span>
  );
}
