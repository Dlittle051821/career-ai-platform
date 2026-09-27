# University Discovery Experience (UX07)

This is a UX/product-experience pass, not a new backend milestone. Every
change below reuses existing NextWise data, existing components, and
existing infrastructure that had already been built (in several cases,
built and left completely unwired) for exactly this purpose. Nothing here
invents a new table, a new provider, a new comparison engine, or a new
design system.

## What this pass found before changing anything

The university/course discovery surfaces (`/universities`,
`/universities/[slug]`, `/courses`, `/courses/[universitySlug]/[courseSlug]`,
`/compare`, `/courses/compare`) were already unusually mature: server-side
pagination, a starter-dataset framing repeated honestly throughout, a
"Trusted Global Course Search" fallback system for countries NextWise
doesn't yet have deep coverage for, freshness/verification badges, a
compare tray, and a `GuidanceNotice` convention used consistently to keep
expectations calibrated. The task's own instruction to audit before
building anything new turned out to matter a great deal here: several of
the biggest opportunities were not "build X" but "wire up the X that
already exists."

## 1. Information architecture (unchanged)

The page hierarchy on `/universities` and `/courses` (heading → filters →
result count → cards → pagination → trusted-source fallback → guidance
notice) already matched the spec's own recommended shape. This pass did not
reorder it — the gaps were in the *states* those sections render, not their
order.

## 2. Card hierarchy (largely unchanged, mobile-hardened)

