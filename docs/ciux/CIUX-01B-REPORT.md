# CIUX-01B: Global header, navigation and page-hero unification

Branch `ciux/01b-header-hero`, from `ciux/01-foundation` at `b15c162` (CIUX-01). Local review only: not pushed, not merged, not deployed.

## A. Root cause

Moving from the homepage to any other page switched design systems. Three things caused it.

1. **Two header implementations.**
   - CIUX-01 shared the navigation data and logic: `NAV_GROUPS` and `NavMenus`.
   - The bar around it was still two components with two stylesheets.
     - The homepage rendered its own `<header class="v54-header">`, styled in `components/sections/home/v54/v54.css`: a floating bar inset from the edges, 86 px tall, 30 px corners, the navigation inside a translucent capsule, Electric Coral pills, and a frosted 60 px state once the story scrolls.
     - Every other page rendered `components/navigation/Header.tsx`, styled with Tailwind utilities: a full-width strip, 73 px tall, square, plain text links with grey hover, a different button set, and a full-height side-sheet menu on phones.
   - `NavMenus` had `variant="site" | "home"` precisely because of this.
   - The homepage's unlayered CSS also resets padding and margin inside `.nw4`, so the same Tailwind classes rendered differently there. CIUX-01 had to restate the menu styles in plain CSS a second time.
2. **The previous hero generation.**
   - Six page-specific heroes (How It Works, Careers, Pricing, Study in Europe, the free-session landing, the booking form) were UX10 designs:
     - campus-photo backdrop, student cut-out, annotation images and question bubbles;
     - Plus Jakarta headlines, blue/orange button overrides (`!bg-white/90`, `HOVER_LIFT_CLASSES`).
   - The shared `PageHero` was a grey band with a Sora headline. None of them used the homepage's display face, paper light, eyebrow or hero buttons.
3. **No shell rule for a floating header.** There was no common offset, so each page started directly under a 73 px strip.

Measured (1440 × 900, before):

| | Homepage | How It Works and every other page |
|---|---|---|
| Header box | x 40, y 24, 1360 × 86, radius 30 px | x 0, y 0, 1440 × 73, radius 0 |
| Nav item | 30 px pill, coral hover | 40 px text link, grey hover |
| Headline | Space Grotesk 68 px | Plus Jakarta 49.6 px or Sora 52 px |

The newest homepage work, V5.5 to V5.5.3, exists only as uncommitted preview routes (`/homepage-preview/...`) in `C:\carrier.ai`. It is not in any branch. The approved homepage in the code is V5.4, so V5.4 is the reference here, and nothing from the previews was touched. When a V5.5.x homepage is integrated, it should render `<SiteHeader context="home" />` like V5.4 now does (see *Integration note*).

## B. Architecture

```
(site) layout ─ inline geometry script ─ <Header/> = <SiteHeader context="page"/>  (not rendered on "/")
             └ <main> ─ <PageHero …/> (first child: runs up behind the header) ─ page content ─ <Footer/>
homepage story (NextwiseV54Home) ─ <SiteHeader context="home" rootId=…/>
```

**`SiteHeader` (`components/navigation/Header.tsx`)** is the one header component:
- the master logo;
- `NavMenus`, the navigation capsule;
- account actions;
- `MobileNav`, the phone menu.

The homepage renders it inside its story with `context="home"`. The `(site)` layout renders it once for every other page, so pages never import it themselves.

**`src/styles/site-header.css`** is the one stylesheet, with the approved homepage values: bar, capsule, coral pills, menu panels, Log in and Sign up, round menu button and phone panel, account panel, and reduced-motion rules.
- `v54.css` now keeps only what the homepage engine drives: where the header sits on the stage, its scale (`--v54-hz`), the intro fade (`--nw4-nav`) and where it settles once the story scrolls.
- The CIUX-01 duplicates in `globals.css` were removed.

