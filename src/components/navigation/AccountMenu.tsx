"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LogOut, Receipt, Settings, ShieldCheck, UserCog } from "lucide-react";
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
 * The signed-in account control of the global header (CIUX-01B restyle of
 * the M-series role-aware menu): a round button with the account's initial
 * that opens a small panel with the role label, name, the links for that
 * role (student/admin/counsellor — src/lib/navigation/account-menu.ts), a
 * Settings placeholder, and Log out. Signed out it renders nothing: the
 * header shows "Log in" and "Sign up" itself (HeaderActions in Header.tsx).
 *
 * Role comes from `public.profiles.account_type` via useAuthProfile. This is
 * presentation and navigation only, not authorization (see the docblocks on
 * use-auth-profile.ts and account-menu.ts). No auth logic changed here.
 * Styling lives in src/styles/site-header.css so the homepage and every
 * other page render it identically.
 */
export function AccountMenu() {
  const { user, accountType, ready } = useAuthProfile();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const [lastPathname, setLastPathname] = useState(pathname);

  // Close whenever the route changes (adjust state during render rather
  // than in an effect, per https://react.dev/learn/you-might-not-need-an-effect).
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!ready || !user) return null;

  const firstName = firstNameOf(user);
  const roleLabel = resolveAccountMenuLabel(accountType);
  const roleLinks = getAccountMenuLinks(accountType);

  return (
    <div ref={containerRef} className="nwh-acct" data-v54-free="">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="account-menu-panel"
        aria-label={`Account menu for ${firstName}, ${roleLabel}`}
        className="nwh-account"
      >
        <span aria-hidden="true">{(firstName || "?").slice(0, 1).toUpperCase()}</span>
      </button>

      {open ? (
        <div id="account-menu-panel" aria-label="Account" className="nwh-acct-panel">
          <div className="nwh-acct-who">
            <p className="nwh-acct-name">{firstName}</p>
            <p className="nwh-acct-role">{roleLabel}</p>
            <p className="nwh-acct-email">{user.email}</p>
          </div>
          <ul className="nwh-acct-list">
            {roleLinks.map((link) => {
              const Icon = LINK_ICONS[link.kind];
              return (
                <li key={link.kind}>
                  <Link href={link.href} className="nwh-acct-item">
                    <Icon aria-hidden="true" />
                    {link.label}
                  </Link>
                </li>
              );
            })}
            <li>
              <button type="button" disabled aria-disabled="true" title="Settings are coming in a later milestone" className="nwh-acct-item">
                <Settings aria-hidden="true" />
                Settings
                <span className="nwh-acct-soon">Soon</span>
              </button>
            </li>
          </ul>
          <form action={logout} className="nwh-acct-out">
            <button type="submit" className="nwh-acct-item" data-danger="">
              <LogOut aria-hidden="true" />
              Log out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
