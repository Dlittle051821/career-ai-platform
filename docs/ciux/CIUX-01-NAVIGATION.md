# CIUX-01: Navigation architecture (deliverable D)

## Structure

Data lives in `src/config/site.ts` (`NAV_GROUPS`, `HEADER_DIRECT_LINKS`, `DISCOVERY_SESSION_CTA`, `AUTH_LINKS`, `FOOTER_NAV`). Desktop, mobile, the homepage header and the footer all render from it. Every link points at an existing public route; a test checks this.

| Header item | Type | Links |
|---|---|---|
| **Explore** | Menu | Explore Careers `/careers` · Career Intelligence `/career` · Universities `/universities` · Courses `/courses` · Study Abroad `/abroad` · Study in Europe `/study-europe` |
| **Free tools** | Menu | Career Discovery `/career-discovery` · Compare Careers `/compare` · Compare Courses `/courses/compare` · Study Options `/study-options` |
| **How it works** | Menu | How It Works `/how-it-works` · For Parents `/parents` · About Nextwise `/about` · Trust Center `/trust` · Contact & Support `/contact` |
| **Pricing** | Direct link | `/pricing` |
| Book a free session | Button (xl desktop), first item in every menu and in the mobile sheet | `/book-counselling` (public; H1 "Book your free Discovery Session") |
| Log in / Sign up | Signed out | `/login`, `/register` |
| My Studio / workspace, account menu | Signed in | Unchanged `WorkspaceEntryLink` and `AccountMenu` (role-aware, no auth logic changed) |

Brief destinations and where they live:

| Brief item | Where |
|---|---|
| Explore Careers | Explore menu, QuickExplore, footer |
| Universities & Courses | Explore menu (two links), QuickExplore card, footer |
| Study Abroad | Explore menu, QuickExplore, footer |
| Free Resume Builder | **Not linked.** No resume route or feature exists in the codebase. Recorded as a blocker and as CIUX-06 |
| How It Works | How it works menu, footer |
| Pricing & Support | Pricing direct link; Contact & Support in How it works menu |
| Parents, About, Contact, Trust/legal | How it works menu; legal pages in footer |
| Sign In / My Studio | Header right side and mobile sheet (existing components) |
| Book Free Discovery Session | Header button, every menu panel, mobile sheet, QuickExplore feature card, contact page, footer |

Pricing appears only as a direct link (it was removed from the How it works group), so no two header items can show as active together.

## Interaction (desktop)

WAI-ARIA disclosure navigation, not `role="menu"`, so normal Tab order keeps working.

- Click, Enter or Space on a trigger toggles its panel (`aria-expanded`, `aria-controls`).
- Arrow Down on a trigger opens the panel and focuses the first link. Inside a panel, Arrow Up/Down, Home and End move between links and never scroll the page.
- Mouse hover opens (mouse pointers only, not touch), with a 140 ms close delay. A click that follows a hover-open keeps the panel open.
- Escape closes and returns focus to the trigger. An outside pointer press, focus leaving the nav, or a route change also closes it.
- The active section shows a coral dot under its trigger; the current page link has `aria-current="page"`.
- Panels carry `data-v54-free`, so the homepage chapter controller ignores key presses inside them.

## Interaction (mobile)

- Site pages: a native `<dialog>` sheet (backdrop click and Escape close it; focus returns to the menu button; body scroll locked). Order: logo and close, Book a free session, quick links (Careers, Study Abroad, Universities & Courses), grouped disclosures (the group with the current page starts open), Pricing, account actions.
- Homepage: the V5.4 menu panel keeps its own look and placement; its content now renders the same `MobileNavGroups` plus the Book a free session button.
- Targets: group rows 52 px (48 px on the homepage), links 48 px (44 px on the homepage).

## Homepage integration

The V5.4 header keeps its pill bar, logo, account buttons and position. Only the contents of the pill bar changed: the four map links became three menu triggers plus Pricing, rendered by the same `NavMenus` component with `variant="home"`. Styling for the homepage panel is plain CSS scoped to `.nw4.nw54`, because the homepage's unlayered resets override Tailwind utilities.

## What changed from NW08.5

NW08.5 had a flat row of six links. The CIUX-01 brief asked for grouped dropdowns that reach every destination above. Two NW08.5 source tests were updated to assert the new shared source (`NAV_GROUPS` via `NavMenus` and `MobileNavGroups`); the invariants they protected (one shared source, no legacy `NavDropdown`/`ExploreMenu`, no lost link) are still asserted. `LanguageSelector` was removed from the header (no Odia content exists; the footer says it is coming soon).