**Two contexts, one design:**
- **Home.** The engine positions and scales the header and switches it to the solid state on scroll, as before.
- **Page.** `src/lib/navigation/header-geometry.ts` computes the same stage geometry the homepage engine uses: same scale, inset, top and portrait/desktop rule.
  - An inline script sets it on `<html>` before first paint, so there is no flash and no layout shift.
  - The bar is transparent at the top and turns frosted white at 60 px once the page scrolls: the same two states as the homepage.
  - A test runs that script against the TypeScript function over 24 viewports, and checks the constants against the homepage engine's source.

**Navigation states:**

| State | Treatment |
|---|---|
| Idle | Navy label |
| Hover / keyboard focus | Coral pill grows in (220 ms) |
| Pressed | Press-in |
| Open | Coral pill and rotated chevron |
| Active section or page | Bold label and dot (weight, not colour alone) |

- Exactly one place is active. `resolveActiveNavHref` picks the most specific link, so `/courses/compare` lights up Free tools, not Explore as well.
- Panels close as soon as a link is chosen.
- Hit areas are at least 24 px at every scale; the drawn sizes are unchanged.

**Phones:** the homepage's round menu button and dropdown panel on every page: free session first, grouped sections, then account actions. This replaces CIUX-01's side sheet on other pages.

**Account:**

| | Every page (homepage included) |
|---|---|
| Signed out | Log in (outline) and Sign up (coral) |
| Signed in | Workspace pill (My Studio / Counsellor Workspace / Admin Studio) and a round account menu with Log out |

The signed-in homepage gains the account menu; it previously had no way to log out from the header. There is no auth logic change.

**`PageHero` (`components/sections/PageHero.tsx` with `src/styles/page-hero.css`)** is the first screen of every public page, in the homepage's language:
- the homepage hero's paper light, with a faint aqua glow;
- the Space Grotesk headline, with a navy statement and an Ocean second line (`titleAccent`);
- the tracked eyebrow with the cyan dot;
- the 17–18 px body copy;
- the homepage hero buttons (coral with the arrow chip, plus a white secondary);
- a trust row;
- an optional visual, `HeroStepsCard`.

