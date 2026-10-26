# NW08.8 — Security, QA, Docs, Package & Deliver

## 1. Full regression — final pass

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Clean. |
| `npm run lint` | 0 errors. 18 pre-existing warnings (`<img>` → `next/image` suggestions in marketing-page components never touched by NW08). |
| `npx vitest run` | **139 files / 2326 tests passed** (2309 pre-NW08 + 17 net new: 11 in `bucketRevenueByMonth`/`tallyByKey`/`rankOperationalAlerts`, 8 in `resolveAnalyticsWindow`, minus the 2 absorbed into existing `describe` blocks — see `src/lib/admin/analytics.test.ts` for the exact count). Zero pre-existing test removed or weakened. |
| `npm run build` | Succeeds. 3 new routes registered: `/admin/crm`, `/admin/applications/operations`, `/admin/finance`. |

Run three times across this milestone (after NW08.2, after NW08.5, and this final pass) — results identical each time.

## 2. New test coverage this milestone added

`src/lib/admin/analytics.test.ts`: `tallyByKey` (2 tests), `bucketRevenueByMonth` (4 tests: per-currency grouping, non-paid exclusion, zero-fill, same-month bucketing), `rankOperationalAlerts` (3 tests: zero-count filtering, severity ordering, count ordering within a severity), `resolveAnalyticsWindow` (8 tests: all-time default, trailing-days, this-month, last-month including a year-boundary rollover, explicit from/to with inclusive "to", open-ended from, malformed-date fallback).

No DB-mocking test was written for the new thin Supabase-calling wrapper functions (`getStudentStatusDistribution`, `getLeadStageDistribution`, `getLeadsNeedingFollowUpCount`, `getApplicationOperationsOverview`, `getCommercialFinanceOverview`) — consistent with this codebase's own pre-existing, disclosed convention (see `NW08_01_ADMIN_AUDIT.md` §9) of unit-testing the pure logic layer and leaving the thin DB-calling layer to structural (source-level) review, the same posture `getAdminDashboardSummary()`/`getAnalyticsSummary()` themselves have always had.

## 3. The one disclosed testing limitation

No live, authenticated browser pass was run over any of the 3 new or 7 changed admin pages, because this sandbox's `NEXT_PUBLIC_SUPABASE_URL` is a placeholder host with no real database reachable — the identical, pre-existing environment constraint every prior milestone in this session (NW06, NW07) has disclosed. A structural (source-level) review was done instead: every new query was traced to confirm it is bounded (`count: "exact", head: true` or a narrow column select), every new page was traced to confirm its permission gate matches the data function it calls, and `npm run build`'s successful production compile confirms every new page type-checks and renders through Next.js's own server-side generation step without throwing.

