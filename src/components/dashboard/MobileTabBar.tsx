"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarHeart, Compass, LayoutDashboard, Sparkles, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface TabItem {
  label: string;
  href: string;
  icon: LucideIcon;
  isActive: (pathname: string) => boolean;
}

/**
 * UX10-M01 — the global mobile bottom tab bar for every logged-in/app-style
 * page (dashboard, profile, careers, courses, universities, recommendations,
 * saved, applications, discovery session). Per this milestone's own brief
 * ("reuse one consistent mobile student navigation pattern... do not create
 * separate mobile navigation systems per page"), this is the ONE shared
 * component rendered from `DashboardShell` — every app-style route already
 * goes through that shell, so no page needs its own copy.
 *
 * The attached mobile reference shows 5 fixed tabs (Home / Explore / My
 * Plan / Guidance / Profile), but this product's real `DashboardShell`
 * sidebar has 8 real destinations (`NAV_ITEMS` above). Rather than invent a
 * 5-item navigation taxonomy that doesn't exist, each tab here is mapped to
 * the closest real, already-existing route:
 *  - Home       -> /dashboard (the real dashboard landing page)
 *  - Explore    -> /careers (this product's primary explorer; Course/
 *    University Explorer remain one tap away from there via the real
 *    journey links already on that page, and via the sitewide header
 *    search — no second "Explore" route/menu was invented, per this
 *    milestone's own "style reference only, no new routes" decision)
 *  - My Plan    -> /recommendations (the real personalised plan of
 *    suggested careers/courses/universities — the closest honest match to
 *    "My Plan" this product actually has)
 *  - Guidance   -> /discovery-session/book (the real counsellor-guidance
 *    booking flow — DashboardShell's own sidebar already calls this
 *    "Discovery Session")
 *  - Profile    -> /profile
 *
 * Saved, Applications, Documents & Payments, and Settings are NOT dropped —
 * they stay reachable exactly as before, via the existing hamburger "Menu"
 * button in the header (DashboardShell's own pre-existing mobile drawer,
 * which still lists all 8 real items) and via their own real cards/links
 * already surfaced on the Dashboard page. This keeps every real navigation
 * destination reachable while giving the 5 most common ones a persistent,
 * one-tap bottom bar, matching the reference as closely as practically
 * possible without fabricating a navigation taxonomy this product doesn't
 * have.
 */
const TAB_ITEMS: TabItem[] = [
  { label: "Home", href: "/dashboard", icon: LayoutDashboard, isActive: (p) => p === "/dashboard" },
  {
    label: "Explore",
    href: "/careers",
    icon: Compass,
    isActive: (p) => p.startsWith("/careers") || p.startsWith("/courses") || p.startsWith("/universities") || p.startsWith("/compare"),
  },
  { label: "My Plan", href: "/recommendations", icon: Sparkles, isActive: (p) => p.startsWith("/recommendations") },
  { label: "Guidance", href: "/discovery-session/book", icon: CalendarHeart, isActive: (p) => p.startsWith("/discovery-session") },
  { label: "Profile", href: "/profile", icon: UserRound, isActive: (p) => p.startsWith("/profile") },
];

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <ul className="mx-auto flex max-w-[640px] items-stretch justify-between px-1">
        {TAB_ITEMS.map((tab) => {
          const Icon = tab.icon;
          const active = tab.isActive(pathname);
          return (
            <li key={tab.label} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted hover:text-text"
                )}
              >
                <Icon aria-hidden="true" className={cn("h-5 w-5 shrink-0", active && "text-primary")} />
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
