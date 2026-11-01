# NW08.5.5 — Discovery Page Redesign

## 1. Approach

`NW085_01_PUBLIC_PAGE_AUDIT.md` found every discovery page in this
section already meets the brief's substantive requirements (search-first
UX where applicable, real filters, honest content, no fabricated
stats/counts, the six-country rule honored) — these pages were already
rebuilt across UX01–UX10 and NW03.2/NW04. Per this milestone's own
"do not rebuild working, already-reviewed surfaces" discipline (the same
restraint `NW08_ARCHITECTURE.md` and every milestone in this session has
applied to mature code), this stage's real work was verification against
the brief's specific per-page checklist, not a rewrite. Where a genuine
gap existed, it was fixed directly (see §3).

## 2. Per-page compliance against the brief's own checklist

### `/careers` (Explore Careers)
Brief asks for: search-first hero, category chips, filters, career
result cards (title/category/short description/detail link/pathway
links), no invented stats, no forced registration. All present:
`CareersHero` (search-first), `CareerFilterBar` (family/industry/tag
filters — functionally the brief's "category chips"), `CareerCard` per
result, `JourneyMiniMap` for pathway context, and the page's own docblock
states explicitly: "no match percentages, no personalised ranking...
This is a browsing/search tool only," and it is deliberately excluded
from `PROTECTED_PATHS` so no login is required. **Compliant, unchanged.**

### `/career` (Career Intelligence)
Brief asks for: explain the distinction from `/careers`, show explore/
compare/related courses/plan/guidance, never present unimplemented AI
recommendations as operational. The page's own docblock states it is "a
lightweight, additive entry point," not a rebuild, and only links to
real, already-existing routes. No AI-recommendation claim appears on this
page. **Compliant, unchanged.**

### `/abroad` (Study Abroad)
Brief asks for: premium hero, destination search/discovery limited to
the 6 approved countries, no claim of a complete verified database. Reads
`EUROPE_COUNTRIES` directly (no independent country list), and its own
hero badge reads "Works standalone — no career discovery sign-up
needed," never claiming completeness beyond the six countries it
actually covers. **Compliant, unchanged** (see
`NW085_01_PUBLIC_PAGE_AUDIT.md` §3 for the full six-country verification).

### `/universities`, `/courses` (University/Course Explorer)
Brief asks for: search-and-results UX, filters, verified names, external
official-source links, no invented rankings/tuition/scholarships, clear
no-results/loading states. Both run real Supabase-backed search
(`searchUniversities`/`searchCourses`) with filter bars, `EmptyState`/
`GuidanceNotice` for genuine empty/error states (fixed in an earlier UX07/
UX08 pass per the pages' own comments), and `TrustedExternalSearchCard`/
`LaunchCountryDiscovery` for verified official-source links rather than
fabricated data. **Compliant, unchanged.**

### `/compare` (Compare Careers)
Brief asks for: two searchable selectors, real comparison examples,
accessible side-by-side table, mobile-stacked, honest empty state, no
fabricated occupational stats. `ComparePicker` + `ComparisonTable`,
backed by `buildComparisonMatrix()` (a pure, unit-tested function —
`src/lib/careers/compare.ts`) over real career data; `GuidanceNotice` for
the empty/under-minimum-selection state. Already permanently noindexed
as a crawl-trap mitigation (§6 of the page audit), which does not affect
its usability for a visitor who reaches it directly or via a link.
**Compliant, unchanged.**

### `/career-discovery`
Brief asks for: clearly state functional status (live/preview/under
development), no promised validated psychometric scoring, don't force
completion before Abroad exploration. Already explicit: "This page
previews how future career discovery will work. It does not run a live
assessment yet," plus a `DemoNotice` reiterating the quiz "does not score
or store anything." Nothing on `/abroad` or anywhere else requires
completing this flow first. **Compliant, unchanged.**

### `/study-options`
Brief asks for: structured decision-making (India vs. Abroad, budget,
qualifications, next steps), no implied universal superiority, no
fabricated costs/employment probabilities. Built from `PATHWAY_CARDS`/
`COST_CATEGORIES`/`COMPARISON_CRITERIA`/`COURSE_SELECTION_CHECKLIST` —
structured data, not prose walls — and its own metadata description says
plainly "not marketing claims." **Compliant, unchanged.**

## 3. The one real fix in this stage

Nothing in this stage's scope needed a content/architecture fix beyond
what `NW085_01_PUBLIC_PAGE_AUDIT.md` §4 already lists (nav, hero copy,
contact email, About staleness) — those are documented in their own
respective docs, not duplicated here.

## 4. Verification

No code changes were made specifically for this stage beyond what's
already covered in `NW085_02`/`NW085_03`'s own verification sections.
Full regression (`npx tsc --noEmit`, `npx vitest run`, `npm run lint`,
`npm run build`) is reported once, in aggregate, in
`NW085_09_QA_REPORT.md` — not re-run per stage, since this stage made no
additional code changes to re-verify.
