/**
 * "Watch how it works" — the guided tour, V5.4: it plays the story chapter by
 * chapter through the chapter controller (the same timed, complete
 * transitions a visitor gets from one scroll gesture), pausing on each
 * chapter to read. Any wheel, touch, key or pointer input hands control
 * straight back.
 */
import { LAST } from "@/lib/home/v4/engine";
import type { V54ChapterController } from "./chapters";

export const TOUR_PAUSE_MS = 2600;

export function startTour(root: HTMLElement, chapters: V54ChapterController): () => void {
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-v54-tour]"));
  if (!buttons.length) return () => {};
  let timer = 0;
  let active = false;

  const stop = () => {
    if (!active) return;
    active = false;
    window.clearTimeout(timer);
    root.removeAttribute("data-v54-touring");
  };
  const onInput = () => stop();

  async function run() {
    if (active) return stop();
    active = true;
    root.setAttribute("data-v54-touring", "");
    for (let k = Math.max(1, chapters.current() + 1); k <= LAST && active; k++) {
      await chapters.goTo(k);
      if (!active) return;
      await new Promise<void>((r) => {
        timer = window.setTimeout(r, TOUR_PAUSE_MS);
      });
    }
    stop();
  }

  const onClick = (e: Event) => {
    e.preventDefault();
    void run();
  };
  for (const b of buttons) b.addEventListener("click", onClick);
  const opts = { passive: true } as const;
  window.addEventListener("wheel", onInput, opts);
  window.addEventListener("touchstart", onInput, opts);
  window.addEventListener("keydown", onInput);
  return () => {
    stop();
    for (const b of buttons) b.removeEventListener("click", onClick);
    window.removeEventListener("wheel", onInput);
    window.removeEventListener("touchstart", onInput);
    window.removeEventListener("keydown", onInput);
  };
}
