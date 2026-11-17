"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Compass, Sparkles } from "lucide-react";
import { HEADER_NAV, HEADER_NAV_HREFS, navHrefPath, type HeaderNavLink, type NavGroupId } from "@/config/site";
import { resolveActiveNavHref } from "@/lib/navigation/active-nav";

/**
 * The global desktop navigation (CIUX-01B header, Career Explorer V5
 * structure): Home | Career Options | Universities | Free Tools |
 * Destination, read in order from HEADER_NAV. The same component and the
 * same stylesheet (src/styles/site-header.css) render it on the homepage and
 * on every public page; only the active state changes with the route.
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
  const [openId, setOpenId] = useState<NavGroupId | null>(null);
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
        {HEADER_NAV.map((item) => {
          if (item.kind === "link") {
            const { link } = item;
            const active = link.href === activeHref;
            return (
              <li key={link.href} className="nwh-item">
                <Link href={link.href} aria-current={active ? "page" : undefined} className="nwh-pill">
                  <span>{link.label}</span>
                </Link>
              </li>
            );
          }
          const { group } = item;
          const open = openId === group.id;
          const active = group.links.some((l) => navHrefPath(l.href) === activeHref);
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
                {group.chevron ? <ChevronDown aria-hidden="true" /> : null}
              </button>
              <div id={panelId} hidden={!open} data-v54-free="" data-layout={group.layout} className="nwh-panel" onKeyDown={onPanelKeyDown}>
                <div className="nwh-card">
                  <p className="nwh-summary">{group.summary}</p>
                  <ul className="nwh-list">
                    {group.links.map((link) => {
                      // a #section link is never "the current page" on its own: only the group lights up
                      const current = link.href === activeHref;
                      return (
                        <li key={link.href}>
                          <Link href={link.href} aria-current={current ? "page" : undefined} className="nwh-link" onClick={() => setOpenId(null)}>
                            <NavLinkBody link={link} current={current} />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const LINK_ICONS = { explorer: Compass, intelligence: Sparkles } as const;

/** One menu row: optional icon or flag, title with an optional access badge, optional description. Shared with the phone menu. */
export function NavLinkBody({ link, current }: { link: HeaderNavLink; current: boolean }) {
  const Icon = link.icon ? LINK_ICONS[link.icon] : null;
  return (
    <>
      {Icon ? (
        <span className="nwh-link-icon" aria-hidden="true">
          <Icon />
        </span>
      ) : null}
      {link.flag ? <span className="nwh-flag" data-flag={link.flag} aria-hidden="true" /> : null}
      <span className="nwh-link-text">
        <span className="nwh-link-title">
          {link.label}
          {link.badge ? (
            <span className="nwh-badge" data-tone={link.badge.tone}>
              {link.badge.label}
            </span>
          ) : null}
          {current ? <span className="sr-only">(current page)</span> : null}
        </span>
        {link.description ? <span className="nwh-link-desc">{link.description}</span> : null}
      </span>
    </>
  );
}
