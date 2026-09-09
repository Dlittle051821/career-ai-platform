# UX03 + UX04 — Design System Consistency & Student Journey Experience

**Baseline.** Repository `Dlittle051821/career-ai-platform`, branch `release/m10`. Real remote
`origin/release/m10` at the time of this audit: `6ac3fe147c9e8cb489cd118a900d2e2c20b89015` (Milestone 12 —
pricing catalogue & commercial bootstrap). This working tree's actual HEAD when the audit began was
`09fb6b416bb3e325fa324f7de1eb545e6475cd7c` — one commit ahead of that remote SHA, containing Milestone 13
(refund operations), which was developed and committed locally in this same environment but could not be
pushed to the real remote due to a sandbox-level git-proxy restriction unrelated to this milestone's own
work. UX03/UX04 is built directly on top of that local HEAD, per this milestone's own explicit instruction to
audit the branch as it stands and leave any already-present Milestone 13 files untouched. Latest UX01-02
commit found: `c43173d` ("UX01-02 foundation and dashboard hierarchy improvements"). Latest other milestone
commit found: `a868b4a` (M11C).

This document is the audit-and-decision record for UX03 (design system consistency) and UX04 (student
journey experience). It follows the same format as `docs/ux/UX01-02_FOUNDATION.md`'s equivalent (delivered
to the project's knowledge base as `ux01-02-foundation-audit-and-design-system.md`, since the on-disk doc
file itself was never committed to this branch).

## 1. Starting premise

UX01-02 already audited this codebase's design system once and left an explicit, itemised deferred list
(§6 of its own audit doc) — Card consolidation, badge/status unification, a typography component, and a
full Journey Progress tracker were all named there as "a reasonable candidate for a future pass" or
explicitly deferred as "a real product decision that deserves its own scoped milestone." This document
picks up exactly that list, re-audits it against the real, current repository (not the two-milestones-stale
prior audit), and treats the deferred Journey Progress item as UX04.

Per this milestone's spec: refinement, not a redesign. Everything below either (a) documents that an
apparent "duplication" already correctly resolves to the same shared token/component and is safe to leave,
or (b) is a small, additive consolidation with an identical (or near-identical) rendered result to what it
replaces.

## 2. UX03 — Design system audit

### 2.1 Card system

`src/components/ui/Card.tsx` (a generic `rounded-[var(--radius-card)] border border-border bg-surface`
surface, `padded` boolean, `as` polymorphism) is used by 110 files today. A grep for hand-rolled
`rounded-2xl/3xl border` and `rounded-[var(--radius-card)]` divs outside `Card.tsx` turned up 18 files. Of
those, every single one already uses the *same* design tokens Card itself uses
(`--radius-card`, `border-border`, `bg-surface`) — there is no visual inconsistency, only repeated
className strings. On inspection each falls into one of three buckets:

- **Genuinely a Card candidate, migrated this pass:** `src/components/sections/auth/AuthLayout.tsx` — a
  plain bordered, padded surface with no structural reason not to be a `Card`. Migrated onto
  `<Card padded={false} className="p-6 shadow-lifted sm:p-8">`, which renders byte-for-byte the same
  classes as before — a pure refactor, not a visual change.
- **Structurally not a card, correctly left alone:** `AccountMenu.tsx` (an absolutely-positioned dropdown
  menu), `ViewAllServicesDialog.tsx` (a native `<dialog>` element), `CompareTray.tsx` (a sticky selection
  bar), `RoadmapVisual.tsx` (a gradient illustrative panel), `FaqAccordion.tsx` (a divide-y accordion
  list), `ComingSoon.tsx` and the `trust`/`parents` page's dashed/tinted notice boxes (deliberately
  distinct dashed/tone-tinted treatments for empty/blocked states, not a generic content card),
  `TrustedExternalSearchCard.tsx` (a deliberately heavier `border-2 border-[var(--brand-ink)]` treatment
  used once, on purpose, to visually separate "external search" from in-catalogue results). Forcing any
  of these onto the generic `Card` component would either break their actual layout (dialog semantics,
  sticky positioning) or erase a deliberate visual distinction — left alone.
