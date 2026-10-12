import { useId } from "react";
import { cn } from "@/lib/utils";

interface CampusSkylineBackdropProps {
  className?: string;
}

/**
 * UX10-H03 "Exact Homepage Reference Match" — the hero's new atmospheric
 * backdrop. The reference image's hero has a photographic sky + campus/
 * city skyline filling the right half of the scene behind the student.
 * No such photograph exists in this repo, and this project's established,
 * repeatedly-documented policy (HomeFinalCTA.tsx, OrbitJourney.tsx, every
 * prior milestone's own completion report) is "no unlicensed stock
 * imagery" — so rather than fetch one, this reproduces the reference's
 * FEEL (pale blue sky, soft clouds, a academic-building skyline silhouette,
 * organic depth) as an original, hand-authored inline SVG illustration —
 * the same "simple CSS/SVG visuals, do not use unlicensed external
 * images" instruction this milestone's own brief gives for the feature
 * cards, applied here to the hero background too.
 *
 * Purely decorative — unconditionally aria-hidden, same convention as
 * GeometricBackdrop.tsx (no meaningful variant of a background exists).
 * The whole illustration fades to transparent on its left/bottom edges
 * via a radial mask, so it reads as one continuous atmospheric scene
 * blending into the page's off-white background rather than a rectangular
 * photo tile — "no obvious rectangular photo boundary," per the brief.
 */
export function CampusSkylineBackdrop({ className }: CampusSkylineBackdropProps) {
  const uid = useId();
  const skyId = `${uid}-sky`;
  const fadeId = `${uid}-fade`;
  const maskId = `${uid}-mask`;

  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <svg viewBox="0 0 1200 760" preserveAspectRatio="xMidYMax slice" className="h-full w-full">
        <defs>
          <linearGradient id={skyId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--surface-soft-cyan)" />
            <stop offset="55%" stopColor="var(--surface-soft-blue)" />
            <stop offset="100%" stopColor="var(--color-background)" />
          </linearGradient>
          <radialGradient id={fadeId} cx="62%" cy="40%" r="95%">
            <stop offset="0%" stopColor="#fff" stopOpacity="1" />
            <stop offset="55%" stopColor="#fff" stopOpacity="0.92" />
            <stop offset="80%" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id={maskId}>
            <rect width="1200" height="760" fill={`url(#${fadeId})`} />
          </mask>
        </defs>

        <g mask={`url(#${maskId})`}>
          <rect width="1200" height="760" fill={`url(#${skyId})`} />

          {/* Soft cloud washes */}
          <g fill="#ffffff" opacity="0.55">
            <ellipse cx="260" cy="150" rx="150" ry="36" />
            <ellipse cx="520" cy="90" rx="110" ry="28" />
            <ellipse cx="880" cy="170" rx="170" ry="40" />
            <ellipse cx="1040" cy="95" rx="95" ry="24" />
          </g>

          {/* Distant tree line */}
          <g fill="var(--surface-soft-mint-strong)" opacity="0.18">
            <circle cx="120" cy="560" r="60" />
            <circle cx="210" cy="580" r="78" />
            <circle cx="960" cy="570" r="70" />
            <circle cx="1080" cy="590" r="90" />
          </g>

          {/* Campus / city skyline silhouette, anchored to the bottom edge */}
          <g fill="var(--brand-ink)" opacity="0.16">
            <rect x="60" y="430" width="90" height="190" />
            <rect x="170" y="470" width="70" height="150" />
            <rect x="860" y="400" width="80" height="220" />
            <rect x="960" y="460" width="60" height="160" />
            <rect x="1040" y="420" width="100" height="200" />
            {/* A single taller spired building, echoing the reference's
                academic/collegiate tower */}
            <rect x="700" y="340" width="64" height="280" />
            <polygon points="700,340 732,280 764,340" />
            <rect x="722" y="300" width="20" height="28" />
            {/* A low domed building, echoing the reference's rotunda */}
            <rect x="420" y="520" width="140" height="100" />
            <path d="M420,520 a70,70 0 0 1 140,0 Z" />
          </g>
        </g>
      </svg>
    </div>
  );
}
