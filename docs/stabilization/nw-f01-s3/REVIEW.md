# NW-F01 Stage 4B-S3 / Stage 4B-S4 security review and QA preparation

Status: REVIEW ONLY. S4 atomic consent/finalization correction prepared for independent security review; NW09.2 is not authorized for migration. No SQL in this package was applied remotely. Stop after Stage 4B-S4; Stage 4C and NW-F02 are not authorized.

## Recovery and provenance

Recovered worktree C:\CodexBuilds\Nextwise-NW-F01 on stabilization/nw-f01 at 4f69c33be218e59433713ebe1fef22c857d25a67. All pre-existing changes were preserved, including supabase/.temp/cli-latest. Nothing was staged or committed.

Prior session: C:\Users\djdas\.codex\sessions\2026\11\07\rollout-2026-11-07T09-06-22-01a1b50b-5875-76e1-97ce-512cc16f7331.jsonl. Its last successful operation was the expanded 24-test offline SQL regression run (24 passed, 0 failed, 0 skipped), completed 2026-11-07 08:36:26 UTC. Before that it created the four proposed SQL files, coordinated application changes and tests, and passed 904 application tests plus TypeScript and targeted ESLint. The narrative handoff/runbook was absent at recovery.

The approved six-function definition query completed successfully at 08:24:29 UTC using supabase@3.0.0 db query --file <approved.sql> --read-only --remote=ynwzijulzksmrcwdhudv. UTF-8 query SHA256: 1B705B98E6BF32FDE6DF9F6CA2C8F2DF2694BA027C4762354BB14F5DB3837747. Existing local evidence is under C:\Users\djdas\AppData\Local\Temp\nw-f01-s3-3532a30d07334cb28ab94fe286900b34 (approved.sql, deployed-private.json, sanitized-comparison.json). No remote query was repeated in this continuation. Do not publish raw CLI output without reviewing it for secrets.

The adjacent deployed-comparison.json records all six deployed bodies matching their source: audit and signature setter in 0011; stamp setter in 0012; reserve, complete and link in NW09_ai_career_intelligence.sql. All six were SECURITY DEFINER with public search path. Body equality is not proof of effective ACL equality; prior Stage S2 permissions findings remain relevant. Other deployed function bodies were outside the approved query scope and were not fetched.

## Findings mapped to proposals

| Finding | Proposed correction / evidence | Review status |
|---|---|---|
| Anonymous/student audit forgery | 01_internal_rpcs.sql changes audit writer to SECURITY INVOKER, restricts effective executor to postgres/service_role and revokes all client grants | Offline role and accidental-grant tests pass |
| Document path tampering | 01 restricts setters to trusted executor, locks request, requires completed status, canonical agreement/request path, existing object, immutable capture | Offline denial/idempotency tests pass |
| Webhook compatibility | Verified provider event remains on session client; only successful verified processed captures use cookie-free service-role client | HMAC/replay SQL and mocked route tests pass |
| Legacy AI entry points | 02 replaces v1 reserve/complete with deny stubs and removes PUBLIC/anon/authenticated/service_role execution | Accidental service-role grant remains denied |
| Case and current-role checks | 02 rechecks role, assigned case and requester on reservation/completion/link; 03 removes former-author access after reassignment | Cross-case/demotion tests pass |
| Consent and trusted fictional identity | 02 adds staff-recorded consent, trusted expiring registry, shared advisory lock for reservation/withdrawal; no registry rows seeded | Ordinary students cannot write consent; withdrawal tests pass |
| Uncertain paid usage | Approved model reservation floor; no model seeded; failures/expiry retain greatest(reserved,estimated); all paid runs count | Budget/failure tests pass |
| Recommendation approval separation | 03 bars original author and every version contributor from approval | Independent reviewer test passes |
| Broad default ACLs and search path | Explicit role normalization and effective privilege checks; pg_catalog, public, pg_temp ordering | Broad-default offline fixture passes; actual schema CREATE rights still need review |
| Existing schema/history | Baseline/type checks, active reservation rejection, additive columns, no usage reset | Rerun/type drift tests pass; full QA schema drift remains unverified |

Legitimate audit callers found in source are apply_signature_webhook_event and apply_stamp_webhook_event, which run as their definer owner. This proposal requires that owner to be postgres. No ordinary student caller should write system audit records. Path setters are called by the two webhook routes after provider verification and upload; the new verified-document-path helper uses the existing server-only service client without user cookies/headers. Service-role compromise remains privileged compromise; these checks do not protect against stolen server credentials.

## Permission matrix (intended effective access)

PUBLIC means the PostgreSQL pseudo-role. None of the privileged functions below should inherit execution through PUBLIC.

