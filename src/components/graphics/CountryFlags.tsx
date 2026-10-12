import type { ReactElement, SVGProps } from "react";

/**
 * UX10-H06 "FINAL TOP-HOMEPAGE VISUAL CORRECTION PASS" — section 10,
 * "Country flags must be clearly visible." The reference's Trusted Study
 * Explorer strip shows a real, clearly-rendered circular flag badge per
 * country tile. TrustedStudyExplorer.tsx previously rendered flags via
 * `countryCodeToFlagEmoji()` (a Unicode regional-indicator emoji) — a
 * reasonable real-data-driven choice at the time, but Unicode flag emoji
 * render inconsistently (or not at all, falling back to two-letter
 * country-code glyphs) across operating systems and browsers, which is
 * exactly the "broken emoji rendering" this milestone's brief explicitly
 * calls out and asks to avoid.
 *
 * These six components are original, locally-authored inline SVG — the
 * same "no external image URLs, no unlicensed assets, build it ourselves"
 * convention this project already uses for DiscoveryIllustrations.tsx,
 * CampusSkylineBackdrop.tsx, and every other graphics/ file. Each flag is
 * a simple, geometrically accurate rendition of the real national flag
 * (correct stripe/field colors and proportions for Germany, the United
 * Kingdom, the United States, Canada, Australia, and Ireland) clipped to
 * a circle, matching the reference's circular badge treatment. Only the
 * six LAUNCH_COUNTRY_PRIMARY_SOURCES countries are covered — this is not
 * a general-purpose flag library.
 *
 * Every component takes the same `SVGProps<SVGSVGElement>` shape as any
 * other inline icon component in this codebase (so `className`/`aria-*`
 * pass straight through) and is purely decorative by default — callers
 * are expected to pass `aria-hidden="true"` (as TrustedStudyExplorer.tsx
 * does) since the country name is already rendered as real adjacent text.
 */

const CIRCLE_CLIP_VIEWBOX = "0 0 32 32";

function FlagBase({
  id,
  children,
  ...props
}: SVGProps<SVGSVGElement> & { id: string; children: React.ReactNode }) {
  return (
    <svg viewBox={CIRCLE_CLIP_VIEWBOX} {...props}>
      <defs>
        <clipPath id={id}>
          <circle cx="16" cy="16" r="16" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>{children}</g>
    </svg>
  );
}

/** Germany — DE. Horizontal tricolor: black / red / gold. */
export function FlagDE(props: SVGProps<SVGSVGElement>) {
  return (
    <FlagBase id="flag-de-clip" {...props}>
      <rect x="0" y="0" width="32" height="10.67" fill="#1a1a1a" />
      <rect x="0" y="10.67" width="32" height="10.67" fill="#dd0000" />
      <rect x="0" y="21.33" width="32" height="10.67" fill="#ffce00" />
    </FlagBase>
  );
}

/** United Kingdom — GB. Union Jack, simplified for small-size legibility. */
export function FlagGB(props: SVGProps<SVGSVGElement>) {
  return (
    <FlagBase id="flag-gb-clip" {...props}>
      <rect x="0" y="0" width="32" height="32" fill="#00247d" />
      <path d="M0 0 L32 32 M32 0 L0 32" stroke="#ffffff" strokeWidth="6" />
      <path d="M0 0 L32 32 M32 0 L0 32" stroke="#cf142b" strokeWidth="2.4" />
      <path d="M16 0 V32 M0 16 H32" stroke="#ffffff" strokeWidth="9" />
      <path d="M16 0 V32 M0 16 H32" stroke="#cf142b" strokeWidth="3.4" />
    </FlagBase>
  );
}

