import type { Metadata } from "next";
import { fontVariables } from "@/lib/fonts";
import { BRAND_NAME } from "@/config/site";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import "../globals.css";

export const metadata: Metadata = {
  title: {
    default: "My Profile",
    template: `%s | ${BRAND_NAME}`,
  },
  // Same permanent, page-level noindex protection every other authenticated
  // route under its own shell already carries (see src/app/dashboard/
  // layout.tsx and src/app/admin/layout.tsx) — this is a private, logged-in
  // page, never something a search engine should index.
  robots: { index: false, follow: false },
};

/**
 * UX10-P01 "STUDENT PROFILE EXACT REFERENCE IMPLEMENTATION" — root layout
 * for the student profile route (`/profile`).
 *
 * Mirrors UX10-D01's own `src/app/dashboard/layout.tsx` exactly, for the
 * exact same reason: the reference for this page is a full "logged-in
 * app" shell (fixed navy sidebar, dashboard-style header) that must look
 * identical to `/dashboard`'s, not the public marketing site's Header/
 * Footer (`src/app/(site)/layout.tsx`) that the OLD `/profile` page lived
 * under. This is this codebase's FOURTH independent root layout (after
 * `(site)`, `admin`, and `dashboard`), reusing the exact same
 * `DashboardShell` component `/dashboard` already uses — not a second,
 * different sidebar design (the brief's own explicit instruction).
 *
 * This required moving the route out of the `(site)` route group, the
 * same way `/dashboard` was moved in UX10-D01: Next.js route groups do not
 * add to the URL (`(site)/profile` and `profile/` both resolve to
 * `/profile`), but two `page.tsx` files cannot both resolve to the same
 * path, so `src/app/(site)/profile/page.tsx` is deleted as part of this
 * move. `src/app/(site)/profile/onboarding/page.tsx` is NOT moved or
 * touched — it resolves to a different path (`/profile/onboarding`), it
 * is explicitly out of this milestone's scope ("do not redesign unrelated
 * pages"), and it has no collision with this layout (route groups only
 * apply to files actually inside them).
 *
 * `PROTECTED_PATHS` in `src/lib/supabase/middleware.ts` matches on the URL
 * pathname (`/profile`), not file location, so auth protection for
 * logged-out visitors is completely unaffected by this move.
 *
 * Exactly ONE Next.js page resolves to `/profile` after this change — see
 * `src/lib/dashboard/dashboard-reference-audit.test.ts` sibling
 * `src/lib/profile/profile-reference-audit.test.ts` for a regression test
 * that guards against a second one ever being reintroduced.
 */
export default async function ProfileRootLayout({ children }: { children: React.ReactNode }) {
  // Defense in depth only — middleware already redirects a logged-out
  // visitor to /login before this layout ever renders. Only the fields
  // the shell's own header (UserMenu) needs are fetched here; the
  // page itself fetches the full Student Digital Profile snapshot.
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