| Operation | anon / ordinary student | Assigned current counsellor | admin / super_admin | service_role | postgres internal owner |
|---|---|---|---|---|---|
| System audit and path setters | Denied | Denied | Denied as authenticated | Execute, guarded | Execute |
| v1 AI reserve/complete | Denied | Denied | Denied | Denied | Deny stub |
| v2 AI reserve / consent record-withdraw | Denied | Case-scoped | Allowed | Denied | Owner privilege; user identity checks remain |
| v2 completion (failure/accounting only) / atomic finalization | Denied | Own request + current case | Own request + current role | Denied | User identity checks remain |
| Split AI draft linking | Denied | Denied | Denied | Denied | Deny stub |
| AI usage summary | Denied | Staff gate | Staff gate | Denied | Owner privilege |
| Consent/run SELECT | RLS-hidden | Case-scoped | Role-scoped | Trusted bypass, not app path | Owner |
| Recommendation approve | Denied | Existing reviewer role gate applies | Independent reviewer only | No new bypass | Owner |
| Private fictional/model registry | Denied | Denied | Denied via client | Denied | Separately approved maintenance only |

Inspect 03 for the complete recommendation/report grant normalization. These scoped changes do not certify the other 53 SECURITY DEFINER functions as safe.

## NW09.2 scope and preconditions

02_nw09_2_replacement.sql is the reviewed replacement candidate for NW09_2_openai_live_pilot.sql. Do not apply both. It adds the consent table; consent record, consent withdraw, v2 reserve, v2 complete and usage-summary RPC definitions; and ten optional columns: ai_usage_settings.paid_max_runs, paid_total_budget_usd, real_student_processing_approved, real_student_approval_reference, real_student_approved_at, real_student_approved_by; ai_generation_runs.consent_id, provider_response_id, cached_input_tokens, reasoning_tokens. S4 adds a sixth RPC, staff_finalize_ai_generation_run(uuid,uuid,uuid,jsonb,jsonb,jsonb), closes split linking, restricts v2 completion to failure/accounting, and adds a private content-guard trigger. It disables legacy entry points and adds two private control registries. No additional data columns are required by S4.

Before approval: confirm the exact QA target, backup/restore capability, baseline NW05/NW06/NW07/NW09 dependencies and definitions, owners, constraints/indexes/RLS/role inheritance/default privileges, public schema CREATE privileges, extension resolution, service-role table capabilities, and compatible existing optional objects. IF NOT EXISTS does not validate every existing table constraint or policy. Any extra remote inspection requires separately approved exact metadata SQL. No application-record inspection is authorized by this review.

Outstanding AI reservations must be drained/reconciled through a separately authorized operational procedure. Preserve all historical cost liability. Keep AI/provider features disabled and quiesce writes before migration planning. No fictional identities, paid model ceilings or real-student approvals are seeded. Privacy approval and trusted model ceiling covering maximum input, output, retries and pricing require separate decisions. Paid history may already contain uncertain liability; do not reduce totals to enable a pilot.

## Blocking review findings and limitations

1. S3 HIGH consent race: corrected locally in S4 by atomic finalization and coordinated withdrawal. See the S4 design and evidence below. This resolution is based on offline execution and source review; real multi-session blocking remains unverified.
2. Offline PGlite uses one connection and sequential transaction tests. It checks lock placement and both sequential outcomes; it does not prove multi-session blocking, deadlock freedom or simultaneous reservation behavior on Supabase PostgreSQL. A separately authorized disposable local PostgreSQL multi-session test must cover two concurrent reservations and withdrawal/finalization before approval. No live mutation test is authorized.
3. Webhook capture failures are acknowledged after status processing; duplicate events can skip recapture. Missing bucket/service configuration therefore needs an approved retry/reconciliation procedure before feature enablement. Keep verified status history; do not replay unverified provider payloads or relax immutable paths.
4. Deployed-versus-source evidence covers only six approved functions. Other baseline function/owner and schema drift assumptions are preconditions, not verified deployed facts.

Verdict: S4 package is prepared for independent review; NW09.2 is NOT yet migration-ready. Passing regression counts do not prove real PostgreSQL concurrency behavior.

## Storage and payment safeguards (review only)

Both signed-agreements and stamped-agreements must be private before enablement. Do not add bucket SQL to this package without separate review. Proposed access design: service-role server uploads only; no anonymous read/write; students may SELECT only their own agreement's captured object through agreement ownership; staff access must use current role and assigned case. Downloads use the logged-in RLS-scoped client and short-lived signed URLs. Explicitly deny client INSERT/UPDATE/DELETE and cross-agreement access. Audit existing storage.objects policies because permissive policies combine with OR. Check public=false, MIME/size limits, agreement/request prefix, provider download trust/size limits and orphan recovery. No bucket creation or policy mutation was performed.

Pricing remains a launch blocker: Nextwise Verified must charge INR 1,999 inclusive of applicable GST. Proposed fail-closed checkout: reject purchase before order creation when tax configuration is missing, invalid, contradictory or cannot establish the inclusive total. Decide tax rounding and invoice split through a separate pricing review. No payment code, pricing SQL or checkout behavior changed here.

## Safe future Development-QA sequence (requires separate authorization)

