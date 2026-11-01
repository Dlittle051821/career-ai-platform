# NW08.5 — Architecture Overview

## 1. Baseline safety check (done first, per standing constraint)

Confirmed at the start of this milestone, and still true now: this working
copy (`C:\carrier.ai` on the user's machine, mirrored into this sandbox at
`/home/claude/carrier.ai`) is **not a git repository**. No commit, push,
branch, or merge was possible or attempted. No database/Supabase migration
was applied, proposed-and-applied, or executed. No secret was read, written,
or packaged. These are the same standing, non-negotiable constraints carried
through every milestone in this session (NW01–NW08).

## 2. What NW08.5 is, architecturally

NW08.5 is a **UX/content/navigation refinement pass**, not a feature
milestone — it adds exactly one new feature (the Smart Student Registration
Prompt, task #70) and otherwise consolidates, corrects, and documents
things that already existed. It touches no database schema, no RLS policy,
no payment/signature/stamping logic, and no new route tree (131 routes
before and after — confirmed in `NW085_09_QA_REPORT.md` §1).

### 2.1 Navigation — one authoritative source

Before this milestone, `src/config/site.ts` exported three independent nav
arrays (`EXPLORE_NAV`, `PRODUCT_NAV`, `PRIMARY_NAV`) plus a dropdown-grouped
header and a separately-maintained footer list. This milestone replaced
them with a single `MAIN_NAV` (home + 5 flat items) and `SECONDARY_NAV` (10
items), with `Header.tsx`, `MobileNav.tsx`, and `FOOTER_NAV` (via a
`findNav(href)` lookup helper) all reading from the same two arrays — one
place decides the site's primary IA, not three. Full before/after detail in
`NW085_02_NAVIGATION_ARCHITECTURE.md`.

A new, small, role-aware component (`WorkspaceEntryLink.tsx`) sits beside
the account menu, giving a signed-in student/counsellor/admin a direct
"workspace" entry point. This is presentation-only — it decides what a link
says and points at, nothing more. Every real access decision still happens
server-side (`getCurrentAdmin()`/`requireAdminPermission()`/RLS), exactly as
documented on `account-menu.ts`. During this milestone's authenticated-area
audit (task #72), this component's and `account-menu.ts`'s counsellor entry
were both found pointing at `/admin` using a now-stale "no separate
`/counsellor` route exists" assumption; both were corrected to `/counsellor`
once the real, NW07-built Counsellor Studio route was re-verified against
the current tree. Full detail in `NW085_07_AUTHENTICATED_UX_AUDIT.md` §3.

### 2.2 Three authenticated shells for three real audiences

Re-verified during task #72, and recorded here because it's a structural
fact worth having in one place: this codebase deliberately has no single
shared root layout (a Next.js App Router constraint — every top-level route
owns its own `<html>`/`<body>`). That could look like five independently
duplicated "app shells" (`/dashboard`, `/studio`, `/profile`,
`/recommendations`, `/counsellor` each have their own `layout.tsx`), but
reading all five shows it is actually **three real shells for three real
audiences**: `DashboardShell` (the same component, instantiated by all four
student-facing routes), `CounsellorShell` (`/counsellor`, NW07), and
`AdminShell` (`/admin`). Not a duplication problem.

### 2.3 Registration Prompt — one component, event-bus-driven

`src/components/registration-prompt/RegistrationPrompt.tsx` is mounted once,
in the shared `(site)/layout.tsx`, not per-page — so its 45-second engaged-
browsing timer survives client-side route changes instead of resetting on
every navigation. It is gated by pure, independently-unit-tested eligibility
logic (`src/lib/registration-prompt/eligibility.ts`: path exclusions, the
45s/7-day constants, suppression-until computation) and a thin,
structurally-reviewed (not unit-tested, per this codebase's "pure vs. thin
I/O wrapper" convention) localStorage/sessionStorage layer
(`storage.ts`). A small event bus (`event-bus.ts`) lets any future page
request the prompt contextually (`requestRegistrationPrompt(reason)`)
instead of only firing on the timer. It reuses the existing native
`<dialog>` accessible-modal pattern (first established by `MobileNav.tsx`)
rather than introducing a fourth modal implementation.

### 2.4 Design system — classification, not new components

`NW085_DESIGN_SYSTEM.md` records a six-layout-type classification
(`DISCOVERY_PAGE`/`PRODUCT_LANDING`/`INFORMATION_PAGE`/`COMPARISON_PAGE`/
`AUTH_PAGE`/`DETAIL_PAGE`) of pages onto primitives (`Card`, `Section`,
`Button`/`LinkButton`, `Badge`, `PageHero`/`SectionHeading`) that UX01-02
and UX03-04 already built and consolidated. No sixth button, badge, or
typography system was introduced — re-verified against current source, not
assumed from the old docs (see that document's §1 for the specific stale
claim it caught and corrected in its own first draft).

## 3. Files touched, by category

- **New feature code:** `src/components/registration-prompt/
  RegistrationPrompt.tsx`, `src/lib/registration-prompt/{eligibility,
  storage,event-bus}.ts` + their tests; `src/components/navigation/
  WorkspaceEntryLink.tsx`.
- **Navigation consolidation:** `src/config/site.ts` (rewritten nav
  exports), `src/components/navigation/{Header,MobileNav}.tsx` (rewritten
  to the flat structure), deletion of `ExploreMenu.tsx`/`NavDropdown.tsx`
  (dead code after the flattening).
- **Bug fixes:** `src/components/admin/AdminTable.tsx` (duplicate-key fix),
  `src/app/admin/counsellors/page.tsx` (same bug class, proactive fix),
  `src/lib/navigation/account-menu.ts` + `WorkspaceEntryLink.tsx` (stale
  counsellor route fix).
- **Content/copy:** `src/components/sections/home/HomeHero.tsx` (new
  headline/support-copy/search form), `src/app/(site)/about/page.tsx`
  (updated "what's live" disclosure).
- **Test updates (all documented-supersession rewrites, never silent
  weakenings):** `src/lib/navigation/nw04-public-website-audit.test.ts`,
  `src/lib/home/hero-composition-audit.test.ts`, `src/config/site.test.ts`,
  `src/lib/navigation/account-menu.test.ts`.
- **Config:** `vitest.config.mts` (added the new registration-prompt test
  glob to the `include` allowlist — required, or the new tests silently
  never run).
- **Docs:** the 13 files under `docs/milestones/NW08.5/` this milestone
  produces, listed in full in `NW085_COMPLETION_REPORT.md`.

Nothing under `supabase/`, `src/lib/payments/`, `src/lib/pricing/
plan-purchase-tax.ts`, `src/lib/stamping/`, `src/lib/signatures/`, or
`src/lib/discovery-sessions/` was touched.

## 4. Known, restated-not-resolved risks

Carried forward unchanged, per the brief's own instruction to restate
rather than silently drop them — full detail in the documents cited:

- The Nextwise Verified ₹1,999-inclusive-of-GST checkout/tax-calculation
  risk (`NW085_01_PUBLIC_PAGE_AUDIT.md` §6).
- NW07's unapplied proposed migration; NW05–NW07's unverified migration
  state (unrelated to this UI-only milestone's scope).
- The loading/error-boundary coverage gap (`NW085_DESIGN_SYSTEM.md` §4,
  `NW085_07_AUTHENTICATED_UX_AUDIT.md` §5).
- The duplicated stale "blanket noindex still active" comment in
  `sitemap.ts` and `structured-data.ts` (`NW085_01` §5, `NW085_08` §2).
