"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronDown, Compass, LayoutDashboard, LogIn, LogOut, Menu, UserPlus, X } from "lucide-react";
import { EXPLORE_NAV, PRIMARY_NAV } from "@/config/site";
import { LinkButton } from "@/components/ui/Button";
import { logout } from "@/lib/supabase/actions";
import { firstNameOf, useAuthUser } from "@/lib/supabase/use-auth-user";
import { LanguageSelector } from "./LanguageSelector";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";

/**
 * UX03-04 — mobile public navigation.
 *
 * Rebuilt around an intentional hierarchy rather than the desktop nav
 * simply compressed into a list: Explore (expandable, matching the
 * desktop dropdown's four entries) → the same short top-level row shown
 * on desktop (How It Works / Counselling / Pricing / About) → Account
 * (Sign In / Get Started, or Dashboard / Log out when signed in) →
 * Language. The drawer mechanics (native <dialog>, body-scroll lock,
 * close on Escape/outside/route-change) are unchanged from the prior
 * implementation — only the content structure inside it changed.
 */
export function MobileNav() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const pathname = usePathname();
  const [lastPathname, setLastPathname] = useState(pathname);
  const { user, ready } = useAuthUser();

  // Close whenever the route changes (adjust state during render rather
  // than in an effect, per https://react.dev/learn/you-might-not-need-an-effect).
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      document.body.style.overflow = "hidden";
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => {
      setOpen(false);
      document.body.style.overflow = "";
    };
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, []);

  // Collapse the Explore section fresh each time the drawer opens (adjust
  // state during render rather than in an effect, matching the pathname
  // tracking above and https://react.dev/learn/you-might-not-need-an-effect).
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setExploreOpen(false);
  }

  return (
    <div className="xl:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="mobile-nav-dialog"
        aria-label="Open menu"
        className="flex h-11 w-11 items-center justify-center rounded-md text-primary hover:bg-surface-alt"
      >
        <Menu aria-hidden="true" className="h-6 w-6" />
      </button>

      <dialog
        id="mobile-nav-dialog"
        ref={dialogRef}
        aria-label="Site menu"
        className="fixed inset-y-0 right-0 m-0 h-full max-h-none w-[86vw] max-w-sm rounded-none border-0 bg-surface p-0 shadow-lifted backdrop:bg-primary-dark/40"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <Logo />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="flex h-11 w-11 items-center justify-center rounded-md text-muted hover:bg-surface-alt hover:text-text"
            >
              <X aria-hidden="true" className="h-6 w-6" />
            </button>
          </div>

          <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-5 py-6">
            <ul className="space-y-1">
              <li>
                <button
                  type="button"
                  onClick={() => setExploreOpen((v) => !v)}
                  aria-expanded={exploreOpen}
                  aria-controls="mobile-explore-panel"
                  className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-3 text-base font-medium text-text hover:bg-surface-alt"
                >
                  <span className="flex items-center gap-2.5">
                    <Compass aria-hidden="true" className="h-4 w-4 text-secondary" />
                    Explore
                  </span>
                  <ChevronDown aria-hidden="true" className={cn("h-4 w-4 transition-transform", exploreOpen && "rotate-180")} />
                </button>
                {exploreOpen ? (
                  <ul id="mobile-explore-panel" className="ml-3 mt-1 space-y-1 border-l border-border pl-4">
                    {EXPLORE_NAV.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          className="block rounded-md px-3 py-2.5 text-sm font-medium text-text-soft hover:bg-surface-alt hover:text-primary"
                        >
                          {link.label}
                          {link.description ? (
                            <span className="mt-0.5 block text-xs font-normal text-muted">{link.description}</span>
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
              {PRIMARY_NAV.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="block rounded-md px-3 py-3 text-base font-medium text-text hover:bg-surface-alt"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            {ready ? (
              <div className="mt-6 border-t border-border pt-6">
                <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wide text-muted">Account</p>
                {user ? (
                  <div className="space-y-1">
                    <p className="truncate px-3 text-sm text-muted">
                      Signed in as <span className="font-medium text-text">{firstNameOf(user)}</span>
                    </p>
                    <Link
                      href="/dashboard"
                      className="flex items-center gap-2.5 rounded-md px-3 py-3 text-base font-medium text-text hover:bg-surface-alt"
                    >
                      <LayoutDashboard aria-hidden="true" className="h-4 w-4" />
                      Dashboard
                    </Link>
                    <form action={logout}>
                      <button
                        type="submit"
                        className="flex w-full items-center gap-2.5 rounded-md px-3 py-3 text-left text-base font-medium text-error hover:bg-error-light"
                      >
                        <LogOut aria-hidden="true" className="h-4 w-4" />
                        Log out
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Link
                      href="/login"
                      className="flex items-center gap-2.5 rounded-md px-3 py-3 text-base font-medium text-text hover:bg-surface-alt"
                    >
                      <LogIn aria-hidden="true" className="h-4 w-4" />
                      Sign In
                    </Link>
                  </div>
                )}
              </div>
            ) : null}

            <div className="mt-6 border-t border-border pt-6">
              <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wide text-muted">Language</p>
              <div className="px-3">
                <LanguageSelector compact />
              </div>
            </div>
          </nav>

          {!user ? (
            <div className="border-t border-border p-5">
              <LinkButton href="/register" className="w-full justify-center" icon={<UserPlus aria-hidden="true" className="h-4 w-4" />}>
                Get Started
              </LinkButton>
            </div>
          ) : null}
        </div>
      </dialog>
    </div>
  );
}