1. Independently review the S4 atomic correction and obtain real PostgreSQL multi-session evidence using the plan below. Review exact final SQL and application patch; approve metadata-only preflight separately if needed.
2. Obtain QA backup/restore point and record migration hashes/schema version. Explicitly verify QA project ynwzijulzksmrcwdhudv; never use a linked default or production target. Pause AI and document capture operations; drain in-flight work.
3. Prepare a reviewed single-transaction artifact containing 01, 02, 03 in order. Each current file has its own BEGIN/COMMIT: running them consecutively is NOT atomic. Remove only those outer transaction wrappers during reviewed assembly, retain checks/timeouts, wrap the whole unit in one BEGIN/COMMIT and test that exact artifact offline with injected failure. Do not include 04 recovery in forward application. Do not run the original NW09.2 file as well.
4. After separate approval only, apply the reviewed artifact explicitly to QA. No commands to apply are authorized by this document. Keep features disabled while verifying postconditions.
5. Postconditions: intended function identities, effective role grants, internal owners and search paths; consent RLS/no direct writes; legacy denial; ten column types; trusted registries empty until separately approved; no active orphan runs; historical ledger retained unchanged except explicitly authorized reconciliation. Verify from approved metadata and offline fixtures; record migration outcome. Storage policy readiness and pricing remain independent gates.
6. Deploying coordinated application code, enabling features and any live smoke test each remain outside this stage. Review schema/application compatibility and service-role QA-only configuration before requesting those actions.

## Data-preserving rollback and recovery

A failed single transaction rolls back all forward changes. If migration commits but application behavior fails, disable providers and captures first. Proposed 04_pause_ai_recovery.sql revokes new reservations while retaining failure completion, atomic finalization for existing authorized in-flight runs, withdrawal, consent evidence, reports and all cost history. It is review-only and not an automatic down migration. Existing in-flight completions require original requester/current-role authorization; otherwise reconcile by a separately approved operator procedure. Avoid reverting to vulnerable v1 RPCs or restoring broad grants. Forward-fix the hardened schema and compatible application; do not drop consent/ledger tables or reset budgets. Retain uploaded objects and immutable paths; investigate orphans without destructive cleanup. A restore requires separate approval and reconciliation of events/costs accrued since the restore point.

## Verification evidence

Recovered successful checks (not repeated):

- node node_modules/vitest/vitest.mjs run src/lib/storage src/lib/signatures src/lib/stamping src/lib/recommendations src/lib/career-intelligence src/lib/applications src/lib/ai --exclude '**/openai-live.test.ts': 39 files, 904 passed, 0 failed (08:34:59 UTC).
- node node_modules/typescript/bin/tsc --noEmit --incremental false; targeted ESLint on all changed application/test files and scripts/security/nw-f01-s3.offline.test.mjs: combined command exit 0, no diagnostics (08:35:21 UTC).
- NW_SECURITY_PGLITE_PATH=<temporary offline-engine/node_modules/@electric-sql/pglite>; node --test scripts/security/nw-f01-s3.offline.test.mjs: 24 passed, 0 failed/cancelled/skipped/todo (08:36:26 UTC), @electric-sql/pglite 0.5.15. Baseline migrations execute only inside the in-memory offline engine. No remote database, .env, payment or AI calls.

S3 continuation checks: read-only git diff --check passed (line-ending notices only). No source changes were made in that continuation, so passing checks were not repeated then. Earlier 2,645-test/full-build/dependency-audit results are historical baseline evidence. Current S4 execution results are recorded below. Dependencies did not change; no dependency audit/upgrade or build was repeated.

## S3 file inventory and handoff

Previously modified tracked: both src/app/api/webhooks/{signature,stamp}/route.ts; src/lib/career-intelligence/{service.ts,nw09-2-live-integration.test.ts}; src/lib/storage/{signed-documents.ts,stamped-documents.ts}; src/lib/supabase/admin/career-intelligence.ts; src/lib/supabase/service-role.ts; supabase/.temp/cli-latest.

Previously untracked: deployed-comparison.json in this directory; scripts/security/nw-f01-s3.offline.test.mjs; src/lib/storage/{document-filename.ts,verified-document-path.ts,nw-f01-s3-webhooks.test.ts}; supabase/migrations-proposed/nw-f01-s3/{01_internal_rpcs.sql,02_nw09_2_replacement.sql,03_review_separation_and_grants.sql,04_pause_ai_recovery.sql}.

New in the S3 continuation: this REVIEW.md only. No executable supabase/migrations files, package dependencies, payment/UI/Vercel configuration or other worktrees were changed. No remote access in continuation; no migrations, seeds, pushes, deployment or commits. That S3 handoff requested local atomic finalization; S4 implementation and the current next step follow.
## Stage 4B-S4 recovery and root cause

The S4 starting branch, HEAD, nine tracked modifications and ten untracked files matched the S3 handoff. Read AGENTS.md, Next.js 16.4.5 local data-security and server-actions guides, the existing SQL/application patches/tests, prior session tail (last successful operation at 08:36:26 UTC), and the saved definition comparison. No branch/worktree was recreated, no prior patch discarded, and no remote metadata query repeated. The six-definition evidence remains unchanged. cli-latest remains the prior v2.116.0 to v3.0.0 change.

Root cause: an application getConsent check and later staff_create_recommendation_draft call used separate transactions. Withdrawal could commit between them. Completion could reject the staff-only report while a draft/version containing generated output had already committed. TypeScript sequencing cannot make these RPCs atomic. The former link endpoint and success-capable v2 completion were also alternate persistence surfaces.

## S4 corrected transaction design

