# CC-14: Security closure and migration readiness (NW-F01)

Date: 2026-11-07 (Europe/Berlin). Prepared by Claude. Local preparation only.

No migration was applied to Development-QA (`ynwzijulzksmrcwdhudv`) or production (`bwlkxunujngksibfzzfv`). Neither database was accessed. Nothing was deployed, committed, pushed or merged, and no payment was enabled or attempted. `supabase/.temp/cli-latest` was not touched.

## Summary

| Gate | Status |
|---|---|
| Starting state preserved and snapshotted | PASSED |
| Independent security review | AI review COMPLETED; human sign-off NOT done. The gate is **not passed** |
| Atomic migration assembled and rehearsed (disposable local PostgreSQL 16) | PASSED locally. Not run on Supabase |
| Checkout fail-closed for Nextwise Verified (₹1,999 incl. GST) | Implemented (application layer). The SQL root-cause fix NW01 is still unapplied |
| Supabase QA validation | PLAN ONLY. Needs authorization |
| Overall | **NO-GO** for any shared-environment migration or production. **GO** to request authorization for the QA validation in section 6, subject to the conditions there |

## 1. Verified starting Git state

Checked from the PC worktree through the linked-computer file bridge. Read-only: no git command was run on the PC.

- **Worktree:** `C:\CodexBuilds\Nextwise-NW-F01`. Its gitdir is `C:/carrier.ai/.git/worktrees/Nextwise-NW-F01`.
- **Branch:** `HEAD` = `ref: refs/heads/stabilization/nw-f01`. The branch ref is `4f69c33be218e59433713ebe1fef22c857d25a67`.
- **Index:** 1,464 entries, nothing staged. The index file was byte-identical to the one parsed in CC-13.
- **Change detection:** every file under `src/`, `docs/`, `scripts/`, `supabase/`, `qa/`, `public/` and the root was compared with the index (size and mtime), including the 8 deeply nested `src/app` folders.
  - Modified tracked files: the same 12 as CC-13, including `supabase/.temp/cli-latest`.
  - Untracked files: Codex's 10 stabilization files, the generated `next-env.d.ts`, CC-13's `REVIEW.md` update and `scripts/security/nw-f01-s4.pg-concurrency.test.mjs`.
  - No other file had changed.
- **Snapshot:** `C:\ClaudeBuilds\Snapshots\NW-F01-CC14-pre-20261107.zip`, written outside the worktree before any CC-14 edit. It contains:
  - exact bytes of all 25 modified or untracked stabilization files;
  - `MANIFEST.json` (path, size, SHA-256, git status, HEAD blob ID);
  - `RESTORE.md`, a per-file restore procedure;
  - `tracked-changes-vs-HEAD.LF.patch`.

  Byte for byte, each snapshot file matches the scratch copy used for verification (after CRLF normalisation).

## 2. Files changed in CC-14

New:
- `supabase/migrations-proposed/nw-f01-s3/NW09_2_ATOMIC_01-03.sql`: the single-transaction review artifact. It is generated, not hand-edited, and lives in the review-only folder, never in `supabase/migrations/`.
- `scripts/security/assemble-nw09-2-atomic.mjs`: generates the artifact. Run with `--check` to detect drift from 01–03.
- `scripts/security/nw-f01-s4.migration-rehearsal.test.mjs`: forced-failure and before/after rehearsal on a disposable local PostgreSQL.
- `src/lib/payments/checkout-charge-guard.ts`: pure fail-closed charge validation.
- `src/lib/payments/checkout-charge-guard.test.ts` (32 tests).
- `src/lib/payments/checkout-charge-wiring.test.ts` (6 tests).
- This document.

Modified:
- `src/lib/supabase/payments/checkout.ts`: validates the charge before creating or reusing a gateway order. It now fails closed on unreadable payment history and refuses to reuse an open order whose amount differs from the amount due.
- `supabase/migrations-proposed/nw-f01-s3/02_nw09_2_replacement.sql`: review findings F2 (NaN cost) and F8 (transient errors), 22 changed lines.
- `supabase/migrations-proposed/nw-f01-s3/03_review_separation_and_grants.sql`: review finding F6 (TRUNCATE/TRIGGER/REFERENCES), 11 changed lines.
- `scripts/security/nw-f01-s3.offline.test.mjs`: two regression tests appended. No existing test was changed or weakened.

