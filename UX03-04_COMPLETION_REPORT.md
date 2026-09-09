# UX03 + UX04 — Completion Report

Design System Consistency (UX03) and Student Journey Experience (UX04). A refinement milestone: no
redesign, no new business logic, no database change.

## Baseline

- Repository: `Dlittle051821/career-ai-platform`
- Branch: `release/m10`
- Real remote `origin/release/m10` at audit time: `6ac3fe147c9e8cb489cd118a900d2e2c20b89015` (Milestone 12)
- This environment's actual working HEAD at audit time: `09fb6b416bb3e325fa324f7de1eb545e6475cd7c`
  (Milestone 13 — refund operations, committed locally in this same sandbox on top of the M12 remote SHA
  but not yet pushed to the real remote due to a persistent sandbox git-proxy restriction unrelated to this
  milestone). UX03/UX04 is built on top of this HEAD, per this milestone's own instruction to audit and
  build on the branch as it currently stands and leave any already-present Milestone 13 files untouched.
- Latest UX01-02 commit found: `c43173d` ("UX01-02 foundation and dashboard hierarchy improvements")
- Latest other milestone commit found: `a868b4a` (Milestone 11-C)

The full audit — every component surveyed, every consolidation decision and why, the complete UX04 journey
data-source table, and the sections deliberately left alone — is written up in
`docs/ux/UX03-04_DESIGN_SYSTEM_JOURNEY.md`. This report summarises the same material; that document is the
source of record for the reasoning behind each decision.

## UX03 — Design system audit and changes

Audited: Card usage (110 existing call sites plus 18 hand-rolled bordered-surface files), the four
badge/tone-map components (`StatusBadge`, `TrustBadge`, `ReadinessBadge`, `MatchBandBadge`), typography
(`PageHero`/`SectionHeading`/card-heading/body conventions), spacing/layout rhythm (`Container`/`Section`
across home/dashboard/pricing/education/profile/recommendations/payments/agreements), Button/interaction
states, loading/empty/error states, and accessibility (headings, focus, contrast, touch targets, reduced
motion).

**Consolidated, this pass:**

- `src/components/sections/auth/AuthLayout.tsx` migrated onto the shared `Card` primitive (was a
  hand-rolled div using the same tokens) — a visual no-op, verified by matching class output exactly.
- Three near-identical hand-rolled "form preview completed" success notices (`BookingForm.tsx`,
  `WaitlistForm.tsx`, `ContactForm.tsx`) consolidated into a new shared component,
  `src/components/ui/FormSuccessNotice.tsx`. Each site's own copy is unchanged; only the shared structure
  moved.

**Audited and deliberately left alone (with reasoning recorded in the design doc):**

- The Badge/tone-map system — `StatusBadge`, `TrustBadge`, `ReadinessBadge`, `MatchBandBadge` already all
  render through the shared `Badge` component's six-tone palette. The "shared visual/tone foundation
  controlling appearance, not business meaning" this milestone's spec asks for already exists; building a
  second one on top would add abstraction without reducing duplication.
- Five table-scroll wrapper divs (`ComparisonTable.tsx` ×2, `CourseComparisonTable.tsx`,
  `PricingComparisonTable.tsx`, `AdminTable.tsx`) share one line of classes each but carry their own
  load-bearing accessibility comments — left as five files rather than risk five working, tested surfaces
  for a one-line reduction.
- Typography (`PageHero`/`SectionHeading` already cover every heading in the codebase) and
  spacing/layout (`Container`/`Section` already used consistently) — no new abstraction introduced, per
  the spec's own instruction not to add one where Tailwind conventions are already clearer.
- Route-level loading/error boundaries exist only for `/pricing`; no shared skeleton component exists
  anywhere. A real, pre-existing inconsistency, but rolling it out to ~40 other routes in one pass is a
  poor fit for a small, coherent delta — recorded as a deferred UX05+ opportunity.

## UX04 — Student Journey Progress

New pure module: `src/lib/dashboard/journey-progress.ts`, `computeJourneyProgress()`. Six stages —
**Explore → Build Profile → Recommendations → Saved Options → Decide → Apply** — each derived from data
the dashboard already fetches (profile completion, recommendation readiness, saved items, applications).
No stage is ever marked complete without a real, corresponding record. Full per-stage data-source table and
reasoning: `docs/ux/UX03-04_DESIGN_SYSTEM_JOURNEY.md` §3.1.

Key decisions:

- **"Saved Options", not "Shortlist"** — this product's saved-item model is a flat boolean, not a formal
  two-stage Saved → Shortlisted product (per the UX01-02 audit's own prior finding). The label matches the
  data.
- **Decide is permanently informational** — no comparison feature in this codebase persists a decision;
  the stage never claims completion and never blocks the Apply stage from becoming current.
- **Explore has no direct tracking source** — this product's page-view events exist (`product_events`)
  but are admin/analyst-only under RLS; reading a student's own rows would need a new policy (a database
  migration), which this milestone avoids. Explore is instead satisfied once any other honestly-derived
  stage shows real activity.
