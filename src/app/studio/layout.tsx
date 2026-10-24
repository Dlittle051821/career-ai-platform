import type { Metadata } from "next";
import { fontVariables } from "@/lib/fonts";
import { BRAND_NAME } from "@/config/site";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import "../globals.css";

export const metadata: Metadata = {
  title: {
    default: "Studio",
    template: `%s | ${BRAND_NAME}`,
  },
  // Same permanent, page-level noindex protection every other authenticated
  // route under its own shell already carries (see src/app/dashboard/
  // layout.tsx, src/app/profile/layout.tsx, src/app/recommendations/
  // layout.tsx) — this is a private, logged-in page, never something a
  // search engine should index.
  robots: { index: false, follow: false },
};

/**
 * NW03.3 — root layout for the Studio hub and both authenticated product
 * workspaces (`/studio`, `/studio/career`, `/studio/abroad`).
 *
 * Mirrors the exact precedent set by src/app/dashboard/layout.tsx,
 * src/app/profile/layout.tsx, and src/app/recommendations/layout.tsx: this
 * codebase has no single shared root layout (each top-level route renders
 * its own <html>/<body>), so a new top-level route needs its own layout —
 * this is the fifth one (after `(site)`, `admin`, `dashboard`, and the
 * `profile`/`recommendations` pair), reusing the exact same `DashboardShell`
 * component every other authenticated student page already uses, not a
 * new or different shell design.
 *
 * `/studio` is a NEW top-level route — it does not collide with any
 * existing `page.tsx`, so no file needed to move or be deleted for this
 * layout to exist (unlike the `/dashboard`/`/profile`/`/recommendations`
 * moves, which each replaced an existing `(site)`-chrome page).
 *
 * `PROTECTED_PATHS` in `src/lib/supabase/middleware.ts` gates `/studio` (and,
 * via its existing prefix check, every route beneath it) server-side before
 * this layout ever renders for a logged-out visitor — see
 * docs/milestones/NW03/NW03_03_STUDENT_JOURNEYS.md.
 */
export default async function StudioRootLayout({ children }: { children: React.ReactNode }) {
  // Defense in depth only — middleware already redirects a logged-out
  // visitor to /login before this layout ever renders. Only the fields the
  // shell's own header (UserMenu) needs are fetched here.
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