`UniversityCard`/`CourseCard` already establish reasonable prominence
(name → location → type badges → 1-2 supporting facts → a single "View
university"/"View course" primary link, with the course card's "Compare"
checkbox as a clearly secondary affordance). This pass made one small,
concrete fix: neither card previously constrained a long institution/course
name, so an unusually long real name could visually dominate or, at some
widths, crowd the card. Both headings now use `line-clamp-2` (and the
course card's university-name sub-link `line-clamp-1`) — same data, same
hierarchy, just guaranteed to wrap instead of overflow.

No new fields were added to either card. `PublicUniversitySummary` doesn't
carry tuition/scholarship/intake data at the list-row level (only
`PublicCourseSummary` does), and fetching it per-card would mean either a
schema change or an N+1 query — both out of scope for a UX-only milestone.
This is a deliberately deferred item (see "Deferred" below), not an
oversight.

## 3. University-detail hierarchy — missing-field discipline

This was the single largest, most literal instruction in the task spec:
*"DO NOT show misleading: 0 / N/A / Unknown / Not available repeated
everywhere... hide non-essential missing fields."* The university and
course detail pages were doing exactly the thing the spec warned against —
every optional field rendered its own "Not available" line unconditionally,
so a sparsely-populated starter-dataset record could show five or six
"Not available" rows in a row.

The fix is a field-by-field essential/non-essential split, applied
consistently on both detail pages:

**University detail (`/universities/[slug]`) — Overview card:**
- **Always rendered, even as "Not available"** (essential — a student
  deciding whether to consider this university needs to know these are
  genuinely unknown, not have them silently vanish): Accreditation, Study
  levels, Study modes, Scholarships available.
- **Hidden outright when null** (non-essential trivia for a discovery
  decision): Founded (year), Application fee.

**Course detail (`/courses/[universitySlug]/[courseSlug]`) — Overview
card:**
- **Always rendered:** Qualification, Subject/discipline, Duration, Tuition
  (list price), Scholarships available.
- **Hidden when null:** Award, Study pace, Teaching language, Tuition
  category, Campus, Program code, Application fee.

**Course detail — Entry requirements card:** the six granular fields
(minimum academic requirement, work experience, portfolio required,
interview required, study gap policy, additional documents) are the
sparsest in the entire dataset and are exactly the kind of field the spec
calls "non-essential." The free-text `entryRequirementsSummary` prose
(already rendered above them) carries the real substance; these six rows
now render only the ones that are actually populated, and if *none* of the
six are populated, the whole sub-grid is omitted rather than rendering as
an empty-looking box under the summary.

No field was deleted from the data model or the type — this is purely a
"stop printing a value that isn't there" change. A future milestone that
genuinely fills in Founded/Program code/etc. at scale would see this pass
render those fields automatically without any further code change, since
the conditionals are `!= null` checks, not hardcoded omissions.

## 4. Course navigation (unchanged — already correct)

University → course and course → university navigation were already
explicit and never dead-ended: the university detail page's "View courses"
button links to `/courses?universityId=<id>`, and the course detail page's
breadcrumb + inline "at [University]" link both go back to
`/universities/[slug]`. This pass left this alone.

## 5. Career connection (unchanged — deliberately)

There is no stored mapping from a course/university to a specific career
outcome anywhere in the current data model. The spec is explicit that it is
"NOT acceptable to claim 'This degree leads to X' without underlying
product data" — so none was added. `/careers` remains reachable from the
global nav as the general "Explore careers" pathway; no per-course "leads
to" claim was fabricated.

## 6. Compare UX — grouped, not a flat wall of rows

`CourseComparisonTable` (used by `/courses/compare`) rendered twelve fields
as one undifferentiated list of rows — exactly the "large table side by
side" pattern the spec asks to avoid. It now groups the *same twelve
fields, unchanged*, into five labeled sections matching the spec's own
suggested grouping: **Basics** (university, country, level, duration),
**Academics & delivery** (delivery mode, study pace), **Cost &
scholarships** (tuition, scholarships), **Entry requirements** (entry
summary, English requirement), and **Data & trust** (verification status,
last verified). No field was added, removed, or recomputed — only
reorganized with section headers so a student scanning the table can jump
to the dimension they actually care about.

`/compare` (career comparison) and its `ComparisonTable` were left
untouched — that page already has a richer, match-band-aware comparison
model that is out of scope for this pass, and per the spec's own
instruction ("do not build a major new comparison backend"), no
university-to-university comparison feature was invented — no such
capability exists today, and building one (a new multi-select-then-compare
flow analogous to the course one, on a summary type that doesn't carry
comparison-relevant fields yet) would be new backend-adjacent surface area,
not a clarity improvement on something that already exists. Deferred; see
below.

## 7. Discovery states — the actual biggest finding of this pass

`src/lib/ui/list-state.ts` ("UX06G") is a small, fully-tested, pure
function — `resolveListEmptyState()` — that turns `{ itemCount,
hasActiveFilters, error }` into one of four states: `has_results`,
`error`, `filtered_empty`, `dataset_empty`. Its own docblock says it was
built to be used by `/courses`, `/universities`, and `/careers`. A shared
`EmptyState` component (`src/components/ui/EmptyState.tsx`) with matching
`tone`s (`empty`/`filtered`/`error`) exists specifically to render those
four states with genuinely different icons and copy.

Auditing the three pages this was built for found that **none of them
were actually using it.** All three (`/universities`, `/courses`,
`/careers`) had their own hand-rolled empty-state `Card`, and all three
collapsed "the dataset is genuinely empty" and "the query actually failed"
into the same message ("...couldn't be loaded right now") whenever there
were no active filters — which is precisely the anti-pattern the spec's
"Discovery states" section describes almost verbatim (its own example
copy — *"We're still expanding this university catalogue"* / *"No
universities match these filters"* / *"We couldn't load universities right
now"* — maps directly onto the three states `resolveListEmptyState()` was
already built to distinguish). Separately, `searchUniversities()` and
`searchCourses()` weren't even setting the `error` flag their own return
type (`EducationListResult.error?: boolean`) declares for this — only
`searchCareers()` was.

Fixed both halves:
- `searchUniversities()` and `searchCourses()` now set `error: true` on a
  genuine query failure, mirroring `searchCareers()`'s existing convention
  exactly (same three-line shape: `return { ...empty, error: true };`).
- `/universities`, `/courses`, and `/careers` now all call
  `resolveListEmptyState()` and render the shared `EmptyState` component
  with the spec's own three-way copy, instead of each page's own
  bespoke, error-blind Card.

`/careers` is technically outside UX07/UX08's named route list, but this is
the *same* shared, pre-built utility with the *same* bug, and leaving it
half-fixed (courses/universities correct, careers still wrong) would have
made the product less coherent, not more — so it was included as a small,
low-risk, same-pattern fix rather than left inconsistent.

## 8. Search/filter UX (unchanged — already restrained)

`UniversityFilterBar`/`CourseFilterBar` already limit themselves to filters
the data actually supports (country, city, study mode for universities;
country, university, subject, level, study mode, language, tuition range,
duration, intake, scholarship for courses), already degrade to a plain
`method="get"` form that works without JavaScript, and already wrap country
checkboxes in a scrollable, `grid-cols-2`/`grid-cols-3` responsive fieldset.
No filter was added or removed.

## 9. Incomplete-data handling — see §3 above.

## 10. Trusted-source strategy

The existing Trusted Global Course Search system (`external_search_providers`
/ `external_search_mappings`, `getTrustedSearchResults()`,
`TrustedExternalSearchCard`, the `/go/course-search/**` redirect layer) was
already wired into `/courses`, keyed by an optional destination country +
subject + degree level. `/universities` had no equivalent fallback at all,
despite the spec explicitly asking for one ("Explore official source" /
"Continue on trusted country source" when NextWise's own coverage for a
country is limited).

`/universities` now calls the exact same `getTrustedSearchResults()`
function with only `destinationCountryCode` set (subject/degree omitted —
a university-level browse has neither), whenever the visitor has narrowed
their search to exactly one country via the existing country filter. That
country's ISO alpha-2 code (already on the `Country` record — no new
field) drives the lookup; the same `TrustedExternalSearchCard` renders the
result(s). A country with no activated provider row simply shows nothing —
no placeholder, no invented source, no hardcoded "Germany → DAAD" special
case anywhere in this code. If NextWise activates a provider for a new
country in the provider table, this section picks it up automatically.

