import type { Metadata } from "next";
import { fontVariables } from "@/lib/fonts";
import { BRAND_NAME } from "@/config/site";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import "../globals.css";

export const metadata: Metadata = {
  title: {
    default: "Recommendations",
    template: `%s | ${BRAND_NAME}`,
  },
  // Same permanent, page-level noindex protection every other authenticated
  // route under its own shell already carries (see src/app/dashboard/
  // layout.tsx and src/app/profile/layout.tsx) — this is a private,
  // logged-in page, never something a search engine should index.
  robots: { index: false, follow: false },
};

/**
 * UX10-REC01 "RECOMMENDATIONS EXPERIENCE REDESIGN" — root layout for the
 * recommendations route (`/recommendations`).
 *
 * The reference mockup's left app nav + persistent, dashboard-style shell
 * is the exact same `DashboardShell` `/dashboard` (UX10-D01) and `/profile`
 * (UX10-P01) already use — not a third, different sidebar design. This is
 * the THIRD time this exact move has been made in this codebase, for the
 * exact same reason each time: the public marketing site's Header/Footer
 * (`src/app/(site)/layout.tsx`) is the wrong chrome for a reference whose
 * target is a full "logged-in app" shell.
 *
 * This required moving the route out of the `(site)` route group, the
 * same way `/dashboard` and `/profile` were each moved before it: Next.js
 * route groups do not add to the URL (`(site)/recommendations` and
 * `recommendations/` both resolve to `/recommendations`), but two
 * `page.tsx` files cannot both resolve to the same path, so
 * `src/app/(site)/recommendations/page.tsx` is deleted as part of this
 * move — its real data-fetching logic is carried over unchanged into the
 * new `src/app/recommendations/page.tsx`, not discarded or reimplemented.
 *
 * `PROTECTED_PATHS` in `src/lib/supabase/middleware.ts` matches on the URL
 * pathname (`/recommendations`), not file location, so auth protection for
 * a logged-out visitor is completely unaffected by this move.
 *
 * `DashboardShell`'s own `NAV_ITEMS` already contains
 * `{ label: "Recommendations", href: "/recommendations", icon: Sparkles }`
 * — that link needed no change at all; it simply now resolves to this
 * redesigned page instead of the old `(site)`-chrome one.
 *
 * Exactly ONE Next.js page resolves to `/recommendations` after this
 * change — see the sibling `recommendations-reference-audit.test.ts`
 * (mirroring `dashboard-reference-audit.test.ts` /
 * `profile-reference-audit.test.ts`) for a regression test guarding
 * against a second one ever being reintroduced.
 */
export default async function RecommendationsRootLayout({ children }: { children: React.ReactNode }) {
  // Defense in depth only — middleware already redirects a logged-out
  // visitor to /login before this layout ever renders. Only the fields
  // the shell's own header (UserMenu) needs are fetched here; the page
  // itself fetches the full Student Digital Profile snapshot and
  // recommendation data it actually needs.
  const profile = await getCurrentProfile();

  return (
    <html lang="en" className={fontVariables}>
      <body className="min-h-screen bg-background font-sans text-text antialiased">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <DashboardShell studentName={profile?.fullName ?? null} studentEmail={profile?.email ?? null}>
          {children}
        </DashboardShell>
      </body>
    </html>
  );
}
