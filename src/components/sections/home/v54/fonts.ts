import { Space_Grotesk, Sora } from "next/font/google";

/**
 * NW-V5.4 fonts. All three families are SIL Open Font License 1.1, served
 * by Google Fonts and self-hosted at build time by next/font (no runtime
 * request to Google), Latin subset only.
 *  - Hero display, Option A (recommended): Space Grotesk SemiBold / Bold.
 *  - Hero display, Option B, and every section heading below the hero
 *    (unchanged since V5.1): Sora.
 *  - Interface and body: Plus Jakarta Sans — the site's own face
 *    (--font-jakarta, src/lib/fonts.ts), reused as is.
 */
export const v54Grotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-v54-grotesk",
  display: "swap",
});

export const v54Sora = Sora({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-v54-sora",
  display: "swap",
});
