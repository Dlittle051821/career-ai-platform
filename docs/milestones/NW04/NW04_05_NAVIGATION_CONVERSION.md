# NW04.5 — Navigation & Conversion

Status: **COMPLETE**

## 1. Scope

This stage covers two things: (a) restructuring the public header/mobile navigation to match the NW04 brief's target information architecture, and (b) a brand-consistency pass renaming the Abroad product's user-facing label from the legacy "Study Abroad" to "Nextwise Abroad" everywhere it appears as a product name (never touching the unrelated, pre-existing "Study Abroad" *pricing-category* label).

Target desktop nav IA from the brief:

```
Logo | Products | For Students | Resources | About | [search icon] | Sign in | Get Started
```

Target mobile IA from the brief: "accessible menu with Career Intelligence / Nextwise Abroad / Explore links / Authentication actions."

## 2. What changed

### 2.1 Generic dropdown component (`src/components/navigation/NavDropdown.tsx`, new)

Before this stage, `ExploreMenu.tsx` had its own bespoke dropdown implementation (open state, outside-click/Escape-to-close, route-change-to-close, `aria-haspopup`/`aria-expanded`/`role="menu"`/`role="menuitem"`). The brief's target IA needs three dropdowns (Products, Resources, About), and copy-pasting that implementation three times would triple the review surface for a reviewed, accessibility-sensitive interaction pattern.

`NavDropdown` extracts that implementation, unchanged, as a reusable `{ label, items, id }` component. Behavior is byte-for-byte what `ExploreMenu.tsx` already did — nothing about the reviewed keyboard/ARIA model changed, only which `NavLink[]` it renders and what label sits on the trigger.

### 2.2 `ExploreMenu.tsx` → thin wrapper, renamed trigger label

`ExploreMenu` is now `<NavDropdown id="explore" label="Resources" items={EXPLORE_NAV} />` — kept as its own file/export (rather than inlining `NavDropdown` directly at every call site) so any existing import of `ExploreMenu` keeps working unchanged. Only the *visible* trigger label changed, "Explore" → "Resources", matching the brief's nav spec. `EXPLORE_NAV`'s data (Careers / Courses / Universities / Study Options) and the constant's name are untouched.

### 2.3 `Header.tsx` — desktop nav restructuring

Previous structure: Home → flat `PRODUCT_NAV` link row → `ExploreMenu` ("Explore") → flat `PRIMARY_NAV` link row.

New structure: Home → `<NavDropdown label="Products" items={PRODUCT_NAV}>` → plain `For Students` link (`/studio`) → `<ExploreMenu />` (now labelled "Resources") → `<NavDropdown label="About" items={PRIMARY_NAV}>`.

No href was removed, renamed, or made unreachable — every one of the six links involved (`/career`, `/abroad`, `/studio`, `/how-it-works`, `/book-counselling`, `/pricing`, `/about`) was already reachable before this change; only the grouping changed. "Home" is deliberately kept as its own first link (not folded into a logo-only pattern) to preserve existing functionality and `active-nav` behavior rather than chase the mockup's exact visual layout — the brief explicitly frames the mockup as "design reference, not a screenshot to reproduce pixel-for-pixel."

The new "For Students" link points at `/studio`, the Studio hub built in NW03.3 — the one shared signed-in landing point between the two independent product workspaces.

### 2.4 `MobileNav.tsx` — mobile nav restructuring

Previous structure: Home → flat `PRODUCT_NAV` rows → expandable "Explore" section → flat `PRIMARY_NAV` rows → Account → Language.

New structure: Home → flat `PRODUCT_NAV` rows (Career Intelligence / Nextwise Abroad, kept flat per the brief's own explicit mobile IA spec, rather than collapsed into a "Products" disclosure) → new "For Students" row (`/studio`) → expandable "Resources" section (renamed from "Explore") → flat `PRIMARY_NAV` rows → Account → Language.

`PRIMARY_NAV` was deliberately **not** converted into an "About" disclosure on mobile, unlike the desktop "About" dropdown. Desktop dropdowns exist to relieve horizontal space pressure across a single row; the mobile drawer is already a vertical list with no such pressure, so adding another disclosure layer there would cost a tap for no benefit. This is a conscious asymmetry between desktop and mobile, not an oversight.

### 2.5 `site.ts` — "Study Abroad" → "Nextwise Abroad" product-name rename

Renamed the Abroad product's label from "Study Abroad" to "Nextwise Abroad" in every place it functions as the *product name* (matching the mockup, which uses "Nextwise Abroad" throughout):

- `PRODUCT_NAV`'s Abroad entry label (`src/config/site.ts`)
- `FOOTER_NAV.Products`'s Abroad entry label (`src/config/site.ts`)
- `/abroad` page `metadata.title` and breadcrumb label (`src/app/(site)/abroad/page.tsx`)
- `/studio` hub's Abroad workspace card heading (`src/app/studio/page.tsx`)
- `/studio/abroad` workspace `metadata.title` and `<h1>` (`src/app/studio/abroad/page.tsx`)
- `DashboardShell.tsx`'s docblock comment (non-user-facing, renamed for consistency)

Every `href` (`/abroad`, `/studio/abroad`) is unchanged — this is a label-only rename.

**Explicitly excluded from this rename:** `src/components/sections/pricing/PricingCategoryFilter.tsx`'s own `{ id: "abroad", label: "Study Abroad" }` entry. That is a distinct, pre-existing pricing-category filter concept (`plan.category` being `bachelor_abroad`/`master_abroad`), unrelated to the Abroad *product* name, and the brief gives no instruction to touch pricing taxonomy — renaming it would risk conflating two different concepts that happen to share a string.

## 3. Verification

- Grepped `src/**/*.test.ts` for `"Study Abroad"`, `ExploreMenu`, `EXPLORE_NAV`, `PRIMARY_NAV`, `PRODUCT_NAV`, `FOOTER_NAV` before making any of the above changes — zero matches, confirming none of this nav-IA restructuring or renaming could regress an existing test.
- `npx tsc --noEmit` — clean, zero errors.
- `npx vitest run` — **129 test files / 2115 tests, all passing** (full suite, not a subset), confirming no regression anywhere in the codebase from the Header/MobileNav rewrite or the rename.
- `npm run lint` — zero errors; the 18 warnings present are all pre-existing `@next/next/no-img-element` warnings in unrelated files (hero sections using plain `<img>`), none introduced by this stage.
- `npm run build` — production build completes successfully; `/`, `/career`, `/abroad`, `/studio`, `/studio/abroad`, `/studio/career` all compile and are present in the route manifest.
- Confirmed `getSafeRedirectPath()` (`src/lib/auth/safe-redirect.ts`) and its one call site in `RegisterForm.tsx` are untouched by this stage — the `/register?next=/studio/abroad` safe-redirect flow fixed in NW03 remains intact end to end.

## 4. Acceptance criteria touched

- **AC-03** (nav consistency across Career/Abroad/Studio surfaces) — addressed by the new Products/For Students/Resources/About structure applying uniformly across the site, independent of which product page is active.
- Supports **AC-02** (equal product entry points) by giving both Career Intelligence and Nextwise Abroad equal billing inside the same "Products" dropdown, rather than one being a top-level link and the other buried.