Unchanged: 01, 04, all application AI/webhook code from Codex and CC-13, all UI, homepage and animation code.

## 3. Independent security review status

**What happened:** a separate reviewer agent ran with a fresh context. It had not seen the implementation work and was given the code, not CC-13's conclusions. It reviewed 01–04, the NW07/NW09 prerequisites and the application boundary. It ran exploit scripts on its own throwaway PostgreSQL 16 cluster. The scripts are kept with the CC-14 evidence. In the table, R = reproduced by execution; Read = found by reading only.

**Limitation:** the reviewer is an AI agent, independent of this work but from the same model family. **This does not satisfy the requirement for an independent reviewer. The gate stays OPEN until a human security reviewer signs off.**

| ID | Severity | Finding | Evidence | Remedy | CC-14 status |
|---|---|---|---|---|---|
| F1 | **High** | Any assigned counsellor can forge an "AI-assisted" draft. They reserve an OpenAI run and call `staff_finalize_ai_generation_run` directly with made-up report/content and `providerResponseId`. All payload checks compare client-supplied values with each other. | R: `x1_forge_finalize.sql` returned `finalized`, run `succeeded`, `provider_response_id=resp_FABRICATED` | Make finalization trusted-server-only: grant it to `service_role`, have the server pass the authenticated requester, keep the user-session check in reserve. Alternatively, HMAC-sign the payload server-side. Optionally verify the response ID with the provider. | **OPEN. Design decision required.** It changes the trust boundary and the app gateway, so it was not changed silently. P0 before any production AI enablement; acceptable for fictional-only QA. |
| F2 | Medium | `'NaN'` cost values poison every budget sum and block all AI use. | R: `x2_nan.sql` | Reject NaN in reserve, complete and finalize; add a table CHECK; precheck existing rows. | **FIXED in 02.** Regression test added (offline 53/53). |
| F3 | Medium | Admins can overwrite "immutable" signed/stamped document paths and provider request IDs by direct table UPDATE (RLS UPDATE policy). There is no unique `(provider, provider_request_id)`. | R: `x4_admin_path.sql` | Revoke column UPDATE on those columns; add a write-once canonical-path trigger; add a partial unique index; narrow bucket INSERT. | **OPEN** (P1). Touches existing signature/stamping admin flows, so it needs product confirmation. |
| F4 | Medium | An approval does not name the reviewed version. An author can withdraw, edit and resubmit while the reviewer approves what they saw earlier. | R: `x3_review.sql` | Add `p_expected_version_id` to review; check it under the row lock and store it. | **OPEN** (P1). The RPC signature and the review UI both change. |
| F5 | Low | Any admin-role user can write audit rows with system-looking action names through `record_admin_audit_log`. | R | Allow-list actions, or reserve system names. | OPEN (P2) |
| F6 | Low | TRUNCATE/TRIGGER/REFERENCES were left on audit and signature tables under Supabase-style default grants. TRUNCATE bypasses RLS. | R | Revoke them from anon/authenticated. | **FIXED in 03**, with postcondition and regression test. |
| F7 | Low | 35 legacy SECURITY DEFINER functions (e.g. `is_admin_role`, `apply_*_webhook_event`) use `search_path=public` without `pg_temp` and call `hmac`/`digest` unqualified. | Read + catalog query | Set `pg_catalog, public, pg_temp` (plus `extensions` where pgcrypto lives). Schema-qualify crypto calls. | OPEN (P1). QA must confirm the webhooks resolve `hmac()` on Supabase, where pgcrypto is normally in `extensions`. |
| F8 | Low | Finalization turned lock/serialization/timeout errors into a permanent `failed` run. | Read | Re-raise `40001`, `40P01`, `55P03`, `57014`. | **FIXED in 02.** Concurrency suite 5/5 runs green. |
| F9 | Low | Consent is not rechecked between reserve and the provider call. | Read | Recheck just before the network call; document the remaining window. | OPEN (P2). Finalization still discards output. |
| F10 | Info | Single-admin real-student approval, `blocked` runs excluded from counters, 15-minute reservation hold, deleted author voids separation, 04 leaves finalize open, pilot script mints a counsellor session, failed path capture is not retried. | Read | Backlog | OPEN (P2) |

