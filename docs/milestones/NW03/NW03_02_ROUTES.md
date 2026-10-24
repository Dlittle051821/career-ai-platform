# NW03.2 — Two-Product Public Routing

**Milestone:** NW03 "Two-Product Architecture"
**Stage:** 2 of 6
**Depends on:** NW03.1 (`docs/milestones/NW03/NW03_01_AUDIT.md`)

## 1. What was built

Two new, additive public routes:

- **`/career`** — `src/app/(site)/career/page.tsx`. Career Intelligence product landing page.
- **`/abroad`** — `src/app/(site)/abroad/page.tsx`. Abroad product landing page.

Both render inside the existing `(site)` route group (same `Header`/`Footer` shell as every other public page) using only existing shared primitives: `PageHero`, `Section`, `SectionHeading`, `Card`, `Badge`, `LinkButton`, `CTASection`. Neither page queries Supabase or introduces new data — `/abroad` reads its six-country teaser list directly from `EUROPE_COUNTRIES` (`src/data/europe-explorer.ts`), the exact same source `/study-europe` already uses, so it is structurally impossible for this page to drift from the NW02 six-country allowlist (Germany, Ireland, Netherlands, France, Sweden, Denmark) or silently expand it.

Both pages link out to pre-existing routes rather than duplicating their content:

- `/career` links to `/career-discovery`, `/careers`, `/courses`, `/book-counselling`, and across to `/abroad`.
- `/abroad` links to `/study-europe` (the full Country Explorer, where the real country-by-country comparison lives), `/courses`, `/study-options`, `/book-counselling`, and across to `/career`.

Each page also states explicitly, in its own copy, that the other product is separate and optional — this is the public-facing expression of AC-04's "neither product requires the other" requirement, ahead of NW03.3 making it true at the account/auth level too.

## 2. Navigation changes

`src/config/site.ts` gained one new exported constant, `PRODUCT_NAV`, listing `/career` and `/abroad` — added ahead of `PRIMARY_NAV`, following the same "small, separately-tracked constant" pattern `HOME_NAV_LINK` already established, rather than merging into `PRIMARY_NAV` or `EXPLORE_NAV` (those represent different things: `EXPLORE_NAV` is exploration tools, `PRIMARY_NAV` is informational/utility pages; `PRODUCT_NAV` is the two top-level products). No existing nav entry was removed, renamed, or reordered.

`FOOTER_NAV` gained one new "Products" group (Career Intelligence, Study Abroad), inserted before the existing "Explore" group.

`Header.tsx` and `MobileNav.tsx` were both updated to render `PRODUCT_NAV` — on desktop, as two more items in the primary nav row (right after Home, before the Explore dropdown, using the exact same active-state underline treatment as every other nav link); on mobile, as two more rows in the drawer in the same position. `isNavLinkActive` (the existing pure helper) is reused unchanged.

## 3. Validation

Re-ran the full gate after this stage's changes:

| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm run lint` | 0 errors, 18 pre-existing warnings (unchanged from the NW03.1 baseline) |
| `npm run build` | succeeded; `/career` and `/abroad` both appear as new statically-generated (`○`) routes; every pre-existing route is unchanged |

No regression to any existing route, nav item, or test.

## 4. What NW03.2 explicitly did not do

- Did not touch `/`, `/study-europe`, `/careers`, `/courses`, `/universities`, `/study-options`, `/pricing`, or any payment/admin route.
- Did not add any Supabase query, migration, or new table.
- Did not gate either new page behind auth — both are public, matching the brief's requirement that a visitor can browse either product before ever creating an account.
- Did not build the authenticated workspace routes (`/studio`, `/studio/career`, `/studio/abroad`) — that is NW03.3.