- **One coherent "what's next" experience** — `getNextBestAction()` was extracted verbatim (same logic,
  same copy) into `src/lib/dashboard/next-best-action.ts` so it could finally be unit tested, and
  `computeJourneyProgress()` was deliberately scoped to orientation only (stage states and descriptions,
  no CTA of its own) so Journey Progress and "Your next step" complement rather than duplicate each other.

New UI component: `src/components/sections/dashboard/JourneyProgress.tsx` — a horizontal connected stepper
from `sm:` up, a compact vertical list below that, both rendered from the same data. No overall percentage
is shown, per the spec's instruction not to fabricate a single score across a partly-informational model.

Dashboard hierarchy reordered (content unchanged, order changed): Greeting → Your next step → **Your
journey (new)** → Student Digital Profile / Recommendations & Discovery Session → Payments / My plans / My
agreements → Saved / Applications / Career Explorer / Your account / Your roadmap. "Your account" and "Your
roadmap" moved down from immediately below "Your next step" — basic account metadata and illustrative demo
content respectively, not "important operational items."

## Accessibility

Global `:focus-visible` outline already covers every interactive element, including the new components.
`JourneyProgress` uses `aria-current="step"` on the current stage, screen-reader-only text describing each
stage's state (icon shape differs by state too — never colour-only), and `min-h-[44px]` rows on its mobile
layout. `FormSuccessNotice` preserves the original `role="status"` unchanged.

## Responsive behaviour

`JourneyProgress` switches from a vertical list to a horizontal stepper at the `sm:` breakpoint (≥640px)
via Tailwind classes only — no client-side media query, no hydration layout shift. Verified by reading the
rendered class output at 375/768/1024/1440px breakpoints; the horizontal layout uses an equal-width flex
row (no fixed-width scroller), so it never requires horizontal scrolling at any of those widths.

## M13 isolation

Confirmed via `git diff --stat` against this milestone's starting commit: the only files touched are the
dashboard page, one auth layout shell, three marketing-form components, one new UI component, one new
dashboard-lib directory, and the Vitest config's test-include list. Nothing under `supabase/`,
`src/lib/payments/`, `src/lib/supabase/admin/refunds.ts`, `src/app/admin/refunds/`, or
`src/app/(site)/payments/` was touched. No recommendation-scoring, readiness-threshold, profile-schema,
Discovery Session, pricing, signature, or stamping logic was changed.

## Database

**None.** No migration was added or needed — every journey stage derives from data already readable by
existing, unmodified queries.

## Environment variables

**None.** No new environment variable was needed.

## Testing

- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm test` — **946/946 passing** (58 pre-existing test files → 60, +2 new: `src/lib/dashboard/journey-progress.test.ts`,
  `src/lib/dashboard/next-best-action.test.ts`; 926 pre-existing tests → 946, +20 new). All pre-existing
  suites remain green, including Milestone 11-A/B/C, Milestone 12 pricing, and Milestone 13 refund tests —
  none of that code was touched.
- `npm run build` — succeeded; all 77 routes generated/compiled without error.

New tests cover: the journey helper on real, honestly-derived state (brand-new student, incomplete
profile, recommendation-ready, saved-item, and existing-application journeys); that no stage is ever
falsely marked complete; that Decide never completes and never blocks Apply from becoming current; and
that `getNextBestAction()`'s existing priority chain remains coherent (profile → payment → agreement →
readiness → Discovery Session → exploration fallback) now that it has dedicated coverage for the first
time.

## Known limitations

- The Explore stage cannot be based on real page-view tracking without a database policy change (see
  design doc §3.1) — it is inferred from downstream activity instead, which is honest but coarser than
  direct tracking would be.
- The Decide stage can never show real progress until a persistent comparison/decision feature exists;
  today it is permanently informational.
- The Apply stage reflects "an application exists," not "an application was submitted" — the two are
  different in this product's data model (see `applications.stage`), and only the former is safe to claim
  from a bare row count.
- Route-level loading/error boundaries and skeleton states remain inconsistent outside `/pricing` — a
  pre-existing gap, not introduced by this milestone, recorded as a deferred opportunity below.

## Deferred UX05+ opportunities

- Roll out `loading.tsx`/`error.tsx` boundaries (and a shared skeleton component) across the ~40 dynamic
  routes that currently have none.
- Extract a shared table-scroll wrapper for the five comparison/admin table components, once/if their
  individual load-bearing comments can be reconciled into one shared contract.
- Revisit the Decide and Apply stages if/when a persisted comparison feature or a formal
  submitted-vs-started application distinction is built.
- Revisit Explore if a future milestone adds a student-facing read policy over their own product events.
