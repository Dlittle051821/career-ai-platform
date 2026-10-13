"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Bookmark,
  CalendarHeart,
  ChevronDown,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  Search,
  Settings,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Logo } from "@/components/navigation/Logo";
import { MobileTabBar } from "@/components/dashboard/MobileTabBar";
import { logout } from "@/lib/supabase/actions";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

/**
 * UX10-D01 — the reference's eight sidebar items, each pointed at the
 * real, already-existing route it names (no new routes invented). "My
 * Profile" and "Documents & Payments" each cover two real pages under one
 * label, matching the reference's own eight-item list exactly — the
 * primary of the pair is used as the link target:
 *  - My Profile -> /profile (the real profile page; onboarding is reached
 *    from there or from the Profile Completeness card's own CTA)
 *  - Documents & Payments -> /payments (/agreements has no standalone
 *    index page today, only per-id detail pages — see
 *    src/app/(site)/agreements/[id]/page.tsx)
 */
const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "My Profile", href: "/profile", icon: UserRound },
  { label: "Recommendations", href: "/recommendations", icon: Sparkles },
  { label: "Saved", href: "/saved", icon: Bookmark },
  { label: "Applications", href: "/applications", icon: ClipboardList },
  { label: "Discovery Session", href: "/discovery-session/book", icon: CalendarHeart },
  { label: "Documents & Payments", href: "/payments", icon: Receipt },
  { label: "Settings", href: "/profile", icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Dashboard" className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.label}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-colors duration-150",
              active
                ? "bg-primary text-on-primary shadow-[0_8px_20px_-6px_rgba(37,99,235,0.65)]"
                : "text-on-primary-muted hover:bg-white/10 hover:text-on-primary"
            )}
          >
            <Icon aria-hidden="true" className="h-[1.1rem] w-[1.1rem] shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooterCard() {
  return (
    <div className="rounded-2xl bg-white/[0.06] p-4">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-intelligence">
        <GraduationCap aria-hidden="true" className="h-4.5 w-4.5" />
      </span>
      <p className="mt-3 text-sm font-medium leading-snug text-on-primary">
        A brighter tomorrow starts with the right guidance.
      </p>
    </div>
  );
}

