"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** How long the V4 engine gets to become ready before the static fallback is shown. */
export const HOMEPAGE_FAILSAFE_DELAY_MS = 4000;

/**
 * CC-22B — mounted once in the public site layout. On pages that contain the
 * V4 homepage root, it marks the root with data-nw4-failsafe if the engine
 * has not set data-nw4-ready within HOMEPAGE_FAILSAFE_DELAY_MS, so
 * src/styles/cc22b-launch-overrides.css can show the static hero instead of
 * a blank stage. It never touches the engine and renders nothing.
 */
export function HomepageFailsafe() {
  const pathname = usePathname();
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const root = document.querySelector<HTMLElement>("[data-nw4-root]");
      if (root && root.dataset.nw4Ready !== "1") root.dataset.nw4Failsafe = "1";
    }, HOMEPAGE_FAILSAFE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [pathname]);
  return null;
}
