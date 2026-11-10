"use client";

import { useEffect } from "react";
import { INTRO, INTRO_STORAGE_KEY } from "@/lib/home/v4/engine";
import { startV4Engine } from "@/lib/home/v54/engine";
import { startBackdrop } from "@/lib/home/v54/backdrop";
import { startChapters, type V54ChapterController } from "@/lib/home/v54/chapters";
import { startThoughtMotion } from "@/lib/home/v54/motion";
import { startTour } from "@/lib/home/v54/tour";

/**
 * NW-V5.4 — the page's motion adapter. Starts, in order:
 *   1. the approved engine (V5.4 fork: stage rule + delegated navigation only),
 *   2. the thought-card controller,
 *   3. the full-bleed backdrop (mirrors the engine's scene transitions edge to edge),
 *   4. the chapter controller — the single authority over the story's scroll position,
 *   5. the "Watch how it works" tour, which plays chapters through (4).
 * Everything is reverted on unmount.
 */
export function V54Motion({ rootId }: { rootId: string }) {
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root) return;
    const params = new URLSearchParams(window.location.search);
    const capture = params.has("nw4-capture");
    if (params.get("type") === "b") root.dataset.v54Type = "b";

    let introSeen = false;
    try {
      introSeen = window.sessionStorage.getItem(INTRO_STORAGE_KEY) === "1";
    } catch {
      /* storage unavailable: the intro plays */
    }
    let chapters: V54ChapterController | null = null;
    const stopEngine = startV4Engine(root, {
      capture,
      navigate: (scene, how) => void chapters?.goTo(scene, how),
    });
    const stopMotion = startThoughtMotion(root, { capture });
    const stopBackdrop = startBackdrop(root);
    chapters = startChapters(root, { capture, readyAt: introSeen ? 0 : performance.now() + INTRO.holdScroll });
    const stopTour = startTour(root, chapters);
    root.dataset.v54Ready = "true";
    return () => {
      stopTour();
      chapters?.stop();
      stopBackdrop();
      stopMotion();
      stopEngine();
      delete root.dataset.v54Ready;
    };
  }, [rootId]);
  return null;
}
