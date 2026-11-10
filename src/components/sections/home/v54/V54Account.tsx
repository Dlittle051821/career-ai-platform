"use client";

import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useAuthProfile } from "@/lib/supabase/use-auth-profile";
import { getAccountMenuLinks } from "@/lib/navigation/account-menu";
import { V54_ACCOUNT, V54_NAV } from "@/lib/home/v54/config";

type Account = { signedIn: boolean; home: { href: string; label: string } };
const AccountContext = createContext<Account>({ signedIn: false, home: { href: "/dashboard", label: "Dashboard" } });

/**
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

/** Desktop header: "Log in" (quiet, outlined on hover) and "Sign up" (Electric Coral pill). */
export function V54HeaderActions() {
  const { signedIn, home } = useAccount();
  if (signedIn)
    return (
      <div className="v54-actions">
        <Link href={home.href} className="v54-signup" data-v54-account="workspace">
          {home.label}
          <span className="v54-arrow" aria-hidden="true">
            →
          </span>
        </Link>
      </div>
    );
  return (
    <div className="v54-actions">
      <Link href={V54_ACCOUNT.login.href} className="v54-login" data-v54-account="login">
        {V54_ACCOUNT.login.label}
      </Link>
      <Link href={V54_ACCOUNT.signup.href} className="v54-signup" data-v54-account="signup">
        {V54_ACCOUNT.signup.label}
      </Link>
    </div>
  );
}

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

/** Phones and portrait tablets: a menu button with the same links and the same clearly separated account actions. */
export function V54MobileMenu({ rootId }: { rootId: string }) {
  const { signedIn, home } = useAccount();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.getElementById(rootId);
    if (open) root?.setAttribute("data-v54-menu-open", "");
    else root?.removeAttribute("data-v54-menu-open");
    if (!open) return;
    panel.current?.querySelector<HTMLElement>("a")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !btn.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
      root?.removeAttribute("data-v54-menu-open");
    };
  }, [open, rootId]);

  return (
    <>
      <button
        ref={btn}
        type="button"
        className="v54-menu-btn"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true" />
      </button>
      <div ref={panel} id={panelId} className="v54-menu" data-open={open ? "" : undefined} hidden={!open}>
        <nav aria-label="Main">
          {V54_NAV.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="v54-menu-actions">
          {signedIn ? (
            <Link href={home.href} className="v54-signup" onClick={() => setOpen(false)}>
              {home.label}
            </Link>
          ) : (
            <>
              <Link href={V54_ACCOUNT.login.href} className="v54-login" onClick={() => setOpen(false)}>
                {V54_ACCOUNT.login.label}
              </Link>
              <Link href={V54_ACCOUNT.signup.href} className="v54-signup" onClick={() => setOpen(false)}>
                {V54_ACCOUNT.signup.label}
              </Link>
            </>
          )}
        </div>
      </div>
    </>
  );
}