Variation is by content:
- `align` (start / center);
- `size` (standard for journey pages, compact for listings, legal and account pages);
- `fadeTo` (the foot settles into the next section's tone).

Entrance is one short staggered rise in CSS, off under reduced motion. The API is backwards compatible, so every earlier caller adopts it unchanged.

## C. Route coverage

| Route | Header | First screen |
|---|---|---|
| `/` | SiteHeader (home context) | Approved V5.4 story, unchanged |
| `/how-it-works` | SiteHeader | **New hero** ("Your next step, made clearer.") with the journey card |
| `/careers` | SiteHeader | PageHero (was UX10 photo hero) |
| `/career`, `/career-discovery` | SiteHeader | PageHero (existing callers) |
| `/universities`, `/courses` | SiteHeader | PageHero compact (was in-section intro) |
| `/compare`, `/courses/compare` | SiteHeader | PageHero compact (was in-section intro) |
| `/abroad` | SiteHeader | PageHero (under the Abroad sub-navigation bar) |
| `/study-europe` | SiteHeader | PageHero (was UX10 photo hero) |
| `/study-options` | SiteHeader | PageHero |
| `/pricing` | SiteHeader | PageHero, centred (was UX10 hero); payment copy unchanged |
| `/about`, `/parents`, `/trust`, `/contact` | SiteHeader | PageHero |
| `/privacy`, `/terms`, `/refund-policy` | SiteHeader | PageHero compact (LegalPlaceholder) |
| `/book-counselling` | SiteHeader | PageHero with question topics (was UX10 photo hero) |
| `/discovery-session/book` (signed in) | SiteHeader | PageHero |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | SiteHeader | AuthLayout on the hero paper light |
| `/roadmap` | SiteHeader | PageHero compact |
| `/careers/[slug]`, `/universities/[slug]`, course detail | SiteHeader | Shared shell; data-driven title block kept (CIUX-03/04) |
| `/payments`, `/pay/[token]`, `/pricing/checkout/[slug]`, `/agreements/[id]` | SiteHeader | PageHero (inherited); files not edited (payment area) |
| `/welcome`, `/saved`, `/applications`, `/profile/onboarding` | SiteHeader | Shared shell; signed-in pages (CIUX-08) |
| 404 | SiteHeader (global not-found has the same setup) | Unchanged |
| `/dashboard`, `/studio`, `/counsellor`, `/admin`, `/recommendations`, `/profile` | **Own workspace layout** (not the public shell) | Not changed; CIUX-08 |

## D, E, F. Evidence

See [CIUX-01B-TESTING.md](CIUX-01B-TESTING.md).

## G. Local review

See the README in the delivery package (`C:\ClaudeBuilds\CIUX-01B-PKG\README.txt`):
- the Finish script creates the worktree `C:\ClaudeBuilds\CIUX-01B-HEADER-HERO`, verifies and tests, and commits locally;
- `-Serve` starts `npm run dev` there, at <http://localhost:3000>.

## H. Implementation summary

**New**
- `src/styles/site-header.css`, `src/styles/page-hero.css`
- `src/lib/navigation/header-geometry.ts`
- Tests: `header-geometry.test.ts`, `ciux01b-global-header.test.ts`, `active-nav-resolve.test.ts`

**Rewritten**
- `components/navigation/Header.tsx` (SiteHeader), `NavMenus.tsx`, `MobileNav.tsx`, `MobileNavGroups.tsx`, `AccountMenu.tsx` (styled panel; same links and Log out)
- `components/sections/PageHero.tsx`
- Six heroes: How It Works, Careers, Pricing, Study in Europe, `/book-counselling`, the booking form

**Edited**
- `(site)/layout.tsx` (geometry script, stylesheets) and `global-not-found.tsx`
- `NextwiseV54Home.tsx` (renders SiteHeader), `V54Account.tsx` (hero CTA only), `v54.css` (engine rules only), `globals.css` (duplicates removed)
- `WorkspaceEntryLink.tsx` (`bare` mode), `active-nav.ts` (`resolveActiveNavHref`), `lib/fonts.ts` (Space Grotesk site-wide, same instance as the homepage)
- `AuthLayout.tsx` (background), `LegalPlaceholder.tsx` and `roadmap/page.tsx` (compact)
- Explorer and compare pages (hero), `pricing/page.tsx` (spacing)

**Tests updated (superseded, not weakened)**, each with a comment in place:
- **Homepage navigation tests (`v54.test.ts`, `v54-ux.test.ts`):** the same guarantees, now asserted on the global header's files: coral pill, no layout shift, timing, touch, current page by weight, Escape, chapter pause, Log in and Sign up treatment.
- **Hero audit tests (`book-counselling`, `discovery-session`, `careers`):** the same routes and `next` destinations, now passed as `href: "…"` props; one `<h1>`, owned by `PageHero`; no decorative element carrying a CTA; one journey list.
- **V5.4 hash pins:** 5 re-computed (`NextwiseV54Home.tsx`, `V54Account.tsx`, `v54.css`, `v54.test.ts`, `v54-ux.test.ts`); 34 unchanged, including every logo and homepage asset.

**Not changed:** Supabase, RLS, auth/session, counsellor authorization, entitlements, payment/checkout logic and files, invoices, e-mail delivery, environment configuration, the 45 CC-18 protected files, and `src/config/contact.ts` (official contacts intact).

## Unresolved and next

1. **Detail pages and the signed-in student pages** use the shared header and shell, but keep their own data-driven title blocks. They are for CIUX-03/04/08.
2. **`/abroad`** keeps its sub-navigation bar between the header and the hero (a white strip). Folding it into the hero is a page-level decision for CIUX-05.
3. **Legacy V4 homepage components** (`HomeHero`, `HomeFinalCTA`, `OrbitJourney`, …) are unreferenced by any route and remain on disk.
4. **Integration note for V5.5.x:** a new homepage version should render `<SiteHeader context="home" rootId=… />` and keep the engine-only header rules (position, scale, intro fade, scroll-story settle) in its own CSS, as `v54.css` does now.
5. **Mailbox delivery and CC-26 QA acceptance** are still open, as reported in CIUX-01.

**After approval:** push `ciux/01b-header-hero` (or merge it into `ciux/01-foundation`), then CIUX-02, the rest of How It Works below the first screen.