The application now sends success to ONE session-scoped staff_finalize_ai_generation_run RPC. It supplies the existing run, student, exact reservation consent, validated report/draft content and usage. No service-role client is used for AI. A missing RPC fails closed, with no compatibility fallback to generic draft creation. The guarded pilot adapter uses the same RPC but has not been executed.

Lock order for reservation, withdrawal and finalization starts with the existing transaction-scoped pg_advisory_xact_lock(hashtext('public.ai_generation_runs')). This organization-wide lock also serializes budget decisions. Finalization then locks the run FOR UPDATE, validates current role/case/requester and exact student/consent identity, and locks that consent FOR UPDATE. Withdrawal takes the same advisory lock before locking/updating consent. Generic content editing now takes the advisory lock before its draft row lock; the version guard reenters the lock before locking consent. The finalizer only creates a fresh draft and version; it never mutates an existing draft on retry. All locks last through the enclosing transaction's commit/rollback.

At normal READ COMMITTED isolation the protected reads occur after the advisory-lock wait. Higher-isolation serialization failures must abort safely and retry the database finalization for the same run, without another provider request. Real snapshot/wait behavior is an integration-test requirement, not established by PGlite.

Authorization occurs after acquiring the advisory lock: auth.uid must exist; current admin/super_admin or currently assigned counsellor must pass assert_staff_case; requester must equal auth.uid; supplied student and consent must match the reserved row. Report studentProfileRef and generation provider/model/dataClass must match that reservation; model and response evidence must agree with usage. The draft marker must be boolean true. No caller supplies a draft ID to finalization. Successful result status remains draft; no approval/release happens.

For an authorized reserved run, finalization first records failed accounting without content, retaining the greatest of reserved cost, prior estimated cost and reported cost. It copies only explicit usage fields. It then checks the exact reserved consent's active state and student/scope. New consent cannot authorize an older withdrawn run. If consent is absent/withdrawn it returns consent_withdrawn, leaves no new content and commits an outcome audit plus usage. Unauthorized callers cannot alter accounting; the original reservation liability remains for authorized reconciliation.

With active consent, a PL/pgSQL subtransaction creates the draft, binds and completes the run/report, inserts version 1, sets current_version_id and writes the success audit. They all commit together. Any content/constraint/trigger/audit failure rolls back that entire content subtransaction, leaves failed usage accounting and writes a generic failure audit. SQLERRM and report/prompt/provider bodies are never copied into failure reasons or logs. If even the failure audit or the outer transaction fails, all RPC writes roll back and the original reserved liability remains. Data is not deleted or refunded.

### Serialization policy and external provider boundary

- Withdrawal wins: it commits before finalization obtains the lock. Finalization records usage/failure, returns consent_withdrawn and creates no report, draft or version.
- Finalization wins: it commits all content and audit while its original consent is active. Later withdrawal preserves the valid historical report and ledger, prevents further reservations under that consent and prevents new AI-labelled versions. Withdrawal is prospective; it is not erasure of previously authorized output.
- Provider requests occur outside the transaction and cannot be recalled. A withdrawal while a paid call is in flight cannot unsend those bytes. Its output is discarded by finalization if withdrawal won; incurred/uncertain cost remains counted. A reservation is the authorization point for starting that external operation; finalization is the authorization point for persisting its result.
- An authorization change while the provider runs blocks finalization on its current role/case recheck. Its cost floor remains reserved if that caller can no longer update the ledger; a separately approved reconciliation procedure is required.

### Retry, rollback and bypass protection

The run ID is the finalization idempotency key. A succeeded linked run returns duplicate with the existing draft ID, after rechecking current requester/case and identity. It does not rewrite content, cost or audit. This remains true if withdrawal occurred after the original successful commit. A previously failed finalization returns its prior failed/consent outcome without creating content. Non-reserved terminal runs cannot be turned into success. An unknown transport/commit result is surfaced as unconfirmed: the application performs no fallback completion write and never retries the provider. Reconcile or retry finalization using the same run ID and available in-memory result; do not persist rejected content in a local retry spool. If output is lost and the run is still reserved, reconcile usage without recreating output automatically.

v2 completion now accepts only failure/accounting with report=null; SQL rejects successful/report-bearing calls and TypeScript narrows that contract. The old split link function has no client grants and an always-denying body, including under accidental regrant. Legacy v1 deny stubs remain. Direct INSERT/UPDATE/DELETE/TRUNCATE/TRIGGER privileges on draft/version/run tables are removed for PUBLIC/anon/authenticated/service_role; effective table and column write privileges are checked so inherited or column grants fail migration preflight/postconditions rather than silently bypass protection.

The private version trigger requires AI-labelled content to have a successful run bound to this draft, valid matching consent and current staff/case access. A generic NW07 create cannot establish that binding, so its attempted AI version causes the entire create RPC to roll back. Promotion of an unbound manual draft to AI is rejected. AI marker removal and non-boolean markers are rejected. Existing manual non-AI drafting remains authorized through its NW07 case/role checks. The database cannot infer AI provenance from arbitrary unlabelled human-entered free text; there is no automated AI fallback into that manual path. This trust boundary must remain explicit in independent review.

