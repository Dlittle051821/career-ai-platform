"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import type { NavLink } from "@/types";
import { isAnyNavLinkActive, isNavLinkActive } from "@/lib/navigation/active-nav";
import { cn } from "@/lib/utils";

/**
 * NW04.5 — generic header dropdown, extracted from ExploreMenu.tsx's own
 * (pre-NW04) bespoke implementation so the same keyboard/ARIA-reviewed
 * disclosure pattern can back three menus (Products, Resources, About)
 * instead of being copy-pasted three times. Behavior is intentionally
 * byte-for-byte what ExploreMenu.tsx already did — aria-haspopup/
 * aria-expanded on the trigger, role="menu"/"menuitem" on the panel,
 * close on outside click, Escape, and route change — nothing about the
 * reviewed interaction model changes, only which NavLink[] it renders.
 *
 * ExploreMenu.tsx itself is kept as a thin wrapper around this component
 * (see that file) rather than deleted, so its existing import sites and
 * any future direct references keep working unchanged.
 */
export function NavDropdown({ label, items, id }: { label: string; items: readonly NavLink[]; id: string }) {
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

  const isActive = isAnyNavLinkActive(
    pathname,
    items.map((link) => link.href)
  );
  const panelId = `${id}-menu-panel`;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={panelId}
        className={cn(
          "group relative inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-2 text-sm transition-colors duration-200",
          open ? "bg-surface-alt text-primary" : "text-text-soft hover:text-primary",
          isActive && !open ? "font-semibold text-primary" : "font-medium"
        )}
      >
        {label}
        <ChevronDown aria-hidden="true" className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-x-2.5 -bottom-px h-0.5 origin-center scale-x-0 rounded-full bg-primary transition-transform duration-200 ease-out motion-reduce:transition-none",
            isActive && !open ? "scale-x-100" : "group-hover:scale-x-100"
          )}
        />
      </button>

      {open ? (
        <div
          id={panelId}
          role="menu"
          aria-label={label}
          className="absolute left-0 top-full z-50 mt-2 w-72 rounded-[var(--radius-card)] border border-border bg-surface p-1.5 shadow-lifted"
        >
          {items.map((link) => {
            const itemActive = isNavLinkActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                role="menuitem"
                aria-current={itemActive ? "page" : undefined}
                className={cn("block rounded-md px-3 py-2.5 text-sm hover:bg-surface-alt", itemActive && "bg-surface-alt")}
              >
                <span className={cn("font-medium", itemActive ? "text-primary" : "text-text")}>{link.label}</span>
                {link.description ? <span className="mt-0.5 block text-xs text-muted">{link.description}</span> : null}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
