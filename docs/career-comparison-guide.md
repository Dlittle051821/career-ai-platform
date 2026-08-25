# Career Comparison Guide (Milestone 6)

This is the reference for how `/compare` works, and how to extend it safely. It assumes familiarity with the
Milestone 4 Career Knowledge Base (`docs/career-data-guide.md`) and the Milestone 5 recommendation engine
(`docs/recommendation-engine-guide.md`) — Milestone 6 builds on both without modifying either.

## 1. What M6 adds

A `/compare` route where anyone — signed in or not — can put two or three careers side by side and see how they
differ on relevant subjects, useful skills, education routes, and curated characteristics. If the viewer is signed
in with enough Student Digital Profile data, each compared career additionally shows its own qualitative match band
("Strong match", "Promising match", etc.) — the same output `/recommendations` produces, not a new calculation.

Small, deliberately-scoped follow-on additions in the same milestone:

- A "Compare" link on every career card (`/careers`, `/careers/[slug]`'s related careers, and `/recommendations`)
  and a "Compare with another career" button on the career detail page, so the feature is discoverable from where
  people already are.
- A "Compare Careers" link in the main site navigation (`src/config/site.ts`), alongside "Career Explorer".
- Four leftover "arrives in a later milestone" notices — on `/profile` (x2), `/careers`, and `/careers/[slug]` —
  that referred to personalised recommendations before Milestone 5 shipped them. These now point at
  `/recommendations` instead of describing it as future work.

**Not part of this milestone:** no new database table, no new migration, no new RLS policy, no new dependency, and
no AI/LLM call anywhere in the comparison logic.

## 2. Architecture and important files

```
src/lib/careers/compare.ts                          Pure comparison-matrix builder (no framework imports)
src/lib/careers/compare.test.ts                      Its unit tests
src/lib/supabase/careers.ts                          + getCareerOptionsForComparison() (additive)
src/types/career.ts                                  + CareerOption type (additive)
src/app/compare/page.tsx                             The route
src/components/sections/compare/ComparePicker.tsx     3-select picker form
src/components/sections/compare/ComparisonTable.tsx   Renders the matrix
```

`compare.ts` exports two pure functions:

- **`buildComparisonMatrix(careers: CareerDetail[], matches?: Map<string, RecommendationResult> | null): ComparisonMatrix`**
  — takes 2-3 already-fetched careers (and, optionally, their already-computed M5 match results) and returns a
  `ComparisonMatrix`: one header per career, and a list of sections (subjects, interests, skills, education,
  characteristics, industries, tags, and — only when match data is supplied — "Your match"), each with rows of
  per-career cells plus which cell(s) "stand out" on that row (`highlightIndexes`). It never calls Supabase, never
  scores anything, and never mutates its inputs.
- **`careerDetailToMatchProfile(detail: CareerDetail): CareerMatchProfile`** — a pure field-reshaping adapter so
  `/compare` can hand the 2-3 already-fetched careers to the Milestone 5 engine (`getRecommendations`) without a
  second database round trip through `getCareersForMatching()` (which bulk-loads the *entire* catalogue — wasteful
  for comparing 2-3 careers already on screen).

Both are covered by `src/lib/careers/compare.test.ts`, run via `npm run test` (Vitest's `include` glob in
`vitest.config.mts` now covers `src/lib/careers/**/*.test.ts` alongside the existing `src/lib/recommendations/**/*.test.ts`).

## 3. Data flow

1. `src/app/compare/page.tsx` reads up to three career slugs from the URL (`?a=...&b=...&c=...`).
2. `getCareerOptionsForComparison()` loads a lightweight `{slug, title, familyName}` list for the picker `<select>`s
   — one small query, not the paginated `searchCareers()` (capped at 50) or the full `getCareersForMatching()`
   bulk-loader.
3. For each selected slug, the existing `getCareerBySlug()` (Milestone 4) loads its full `CareerDetail` — at most
   3 calls, each already RLS-filtered to `is_active = true AND data_quality_status = 'approved'`, same as
   `/careers/[slug]`.
4. If the viewer is signed in, `getStudentProfileSnapshot()` (Milestone 3, RLS-scoped to `auth.uid()`) loads their
   profile. If `hasMinimumProfileDataForRecommendations()` says there's enough to work with, each fetched
   `CareerDetail` is converted via `careerDetailToMatchProfile()` and scored by the *existing, unmodified*
   `getRecommendations()` from `src/lib/recommendations/` — the same deterministic engine `/recommendations` uses,
   run here against just the 2-3 careers on screen.
5. `buildComparisonMatrix()` combines the fetched careers (and match results, if any) into the display-ready
   matrix, which `ComparisonTable` renders.

Nothing is written to the database anywhere in this flow — `/compare` is entirely read-only, on top of data every
other real (non-demo) feature in this app already reads.

## 4. Security and privacy behavior

- **No new table, no new RLS policy.** Comparison reads only from the existing M4 career tables (public,
  read-only, already RLS-scoped to approved/active rows) and, when personalizing, the existing M3 `student_*`
  tables (already RLS-scoped to `auth.uid() = user_id`). There is no code path in `/compare` that reads any table
  a `PROTECTED_PATHS` route doesn't already read the same way.
- **No cross-student data exposure.** The personalized "Your match" row only ever reflects the signed-in viewer's
  own profile — `getStudentProfileSnapshot()` returns `null` for a logged-out visitor and is scoped to the
  requesting user's session for a logged-in one, exactly as `/recommendations` and `/dashboard` already rely on.
  `/compare` itself is intentionally **not** added to `PROTECTED_PATHS` — it works for anyone, and simply omits
  the personalized row when there's no eligible profile to show.
- **No service-role key**, anywhere in this milestone — every read goes through the same publishable-key
  server client (`src/lib/supabase/server.ts`) every other page already uses.
- **No AI/LLM call.** Matching reuses the Milestone 5 engine verbatim; the comparison-matrix logic itself does no
  scoring at all, only presentation of data that's either straight from the career catalogue or already computed
  by that engine.

## 5. Configuration

Two constants in `src/lib/careers/compare.ts`:

- `MIN_COMPARE_CAREERS` (2) — the floor before a comparison table renders at all.
- `MAX_COMPARE_CAREERS` (3) — the cap on how many careers can be compared at once, chosen to keep the table
  readable on mobile without horizontal scrolling becoming excessive. Raising it is safe (the matrix builder and
  picker both already work over an arbitrary-length `careers` array) but wasn't validated past 3 for layout.
- The "Core" vs. "Also relevant" cutoff for subjects/interests (`CORE_IMPORTANCE_THRESHOLD = 4`) intentionally
  matches the identical cutoff already used on `/careers/[slug]` (`src/app/careers/[slug]/page.tsx`) — change both
  together if it ever needs to move, so the two pages stay consistent.

## 6. Testing

`npm run test` covers `compare.ts` and `careerDetailToMatchProfile`: correct header ordering, behavior at exactly
`MIN_COMPARE_CAREERS` and `MAX_COMPARE_CAREERS`, no mutation of inputs, graceful handling of careers with no data
in a given section, the Core/Also-relevant importance binning (and that no raw digit ever appears in a rendered
cell), deterministic first-seen-order row ordering across repeated calls, skill-level highlighting, education-route
deduplication, the personalized match section being omitted entirely when no match data is supplied, correct
qualitative-band display and tie-aware highlighting when it is supplied, and that match data is never mutated.

Manual checks run before delivery: `/compare` with 0, 1, 2, and 3 selected careers (including one non-existent
slug); logged-out and logged-in-with-a-profile behavior; the "Remove" control on each career column; entry-point
links from `/careers`, `/careers/[slug]`, and `/recommendations`; mobile width (the comparison table scrolls
horizontally within its own bordered container — the page itself never does); no console errors; existing M1-M5
routes still functioning.

## 7. Manual Supabase steps

**None.** This milestone adds no migration and changes no database schema or policy — `/compare` only reads
tables that already exist and were already migrated in `0001_profiles.sql`, `0002_student_profile.sql`, and
`0003_career_database.sql`.

## 8. Known limitations

- Capped at 3 careers per comparison (see §5) — no UI for comparing more.
- The picker is three independent `<select>` elements rather than a searchable multi-select; fine for ~100
  careers, would need revisiting if the catalogue grows an order of magnitude larger.
- "Highlight" logic (§ row-level `highlightIndexes`) uses simple, independently-documented per-section rules (Core
  importance, most-advanced skill level, primary education relevance, best qualitative match band) rather than a
  single unified scoring concept — this is intentional (each section means something different), but it does mean
  a new section added later needs its own highlight rule thought through, not a generic one reused blindly.
- Like the M4 detail page, `careers.scores.*` never appears as a number here either — comparison of those 11
  heuristic dimensions is limited to presence/absence of the same qualitative characteristic chips
  `deriveCareerCharacteristics` already produces, not a finer-grained comparison.

## 9. Future extension points

- A "save this comparison" link (would need a new, narrowly-scoped student-owned table + RLS — the same shape of
  addition the M4 detail page's deferred "Add to careers I'm interested in" CTA was already anticipating).
- Comparing more than 3 careers, if the table layout is redesigned for it (e.g. a per-career accordion on mobile
  instead of one wide table).
- Exporting a comparison as PDF/image for sharing with a parent or counsellor offline.
- Extending `careerDetailToMatchProfile` usage to other future features that want to score an already-fetched
  `CareerDetail` without a second bulk query — it's a small, general-purpose adapter, not `/compare`-specific.
