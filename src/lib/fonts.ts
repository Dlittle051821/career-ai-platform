import { Fraunces, Plus_Jakarta_Sans, Sora } from "next/font/google";

/**
 * Shared font configuration for every root layout in the app.
 *
 * Milestone 7 splits the single root layout into two independent root
 * layouts — `src/app/(site)/layout.tsx` (the public/student site) and
 * `src/app/admin/layout.tsx` (the internal admin system) — so the admin
 * shell never renders the public marketing header/footer (see
 * docs/admin-system-guide.md §1). Next.js requires each root layout to
 * define its own `<html>`/`<body>`, but both should use the exact same
 * fonts, so the font loaders live here once instead of being duplicated
 * (and risking drift) in two files.
 */

// Body copy: a warm, highly-legible geometric sans.
export const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

// Headings (CIUX-01): Sora, the approved homepage's section-heading face
// (src/components/sections/home/v54/fonts.ts loads the same family for the
// homepage scene). Replaces Fraunces so every page shares one heading face.
// SIL Open Font License 1.1, self-hosted at build time by next/font.
export const sora = Sora({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-sora",
  display: "swap",
});

// Fraunces stays loaded ONLY because the approved homepage's V4/V5.4 scene
// CSS (src/components/sections/home/v4/v4-home.css) reads --font-fraunces;
// removing it would change the homepage. No other page uses it any more.
export const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  weight: "variable",
  axes: ["opsz", "SOFT"],
});

export const fontVariables = `${jakarta.variable} ${sora.variable} ${fraunces.variable}`;