The reviewer found no issue in:
- `record_system_audit_log` authorization;
- `set_*_document_path` through its RPC (canonical, existing, write-once, service-role only);
- webhook HMAC order;
- v1 closure;
- self-approval blocking;
- withdrawal/finalization locking under READ COMMITTED and REPEATABLE READ;
- idempotency and cost floors (apart from F2);
- RLS on the AI and draft tables;
- search_path pinning on all new definer functions;
- the app's use of the user session versus the service role.

## 4. Migration assembly and rollback results

**Artifact.** `NW09_2_ATOMIC_01-03.sql` is 01 + 02 + 03 with their own BEGIN/COMMIT removed, inside ONE `begin; … commit;` (exactly one of each). It applies:
- `lock_timeout 5s` and `statement_timeout 120s`;
- an owner check (`postgres`);
- an explicit operator opt-in (`set nextwise.nw09_2_atomic_approval = '<approval ref>'`);
- a prerequisite check (NW07 + NW09 present);
- each file's own preconditions and postconditions;
- a final combined postcondition.

**Ordering and dependencies:**
1. Baseline `0001`–`0022`.
2. NW05.
3. NW06.
4. NW07.
5. NW09.
6. **The artifact.**

Never apply `NW09_2_openai_live_pilot.sql` as well. `04_pause_ai_recovery.sql` is a separate recovery tool. The artifact has `assemble --check` drift protection; SHA-256 prefix `76739e0b1266e4ff` at the time of writing.

**Rehearsal** (`nw-f01-s4.migration-rehearsal.test.mjs`): PostgreSQL 16.15, a disposable local database, Supabase-style roles and broad default privileges. Synthetic pre-existing history included:
- three legacy AI runs (succeeded with report and draft, failed paid run with cost 0.4, blocked);
- a manual draft;
- customised usage settings;
- an audit row.

| Check | Result |
|---|---|
| Artifact equals its reviewed sources; one BEGIN/COMMIT; 04 and the pilot file not included | Pass |
| Forced failure immediately before COMMIT (after every postcondition passed) | Pass: OID-independent catalog fingerprint (schemas, relations, columns, constraints, indexes, triggers, policies, functions with body hash, definer, config, owner and ACL, default ACLs) and row fingerprint of every table **byte-identical** to before |
| Forced failure between 02 and 03 (partial schema in flight) | Pass: identical; consent table absent |
| Forced failure between 01 and 02 | Pass: identical |
| Missing approval setting / non-postgres executor | Fails closed, no change |
| Missing NW07/NW09 prerequisites | Fails closed, no change |
| Active AI reservation present (quiesce precondition) | Fails closed, catalog and data unchanged |
| Successful application | Pass, as detailed below |
| Re-running the committed artifact | Idempotent success; catalog and data unchanged |

Successful application:
- Legacy run columns and values are unchanged. Drafts, versions, roles, case assignments and users are unchanged. Audit rows are preserved. Settings keep their values, and `real_student_processing_approved` stays not true.
- Fictional registry and paid-model registry are left empty.
- No relation, column, constraint, index, policy or trigger outside the reviewed set changed.
- EXECUTE grants are verified for every reviewed RPC: audit writer and path setters are service_role only; finalize and withdraw are authenticated only; legacy v1 and split linking are unreachable; none are executable by PUBLIC.
- All SECURITY DEFINER functions in `public` and `nextwise_security` pin search_path.
- RLS is on all five AI and draft tables.

Catalog delta on success (rows added/removed):
- columns +33/−0
- constraints +27/−0
- indexes +5/−0
- functions +27/−18 (replacements and ACL changes)
- relations +10/−7 (ACL changes on existing tables)
- policies +1
- triggers +1
- schema +1 (`nextwise_security`)
- default ACLs unchanged

