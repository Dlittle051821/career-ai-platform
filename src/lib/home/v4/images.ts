/**
 * NW-V4 homepage — responsive photography (generated from the original
 * full-resolution sources by the V4 asset pipeline; see
 * docs/home-v4/ASSET-MANIFEST.md for sources, licences and resolutions).
 *
 * Files are pre-encoded (AVIF + WebP ladders, one JPEG fallback) and served
 * statically from /public/home-v4. They are delivered through <picture>
 * rather than next/image because the stage is uniformly scaled to the
 * viewport (scale = min(vw/1440, vh/900) on desktop, min(vw/390, vh/844) on
 * mobile), so each image's rendered width depends on BOTH viewport axes;
 * `sizes` below encodes that exactly, and the encodes were checked by eye
 * for banding in the dusk gradients — something the on-demand optimiser
 * cannot guarantee.
 */

export type V4ImageSet = {
  avif: string;
  webp: string;
  fallback: string;
  width: number;
  height: number;
};

/**
 * Hero (L0) — the approved mockup's own photography (the student with the
 * backpack, the sunrise, the layered mountains and the university), extracted
 * from the mockup with all UI, text and the N removed, its hidden areas
 * rebuilt and the scene extended to the full stage. Each set covers the hero
 * photo's inner box (the stage plus the 3% inset bleed the intro zoom uses).
 */
export const heroDesktop: V4ImageSet = {
  avif: "/home-v4/hero-v5-desktop-763.avif 763w, /home-v4/hero-v5-desktop-1145.avif 1145w, /home-v4/hero-v5-desktop-1526.avif 1526w, /home-v4/hero-v5-desktop-2290.avif 2290w, /home-v4/hero-v5-desktop-3053.avif 3053w",
  webp: "/home-v4/hero-v5-desktop-763.webp 763w, /home-v4/hero-v5-desktop-1145.webp 1145w, /home-v4/hero-v5-desktop-1526.webp 1526w, /home-v4/hero-v5-desktop-2290.webp 2290w, /home-v4/hero-v5-desktop-3053.webp 3053w",
  fallback: "/home-v4/hero-v5-desktop-1526.jpg",
  width: 3053,
  height: 1908,
};

export const heroMobile: V4ImageSet = {
  avif: "/home-v4/hero-v5-mobile-413.avif 413w, /home-v4/hero-v5-mobile-620.avif 620w, /home-v4/hero-v5-mobile-826.avif 826w, /home-v4/hero-v5-mobile-1240.avif 1240w, /home-v4/hero-v5-mobile-1447.avif 1447w",
  webp: "/home-v4/hero-v5-mobile-413.webp 413w, /home-v4/hero-v5-mobile-620.webp 620w, /home-v4/hero-v5-mobile-826.webp 826w, /home-v4/hero-v5-mobile-1240.webp 1240w, /home-v4/hero-v5-mobile-1447.webp 1447w",
  fallback: "/home-v4/hero-v5-mobile-826.jpg",
  width: 1447,
  height: 3131,
};

/**
 * The same hero scene continued past the stage edges, painted behind the
 * stage so viewports that are not 16:10 (desktop) / 390:844 (mobile) show
 * more sky and valley instead of dark letterbox bands. Region in stage px:
 * desktop x −560…2000, y −540…1440; mobile x −160…550, y −300…1150.
 */
export const heroBleedDesktop: V4ImageSet = {
  avif: "/home-v4/hero-v5-bleed-desktop-1280.avif 1280w, /home-v4/hero-v5-bleed-desktop-1920.avif 1920w, /home-v4/hero-v5-bleed-desktop-2560.avif 2560w",
  webp: "/home-v4/hero-v5-bleed-desktop-1280.webp 1280w, /home-v4/hero-v5-bleed-desktop-1920.webp 1920w, /home-v4/hero-v5-bleed-desktop-2560.webp 2560w",
  fallback: "/home-v4/hero-v5-bleed-desktop-1280.jpg",
  width: 2560,
  height: 1980,
};

