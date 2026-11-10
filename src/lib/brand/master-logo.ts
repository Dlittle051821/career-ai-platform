/**
 * Nextwise Master Logo v1.0 — the single source of truth for every
 * presentation of the brand mark (see docs/home-v5/BRAND-MASTER-LOGO.md).
 *
 * Every variant is built from the same approved artwork:
 *   - the ORIGINAL upward-arrow N symbol (public/brand/nextwise-icon.png,
 *     unchanged; the symbol file below is a lossless crop of it), and
 *   - the custom "extwise" wordmark with the blue-accented x and the
 *     "Know What's Next." tagline, extracted from the approved Master Logo
 *     v1.0 raster (1448 × 1086) onto a transparent background.
 *
 * The "-dark" files are the same alpha artwork with the wordmark inked in
 * Canvas white, the x in Soft Aqua and the tagline in Ice Blue so the lockup
 * reads on Deep Navy; the N symbol is never recoloured.
 *
 * These are raster derivatives. A vector master (SVG/PDF) is still required
 * before the website-wide rollout — the requirements are documented in
 * docs/home-v5/BRAND-MASTER-LOGO.md.
 */

export type BrandArtwork = { src: string; width: number; height: number };

export const MASTER_LOGO_VERSION = "1.0";

export const MASTER_LOGO = {
  fullLight: { src: "/brand/master-v1/nextwise-master-full-light.png", width: 1125, height: 373 },
  fullDark: { src: "/brand/master-v1/nextwise-master-full-dark.png", width: 1125, height: 373 },
  horizontalLight: { src: "/brand/master-v1/nextwise-master-horizontal-light.png", width: 1125, height: 300 },
  horizontalDark: { src: "/brand/master-v1/nextwise-master-horizontal-dark.png", width: 1125, height: 300 },
  symbol: { src: "/brand/master-v1/nextwise-master-symbol.png", width: 1073, height: 853 },
} as const satisfies Record<string, BrandArtwork>;

/** The original, approved N icon the symbol is cropped from (also used by the animated N). */
export const ORIGINAL_N_ICON = "/brand/nextwise-icon.png";

export type BrandLogoVariant = "full" | "horizontal" | "compact" | "symbol";
export type BrandLogoTone = "light" | "dark";

/** Artwork for a variant on a light ("light") or dark ("dark") background. */
export function brandArtwork(variant: BrandLogoVariant, tone: BrandLogoTone): BrandArtwork {
  switch (variant) {
    case "full":
      return tone === "dark" ? MASTER_LOGO.fullDark : MASTER_LOGO.fullLight;
    case "horizontal":
    case "compact":
      return tone === "dark" ? MASTER_LOGO.horizontalDark : MASTER_LOGO.horizontalLight;
    case "symbol":
      return MASTER_LOGO.symbol;
  }
}

/** Smallest rendered height (CSS px) at which each variant stays legible. */
export const BRAND_MIN_HEIGHT: Record<BrandLogoVariant, number> = {
  full: 48,
  horizontal: 26,
  compact: 22,
  symbol: 20,
};