Six functions outside the CREATE OR REPLACE set are touched intentionally, by ACL or search_path only: `admin_purge_ai_generation_reports`, `counsellor_has_case_access`, `get_my_recommendation_report*`, `staff_create_recommendation_draft` and `student_mark_section_self_entered`.

**Also re-verified after the F2/F6/F8 edits:**
- Offline SQL (PGlite): **53/53**.
- Real multi-session concurrency: **10/10 tests in each of 5 consecutive runs**, with 0 deadlocks in the server log.
- Rehearsal: **9/9**.

**Not proven:** behaviour on Supabase itself, which has managed owners, Supavisor pooling, PostgREST JWT roles, real default ACLs and pgcrypto in `extensions`.

## 5. Checkout correction and test evidence

**Finding.** The live `public.purchase_pricing_plan()` adds GST on top of every plan once GST is configured, ignoring `tax_status`. Nextwise Verified is seeded at 199,900 paise with `tax_status='unconfigured'`, so with 18% GST it would charge **₹2,358.82**. The SQL fix (`NW01_fix_purchase_pricing_plan_tax_handling.sql`) remains unapplied, as instructed.

**Fix (application layer, fail-closed).** Before any Razorpay order is created or reused, `createOrReuseCheckoutSession` now loads the invoice, its lines, its frozen `pricing_purchases` record, the plan slug and the version's tax status, using the student's own session (RLS). It passes them to `validateCheckoutCharge`, and any failure blocks checkout with a neutral message ("You have not been charged"), before the gateway is called.

| Scope | Rule |
|---|---|
| Every invoice | Safe non-negative integer amounts; valid currency code; at least one line; lines add up to the total and the tax; the charge is positive and not more than the total |
| Every plan purchase | Invoice equals the frozen purchase record. Tax may be added on top only for an explicitly `tax_exclusive` version at the line's rate. Otherwise the total must equal price minus discount, and any tax shown must be the inclusive share |
| Nextwise Verified (by slug, or by frozen plan name if the plan row is unreadable) | Exactly 199,900 paise, INR, no discount, never tax-exclusive. Any GST is the inclusive share at the line rate: at 18%, ₹304.93 of the ₹1,999, matching PostgreSQL's `round()` |
| Unreadable or failed lookups | Blocked (`missing_configuration`) |
| Open gateway order | Reused only if its amount equals the amount due now. Stale orders from before the fix are refused |

**Tests:** 38 new tests, all passing.

`checkout-charge-guard.test.ts` covers:
- correct ₹1,999 with no GST and with inclusive 18% GST;
- the ₹2,358.82 defect;
- tax-exclusive misconfiguration;
- wrong list price, discount, non-INR, ±1 paisa;
- identification by frozen name;
- wrong, missing or other-rate GST share;
- invalid line rate;
- missing invoice, lines or purchase lookup;
- no line items;
- unreadable or unconfigured tax status with tax added on top;
- legitimate tax-exclusive plan;
- lines not summing;
- invoice/purchase mismatch;
- zero, over-total, negative, fractional and NaN charges;
- malformed currency;
- non-plan invoice consistency.

`checkout-charge-wiring.test.ts` runs the real `createOrReuseCheckoutSession` with mocked I/O. It covers:
- valid ₹1,999 creates exactly one order and attempt for 199,900;
- the defect never reaches the gateway and inserts nothing;
- unreadable purchase or payment history is blocked;
- a wrong-amount open order is not reused;
- an exact-amount open order is reused.

**Operational consequence:**
- While GST is not configured, Verified checkout works at ₹1,999.
- If GST is turned on before NW01 is approved and applied, Verified checkout is blocked rather than overcharging.
- Real payments were not enabled, and no prices or pricing data were changed.

**Before payments are switched on:**
- Set Verified's version `tax_status` explicitly to `tax_inclusive`.
- Approve NW01.
- Run the QA checkout cases in section 6.
- The checkout *preview* page still displays figures computed in SQL. It is display-only, but its wording should be checked once NW01 lands.