Historical rows are not changed or reclassified. Existing reports remain readable under existing role/RLS and human review/release rules. Conservatively, a historical AI draft without a valid linked consent cannot acquire new AI-labelled versions; do not invent retrospective consent. Decide any legacy-edit recovery through separate review. Human approval/release of existing content is separate from new AI processing and remains subject to independent recommendation approval; privacy review must accept this prospective withdrawal/retention policy before real-data enablement.

## S4 files changed

| File | Purpose |
|---|---|
| supabase/migrations-proposed/nw-f01-s3/02_nw09_2_replacement.sql | Atomic finalizer, accounting-only v2 completion, closed split linking, normalized grants |
| supabase/migrations-proposed/nw-f01-s3/03_review_separation_and_grants.sql | Lock before generic editing; private version/provenance guard; effective direct-write denial; retain link closure |
| src/lib/career-intelligence/service.ts | One success RPC; no app consent recheck as authorization, no split/fallback success writes; typed outcomes |
| src/lib/supabase/admin/career-intelligence.ts | Session-scoped atomic RPC mapping; fail closed on missing/unknown/error response; no raw diagnostics |
| src/types/database.ts | Typed atomic RPC contract |
| scripts/dev/nw09-openai-pilot.ts | Coordinate the existing guarded pilot gateway; no script/live operation executed |
| src/lib/career-intelligence/career-intelligence.test.ts | Replace split-success assertions with one atomic operation; preserve failure and authorization assertions |
| src/lib/career-intelligence/nw09-2-live-integration.test.ts | Atomic usage/consent/unknown-commit/duplicate assertions; static app/pilot RPC parity |
| src/lib/career-intelligence/atomic-finalization-gateway.test.ts | NEW: mocked RPC contract, missing object, unknown result and secret-safe error behavior |
| scripts/security/nw-f01-s3.offline.test.mjs | Preserve all 24 S3 tests; add S4 SQL authorization, rollback, accounting, idempotency and bypass cases |
| docs/stabilization/nw-f01-s3/REVIEW.md | Update this existing runbook, policy and future verification plan |

01_internal_rpcs.sql, 04_pause_ai_recovery.sql, deployed-comparison.json, webhook/storage patches and cli-latest were preserved. No normal supabase/migrations files or dependency/lock files were changed. Nothing is staged or committed.

## S4 verification (2026-11-07)

- Focused application: node node_modules/vitest/vitest.mjs run src/lib/career-intelligence src/lib/storage src/lib/recommendations: 15 files, 292 passed, 0 failed, no skipped tests (19:12:42 local).
- Full offline regression: npm.cmd test: 155 files, 2,682 passed, 0 failed, no skipped tests (19:13:52 local). The file named openai-live.test.ts was inspected and is itself network-free with injected SDK clients; it was included in this full run. No live API operations occurred.
- TypeScript: npm.cmd run typecheck -- --incremental false: exit 0, no errors.
- Full lint: npm.cmd run lint: exit 0, 0 errors, 18 existing no-img-element warnings in untouched UI files. No UI changes were made to silence them.
- Offline SQL command: set NW_SECURITY_PGLITE_PATH to the existing temporary offline-engine/node_modules/@electric-sql/pglite; node --test scripts/security/nw-f01-s3.offline.test.mjs. Result (re-executed in CC-13 on the recovered tree): 51 tests, 51 passed, 0 failed, 0 skipped. See the CC-13 continuation at the end of this runbook.
- git diff --check: exit 0; only LF/CRLF notices. No dependency files changed, so no dependency audit/upgrade was repeated. No build or remote test was run.

Initial focused failures exposed SQL delimiter generation and old gateway fixtures; these were corrected without skipping or weakening denials. A discriminated-union TypeScript error was corrected before the successful full checks. Original S3 denial tests still execute. New tests exercise both ordered consent outcomes, withdrawal rollback, queued duplicate calls, current-role/case/requester and student/consent/report mismatches, missing/replaced consent, provider uncertainty and cost floors, failure after content insertion and after success audit, outer rollback, direct writes, generic creation/promotion and provenance tampering, missing RPC and unknown commit status.

PGlite tests are one connection with sequential transactions/savepoints. Promise.all requests are queued by that engine; they do NOT establish simultaneous PostgreSQL transaction behavior. Offline counts prove local outcome/rollback/ACL behavior under the fixture, not deployed Supabase roles, isolation, connection-pool behavior or live authorization.

## Deterministic multi-session PostgreSQL plan (executed on disposable LOCAL PostgreSQL 16 in CC-13; Development-QA execution still NOT authorized or executed)

Requires separate authorization and a disposable PostgreSQL environment, followed by specifically authorized QA verification on ynwzijulzksmrcwdhudv. Never use production, real application records, a provider call, or payment operations. Use synthetic adult students, two counsellors, one independent admin, fixture consent and mock generation. The reviewed schema/artifact and scoped fixture setup/teardown SQL need approval before remote writes. Use existing PostgreSQL tooling only after that authorization; no integration runner or fixture was executed in S4.