function UserMenu({ studentName, studentEmail }: { studentName: string | null; studentEmail: string | null }) {
  const [open, setOpen] = useState(false);
  const displayName = studentName ?? studentEmail ?? "Student";
  const initials =
    (studentName ?? studentEmail ?? "S")
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "S";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2.5 transition-colors hover:bg-surface-alt"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-on-primary">
          {initials}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-medium leading-tight text-text">{displayName}</span>
          <span className="block text-xs leading-tight text-muted">Student</span>
        </span>
        <ChevronDown aria-hidden="true" className={cn("h-4 w-4 text-muted transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="menu"
            className="absolute right-0 top-full z-20 mt-2 w-56 rounded-2xl border border-border bg-surface p-1.5 shadow-lifted"
          >
            <div className="px-3 py-2">
              <p className="truncate text-sm font-medium text-text">{displayName}</p>
              {studentEmail ? <p className="truncate text-xs text-muted">{studentEmail}</p> : null}
            </div>
            <Link
              href="/profile"
              role="menuitem"
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-text hover:bg-surface-alt"
              onClick={() => setOpen(false)}
            >
              <Settings aria-hidden="true" className="h-4 w-4 text-muted" />
              Settings
            </Link>
            <form action={logout}>
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-text hover:bg-surface-alt"
              >
                <LogOut aria-hidden="true" className="h-4 w-4 text-muted" />
                Sign out
              </button>
            </form>
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * UX10-D01 — the student dashboard's own app shell: a fixed navy sidebar
 * (desktop) / drawer (mobile, `lg:hidden`, mirroring AdminShell.tsx's
 * already-established mobile-nav-drawer pattern — this codebase's own
 * "existing layout system" for exactly this kind of shell) plus a header
 * row (search, notifications, account menu) above the page content.
 *
 * The search field intentionally submits a real GET request to `/courses`
 * (`?q=`) — the same real, pre-existing keyword search the sitewide
 * Header already links to (see Header.tsx's own docblock: "Rather than
 * fabricate a non-functional search widget [...] this links to /courses").
 * No unified cross-entity (careers + courses + universities) search
 * endpoint exists in this codebase, so rather than invent one, this reuses
 * the same genuine destination the rest of the site already trusts.
 *
 * The notification bell is a plain, unbadged icon button — this product
 * has no student-facing notification feed/unread-count today (`src/lib/
 * notifications` is an outbound email/SMS sender, not an in-app feed), so
 * no unread dot or count is shown; inventing one would be exactly the kind
 * of fabricated data this milestone's brief explicitly forbids.
 *
 * The account avatar is an initials badge, not a photo — this product's
 * `Profile` type has no avatar/photo field (`src/types/index.ts`), so an
 * initials badge is the honest representation of a real name rather than
 * a stand-in stock photo.
 */
export function DashboardShell({
  studentName,
  studentEmail,
  children,
}: {
  studentName: string | null;
  studentEmail: string | null;
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();
  const [lastPathname, setLastPathname] = useState(pathname);

  // Close the mobile nav whenever the route changes — adjust state during
  // render rather than in an effect, matching AdminShell.tsx's own
  // established convention for this exact pattern.
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    if (mobileNavOpen) setMobileNavOpen(false);
  }

  return (
    <div className="flex min-h-screen bg-background text-text">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col bg-[var(--brand-ink)] lg:flex">
        <div className="flex h-16 shrink-0 items-center px-5">
          <Logo onDark />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <NavLinks />
        </div>
        <div className="p-3">
          <SidebarFooterCard />
        </div>
      </aside>

      {/* Mobile nav drawer */}
      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileNavOpen(false)} aria-hidden="true" />
          <div className="relative flex w-72 max-w-[85vw] flex-col bg-[var(--brand-ink)] shadow-lifted">
            <div className="flex h-16 shrink-0 items-center justify-between px-5">
              <Logo onDark />
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close menu"
                className="rounded-md p-1.5 text-on-primary-muted hover:bg-white/10 hover:text-on-primary"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3">
              <NavLinks onNavigate={() => setMobileNavOpen(false)} />
            </div>
            <div className="p-3">
              <SidebarFooterCard />
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open dashboard menu"
            className="rounded-md p-2 text-text-soft hover:bg-surface-alt lg:hidden"
          >
            <Menu aria-hidden="true" className="h-5 w-5" />
          </button>

          <form action="/courses" method="GET" className="min-w-0 flex-1 max-w-md" role="search">
            <label htmlFor="dashboard-search" className="sr-only">
              Search careers, courses, universities
            </label>
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                id="dashboard-search"
                type="search"
                name="q"
                placeholder="Search careers, courses, universities…"
                className="h-10 w-full rounded-full border border-border bg-surface-alt pl-10 pr-4 text-sm text-text placeholder:text-muted focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              />
            </div>
          </form>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-3">
            <Link
              href="/payments"
              aria-label="Notifications"
              className="flex h-9 w-9 items-center justify-center rounded-full text-text-soft hover:bg-surface-alt hover:text-primary"
            >
              <Bell aria-hidden="true" className="h-[1.1rem] w-[1.1rem]" />
            </Link>
            <UserMenu studentName={studentName} studentEmail={studentEmail} />
          </div>
        </header>

        <main id="main-content" className="min-w-0 flex-1 overflow-x-hidden">
          {/* UX10-M01 — pb-24 (plus the tab bar's own safe-area padding)
              clears the new fixed MobileTabBar below `lg:`, so the last
              real card on every app-style page never sits underneath it. */}
          <div className="mx-auto w-full max-w-[1600px] px-4 py-6 pb-24 sm:px-6 lg:px-10 lg:py-8 lg:pb-8">{children}</div>
        </main>
      </div>

      <MobileTabBar />
    </div>
  );
}
