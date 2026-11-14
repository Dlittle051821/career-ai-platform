"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { startTwoPathways } from "@/lib/home/v562/two-pathways";

/**
 * NW-V5.6.2 — starts the Two Pathways controller beside V5.4's own motion
 * adapter (V54Motion: engine, backdrop, chapter controller, tour — all
 * unchanged). The controller only reads the chapter state those publish on
 * the root, and opens the destination routes through the app router so the
 * coral transition lands on the real, already-prefetched page.
 */
export function TwoPathwaysMotion({ rootId }: { rootId: string }) {
  const router = useRouter();
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root) return;
    // The scene is off screen until the visitor reaches chapter 2, so its controller stays out of the
    // page-load critical path: it starts when the browser is idle — or at once if the story starts
    // moving first (or was restored on this chapter).
    let stop: (() => void) | null = null;
    let idle = 0;
    const begin = () => {
      if (stop) return;
      mo.disconnect();
      if (idle) (window.cancelIdleCallback ?? window.clearTimeout)(idle);
      stop = startTwoPathways(root, {
        navigate: (href) => router.push(href),
        prefetch: (href) => router.prefetch(href),
      });
    };
    const mo = new MutationObserver(begin);
    mo.observe(root, { attributes: true, attributeFilter: ["data-v54-moving"] });
    if (root.dataset.v54Chapter === "pathways" || root.dataset.v54Moving) begin();
    else idle = window.requestIdleCallback ? window.requestIdleCallback(begin, { timeout: 2500 }) : window.setTimeout(begin, 1200);
    return () => {
      mo.disconnect();
      if (idle) (window.cancelIdleCallback ?? window.clearTimeout)(idle);
      stop?.();
    };
  }, [rootId, router]);
  return null;
}
