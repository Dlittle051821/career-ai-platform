import { useId } from "react";

interface IllustrationProps {
  className?: string;
}

/**
 * UX10-H04 "EXACT MATCH TO FINAL APPROVED HOMEPAGE MOCKUP" — four original,
 * hand-authored "3D-style" SVG illustrations for the Discovery Pillars
 * cards, replacing the flat, low-opacity lucide icon each card previously
 * bled off its corner. The final reference shows a large, multi-tone,
 * shaded illustrative object per card (a compass, a stack of books, a
 * globe with a graduation cap, an adviser figure) — not a single-color
 * outline icon — so these are built from scratch as layered shapes with
 * gradient fills, soft highlights, and drop shadows for a lightweight
 * "sticker" depth, entirely in inline SVG. No external image, icon pack,
 * or stock asset — same "original CSS/SVG visuals only" policy this
 * project has followed since UX09/UX10-H03 (CampusSkylineBackdrop,
 * HomeFinalCTA's glow treatment, etc.).
 *
 * Each illustration is purely decorative and unconditionally
 * aria-hidden — DiscoveryPillars.tsx already gives the card's title/
 * description the real accessible content, same convention as every
 * other decorative graphic in this codebase.
 */

export function CompassIllustration({ className }: IllustrationProps) {
  const uid = useId();
  return (
    <svg viewBox="0 0 160 160" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-case`} x1="20%" y1="10%" x2="85%" y2="95%">
          <stop offset="0%" stopColor="#5fa0ff" />
          <stop offset="55%" stopColor="#2f6fe0" />
          <stop offset="100%" stopColor="#1d4fb8" />
        </linearGradient>
        <radialGradient id={`${uid}-face`} cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e7eefc" />
        </radialGradient>
        <linearGradient id={`${uid}-needle`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff6b6b" />
          <stop offset="100%" stopColor="#e23e3e" />
        </linearGradient>
      </defs>
      <ellipse cx="82" cy="140" rx="46" ry="9" fill="#1d3a73" opacity="0.14" />
      <circle cx="80" cy="78" r="58" fill={`url(#${uid}-case)`} />
      <circle cx="80" cy="78" r="58" fill="none" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="2" />
      <circle cx="80" cy="78" r="45" fill={`url(#${uid}-face)`} />
      <circle cx="80" cy="78" r="45" fill="none" stroke="#c3d2ef" strokeWidth="1.5" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <line
          key={deg}
          x1="80"
          y1="38"
          x2="80"
          y2="44"
          stroke="#9fb3dc"
          strokeWidth="2"
          strokeLinecap="round"
          transform={`rotate(${deg} 80 78)`}
        />
      ))}
      <text x="80" y="47" textAnchor="middle" fontSize="9" fontWeight="700" fill="#5b7bc2">N</text>
      <polygon points="80,54 88,78 80,74" fill={`url(#${uid}-needle)`} />
      <polygon points="80,102 72,78 80,82" fill="#ffffff" stroke="#c3d2ef" strokeWidth="1" />
      <circle cx="80" cy="78" r="5.5" fill="#1d4fb8" />
      <circle cx="80" cy="78" r="2.4" fill="#ffffff" />
      <ellipse cx="60" cy="50" rx="18" ry="10" fill="#ffffff" opacity="0.22" />
    </svg>
  );
}

