import { Fraunces } from "next/font/google";

/**
 * NW-V4 — the true italic cut of Fraunces used by the homepage's display
 * headings ("Next.", "Two pathways.", "starts here." …). The site-wide
 * loader in src/lib/fonts.ts only ships the roman cut, so without this the
 * browser would synthesise a slanted roman instead of the drawn italic the
 * approved V4 design uses. Declared here (not in src/lib/fonts.ts) so the
 * extra file is only preloaded on the homepage.
 */
export const frauncesItalic = Fraunces({
  subsets: ["latin"],
  style: "italic",
  weight: "variable",
  axes: ["opsz"],
  variable: "--font-nw4-fraunces-italic",
  display: "swap",
});
