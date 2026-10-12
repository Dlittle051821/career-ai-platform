import { useId } from "react";
import { cn } from "@/lib/utils";

interface FinalCtaVistaProps {
  className?: string;
}

/**
 * UX10-H04 "EXACT MATCH TO FINAL APPROVED HOMEPAGE MOCKUP" — the final
 * reference shows the closing dark CTA with a landscape/campus-at-dusk
 * photograph filling its right side (mountains, warm sunset sky, a small
 * standing figure). This repo has no licensed photo of that kind and this
 * project's standing "no unlicensed stock imagery" policy (see
 * CampusSkylineBackdrop.tsx, this same file's own earlier docblock)
 * applies here exactly as it did for the hero — so this is an original,
 * hand-authored inline SVG illustration instead: a warm dusk sky, layered
 * mountain silhouettes, and a small standing figure with a backpack,
 * echoing the reference's composition and warm/cool contrast against the
 * CTA's navy surface without reproducing its photograph or any text
 * annotation (this codebase has a standing rule against the reference's
 * handwritten-caption style — see hero-composition-audit.test.ts's
 * "no handwritten annotation" guard — not reintroduced here either).
 *
 * Purely decorative — unconditionally aria-hidden, same convention as
 * CampusSkylineBackdrop/GeometricBackdrop.
 *
 * UX10-H07 "LOWER HOMEPAGE REFERENCE MATCH" — the panel this illustration
 * fills grows substantially wider (see HomeFinalCTA.tsx's own docblock),
 * changing its own rendered aspect ratio from roughly 2:1 to roughly
 * 3.2:1. The old `viewBox="0 0 520 420"` (a near-square-ish canvas) under
 * `xMidYMax slice` on a much wider/shorter box crops almost the entire
 * upper canvas — the sun, most of the sky gradient, and most of the
 * mountain silhouettes all fell outside the visible slice, which a first
 * implementation pass caught in a direct screenshot comparison against
 * this milestone's own reference (the vista rendered as a near-empty navy
 * void with only a sliver of mountain visible). The fix: the viewBox
 * itself is now `0 0 640 200`, matching the new panel's own rendered
 * aspect ratio, with every element's coordinates redrawn for this wider,
 * shorter canvas rather than relying on `slice` cropping to compensate.
 * The fade mask's radial center also shifts further left (`cx` 30% ->
 * 20%) and its radius grows (78% -> 90%) for a more gradual dissolve into
 * the navy card at the new width. The standing figure becomes a seated
 * one (knees drawn up, resting on the ridge), closer to this milestone's
 * own reference composition — still an original silhouette, no new
 * color, no text, no stock photo.
 */
export function FinalCtaVista({ className }: FinalCtaVistaProps) {
  const uid = useId();
  const skyId = `${uid}-sky`;
  const farId = `${uid}-far`;
  const nearId = `${uid}-near`;
  const fadeId = `${uid}-fade`;
  const maskId = `${uid}-mask`;

  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <svg viewBox="0 0 640 200" preserveAspectRatio="xMidYMax slice" className="h-full w-full">
        <defs>
          <linearGradient id={skyId} x1="0%" y1="0%" x2="6%" y2="100%">
            <stop offset="0%" stopColor="#2c4f8c" />
            <stop offset="40%" stopColor="#c96b4f" />
            <stop offset="72%" stopColor="#e3934f" />
            <stop offset="100%" stopColor="#f4b65c" />
          </linearGradient>
          <linearGradient id={farId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3a5f94" />
            <stop offset="100%" stopColor="#1c3153" />
          </linearGradient>
          <linearGradient id={nearId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#13213d" />
            <stop offset="100%" stopColor="#0b1626" />
          </linearGradient>
          <radialGradient id={fadeId} cx="20%" cy="42%" r="90%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.9" />
            <stop offset="35%" stopColor="#fff" stopOpacity="0.95" />
            <stop offset="70%" stopColor="#fff" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id={maskId}>
            <rect width="640" height="200" fill={`url(#${fadeId})`} />
          </mask>
        </defs>

        <g mask={`url(#${maskId})`}>
          <rect width="640" height="200" fill={`url(#${skyId})`} />

          {/* Sun */}
          <circle cx="420" cy="78" r="30" fill="#ffd58a" opacity="0.85" />

          {/* Distant mountain range */}
          <polygon
            points="0,130 110,80 200,118 290,68 390,122 500,86 640,124 640,200 0,200"
            fill={`url(#${farId})`}
            opacity="0.85"
          />

          {/* Nearer mountain range */}
          <polygon points="0,160 130,108 260,148 370,100 480,148 640,106 640,200 0,200" fill={`url(#${nearId})`} />

          {/* Small campus silhouette on the ridge */}
          <g fill="#0b1626">
            <rect x="300" y="112" width="12" height="26" />
            <polygon points="300,112 306,100 312,112" />
            <rect x="318" y="122" width="9" height="16" />
          </g>

          {/* Seated figure, knees drawn up, resting on the ridge — see
              this file's own UX10-H07 docblock note. */}
          <g transform="translate(398 134)">
            <circle cx="0" cy="-17" r="4.5" fill="#0b1626" />
            <path d="M-4.5 -12 Q0 -15 4.5 -12 L5 -1 Q0 1.5 -5 -1 Z" fill="#0b1626" />
            <rect x="-5.5" y="-9" width="5" height="8" rx="2" fill="#0b1626" opacity="0.9" />
            <path d="M-5 -1.5 Q-9 5 -6.5 9.5 L-1.5 8.5 Q-2.5 2.5 -1.5 -2.5 Z" fill="#0b1626" />
            <path d="M5 -1.5 Q9.5 3.5 7 9 L2 8 Q2.5 2 1 -2.5 Z" fill="#0b1626" />
          </g>
        </g>
      </svg>
    </div>
  );
}
