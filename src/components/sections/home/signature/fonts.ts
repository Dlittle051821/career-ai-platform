import { Fraunces } from "next/font/google";

/**
 * NW08.7 — Fraunces italic, for the approved headline's emphasised
 * "opportunity." Loaded here (not in src/lib/fonts.ts) so only pages that
 * render the signature hero download it; the site-wide Fraunces upright and
 * Plus Jakarta Sans are unchanged. Fraunces is SIL Open Font License.
 */
export const frauncesItalic = Fraunces({
  subsets: ["latin"],
  style: "italic",
  weight: "variable",
  axes: ["opsz", "SOFT"],
  display: "swap",
  variable: "--font-fraunces-italic",
});
