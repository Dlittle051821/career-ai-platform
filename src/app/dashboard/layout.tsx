import type { Metadata } from "next";
import { fontVariables } from "@/lib/fonts";
import { BRAND_NAME } from "@/config/site";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import "../globals.css";

export const metadata: Metadata = {
  title: {
    default: "Dashboard",
    template: `%s | ${BRAND_NAME}`,
  },
  // M17A Step 2's permanent, page-level noindex protection for this
  // authenticated route carries over unchanged from the page this layout
  // replaces (see src/app/dashboard/page.tsx's own note).
  robots: { index: false, follow: false },
};

/**
 * UX10-D01 "STUDENT DASHBOARD EXACT REFERENCE IMPLEMENTATION" — root
 * layout for the student dashboard (`/dashboard`).
 *
 * This milestone's own reference is a full, bespoke "logged-in app" shell
 * — a fixed navy sidebar, its own header row (greeting, search, avatar) —
 * visually distinct from the public marketing site's Header/Footer
 * (`src/app/(site)/layout.tsx`, rendered around every other `(site)` page:
 * homepage, careers, courses, universities, profile, applications, saved,
 * payments, etc.) and from the separate internal admin shell
 * (`src/app/admin/layout.tsx`). Matching the reference without producing
 * a page with the public Header AND Footer AND a second, bespoke
 * navy-sidebar chrome all stacked on top of each other requires the exact
 * same architectural move this codebase already made once before for
 * precisely this reason: `/admin` has had its own independent root layout
 * since Milestone 7 (see that file's own docblock — "the admin shell
 * never renders the public marketing header/footer"). This file does the
 * same thing for `/dashboard`: a THIRD independent root layout,
 * `/dashboard`-only, that renders this page's own `<html>`/`<body>` and
 * nothing else — not the public Header/Footer, not the admin shell.
 *
 * This required moving the route out of the `(site)` route group — Next.js
 * route groups do not add to the URL (`(site)/dashboard` and
 * `dashboard/` both resolve to `/dashboard`), but two `page.tsx` files
 * cannot both resolve to the same path, so the former
 * `src/app/(site)/dashboard/page.tsx` is removed as part of this move
 * (its full real-data-fetching logic is preserved, not discarded — see
 * this route's own `page.tsx`). `PROTECTED_PATHS` in
 * `src/lib/supabase/middleware.ts` matches on the URL pathname
 * (`/dashboard`), not the file location, so route protection for
 * logged-out visitors is completely unaffected by this move — confirmed
 * unchanged in this milestone's own regression tests.
 *
 * No other route moves. `(site)/layout.tsx` and `admin/layout.tsx` are
 * both untouched, so every other page keeps exactly the chrome it already
 * had.
 */
export default async function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  // Defense in depth only — middleware already redirects a logged-out
  // visitor to /login before this layout ever renders (same convention
  // documented on admin/layout.tsx). Only the fields the shell's own
  // header (UserMenu) needs are fetched here; the page-level greeting
  // fetches the real profile itself (see src/app/dashboard/page.tsx) —
  // layouts and pages are separate Server Component subtrees in the App
  // Router, so there is no prop path from one to the other.
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
