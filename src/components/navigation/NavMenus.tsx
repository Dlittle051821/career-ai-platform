"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ChevronDown } from "lucide-react";
import { DISCOVERY_SESSION_CTA, HEADER_DIRECT_LINKS, HEADER_LEADING_LINKS, HEADER_NAV_HREFS, NAV_GROUPS, type NavGroup } from "@/config/site";
import { resolveActiveNavHref } from "@/lib/navigation/active-nav";

/**
 * The global desktop navigation (CIUX-01, unified in CIUX-01B): Home, three
 * disclosure menus (Explore, Free tools, How it works) and one direct link
 * (Pricing) inside the homepage's navigation capsule. The same component and
 * the same stylesheet (src/styles/site-header.css) render it on the homepage
 * and on every public page; only the active state changes with the route.
 *
 * Pattern: WAI-ARIA disclosure navigation (buttons with aria-expanded that
 * show a list of links) — not role="menu", which would remove normal Tab
 * order. Opens on click, on Enter/Space, and on pointer hover (mouse only,
 * with a short close delay; a click that follows a hover-open keeps it
 * open). Closes on Escape (focus returns to the trigger), outside click,
 * focus leaving the menu, choosing a link (at once, before the next page
 * has loaded), or navigation. Arrow Down on a trigger opens its
 * menu and focuses the first link; inside an open menu, Arrow Up/Down, Home
 * and End move between its links (they never scroll the page or move the
 * homepage chapters). Panels carry data-v54-free so the homepage chapter
 * controller leaves their keys alone.
 */
const HOVER_CLOSE_DELAY = 140;
const HOVER_CLICK_GRACE = 600;

export function NavMenus() {
  const pathname = usePathname();
  const [openId, setOpenId] = useState<NavGroup["id"] | null>(null);
  const [lastPath, setLastPath] = useState(pathname);
  const navRef = useRef<HTMLElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const hoverOpenedAt = useRef(0);
  const baseId = useId();
  // one most-specific match across the whole header, so a nested route lights up one place only
  const activeHref = resolveActiveNavHref(pathname, HEADER_NAV_HREFS);

  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (openId) setOpenId(null);
  }

  const cancelClose = () => window.clearTimeout(closeTimer.current);
  const scheduleClose = useCallback(() => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpenId(null), HOVER_CLOSE_DELAY);
  }, []);

  useEffect(() => {
    if (!openId) return;
    const onDown = (e: PointerEvent) => {
      if (!navRef.current?.contains(e.target as Node)) setOpenId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const trigger = document.getElementById(`${baseId}-${openId}-trigger`);
      setOpenId(null);
      trigger?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openId, baseId]);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  const focusPanelLink = (panel: HTMLElement | null, which: "first" | "last" | 1 | -1) => {
    if (!panel) return;
    const links = [...panel.querySelectorAll<HTMLAnchorElement>("a[href]")];
    if (!links.length) return;
    const i = links.indexOf(document.activeElement as HTMLAnchorElement);
    const next = which === "first" ? 0 : which === "last" ? links.length - 1 : (i + which + links.length) % links.length;
    links[next]?.focus();
  };

  const onPanelKeyDown = (e: ReactKeyboardEvent<HTMLElement>) => {
    const map = { ArrowDown: 1, ArrowUp: -1, Home: "first", End: "last" } as const;
    const move = map[e.key as keyof typeof map];
    if (move === undefined) return;
    e.preventDefault();
    e.stopPropagation();
    focusPanelLink(e.currentTarget, move);
  };

  return (
    <nav
      ref={navRef}
      aria-label="Main"
      className="nwh-nav"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpenId(null);
      }}
    >
      <ul>
        {HEADER_LEADING_LINKS.map((link) => {
          const active = link.href === activeHref;
          return (
            <li key={link.href} className="nwh-item">
              <Link href={link.href} aria-current={active ? "page" : undefined} className="nwh-pill">
                <span>{link.label}</span>
              </Link>
            </li>
          );
        })}
        {NAV_GROUPS.map((group) => {
          const open = openId === group.id;
          const active = group.links.some((l) => l.href === activeHref);
          const panelId = `${baseId}-${group.id}-panel`;
          return (
            <li
              key={group.id}
              className="nwh-item"
              onPointerEnter={(e) => {
                if (e.pointerType !== "mouse") return;
                cancelClose();
                if (openId !== group.id) hoverOpenedAt.current = Date.now();
                setOpenId(group.id);
              }}
              onPointerLeave={(e) => {
                if (e.pointerType === "mouse") scheduleClose();
              }}
            >
              <button
                id={`${baseId}-${group.id}-trigger`}
                type="button"
                className="nwh-pill"
                aria-expanded={open}
                aria-controls={panelId}
                data-active={active ? "" : undefined}
                onKeyDown={(e) => {
                  if (e.key !== "ArrowDown") return;
                  e.preventDefault();
                  e.stopPropagation();
                  cancelClose();
                  setOpenId(group.id);
                  requestAnimationFrame(() => focusPanelLink(document.getElementById(panelId), "first"));
                }}
                onClick={(e) => {
                  const fromHover = e.detail > 0 && Date.now() - hoverOpenedAt.current < HOVER_CLICK_GRACE;
                  setOpenId(open && !fromHover ? null : group.id);
                }}
              >
                <span>{group.label}</span>
                {active ? <span className="sr-only">(current section)</span> : null}
                <ChevronDown aria-hidden="true" />
              </button>
              <div
                id={panelId}
                hidden={!open}
                data-v54-free=""
                data-wide={group.id === "nextwise" ? "" : undefined}
                className="nwh-panel"
                onKeyDown={onPanelKeyDown}
              >
                <div className="nwh-card">
                  <p className="nwh-summary">{group.summary}</p>
                  <ul className="nwh-list">
                    {group.links.map((link) => {
                      const current = link.href === activeHref;
                      return (
                        <li key={link.href}>
                          <Link href={link.href} aria-current={current ? "page" : undefined} className="nwh-link" onClick={() => setOpenId(null)}>
                            <span className="nwh-link-title">
                              {link.label}
                              {current ? <span className="sr-only">(current page)</span> : null}
                            </span>
                            {link.description ? <span className="nwh-link-desc">{link.description}</span> : null}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                  <Link href={DISCOVERY_SESSION_CTA.href} className="nwh-book" onClick={() => setOpenId(null)}>
                    <span>
                      {DISCOVERY_SESSION_CTA.label}
                      <span className="nwh-link-desc">{DISCOVERY_SESSION_CTA.description}</span>
                    </span>
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
        {HEADER_DIRECT_LINKS.map((link) => {
          const active = link.href === activeHref;
          return (
            <li key={link.href} className="nwh-item">
              <Link href={link.href} aria-current={active ? "page" : undefined} className="nwh-pill">
                <span>{link.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
