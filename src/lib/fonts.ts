import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";

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

// Headings: a soft-optical-size serif for an editorial, trustworthy feel —
// distinct from generic SaaS sans-only type without tipping into ornate.
export const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  weight: "variable",
  axes: ["opsz", "SOFT"],
});

export const fontVariables = `${jakarta.variable} ${fraunces.variable}`;