export function BooksIllustration({ className }: IllustrationProps) {
  const uid = useId();
  return (
    <svg viewBox="0 0 160 160" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-teal`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3fcf9e" />
          <stop offset="100%" stopColor="#1f9d78" />
        </linearGradient>
        <linearGradient id={`${uid}-pink`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff8fc6" />
          <stop offset="100%" stopColor="#e0558f" />
        </linearGradient>
        <linearGradient id={`${uid}-purple`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#6d46d6" />
        </linearGradient>
      </defs>
      <ellipse cx="80" cy="138" rx="52" ry="9" fill="#2b2140" opacity="0.12" />

      <g transform="rotate(-6 80 110)">
        <rect x="26" y="104" width="108" height="20" rx="4" fill={`url(#${uid}-teal)`} />
        <rect x="26" y="104" width="108" height="6" rx="3" fill="#ffffff" opacity="0.25" />
      </g>

      <g transform="rotate(4 80 92)">
        <rect x="30" y="76" width="100" height="22" rx="4" fill={`url(#${uid}-pink)`} />
        <rect x="30" y="76" width="100" height="6" rx="3" fill="#ffffff" opacity="0.25" />
      </g>

      <g transform="rotate(-3 80 60)">
        <rect x="34" y="34" width="92" height="36" rx="5" fill={`url(#${uid}-purple)`} />
        <rect x="34" y="34" width="92" height="7" rx="3.5" fill="#ffffff" opacity="0.3" />
        <rect x="44" y="46" width="48" height="4" rx="2" fill="#ffffff" opacity="0.55" />
        <rect x="44" y="55" width="34" height="4" rx="2" fill="#ffffff" opacity="0.4" />
      </g>

      <rect x="118" y="26" width="10" height="34" fill="#ffd166" opacity="0.9" />
      <polygon points="118,60 123,52 128,60" fill="#ffd166" opacity="0.9" />
    </svg>
  );
}

export function GlobeCapIllustration({ className }: IllustrationProps) {
  const uid = useId();
  return (
    <svg viewBox="0 0 160 160" className={className} aria-hidden="true">
      <defs>
        <radialGradient id={`${uid}-globe`} cx="34%" cy="28%" r="80%">
          <stop offset="0%" stopColor="#6fd4c6" />
          <stop offset="55%" stopColor="#2f9fd6" />
          <stop offset="100%" stopColor="#1f6fc2" />
        </radialGradient>
        <linearGradient id={`${uid}-cap`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2b3a66" />
          <stop offset="100%" stopColor="#15213f" />
        </linearGradient>
      </defs>
      <ellipse cx="80" cy="138" rx="48" ry="9" fill="#123055" opacity="0.14" />

      <circle cx="80" cy="92" r="46" fill={`url(#${uid}-globe)`} />
      <g stroke="#ffffff" strokeOpacity="0.4" strokeWidth="1.6" fill="none">
        <ellipse cx="80" cy="92" rx="46" ry="18" />
        <ellipse cx="80" cy="92" rx="22" ry="46" />
        <line x1="34" y1="92" x2="126" y2="92" />
      </g>
      <path
        d="M48 70 Q60 58 76 64 Q70 78 54 84 Q46 78 48 70 Z"
        fill="#ffffff"
        opacity="0.28"
      />
      <path
        d="M90 108 Q104 100 118 110 Q112 124 96 126 Q88 118 90 108 Z"
        fill="#ffffff"
        opacity="0.2"
      />
      <ellipse cx="64" cy="76" rx="14" ry="8" fill="#ffffff" opacity="0.22" />

      <g transform="translate(80 50)">
        <polygon points="0,-18 46,0 0,18 -46,0" fill={`url(#${uid}-cap)`} />
        <polygon points="0,-18 46,0 0,4 -46,0" fill="#000000" opacity="0.1" />
        <rect x="-10" y="-2" width="20" height="13" rx="3" fill="#1b2746" />
        <circle cx="0" cy="-2" r="4" fill="#ffd166" />
        <line x1="0" y1="2" x2="2" y2="26" stroke="#ffd166" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="2.5" cy="28" r="3.2" fill="#ffd166" />
      </g>
    </svg>
  );
}

export function AdviserIllustration({ className }: IllustrationProps) {
  const uid = useId();
  return (
    <svg viewBox="0 0 160 160" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-badge`} x1="15%" y1="5%" x2="90%" y2="95%">
          <stop offset="0%" stopColor="#ffd38a" />
          <stop offset="100%" stopColor="#f6a93f" />
        </linearGradient>
        <linearGradient id={`${uid}-shirt`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5fa0ff" />
          <stop offset="100%" stopColor="#2f6fe0" />
        </linearGradient>
      </defs>
      <ellipse cx="80" cy="140" rx="48" ry="9" fill="#5c3a12" opacity="0.12" />

      <circle cx="80" cy="84" r="58" fill={`url(#${uid}-badge)`} opacity="0.9" />

      {/* shoulders / body */}
      <path d="M38 138 Q80 102 122 138 L122 150 L38 150 Z" fill={`url(#${uid}-shirt)`} />
      {/* head */}
      <circle cx="80" cy="78" r="26" fill="#f4c7a0" />
      {/* simple hair */}
      <path d="M54 72 Q56 48 80 46 Q104 48 106 72 Q98 60 80 60 Q62 60 54 72 Z" fill="#3a2a1f" />
      {/* glasses */}
      <g stroke="#2b3a66" strokeWidth="2.4" fill="none">
        <circle cx="70" cy="80" r="8" />
        <circle cx="92" cy="80" r="8" />
        <line x1="78" y1="80" x2="84" y2="80" />
      </g>
      {/* smile */}
      <path d="M72 92 Q80 98 90 92" stroke="#8a4a2b" strokeWidth="2.2" fill="none" strokeLinecap="round" />

      {/* raised arm + thumbs up */}
      <path d="M112 128 Q128 110 124 90 Q122 82 114 82 Q108 82 108 90 L108 112 Z" fill="#f4c7a0" />
      <g transform="translate(122 84)">
        <rect x="-7" y="-4" width="14" height="18" rx="5" fill="#f4c7a0" />
        <circle cx="0" cy="-8" r="7" fill="#f4c7a0" />
      </g>

      <circle cx="40" cy="44" r="4" fill="#ffffff" opacity="0.6" />
      <circle cx="122" cy="38" r="3" fill="#ffffff" opacity="0.5" />
    </svg>
  );
}
