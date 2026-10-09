# M20C — Trusted Country Discovery UX

## Baseline

`release/m10` @ `452e5f5` ("M20B trusted source operational integration"),
97 test files / 1647 tests, `tsc`/lint/build all clean on a fresh isolated
clone before any M20C change.

## What M20C builds on (read, never modified)

- M20A's registry — `LAUNCH_COUNTRY_CODES`/`LAUNCH_COUNTRY_NAMES`/
  `isLaunchCountryCode`/`normalizeLaunchCountryCode`
  (`src/lib/education/external-search/launch-countries.ts`) and
  `LAUNCH_COUNTRY_PRIMARY_SOURCES`/`getLaunchCountryPrimarySource`
  (`launch-country-sources.ts`) — the single source of truth for which six
  countries exist and which provider is each one's primary.
- M20A's attribution wording (`attribution.ts`) — `TRUSTED_SOURCE_ATTRIBUTION_LABEL`,
  `TRUSTED_NATIONAL_SOURCE_LABEL`, `EXTERNAL_LINK_BADGE_LABEL`,
  `CONTINUE_ON_OFFICIAL_SOURCE_LABEL`, `containsUnsupportedPartnershipLanguage`.
  Two of these four constants (`TRUSTED_NATIONAL_SOURCE_LABEL`,
  `CONTINUE_ON_OFFICIAL_SOURCE_LABEL`) and one (`EXTERNAL_LINK_BADGE_LABEL`)
  existed since M20A but were never actually wired into any component until
  this pass — M20C is the first milestone that uses all four.
- M20B's `isLaunchPrimaryResult()`/`compareTrustedSearchResults()`
  (`launch-primary-result.ts`) — already wired into
  `getTrustedSearchResults()`'s ordering and into
  `TrustedExternalSearchCard`'s eyebrow label; M20C reuses both, unmodified.
- UX07's Trusted Global Course Search architecture end to end (providers/
  mappings/clicks tables, `getTrustedSearchResults()`, `adapter.ts`,
  `url-validation.ts`, the `/go/course-search/**` redirect routes) — all
  unmodified by this pass; see M20B's own doc for the full traced diagram.
- UX09's design tokens and motion helpers — `FADE_UP_CLASSES`
  (`src/lib/ui/motion.ts`), the existing `Badge`/`Card`/`EmptyState`/
  `GuidanceNotice` components, and the established "transition-colors
  duration-150" hover convention from `Button.tsx`'s own `BASE_CLASSES`.

## UX audit findings (before building anything)

- `/courses` already had an independent `destination` ISO-alpha-2 query
  param (separate from the internal `country` checkbox filter), already
  feeding `getTrustedSearchResults()` — but no quick way to pick one of the
  six launch countries specifically; the only way in was typing/selecting
  from a generic "Destination country" `<select>` listing every active
  country, buried inside a "Find a trusted official portal" fieldset.
