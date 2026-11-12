"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ChevronDown } from "lucide-react";
import { DISCOVERY_SESSION_CTA, HEADER_DIRECT_LINKS, NAV_GROUPS, type NavGroup } from "@/config/site";
import { isAnyNavLinkActive, isNavLinkActive } from "@/lib/navigation/active-nav";
import { cn } from "@/lib/utils";

/**
 * CIUX-01 — the desktop navigation: three disclosure menus (Explore, Free
 * tools, How it works) and one direct link (Pricing), shared by the site
 * header and the homepage header (variant="home" reuses the homepage's own
 * pill styling so the approved homepage look is unchanged).
 *
 * Pattern: WAI-ARIA disclosure navigation (buttons with aria-expanded that
 * show a list of links) — not role="menu", which would remove normal Tab
 * order. Opens on click, on Enter/Space, and on pointer hover (desktop
 * pointers only, with a short close delay). Closes on Escape (focus returns
 * to the trigger), outside click, focus leaving the menu, or navigation.
 * Arrow Down on a trigger opens its menu and focuses the first link; inside
 * an open menu, Arrow Up/Down, Home and End move between its links (they
 * never scroll the page or move the homepage chapters).
 * Panels carry data-v54-free so the homepage chapter controller leaves
 * their arrow keys alone.
 */
type Variant = "site" | "home";

const HOVER_CLOSE_DELAY = 140;
const HOVER_CLICK_GRACE = 600;

export function NavMenus({ variant = "site" }: { variant?: Variant }) {
  const pathname = usePathname();
  const [openId, setOpenId] = useState<NavGroup["id"] | null>(null);
  const [lastPath, setLastPath] = useState(pathname);
  const navRef = useRef<HTMLElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  // When a mouse hover has just opened a menu, the click that follows (the
  // same pointer arriving on the trigger) must not immediately close it.
  const hoverOpenedAt = useRef(0);
  const baseId = useId();

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
    const next =
      which === "first" ? 0 : which === "last" ? links.length - 1 : (i + which + links.length) % links.length;
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

  const home = variant === "home";
  const triggerClass = (active: boolean, open: boolean) =>
    home
      ? cn("v54-pill ciux-home-trigger", open && "ciux-open")
      : cn(
          "ciux-nav-item group relative inline-flex h-10 items-center gap-1 rounded-[var(--radius-pill)] px-3.5 text-[14.5px] font-medium transition-colors duration-[var(--duration-fast)]",
          active ? "font-semibold text-primary" : "text-text-soft hover:text-primary",
          open && "bg-surface-alt text-primary"
        );

  return (
    <nav
      ref={navRef}
      aria-label="Main"
      className={home ? "v54-nav ciux-home-nav" : "hidden lg:block"}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpenId(null);
      }}
    >
      <ul className={home ? "contents" : "flex items-center gap-0.5"}>
        {NAV_GROUPS.map((group) => {
          const open = openId === group.id;
          const active = isAnyNavLinkActive(
            pathname,
            group.links.map((l) => l.href)
          );
          const panelId = `${baseId}-${group.id}-panel`;
          return (
            <li
              key={group.id}
              className="relative"
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
                className={triggerClass(active, open)}
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
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    "h-3.5 w-3.5 transition-transform duration-[var(--duration-base)] motion-reduce:transition-none",
                    open && "rotate-180"
                  )}
                />
                {!home && active ? <ActiveDot /> : null}
              </button>
              <div
                id={panelId}
                hidden={!open}
                data-v54-free=""
                onKeyDown={onPanelKeyDown}
                className={cn(
                  "ciux-menu-panel absolute left-1/2 top-full z-50 w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 pt-3",
                  group.id === "nextwise" && "w-[min(600px,calc(100vw-2rem))]"
                )}
              >
                <div className="ciux-menu-card overflow-hidden rounded-[var(--radius-card)] border border-primary/10 bg-surface p-2 shadow-lifted">
                  <p className="ciux-menu-summary px-4 pb-1 pt-3 text-xs font-medium text-muted">{group.summary}</p>
                  <ul className="ciux-menu-list grid gap-0.5 sm:grid-cols-2">
                    {group.links.map((link) => {
                      const current = isNavLinkActive(pathname, link.href);
                      return (
                        <li key={link.href}>
                          <Link
                            href={link.href}
                            aria-current={current ? "page" : undefined}
                            className={cn(
                              "ciux-menu-link block rounded-[14px] px-4 py-3 transition-colors duration-[var(--duration-fast)] hover:bg-[var(--brand-coral-pale)] focus-visible:bg-[var(--brand-coral-pale)]",
                              current && "bg-surface-alt"
                            )}
                          >
                            <span className="ciux-menu-title flex items-center gap-2 text-[15px] font-semibold text-primary">
                              {link.label}
                              {current ? <span className="sr-only">(current page)</span> : null}
                            </span>
                            {link.description ? (
                              <span className="ciux-menu-desc mt-0.5 block text-[13px] leading-snug text-muted">{link.description}</span>
                            ) : null}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                  <Link
                    href={DISCOVERY_SESSION_CTA.href}
                    className="ciux-menu-book mt-1 flex items-center justify-between gap-3 rounded-[14px] bg-surface-alt px-4 py-3 text-sm font-semibold text-primary transition-colors duration-[var(--duration-fast)] hover:bg-[var(--brand-coral-pale)]"
                  >
                    <span>
                      {DISCOVERY_SESSION_CTA.label}
                      <span className="ciux-menu-desc block text-[13px] font-normal text-muted">{DISCOVERY_SESSION_CTA.description}</span>
                    </span>
                    <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--brand-coral-strong)]" />
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
        {HEADER_DIRECT_LINKS.map((link) => {
          const active = isNavLinkActive(pathname, link.href);
          return (
            <li key={link.href} className="relative">
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={triggerClass(active, false)}
              >
                <span>{link.label}</span>
                {!home && active ? <ActiveDot /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** The active-section marker: a small coral dot under the label. */
function ActiveDot() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-action"
    />
  );
}
