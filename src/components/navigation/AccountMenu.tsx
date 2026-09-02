"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  LayoutDashboard,
  LogIn,
  LogOut,
  Receipt,
  Settings,
  ShieldCheck,
  UserCircle,
  UserCog,
  UserPlus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { logout } from "@/lib/supabase/actions";
import { firstNameOf } from "@/lib/supabase/use-auth-user";
import { useAuthProfile } from "@/lib/supabase/use-auth-profile";
import { getAccountMenuLinks, resolveAccountMenuLabel, type AccountMenuLinkKind } from "@/lib/navigation/account-menu";

const LINK_ICONS: Record<AccountMenuLinkKind, LucideIcon> = {
  dashboard: LayoutDashboard,
  payments: Receipt,
  "admin-dashboard": ShieldCheck,
  "counsellor-workspace": UserCog,
};

/**
 * Replaces the Milestone 1 "Student login" (coming-soon) modal with a real,
 * role-aware auth control. Logged out: compact Log in / Register links.
 * Logged in: a small dropdown with the account's role label, name, the
 * links appropriate to that role (student/admin/counsellor — see
 * src/lib/navigation/account-menu.ts), a Settings placeholder, and Log out.
 *
 * Role comes from `public.profiles.account_type` via useAuthProfile
 * (src/lib/supabase/use-auth-profile.ts) — this used to only read
 * `supabase.auth.getUser()` (no role on it at all), which is why this menu
 * was always student-oriented regardless of the signed-in account's actual
 * role. This is presentation/navigation only, not authorization — see the
 * docblocks on use-auth-profile.ts and account-menu.ts for why that's safe.
 *
 * Auth state is read client-side (getUser() + onAuthStateChange) rather
 * than passed from the server layout, so a login/register/logout — which
 * already triggers router.refresh() or a full navigation — updates this
 * instantly without adding a Supabase round trip to every page render.
 */
export function AccountMenu() {
  const { user, accountType, ready } = useAuthProfile();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const [lastPathname, setLastPathname] = useState(pathname);

  // Close whenever the route changes (adjust state during render rather
  // than in an effect, per https://react.dev/learn/you-might-not-need-an-effect).
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    if (open) setOpen(false);
  }

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Avoid flashing the wrong state before the first client check resolves.
  if (!ready) {
    return <div aria-hidden="true" className="h-9 w-9 shrink-0" />;
  }

  if (!user) {
    return (
      <div className="flex shrink-0 items-center gap-1">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1.5 text-sm font-medium text-text-soft hover:text-primary"
        >
          <LogIn aria-hidden="true" className="h-4 w-4" />
          <span className="hidden 2xl:inline">Log in</span>
        </Link>
        <Link
          href="/register"
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1.5 text-sm font-medium text-secondary-dark hover:bg-secondary-light"
        >
          <UserPlus aria-hidden="true" className="h-4 w-4" />
          <span className="hidden 2xl:inline">Register</span>
        </Link>
      </div>
    );
  }

  const firstName = firstNameOf(user);
  const roleLabel = resolveAccountMenuLabel(accountType);
  const roleLinks = getAccountMenuLinks(accountType);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls="account-menu-panel"
        aria-label={`Account menu for ${firstName}, ${roleLabel}`}
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1.5 text-sm font-medium text-text-soft hover:bg-surface-alt hover:text-primary"
      >
        <UserCircle aria-hidden="true" className="h-5 w-5" />
        <span className="hidden 2xl:inline">{roleLabel}</span>
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
      </button>

      {open ? (
        <div
          id="account-menu-panel"
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-full z-50 mt-2 w-52 rounded-[var(--radius-card)] border border-border bg-surface p-1.5 shadow-lifted"
        >
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold text-primary">{firstName}</p>
            <p className="truncate text-xs font-medium text-secondary-dark">{roleLabel}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <div className="my-1 border-t border-border" />
          {roleLinks.map((link) => {
            const Icon = LINK_ICONS[link.kind];
            return (
              <Link
                key={link.kind}
                href={link.href}
                role="menuitem"
                className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-text-soft hover:bg-surface-alt hover:text-primary"
              >
                <Icon aria-hidden="true" className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
          <button
            type="button"
            role="menuitem"
            disabled
            aria-disabled="true"
            title="Settings are coming in a later milestone"
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-muted opacity-60"
          >
            <Settings aria-hidden="true" className="h-4 w-4" />
            Settings
            <span className="ml-auto text-xs">Soon</span>
          </button>
          <div className="my-1 border-t border-border" />
          <form action={logout}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-error hover:bg-error-light"
            >
              <LogOut aria-hidden="true" className="h-4 w-4" />
              Log out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