- `/universities` had NO independent destination param at all — it derived
  a single "selected country" for the trusted-search section purely from
  its existing `country` checkbox filter (`singleSelectedCountry`), and
  silently rendered nothing when that lookup returned zero results (no
  honest empty state for "a country is selected but no trusted portal
  exists for it yet").
- Neither page had a second hardcoded country list anywhere — both already
  correctly deferred to `listActiveCountries()` for the full country
  catalogue. There was no existing "launch country" concept surfaced in
  either page's UI at all before this milestone.
- `TrustedExternalSearchCard` already carried M20B's eyebrow-label
  refinement but used none of M20A's other three approved wording
  constants, and had no per-country description — its CTA button read the
  card's own original, never-updated "Open official course search" text.
- No duplicate country selector existed to consolidate — the new strip is
  genuinely additive, sitting alongside (never replacing) each page's own
  full filter form.

## The reusable component

`src/components/sections/education/LaunchCountryDiscovery.tsx` (new) — a
labeled `<nav>` of plain `<Link>` pill chips: "All countries" plus the six
launch countries, rendered entirely from M20A's own
`LAUNCH_COUNTRY_CODES`/`LAUNCH_COUNTRY_NAMES` (never a second hardcoded
list). It takes no page-specific knowledge at all:

- `selectedCode: LaunchCountryCode | null` — which chip (if any) is
  current; marked with `aria-current="true"`.
- `buildHref: (code: LaunchCountryCode | null) => string` — supplied by the
  calling page, so the component never constructs a query string itself
  and carries zero knowledge of either page's own param scheme.
- `unavailableCodes?: readonly LaunchCountryCode[]` — launch countries the
  calling page cannot currently link to (e.g. no active `public.countries`
  row); rendered as a disabled, non-clickable, visually muted `<span>`
  rather than silently hidden or silently broken.

Works with JavaScript disabled (every selection is a real navigation to a
shareable URL), needs no `"use client"` boundary, and composes with every
existing GET-form filter on either page without any client-side state
synchronization.

## Query-param scheme — reused, not duplicated, kept independent per page

Each page reuses its OWN pre-existing param, rather than being forced onto
one shared scheme:

- **`/courses`** — reuses the existing, independent `destination` ISO
  code param (unchanged in shape; CourseFilterBar's own `<select>` still
  writes the same param). `buildDestinationHref()` spreads the page's
  existing `activeFiltersForPagination` record (moved earlier in the
  function, before the data fetch, so the component can use it near the
  top of the page) and overrides only `destination` — every other filter
  (q, subjectArea, qualificationLevel, studyMode, teachingLanguage,
  currency, tuition range, durationUnit, intakePeriod,
  scholarshipsAvailable, universityId, subject, degree) survives a chip
  click untouched. `destination` still never feeds into the internal
  `searchCourses()` call — selecting a launch country changes ONLY which
  trusted external result is shown, never the internal course list,
  exactly as before this pass.
- **`/universities`** — reuses the existing `country` checkbox param (the
  one and only "which country" signal this page already had) rather than
  introducing a second, independent `destination` param. `buildCountryHref()`
  resolves a launch code to its real `public.countries` row id (from
  `countries`, already fetched) and sets `country` to exactly that one id
  (replacing any other country checkboxes); "All countries" clears it.
  `q`/`city`/`studyMode` always survive. Because `country` already drives
  `searchUniversities()`, selecting a launch country here DOES change the
  internal result set — intentionally, since that was already true of the
  existing checkbox filter; the strip is just a faster way to reach the
  same single-country selection.

This asymmetry is deliberate: the task brief's own guidance is to reuse
whatever scheme already exists per page, not force both pages onto an
identical one. Both schemes remain exactly as capable as before — M20C
added no new param to `/courses` and no genuinely new param to
`/universities` either (it only reused `country`).

## Country discovery presentation (for a selected country)

Rather than a new, separate "about this country" panel duplicating
provider metadata into a page component, the existing, already-reviewed
`TrustedExternalSearchCard` was refined (never rebuilt) to carry the extra
information for a launch-primary result specifically:

- **Name** — the card's own existing `result.providerDisplayName`/region
  line, unchanged.
- **Primary trusted source attribution** — M20B's existing eyebrow label
  (`TRUSTED_SOURCE_ATTRIBUTION_LABEL`, "Official study source"), unchanged.
- **Trusted national source badge** (new) — `TRUSTED_NATIONAL_SOURCE_LABEL`
  ("Trusted national source"), shown only for the launch-primary result,
  so it reads as visibly distinct from a coexisting non-primary specialist
  provider for the same country (e.g. UCAS for GB, CRICOS for AU) without
  replacing or hiding that specialist result.
- **Short approved description** (new) — M20A's own already-approved,
  hand-written `purpose` field from `LAUNCH_COUNTRY_PRIMARY_SOURCES`,
  surfaced verbatim. Never a new, invented sentence — the card has no copy
  of its own about any provider.
- **"Opens an external source" indication** — the domain pill in the
  card's header now reads `{EXTERNAL_LINK_BADGE_LABEL} · {domain}` (e.g.
  "External website · daad.de") instead of the bare domain alone; the
  existing "Opens an official external website in a new browser tab…"
  sentence is unchanged. This change is universal (every result, launch or
  not), not launch-country-specific — a generic clarity improvement.
- **CTA** — the button's own text now reads the approved
  `CONTINUE_ON_OFFICIAL_SOURCE_LABEL` ("Continue on the official source")
  instead of the card's original "Open official course search", for every
  result. The link target (`goHref`, built from `result.mappingId`/
  `result.providerId`, routed only through `/go/course-search/**`) is
  completely unchanged.
- **Optional coverage note / internal result count** — surfaced at the
  PAGE level, not inside the card (see below), and only when it can be
  stated honestly.

No fabricated statistics were added anywhere — no visa rates, salaries,
rankings, acceptance rates, tuition comparisons, scholarship counts, or
"best university" claims. The only numbers ever shown are the real,
already-computed `results.total` from each page's own internal search.

## Internal result count / coverage note — shown only when genuinely known

