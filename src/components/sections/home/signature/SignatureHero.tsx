"use client";

import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import { setRegistrationPromptHold } from "@/lib/registration-prompt/event-bus";
import { TIMELINE, easeInOutCubic, windowProgress } from "@/lib/home/signature-hero/timeline";
import { PHOTOGRAPHS } from "@/lib/home/signature-hero/content";
import { SignatureHeroCopy } from "./SignatureHeroCopy";
import { CompactPathways, SignatureRibbonArt } from "./SignatureRibbonArt";
import { SignatureHeroDevBar } from "./SignatureHeroDevBar";
import "./signature-hero.css";

/**
 * NW08.7 — Signature motion homepage hero ("Turn ambition into opportunity.").
 *
 * The motion controller. One scroll-linked value — story progress — drives
 * the whole scene through the pure mapping in
 * src/lib/home/signature-hero/timeline.ts:
 *
 *   1 beginning   a delicate line already lies along the bottom of the page
 *   2 emerges     it thickens into a sculptural ribbon, dips and rises
 *   3 reveal      the ribbon's loop opens onto a photograph (ambition)
 *   4 expands     a campus sweeps in, then the view pans to the city
 *   5 pathways    the two Nextwise pathways appear along the original line
 *   6 continues   a fine thread carries the line into the page below
 *
 * Native scrolling only: the stage is pinned with CSS `position: sticky`
 * inside a taller section; nothing listens to wheel/touch events or calls
 * preventDefault. React renders once — every frame is motion values
 * writing transforms, opacity and mask lengths directly.
 *
 * Reduced motion: no pin and no scroll-linked movement; the finished
 * composition is shown at once (ribbon formed, photograph in place,
 * pathways visible).
 *
 * The headline and actions (SignatureHeroCopy) are plain server-rendered
 * markup, so they are present before any script runs.
 */

const WIDE_QUERY = "(min-width: 1024px)";

function subscribeWide(onChange: () => void) {
  const mql = window.matchMedia(WIDE_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/** null on the server and during hydration; then the real layout. Used only to decide which layout fetches photographs. */
function useLayoutKey(): "wide" | "compact" | null {
  return useSyncExternalStore(
    subscribeWide,
    () => (window.matchMedia(WIDE_QUERY).matches ? "wide" : "compact"),
    () => null,
  );
}

export function SignatureHero({ devControls = false }: { devControls?: boolean }) {
  const headingId = useId();
  const sectionRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion() ?? false;
  const layoutKey = useLayoutKey();

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start 64px", "end end"] });
  const smooth = useSpring(scrollYProgress, { stiffness: 210, damping: 38, mass: 0.45, restDelta: 0.0004 });
  const finished = useMotionValue(1);
  const progress = reduced ? finished : smooth;

  // One-off opening draw of the resting line (time-based, a little over a second). Reduced motion: drawn at once.
  const intro = useMotionValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) {
      intro.set(1);
      return;
    }
    const controls = animate(intro, 1, { duration: 1.3, ease: [0.22, 1, 0.36, 1], delay: 0.15 });
    return () => controls.stop();
  }, [intro, reduced]);

  // Gentle camera settle while the ribbon forms (transform only).
  const camera = useTransform(progress, (p) => easeInOutCubic(windowProgress(p, TIMELINE.camera)));
  const cameraScale = useTransform(camera, (c) => 1.035 - 0.035 * c);
  const cameraY = useTransform(camera, (c) => `${1.2 * (1 - c)}%`);

  // Keep the timed registration prompt from interrupting the story while it is on screen.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || reduced) return;
    const observer = new IntersectionObserver(([entry]) => setRegistrationPromptHold("signature-hero", entry.isIntersecting), { threshold: 0 });
    observer.observe(el);
    return () => {
      observer.disconnect();
      setRegistrationPromptHold("signature-hero", false);
    };
  }, [reduced]);

  return (
    <>
      <section
        ref={sectionRef}
        aria-labelledby={headingId}
        data-signature-hero
        data-motion-mode={reduced ? "reduced" : "animated"}
        className={reduced ? "relative bg-[#FAFAF8]" : "relative h-[250svh] bg-[#FAFAF8] lg:h-[320svh]"}
      >
        <div className={reduced ? "relative h-[calc(100svh-4rem)] min-h-[40rem] overflow-hidden" : "sticky top-16 h-[calc(100svh-4rem)] overflow-hidden"}>
          <SignatureHeroCopy
            headingId={headingId}
            className="px-6 pt-[clamp(1.25rem,4svh,2.5rem)] sm:px-10 lg:absolute lg:left-[max(6vw,2.5rem)] lg:top-[46%] lg:w-[min(40rem,44vw)] lg:-translate-y-1/2 lg:p-0"
          />

          <motion.div
            className="absolute bottom-0 right-[2vw] hidden aspect-[1200/760] h-[min(88svh,calc(100%-0.5rem))] lg:block"
            style={{ scale: cameraScale, y: cameraY, transformOrigin: "100% 100%" }}
          >
            <SignatureRibbonArt layoutKey="wide" progress={progress} intro={intro} active={layoutKey === "wide"} className="absolute inset-0" />
          </motion.div>
          <motion.div
            className="absolute bottom-[3.75rem] right-[3vw] aspect-[800/760] w-[min(118vw,calc((100svh-30rem)*1.0526),46rem)] lg:hidden"
            style={{ scale: cameraScale, transformOrigin: "100% 100%" }}
          >
            <SignatureRibbonArt layoutKey="compact" progress={progress} intro={intro} active={layoutKey === "compact"} className="absolute inset-0" />
          </motion.div>

          <CompactPathways progress={progress} className="absolute inset-x-6 bottom-2 sm:inset-x-10 lg:hidden" />

          {/* What the photographs show, for assistive technology (the art itself is decorative). */}
          <p className="sr-only">
            {PHOTOGRAPHS.portrait.alt} {PHOTOGRAPHS.campus.alt}
          </p>
        </div>
      </section>
      <SignatureThread reduced={reduced} />
      {devControls && !reduced ? <SignatureHeroDevBar progress={smooth} sectionRef={sectionRef} /> : null}
    </>
  );
}

/**
 * Scene 6 — the fine line that started the story continues past the hero
 * and turns towards the next section, so the cinematic opening hands over
 * to the practical page without a hard cut. Positioned with the same box
 * maths as the ribbon art so it lines up with the start point above it.
 */
function SignatureThread({ reduced }: { reduced: boolean }) {
  const draw = reduced ? { initial: false as const } : { initial: { scaleY: 0, opacity: 0 }, whileInView: { scaleY: 1, opacity: 1 }, viewport: { once: true, amount: 0.6 }, transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] as const } };
  return (
    <div aria-hidden="true" className="relative h-20 overflow-hidden bg-[#FAFAF8] lg:h-28">
      <div className="absolute inset-y-0 right-[2vw] hidden w-[calc(min(88svh,calc(100svh-4.5rem))*1.5789)] lg:block">
        <motion.div {...draw} className="absolute left-[2%] top-0 h-[70%] w-[46%] origin-top rounded-bl-[3.5rem] border-b border-l border-[#1454D9]/55" />
        <span className="absolute left-[48%] top-[70%] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1454D9]" />
      </div>
      <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 lg:hidden">
        <motion.div {...draw} className="absolute inset-x-0 top-0 h-[70%] origin-top bg-[#1454D9]/55" />
        <span className="absolute left-1/2 top-[70%] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1454D9]" />
      </div>
    </div>
  );
}
