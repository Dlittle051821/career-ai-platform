"use client";

import { createContext, useContext, type ReactNode } from "react";
import Link from "next/link";
import { useAuthProfile } from "@/lib/supabase/use-auth-profile";
import { getAccountMenuLinks } from "@/lib/navigation/account-menu";
import { V54_ACCOUNT } from "@/lib/home/v54/config";

type Account = { signedIn: boolean; home: { href: string; label: string } };
const AccountContext = createContext<Account>({ signedIn: false, home: { href: "/dashboard", label: "Dashboard" } });

/**
 * CIUX-01B: the header's account actions and phone menu moved to the global
 * header (components/navigation/Header.tsx, MobileNav.tsx), so this file now
 * serves only the hero's call to action.
 *
 * One read of the existing client-side auth state (useAuthProfile — the same
 * hook the site's AccountMenu uses; no new auth logic) shared by the header,
 * the mobile menu and the hero call to action. Signed out (and until the
 * first check resolves): Log in + Sign up. Signed in: one link to the
 * account's own workspace (role-aware, from getAccountMenuLinks).
 */
export function V54AccountProvider({ children }: { children: ReactNode }) {
  const { user, accountType, ready } = useAuthProfile();
  const first = getAccountMenuLinks(accountType)[0];
  const value: Account = {
    signedIn: ready && Boolean(user),
    home: first ? { href: first.href, label: first.label } : { href: "/dashboard", label: "Dashboard" },
  };
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

const useAccount = () => useContext(AccountContext);

/** The hero's primary action: "Get started free" → registration; for a signed-in visitor, their workspace. */
export function V54PrimaryCta({ label }: { label: string }) {
  const { signedIn, home } = useAccount();
  return (
    <Link className="v54-btn v54-btn-primary" href={signedIn ? home.href : V54_ACCOUNT.start.href} data-v54-account={signedIn ? "workspace" : "start"}>
      {signedIn ? `Continue to your ${home.label.toLowerCase()}` : label}
      <span className="v54-arrow" aria-hidden="true">
        →
      </span>
    </Link>
  );
}