- **`/universities`** — `country` already drives both the internal search
  and the trusted-search lookup, so whenever `singleSelectedCountry` is
  set, `results.total` unambiguously describes that same country. The
  existing "NextWise's own catalogue for {country} is a starter dataset…"
  sentence now also states that real count.
- **`/courses`** — `destination` and the internal `country` checkbox
  filter are deliberately independent. The count is shown ONLY when they
  happen to coincide (`destinationInternalCountMatches`: the internal
  `country` filter is set to exactly one country and it is the same row as
  `destination`) — otherwise the page says nothing about an internal count
  for that destination, rather than stating a number that might describe
  an unrelated filter combination. This is a deliberate anti-fabrication
  guard, not an oversight.
- The "Trusted external search" heading on `/courses` now also names the
  resolved destination (e.g. "Trusted external search — Germany") whenever
  one is known — this works for ANY destination with a real
  `public.countries` row, not just the six launch countries; it generalizes
  a pre-existing UX07 capability rather than special-casing launch
  countries.

## Empty states — honest, not blunt, never a silent vanish

| Scenario | `/courses` | `/universities` |
| --- | --- | --- |
| No destination/country selected | "Choose a destination country above to see a link to that country's trusted official course-search portal." | Trusted-search section simply doesn't render (nothing to show yet — same as before). |
| A destination/country IS selected, but no active provider exists for it | "No trusted official portal is currently activated for {name} in our system yet." | Same wording, now ALWAYS shown when a country is selected and the lookup comes back empty — previously this whole section silently disappeared with no explanation at all; M20C fixed that gap. |
| Internal catalogue has zero matching rows (already existing UX07 behavior, untouched) | `resolveListEmptyState()`'s existing filtered/dataset-empty/error copy, now also says to continue on the trusted portal below. | Same, unchanged. |
| An unrecognized/invalid destination code is typed into the free-text/select field | Falls back to the raw typed value in the message ("No trusted official portal is currently activated for XX in our system yet.") rather than crashing or blanking the heading — `destinationDisplayName` has a chain of honest fallbacks (real country name → launch-country name → the raw code itself). | N/A — `/universities` only ever offers real `public.countries` rows via checkboxes, so an "invalid" code can't reach this page's state at all. |
| A non-launch country is selected (e.g. France, if it has an active provider) | Full trusted-search behavior works exactly as it already did pre-M20C — the discovery chip row simply shows no chip selected (`selectedLaunchCode` is null), which is correct and honest. | Same — `selectedLaunchCode` is null; the existing `singleSelectedCountry`-driven section still works unchanged. |
| A launch country has no matching `public.countries` row (so `/universities` can't resolve an id to filter by) | N/A — `/courses`' `destination` never depends on a DB row. | The chip renders disabled (`unavailableCodes`), with a title attribute explaining it isn't selectable yet — never a dead link. |

## Accessibility, mobile, and motion

- The discovery strip is a labeled `<nav aria-label="…">` containing a real
  `<ul role="list">` of `<li>` elements — fully keyboard-navigable (each
  chip is a normal focusable `<a>`), and screen readers get both the nav's
  own label and each chip's `aria-current` state.
- An unavailable chip is a non-interactive `<span aria-disabled="true">`
  with a `title` attribute — never a focusable dead link, never silently
  omitted.
- `flex flex-wrap` on the chip list means it wraps onto additional lines on
  narrow viewports rather than ever forcing horizontal page scroll; no new
  fixed-width element was introduced.
- The strip's entrance reuses the page's own existing `FADE_UP_CLASSES`
  wrapper (already used by the page's intro block above it) — automatically
  respects `prefers-reduced-motion` the same way the rest of the page does,
  with no new motion primitive introduced. The chips' own hover/selected
  state uses a plain `transition-colors duration-150` (the same convention
  `Button.tsx`'s `BASE_CLASSES` already uses for color-only transitions,
  which this codebase's existing motion system does not require a
  `motion-reduce:` guard for, since nothing moves or animates — only a
  color changes).
- `TrustedExternalSearchCard`'s new badge/description additions use the
  same `Badge`/paragraph patterns already used elsewhere on the card; no
  new color token, animation, or layout primitive was introduced.

## Analytics

No new event subsystem was built. `src/lib/analytics/events.ts`'s
`PRODUCT_EVENTS` registry is backed by a Postgres CHECK constraint
(`product_events_event_name_check`, `0010_product_events_and_outcomes.sql`)
— adding a genuinely new event name there would require a new, additive
migration, which is out of this milestone's scope (expected: NONE). No
existing *implemented* event name fits "a student picked a launch country
from the discovery strip" either. Per this milestone's own analytics
guidance ("reuse an existing event helper trivially if one exists,
otherwise just document hooks needed for M21"), this pass documents the
hook instead of inventing a workaround:

- **M21 hook**: a `launch_country_selected` (or similarly named) event,
  category `course`/`college`, properties `{ countryCode, page: "courses" |
  "universities" }`, fired from inside `buildHref`'s call site (i.e. from
  whichever page renders `<LaunchCountryDiscovery>`) the moment a chip
  navigation actually lands with a new `destination`/`country` value. This
  would need one additive migration to extend
  `product_events_event_name_check`, plus flipping a new `"reserved"` entry
  in `PRODUCT_EVENTS` to `"implemented"` — both deliberately left for a
  future milestone rather than bundled into this one.
- The existing `external_search_clicks` table (via
  `recordExternalSearchClick()`) already records every outbound click
  through `/go/course-search/**`, launch-country or not — that half of the
  funnel needs no new instrumentation at all.

## Database

**Migration: NONE.** No table, column, enum value, or RLS policy was
added, changed, or needed. Every piece of data this milestone's UI needed
(the six launch countries, their primary sources' slugs/authorities/
domains/purposes, the `public.countries` rows used for id lookups, the
live provider/mapping rows behind `getTrustedSearchResults()`) already
existed from M20A/M20B/UX07.

## What was deliberately NOT changed

- `src/lib/education/external-search/launch-countries.ts`,
  `launch-country-sources.ts`, `attribution.ts`, `launch-primary-result.ts`
  — all unmodified; M20C only imports from them.
- `src/lib/supabase/education/external-search.ts`,
  `src/lib/education/external-search/adapter.ts`, `url-validation.ts` —
  unmodified.
- `src/app/go/course-search/[mappingId]/route.ts` and
  `.../provider/[providerId]/route.ts` — unmodified; every new/refined UI
  element still only ever links through these two routes.
- `src/lib/admin/permissions.ts`, any RLS policy, any admin page under
  `/admin/**` — unmodified.
- Any file under `supabase/migrations/` or `supabase/seed/` — none added
  or changed.
- Any SEO file (`src/app/robots.ts`, `src/app/sitemap.ts`, canonical/
  structured-data/OG/Twitter metadata on either page — both pages' existing
  `export const metadata` blocks are untouched), any Vercel configuration,
  any environment variable.
- Any payment/pricing/invoice/refund/GST path.
- `src/config/site.ts`'s known placeholder support email — out of scope
  for this milestone, reported as a known pre-existing cleanup item only.
- `CourseFilterBar.tsx` and `UniversityFilterBar.tsx` — neither file was
  modified; the new discovery strip sits alongside them, not inside them.
- `src/lib/analytics/events.ts` — not modified; see "Analytics" above for
  why, and what a future milestone would need to do instead.

## Preservation

M16, M17, M17B, M18, M19, UX07, UX08, UX09, M20A, M20B are all unaffected —
no file belonging to any of those milestones was touched. The only four
existing files modified are `src/app/(site)/courses/page.tsx`,
`src/app/(site)/universities/page.tsx`,
`src/components/sections/education/TrustedExternalSearchCard.tsx`, and
`src/lib/education/external-search/trusted-source-card-attribution.test.ts`
(extended with new M20C-specific assertions, none of its existing M20B
assertions removed or weakened). Two new files were added:
`src/components/sections/education/LaunchCountryDiscovery.tsx` and
`src/lib/education/external-search/launch-country-discovery.test.ts`.

## Validation

| | Baseline (452e5f5) | M20C (final) |
| --- | --- | --- |
| Test files | 97 | 98 |
| Tests | 1647 | 1675 |

New tests: 28, across 1 new test file (`launch-country-discovery.test.ts`,
22 tests) plus 6 new assertions added to the existing
`trusted-source-card-attribution.test.ts`. Every test exercises real logic
or a real, meaningful source-text audit this pass actually added:
single-source-of-truth checks (no second hardcoded six-country list
anywhere), GB-not-UK, accessible selected/disabled chip states, mobile-safe
wrapping, per-page query-param preservation and independence (including a
direct check that `/courses`' internal `searchCourses()` call never
receives `destinationCode`), honest empty-state copy (including the fix for
`/universities`' previous silent vanish), the anti-fabrication guard on
`/courses`' internal count, specialist-vs-primary non-replacement, and a
direct regression guard that Germany's primary remains DAAD. None of the 28
new tests are trivial/inflationary snapshots. `tsc --noEmit`, `npm run
lint`, and `npm run build` all pass cleanly. Removed tests: 0. Skipped
tests: 0.
