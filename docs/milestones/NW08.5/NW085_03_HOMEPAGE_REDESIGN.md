# NW08.5.4 — Homepage Redesign

## 1. Section-order comparison

| Brief's preferred order | Already-shipped section (`src/app/(site)/page.tsx`) | Verdict |
|---|---|---|
| 01 Hero, real functional search | `HomeHero` | **Fixed this milestone** — see §2 |
| 02 Explore Careers search entry | `ProductEntryCards` | Present (two-product entry), plus the new hero search now covers the "search entry" need directly |
| 03 Two Connected Pathways | `ProductEntryCards` / `StudioIntro` | Already present — Career Intelligence vs. Nextwise Abroad cards |
| 04 Popular Career Categories | `DiscoveryPillars` | Already present, real data, no invented counts |
| 05 Study Abroad Destinations (6 only) | `TrustedStudyExplorer` | Already present and already restricted to exactly the 6 approved countries — see §3 |
| 06 Explore Universities and Courses | `DiscoveryPillars` / footer | Reachable; not a dedicated homepage section, left as-is (low risk — see §4) |
| 07 How Nextwise Helps | `HowItWorks` | Already present |
| 08 Free Student Studio value | `StudioIntro` | Already present |
| 09 Final conversion CTA | `HomeFinalCTA` | Already present |
| 10 Structured footer | `Footer` (`FOOTER_NAV`) | Already present, and now sourced from the one authoritative nav config (`NW085_02_NAVIGATION_ARCHITECTURE.md`) |

The existing composition (`HomeHero → ProductEntryCards → StudioIntro →
DiscoveryPillars → TrustedStudyExplorer → HowItWorks → WhyNextwise →
HomeFinalCTA`) already covers essentially every section the brief asks
for, built across the prior UX10A/UX10-EU02 passes — this milestone's own
"do not recreate the homepage from scratch" instruction and this
session's own `page.tsx` docblock (recording why nine superseded section
files are deliberately left on disk unreferenced) are both respected:
nothing below rebuilds working, already-reviewed sections.

## 2. What actually changed — the Hero

`HomeHero.tsx`'s headline and support copy were a prior milestone's
(UX10-EU02) own India+Europe positioning ("Make smarter education
decisions in India and Europe."), not the brief's exact required text.
Per this milestone's explicit, named copy requirement, the H1 is now
`BRAND_TAGLINE` ("Know What's Next.", imported from `src/config/site.ts`
rather than re-typed so it can never drift from the one authoritative
tagline), and the support line is now the brief's own exact "Explore
careers. Discover opportunities. Plan your future."

A real, functional search was also added directly in the hero: a plain
GET `<form action="/careers" method="GET">` with `name="q"`. `/careers`
already runs a genuine server-side keyword search over that exact
`q` searchParam (`searchCareers()` — see
`src/app/(site)/careers/page.tsx`), so submitting this form takes a
visitor straight to real, filtered results — never a decorative input
that goes nowhere, matching this milestone's own "never fake" instruction
for every search affordance.

The grid split, the real student photo, the orbit visual (explicitly
"sacred" per this file's own prior docblocks — never touched across
H03–EU02), and the trust-cue row are unchanged. The regression guard
(`src/lib/home/hero-composition-audit.test.ts`) was updated in the same
documented-supersession style every prior hero copy change in this file
has used, not weakened — it now asserts the new headline source
(`BRAND_TAGLINE`), the new support line, and the new search form's exact
markup.

## 3. Study Abroad destinations — already compliant

`TrustedStudyExplorer.tsx` (homepage section 5 in the brief's own
numbering) already renders exactly the six approved countries — it reads
`EUROPE_COUNTRIES` from `src/data/europe-explorer.ts`, the same
canonical, already-verified six-country registry `/abroad` and
`/study-europe` use, not a second, independently-typed list. No USA/UK/
Canada/Australia reference exists anywhere in this component's rendered
output (confirmed by source inspection — the only occurrences of those
country names anywhere near the homepage are inside historical docblock
comments explaining why an *earlier* milestone moved away from the old
global six-country set, never in rendered copy). No change was needed
here.

## 4. Deliberately not changed this pass

- **Dedicated "Universities and Courses" homepage section (brief item
  06):** `DiscoveryPillars` and the footer already link to both; adding a
  seventh dedicated section would lengthen an already-complete,
  already-reviewed homepage for a destination that's one click away in
  two different places already. Documented as a disclosed, low-risk
  omission rather than silently skipped.
- **Nine pre-UX10A section component files** (`Hero.tsx`,
  `PricingPreview.tsx`, etc.) remain on disk, unreferenced — deleting them
  would break `src/config/site.test.ts`'s own rebrand regression guard,
  which asserts their existence by path (see `page.tsx`'s own docblock).
  Unrelated to this milestone; left exactly as every prior milestone has
  left them.

## 5. Verification

`npx tsc --noEmit` clean, `npx vitest run` 141/2359 passing (see
`NW085_09_QA_REPORT.md` for the full reconciliation), `npm run lint` 0
errors (4 pre-existing `<img>` warnings in this file, same count as
before — no new warning introduced), `npm run build` succeeds. No live
browser pass was available in this sandbox (disclosed, as in every prior
milestone) — the search form's real-world behavior (submitting `q=` to
`/careers` and rendering results) was verified by reading
`searchCareers()`'s own implementation and `/careers`' own `searchParams`
handling, not by driving a browser.