Use dedicated sessions A and B plus read-only observer O. Bind parameters for the six-argument finalization RPC and two-argument withdrawal RPC. Use explicit BEGIN/COMMIT/ROLLBACK, SET LOCAL ROLE authenticated and transaction-local request.jwt.claim.sub for the intended fixture user in the disposable test harness. Test actual QA authenticated JWT/PostgREST grants separately; SET ROLE is only a database-harness approximation. Record pg_backend_pid for each session; set bounded statement/lock timeouts and fail on unexpected timeout. Avoid sleep-based ordering: the observer must confirm B's pg_blocking_pids contains A and that the waiter is waiting on an advisory lock before A releases it. Use separate committed fixture runs for each case, unique idempotency keys and baseline row/audit counts.

| Case | Session A | Session B and barrier | Required committed postcondition |
|---|---|---|---|
| Withdrawal wins | BEGIN; call withdrawal; hold transaction | BEGIN; call finalization for original run; O confirms B blocked by A; A COMMIT, then B completes and COMMIT | B returns consent_withdrawn; failed usage/cost and outcome audit retained; zero new drafts/versions/reports |
| Finalization wins | BEGIN; call finalization; hold successful transaction | BEGIN; call withdrawal; O confirms blocked; A COMMIT, B completes/COMMIT | One linked report/draft/version/success audit; consent withdrawn; a new reservation denied |
| Duplicate finalization | BEGIN; finalize run; hold | BEGIN; finalize same run; O confirms blocked; A COMMIT, B completes/COMMIT | One finalized response, one duplicate with same ID; one version and success audit; unchanged cost |
| Withdrawal aborts | BEGIN; withdraw, hold | B finalizes and blocks; O barrier, then A ROLLBACK | B may finalize once against still-active consent |
| Finalization aborts | BEGIN; finalize, hold | B withdraws and blocks; O barrier, then A ROLLBACK | B commits withdrawal; original run reserved with cost liability; a later finalization cannot persist output |
| Parallel reservations | BEGIN; reserve for fixture student, hold | B reserves same student or competing global-budget request; O barrier then A COMMIT | One active student run and limits/cost caps not exceeded; no duplicate provider work |
| Different requester / reassignment / demotion | Commit fixture role or assignment change before B starts or unblocks | B finalizes (also test retry of an already finalized run) | Denied with no new content or budget release; current role/case rechecked |
| Late content/audit failure | Approved disposable-only fault fixture fails the version/success audit insert | Finalize and commit allowed failure outcome | No partial content; failed accounting and generic failure audit; no sensitive diagnostic text |
| Higher isolation | Establish snapshot before competing transaction under REPEATABLE READ/SERIALIZABLE | Repeat withdrawal/finalization barrier cases | Serialization failure or correct ordered result, never stale-consent persistence; rollback then retry only the database RPC |

Also verify actual anon/student/unassigned/service-role finalization denial, requester-only retry, student/report/consent mismatches, generic AI draft creation/promotion denial, table AND column write grants, provider timeout liability, expired runs, and migration postconditions. For an unknown response simulate dropping the client response after COMMIT, reconnect and retry the same finalization: existing IDs only, no new content/audit/cost. Snapshot existing synthetic history before migration and compare after both forward application and pause recovery; never truncate or delete usage history to pass tests. Record evidence without raw generated content or credentials.

Concurrent role/assignment changes must be tested explicitly. The shared lock serializes AI/consent operations; it does not serialize every unrelated admin mutation. Current authorization is checked inside finalization, but exact MVCC ordering against role/case revocation and configured transaction isolation still needs integration evidence. Resolve any deviation by aborting/failing closed and reviewing a consistent authorization-lock protocol; do not weaken access checks.

## S4 migration and recovery gates

The existing three forward files must be assembled/reviewed/tested as ONE outer transaction with their individual outer wrappers removed; do not execute 02 without 03's content guard/ACL hardening. Do not also apply the original NW09.2 proposed file. No assembly was remotely executed. Explicit QA identity, backups, owner/search-path/schema/default-grant/column-grant checks, no active reservations, feature pause and compatibility preconditions above still apply. RPCs and private guard functions must be owned by the reviewed postgres owner; schema ownership/CREATE rights remain an approved metadata-preflight check. Paid-model registry and real-student approval remain unseeded/disabled.

Coordinate application rollout with the new schema; the old app success sequence intentionally fails after this SQL closes split success/linking. Keep processing disabled until the matching application is separately approved/deployed and metadata/postcondition checks pass. Authorization for this task is local preparation only.

04_pause_ai_recovery.sql still stops new reservations and preserves ledger/consent/content. Existing authorized in-flight finalization and failure accounting may drain under the hardened protocol. If finalization itself is implicated, separately review pausing its execution as well; do not restore vulnerable split RPCs or broad grants. Rollback a failed forward transaction atomically; after a committed migration, prefer a reviewed forward fix. Preserve consent evidence, provider response identifiers, historical reports, immutable version history, audit and all cost floors. Never spool rejected report content to files/logs, reclassify real accounts as fictional, delete history or lower budgets to recover operation. Restoring a backup or reconciling orphan/uncertain usage remains a separate approved operation.

Remaining blockers: independent security review; real multi-session evidence and actual QA isolation/ACL/schema validation; exact atomic artifact and recovery rehearsal; approved privacy/retention and legacy-edit policy; trusted model ceilings and reconciliation workflow; private buckets/webhook capture recovery; separate GST-inclusive pricing correction. No real-student AI processing was enabled.

