"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { HEADER_DIRECT_LINKS, HEADER_LEADING_LINKS, HEADER_NAV_HREFS, NAV_GROUPS, type NavGroup } from "@/config/site";
import { resolveActiveNavHref } from "@/lib/navigation/active-nav";

/**
 * The phone navigation list: the same NAV_GROUPS as the desktop menus, as
 * expandable groups (disclosure buttons, 48 px rows; links 44 px). The group
 * holding the current page starts open. Rendered inside the global header's
 * menu panel (MobileNav) on every page, so phones see one structure
 * everywhere. Styling lives in src/styles/site-header.css (CIUX-01B), not in
 * utility classes, so the homepage and other pages render it identically.
 */
export function MobileNavGroups({ onNavigate, className }: { onNavigate?: () => void; className?: string }) {
  const pathname = usePathname();
  const activeHref = resolveActiveNavHref(pathname, HEADER_NAV_HREFS);
  const initial = NAV_GROUPS.find((g) => g.links.some((l) => l.href === activeHref))?.id ?? null;
  const [openId, setOpenId] = useState<NavGroup["id"] | null>(initial);
  const baseId = useId();

  return (
    <ul className={className ? `ciux-mobile-groups ${className}` : "ciux-mobile-groups"}>
      {HEADER_LEADING_LINKS.map((link) => {
        const current = link.href === activeHref;
        return (
          <li key={link.href}>
            <Link href={link.href} onClick={onNavigate} aria-current={current ? "page" : undefined} className="ciux-mg-trigger">
              {link.label}
            </Link>
          </li>
        );
      })}
      {NAV_GROUPS.map((group) => {
        const open = openId === group.id;
        const panelId = `${baseId}-${group.id}`;
        return (
          <li key={group.id}>
            <button
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setOpenId(open ? null : group.id)}
              className="ciux-mg-trigger"
            >
              <span>
                {group.label}
                <span className="ciux-mg-summary">{group.summary}</span>
              </span>
              <ChevronDown aria-hidden="true" />
            </button>
            <ul id={panelId} hidden={!open} className="ciux-mg-list">
              {group.links.map((link) => {
                const current = link.href === activeHref;
                return (
                  <li key={link.href}>
                    <Link href={link.href} onClick={onNavigate} aria-current={current ? "page" : undefined} className="ciux-mg-link">
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
        const current = link.href === activeHref;
        return (
          <li key={link.href}>
            <Link href={link.href} onClick={onNavigate} aria-current={current ? "page" : undefined} className="ciux-mg-trigger">
              {link.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
