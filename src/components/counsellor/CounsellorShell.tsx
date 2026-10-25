"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CalendarHeart,
  ShieldCheck,
  FileCheck2,
  ClipboardList,
  ClipboardCheck,
  Menu,
  X,
  LogOut,
  Shield,
} from "lucide-react";
import { logout } from "@/lib/supabase/actions";
import { ADMIN_ROLE_LABELS, type CurrentAdmin } from "@/types/admin";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/navigation/Logo";

/**
 * NW07.2 — the Counsellor Studio's own branded shell, distinct from
 * AdminShell (which also serves finance/content_editor/analyst and shows
 * modules — Universities, Pricing, Billing Settings, Education Imports —
 * a counsellor has no permission for and should never have to navigate
 * around). Mirrors the NW07 mockup's navy sidebar exactly: Dashboard, My
 * Caseload, Discovery Sessions, Verifications, Recommendations, Tasks,
 * Applications (links into the existing NW06 admin surface — no duplicate
 * applications view is built here), Settings.
 *
 * Structurally this is the same pattern as AdminShell.tsx (desktop
 * sidebar, mobile drawer, breadcrumb header) — deliberately NOT a new
 * design system, just a counsellor-scoped nav list over the same shell
 * shape, per NW07_01_AUDIT.md §5's routing decision.
 */
interface CounsellorNavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
}

const COUNSELLOR_NAV: CounsellorNavItem[] = [
  { label: "Dashboard", href: "/counsellor", icon: LayoutDashboard },
  { label: "My Caseload", href: "/counsellor/students", icon: Users },
  { label: "Discovery Sessions", href: "/counsellor/discovery-sessions", icon: CalendarHeart },
  { label: "Verifications", href: "/counsellor/verifications", icon: ShieldCheck },
  { label: "Recommendations", href: "/counsellor/recommendations", icon: FileCheck2 },
  { label: "Tasks", href: "/counsellor/tasks", icon: ClipboardCheck },
  { label: "Applications", href: "/admin/applications", icon: ClipboardList },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/counsellor") return pathname === "/counsellor";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function crumbLabelFor(segment: string): string {
  if (segment === "new") return "New";
  if (/^[0-9a-f-]{8,}$/i.test(segment)) return "Detail";
  return segment
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Counsellor Studio modules" className="flex flex-col gap-0.5">
      {COUNSELLOR_NAV.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "bg-primary text-on-primary" : "text-on-primary-muted hover:bg-white/10 hover:text-on-primary"
            )}
          >
            <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function CounsellorShell({ admin, children }: { admin: CurrentAdmin; children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);

  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    if (mobileNavOpen) setMobileNavOpen(false);
  }

  const segments = pathname.split("/").filter(Boolean).slice(1); // drop leading "counsellor"
  const crumbs = [
    { label: "Counsellor Studio", href: "/counsellor" },
    ...segments.map((seg, i) => ({
      label: crumbLabelFor(seg),
      href: i === segments.length - 1 ? undefined : `/counsellor/${segments.slice(0, i + 1).join("/")}`,
    })),
  ];

  return (
    <div className="flex min-h-screen bg-background text-text">
      <aside className="hidden w-64 shrink-0 flex-col bg-primary lg:flex">
        <div className="flex h-16 items-center gap-2 border-b border-white/10 px-5">
          <Logo onDark />
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-on-primary-muted">
            Counsellor Studio
          </span>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <NavLinks />
        </div>
        <div className="border-t border-white/10 p-4">
          <p className="truncate text-sm font-medium text-on-primary">{admin.email ?? "Counsellor"}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-on-primary-muted">
            <Shield aria-hidden="true" className="h-3.5 w-3.5" />
            {ADMIN_ROLE_LABELS[admin.role]}
          </p>
          <Link href="/counsellor/settings" className="mt-3 block text-xs font-medium text-on-primary-muted hover:text-on-primary">
            Settings
          </Link>
          <form action={logout} className="mt-3">
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-[var(--radius-control)] px-3 py-2 text-sm font-medium text-on-primary-muted hover:bg-white/10 hover:text-on-primary"
            >
              <LogOut aria-hidden="true" className="h-4 w-4" />
              Log out
            </button>
          </form>
        </div>
      </aside>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileNavOpen(false)} aria-hidden="true" />
          <div className="relative flex w-72 max-w-[85vw] flex-col bg-primary shadow-lifted">
            <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
              <div className="flex items-center gap-2">
                <Logo onDark />
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-on-primary-muted">
                  Counsellor Studio
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close menu"
                className="rounded-md p-1.5 text-on-primary-muted hover:bg-white/10 hover:text-on-primary"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4">
              <NavLinks onNavigate={() => setMobileNavOpen(false)} />
            </div>
            <div className="border-t border-white/10 p-4">
              <p className="truncate text-sm font-medium text-on-primary">{admin.email ?? "Counsellor"}</p>
              <p className="mt-0.5 text-xs text-on-primary-muted">{ADMIN_ROLE_LABELS[admin.role]}</p>
              <Link href="/counsellor/settings" className="mt-3 block text-xs font-medium text-on-primary-muted hover:text-on-primary">
                Settings
              </Link>
              <form action={logout} className="mt-3">
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 rounded-[var(--radius-control)] px-3 py-2 text-sm font-medium text-on-primary-muted hover:bg-white/10 hover:text-on-primary"
                >
                  <LogOut aria-hidden="true" className="h-4 w-4" />
                  Log out
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open Counsellor Studio menu"
            className="rounded-md p-2 text-text-soft hover:bg-surface-alt lg:hidden"
          >
            <Menu aria-hidden="true" className="h-5 w-5" />
          </button>
          <nav aria-label="Breadcrumb" className="min-w-0 flex-1 overflow-x-auto">
            <ol className="flex items-center gap-1.5 whitespace-nowrap text-sm text-muted">
              {crumbs.map((crumb, i) => {
                const isLast = i === crumbs.length - 1;
                return (
                  <li key={`${crumb.label}-${i}`} className="flex items-center gap-1.5">
                    {crumb.href && !isLast ? (
                      <Link href={crumb.href} className="hover:text-primary">
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className={isLast ? "font-medium text-text" : undefined} aria-current={isLast ? "page" : undefined}>
                        {crumb.label}
                      </span>
                    )}
                    {!isLast ? <span aria-hidden="true">/</span> : null}
                  </li>
                );
              })}
            </ol>
          </nav>
          <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-border-strong bg-surface-alt px-2.5 py-1 text-xs font-medium text-text-soft sm:flex">
            <Shield aria-hidden="true" className="h-3.5 w-3.5" />
            {ADMIN_ROLE_LABELS[admin.role]}
          </span>
        </header>

        <main id="main-content" className="min-w-0 flex-1 overflow-x-hidden px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
