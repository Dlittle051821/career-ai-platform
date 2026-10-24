import { EXPLORE_NAV } from "@/config/site";
import { NavDropdown } from "./NavDropdown";

/**
 * UX03-04 — public header "Resources" dropdown (renamed from "Explore" in
 * NW04.5 — see Header.tsx's own docblock for the full nav-IA rationale;
 * EXPLORE_NAV's four entries — Careers/Courses/Universities/Study Options
 * — are unchanged).
 *
 * NW04.5 — now a thin wrapper around the generic `NavDropdown` (extracted
 * from this file's own original implementation so the same reviewed
 * disclosure pattern also backs the new Products/About menus without
 * copy-pasting it three times). Kept as its own named export/file, rather
 * than inlining `NavDropdown` directly in Header.tsx, so any existing or
 * future import of `ExploreMenu` keeps working unchanged.
 */
export function ExploreMenu() {
  return <NavDropdown id="explore" label="Resources" items={EXPLORE_NAV} />;
}
