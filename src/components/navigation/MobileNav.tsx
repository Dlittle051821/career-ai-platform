"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, LogIn, LogOut, Menu, UserPlus, X } from "lucide-react";
import { HOME_NAV_LINK, MAIN_NAV_ITEMS } from "@/config/site";
import { LinkButton } from "@/components/ui/Button";
import { logout } from "@/lib/supabase/actions";
import { firstNameOf, useAuthUser } from "@/lib/supabase/use-auth-user";
import { isNavLinkActive } from "@/lib/navigation/active-nav";
import { LanguageSelector } from "./LanguageSelector";
import { WorkspaceEntryLink } from "./WorkspaceEntryLink";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";

/**
 * NW08.5 — mobile public navigation, flattened to match the new desktop
 * IA one-for-one: Home → the same five MAIN_NAV_ITEMS in the same order
 * (Explore Careers / Career Intelligence / Study Abroad / Universities /
 * Courses) → Account (role-aware workspace link + Sign In/Get Started, or
 * Dashboard/Log out when signed in) → Language. The brief's own
 * instruction — "Mobile should prioritize the same 6 items plus Sign
 * In/Get Started, not 6 tiny tabs" — and its removal of "Products"/"For
 * Students"/"Resources"/"About" as nav groupings apply equally to the
 * mobile drawer, so the prior collapsible "Resources" section and the
 * flat secondary-page row (How It Works/Counselling/Pricing/About) are
 * removed from here; those pages remain fully reachable via the footer,
 * which still renders on every page at every breakpoint (see
 * src/config/site.ts's SECONDARY_NAV/FOOTER_NAV). The drawer mechanics
 * (native <dialog>, body-scroll lock, close on Escape/outside/
 * route-change) are unchanged from the prior implementation — only the
 * content structure inside it changed.
 */
export function MobileNav() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
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
                <Link
                  href={HOME_NAV_LINK.href}
                  aria-current={isNavLinkActive(pathname, HOME_NAV_LINK.href) ? "page" : undefined}
                  className={cn(
                    "block rounded-md px-3 py-3 text-base font-medium hover:bg-surface-alt",
                    isNavLinkActive(pathname, HOME_NAV_LINK.href) ? "bg-surface-alt text-primary font-semibold" : "text-text"
                  )}
                >
                  {HOME_NAV_LINK.label}
                </Link>
              </li>
              {/* NW08.5 — the exact same five MAIN_NAV_ITEMS (Explore
                  Careers, Career Intelligence, Study Abroad, Universities,
                  Courses), flat, in the same order as Header.tsx's desktop
                  row. No collapsible groups, no separate "For Students"/
                  "Resources" sections. */}
              {MAIN_NAV_ITEMS.map((link) => {
                const active = isNavLinkActive(pathname, link.href);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "block rounded-md px-3 py-3 text-base font-medium hover:bg-surface-alt",
                        active ? "bg-surface-alt text-primary font-semibold" : "text-text"
                      )}
                    >
                      {link.label}
                      {link.description ? (
                        <span className="mt-0.5 block text-xs font-normal text-muted">{link.description}</span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>

            {ready ? (
              <div className="mt-6 border-t border-border pt-6">
                <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wide text-muted">Account</p>
                {user ? (
                  <div className="space-y-1">
                    <p className="truncate px-3 text-sm text-muted">
                      Signed in as <span className="font-medium text-text">{firstNameOf(user)}</span>
                    </p>
                    {/* NW08.5 — role-aware workspace entry, same data
                        WorkspaceEntryLink uses on desktop, rendered inline
                        in the drawer's own list style rather than that
                        component's compact pill. */}
                    <WorkspaceEntryLink forceLabel className="!border-0 !px-3 !py-3 !text-base" />
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