export const heroBleedMobile: V4ImageSet = {
  avif: "/home-v4/hero-v5-bleed-mobile-710.avif 710w, /home-v4/hero-v5-bleed-mobile-1065.avif 1065w, /home-v4/hero-v5-bleed-mobile-1420.avif 1420w",
  webp: "/home-v4/hero-v5-bleed-mobile-710.webp 710w, /home-v4/hero-v5-bleed-mobile-1065.webp 1065w, /home-v4/hero-v5-bleed-mobile-1420.webp 1420w",
  fallback: "/home-v4/hero-v5-bleed-mobile-710.jpg",
  width: 1420,
  height: 2900,
};

export const HERO_BLEED = {
  desktop: { x: -560, y: -540, w: 2560, h: 1980 },
  mobile: { x: -160, y: -300, w: 710, h: 1450 },
} as const;

export const pathwayCareer: V4ImageSet = {
  avif: "/home-v4/pathway-career-640.avif 640w, /home-v4/pathway-career-1024.avif 1024w, /home-v4/pathway-career-1600.avif 1600w, /home-v4/pathway-career-2400.avif 2400w, /home-v4/pathway-career-2754.avif 2754w",
  webp: "/home-v4/pathway-career-640.webp 640w, /home-v4/pathway-career-1024.webp 1024w, /home-v4/pathway-career-1600.webp 1600w, /home-v4/pathway-career-2400.webp 2400w, /home-v4/pathway-career-2754.webp 2754w",
  fallback: "/home-v4/pathway-career-1024.jpg",
  width: 2754,
  height: 4000,
};

export const pathwayAbroad: V4ImageSet = {
  avif: "/home-v4/pathway-abroad-640.avif 640w, /home-v4/pathway-abroad-1024.avif 1024w, /home-v4/pathway-abroad-1600.avif 1600w, /home-v4/pathway-abroad-2400.avif 2400w, /home-v4/pathway-abroad-2714.avif 2714w",
  webp: "/home-v4/pathway-abroad-640.webp 640w, /home-v4/pathway-abroad-1024.webp 1024w, /home-v4/pathway-abroad-1600.webp 1600w, /home-v4/pathway-abroad-2400.webp 2400w, /home-v4/pathway-abroad-2714.webp 2714w",
  fallback: "/home-v4/pathway-abroad-1024.jpg",
  width: 2714,
  height: 4071,
};

export const destDe: V4ImageSet = {
  avif: "/home-v4/dest-de-640.avif 640w, /home-v4/dest-de-1024.avif 1024w, /home-v4/dest-de-1600.avif 1600w, /home-v4/dest-de-2400.avif 2400w, /home-v4/dest-de-3313.avif 3313w",
  webp: "/home-v4/dest-de-640.webp 640w, /home-v4/dest-de-1024.webp 1024w, /home-v4/dest-de-1600.webp 1600w, /home-v4/dest-de-2400.webp 2400w, /home-v4/dest-de-3313.webp 3313w",
  fallback: "/home-v4/dest-de-1024.jpg",
  width: 3313,
  height: 2970,
};

export const destIe: V4ImageSet = {
  avif: "/home-v4/dest-ie-640.avif 640w, /home-v4/dest-ie-1024.avif 1024w, /home-v4/dest-ie-1600.avif 1600w, /home-v4/dest-ie-2400.avif 2400w, /home-v4/dest-ie-2848.avif 2848w",
  webp: "/home-v4/dest-ie-640.webp 640w, /home-v4/dest-ie-1024.webp 1024w, /home-v4/dest-ie-1600.webp 1600w, /home-v4/dest-ie-2400.webp 2400w, /home-v4/dest-ie-2848.webp 2848w",
  fallback: "/home-v4/dest-ie-1024.jpg",
  width: 2848,
  height: 4272,
};

export const destNl: V4ImageSet = {
  avif: "/home-v4/dest-nl-640.avif 640w, /home-v4/dest-nl-1024.avif 1024w, /home-v4/dest-nl-1600.avif 1600w, /home-v4/dest-nl-2400.avif 2400w, /home-v4/dest-nl-3200.avif 3200w, /home-v4/dest-nl-3734.avif 3734w",
  webp: "/home-v4/dest-nl-640.webp 640w, /home-v4/dest-nl-1024.webp 1024w, /home-v4/dest-nl-1600.webp 1600w, /home-v4/dest-nl-2400.webp 2400w, /home-v4/dest-nl-3200.webp 3200w, /home-v4/dest-nl-3734.webp 3734w",
  fallback: "/home-v4/dest-nl-1024.jpg",
  width: 3734,
  height: 2535,
};