**Manual verification steps for a real staging environment**, once one is reachable: (1) sign in as each of the 6 roles and confirm the sidebar's new "CRM Overview"/"Operations"/"Finance Overview" items appear only for roles with the matching permission; (2) on `/admin`, confirm the 9 KPI tiles, revenue trend, service delivery donut, and operational alerts render with real data (or honest empty states on a fresh database); (3) confirm `/admin/leads?assignedCounsellorId=<id>` and `/admin/applications?assignedCounsellorId=<id>` (reached via the Counsellors workload table's new links) return the expected filtered set; (4) on `/admin/analytics`, try "This month", "Last month", and a custom from/to range and confirm the "Showing: …" label matches the actual filter applied; (5) resize to each of the brief's 5 target viewports (375/390/768/1024/1440px) and confirm the new sidebar groups and Command Centre's new sections remain usable (Tailwind's existing responsive utilities were reused throughout — no new breakpoint behavior was invented — but this was not pixel-verified live).

**`RLS_INTEGRATION_NOT_TESTED`**: not applicable this milestone — NW08 introduced zero RLS changes and zero new tables (see `NW08_DATABASE_CHANGE_PLAN.md`), so there is no new RLS surface to disclose as untested. Every new query runs through the same pre-existing RLS policies every pre-NW08 query in these modules already runs through.

## 4. Acceptance criteria

NW08's own operational translation of the master brief's requirements into a checked list (the brief's acceptance criteria were given in prose across its 24 sections; this table restates them as discrete, verifiable items against what was actually built, in the brief's own PASS / PASS_WITH_LIMITATIONS / BLOCKED / FAIL / NOT_TESTED vocabulary).

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| AC01 | Git/production safety check run before any work | PASS | `git status`/`branch`/`log`/`rev-parse` all confirmed "not a git repository" at session start. |
| AC02 | No commit, push, merge, or destructive git op performed | PASS | Structurally impossible (no `.git/`) and never attempted. |
| AC03 | No production deploy, no Vercel/Supabase config change | PASS | Not touched. |
| AC04 | No secret read, logged, or packaged | PASS | No `.env*` file read or included in the deliverable. |
| AC05 | Existing admin audited before any new code was written | PASS | `NW08_01_ADMIN_AUDIT.md`. |
| AC06 | Reuse existing systems; no parallel admin product | PASS | `NW08_ARCHITECTURE.md` §1; every new page composes existing data functions. |
| AC07 | Mockup's 6 visual areas addressed | PASS | Command Centre (NW08.2), CRM (NW08.3), Counsellor & Team (NW08.4), Applications (NW08.5), Commercial/Finance (NW08.6); Mobile addressed via existing responsive utilities, not live-verified (see §3). |
| AC08 | Every mockup number (1,482 leads / SGD 128,450 / etc.) excluded from the codebase | PASS | Grepped for and confirmed absent; see `NW08_METRIC_DICTIONARY.md`'s closing section. |
| AC09 | Mockup's SGD currency not treated as Nextwise's real currency | PASS | Every amount rendered is the row's own recorded `currency`; no currency is hardcoded. |
| AC10 | GST/checkout-risk blocker restated, not resolved, not exercised | PASS | Restated verbatim in `/admin/finance`'s own page copy and in `NW08_06_COMMERCIAL_FINANCE.md` §1; no checkout file read or changed. |
| AC11 | No unsafe purchase path enabled | PASS | No checkout/payment-calculation code touched. |
| AC12 | NW07's proposed migration not assumed applied | PASS | `NW08_DATABASE_CHANGE_PLAN.md` §3; nothing built depends on it. |
| AC13 | Revenue never summed across currencies | PASS | Fixed a pre-existing violation of this rule — `NW08_02_COMMAND_CENTRE.md` §2. |
| AC14 | A refund request never shown as a completed refund | PASS | `/admin/finance` and the Command Centre both label `pendingRefundsCount`/the refund distribution by its real lifecycle status; `NW08_01_ADMIN_AUDIT.md` §6. |
| AC15 | A pending payment never counted as revenue | PASS | `sumRecordedRevenue()`'s `status === "paid"` filter, unchanged, reused everywhere. |
| AC16 | Server Components by default; no client-supplied role/id trusted | PASS | Every new page is an `async` Server Component; every permission check reads `getCurrentAdmin()` server-side. |
| AC17 | IA regrouping maps onto existing routes; nothing removed | PASS | `AdminShell.tsx`'s 21 pre-existing `href`/`permission` pairs are byte-identical after the change; only a `group` label was added. |
| AC18 | New staff role only as a documented proposal, not hardcoded broad access | PASS | `NW08_01_ADMIN_AUDIT.md` §8 — deferred, not built. |
| AC19 | An unapplied-migration-dependent feature shows a truthful unavailable state, never fabricated data | PASS | No NW08 feature depends on an unapplied migration (none exists for NW08); the one candidate (counsellor recommendation workload) was deliberately not built rather than faked. |
| AC20 | Testing/regression gate run (tsc/lint/vitest/build) | PASS | §1 above. |
| AC21 | New pure logic covered by unit tests | PASS | §2 above. |
| AC22 | `RLS_INTEGRATION_NOT_TESTED` disclosed where applicable | NOT_APPLICABLE | No new RLS surface — §3 above. |
| AC23 | Required documentation set produced | PASS | 14 documents under `docs/milestones/NW08/` (this report included). |
| AC24 | `NW08_METRIC_DICTIONARY.md` produced | PASS | Written — every metric this milestone shows, defined. |
| AC25 | Security threat model produced | PASS | `NW08_SECURITY_THREAT_MODEL.md`. |
| AC26 | Packaging + SHA-256 manifest + install guide | PASS | §6 below, `NW08_INSTALL_GUIDE.md`. |
| AC27 | Delivery avoids "double-installation confusion" — repo is already modified, ZIP is a backup/release artifact | PASS | Stated explicitly in `NW08_INSTALL_GUIDE.md` §0. |
| AC28 | Live, authenticated browser verification | NOT_TESTED | No reachable Supabase project in this sandbox — disclosed, §3 above, with manual steps given. |
| AC29 | Mobile breakpoint pixel verification (375–1440px) | NOT_TESTED | No live browser/renderer available; existing responsive utilities reused, not newly invented — §3. |
| AC30 | No P0 release blocker remains | PASS | §5 below. |

## 5. Severity review

**P0:** none found, none introduced.

**P1:** none found, none introduced. (The cross-currency revenue bug found and fixed in NW08.2 would have been P1 on a multi-currency deployment; it is fixed, not merely documented.)

**P2:** the two `NOT_TESTED` items above (AC28, AC29) — no live browser verification was possible in this sandbox. Does not block a founder's own local/staging verification per the manual steps in §3.

**P3:** the UTC-only calendar-boundary simplification for "this month"/"last month" (no per-business timezone setting) — documented, deliberate, localized to make a future change easy (`NW08_METRIC_DICTIONARY.md`'s timezone section).

## 6. Packaging

`NW08-ADMIN-OPERATIONS.zip` — every file NW08 added (5 files) or changed (14 files — see `NW08_ARCHITECTURE.md` §2–3 for the full list), this milestone's 14 docs, and a SHA-256 manifest. No migration is packaged (none was created). See `NW08_INSTALL_GUIDE.md` for the exact install steps and checksum verification commands (POSIX and PowerShell).