- **Table-scroll wrappers, audited and deliberately left alone:** `ComparisonTable.tsx` (×2, careers and
  courses/pricing sections), `CourseComparisonTable.tsx`, `PricingComparisonTable.tsx`, and
  `AdminTable.tsx` all wrap a `<table>` in an `overflow-x-auto rounded-[var(--radius-card)] border
  border-border` div — a real, five-times-repeated pattern, and the closest thing to a genuine
  consolidation opportunity in the whole survey. It was deliberately **not** extracted into a shared
  wrapper this pass: three of the five files carry their own detailed code comment explaining why that
  exact wrapper is load-bearing for a specific accessibility/overflow contract (the table scrolls
  horizontally inside its own bounded container so the page body never does), and touching five already
  working, already-tested surfaces (career/course comparison, pricing comparison, every admin list page)
  for a one-line-per-file reduction is a worse risk/reward trade than this milestone's "refinement, not
  redesign" mandate accepts. Recorded here as an audited, intentionally deferred UX05+ candidate.

### 2.2 Status/badge system

Audited all four tone-map components in full: `src/components/admin/StatusBadge.tsx` (admin, ~90-entry
status→tone table), `src/components/ui/TrustBadge.tsx`, `src/components/sections/recommendations/
ReadinessBadge.tsx`, `src/components/sections/recommendations/MatchBandBadge.tsx`.

**Finding: the shared visual/tone foundation the spec asks for already exists and is already what every one
of these four components sits on.** All four render through the same `src/components/ui/Badge.tsx`, which
owns the entire visual layer — pill shape, border, padding, and the six-tone palette
(`neutral/success/warning/error/info/accent`) — via one `TONE_CLASSES` map. None of the four domain
components has its own copy of that styling; each one's only job is mapping its own domain vocabulary
(a raw status string, a `TrustStatus`, a `ReadinessLevel`, a `MatchBand`) to one of `Badge`'s six tones.
That is precisely "a shared layer that controls appearance, not business meaning" — the architecture this
milestone's spec asks UX03 to build. No changes were made here: building a *second* shared layer on top of
one that already does the job would add abstraction without reducing duplication, and risks exactly the
"destroy domain semantics" outcome the spec warns against (these four vocabularies are deliberately
separate — recommendation readiness, external trust claims, and payment/application/import statuses are
different business concepts that happen to share a six-tone visual palette). Documented here as
"audited, already correct, deliberately left alone."

### 2.3 Typography

`PageHero.tsx` (H1: `text-4xl sm:text-5xl font-semibold`), `SectionHeading.tsx` (H2: `text-3xl sm:text-4xl`,
also usable as H1/H3 via its `as` prop), and consistent hand-convention scales for card headings
(`text-lg font-semibold`) and secondary/tertiary text (`text-sm text-muted` / `text-xs text-muted`) were
re-verified against the current codebase and remain consistent. No `Heading`/`Text` component was
introduced: every heading in this codebase already goes through one of two shared components
(`PageHero`, `SectionHeading`) or a hand-written class that matches their scale exactly, so a wrapper
component would duplicate, not reduce, what's already centralised. Preserved as-is per the spec's own
instruction not to introduce abstraction where Tailwind conventions are already clearer.

### 2.4 Spacing/layout rhythm

`src/components/layout/Container.tsx` (max width + gutters) and `src/components/layout/Section.tsx`
(vertical rhythm `py-14 sm:py-18 lg:py-24` + tone backgrounds) are used consistently across the page types
named in the spec (home, dashboard, pricing, career/course/university pages, profile, recommendations,
payments, agreements) — re-verified this pass, no drift found. `Card`'s own `p-6 sm:p-7` padding is
likewise consistent everywhere it is used. No changes made.