**Full suite after CC-14:**

| Check | Result |
|---|---|
| Vitest | 157 files, **2,720 passed** |
| `tsc --noEmit --incremental false` | Exit 0 |
| ESLint | 0 errors (the 18 existing `no-img-element` warnings) |
| `git diff --check` | Clean |

No dependency changes, so no audit was repeated. No `next build`: the change is a server library module, and typecheck passed.

## 6. Supabase QA validation plan (NOT executed; needs explicit authorization)

**Preconditions:**
- Written approval naming QA `ynwzijulzksmrcwdhudv` and the artifact hash.
- A fresh QA backup or snapshot.
- AI features paused, and `04` ready.
- A QA metadata preflight (read-only) showing:
  - owners and `search_path`;
  - `track_commit_timestamp`;
  - where pgcrypto lives;
  - default ACLs;
  - no `reserved` runs.
- Fictional QA accounts only: two counsellors, one independent admin, two fictional students registered in `nextwise_security.fictional_students` by a reviewed fixture script, which is to be written and approved. No real student records are read.
- Mock AI provider only. No OpenAI or Razorpay live keys.

**Connections:**
- PostgREST with real JWTs from signing in the fictional accounts, which tests the actual Supabase role mapping.
- Supavisor **transaction** pooler (6543) for the application-path load.
- **Session** pooler (5432) only for the observer and lock-holder sessions in barrier tests.

**Commit order:** if `track_commit_timestamp` is off on Supabase, ordering is established by construction:
1. A session-pooler connection takes `pg_advisory_xact_lock(hashtext('public.ai_generation_runs'))`.
2. The competing PostgREST requests are fired.
3. The observer confirms they are waiting (`pg_stat_activity.wait_event='advisory'`, `pg_blocking_pids`).
4. The holder releases in the intended order.

Never compare `now()` timestamps such as `withdrawn_at` or `created_at`.

