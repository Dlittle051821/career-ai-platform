"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import type { NavLink } from "@/types";
import { LinkButton } from "@/components/ui/Button";
import { LanguageSelector } from "./LanguageSelector";
import { Logo } from "./Logo";

interface MobileNavProps {
  primaryLinks: NavLink[];
  utilityLinks: NavLink[];
}

export function MobileNav({ primaryLinks, utilityLinks }: MobileNavProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastPathname, setLastPathname] = useState(pathname);

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
              {primaryLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="block rounded-md px-3 py-3 text-base font-medium text-text hover:bg-surface-alt"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              {utilityLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="block rounded-md px-3 py-3 text-base font-medium text-secondary-dark hover:bg-surface-alt"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-6 border-t border-border pt-6">
              <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wide text-muted">Language</p>
              <div className="px-3">
                <LanguageSelector compact />
              </div>
            </div>
          </nav>

          <div className="border-t border-border p-5">
            <LinkButton href="/book-counselling" className="w-full justify-center">
              Book free counselling
            </LinkButton>
          </div>
        </div>
      </dialog>
    </div>
  );
}
