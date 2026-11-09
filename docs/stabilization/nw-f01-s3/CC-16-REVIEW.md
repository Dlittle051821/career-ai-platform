# CC-16: Launch security and QA readiness (NW-F01)

Date: 2026-11-07 (Europe/Berlin). Prepared by Claude. Local preparation only.

Nothing remote was touched:
- No SQL was applied anywhere.
- No Supabase, Vercel or Razorpay configuration was changed.
- No deployment, commit, push or merge was made.
- No production secrets or student records were accessed.
- Real-student AI and payments stay disabled.

## A. Recovered state

| Check | Result |
|---|---|
| Worktree | `C:\ClaudeBuilds\CC15-INSTALL-TARGET` (gitdir `C:/carrier.ai/.git/worktrees/CC15-INSTALL-TARGET`) |
| Branch / HEAD | `cc15-security-install` at `4f69c33be218e59433713ebe1fef22c857d25a67` |
| Index | 1,464 entries, identical paths and blobs to `4f69c33`; nothing staged |
| CC-15 files | All 37 installed files equal the CC-15 package (line-ending-normalized SHA-256) |

How this was checked: through the linked-computer file bridge, read-only. There is no shell on the PC, so the checks and builds below ran on a byte-identical Linux copy of this tree.

## B. Production build

`next build` (Next.js 16.4.5, Turbopack) result:
- **exit 0**, compiled successfully;
- **97/97** static pages generated;
- no errors.

It ran before and after the CC-16 changes, with placeholder public variables only: an invalid Supabase URL, a placeholder key and a localhost app URL. No real secrets were used.

**Not yet confirmed:** a Windows build on the PC, and a build with the real QA environment.

## C. F1: trust boundary for AI finalization (implemented locally)

**Problem.** `staff_finalize_ai_generation_run` was executable by `authenticated`. An assigned counsellor could reserve a run and call it directly with made-up report, draft content and a fake `providerResponseId`. The result was a draft labelled "AI-assisted" and a succeeded OpenAI ledger row.

**Trust model (implemented).**
- Only the trusted server identity (Supabase `service_role`) may submit AI results.
- The server binds the call to the staff user it authenticated from that user's own session.

| Concern | How it is handled |
|---|---|
| Direct client RPC | `public.staff_finalize_ai_generation_run(p_requester_user_id, run, student, consent, report, content, usage)` is granted to `service_role` only. The body also refuses unless `current_setting('role') = 'service_role'`, so an accidental grant is still refused. The old 6-argument signature is dropped. The implementation moved to `nextwise_security.finalize_ai_generation_run_impl`, which no role can execute directly. |
| Requester identity | The app passes `getCurrentAdmin().userId` from the session, never client input. The wrapper requires the user to exist and binds `auth.uid()` to that user for this call only, then restores the previous value. All existing checks then run against the real staff user: current role, case access, run ownership (`requested_by`), student/consent identity, and the content guard trigger. |
| Case verification | Unchanged `assert_staff_case`, rechecked after the lock (multi-session test: reassignment while waiting is refused). |
| Provider provenance | Only server code that made the provider call can submit a result. Clients can no longer assert AI provenance. The provider response ID is still not verified with OpenAI itself (P2: optional server-side retrieve check). |
| Idempotency | Unchanged: the run ID is the key; a retry returns `duplicate` with the same draft. |
| Consent / withdrawal serialization | Unchanged lock order: advisory lock, then run, then consent. All 10 real multi-session tests pass with the new path. |
| Usage accounting | Unchanged conservative floors. `reserveRun` now refuses before any provider call when the service-role key is not configured, so tokens are never spent on a result that could not be saved. |

**Trade-offs.**
- The service-role key becomes required for AI generation on any environment that enables it.
- Anyone holding that key can finalize on behalf of any staff user. The key is already fully trusted (it bypasses RLS), so it must stay server-only and per-environment.
- The `auth.uid()` binding relies on Supabase's `auth.uid()` reading `request.jwt.claim.sub` first. This is verified locally; **it must be confirmed on QA** (preflight query in F). If the QA definition differs, the wrapper fails closed with "Requester binding failed".