| # | Case | Expected |
|---|---|---|
| 1 | Authorization through PostgREST: anon, student, unassigned counsellor, other admin, service-role key against reserve/complete/finalize/withdraw/link/v1/`record_system_audit_log`/`set_*_document_path` | Exactly the grant matrix in section 4; v1 and split linking denied for every role |
| 2 | Withdrawal committed first (barrier), then finalize | `consent_withdrawn`, no draft/version/report, cost floor kept |
| 3 | Finalize committed first, then withdraw | One draft/version/report; new reserve denied; retry `duplicate` |
| 4 | 20 concurrent finalize calls for one run through the transaction pooler | Exactly one `finalized`, the rest `duplicate`, one draft |
| 5 | 20 concurrent reserves with the same idempotency key, and with different keys for the same student | One run per key; one active run per student; limits respected |
| 6 | Case reassignment committed while finalize waits at the barrier | Denied; no content |
| 7 | Storage: webhook replay with valid HMAC; invalid HMAC; `set_*_document_path` with a non-canonical, missing or second path; authenticated JWT calling `set_*` | Idempotent on replay; all others rejected. Also confirm the `hmac()` resolution (F7) |
| 8 | Rollback: apply the artifact with a forced-failure line in a **QA branch database or a restored copy**, never the shared QA database without a separate approval | Catalog/data fingerprint unchanged (reuse the rehearsal's catalog query read-only) |
| 9 | Recovery: run `04_pause_ai_recovery.sql` after migration | Reserve closed; history, consent and drafts intact |
| 10 | Checkout (test mode only): Verified with GST off; Verified after setting GST on in QA | ₹1,999 order; then blocked with "not charged". No live payment |

Destructive steps (8, any fixture writes, setting GST in QA) each need explicit approval and a documented rollback: restore from the pre-test snapshot, or a fixture teardown script reviewed in advance.

## 7. Remaining findings

**P0 (blocking any shared-environment migration or production):**
1. A human independent security reviewer signs off on 01–03, the artifact and the checkout change. The AI review is done; human review is not.
2. Decision on and fix for **F1** (forgeable AI provenance) before any production AI enablement. QA with fictional data may proceed with F1 documented.
3. Authorization for the QA metadata preflight and the section 6 validation, then execution on QA.
4. Approve and apply NW01 (inclusive GST) in QA, set Verified to `tax_inclusive`, and re-run the checkout tests against QA in test mode. Until then the app guard blocks rather than overcharges.

**P1:**
- F3 (admin path/provider ID overwrite), F4 (approved version binding), F7 (legacy definer search_path and pgcrypto resolution).
- Private `signed-agreements` and `stamped-agreements` buckets (not created).
- Privacy and retention approval; real-student AI stays disabled.
- Trusted paid-model ceilings and a reconciliation workflow.

**P2:**
- F5, F9, F10.
- Whether every draft edit should keep serializing on the shared AI advisory lock (correct, but a throughput ceiling).

## 8. Commands for the next stage

**Local, any time (no shared environment):**

```powershell
cd C:\CodexBuilds\Nextwise-NW-F01
node scripts/security/assemble-nw09-2-atomic.mjs --check
npm.cmd test
npm.cmd run typecheck -- --incremental false
npm.cmd run lint
# Offline SQL: point to a temporary @electric-sql/pglite@0.5.15 package directory
$env:NW_SECURITY_PGLITE_PATH="<temp>\node_modules\@electric-sql\pglite"; node --test scripts/security/nw-f01-s3.offline.test.mjs
# Real PostgreSQL suites: a DISPOSABLE local PostgreSQL 16 started with -c track_commit_timestamp=on
$env:NW_SECURITY_PG_ADMIN_URL="postgres://postgres@localhost:54329/postgres"; $env:NW_SECURITY_PG_DISPOSABLE="1"
node --test scripts/security/nw-f01-s4.pg-concurrency.test.mjs
node --test scripts/security/nw-f01-s4.migration-rehearsal.test.mjs
```

**After explicit QA authorization only.** Run from a machine whose Supabase CLI is NOT linked to production. Never use `supabase db push` or `migration up`.

```sql
-- psql to the QA SESSION pooler, as postgres, after a fresh backup (\i is a psql command;
-- in the dashboard SQL editor, run the SET line and then paste the whole file in one execution):
-- 1. Read-only preflight
select current_database(), current_user, current_setting('track_commit_timestamp');
select extname, extnamespace::regnamespace from pg_extension where extname in ('pgcrypto','pg_trgm');
select count(*) from public.ai_generation_runs where status = 'reserved';   -- must be 0
-- 2. Apply (one transaction; any error rolls everything back)
set nextwise.nw09_2_atomic_approval = '<approval reference>';
\i supabase/migrations-proposed/nw-f01-s3/NW09_2_ATOMIC_01-03.sql
```

```bash
psql "<QA session-pooler URL from the dashboard, entered at runtime>" -v ON_ERROR_STOP=1 \
  -c "set nextwise.nw09_2_atomic_approval = '<approval reference>'" \
  -f supabase/migrations-proposed/nw-f01-s3/NW09_2_ATOMIC_01-03.sql
```

**Note:** with `-c` and `-f` in one psql call, psql runs both in the same session, so the opt-in persists. Never paste credentials into files or chat.

## 9. GO / NO-GO

- **NO-GO:** production deployment, a production migration, or applying the artifact to the shared QA database now.
  - Evidence: the human independent review has not happened; F1 (High) is open; no Supabase-level validation exists; NW01 is unapplied.
- **NO-GO:** enabling live payments.
  - Evidence: NW01 is unapplied and the QA checkout cases have not run. The guard only prevents wrong charges.
- **GO (conditional):** request authorization for the section 6 QA preflight and validation.
  - Evidence: the artifact passes local atomicity, forced-failure, grant, preservation and idempotency rehearsals (9/9); real multi-session concurrency passes (5×10/10, 0 deadlocks); the offline SQL suite passes 53/53; the full app suite passes 2,720/2,720 with typecheck and lint clean.
  - Conditions: fictional data and mock AI only, a fresh backup, F1 documented as open, and destructive steps approved individually.
