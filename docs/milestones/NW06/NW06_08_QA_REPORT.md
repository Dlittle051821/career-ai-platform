# NW06.8 — Automated Tests, QA, Docs, Security Threat Model, Package & Deliver

Status: **COMPLETE WITH ONE DISCLOSED LIMITATION** (§3 — no live browser pass on authenticated routes; same limitation every prior milestone operating in this sandbox has carried)

## 1. New regression test coverage

| File | Tests | Covers |
|---|---|---|
| `src/lib/applications/application-tasks.test.ts` | 17 | Pure task taxonomy/classification: type/status guards, the UI-mirror transition table, actionable/overdue/open-for-student predicates, the dashboard-tile tally |
| `src/lib/applications/application-tasks-migration-security.test.ts` | 45 | Static-source-text audit of `NW06_application_tasks.sql` — RLS (zero student/staff-write policy), the external-payment safety invariant, lock-then-validate ordering and fixed transition table, ownership/evidence-document guards, student-safe `RETURNS TABLE` shapes, anon-revoke convention |
| `src/lib/applications/application-dashboard.test.ts` | 10 | Pure dashboard composition: upcoming-deadline sort/filter/overdue-flagging, recent-activity merge/sort/limit |

**72 new tests** across 3 new files, all passing, zero skipped or weakened.

## 2. Full validation gate

Run after every substantive NW06 change, and again as the final gate:

| Check | Command | Result |
|---|---|---|
| Type-check | `npx tsc --noEmit` | **Clean — 0 errors** |
| Unit/regression tests | `npx vitest run` | **137 test files, 2254 tests — all passing** (up from the pre-NW06 baseline of 134 files / 2182 tests — the +3 files / +72 tests are exactly this milestone's new coverage) |
| Lint | `npx eslint .` | **0 errors, 18 warnings** — the same 18 pre-existing `@next/next/no-img-element` warnings as every prior milestone, none introduced by NW06 |
| Production build | `npx next build` | **Succeeds** — every route compiles, including the new `/studio/abroad/applications` |

No test was removed, skipped, or weakened to reach this result.

## 3. Responsive/visual QA — disclosed limitation and what was done instead

**This environment's `NEXT_PUBLIC_SUPABASE_URL` is a placeholder** (`https://placeholder.supabase.co`, confirmed in `.env.local`) — there is no live Supabase project reachable from this sandbox, and the one new table this milestone proposes is not applied anywhere. `/applications/[id]`, `/admin/applications/[id]`, and the new `/studio/abroad/applications` are all authenticated AND fully data-dependent — a live Playwright pass against this environment would exercise only the login redirect or an error boundary, never real content, regardless of the code's correctness. This is the identical situation every prior milestone's own QA report discloses (NW05_08, NW04 before it).

**What was done instead — a structural (source-level) review:**

- `npx tsc --noEmit` over every new/changed file, confirming every component's props and every I/O function's return shape match exactly (caught and fixed two real issues before this point: the missing `application_tasks` Tables entry in `src/types/database.ts`, and an overly-convoluted generic cast in the dashboard page — both resolved, both now covered by the clean type-check above).
- Every new component reuses existing, already-reviewed primitives (`Card`, `Badge`, `Button`, `Select`, `Textarea`, `FormField`) with their real prop signatures (`Button`'s five variants, `Badge`'s six tones) checked directly against `src/components/ui/Button.tsx`/`Badge.tsx` rather than assumed.
- Every new grid/card in `/studio/abroad/applications` follows the same `sm:grid-cols-*` collapse-to-stack pattern NW04's Playwright-measured pass already confirmed overflow-free at 375–1440px for the rest of this product, and the same `rounded-[1.5rem] border border-border bg-surface p-5 shadow-soft` card shell already used throughout `/dashboard`/`/studio/abroad`.
- `npx next build` — a real production compile, not merely a type-check, confirming every new route (including the two Server/Client component boundaries: `AbroadApplicationsTable.tsx` and `AdminApplicationTasks.tsx`/`ApplicationTasks.tsx`, all explicitly `"use client"`) builds without a React Server Component boundary error.

**MANUAL VERIFICATION REQUIRED before this is marked production-ready** — exact steps for a real staging environment with a live Supabase project, after the proposed migration has been reviewed and applied:

1. Apply `supabase/migrations-proposed/NW06_application_tasks.sql` (renamed to the next sequential number) to a staging database.
2. As a counsellor/admin test account, open `/admin/applications/[id]` for a real application, create one task of each of the seven types (including `external_payment`), and confirm the "New task" form's conditional fields render correctly.
3. As the owning student test account, open `/applications/[id]` and confirm the new "Action required" card shows each task, including the external-payment disclosure copy, and that "Mark as done"/"I've paid this directly" correctly moves status to `student_completed`.
4. Back as staff, confirm "Verify complete" and "Cancel task" are offered only where the fixed transition table allows, and that verifying sets `verified_at`/`verified_by` correctly.
5. As the student, open `/studio/abroad/applications` and confirm the summary tiles, upcoming deadlines, action-required panel, recent activity, and status-filterable table all show real data consistent with step 2–4, at 375px, 390px, 768px, 1024px, and 1440px viewport widths.
6. Confirm a `finance`/`content_editor`/`analyst` admin account sees no Tasks card at all on `/admin/applications/[id]`.

## 4. Security test summary (consolidated from the new threat model)

| Security case | Result |
|---|---|
| Student reads another student's task | Structurally impossible — zero student RLS policy; `get_my_application_tasks()`'s own join requires `student_user_id = auth.uid()` |
| Student reads a staff-only field (`staff_note`, etc.) | Structurally impossible — excluded from every student-facing `RETURNS TABLE` shape, not merely the select list |
| Student calls a staff-only RPC to self-verify | Structurally impossible — `student_complete_application_task()` has no `verified_at`/`verified_by`/`staff_note` assignment anywhere in its body |
| Counsellor acts on an application not assigned to them | Denied — re-checked against the freshly-locked row's own `assigned_counsellor_id`, never a value read before the lock |
| `finance`/`content_editor`/`analyst` reaches the Tasks card | Denied at the permission-pair level — card omitted entirely |
| Evidence document from another application, or a retired version | Denied — `student_complete_application_task()`'s own `exists (...)` check requires the same `application_id` and `is_current = true` |
| External-payment task mistaken for a Nextwise payment flow | Mitigated at both schema (no payment-method/bank/card/Razorpay column, scoped CHECK constraint) and UI (explicit disclosure on every render) layers |
| Anon role calling any new RPC | Denied — explicit `revoke execute ... from anon` on every one of the five new functions |

## 5. What NW06.8 did not need to add

- No new payment/checkout test — NW06 made no payment-provider or checkout-flow change, and paid checkout was never enabled for anything in this milestone.
- No new React-rendering test harness — this codebase has never used React Testing Library/jsdom; NW06 follows the same established static-source-text-audit convention as every prior milestone.
- No change to any pre-existing migration-security test file (`application-workflow-...`, `application-submission-...`, `application-documents-...`, `application-processing-workspace-...`) — all four still pass unchanged, confirming zero regression to the lifecycle/documents/submission system NW06 built on top of.
