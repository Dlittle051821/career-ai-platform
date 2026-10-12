import Link from "next/link";
import Image from "next/image";
import { BRAND_LOGO, BRAND_NAME } from "@/config/site";

/**
 * UX10A brand-fidelity correction (final pass) — BOTH paths render the
 * approved MASTER full-logo asset exactly as provided. No path composes
 * the logo from an icon + CSS-rendered wordmark, on any surface.
 *
 * Light/default surfaces — Header, MobileNav, AuthLayout, i.e. every
 * current caller of `<Logo />` without `onDark`: public/brand/
 * nextwise-logo-horizontal.png (mark + "NEXTWISE" + "Know What's Next."
 * tagline, transparent background), via next/image at its real intrinsic
 * aspect ratio (2235x779), scaled only by height (`h-10 sm:h-11 w-auto`).
 *
 * Dark surfaces — Footer, AdminShell (desktop sidebar + mobile drawer),
 * both `bg-primary` (the authoritative Blue #2563eb, not the authoritative
 * Navy #0b1f3a): BRAND_LOGO.horizontalDark, public/brand/
 * nextwise-logo-horizontal-dark.png — the SAME approved lockup, flattened
 * onto its own navy field (1660x948) — via next/image at ITS real
 * intrinsic aspect ratio, scaled only by height. The asset itself is never
 * cropped, recolored, or redrawn.
 *
 * That canvas is baked navy (sampled directly from the file: ~#000c23),
 * not Blue, so it would show a visible seam placed directly on `bg-
 * primary`. Per instruction, the fix for that mismatch is NOT to
 * reconstruct the logo — it's a minimal adjustment to the image's own
 * immediate backing only: a small rounded plate behind it, colored with
 * that exact sampled hex (not an approximate token — this guarantees a
 * seamless edge against the asset's own baked-in background, which an
 * approximate value could not). Footer and AdminShell are not redesigned —
 * nothing in either file changes; only this shared component's dark-path
 * rendering does.
 *
 * Sizing note: unlike the light asset, this one has a lot of built-in
 * canvas padding around the mark (the visible logo content is only ~36%
 * of the file's own height). It's sized here (`h-9`) to fit inside
 * AdminShell's existing fixed `h-16` sidebar/drawer header row without
 * changing that row's height ("do not change layout") — the honest
 * trade-off of showing the unmodified asset inside an existing
 * fixed-height row rather than cropping it or growing the row. See
 * docs/ux10a-premium-homepage-design-system.md §1A.
 */
const DARK_ASSET_SAMPLED_BG = "#000c23";

export function Logo({ onDark = false }: { onDark?: boolean }) {
  if (onDark) {
    return (
      <Link
        href="/"
        className="flex shrink-0 items-center rounded-md py-1"
        aria-label={`${BRAND_NAME} — home`}
      >
        <span
          className="flex shrink-0 items-center rounded-[6px] px-1.5 py-1"
          style={{ backgroundColor: DARK_ASSET_SAMPLED_BG }}
        >
          <Image
            src={BRAND_LOGO.horizontalDark}
            alt=""
            width={BRAND_LOGO.horizontalDarkWidth}
            height={BRAND_LOGO.horizontalDarkHeight}
            className="h-9 w-auto"
            priority
          />
        </span>
      </Link>
    );
  }

  return (
    <Link
      href="/"
      className="flex shrink-0 items-center rounded-md py-1"
      aria-label={`${BRAND_NAME} — home`}
    >
      <Image
        src={BRAND_LOGO.horizontal}
        alt=""
        width={BRAND_LOGO.horizontalWidth}
        height={BRAND_LOGO.horizontalHeight}
        className="h-10 w-auto sm:h-11"
        priority
      />
    </Link>
  );
}
