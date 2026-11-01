# NW08.5.3 — Navigation Architecture

## 1. Before vs. after

**Before (NW03.2/NW04.5):** three independently-maintained arrays —
`PRODUCT_NAV` (2 items, in a "Products" dropdown), `EXPLORE_NAV` (4 items,
in a "Resources" dropdown via `ExploreMenu.tsx`), `PRIMARY_NAV` (4 items,
in an "About" dropdown) — plus a standalone `HOME_NAV_LINK` and a plain
`/studio` link labelled "For Students". Desktop order: Home | Products ▾ |
For Students | Resources ▾ | About ▾. `MobileNav.tsx` rendered a
different shape of the same four sources (two flat, one collapsible, one
flat) rather than one shared list.

**After (NW08.5):** one authoritative array, `MAIN_NAV` (`src/config/site.ts`),
holding the brief's exact six items in order — Home, Explore Careers
(`/careers`), Career Intelligence (`/career`), Study Abroad (`/abroad`),
Universities (`/universities`), Courses (`/courses`) — flat, no dropdown.
`HOME_NAV_LINK` is now `MAIN_NAV[0]`, and `MAIN_NAV_ITEMS` is `MAIN_NAV`
minus Home, for callers that render Home separately. Both `Header.tsx`
(desktop) and `MobileNav.tsx` (drawer) map over the exact same
`MAIN_NAV_ITEMS` array — one source, not two maintained shapes.

## 2. What happened to the removed dropdown groupings

Nothing was deleted from the site. Every href the old "Products"/"For
Students"/"Resources"/"About" groupings pointed at is still reachable:

| Old grouping | Old items | Where it lives now |
|---|---|---|
| Products ▾ | Career Intelligence, Nextwise Abroad | Now flat primary-nav items (`/career`, `/abroad`); also still in footer's "Products" group |
| For Students | `/studio` | Replaced by the role-aware `WorkspaceEntryLink` ("My Studio"), shown only to signed-in students, next to the account menu — a more precise target than a public link to an authenticated hub |
| Resources ▾ | Careers, Courses, Universities, Study Options | Careers/Courses/Universities are now primary-nav items; Study Options moved to `SECONDARY_NAV` → footer "Explore" group |
| About ▾ | How It Works, Counselling, Pricing, About | Moved to `SECONDARY_NAV` → footer "Nextwise" group |

`SECONDARY_NAV` (`src/config/site.ts`) is the new single list for every
page that intentionally does NOT get a primary-nav slot per the brief:
How It Works, Counselling, Pricing, About, Career Discovery, Compare
Careers, Study Options, For Parents, Trust Center, Contact. `FOOTER_NAV`
is built by looking these (and the primary items) up through a small
`findNav()` helper rather than re-typing hrefs/labels a second time, so
the footer cannot silently drift from the nav's own route data.

## 3. The new right-side account area

- Signed out: unchanged — "Sign In" / "Get Started" (`AccountMenu.tsx`).
- Signed in: a new `WorkspaceEntryLink` component renders ONE role-aware
  link next to the account menu — "My Studio" (`/studio`) for students,
  "Counsellor Workspace" (`/admin`) for counsellors, "Admin Studio"
  (`/admin`) for admins — sourced from the exact same `account_type` data
  `AccountMenu`'s own dropdown already reads
  (`src/lib/navigation/account-menu.ts`), so there is only ever one place
  deciding "what does this role link to."
- Like every other role-driven nav decision in this codebase (documented
  in `account-menu.ts`'s own docblock), this is presentation only: a
  stale or absent `account_type` cannot grant access to `/admin` or
  `/studio` — both independently re-verify the real session server-side
  on every request. Nothing about this link's existence changes that
  boundary.

## 4. Mobile

`MobileNav.tsx`'s drawer now renders: Home → the same five
`MAIN_NAV_ITEMS` in the same order as desktop → an Account section
(role-aware `WorkspaceEntryLink` with its label forced visible via a new
`forceLabel` prop, since the drawer is always narrower than the `sm:`
breakpoint the pill normally hides its label under; Dashboard; Log out —
or Sign In when signed out) → Language. The previous collapsible
"Resources" section and the flat secondary-page row are removed from the
drawer (not from the site — see §2); this matches the brief's own "the
same 6 items plus Sign In/Get Started, not 6 tiny tabs" instruction. The
footer, which lists every secondary page, still renders at the bottom of
every page at every breakpoint, including on mobile after scrolling.

## 5. Mechanics preserved unchanged

Active-route highlighting (`src/lib/navigation/active-nav.ts`'s
`isNavLinkActive`), the quiet underline hover/active treatment
(`NavUnderline`), the sticky header's scroll-triggered height/background
transition, the drawer's native `<dialog>` + body-scroll-lock + Escape/
outside-click/route-change close behavior, and the search icon
(→ `/courses`, a real search, not decorative) are all untouched — only
the *content* each one renders changed, not the interaction mechanics
themselves.

## 6. Removed dead code

`ExploreMenu.tsx` and `NavDropdown.tsx` are deleted. Both existed solely
to render the old `PRODUCT_NAV`/`EXPLORE_NAV`/`PRIMARY_NAV` dropdown
groupings; once `Header.tsx` stopped importing them, they had no
remaining caller and no longer compiled against the new `site.ts` exports
(`EXPLORE_NAV` no longer exists). Removing them, rather than keeping an
unused, non-compiling file on disk, matches this codebase's own
established "the new structure is a genuine, instructed supersession"
precedent (see `HomeHero.tsx`'s UX10-H03/H04/H05B docblocks for prior
examples of the same judgment call), and no test depends on either file
remaining — both NW04.5-era assertions about them were rewritten in
`src/lib/navigation/nw04-public-website-audit.test.ts`'s
"NW08.5 — nav-IA consolidation" block to assert the new structure
instead, following this session's standing "never weaken a test to pass,
update it with a clear explanation when a change legitimately supersedes
it" rule.

## 7. Verification

- `npx tsc --noEmit` — clean.
- `npx vitest run` — 139 files / 2327 tests passing (net +1 vs. the
  NW08-final baseline of 139/2326: the rewritten nav-IA describe block
  has one more assertion than the block it replaced; see
  `NW085_09_QA_REPORT.md` for the full reconciliation against the brief's
  own cited "140/2,349" figure).
- `npm run lint` — 0 errors, the same 18 pre-existing `<img>`→`next/image`
  warnings as every prior milestone (none introduced by this change).
- No live, authenticated browser pass was available in this sandbox (see
  `NW085_09_QA_REPORT.md` §3 for the same disclosed limitation every
  milestone in this session has carried, including manual steps for
  verifying header height stability and 1024px behavior on a real device).