Current next safe action: independent review of the S4 diff and this deterministic plan, then authorization for disposable PostgreSQL multi-session verification and narrowly scoped QA metadata preflight. This is not QA migration approval. Stop at Stage 4B-S4.

## CC-13 continuation: Claude engineering handover (2026-11-07)

Execution environment: the Windows worktree C:\CodexBuilds\Nextwise-NW-F01 was reached read-only through the linked-computer file bridge. No shell ran on that computer. For verification, HEAD 4f69c33be218e59433713ebe1fef22c857d25a67 was rebuilt in an isolated scratch copy from the repository's own Git objects. All 1,464 index blobs matched after CRLF normalisation. Codex's uncommitted files were then overlaid. GitHub was not used as a source for the uncommitted work. No commit, stash, reset, clean, push, deploy, migration, remote database access or production access occurred. supabase/.temp/cli-latest was left untouched.

### Recovered state inventory

- Branch stabilization/nw-f01, HEAD 4f69c33 ("fix: patch NW-F01 security dependencies"). Nothing was staged.
- 12 modified tracked files:
  - supabase/.temp/cli-latest (preserved)
  - scripts/dev/nw09-openai-pilot.ts
  - both webhook routes
  - career-intelligence service.ts and its two tests
  - signed-documents.ts and stamped-documents.ts
  - service-role.ts
  - admin/career-intelligence.ts
  - src/types/database.ts (CRLF)
- Untracked files:
  - this REVIEW.md
  - deployed-comparison.json
  - the offline SQL suite
  - the atomic-finalization gateway test
  - document-filename.ts, verified-document-path.ts and the webhook tests
  - proposed SQL 01-04
  - the generated next-env.d.ts
- Status by finding:
  - A, B, C and D: implemented by Codex.
  - S4 atomic finalization: implemented by Codex.
  - Real PostgreSQL concurrency evidence: missing. Added in CC-13.
  - Offline SQL result in this runbook: missing. Added in CC-13.
  - QA migration: not started, and not authorized.

### CC-13 review conclusions (source review, not a substitute for independent review)

- **A. record_system_audit_log.** The function is SECURITY INVOKER. Execute is granted only to the postgres owner path and service_role, and the body rejects other callers even after an accidental grant. No application TypeScript calls it directly. Its only callers are the SECURITY DEFINER webhook appliers in SQL.
- **B. set_signature_document_path / set_stamp_document_path.** Execute is limited to service_role. The only application caller is src/lib/storage/verified-document-path.ts, which uses the service-role client and never forwards request cookies or Authorization headers. The webhook routes call it only after both checks pass: the application HMAC check (provider.verifyWebhook) and the database HMAC re-verification (apply_*_webhook_event). The SQL then independently requires:
  - the canonical agreement/request/object path;
  - an existing private-bucket object;
  - an immutable path binding, so a replay is idempotent and tampering is rejected.

  A provider request ID alone grants nothing: anon and authenticated are denied, and service_role still needs a matching canonical, existing object.
- **C. Legacy v1 AI RPCs.** The v1 reserve and complete RPCs and split linking are replaced by deny stubs. Execute is revoked from PUBLIC, anon, authenticated and service_role, and the bodies refuse even after an accidental grant. No trusted service-role access to v1 is required. The application and the dev pilot script call only the v2 reserve and complete RPCs and the finalizer, all as authenticated staff.
- **D. Review separation.** The author and every version contributor are barred from approving. An independent reviewer succeeds, and case reassignment removes the former author's mutation rights.
- **Lock order.** The order is the shared advisory lock, then run FOR UPDATE, then consent FOR UPDATE. Draft rows are locked advisory-first in content update. The NW07 lifecycle RPCs (submit, review, release, withdraw, archive) lock only the draft row and never insert versions, so they never wait for the advisory lock while holding a draft. The guard trigger re-enters the advisory lock already held by its caller. Source review therefore found no lock-order cycle, and the multi-session evidence below confirms none occurred.

### Real multi-session PostgreSQL evidence (disposable LOCAL server, not Supabase QA)

New file: scripts/security/nw-f01-s4.pg-concurrency.test.mjs.

**Safety design:**
- It refuses any non-loopback host and requires NW_SECURITY_PG_DISPOSABLE=1.
- It creates and drops its own nw_f01_s4_concurrency_<pid> database.
- It requires track_commit_timestamp=on.
- It reads no .env file or credentials.
- It loads the same baseline, NW05/06/07/09 and 01-03 files and fixture shape as the offline suite.

**Environment:** PostgreSQL 16.15, READ COMMITTED default, deadlock_timeout=200ms. Every waiter is proven blocked by the holder through pg_blocking_pids before the holder commits or rolls back, so ordering does not depend on sleeps.

**Command:** NW_SECURITY_PG_ADMIN_URL=postgres://postgres@localhost:<port>/postgres NW_SECURITY_PG_DISPOSABLE=1 node --test scripts/security/nw-f01-s4.pg-concurrency.test.mjs

