# NW08.5.8 — Authenticated-Area UX Audit

## 1. Method and disclosed limitation

The brief asks for a review of Student/Career/Abroad Studio, Profile,
Saved, Recommendation Reports, Application Dashboard, Counsellor Studio
and Admin Studio for low-risk fixes only (not a redesign). No live
authenticated browser session was available in this environment (no
Supabase session to sign in with, and this milestone's standing
constraint is to never touch auth/DB state) — this audit is therefore a
structural/source-level review: reading every layout, shell and
representative page's actual source, the same method already used
successfully for the public-page audit (`NW085_01`), not a visual
walkthrough. Anything that would require seeing a rendered screen to
judge (exact spacing, color contrast in context, animation feel) is out
of scope here and not claimed either way.

## 2. Layout/shell structure — not a duplication problem

The brief's checklist worries about "duplicate layouts, inconsistent
sidebars." Reading all five authenticated root layouts
(`src/app/dashboard/layout.tsx`, `src/app/studio/layout.tsx`,
`src/app/profile/layout.tsx`, `src/app/recommendations/layout.tsx`,
`src/app/counsellor/layout.tsx`) shows this is already correctly
resolved, not a latent inconsistency:

- `/dashboard`, `/studio`, `/profile`, and `/recommendations` each have
  their *own* `layout.tsx` file only because this codebase has no single
  shared root layout (each top-level route owns its own `<html>`/`<body>`
  — a Next.js App Router constraint, documented on each file). All four
  render the exact same `DashboardShell` component with the same sidebar,
  header, and `UserMenu` — one real shell, instantiated four times, not
  four different ones.
- `/counsellor` and `/admin` each have a different, dedicated shell
  (`CounsellorShell`, `AdminShell`) — correct, since those are genuinely
  different audiences with different permission models, not the same
  workspace duplicated.

Net: three shells for three real audiences (student, counsellor, admin),
not five-plus independently-invented ones. No fix needed here.

## 3. The one real bug found and fixed this stage

`src/lib/navigation/account-menu.ts`'s `COUNSELLOR_LINKS` (used by
`AccountMenu.tsx`'s dropdown) and `src/components/navigation/
WorkspaceEntryLink.tsx`'s matching entry (the new NW08.5 nav-consolidation
component, task #66) both pointed a signed-in counsellor's "Counsellor
Workspace" link at `/admin`. That was correct when `account-menu.ts` was
originally written — its own docblock said so explicitly ("there is no
separate /counsellor route in this codebase"). It went stale once NW07
built a real, separate, permission-gated Counsellor Studio at
`src/app/counsellor/**` (its own `layout.tsx` gate —
`getCurrentAdmin()` + `hasPermission(admin.role, "counsellor-studio:read")`
— and its own `CounsellorShell`), which this audit discovered by
re-verifying the docblock's claim against the current tree rather than
trusting it (the same "verify, don't just restate" discipline already
applied to `sitemap.ts`'s stale noindex comment and this milestone's own
first design-system doc draft).

This was a genuine dead-end-ish bug: a counsellor clicking either control
landed on `/admin` instead of their own studio. Not a broken link (`/admin`
is a real, reachable route, and counsellors do have several legitimate,
specific `/admin` permissions — `counsellors:read`, discovery-sessions,
recommendation verification, document review, task management, confirmed
via `src/lib/admin/permissions.ts`'s `ROLE_PERMISSIONS.counsellor`), but
the wrong *primary* destination for a control labeled "Counsellor
Workspace."

**Fixed:** both `COUNSELLOR_LINKS.href` and `WORKSPACE_LINKS.counsellor.href`
updated from `/admin` to `/counsellor`; both files' docblocks corrected to
state the current, re-verified truth instead of the stale claim; the
pinned test in `account-menu.test.ts` that asserted the old `/admin` value
was rewritten (not silently weakened) with a comment explaining the
supersession, plus a new negative assertion (`never gives a counsellor the
admin dashboard link`). Full suite re-run after the fix: 2360/2360 passing
(was 2359 before this stage's new assertion), `tsc --noEmit` clean, ESLint
clean on every file touched.

## 4. Status badges, error feedback, dead-end actions

- **Status badges:** `StatusBadge` (`src/components/admin/StatusBadge.tsx`)
  and the shared `Badge` tone map are what every authenticated list page
  checked here uses (35 files reference `StatusBadge` across `src/app`).
  No ad-hoc, independently-colored status chip was found duplicating what
  these already provide.
- **Error feedback:** spot-checked `/counsellor/verifications` as a
  representative case — it already renders an inline warning banner
  (`partialFailure` state, `border-warning/30 bg-warning-light`, shared
  warning tone tokens) when its queue fails to load fully, rather than
  failing silently. No missing-error-feedback pattern was found in the
  pages read.
- **Dead-end actions:** grepped the full authenticated tree
  (`studio`, `dashboard`, `profile`, `recommendations`, `counsellor`,
  `admin`) for `href="#"` and no-op `onClick={() => {}}` handlers — none
  found.
- **Blank/unfinished pages:** grepped the same tree for `TODO`/`FIXME`/
  "coming soon" markers in page/component source — none found beyond the
  already-documented, intentionally-disabled "Settings — Soon" item in
  `AccountMenu.tsx` (a disclosed, labeled placeholder, not a silent dead
  end).

## 5. Known, disclosed, not fixed this stage

Restated from `NW085_DESIGN_SYSTEM.md` §4 (not re-litigated here): only 9
routes across the whole app have a `loading.tsx`/`error.tsx` pair, and
within the specific areas this document covers, only `/studio`,
`/studio/abroad`, and `/studio/abroad/applications` have them —
`/dashboard`, `/profile`, `/recommendations`, and `/counsellor` currently
have none. This is a real gap (a slow or failed data fetch on those routes
falls back to Next.js's default behavior rather than a branded
loading/error state), but adding four-plus new boundary files is feature
work, not a low-risk fix, and was already explicitly scoped out of this
UX-focused milestone by `NW085_DESIGN_SYSTEM.md`'s own §4 for the same
risk/reward reasoning UX03-04 originally gave. Flagged again here because
it specifically touches the authenticated areas this document is about.

## 6. Verification

`npx tsc --noEmit` clean. `npx eslint` clean on every file touched
(`account-menu.ts`, `account-menu.test.ts`, `WorkspaceEntryLink.tsx`).
`npx vitest run` — 141/141 test files, 2360/2360 tests passing. Full
aggregate regression reported once more in `NW085_09_QA_REPORT.md`.
