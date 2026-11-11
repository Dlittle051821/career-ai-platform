# CC24-06 — Release readiness report

## Recommendation

| Target | Decision |
|---|---|
| **Staging acceptance** (Vercel Preview with QA Supabase, payments and AI off) | **GO**, after the conditions below |
| **Production release** of CC-24 | **NO-GO** until the conditions below are met |
| **Paid checkout** | **NO-GO**, independently of CC-24 (GST migrations CC-19/CC-20) |

**Conditions for staging acceptance:**
1. `Finish-CC24.ps1 -InstallDependencies` passes on Windows. It removes the two obsolete `loading.tsx` files and runs typecheck, lint, tests and build there; these have so far only run on Linux.
2. The CC-24 diff is reviewed and committed on `cc24/student-journey-stabilization`. Your decision.
3. A Preview is built with **QA** variables only.

**Before production:**
1. Staging journeys re-run on the Preview, including Safari/iOS and a screen reader.
2. Migration 0023 approved and applied to QA, then the F11 and R checks re-run.
3. Human security sign-off.
4. V5.4 portrait rights resolved.
5. Explicit production approval.

## Final results

| Check | Result |
|---|---|
| Browser journeys (local stack, CC-24 production build) | **107 checks: 104 PASS · 1 FAIL (P2) · 2 BLOCKED**, detailed in CC24-04 |
| Same checks before the CC-24 fixes | D3, E3 and F8 FAIL (CC-23 final run, on code identical to `a1017b9` for these routes); R1 FAIL (`/counsellor` 200, observed on the CC-24 build before fix D05); F11 showed "Unnamed student" |
| Vitest | 175 files, **3,045 passed, 1 skipped**. Baseline: 2,906 / 1. No test removed or skipped |
| New regression tests at `a1017b9` | Fail as expected: 28 + 4 failures |
| TypeScript | PASS |
| ESLint | PASS: 0 errors, 18 warnings (baseline) |
| Production build | **PASS** (`next build` exit 0) |
| V5.4 homepage | **Unchanged**: 39 files byte-identical (test-pinned); rendered DOM identical to `a1017b9`; 16/16 scroll frames pixel-identical; 0 console errors |
| CC-18 security files | 45/45 unchanged |
| CC-23 fixes | No regression: suites B, C, E6, F and H all pass |

## Acceptance criteria (brief §13)

| # | Criterion | Status |
|---|---|---|
| 1 | All actionable P0 defects resolved | **Met.** No new P0 found. The only open P0 (D14, GST migrations) is not code-actionable, and the payment gate is verified closed |
| 2 | P1s resolved or explicitly blocked | **Met.** D02, D03 and D04 fixed. D01, D12, D13 and D20 BLOCKED with reasons (CC24-01) |
| 3 | Registration and login reliable | **Met locally** (B 19/19). Real SMTP and QA redirects BLOCKED (remote) |
| 4 | Profile creation and persistence verified | **Met** (C 17/17; limits enforced server-side) |
| 5 | Counsellor access follows boundaries | **Met for isolation** (R2–R5). The assigned counsellor's identity access needs 0023 (approval) |
| 6 | Discovery Session booking functional or documented | **Met** (F1–F10). No scheduling provider; staff schedule in IST; cancel and reschedule are staff-side (documented) |
| 7 | Career and university routes correct | **Met.** Real 404s; filters, compare and empty states pass |
| 8 | CC-22 security intact | **Met** (G1–G8, B10–B12, webhooks unchanged) |
| 9 | CC-23 fixes don't regress | **Met** |
| 10 | V5.4 homepage unchanged | **Met** (suite V and the hash guard) |
| 11 | Paid checkout cannot improperly charge | **Met.** Gate verified closed and tree-wide guard added (CC24-05) |
| 12 | Tests and production build pass | **Met** on Linux. Windows run pending via `Finish-CC24.ps1` |
| 13 | Skipped, failed and blocked checks reported | **Met** (CC24-04 §3) |
| 14 | No production data or environment modified | **Met.** Only the local container database was used |
| 15 | Handoff and readiness reports | **Met** (CC24-01 to CC24-07) |

## Unresolved issues

**Remaining FAIL: H6 (P2), touch targets under 24×24 px:**
- inline text links and footer links;
- several links inside the V5.4 homepage, which is restricted from change in CC-24;
- the Terms checkbox (20×20; its whole label is the clickable target).

WCAG 2.5.8 exempts inline targets and targets with an equivalent larger control. Recommendation: a design pass in the next visual update.

**BLOCKED:**
- **D01 / F11:** counsellor identity; migration 0023 awaiting approval.
- **D12 / D8:** recommendation reports; NW07.
- **D13:** application tasks; NW06/NW07.
- **D20:** real email and QA redirects.
- **D14:** payments; CC-19/CC-20.

**OPEN (documented, not fixed):**
- **D15:** brand contrast; colours restricted.
- **D17:** middleware `getUser` runs on every prefetch.
- **D18:** `supabase/.temp` tracked in git.
- **D19:** non-atomic profile section save.
- **D21:** portrait rights.
- **D23:** inactive counsellors keep RLS scope.

## Database dependencies (each needs separate approval)

| Item | Purpose | Prepared |
|---|---|---|
| 0023 counsellor profile read | Assigned counsellor sees the student's identity | `supabase/migrations-proposed/cc24/` (SQL, rollback, tests) |
| NW07 | Recommendation reports, counsellor studio foundation | `supabase/migrations-proposed/NW07_*.sql` |
| NW06 | Application tasks | `supabase/migrations-proposed/NW06_*.sql` |
| CC-18 payment set: NW09.2 atomic, 05, 06, NW01 | GST-correct checkout | `supabase/migrations-proposed/` (CC-18 order) |
| Published `tax_inclusive` Verified version | Correct price label | Admin UI |

## Security findings

There are no open security defects in code. CC-24 tightened four things:
- server-side validation of Discovery Session and profile input;
- the verify-payment gate;
- `/counsellor` sign-in redirect;
- honest restricted labels.

**Notes:**
- D23: inactive counsellors keep RLS scope.
- D18: infrastructure identifiers tracked in git.
- The cumulative human security sign-off (CC-14 to CC-24) is still outstanding.

## Regression risks

| Change | Risk | Mitigation |
|---|---|---|
| List skeleton moved from `loading.tsx` into each list page's `<Suspense>` | Low. Same markup. On client-side navigation the skeleton now appears once the new page starts streaming, not instantly from prefetch | H1 sweep clean; status codes verified |
| Detail `layout.tsx` existence checks | Low. One extra cached call, deduplicated by `React.cache` | Detail pages and 404s verified |
| Profile limits | A student with an existing answer longer than a new limit must shorten it on the next save of that step | Limits are generous (e.g. 2,000 characters for life goals) |
| Booking allow-list | A future new language or time option must be added to `booking-input.ts` too | Test pins the lists to the form |
| Middleware `/counsellor` | Signed-out staff now land on `/login?next=/counsellor` (intended) | R1, unit test |

## V5.4 portrait

The public-use rights of `public/home-v54/v54-portrait*.png` are unresolved. It must be replaced with a properly licensed asset in the next visual update. CC-24 did not change it.
