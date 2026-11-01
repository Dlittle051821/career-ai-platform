"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { getImageProps } from "next/image";
import { ArrowUpRight } from "lucide-react";
import { motion, useMotionValueEvent, useTransform, type MotionValue } from "motion/react";
import { placeImage, pointAt, projectImagePoint, type Vec2 } from "@/lib/home/signature-hero/geometry";
import { LAYOUTS, type LayoutKey } from "@/lib/home/signature-hero/layouts";
import { PATHWAYS, PHOTOGRAPHS, type PathwayKey } from "@/lib/home/signature-hero/content";
import { TIMELINE, easeInOutCubic, easeOutQuart, revealAt, splitReveal, windowProgress } from "@/lib/home/signature-hero/timeline";
import { cn } from "@/lib/utils";

/**
 * NW08.7 — the sculptural N-ribbon and the photography it holds, for one
 * layout. Everything inside is driven by story progress `p`; nothing here
 * re-renders per frame (motion values write straight to attributes/styles).
 *
 * Layer order (back to front) inside one SVG, so the photograph genuinely
 * sits *inside* the ribbon rather than behind a decorative wave:
 *   ground shadow → back half of the loop (turned, underside showing) →
 *   photographs clipped to the loop → the front ribbon's soft shadow on the
 *   photograph → front ribbon (rise and crest) with edge highlight →
 *   start point and pathway nodes.
 *
 * Photographs are optimised by Next.js (`getImageProps` → /_next/image,
 * WebP, sized to this layout) and drawn as SVG <image> elements, because
 * the ribbon loop clip and the transform-only sweep reveal need them in the
 * same coordinate space as the ribbon. next/image's <img> can't take part
 * in an SVG clip, and an HTML clip-path:url() is less reliable in Safari.
 */

const SWEEP_DIRECTION: Vec2 = (() => {
  const v: Vec2 = [0.56, -1];
  const l = Math.hypot(v[0], v[1]);
  return [v[0] / l, v[1] / l];
})();

function optimisedSrc(src: string, size: readonly [number, number], width: number): string {
  const { props } = getImageProps({ src, alt: "", width, height: Math.round((width * size[1]) / size[0]), quality: 75 });
  // `srcSet` lists the 1x candidate first; the art board is already sized for ~1.5–2x density.
  return props.srcSet?.split(", ")[0]?.split(" ")[0] ?? props.src;
}

const IMAGE_WIDTHS: Record<LayoutKey, { portrait: number; campus: number }> = {
  wide: { portrait: 828, campus: 1200 },
  compact: { portrait: 640, campus: 828 },
};

function useWindow(p: MotionValue<number>, window: readonly [number, number], ease: (t: number) => number = easeInOutCubic) {
  return useTransform(p, (v) => ease(windowProgress(v, window)));
}

function Sweep({
  s,
  id,
  distance,
  centre,
  radius,
  children,
}: {
  s: MotionValue<number>;
  id: string;
  distance: number;
  centre: Vec2;
  radius: number;
  children: React.ReactNode;
}) {
  // Outer group carries a circular clip from far down-left into place; the inner group moves the
  // opposite way so the photograph stays still while its curved edge sweeps across it.
  const ox = useTransform(s, (v) => -SWEEP_DIRECTION[0] * distance * (1 - v));
  const oy = useTransform(s, (v) => -SWEEP_DIRECTION[1] * distance * (1 - v));
  const ix = useTransform(ox, (v) => -v);
  const iy = useTransform(oy, (v) => -v);
  const ring = useTransform(s, (v) => (v <= 0 || v >= 1 ? 0 : Math.min(1, v * 6) * (1 - v * v)));
  const visibility = useTransform(s, (v) => (v <= 0.001 ? "hidden" : "visible"));
  return (
    <motion.g style={{ x: ox, y: oy, visibility }}>
      <g clipPath={`url(#${id})`}>
        <motion.g style={{ x: ix, y: iy }}>{children}</motion.g>
      </g>
      <motion.circle cx={centre[0]} cy={centre[1]} r={radius} fill="none" stroke="url(#nw-sig-sweep-ring)" strokeWidth={7} style={{ opacity: ring }} />
    </motion.g>
  );
}