### 2.5 Buttons and interaction states

`src/components/ui/Button.tsx` / `LinkButton` were re-verified: five variants including UX01-02's
`destructive`, three sizes each with an explicit `min-h-[40/44/48px]` touch target, a `loading` prop that
sets `aria-busy` and swaps in a `motion-reduce:animate-none` spinner, and `disabled:opacity-50
disabled:pointer-events-none` for the disabled state. Focus is handled globally — `globals.css` defines one
`:focus-visible { outline: 2px solid var(--brand-focus); outline-offset: 2px }` rule that every interactive
element inherits, so Button needs no per-variant focus styling of its own. No changes made — this is the
UX01-02 pass's own primitive, already meeting this milestone's bar.

### 2.6 Loading/empty/error states

`src/components/admin/EmptyState.tsx` already renders on top of `Card` and is used consistently across
admin list pages. `src/components/admin/FormError.tsx` renders only a Server Action's own returned message
(never a raw database/server error) — verified by inspection of its call sites. **Genuine, real
duplication found and consolidated:** three near-identical hand-rolled `role="status"` "form preview
completed" success notices (`BookingForm.tsx`, `WaitlistForm.tsx`, `ContactForm.tsx` — all Milestone 1
demo-submission confirmations) shared the same structure, icon, and tone classes, differing only in
padding/icon size and their own copy. Extracted into `src/components/ui/FormSuccessNotice.tsx` (same
component family as `GuidanceNotice`/`DemoNotice`), parameterised by `size` ("sm"/"md") to reproduce each
site's original spacing exactly, with an optional `action` slot for the two forms that show a "fill the
form again" button. Each call site's own wording is unchanged — this is a structural, not a copy, change.

**Audited and knowingly deferred:** only `/pricing` has a route-level `loading.tsx`/`error.tsx` boundary;
no other route does, and no shared skeleton component exists anywhere in the codebase. This is a real,
pre-existing inconsistency, not something introduced by UX01-02 or this milestone. Rolling
loading/error boundaries out to the other ~40 dynamic routes is a legitimate, valuable piece of work, but
touching that many routes in one pass carries real regression risk (a route-level error boundary changes
what a broken render looks like to a real user) and is a poor fit for a "small, coherent delta" milestone.
Recorded here as a deferred UX05+ opportunity rather than rushed through in this pass.

### 2.7 Accessibility

Spot-checked: semantic heading hierarchy (H1 via `PageHero`, H2 via `SectionHeading`, card-level H2/H3 by
convention — no page skips a level), global `:focus-visible` ring (§2.5), reduced-motion handling
(`motion-reduce:animate-none` on both the Button spinner and this milestone's own journey-current-stage
indicator has no animation to begin with), and interactive touch targets (`Button`'s `min-h-*` sizes; the
new `JourneyProgress` mobile row is `min-h-[44px]`). No accessibility regressions found in the existing
codebase, and the two new components introduced by this milestone (`JourneyProgress`, `FormSuccessNotice`)
were built to the same bar: `aria-current="step"` on the current journey stage, screen-reader-only text
describing each stage's state (never colour-only), and `role="status"` preserved unchanged on the
consolidated success notice.

## 3. UX04 — Student Journey Progress model

### 3.1 Journey stages and their real data sources

Six stages, in order: **Explore → Build Profile → Recommendations → Saved Options → Decide → Apply.**
Implemented in `src/lib/dashboard/journey-progress.ts`, `computeJourneyProgress()`. Every stage's
completion logic is derived from data the dashboard page (`src/app/(site)/dashboard/page.tsx`) already
fetches for its existing cards — no new query was written to support this feature.

