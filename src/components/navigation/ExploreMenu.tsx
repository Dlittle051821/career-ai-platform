"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { EXPLORE_NAV } from "@/config/site";
import { cn } from "@/lib/utils";

/**
 * UX03-04 — public header "Explore" dropdown.
 *
 * Groups the four real exploration entry points (Careers/Courses/
 * Universities/Study Options — see EXPLORE_NAV in src/config/site.ts) under
 * one disclosure instead of each taking its own slot in an already-crowded
 * top-level nav. Deliberately small (four items, one-line descriptions,
 * no icons-as-meaning, no mega-menu columns) per the spec's own "avoid
 * giant mega-menus unless genuinely needed" instruction.
 *
 * Keyboard/ARIA pattern mirrors AccountMenu.tsx (this codebase's existing,
 * already-accessible disclosure pattern): aria-haspopup/aria-expanded on
 * the trigger, role="menu"/"menuitem" on the panel, close on outside
 * click, Escape, and route change.
 */
export function ExploreMenu() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const [lastPathname, setLastPathname] = useState(pathname);

  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    if (open) setOpen(false);
  }

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

  const isActive = EXPLORE_NAV.some((link) => pathname === link.href || pathname.startsWith(`${link.href}/`));

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls="explore-menu-panel"
        className={cn(
          "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
          isActive || open ? "bg-surface-alt text-primary" : "text-text-soft hover:bg-surface-alt hover:text-primary"
        )}
      >
        Explore
        <ChevronDown aria-hidden="true" className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div
          id="explore-menu-panel"
          role="menu"
          aria-label="Explore"
          className="absolute left-0 top-full z-50 mt-2 w-72 rounded-[var(--radius-card)] border border-border bg-surface p-1.5 shadow-lifted"
        >
          {EXPLORE_NAV.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              role="menuitem"
              className="block rounded-md px-3 py-2.5 text-sm hover:bg-surface-alt"
            >
              <span className="font-medium text-text">{link.label}</span>
              {link.description ? <span className="mt-0.5 block text-xs text-muted">{link.description}</span> : null}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
