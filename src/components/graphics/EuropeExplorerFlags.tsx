import type { ReactElement, SVGProps } from "react";
import { FlagDE, FlagIE } from "./CountryFlags";
import type { EuropeCountryCode } from "@/data/europe-explorer";

/**
 * UX10-EU01 "Europe Country Explorer" — flag badges for the 4 countries
 * not already covered by `CountryFlags.tsx` (Netherlands, France, Sweden,
 * Denmark). `CountryFlags.tsx` itself is intentionally left untouched —
 * its own docblock scopes it to exactly the 6 M20 LAUNCH_COUNTRY_CODES,
 * and this page's 6-country set only partially overlaps that one (shares
 * Germany/Ireland, drops UK/US/CA/AU, adds these 4) — so rather than
 * widen that file's documented scope, Germany and Ireland's existing
 * `FlagDE`/`FlagIE` are imported and reused here as-is, and only the 4
 * new flags are added. Same "original inline SVG, geometrically accurate,
 * circular-clipped" convention as that file (same `FlagBase` shape,
 * duplicated locally rather than exported from CountryFlags.tsx, to avoid
 * changing that file's own public surface for this one reuse).
 */

const CIRCLE_CLIP_VIEWBOX = "0 0 32 32";

function FlagBase({ id, children, ...props }: SVGProps<SVGSVGElement> & { id: string; children: React.ReactNode }) {
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

/** Netherlands — NL. Horizontal tricolor: red / white / blue. */
export function FlagNL(props: SVGProps<SVGSVGElement>) {
  return (
    <FlagBase id="flag-nl-clip" {...props}>
      <rect x="0" y="0" width="32" height="10.67" fill="#ae1c28" />
      <rect x="0" y="10.67" width="32" height="10.67" fill="#ffffff" />
      <rect x="0" y="21.33" width="32" height="10.67" fill="#21468b" />
    </FlagBase>
  );
}

/** France — FR. Vertical tricolor: blue / white / red. */
export function FlagFR(props: SVGProps<SVGSVGElement>) {
  return (
    <FlagBase id="flag-fr-clip" {...props}>
      <rect x="0" y="0" width="10.67" height="32" fill="#0055a4" />
      <rect x="10.67" y="0" width="10.67" height="32" fill="#ffffff" />
      <rect x="21.33" y="0" width="10.67" height="32" fill="#ef4135" />
    </FlagBase>
  );
}

/** Sweden — SE. Blue field, off-center yellow Nordic cross. */
export function FlagSE(props: SVGProps<SVGSVGElement>) {
  return (
    <FlagBase id="flag-se-clip" {...props}>
      <rect x="0" y="0" width="32" height="32" fill="#006aa7" />
      <rect x="11" y="0" width="5" height="32" fill="#fecc02" />
      <rect x="0" y="13.5" width="32" height="5" fill="#fecc02" />
    </FlagBase>
  );
}

/** Denmark — DK. Red field, off-center white Nordic cross (the Dannebrog). */
export function FlagDK(props: SVGProps<SVGSVGElement>) {
  return (
    <FlagBase id="flag-dk-clip" {...props}>
      <rect x="0" y="0" width="32" height="32" fill="#c8102e" />
      <rect x="11" y="0" width="5" height="32" fill="#ffffff" />
      <rect x="0" y="13.5" width="32" height="5" fill="#ffffff" />
    </FlagBase>
  );
}

export const EUROPE_EXPLORER_FLAGS: Record<EuropeCountryCode, (props: SVGProps<SVGSVGElement>) => ReactElement> = {
  DE: FlagDE,
  IE: FlagIE,
  NL: FlagNL,
  FR: FlagFR,
  SE: FlagSE,
  DK: FlagDK,
};
