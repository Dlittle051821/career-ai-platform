"use client";

import { usePathname } from "next/navigation";
import { MobileTabBar } from "@/components/dashboard/MobileTabBar";

/**
 * UX10-M01 — renders the one shared `MobileTabBar` (the same component
 * `DashboardShell` uses for `/dashboard` and `/profile`) on the four other
 * real, auth-protected "student app" routes that still live under the
 * public `(site)` route group rather than their own DashboardShell-backed
 * layout: `/recommendations`, `/saved`, `/applications`,
 * `/discovery-session` (confirmed protected in
 * `src/lib/supabase/middleware.ts`'s `PROTECTED_PATHS` — no logged-out
 * visitor ever reaches these).
 *
 * This is a deliberately additive, mobile-only layer rather than a route
 * migration: moving these four pages onto their own independent root
 * layout (the precedent UX10-P01 set for `/profile`) would also change
 * their DESKTOP presentation (dropping the public Header/Footer for a navy
 * sidebar), which is out of this milestone's own scope ("any mobile fix
 * must be implemented through responsive behavior only... desktop should
 * remain effectively unchanged"). Instead, `(site)/layout.tsx` renders this
 * client component once; it reads the current path and renders the shared
 * tab bar (and a matching spacer) ONLY on these four routes, `lg:hidden` —
 * every public marketing page (`/`, `/careers`, `/courses`, `/pricing`,
 * etc.) is completely unaffected, and the desktop layout for all pages,
 * app or public, is untouched.
 */
const APP_STYLE_PATH_PREFIXES = ["/recommendations", "/saved", "/applications", "/discovery-session"];

export function AppMobileTabBarSlot() {
  const pathname = usePathname();
  const isAppStylePage = APP_STYLE_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (!isAppStylePage) return null;

  return (
    <>
      {/* Clears the fixed tab bar below `lg:` so the last real card on the
          page is never hidden underneath it. */}
      <div aria-hidden="true" className="h-20 lg:hidden" />
      <MobileTabBar />
    </>
  );
}