export function SignatureRibbonArt({
  layoutKey,
  progress,
  intro,
  active,
  className,
}: {
  layoutKey: LayoutKey;
  progress: MotionValue<number>;
  /** 0–1 one-off opening draw of the resting line (time-based, skipped for reduced motion). */
  intro: MotionValue<number>;
  /** Only the layout on screen fetches photographs. */
  active: boolean;
  className?: string;
}) {
  const layout = LAYOUTS[layoutKey];
  const g = layout.geometry;
  const [vw, vh] = g.spec.viewBox;
  const ids = useMemo(
    () => ({
      front: `nw-sig-front-${layoutKey}`,
      back: `nw-sig-back-${layoutKey}`,
      lobe: `nw-sig-lobe-${layoutKey}`,
      sweepA: `nw-sig-sweep-a-${layoutKey}`,
      sweepB: `nw-sig-sweep-b-${layoutKey}`,
      blur: `nw-sig-blur-${layoutKey}`,
    }),
    [layoutKey],
  );

  // --- Photography placement (pure, from geometry) -------------------------------------------
  const box = g.lobeBox;
  const portrait = useMemo(() => placeImage(box, PHOTOGRAPHS.portrait.size, PHOTOGRAPHS.portrait.focal, layout.portraitTarget, 1.06), [box, layout.portraitTarget]);
  const campusFrom = useMemo(() => placeImage(box, PHOTOGRAPHS.campus.size, PHOTOGRAPHS.campus.focal, [0.5, 0.55], 1.08), [box]);
  const campusTo = useMemo(() => placeImage(box, PHOTOGRAPHS.campus.size, PHOTOGRAPHS.campus.panTo, [0.5, 0.56], 1.08), [box]);
  const centre: Vec2 = [box.x + box.width / 2, box.y + box.height / 2];
  const radius = Math.hypot(box.width, box.height) / 2 + 12;
  const sweepDistance = radius * 2 + 24;

  // Load the second photograph only when the story gets near it (one state change, not per frame).
  const [campusWanted, setCampusWanted] = useState(() => progress.get() > 0.24); // already past it: e.g. the static reduced-motion view
  useMotionValueEvent(progress, "change", (v) => {
    if (!campusWanted && v > 0.24) setCampusWanted(true);
  });
  const widths = IMAGE_WIDTHS[layoutKey];
  const portraitHref = active ? optimisedSrc(PHOTOGRAPHS.portrait.src, PHOTOGRAPHS.portrait.size, widths.portrait) : undefined;
  const campusHref = active && campusWanted ? optimisedSrc(PHOTOGRAPHS.campus.src, PHOTOGRAPHS.campus.size, widths.campus) : undefined;

  // --- Ribbon reveal ---------------------------------------------------------------------------
  const reveal = useTransform([progress, intro], ([p, i]: number[]) => Math.max(revealAt(p) * (p > 0.0005 ? 1 : i), TIMELINE.restingReveal * i));
  const frontLength = useTransform(reveal, (r) => splitReveal(r, g.spec.backFrom).front);
  const backLength = useTransform(reveal, (r) => splitReveal(r, g.spec.backFrom).back);
  const backVisibility = useTransform(backLength, (v) => (v <= 0.001 ? "hidden" : "visible"));

  const depth = useWindow(progress, TIMELINE.depth);
  const sPortraitShadow = useWindow(progress, TIMELINE.portraitIn);
  const shadowOpacity = useTransform(depth, (d) => 0.4 * d);
  const highlightOpacity = useTransform(depth, (d) => 0.15 + 0.55 * d);
  const groundShadowOpacity = useTransform(shadowOpacity, (o) => o * (layoutKey === "wide" ? 0.55 : 0.12));
  const selfShadowOpacity = useTransform([shadowOpacity, sPortraitShadow], ([o, s]: number[]) => o * 0.9 * s);

  // --- Photographs -----------------------------------------------------------------------------
  const sPortrait = useWindow(progress, TIMELINE.portraitIn);
  const sCampus = useWindow(progress, TIMELINE.campusIn);
  const drift = useWindow(progress, TIMELINE.portraitDrift, (t) => t);
  const portraitScale = useTransform(drift, (d) => 1.07 - 0.07 * d);
  const portraitY = useTransform(drift, (d) => -10 + 20 * d);
  const pan = useWindow(progress, TIMELINE.campusPan);
  const campusX = useTransform(pan, (v) => (campusTo.x - campusFrom.x) * v);
  const campusScale = useTransform(pan, (v) => 1.04 - 0.04 * v);
  const photoPresence = useTransform(sPortrait, (v) => Math.min(1, v * 2.5));

  // --- Pathways --------------------------------------------------------------------------------
  const pathways = useWindow(progress, TIMELINE.pathways, easeOutQuart);
  const nodeScale = useTransform(pathways, (v) => 0.4 + 0.6 * v);
  const continuation = useWindow(progress, TIMELINE.continuation);

  const start = g.start;
  const faceCheck = PHOTOGRAPHS.portrait.face ? projectImagePoint(portrait, PHOTOGRAPHS.portrait.face.centre) : null;

  return (
    <div className={cn("pointer-events-none", className)} data-signature-art={layoutKey} data-face-x={faceCheck?.[0].toFixed(0)}>
      <svg viewBox={`0 0 ${vw} ${vh}`} className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true" focusable="false">
        <defs>
          <mask id={ids.front} maskUnits="userSpaceOnUse" x={-50} y={-50} width={vw + 100} height={vh + 100}>
            <motion.path d={g.frontPath} fill="none" stroke="#fff" strokeWidth={layout.maskStroke} strokeLinejoin="round" strokeLinecap="round" style={{ pathLength: frontLength }} />
          </mask>
          <mask id={ids.back} maskUnits="userSpaceOnUse" x={-50} y={-50} width={vw + 100} height={vh + 100}>
            <motion.path d={g.backPath} fill="none" stroke="#fff" strokeWidth={layout.maskStroke} strokeLinejoin="round" strokeLinecap="round" style={{ pathLength: backLength }} />
          </mask>
          <clipPath id={ids.lobe} clipPathUnits="userSpaceOnUse">
            <path d={g.lobePath} />
          </clipPath>
          <clipPath id={ids.sweepA} clipPathUnits="userSpaceOnUse">
            <circle cx={centre[0]} cy={centre[1]} r={radius} />
          </clipPath>
          <clipPath id={ids.sweepB} clipPathUnits="userSpaceOnUse">
            <circle cx={centre[0]} cy={centre[1]} r={radius} />
          </clipPath>
          <linearGradient id="nw-sig-sweep-ring" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#32D5E8" />
            <stop offset="0.55" stopColor="#1759F3" />
            <stop offset="1" stopColor="#071D4A" />
          </linearGradient>
          <linearGradient id={`nw-sig-veil-${layoutKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0.55" stopColor="#FAFAF8" stopOpacity="0" />
            <stop offset="1" stopColor="#FAFAF8" stopOpacity="0.55" />
          </linearGradient>
          {layoutKey === "wide" ? (
            <filter id={ids.blur} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="16" />
            </filter>
          ) : null}
        </defs>

        {/* Ground shadow: contact under the loop's base. */}
        <motion.ellipse
          cx={box.x + box.width * 0.45}
          cy={box.y + box.height + 26}
          rx={box.width * 0.62}
          ry={layoutKey === "wide" ? 20 : 14}
          fill="#071D4A"
          filter={layoutKey === "wide" ? `url(#${ids.blur})` : undefined}
          style={{ opacity: groundShadowOpacity }}
        />

        {/* Back half of the loop: turns over and passes behind the photograph. */}
        <motion.g mask={`url(#${ids.back})`} style={{ visibility: backVisibility }}>
          {g.back.map((q, i) => (
            <path key={i} d={q.d} fill={q.fill} stroke={q.fill} strokeWidth={0.8} strokeLinejoin="round" />
          ))}
        </motion.g>

        {/* Photographs inside the loop. */}
        <g clipPath={`url(#${ids.lobe})`}>
          <Sweep s={sPortrait} id={ids.sweepA} distance={sweepDistance} centre={centre} radius={radius}>
            <motion.g style={{ scale: portraitScale, y: portraitY, transformBox: "fill-box", transformOrigin: "50% 40%" }}>
              {portraitHref ? (
                <image href={portraitHref} x={portrait.x} y={portrait.y} width={portrait.width} height={portrait.height} preserveAspectRatio="xMidYMid slice" />
              ) : (
                <rect x={portrait.x} y={portrait.y} width={portrait.width} height={portrait.height} fill="#DCE6F8" />
              )}
            </motion.g>
          </Sweep>
          <Sweep s={sCampus} id={ids.sweepB} distance={sweepDistance} centre={centre} radius={radius}>
            <motion.g style={{ x: campusX, scale: campusScale, transformBox: "fill-box", transformOrigin: "50% 55%" }}>
              {campusHref ? (
                <image href={campusHref} x={campusFrom.x} y={campusFrom.y} width={campusFrom.width} height={campusFrom.height} preserveAspectRatio="xMidYMid slice" />
              ) : (
                <rect x={campusFrom.x} y={campusFrom.y} width={campusFrom.width} height={campusFrom.height} fill="#E3ECFA" />
              )}
            </motion.g>
          </Sweep>
          <motion.rect x={box.x} y={box.y} width={box.width} height={box.height} fill={`url(#nw-sig-veil-${layoutKey})`} style={{ opacity: photoPresence }} />
          {/* The front ribbon's soft shadow falling onto the photograph (self-shadowing). */}
          {layoutKey === "wide" ? (
            <motion.path d={g.frontPath} fill="none" stroke="#071D4A" strokeWidth={g.maxHalfWidth * 1.6} transform="translate(14 16)" filter={`url(#${ids.blur})`} style={{ opacity: selfShadowOpacity }} />
          ) : null}
        </g>

        {/* Front ribbon: the rise and the crest. */}
        <g mask={`url(#${ids.front})`}>
          {g.front.map((q, i) => (
            <path key={i} d={q.d} fill={q.fill} stroke={q.fill} strokeWidth={0.8} strokeLinejoin="round" />
          ))}
          <motion.path d={g.highlightPath} fill="none" stroke="#FFFFFF" strokeWidth={layoutKey === "wide" ? 1.6 : 1.3} strokeLinecap="round" style={{ opacity: highlightOpacity }} />
        </g>

        {/* Where the journey starts, and the thread that carries it into the page below. */}
        <circle cx={start[0]} cy={start[1]} r={layoutKey === "wide" ? 5 : 6} fill="#071D4A" />
        {layoutKey === "wide" ? (
          <motion.path d={`M${start[0]} ${start[1]} L${start[0]} ${vh + 200}`} fill="none" stroke="#1454D9" strokeWidth={1.4} style={{ pathLength: continuation, opacity: continuation }} />
        ) : null}
        {layout.waypoints.map((w) => {
          const [x, y] = pointAt(g, w.t);
          return (
            <motion.g key={w.pathway} style={{ opacity: pathways, scale: nodeScale, transformBox: "fill-box", transformOrigin: "50% 50%" }}>
              <circle cx={x} cy={y} r={layoutKey === "wide" ? 9 : 10} fill="#FFFFFF" stroke="#1454D9" strokeWidth={2} />
              <circle cx={x} cy={y} r={layoutKey === "wide" ? 3.5 : 4} fill="#1454D9" />
            </motion.g>
          );
        })}
      </svg>

      {/* Pathway labels: real links, positioned in the same art-board coordinates as their nodes. */}
      {layout.waypoints.map((w) =>
        w.label ? <PathwayLabel key={w.pathway} pathway={w.pathway} anchor={w.label} viewBox={g.spec.viewBox} progress={pathways} /> : null,
      )}
    </div>
  );
}

function PathwayLabel({ pathway, anchor, viewBox, progress }: { pathway: PathwayKey; anchor: Vec2; viewBox: readonly [number, number]; progress: MotionValue<number> }) {
  const item = PATHWAYS[pathway];
  const y = useTransform(progress, (v) => 10 * (1 - v));
  const visibility = useTransform(progress, (v) => (v < 0.04 ? "hidden" : "visible"));
  return (
    <motion.div
      style={{ left: `${(anchor[0] / viewBox[0]) * 100}%`, top: `${(anchor[1] / viewBox[1]) * 100}%`, opacity: progress, y, visibility }}
      className="pointer-events-auto absolute"
    >
      <Link href={item.href} className="group inline-flex max-w-[15rem] flex-col rounded-md py-1 pr-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1454D9]">
        <span className="inline-flex items-center gap-1 text-[1.02rem] font-semibold text-[#101827] group-hover:text-[#1454D9]">
          {item.label}
          <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0 text-[#1454D9] transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none" />
        </span>
        <span className="text-[0.9rem] text-[#566174]">{item.note}</span>
      </Link>
    </motion.div>
  );
}

/**
 * Phones and tablet portrait: the two pathways sit in a strip directly under the line where the
 * journey starts (their nodes are on that line), rather than over the narrow artwork.
 */
export function CompactPathways({ progress, className }: { progress: MotionValue<number>; className?: string }) {
  const p = useTransform(progress, (v) => easeOutQuart(windowProgress(v, TIMELINE.pathways)));
  const y = useTransform(p, (v) => 8 * (1 - v));
  const visibility = useTransform(p, (v) => (v < 0.04 ? "hidden" : "visible"));
  return (
    <motion.ul style={{ opacity: p, y, visibility }} className={cn("flex flex-wrap items-center gap-x-6 gap-y-1", className)}>
      {(Object.keys(PATHWAYS) as PathwayKey[]).map((key) => (
        <li key={key}>
          <Link href={PATHWAYS[key].href} className="group inline-flex min-h-[44px] items-center gap-1 text-[0.95rem] font-semibold text-[#101827] hover:text-[#1454D9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1454D9]">
            {PATHWAYS[key].label}
            <ArrowUpRight aria-hidden="true" className="h-4 w-4 text-[#1454D9]" />
          </Link>
        </li>
      ))}
    </motion.ul>
  );
}
