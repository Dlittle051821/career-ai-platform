"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { CalendarCheck, LayoutDashboard, LogOut, Menu, X } from "lucide-react";
import { AUTH_LINKS, DISCOVERY_SESSION_CTA } from "@/config/site";
import { LinkButton } from "@/components/ui/Button";
import { logout } from "@/lib/supabase/actions";
import { firstNameOf, useAuthUser } from "@/lib/supabase/use-auth-user";
import { NextwiseBrandLogo } from "@/components/brand/NextwiseBrandLogo";
import { MobileNavGroups } from "./MobileNavGroups";
import { WorkspaceEntryLink } from "./WorkspaceEntryLink";

/**
 * CIUX-01 — the mobile and tablet menu (below 1024 px). A native modal
 * <dialog> (focus is trapped and Escape closes it, both by the browser),
 * full width on phones and a 26 rem sheet on tablets. Order: the free
 * session call to action, quick links to the three most-used destinations,
 * the grouped navigation (the same NAV_GROUPS as desktop), then account.
 * Closes on navigation; body scroll is locked while open; focus returns to
 * the menu button on close.
 */
const QUICK_LINKS = [
  { label: "Careers", href: "/careers" },
  { label: "Study Abroad", href: "/abroad" },
  { label: "Universities & Courses", href: "/courses" },
];

export function MobileNav() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastPathname, setLastPathname] = useState(pathname);
  const { user, ready } = useAuthUser();

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
      buttonRef.current?.focus();
    };
    // A click on the backdrop (the dialog element itself) closes the menu.
    const handleClick = (e: MouseEvent) => {
      if (e.target === dialog) dialog.close();
    };
    dialog.addEventListener("close", handleClose);
    dialog.addEventListener("click", handleClick);
    return () => {
      dialog.removeEventListener("close", handleClose);
      dialog.removeEventListener("click", handleClick);
      document.body.style.overflow = "";
    };
  }, []);

  const close = () => setOpen(false);

  return (
    <div className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="mobile-nav-dialog"
        aria-label="Open menu"
        className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/15 bg-surface text-primary transition-colors duration-[var(--duration-fast)] hover:border-primary/35"
      >
        <Menu aria-hidden="true" className="h-5 w-5" />
      </button>

      <dialog
        id="mobile-nav-dialog"
        ref={dialogRef}
        aria-label="Site menu"
        className="ciux-sheet fixed inset-y-0 right-0 left-auto m-0 h-full max-h-none w-full max-w-[26rem] border-0 bg-surface p-0 text-text shadow-lifted backdrop:bg-[rgba(3,4,95,0.32)] backdrop:backdrop-blur-[2px]"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-5 pb-3 pt-4">
            <Link href="/" onClick={close} aria-label="Nextwise home" className="rounded-md">
              <NextwiseBrandLogo variant="compact" tone="light" height={32} label="" />
            </Link>
            <button
              type="button"
              onClick={close}
              aria-label="Close menu"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/15 text-primary transition-colors hover:border-primary/35"
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
            <LinkButton
              href={DISCOVERY_SESSION_CTA.href}
              size="lg"
              className="mt-1 w-full"
              icon={<CalendarCheck aria-hidden="true" className="h-[18px] w-[18px]" />}
            >
              {DISCOVERY_SESSION_CTA.label}
            </LinkButton>

            <nav aria-label="Quick links" className="mt-4">
              <ul className="flex flex-wrap gap-2">
                {QUICK_LINKS.map((q) => (
                  <li key={q.href}>
                    <Link
                      href={q.href}
                      onClick={close}
                      className="inline-flex min-h-[44px] items-center rounded-full border border-primary/15 px-4 text-sm font-semibold text-primary transition-colors hover:border-primary/35 hover:bg-surface-alt"
                    >
                      {q.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <nav aria-label="Main" className="mt-5">
              <MobileNavGroups onNavigate={close} />
            </nav>

            {ready ? (
              <div className="mt-6 border-t border-border pt-5">
                {user ? (
                  <div className="space-y-1">
                    <p className="truncate px-4 pb-1 text-sm text-muted">
                      Signed in as <span className="font-medium text-text">{firstNameOf(user)}</span>
                    </p>
                    <WorkspaceEntryLink forceLabel className="!min-h-[48px] !w-full !rounded-xl !border-0 !px-4 !text-[15px]" />
                    <Link
                      href="/dashboard"
                      onClick={close}
                      className="flex min-h-[48px] items-center gap-2.5 rounded-xl px-4 text-[15px] font-medium text-text hover:bg-surface-alt"
                    >
                      <LayoutDashboard aria-hidden="true" className="h-4 w-4" />
                      Dashboard
                    </Link>
                    <form action={logout}>
                      <button
                        type="submit"
                        className="flex min-h-[48px] w-full items-center gap-2.5 rounded-xl px-4 text-left text-[15px] font-medium text-error hover:bg-error-light"
                      >
                        <LogOut aria-hidden="true" className="h-4 w-4" />
                        Log out
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <LinkButton href={AUTH_LINKS.login.href} variant="outline" className="w-full">
                      {AUTH_LINKS.login.label}
                    </LinkButton>
                    <LinkButton href={AUTH_LINKS.signup.href} variant="secondary" className="w-full">
                      {AUTH_LINKS.signup.label}
                    </LinkButton>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </dialog>
    </div>
  );
}