export const destFr: V4ImageSet = {
  avif: "/home-v4/dest-fr-640.avif 640w, /home-v4/dest-fr-1024.avif 1024w, /home-v4/dest-fr-1600.avif 1600w, /home-v4/dest-fr-2400.avif 2400w, /home-v4/dest-fr-2736.avif 2736w",
  webp: "/home-v4/dest-fr-640.webp 640w, /home-v4/dest-fr-1024.webp 1024w, /home-v4/dest-fr-1600.webp 1600w, /home-v4/dest-fr-2400.webp 2400w, /home-v4/dest-fr-2736.webp 2736w",
  fallback: "/home-v4/dest-fr-1024.jpg",
  width: 2736,
  height: 3648,
};

export const destSe: V4ImageSet = {
  avif: "/home-v4/dest-se-640.avif 640w, /home-v4/dest-se-1024.avif 1024w, /home-v4/dest-se-1600.avif 1600w, /home-v4/dest-se-2400.avif 2400w, /home-v4/dest-se-3000.avif 3000w",
  webp: "/home-v4/dest-se-640.webp 640w, /home-v4/dest-se-1024.webp 1024w, /home-v4/dest-se-1600.webp 1600w, /home-v4/dest-se-2400.webp 2400w, /home-v4/dest-se-3000.webp 3000w",
  fallback: "/home-v4/dest-se-1024.jpg",
  width: 3000,
  height: 4000,
};

export const destDk: V4ImageSet = {
  avif: "/home-v4/dest-dk-640.avif 640w, /home-v4/dest-dk-1024.avif 1024w, /home-v4/dest-dk-1600.avif 1600w, /home-v4/dest-dk-2400.avif 2400w, /home-v4/dest-dk-3200.avif 3200w, /home-v4/dest-dk-4000.avif 4000w",
  webp: "/home-v4/dest-dk-640.webp 640w, /home-v4/dest-dk-1024.webp 1024w, /home-v4/dest-dk-1600.webp 1600w, /home-v4/dest-dk-2400.webp 2400w, /home-v4/dest-dk-3200.webp 3200w, /home-v4/dest-dk-4000.webp 4000w",
  fallback: "/home-v4/dest-dk-1024.jpg",
  width: 6016,
  height: 4000,
};

export const finalBg: V4ImageSet = {
  avif: "/home-v4/final-bg-960.avif 960w, /home-v4/final-bg-1600.avif 1600w, /home-v4/final-bg-2400.avif 2400w",
  webp: "/home-v4/final-bg-960.webp 960w, /home-v4/final-bg-1600.webp 1600w, /home-v4/final-bg-2400.webp 2400w",
  fallback: "/home-v4/final-bg-1600.jpg",
  width: 5760,
  height: 3840,
};

/**
 * `sizes` helpers. A box that is `w` stage px wide renders at
 * w × min(vw/1440, vh/900) CSS px on desktop and w × min(vw/390, vh/844) on
 * mobile. For object-fit: cover boxes pass the width the image actually
 * paints at — see coverWidth().
 */
const round2 = (n: number) => Math.round(n * 100) / 100;
export const desktopSizes = (w: number) => `min(${round2((w / 1440) * 100)}vw, ${round2((w / 900) * 100)}vh)`;
export const mobileSizes = (w: number) => `min(${round2((w / 390) * 100)}vw, ${round2((w / 844) * 100)}vh)`;
export const coverWidth = (boxW: number, boxH: number, img: V4ImageSet) =>
  Math.ceil(boxW * Math.max(1, img.width / img.height / (boxW / boxH)));

/** The single breakpoint the stage engine uses (innerWidth < 700 → mobile composition). */
export const V4_MOBILE_MEDIA = "(max-width: 699.98px)";

export const V4_DESTINATION_IMAGES = {
  de: destDe,
  ie: destIe,
  nl: destNl,
  fr: destFr,
  se: destSe,
  dk: destDk,
} as const;