| Stage | Real data source | "Complete" means | "Current" means |
|---|---|---|---|
| Explore | Derived (see below) — no direct source | Any later stage shows real activity | The very first thing to do, until any real activity exists anywhere downstream |
| Build Profile | `calculateCompletion()` (`src/lib/profile/completion.ts`), the same status already on the dashboard's profile card | `profileStatus === "completed"` | `not_started` or `in_progress` |
| Recommendations | `getMyRecommendationReadiness()` (Milestone 11-C2), the same readiness already on the dashboard's recommendations card | `level` is `READY` or `COUNSELLOR_VERIFIED` | `NOT_READY`/`PRELIMINARY`, once Build Profile is complete |
| Saved Options | `listSavedItems()` (`education_saved_items`, Milestone 9) | At least one saved item | Reached once Build Profile + Recommendations are complete, before anything is saved |
| Decide | *(none exists — see limitation below)* | Never | Never — always informational |
| Apply | `listMyApplications()` (`applications`, Milestone 7) | At least one application record exists | Reached once Saved Options is complete, before any application exists |

**Why Explore has no direct data source, and how it's honestly handled.** This product does record
per-page-view events for careers/courses/universities (`career_viewed`/`course_viewed`/`college_viewed` in
`product_events`, Milestone 9's event taxonomy) — but that table's RLS policy grants `SELECT` only to
`super_admin`/`admin`/`analyst` roles; a student cannot read their own view-event rows today. Reading them
from student-facing dashboard code would require a new RLS policy — a database migration — which this
milestone's spec explicitly avoids ("strong preference: no database change"). Rather than either (a) adding
that policy just to support a UI nicety, or (b) fabricating a "visited" signal from nothing, Explore is
instead treated as satisfied the instant any other honestly-derived stage shows real activity (a saved
item, an application, a completed profile, or ready recommendations) — none of those states can exist
without the student having explored first. Until then, Explore simply shows as the current, first step —
never fabricated as complete, never gated behind data this product doesn't expose to the student.

**Why Recommendations "complete" means "ready", not "reviewed".** Recommendation Readiness reaching
`READY`/`COUNSELLOR_VERIFIED` means the underlying engine has enough Student Digital Profile data to
produce meaningful output — it says nothing about whether the student has actually opened `/recommendations`
and looked at it, because no such "reviewed" signal is stored anywhere in this product. The stage's
"complete" copy is worded accordingly: *"Your recommendations are ready to view"* — never "reviewed" or
"completed."

**Why the stage is called "Saved Options", not "Shortlist".** Per the UX01-02 audit's own finding (§6):
this product's saved-item model (`education_saved_items`) is a flat boolean "saved" per (student, entity),
not a formal two-stage Saved → Shortlisted product. Calling this stage "Shortlist" would claim a
distinction the data doesn't have. "Saved Options" describes exactly what the underlying data is, and
matches the wording already used elsewhere on the dashboard ("Saved universities & courses").

**Why Decide can never reach "complete", and is never allowed to block Apply.** No comparison feature in
this codebase persists anything: `CompareTray`'s career/course selection is explicitly documented in its
own source comment as "ordinary React state, deliberately not persisted anywhere" and resets on reload;
university-to-university comparison does not exist at all. There is therefore no honest signal anywhere
that "a decision was made." Rather than invent one, Decide is permanently rendered as an informational,
non-gating stage (`informational: true`, state always `"upcoming"`) — it appears in the timeline for
orientation (a student can still see "you can compare your saved options here, when you're ready") but is
excluded from the gating calculation that determines the current stage, so a student who has already
applied is never shown a false "stuck" current-stage indicator on a stage that can't be completed. This
limitation is deliberate and is expected to be revisited only if/when a real, persisted comparison or
decision feature is built in a future milestone.

**Why Apply "complete" never claims a submission.** A row in `applications` is created the moment a
student clicks "start application" from a course page (`src/lib/supabase/education/applications.ts`) —
it says nothing about whether that application was ever actually submitted to the institution (the row's
own `stage` column separately tracks `inquiry` → `preparing` → `submitted` → …, an admin/counsellor-facing
detail). The stage's copy mirrors the dashboard's own existing "Applications" card wording exactly —
*"N application(s) in progress"* — never "submitted" or "complete," matching the spec's explicit
instruction not to claim submission/completion unless the application state actually supports it.

### 3.2 Reconciling with "Your next step" (`getNextBestAction`)

UX01-02 already shipped a "Next Best Action" system (`getNextBestAction()`, originally inline in the
dashboard page) that answers "what should I do right now?" as one prioritised piece of copy plus a single
CTA. UX04's spec is explicit that Journey Progress must not become a second, competing answer to the same
question. This pass:

- **Extracted** `getNextBestAction()` verbatim (same branches, same priority order, same copy) into its
  own module, `src/lib/dashboard/next-best-action.ts`, so it can be unit tested — it previously had no
  tests of its own; UX01-02's own audit doc flagged this as "a reasonable candidate to extract... if it
  grows more branches in a future pass." No logic changed.
- **Scoped `computeJourneyProgress()` to orientation only.** It returns stage states and short, honest
  descriptions, but it never produces its own call-to-action text. Its `currentStage` field exists so the
  UI can visually highlight where the student stands — it is deliberately not rendered as a second button
  or duplicate headline next to "Your next step."

The result: "Your next step" (existing, unchanged) tells the student what to do next; "Your journey" (new)
shows them where that fits in the bigger picture. One coherent experience, two views of the same
underlying, already-fetched state.

### 3.3 Dashboard information hierarchy

The dashboard's card order was reorganised to match the spec's target hierarchy. No card's own content or
data logic changed — only the order:

1. Greeting (unchanged)
2. **Your next step** (unchanged, `getNextBestAction`)
3. **Your journey** (new — `JourneyProgress`, inserted here)
4. Student Digital Profile card, then the Career recommendations + Discovery Session pair (unchanged
   content, already in roughly this position)
5. Payments, My plans, My agreements (unchanged content; "important operational items")
6. Saved universities & courses, Applications, Career Explorer, **Your account**, **Your roadmap**
   (the last two were moved down from their previous position near the top — they are basic account
   metadata and illustrative demo content respectively, not "important operational items," and belonged
   in the spec's tier 6 rather than immediately below "Your next step")

### 3.4 Responsive behaviour

`JourneyProgress` renders two layouts from the same data, switched by a Tailwind breakpoint (no JS media
query, no layout shift on hydration): a horizontal six-node connected stepper from `sm:` (≥640px) up, and a
compact vertical list below that. The vertical list uses `min-h-[44px]` rows (accessible touch target); the
horizontal stepper's nodes are icon + short label only, avoiding the "tiny label" and "awkward horizontal
scroll" failure modes called out in the spec — it never scrolls, all six nodes always fit because the row
is a flex layout with equal-width segments, not a fixed-width scroller. No overall percentage or progress
bar is rendered, per the spec's explicit instruction not to fabricate a single aggregate score across a
partly-informational, six-stage model.

## 4. What UX03/UX04 deliberately did not do

- No card/badge/typography "mega-refactor." Section 2 above documents, file by file, either why an
  apparent duplication is already resolved by shared tokens, or why a structural difference makes
  consolidation the wrong call.
- No new Saved → Shortlisted data model (Section O of the spec explicitly prohibits this).
- No new "decision made" persistence for the Decide stage.
- No change to recommendation scoring, readiness thresholds, profile completion weights, Discovery Session
  state machine, or any M10–M13 business logic. `git diff --stat` against this milestone's start touches
  only dashboard presentation, one auth layout shell, three marketing-form success notices, and the test
  runner's include list — nothing under `supabase/`, `src/lib/payments/`, `src/lib/supabase/admin/refunds.ts`,
  `src/app/admin/refunds/`, or `src/app/(site)/payments/`.
- No database migration, no new environment variable, no new npm dependency.
