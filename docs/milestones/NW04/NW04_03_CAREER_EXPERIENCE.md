# NW04.3 — Career Intelligence Experience

Status: **COMPLETE**

## 1. What changed

`src/app/(site)/career/page.tsx` (built in NW03.2 as an additive front door) was enhanced, not rebuilt:

- Added `ProductSubNav` (new shared component, see `NW04_04_ABROAD_EXPERIENCE.md` §1 for its own design note — built once, used by both product pages) as the first element on the page, with six tabs: Overview (`/career`), Careers (`/careers`), Courses (`/courses`), Colleges (`/universities`), Assessments (`/career-discovery`), Resources (`/career#explore`). Every href is a real, pre-existing route except the last, which anchors to this same page's own link grid.
- `PageHero` title changed from "Figure out your career direction, on your own terms" to "Discover multiple possibilities for your future"; description updated to explicitly state the product works standalone with "no study-abroad purchase required."
- Added a fifth link card, "Personalised recommendations" (`/recommendations`), to the existing four (Career Discovery, Explore careers, Courses & universities, Talk to a counsellor) — a real, pre-existing route that was reachable but not previously surfaced from this page.
- The link-grid `Section` gained `id="explore"` (the subnav's "Resources" tab's anchor target) and its heading changed from "Where to start" to "Explore your path"; grid breakpoints widened from `sm:grid-cols-2` to `sm:grid-cols-2 lg:grid-cols-3` to fit the fifth card.

No new Supabase query, no new data source — every link still points at content that already existed before NW03.

## 2. Verification

- `npx tsc --noEmit` — clean.
- Confirmed (by grep, before editing) that no test file asserts `/career/page.tsx`'s exact copy, link count, or grid classes — this page is not under the same regression pressure as the homepage.
- Re-confirmed clean after NW04.5's full-suite run (2115/2115 passing) and the NW04.7 gate.

## 3. Acceptance criteria addressed

- **AC-05 / AC-06 class** — Career Intelligence functionally connects to the real underlying tools (career discovery, careers browser, courses, recommendations, counselling), not placeholder links.
- Preserves AC-04 (independent usability): the page's own badge and copy still state the product works standalone, unchanged in substance from NW03.
