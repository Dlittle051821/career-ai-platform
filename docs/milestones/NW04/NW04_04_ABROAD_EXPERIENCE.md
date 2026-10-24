# NW04.4 — Nextwise Abroad Experience

Status: **COMPLETE**

## 1. New shared component: `ProductSubNav`

`src/components/sections/ProductSubNav.tsx` (new) — a sticky, horizontally-scrollable row of rounded tab links (`<nav aria-label="Product sections">`, `aria-current="page"` on the active item), built once and used by both `/career` and `/abroad` (see `NW04_03_CAREER_EXPERIENCE.md`) rather than two bespoke implementations. Deliberately a plain server component — no `usePathname`, no client state — with `activeHref` passed in statically by each page, since the active tab never needs to react to client-side navigation within the same page.

## 2. What changed on `/abroad`

`src/app/(site)/abroad/page.tsx` (built in NW03.2 as an additive front door to the existing `/study-europe` six-country explorer) was enhanced, not rebuilt:

- Added `ProductSubNav` as the first element, with six tabs mirroring the mockup's right-panel sub-nav: Overview (`/abroad`), Destinations (`/study-europe`), Programs (`/courses`), Universities (`/universities`), Guidance (`/book-counselling`), Resources (`/abroad#explore`).
- `PageHero` eyebrow changed from "Study Abroad" to "Nextwise Abroad"; title changed from "Research study-abroad options, starting right away" to "Your global education journey, simplified"; description reworded to match.
- The destinations grid `Section` gained `id="explore"` and its heading changed from "Compare countries at a glance" to "Explore study destinations."
- Each country `<Card>` now renders a purely decorative Unicode flag emoji (`aria-hidden="true"`) before the country name, imported as a `FLAG_EMOJI: Record<EuropeCountryCode, string>` map keyed off `EuropeCountryCode` — the same type exported by `EUROPE_COUNTRIES` (`src/data/europe-explorer.ts`), so the map cannot silently diverge from that registry's six real launch countries (Germany 🇩🇪, Ireland 🇮🇪, Netherlands 🇳🇱, France 🇫🇷, Sweden 🇸🇪, Denmark 🇩🇰). The country list itself is still read directly from `EUROPE_COUNTRIES` — never re-typed or expanded.
- The "Also available" section's heading changed to "Everything you need to go abroad."

**Not yet renamed on this pass** (addressed in NW04.5): the page's `metadata.title` and breadcrumb label still said "Study Abroad" at the time this stage finished — see `NW04_05_NAVIGATION_CONVERSION.md` §2.5 for that rename, completed as part of the broader product-naming consistency pass.

## 3. Verification

- `npx tsc --noEmit` — clean.
- Confirmed (by grep) no test file asserts this page's exact copy or country-card markup.
- Re-confirmed clean after NW04.5's full-suite run (2115/2115 passing) and the NW04.7 gate.

## 4. Acceptance criteria addressed

- **AC-07** — the six destination cards are read directly from the same registry `/study-europe` uses, so the publicly stated destination list (Germany, Ireland, Netherlands, France, Sweden, Denmark) cannot drift or be misstated.
- **AC-08** (independent Abroad registration/usability) — preserved from NW03; this page's own badge still states the product works standalone with no career assessment required.
