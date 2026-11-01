# NW08.5 — Global Design System

## 1. This was substantially already done — UX01-02 and UX03-04

Before writing any new abstraction, this milestone re-read the two prior
design-system passes already recorded in the project's own docs
(`ux01-02-foundation-audit-and-design-system.md`,
`ux03-04-design-system-journey-audit-and-design.md`/`...-completion-report.md`).
Both already did exactly what this stage's brief asks for: audited
Card/Badge/typography/spacing/Button/loading-empty-error states across
the whole codebase, consolidated genuine duplication where it existed
(three near-identical form-success notices → `FormSuccessNotice.tsx`;
`AuthLayout` onto the shared `Card` primitive), and explicitly declined
to build a second abstraction where Tailwind conventions or an existing
shared component already served the purpose (the Badge/tone-map system;
`PageHero`/`SectionHeading` typography; `Container`/`Section` spacing).

Re-verified by spot-checking the current source (not re-trusting the old
docs blindly): `Badge.tsx`'s six-tone `TONE_CLASSES` map still backs
`TrustBadge`/`ComingSoon`/every badge usage found during this milestone's
own page audit; `Section`/`Container` are still what every page in
`NW085_01_PUBLIC_PAGE_AUDIT.md` composes with; `Button`/`LinkButton`'s
five variants and `loading`/`aria-busy` handling are unchanged and are
what `RegistrationPrompt.tsx` (this milestone's one new UI surface) reuses
rather than inventing a sixth button implementation.

## 2. What this milestone adds: the six layout-type vocabulary

The brief asks for named layout-type patterns — `DISCOVERY_PAGE`,
`PRODUCT_LANDING`, `INFORMATION_PAGE`, `COMPARISON_PAGE`, `AUTH_PAGE`,
`DETAIL_PAGE` — while explicitly warning against making every page look
identical. Rather than introduce six new wrapper components (which would
duplicate, not centralise, what `Section`/`Container`/`Card`/`PageHero`/
`SectionHeading` already provide — the same reasoning UX03 already
applied to typography and spacing), this is recorded as a **classification
of existing pages onto the primitives they already share**, so a future
page knows which existing pattern to start from:

| Layout type | Real pages already matching it | Shared primitives in common |
|---|---|---|
| `DISCOVERY_PAGE` | `/careers`, `/universities`, `/courses` | Search/filter hero + `Card`-based result list + `EmptyState`/`GuidanceNotice` for no-results/error |
| `PRODUCT_LANDING` | `/career`, `/abroad` | `PageHero` + `ProductSubNav` + a handful of `Section`s linking out to the real discovery/detail pages behind the product |
| `INFORMATION_PAGE` | `/how-it-works`, `/about`, `/trust`, `/parents`, `/study-options` | `PageHero` + stacked `Section`s of `Card`/`SectionHeading`, `FaqAccordion` at the end |
| `COMPARISON_PAGE` | `/compare`, `/courses/compare` | A picker + a comparison table component (`ComparisonTable`/`CourseComparisonTable`), noindexed, honest empty state |
| `AUTH_PAGE` | `/login`, `/register`, `/forgot-password`, `/reset-password` | `AuthLayout` (on the shared `Card` primitive since UX03) + the one real `LoginForm`/`RegisterForm` |
| `DETAIL_PAGE` | `/careers/[slug]`, `/universities/[slug]`, `/courses/[universitySlug]/[courseSlug]` | `PageHero`/breadcrumb header + structured fact sections + a save/compare action |

No new component was written for this table — it is documentation of an
already-consistent, already-shared visual identity, which is exactly
what keeps pages "not visually identical" (a `DISCOVERY_PAGE` and an
`AUTH_PAGE` look nothing alike) while staying "part of one system" (both
use the same `Card`/`Button`/color tokens underneath).

## 3. Genuinely new, this milestone

- `RegistrationPrompt.tsx`'s dialog reuses `LinkButton` (two variants
  already shipped: `primary` for "Create Free Student Account",
  `outline` for "Sign In") and `FADE_UP_CLASSES` — zero new button/
  animation primitives.
- `WorkspaceEntryLink.tsx` is a new, small nav-specific component (not a
  general-purpose primitive); it does not belong in the shared `ui/`
  library because its entire logic is role-aware routing, not visual
  style.

## 4. Still open, not addressed by this milestone (disclosed, not fixed)

Re-checked against the real current tree rather than trusting the old
doc's own count (the same "verify, don't just restate" discipline this
milestone's page audit applied to `sitemap.ts`'s own stale comment —
`NW085_01_PUBLIC_PAGE_AUDIT.md` §5): UX03-04's doc said only `/pricing`
had a `loading.tsx`/`error.tsx` pair. That is now stale — `find src/app
-iname "loading.tsx" -o -iname "error.tsx"` shows 9 such pairs today
(`/pricing`, `/applications`, `/applications/[id]`, `/courses`,
`/courses/[universitySlug]/[courseSlug]`, `/universities`,
`/universities/[slug]`, `/studio`, `/studio/abroad`,
`/studio/abroad/applications`), added by milestones between UX03-04 and
now. Still true and still open: no shared skeleton COMPONENT exists —
each of the 9 hand-rolls its own skeleton markup (several already using a
safe `key={i}` index pattern for their placeholder blocks) — and roughly
30 other dynamic routes still have neither. Extracting one shared
skeleton primitive and rolling boundaries out further remains legitimate,
separately-scoped future work, not done in this UX-focused milestone for
the same risk/reward reasoning UX03-04 gave.
- Five comparison/admin table components still each carry their own
  near-identical table-scroll wrapper with load-bearing accessibility
  comments, left as five files rather than risk five working, tested
  surfaces for a one-line reduction (same reasoning as UX03-04).

Neither item is a regression this milestone introduced, and neither
blocks any of this milestone's own acceptance criteria.
