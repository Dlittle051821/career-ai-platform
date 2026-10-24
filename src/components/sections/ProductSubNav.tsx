import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { cn } from "@/lib/utils";

export interface ProductSubNavItem {
  label: string;
  href: string;
}

/**
 * NW04.3/NW04.4 — the in-product "quick nav" row shown directly under the
 * header on `/career` and `/abroad` only (the approved NW04 reference
 * image's own "Overview | Careers | Courses | Colleges | Assessments |
 * Resources" / "Overview | Destinations | Programs | Universities |
 * Guidance | Resources" tab bars).
 *
 * Deliberately a plain server component, not a client-side tab widget:
 * every item is a real `<Link>` to an already-existing route (or an
 * in-page anchor on the product page itself) — no new routes, no new
 * client JavaScript. `activeHref` is passed in by the page itself (always
 * known statically — `/career` always passes "/career") rather than
 * derived from `usePathname()`, so this never needs to be a client
 * component. A horizontally-scrollable row on narrow viewports (`overflow-
 * x-auto`) rather than wrapping, since wrapped tabs read as a second nav
 * bar rather than one quick-glance row — matches the reference's own
 * single-row tab treatment at every width.
 */
export function ProductSubNav({ items, activeHref }: { items: readonly ProductSubNavItem[]; activeHref: string }) {
  return (
    <div className="sticky top-16 z-30 border-b border-border bg-surface/95 backdrop-blur sm:top-[4.5rem]">
      <Container>
        <nav aria-label="Product sections" className="flex gap-1 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item) => {
            const active = item.href === activeHref;
            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-150",
                  active ? "bg-primary text-on-primary" : "text-text-soft hover:bg-surface-alt hover:text-primary"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </Container>
    </div>
  );
}