| Case | Observed result |
|---|---|
| Withdrawal commits first, finalizer waiting | consent_withdrawn; 0 drafts, versions or reports; run failed with cost 0.4 and provider response ID retained (Invariants 1 and 5) |
| Finalization commits first, withdrawal waiting | One draft, version and report; withdrawal commits; a new reservation is denied; retry returns duplicate (Invariant 2) |
| Withdrawal rolls back | The waiting finalizer finalizes once |
| Duplicate finalization in two sessions | finalized plus duplicate with the same draft_id; exactly one draft, version and report (Invariant 4) |
| First finalizer aborts, retry waiting | The retry finalizes exactly once (Invariant 3) |
| Finalization aborts, withdrawal waiting | The withdrawal commits; the run stays reserved with its 0.4 liability; a later finalization returns consent_withdrawn with no content (Invariants 3 and 5) |
| Reassignment commits while the finalizer waits on the lock | Denied ("Not authorized"), no content. The authorization recheck uses a post-lock snapshot |
| REPEATABLE READ finalizer racing a withdrawal | SQLSTATE 40001, rolled back, no content; a retry returns consent_withdrawn. Fails safe |
| Parallel reservations with the same idempotency key | One run; the second session receives the same run_id |
| Mixed workload: 8 sessions x 40 operations | No deadlock (40P01) and no unexpected error. No AI version committed after the withdrawal commit (commit timestamps); no AI-labelled version without a succeeded run; no run left reserved |

**Mixed workload contents:**
- reserve and finalize, mock and paid;
- manual and AI content updates;
- simulated lifecycle draft FOR UPDATE locks;
- one withdrawal mid-run.

**Repetition:**
- First 8-test version: 20 consecutive runs, all passed. Totals: 481 finalizations, 950 AI-labelled updates and 1,280 lifecycle-lock operations interleaved.
- Final 10-test version: 10 consecutive runs, all passed.
- The server log shows 0 "deadlock detected" entries.

**Limitations:** this is real PostgreSQL multi-session behaviour, but it is NOT Supabase:
- Roles are approximated with SET ROLE and request.jwt.claim.sub, not PostgREST JWTs.
- There is no Supavisor/pgbouncer pooling and no Supabase-managed owners or grants.
- It used the fixture schema, not the QA catalogue.

Development-QA execution of the plan above remains a separate authorization.

**Interpretation note:** use commit order, not now() timestamps. withdrawn_at and version created_at both use now() (transaction start). A transaction that began earlier can therefore commit later under lock queueing. The suite checks Invariants 1 and 2 with pg_xact_commit_timestamp. Any QA evidence query should do the same, or should compare lock acquisition, not now() values.

### CC-13 verification (scratch copy of the recovered tree, Linux, Node)

| Check | Result |
|---|---|
| Vitest, full suite (npm test equivalent) | 155 files, 2,682 passed, 0 failed |
| tsc --noEmit --incremental false | Exit 0 |
| ESLint, full | 0 errors, 18 existing no-img-element warnings |
| ESLint, new concurrency suite | Clean |
| Offline SQL (PGlite 0.5.15) | 51/51 passed |
| Local PostgreSQL 16 multi-session | 10/10 passed in each of 10 consecutive runs (earlier 8-test version: 20 of 20 runs) |
| git diff --check | Exit 0 |

No dependency files changed, so no audit or upgrade was repeated. No build was needed: no application code changed in CC-13.

### CC-13 changes

- Added scripts/security/nw-f01-s4.pg-concurrency.test.mjs. It is not part of npm test, because it needs a disposable local server.
- Updated this REVIEW.md.
- No SQL, application or test files written by Codex were modified. No duplicate fixes were made.

### Remaining blockers before any QA migration approval

- **P0.** Independent security review of 01-03 and the application diff.
- **P0.** Assemble 01+02+03 into ONE reviewed outer-transaction artifact, with the inner BEGIN/COMMIT removed. Rehearse it with injected failure on a disposable database. The original NW09.2 proposed file must not also be applied.
- **P0.** Narrowly authorized QA metadata preflight: owners, search_path, default and column grants, no active reservations, compatibility. Then run the multi-session plan on QA with real PostgREST JWTs.
- **P0, payment.** Nextwise Verified must cost exactly INR 1,999 inclusive of applicable GST. Missing or invalid pricing or tax configuration must fail closed at checkout, with no silent tax-exclusive fallback. No pricing SQL or price change was made in this sprint.
- **P1.** Create private buckets signed-agreements and stamped-agreements in QA and production. They were not created remotely here. Define the webhook capture-recovery runbook.
- **P1.** Approved privacy and retention policy, and the legacy-edit policy for AI drafts. Real-student AI processing stays disabled.
- **P1.** Trusted paid-model cost ceilings (registry seeding) and a reconciliation workflow for uncertain provider usage.
- **P2.** Use pg_xact_commit_timestamp or lock-order evidence in QA invariant queries. Decide whether every draft mutation should stay globally serialized by the shared advisory lock: correct, but a throughput ceiling at scale.

Verdict: findings A-D and atomic finalization are implemented and have offline evidence plus local real-PostgreSQL concurrency evidence. NW09.2 remains NOT migration-ready until the P0 items above are complete. Stop at CC-13. CC-14 has not been started.
