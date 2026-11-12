"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { HEADER_DIRECT_LINKS, NAV_GROUPS, type NavGroup } from "@/config/site";
import { isAnyNavLinkActive, isNavLinkActive } from "@/lib/navigation/active-nav";
import { cn } from "@/lib/utils";

/**
 * CIUX-01 — the mobile navigation list: the same NAV_GROUPS as the desktop
 * menus, as expandable groups (disclosure buttons, 48 px rows). The group
 * holding the current page starts open. Shared by the site's MobileNav and
 * the homepage's mobile menu, so phones see one structure everywhere.
 */
export function MobileNavGroups({ onNavigate, className }: { onNavigate?: () => void; className?: string }) {
  const pathname = usePathname();
  const initial = NAV_GROUPS.find((g) => isAnyNavLinkActive(pathname, g.links.map((l) => l.href)))?.id ?? null;
  const [openId, setOpenId] = useState<NavGroup["id"] | null>(initial);
  const baseId = useId();

  return (
    <ul className={cn("ciux-mobile-groups space-y-1", className)}>
      {NAV_GROUPS.map((group) => {
        const open = openId === group.id;
        const panelId = `${baseId}-${group.id}`;
        return (
          <li key={group.id} className="rounded-2xl">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setOpenId(open ? null : group.id)}
              className={cn(
                "ciux-mg-trigger flex min-h-[52px] w-full items-center justify-between gap-3 rounded-2xl px-4 text-left text-[17px] font-semibold text-primary transition-colors duration-[var(--duration-fast)]",
                open ? "bg-surface-alt" : "hover:bg-surface-alt"
              )}
            >
              <span>
                {group.label}
                <span className="ciux-mg-summary block text-[13px] font-normal text-muted">{group.summary}</span>
              </span>
              <ChevronDown
                aria-hidden="true"
                className={cn("h-5 w-5 shrink-0 transition-transform duration-[var(--duration-base)] motion-reduce:transition-none", open && "rotate-180")}
              />
            </button>
            <ul id={panelId} hidden={!open} className="ciux-mg-list mt-1 space-y-0.5 pb-2 pl-2">
              {group.links.map((link) => {
                const current = isNavLinkActive(pathname, link.href);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={onNavigate}
                      aria-current={current ? "page" : undefined}
                      className={cn(
                        "ciux-mg-link flex min-h-[48px] items-center gap-3 rounded-xl px-4 py-2 text-[15px] font-medium transition-colors duration-[var(--duration-fast)] hover:bg-[var(--brand-coral-pale)]",
                        current ? "bg-[var(--brand-coral-pale)] font-semibold text-primary" : "text-text"
                      )}
                    >
                      {current ? <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-action" /> : null}
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
        );
      })}
      {HEADER_DIRECT_LINKS.map((link) => {
        const current = isNavLinkActive(pathname, link.href);
        return (
          <li key={link.href}>
            <Link
              href={link.href}
              onClick={onNavigate}
              aria-current={current ? "page" : undefined}
              className={cn(
                "ciux-mg-trigger flex min-h-[52px] items-center rounded-2xl px-4 text-[17px] font-semibold text-primary transition-colors duration-[var(--duration-fast)] hover:bg-surface-alt",
                current && "bg-surface-alt"
              )}
            >
              {link.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