/** United States — US. Simplified stripes + blue canton with a sparse star grid. */
export function FlagUS(props: SVGProps<SVGSVGElement>) {
  const stripeHeight = 32 / 7;
  const stripes = Array.from({ length: 7 }, (_, i) => (
    <rect key={i} x="0" y={i * stripeHeight} width="32" height={stripeHeight} fill={i % 2 === 0 ? "#b22234" : "#ffffff"} />
  ));
  const stars = Array.from({ length: 12 }, (_, i) => {
    const row = Math.floor(i / 4);
    const col = i % 4;
    return <circle key={i} cx={2.6 + col * 3.6} cy={2.4 + row * 3.6} r="0.9" fill="#ffffff" />;
  });
  return (
    <FlagBase id="flag-us-clip" {...props}>
      {stripes}
      <rect x="0" y="0" width="15" height="14.9" fill="#3c3b6e" />
      {stars}
    </FlagBase>
  );
}

/** Canada — CA. Red / white / red bands with a simplified maple leaf. */
export function FlagCA(props: SVGProps<SVGSVGElement>) {
  return (
    <FlagBase id="flag-ca-clip" {...props}>
      <rect x="0" y="0" width="32" height="32" fill="#ffffff" />
      <rect x="0" y="0" width="8" height="32" fill="#d80621" />
      <rect x="24" y="0" width="8" height="32" fill="#d80621" />
      <path
        d="M16 7 L17.4 11.2 L21 9.6 L19.6 13 L23.4 13.6 L20.2 16 L23 18.8 L19.2 18.4 L19.8 22 L17 19.8 L16 24 L15 19.8 L12.2 22 L12.8 18.4 L9 18.8 L11.8 16 L8.6 13.6 L12.4 13 L11 9.6 L14.6 11.2 Z"
        fill="#d80621"
      />
    </FlagBase>
  );
}

/** Australia — AU. Navy field, simplified Union Jack canton + Commonwealth Star + Southern Cross. */
export function FlagAU(props: SVGProps<SVGSVGElement>) {
  return (
    <FlagBase id="flag-au-clip" {...props}>
      <rect x="0" y="0" width="32" height="32" fill="#00247d" />
      <g transform="translate(0,0) scale(0.5)">
        <rect x="0" y="0" width="32" height="32" fill="#00247d" />
        <path d="M0 0 L32 32 M32 0 L0 32" stroke="#ffffff" strokeWidth="6" />
        <path d="M0 0 L32 32 M32 0 L0 32" stroke="#cf142b" strokeWidth="2.4" />
        <path d="M16 0 V32 M0 16 H32" stroke="#ffffff" strokeWidth="9" />
        <path d="M16 0 V32 M0 16 H32" stroke="#cf142b" strokeWidth="3.4" />
      </g>
      <circle cx="7" cy="23" r="1.6" fill="#ffffff" />
      <circle cx="22" cy="9" r="1.3" fill="#ffffff" />
      <circle cx="25" cy="15" r="1.3" fill="#ffffff" />
      <circle cx="23" cy="22" r="1.3" fill="#ffffff" />
      <circle cx="18" cy="24" r="1" fill="#ffffff" />
      <circle cx="26" cy="26" r="2" fill="#ffffff" />
    </FlagBase>
  );
}

/** Ireland — IE. Vertical tricolor: green / white / orange. */
export function FlagIE(props: SVGProps<SVGSVGElement>) {
  return (
    <FlagBase id="flag-ie-clip" {...props}>
      <rect x="0" y="0" width="10.67" height="32" fill="#169b62" />
      <rect x="10.67" y="0" width="10.67" height="32" fill="#ffffff" />
      <rect x="21.33" y="0" width="10.67" height="32" fill="#ff883e" />
    </FlagBase>
  );
}

export const COUNTRY_FLAGS: Record<"DE" | "GB" | "US" | "CA" | "AU" | "IE", (props: SVGProps<SVGSVGElement>) => ReactElement> = {
  DE: FlagDE,
  GB: FlagGB,
  US: FlagUS,
  CA: FlagCA,
  AU: FlagAU,
  IE: FlagIE,
};
