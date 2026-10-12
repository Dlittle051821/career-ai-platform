/**
 * UX10A — shared route-aware "is this nav link active" resolver.
 *
 * Before this pass, Header.tsx, ExploreMenu.tsx, and MobileNav.tsx each
 * hand-rolled the same `pathname === link.href || pathname.startsWith(href + "/")`
 * check inline — three near-identical copies, and MobileNav didn't have
 * one at all (no active-state in the mobile drawer). This module is the
 * one place that formula lives now, pulled out as a pure, framework-free
 * function (same "pure lib vs I/O component" split already used by
 * account-menu.ts) so it is unit-testable without a React/DOM environment
 * and so any future nav link automatically gets correct active-state
 * everywhere just by existing in PRIMARY_NAV/EXPLORE_NAV — no new
 * per-page "if route is X" branch needs to be added, which is exactly
 * what the task's "route-aware... so future pages automatically get the
 * correct state" instruction asks for.
 *
 * This module decides PRESENTATION only (what looks highlighted) — same
 * boundary account-menu.ts documents for itself. It grants no access and
 * changes no routing behavior.
 */

/**
 * True when `href` should be shown as the active nav item for the current
 * `pathname`. Home (`href === "/"`) is a special case: it must match the
 * exact root only — the generic "or any of its sub-routes" suffix rule
 * below would otherwise make Home match literally every route, since
 * every pathname starts with "/".
 */
export function isNavLinkActive(pathname: string | null | undefined, href: string): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * True when any link in a group (e.g. EXPLORE_NAV's four entries) matches
 * the current pathname — used to highlight a dropdown/disclosure trigger
 * (e.g. the "Explore" button) when the active route is one of its own
 * items, even though the trigger itself has no single href.
 */
export function isAnyNavLinkActive(pathname: string | null | undefined, hrefs: readonly string[]): boolean {
  return hrefs.some((href) => isNavLinkActive(pathname, href));
}