**Files:**
- `02_nw09_2_replacement.sql` (and the regenerated `NW09_2_ATOMIC_01-03.sql`, drift-checked);
- `src/lib/supabase/admin/career-intelligence.ts`;
- `src/lib/supabase/service-role.ts` (documented scope);
- `src/types/database.ts`;
- `scripts/dev/nw09-openai-pilot.ts` (now finalizes with the service client on the counsellor's behalf);
- tests (H).

**Approval needed:** the trust model above, and human security sign-off.

## D. Razorpay captured-amount integrity

**Findings, with the CC-15 file 05 applied:**
- `verify_checkout_payment` checks the HMAC of `order_id|payment_id` and that the order belongs to the attempt, then records an **authorized** transaction at the attempt amount. Authorized transactions never count toward "paid".
- **Gap (confirmed):** `apply_webhook_event` (0016) matched `payment.captured` to an attempt by order id and recorded it without comparing the gateway's `amount`/`currency` with the attempt. On conflict with the authorized row it kept the attempt amount. A capture for a different amount could therefore mark an invoice paid.

**Fix:** new `06_payment_capture_reconciliation.sql` (PROPOSED). It is the 0016 function unchanged except:
- `payment.authorized` and `payment.captured` are applied only if the payload amount equals `payment_attempts.amount_minor_units`, the payload currency equals the attempt currency, and that currency equals the invoice currency;
- otherwise the event is stored as `failed` with a diagnostic, and **nothing** changes in transactions, attempts or invoice status. Finance reconciles (refunds) from the admin webhook-events view;
- search_path is pinned;
- grants are unchanged;
- it requires 05 to be applied first.

**What 05 + 06 cover together:**
- The order id is unique per attempt.
- Student attempts must be for exactly the amount due on their own payable invoice.
- Verified attempts are exactly 199,900 INR.
- Gateway capture must equal the attempt.

**Partial payments:** the existing schema allows `partially_paid` when captures are below the total. Since 05, each student attempt equals the full amount still due, so partial payments arise only from admin-created attempts or manual records. That is preserved; whether students may ever pay in parts is a business decision (not enabled).

**Remaining:**
- A student can still create an attempt with an invented order id for their own invoice. This only blocks their own checkout (N4, P2). The fix is server-created attempts.
- Order notes are not cross-checked (the payment payload does not carry order notes).

## E. ₹1,999 GST-inclusive validation matrix

| # | Scenario | Live SQL today (`purchase_pricing_plan`, 0008) | With NW01 applied | App guard (CC-14/15) | DB 05/06 | Expected outcome |
|---|---|---|---|---|---|---|
| 1 | GST not configured, Verified `tax_status` any | Invoice ₹1,999, tax 0 | Same | Pass | Attempt 199,900 OK; capture must be 199,900 | **Charge ₹1,999** |
| 2 | GST 18% on, Verified `unconfigured` | **₹2,358.82** (tax added) | ₹1,999, tax ₹304.93 inclusive | Blocked: `verified_price_mismatch` | Attempt ≠ 199,900 refused | No charge until NW01 is applied |
| 3 | GST 18% on, `tax_inclusive` | ₹2,358.82 (ignores `tax_status`) | ₹1,999, tax ₹304.93 | Blocked today; passes with NW01 | Same | ₹1,999 only after NW01 |
| 4 | GST on, Verified `tax_exclusive` (misconfiguration) | ₹2,358.82 | ₹2,358.82 | Blocked: `invalid_tax_configuration` | Refused | No charge; fix config |
| 5 | Missing or invalid `billing_settings` rate (`gst_registered` without GSTIN) | Treated as no GST: ₹1,999 | Same | Pass (no tax line) | Pass | ₹1,999. Not GST-registered means no GST applies |
| 6 | Invoice line tax share wrong or line rate missing | — | — | Blocked: `invalid_tax_configuration` | — | No charge |
| 7 | Any discount or offer on Verified | Discounted total | Discounted total | Blocked: `verified_price_mismatch` | Attempt ≠ 199,900 refused | No charge. Offers on Verified need a business decision |
| 8 | Invoice total ≠ line totals, or ≠ purchase record | — | — | Blocked | — | No charge |
| 9 | Gateway order amount ≠ attempt (stale or reused order) | — | — | Reuse refused unless amount = due | Unique order id; 06 capture mismatch → failed | No paid status |
| 10 | Duplicate payment / webhook redelivery | — | — | One active attempt per invoice | Fingerprint idempotency; unique `provider_payment_id` | Recorded once |
| 11 | Partial Verified charge | — | — | Blocked: charge must be 199,900 | Attempt must be 199,900 | No partial charge |
| 12 | Plan unidentifiable (inactive or renamed) | — | — | Blocked: `missing_configuration`, unless identified as Verified by frozen name | Verified detection is definer-side (slug or frozen name) | No charge |
| 13 | Non-INR currency | — | — | Blocked for Verified | Blocked for Verified | No charge |

**QA test-mode procedure (needs approval):**
1. Run row 1 with GST off.
2. Set GST on in QA and confirm row 2 is blocked.
3. Apply NW01 to QA, set Verified to `tax_inclusive`, and confirm row 3 shows ₹1,999 with tax ₹304.93.
4. Rows 9–11 with Razorpay **test** keys and forged test webhooks.

Never use live keys.

## F. QA migration readiness and exact order (QA `ynwzijulzksmrcwdhudv` only)

QA already has baseline 0001–0022 and NW05/NW06/NW07/NW09, applied earlier in this programme.

**Order:**
1. Fresh QA backup (dashboard).
2. Read-only preflight (below).
3. `NW09_2_ATOMIC_01-03.sql`: one transaction. Requires `set nextwise.nw09_2_atomic_approval = '<ref>'`.
4. `05_payment_attempt_integrity.sql`: one transaction.
5. `06_payment_capture_reconciliation.sql`: one transaction; refuses without 05.
6. Separately approved: `NW01_fix_purchase_pricing_plan_tax_handling.sql` (pricing), then set Verified `tax_status = 'tax_inclusive'`.
7. Create private buckets `signed-agreements` and `stamped-agreements` (dashboard; not public).
8. App deployment to staging (G).

Keep `04_pause_ai_recovery.sql` ready; it is not part of the forward path. Never apply `NW09_2_openai_live_pilot.sql`. Never use `supabase db push` or `migration up`.

**Read-only preflight (psql to the QA session pooler):**

```sql
select current_database(), current_user, version(), current_setting('track_commit_timestamp');
select pg_get_functiondef('auth.uid()'::regprocedure);                 -- must read request.jwt.claim.sub first (F1 binding)
select extname, extnamespace::regnamespace from pg_extension where extname in ('pgcrypto','pg_trgm');
select count(*) from public.ai_generation_runs where status = 'reserved';  -- must be 0 (quiesce)
select provider, provider_order_id, count(*) from public.payment_attempts where provider_order_id is not null group by 1,2 having count(*) > 1;  -- must be empty
select provider, provider_request_id, count(*) from public.signature_requests where provider_request_id is not null group by 1,2 having count(*) > 1;
select provider, provider_request_id, count(*) from public.stamp_requests where provider_request_id is not null group by 1,2 having count(*) > 1;
select p.oid::regprocedure, pg_get_userbyid(p.proowner) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosecdef and pg_get_userbyid(p.proowner) <> 'postgres';  -- must be empty (F7 ALTERs need ownership)
select id, public from storage.buckets where id in ('signed-agreements','stamped-agreements');
select defaclrole::regrole, defaclnamespace::regnamespace, defaclobjtype, defaclacl from pg_default_acl;
```

**Atomicity:** each file has a single BEGIN/COMMIT. Any error rolls the whole file back. This was proven locally: forced failures at three points leave catalog and data byte-identical; reruns are idempotent; 05 and 06 were rehearsed the same way.

**Permissions and RLS:**
- Finalize: service_role only.
- Reserve, complete, withdraw and review: authenticated only.
- v1 RPCs and split linking: nobody.
- Audit writer and path setters: service_role.
- No direct writes to drafts or runs.
- TRUNCATE revoked.
- Pinned search_path everywhere.
- Admin upload policies on the result buckets dropped.

**Post-migration verification:**
- The postcondition DO blocks run inside each file.
- Then re-run the grant matrix with real PostgREST JWTs (QA plan in `CC-14-REVIEW.md` §6, cases 1–10). Add these cases:
  - F1: an authenticated counsellor calling finalize must get "permission denied".
  - F1: the server path (service key on QA only) finalizes for the session user.
  - 06: a test-mode `payment.captured` with a wrong amount must be recorded as `failed` and leave the invoice unpaid.
- Judge concurrency results by commit order, never by `now()` timestamps.

**Rollback and recovery:**
- Before COMMIT: automatic.
- After COMMIT: prefer a reviewed forward fix. `04` pauses new AI reservations. Restore from the pre-migration backup only as a last resort.
- 05/06 rollback: re-create the 0005 student insert policy, or the 0016 `apply_webhook_event`, from the baseline files (reviewed script to be prepared with the approval).

## G. Staging isolation readiness

There is no `vercel.json` or `.vercel` folder in the repo. This plan relies on the earlier inventory: three Vercel projects on the same GitHub repo, and a protected production domain. Nothing was changed.

| Item | Plan |
|---|---|
| Project pairing | One designated staging Vercel project only. Its Preview **and** Production env scopes point at Supabase QA `ynwzijulzksmrcwdhudv`. Verify by reading project settings (not changing them) before approval. No staging project may hold `bwlkxunujngksibfzzfv` values. |
| Git-triggered deploys | Turn off automatic Git deployments, or set an Ignored Build Step, on the two non-staging projects for the stabilization branch. Deploy staging from a dedicated branch only. Never push `cc15-security-install` until this is confirmed. |
| Domains and aliases | Do not add or move any alias. Use the staging project's generated URL as `NEXT_PUBLIC_APP_URL`. |
| Supabase Auth redirects | In QA Auth settings, Site URL = staging URL, plus redirect allowlist entries for staging only. Production URLs must not be in QA's allowlist. |
| Preview protection | Vercel Deployment Protection (SSO or password) on the staging project, including Preview. |
| Payments | Razorpay **test** keys only (`rzp_test_…`), test webhook secret, webhook URL pointing at staging. `payment_gateway_config` on QA holds the test secrets. |
| AI | `AI_PROVIDER=mock` or `disabled` by default. OpenAI only for the approved fictional pilot: `AI_OPENAI_APPROVED`, fictional IDs, hard key limit. `AI_REAL_STUDENT_DATA_APPROVED` unset. The service-role key is needed only if AI generation is enabled (F1). |
| Notifications | Signature and stamp providers set to `mock`. No real email or SMS provider credentials on staging. |
| Data | Fictional QA accounts only; no production export or import. |
| Secrets | `SUPABASE_SERVICE_ROLE_KEY`, Razorpay test secrets and provider keys as server-only env vars (never `NEXT_PUBLIC_`), scoped to the staging project. |

## H. Tests executed (local; evidence in `cc16-evidence`, not QA evidence)

| Check | Result |
|---|---|
| Vitest full suite | 158 files, **2,729 passed** (4 new F1 gateway tests) |
| TypeScript (`tsc --noEmit --incremental false`) | exit 0 |
| ESLint | 0 errors, 18 existing warnings |
| Migration artifact drift | OK |
| Offline SQL security suite (PGlite; 01–03, 05, 06 loaded) | **60/60**: new F1 direct-call refusal, requester binding and identity restore, webhook amount/currency reconciliation |
| Migration rehearsal (PostgreSQL 16.15, disposable) | **11/11**, including 05 and 06 forced-failure, apply and rerun |
| Real multi-session concurrency (PostgreSQL 16.15) | **10/10 in each of 10 runs**; 0 deadlocks; finalize via service_role |
| `git diff --check` | clean |
| `next build` | exit 0, 97/97 pages |

**Limits of this evidence:**
- Offline PGlite and local PostgreSQL results are **not** evidence of QA database readiness.
- No Supabase, PostgREST JWT, pooling or Razorpay test-mode run was performed.

## I. Remaining blockers

| Priority | Item |
|---|---|
| **P0** | Human independent security sign-off (all reviews so far were AI agents) |
| **P0** | Approve the F1 trust model (service-role finalization) |
| **P0** | Authorized QA preflight, migration (F order) and QA validation with real JWTs, pooling and Razorpay test mode |
| **P0** | NW01 inclusive-GST pricing fix approved and applied in QA, plus Verified `tax_inclusive`; E matrix executed in test mode |
| **P0** | Staging isolation confirmed (G) before any push |
| P1 | Private result buckets (QA, then production); service_role residuals (N1: agreement re-creation, object deletion); privacy and retention approval; paid-model ceilings and reconciliation workflow |
| P2 | N4 (server-created payment attempts); optional OpenAI response-ID verification; F5; F9; F10; draft-edit serialization |

## J. Prioritized plan to 18 November 2026

1. **Nov 8–9:**
   - Human security review of the cumulative diff (focus on F1 wrapper, 05, 06, capture guard).
   - Approve the F1 model.
   - Read-only QA preflight (F).
2. **Nov 9–10:** apply in QA, in order:
   - the NW09.2 atomic artifact;
   - 05;
   - 06;
   - buckets;
   - then run QA validation (CC-14 §6 plus the F additions).
3. **Nov 10–11:**
   - NW01 pricing in QA.
   - Verified `tax_inclusive`.
   - E matrix in Razorpay test mode.
4. **Nov 11–12:**
   - Staging isolation (G).
   - Deploy to staging.
   - End-to-end staff and student walkthrough on fictional data.
   - Mock AI.
   - Fictional OpenAI pilot only if approved.
5. **Nov 13–14:**
   - Fix findings.
   - N4 server-created attempts if time allows.
   - Production migration plan, which repeats F against production after a backup.
6. **Nov 15–17:**
   - Production go/no-go: backups, migration window, live-payment enablement decision, monitoring.
   - Real-student AI stays off unless privacy approval exists.
7. **Nov 18:** launch.

## K. Approvals required before any remote operation

1. Human security sign-off on the cumulative package (Codex S3/S4 + CC-13…CC-16).
2. F1 trust model (service-role finalization; service key on servers that enable AI).
3. Read-only QA preflight (psql session to QA; no writes).
4. QA migration of `NW09_2_ATOMIC_01-03.sql`, `05`, `06` (written approval reference, fresh backup).
5. QA pricing change NW01 and the Verified `tax_inclusive` setting; turning GST on in QA for test rows.
6. Creating private buckets in QA.
7. Reading (then separately changing) Vercel settings for staging isolation; adding staging env vars; Supabase QA Auth URL changes.
8. Razorpay test-mode configuration for staging.
9. Any push of the stabilization branch, and any staging deployment.
10. Separately and later: every production step.
