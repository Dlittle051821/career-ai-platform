# NW08.5 — QA Report

## 1. Final exact results

```
npx tsc --noEmit     → clean, 0 errors
npx vitest run       → 141 test files, 2360 tests, all passing
npm run lint         → 0 errors, 18 warnings (all pre-existing @next/next/no-img-element
                        warnings on decorative hero <img> elements — the same 18 every
                        prior milestone back to CS01 has reported; none new)
npm run build        → succeeds, 131 routes generated (no route added or removed —
                        this milestone changed nav/copy/components/docs, not the route tree)
```

No test was skipped, no test was deleted to make a number look better, and no test
was weakened to pass — every rewritten assertion in this milestone (the nav-IA block,
the hero-headline block, the contact-email placeholder check, the counsellor-workspace-
link check) is documented inline, at the point it was changed, with the reason it
legitimately supersedes the old behavior, following this codebase's own established
convention (first set by `HomeHero.tsx`'s UX10-H03/H04/H05B docblocks).

## 2. Reconciling the test-count discrepancy

The NW08.5 brief itself cited a baseline of **140 test files / 2,349 tests**. The
actual, directly-measured baseline at the start of this milestone (before any NW08.5
change was made) was **139 files / 2,326 tests** — confirmed by running the full suite
against the untouched tree before this milestone's first edit.

Being honest about what can and cannot be reconciled: this environment has no earlier
checkpoint of the repository to diff against, and no record of exactly when or how the
brief's own "140/2,349" figure was produced (whether from a slightly different point in
development, a different counting method, or a transcription from an earlier report).
Rather than guess at a cause and present the guess as fact, this report states the
measured discrepancy plainly: **13 fewer tests, 1 fewer file** than the brief's cited
figure, confirmed by actually running the suite, not assumed. This is a pre-existing
gap between the brief's figure and the real repository — nothing this milestone did
caused it, and nothing in NW08.5's own scope depended on resolving it (no test behavior
changed because of it).

From that real, measured 139/2,326 baseline, this milestone's own changes account for
the full difference to the final, measured 141/2,360 (+2 files, +34 tests):

| Change | Files | Reason |
|---|---|---|
| Registration Prompt (new feature, task #70) | +2 | `eligibility.test.ts` (16 tests) + `registration-prompt-source-audit.test.ts` (15 tests) = 31 of the +34 tests |
| Nav-IA block rewrite (`nw04-public-website-audit.test.ts`) | +0 | Old dropdown-structure assertions replaced with new flat-nav assertions, net positive |
| Hero-copy block rewrite (`hero-composition-audit.test.ts`) | +0 | Old UX10-EU02 headline assertion replaced with the new headline/support-copy/search-form assertions, net positive |
| Contact-email placeholder rewrite (`site.test.ts`) | +0 | One assertion rewritten in place, net zero |
| `AdminTable`/`counsellors` duplicate-key fix (task #72) | +0 | Behavior fix only; no new test needed |
| Counsellor-workspace-link fix (task #72) | +0 | One assertion rewritten, one new negative assertion added alongside it, net positive |

The 2 new files and their 31 tests are independently confirmed above (isolated re-run).
The remaining +3 tests are the combined net gain across the three rewritten blocks
(nav-IA, hero-copy, counsellor-link) in pre-existing files — this repository has no
version control (confirmed at this milestone's own baseline safety check), so there is
no commit-level diff to attribute that +3 to a single assertion with more precision
than "spread across those three rewrites," and this report does not claim more
precision than that.

## 3. Disclosed limitations (carried from every milestone in this session)

- **No live, authenticated browser session.** Every claim in `NW085_01`, `NW085_06`,
  `NW085_07`, and `NW085_08` about rendered appearance, focus order, or runtime
  behavior is derived from reading source, not from clicking through a running app in
  this sandbox (no real Supabase project credentials are present here — only
  `.env.example` is committed, the same constraint every milestone back to M11A has
  carried).
- **No Lighthouse/axe/Core-Web-Vitals tooling was run.** `NW085_08`'s performance and
  accessibility sections are explicit that no score of any kind is claimed — see that
  document's §1 and §3.
- **Known, pre-existing, restated-not-resolved risks** (unchanged by this milestone,
  repeated here per the brief's own instruction to restate rather than silently drop
  them):
  - The Nextwise Verified ₹1,999-inclusive-of-GST checkout/tax-calculation risk
    documented in full in `NW085_01_PUBLIC_PAGE_AUDIT.md` §6.
  - NW07's unapplied proposed migration and NW05–NW07's unverified migration state —
    unrelated to this milestone's UI-only scope; not touched, not re-checked here.
  - The loading/error-boundary coverage gap (9 of ~39 dynamic routes covered) — see
    `NW085_DESIGN_SYSTEM.md` §4 and `NW085_07_AUTHENTICATED_UX_AUDIT.md` §5.
  - The stale "blanket noindex still active" comment duplicated in two files
    (`sitemap.ts`, `structured-data.ts`) — see `NW085_01` §5 and `NW085_08` §2.

## 4. Scope discipline

Confirmed via `git status`-equivalent review of every file touched this milestone
(this repository is not a git repo — see `NW085_ARCHITECTURE.md` §1 for the baseline
safety check — so this was done by re-reading the full list of files created/modified/
deleted across tasks #64–#74, reproduced in `NW085_COMPLETION_REPORT.md`): nothing
under `supabase/`, `src/lib/payments/`, `src/lib/pricing/plan-purchase-tax.ts`,
`src/lib/stamping/`, `src/lib/signatures/`, `src/lib/discovery-sessions/`, or any
migration file was touched. No database change was made or proposed. No secret,
API key, or credential was read, written, or packaged. No commit, push, or deploy was
performed, per the standing constraint carried through this entire session.
