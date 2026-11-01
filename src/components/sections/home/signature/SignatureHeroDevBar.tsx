"use client";

import { useRef, useState, type RefObject } from "react";
import { useMotionValueEvent, type MotionValue } from "motion/react";
import { SCENES, sceneAt, scrollTopForProgress } from "@/lib/home/signature-hero/timeline";

/**
 * NW08.7 — preview-only inspection bar for the signature hero. Rendered
 * only by /homepage-preview, which itself answers 404 outside development
 * (src/lib/home/signature-hero/variant.ts). It never ships on `/`.
 *
 * Drives the page's real scroll position, so what you inspect is exactly
 * what a visitor sees. Per-frame readouts are written through refs.
 */
export function SignatureHeroDevBar({ progress, sectionRef }: { progress: MotionValue<number>; sectionRef: RefObject<HTMLElement | null> }) {
  const [open, setOpen] = useState(true);
  const readout = useRef<HTMLSpanElement>(null);
  const range = useRef<HTMLInputElement>(null);
  const dragging = useRef(false);

  useMotionValueEvent(progress, "change", (v) => {
    const scene = SCENES.findIndex((s) => s.id === sceneAt(v));
    if (readout.current) readout.current.textContent = `Scene ${scene + 1} of ${SCENES.length} · ${(v * 100).toFixed(1)}%`;
    if (range.current && !dragging.current) range.current.value = String(Math.round(v * 1000));
  });

  function goTo(p: number, smooth: boolean) {
    const el = sectionRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 64;
    window.scrollTo({ top: scrollTopForProgress(p, top, el.offsetHeight + 64, window.innerHeight), behavior: smooth ? "smooth" : "auto" });
  }

  const button = "rounded-full border border-[#E6E9EF] px-3 py-1.5 hover:bg-[#FAFAF8] focus-visible:outline-2 focus-visible:outline-[#1454D9]";

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[min(23rem,calc(100vw-2rem))] text-[13px] text-[#101827]" data-dev-scrubber>
      {open ? (
        <div className="rounded-2xl border border-[#E6E9EF] bg-white/95 p-3 shadow-[0_8px_30px_rgba(16,24,39,0.08)] backdrop-blur">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">Hero preview</span>
            <span ref={readout} className="tabular-nums text-[#566174]" aria-live="off">
              Scene 1 of {SCENES.length} · 0.0%
            </span>
          </div>
          <label className="sr-only" htmlFor="signature-hero-scrub">
            Hero story progress
          </label>
          <input
            id="signature-hero-scrub"
            ref={range}
            type="range"
            min={0}
            max={1000}
            step={1}
            defaultValue={0}
            className="mt-2 w-full accent-[#1454D9]"
            onPointerDown={() => (dragging.current = true)}
            onPointerUp={() => (dragging.current = false)}
            onBlur={() => (dragging.current = false)}
            onInput={(e) => goTo(Number((e.target as HTMLInputElement).value) / 1000, false)}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button type="button" onClick={() => goTo(0, true)} className={button}>
              Restart
            </button>
            {SCENES.map((s, i) => (
              <button key={s.id} type="button" onClick={() => goTo(i === SCENES.length - 1 ? 1 : (s.range[0] + s.range[1]) / 2, true)} className={button} aria-label={`Jump to scene ${i + 1}: ${s.name}`}>
                {i + 1}
              </button>
            ))}
            <button type="button" onClick={() => setOpen(false)} className="ml-auto rounded-full px-3 py-1.5 text-[#566174] hover:text-[#101827] focus-visible:outline-2 focus-visible:outline-[#1454D9]">
              Hide
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="ml-auto block rounded-full border border-[#E6E9EF] bg-white/95 px-4 py-2 shadow-[0_8px_30px_rgba(16,24,39,0.08)] focus-visible:outline-2 focus-visible:outline-[#1454D9]">
          Hero preview
        </button>
      )}
    </div>
  );
}
