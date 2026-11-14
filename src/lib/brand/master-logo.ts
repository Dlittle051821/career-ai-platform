/**
 * Nextwise Master Logo v2.0 — the single source of truth for every
 * presentation of the brand mark outside the homepage animation.
 *
 * v2.0 (V5.6.3, 14 Nov 2026) is the owner-approved pink-tinted artwork: the
 * upward arrow of the N blends from Nextwise blue into Electric Coral. The
 * owner supplied the masters (docs/brand/master-v2-source/); every web file in
 * public/brand/master-v2/ is built from them by docs/brand/build-master-v2.py,
 * scaled and placed only — never redrawn — on the same canvas sizes as v1, so
 * every logo box on the site keeps its geometry.
 *
 * The "-dark" files ink the wordmark for Deep Navy (Canvas white, the x in
 * Soft Aqua, the tagline in Ice Blue); the N symbol is never recoloured.
 *
 * Not part of this set: ORIGINAL_N_ICON below, the artwork of the animated
 * homepage N (locked choreography and rendering) and of the invoice PDF
 * (payments) — both unchanged until the owner decides otherwise.
 */

export type BrandArtwork = { src: string; width: number; height: number };

export const MASTER_LOGO_VERSION = "2.0";

export const MASTER_LOGO = {
  fullLight: { src: "/brand/master-v2/nextwise-master-full-light.png", width: 1125, height: 373 },
  fullDark: { src: "/brand/master-v2/nextwise-master-full-dark.png", width: 1125, height: 373 },
  horizontalLight: { src: "/brand/master-v2/nextwise-master-horizontal-light.png", width: 1125, height: 300 },
  horizontalDark: { src: "/brand/master-v2/nextwise-master-horizontal-dark.png", width: 1125, height: 300 },
  symbol: { src: "/brand/master-v2/nextwise-master-symbol.png", width: 1073, height: 853 },
} as const satisfies Record<string, BrandArtwork>;

/** The original N icon (cyan arrow): the animated homepage N and the invoice PDF still use it — unchanged by v2.0. */
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