## 11. Mobile behavior

Reviewed at 375px/768px/desktop via the actual Tailwind responsive classes
(this environment has no way to drive a live browser against this dataset
without touching production Supabase — see the completion report's
"Visual self-audit" note for why code-level review was used instead of
screenshots):
- Filter bars: `grid-cols-2 sm:grid-cols-2`-style layouts already collapse
  to a single column below `sm`; the country checkbox list is already
  `overflow-y-auto` with a fixed `max-h-40`, so a long country list can
  never push the page height unbounded.
- Breadcrumbs: already `flex-wrap` — a long trail wraps to a second line
  instead of overflowing.
- Cards: `UniversityCard`/`CourseCard` headings now `line-clamp-2` (§2).
- Compare table: already `overflow-x-auto` with a `min-w-[640px]` inner
  table — it scrolls horizontally on narrow screens rather than squeezing
  columns unreadably thin; the new group-header rows use the same `colSpan`
  approach and inherit the same scroll behavior.
- New `loading.tsx` skeletons (§12) use the same responsive grid classes as
  the pages they precede, so the loading state's layout matches the loaded
  state's layout at every breakpoint.

## 12. Loading/error states (new)

Added Next.js App Router `loading.tsx`/`error.tsx` pairs for
`/universities`, `/universities/[slug]`, `/courses`, and
`/courses/[universitySlug]/[courseSlug]` — none existed before this pass
(only `/pricing` had this pattern anywhere on the public site). Each
mirrors `/pricing/loading.tsx`/`/pricing/error.tsx`'s exact convention:
an animated skeleton with `role="status"`/`aria-live="polite"` for
loading, and a calm, non-technical "we couldn't load this / try again /
contact NextWise or go back" card for errors — never a raw error message
or stack trace.

## Deferred (explicitly out of scope for this pass)

- **University-to-university comparison.** No such capability exists
  today; building one is new surface area, not a clarity fix on an
  existing one. See §6.
- **Per-card tuition/scholarship/intake indicators on `UniversityCard`.**
  Would require either a schema change to `PublicUniversitySummary` or an
  N+1 query per card — both out of scope. See §2.
- **A real per-country source-mapping config beyond what already exists.**
  The `external_search_providers` table already *is* that config
  (country code → provider); this pass reused it as-is (§10) rather than
  building a second one.
- **A full country → official-source database for every country
  NextWise doesn't yet cover.** Explicitly out of scope per the task's own
  instruction; §10's fallback degrades gracefully (renders nothing) for any
  country without an activated provider row.
