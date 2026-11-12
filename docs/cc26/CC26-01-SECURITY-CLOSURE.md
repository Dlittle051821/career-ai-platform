# CC26-01: Security closure

**Scope:** every P0 and P1 security defect reported up to CC-25, re-audited on the CC-26 base (`706df7d`), plus the defects CC-26 found while auditing.

**Status:** fixed in proposed SQL and app code, and verified on disposable local PostgreSQL 16 in two database states. **Nothing is applied to QA or production.** The QA steps and approval requests are in CC26-02.

## 1. Database states tested

The repository ships migrations 0001–0022. The project notes (CC-16/CC-17/CC-18 QA plans) record that QA **also** has the proposed NW05, NW06, NW07 and NW09 applied. CC-25 tested only the first state. CC-26 builds and tests both, from the real files:

| State | Contents | Why |
|---|---|---|
| `base` | 0001–0022 | What the repository ships; production is believed to be here |
| `qa` | base + NW05, NW06, **NW07 (original 706df7d text)**, NW09 | What QA is recorded to have |

The read-only preflight (`cc26_qa_preflight_readonly.sql`, marker **Q1**) tells which state QA is actually in before anything is applied.

## 2. Findings

| ID | Sev. | Finding | Reproduced | Fix | Status |
|---|---|---|---|---|---|
| S1 | **P0** (on QA, if NW07 is applied) | **NW07 grants case access through ANY Discovery Session assignment.** A counsellor self-claims an unassigned request (no admin involved) and can then read the student's `profiles` row (name, phone), all 11 Student Digital Profile tables (date of birth, city, …), `admin_student_meta` and case notes, and can **write case notes**. NW09 inherits the rule for AI runs and recommendation drafts. | Yes: `evidence/db/probe-nw07-self-claim.txt` (name, phone, city and date of birth visible after a self-claim; note insert succeeds). Also step "baseline" in the harness. | `cc25/0023` revision 2, section 7b. Where NW07 exists, `counsellor_has_case_access` and the 14 NW07 student/meta/notes policies require a caseload assignment **or an admin-approved, active session held by an active counsellor**. NW07's `profiles` policy returns to the exact 0004 caseload-only rule; identity comes only from the narrow CC-25 RPC. The NW07 proposal is patched the same way (CC26-07). | Fixed locally; **open on QA until 0023 r2 is applied** |
| S2 | **P0** (release blocker) | **CC-25's 0023 could not be applied to QA.** On a database with NW07, its own postcondition aborted ("a profiles policy references discovery_sessions"). It failed safely (rolled back), but it would have left S1 open. | Yes: revision 1 refused on the `qa` state | Revision 2 (above). Tested on both states. | Fixed locally |
| S3 | P1 | CC-25 F1–F5: self-claim grants workspace, provenance and verifications; `student_user_id` mutable on sessions and caseload rows; finished sessions keep access; inactive counsellors keep session access. | CC-25 suite: baseline 48 pass / 41 fail | `cc25/0023` (unchanged semantics) | Fixed locally; open on QA until applied |
| S4 | P1 | Anonymous callers can execute `record_system_audit_log` (forge "system" audit rows) and `set_signature_document_path` / `set_stamp_document_path` (re-point a signed or stamped document if the provider request ID is known). Root cause: Supabase's default privileges grant EXECUTE to `anon` **directly**, so the migrations' `revoke … from public` did not remove it. | Yes: R05 (anonymous forged row) | `cc25/0024`, **now mandatory** (was optional). The app only calls the path setters with the service role, and the webhooks keep working (R03, R04). | Fixed locally |
| S5 | **P1** | **Deactivated counsellors keep their caseload.** `is_active = false` is the documented way to remove a counsellor (0004), but `current_counsellor_id()` ignored it. Almost every counsellor policy is keyed on that function: profiles, 11 profile tables, applications, invoices, payments, agreements, leads, outcomes, notes. | Yes: I01–I05 FAIL at baseline | `cc26/0025`: `current_counsellor_id()` returns null for an inactive counsellor, which closes every path at once. Active counsellors are unaffected (I08–I11, R26-01). | Fixed locally |
| S6 | P2 | A counsellor with no active record still sees and can update every **unassigned** Discovery Session (student id, notes, times): that branch never used `current_counsellor_id()`. | I06, I07 | `cc26/0025` gates the branch on an active counsellor | Fixed locally |
| S7 | P2 | `anon` and `authenticated` hold TRUNCATE (which bypasses RLS), TRIGGER and REFERENCES on all 96 public tables. PostgREST cannot issue these, so this is defence in depth. | G01, G02, G04 | `cc26/0025` revokes them, now and in the owner's default privileges | Fixed locally |
| S8 | **P1** (payments) | **Direct API creation of unpaid invoices.** Checkout is paused only in the Next.js server action. Any signed-in student could call `purchase_pricing_plan` directly and get a real invoice (consuming the next GST invoice number), a purchase snapshot and an offer redemption. Students can also insert `payment_attempts` directly (the CC-15 forgery precondition). No money can move. | P01–P03 at baseline; CC-25 suite P2 note | `cc26/0026`, a database checkout gate (CC26-03) | Fixed locally; payments stay off |
| S9 | P2 | CC-25 functions pinned `search_path = ''`. An empty search_path still searches the session's temporary schema **first** for table and type names. It also clashed with NW-F01 03's search_path sweep, so the end state depended on apply order. Applying 0025 after NW-F01 even reset `current_counsellor_id()` to `search_path = public` (an F7 regression). | Forward-path test, order a vs b | Every CC-25/CC-26 definer pins `pg_catalog, pg_temp` (`counsellor_has_case_access` and `current_counsellor_id`: `pg_catalog, public, pg_temp`). Both orders now converge, and rollbacks keep F7. | Fixed locally |
| S11 | **P1** (QA, NW07) | **Authorship outlives case access on recommendation drafts.** NW07's two draft SELECT policies and five draft RPCs accept `created_by = auth.uid()`. After approval revocation, reassignment, a finished session or deactivation, the former author still reads every version and can edit, submit, withdraw, release or archive the draft. On QA this includes drafts written under the open self-claim rule. NW-F01 03 fixes the RPCs, not the policies. Found 2026-11-12 (CC26-13). | N26, N27, N30, N34 fail with 0025 of `387c53d` | `cc26/0025` F4: case access only; RPC bodies replaced only from the exact NW07 hash; drift refuses | Fixed locally (follow-up commit) |
| S12 | P2 (review) | Independent SQL review (2026-11-12): (R1) the 0025 rollback granted client roles TRUNCATE/TRIGGER/REFERENCES on every table, beyond the pre-migration state; (R2) F4 accepted unknown RPC bodies without the author clause; (R3) the QA runner resolved the wrong repository root from the milestone copy | R1 reproduced (old rollback gave `anon` TRUNCATE on a table that never had it) | 0025 records the exact privileges it revokes, and the rollback restores only those; F4 accepts only three known fingerprints; the runner resolves and validates the worktree (CC26-13 §2b) | Fixed locally (follow-up 2) |
| S10 | P3 | The 0024 rollback restored the right privileges in a different ACL order, so the catalog was not byte-identical | Rollback-chain test | Grant order corrected | Fixed |

### Still open (not CC-26 code, needed before payments or AI go live)

- NW-F01 `NW09_2_ATOMIC_01-03`, `05`, `06` and `NW01` are unapplied on QA. They cover write-once document capture (F3), version-bound approval (F4), payment-attempt integrity, capture reconciliation and the GST-inclusive price. CC-26 verified they still apply and pass with the CC-26 set in either order (§4).
- Human (non-AI) security sign-off has not happened.
- **Production state is unknown.** I have no access to production and must not query it. Please check in the Supabase dashboard (Database → Functions, read-only) whether `counsellor_has_case_access` exists in production. If it does, S1 is live with real student data and 0023 r2 becomes urgent for production too.

## 3. Remaining anonymous-executable definer functions (after all CC-26 migrations)

There are 37, down from 41. Each was read; none writes data for an anonymous caller:

- **Signed-in checks:** the `get_my_*` readers, `student_*` actions, `staff_*` drafts, AI runs, `purchase_pricing_plan`, `verify_checkout_payment`, `record_admin_audit_log`, `next_invoice_number` and `admin_purge_ai_generation_reports` all raise or return nothing without `auth.uid()` or an admin role.
- **Webhooks:** `apply_webhook_event`, `apply_signature_webhook_event` and `apply_stamp_webhook_event` must stay callable without a session (the webhook routes use the anon client). They verify the HMAC against the database-held secret.
- **Pure helpers:** `is_admin_role`, `is_any_admin`, `current_admin_role` and `current_counsellor_id` return only facts about the caller.
- **Trigger functions:** these cannot be called directly.

The root cause (Supabase default EXECUTE for `anon` on new functions) is left in place deliberately: removing it would change the behaviour of every pending migration. It is recorded as a P3 recommendation for a dedicated milestone.

## 4. Verification (local, disposable PostgreSQL 16)

| Check | Result |
|---|---|
| `scripts/security/cc26-security-closure.db.test.mjs` | **32/32** (re-run 2026-11-12 after F4 and the extended suite) |
| … migrations refuse without approval; forced failure is atomic | pass (both states) |
| … apply 0023 r2 → 0024 → 0025 → 0026, each re-run idempotent | pass (both states) |
| … CC-25 suite 89 checks; CC-26 suite (revision 2) | 89/89; **76/76** (qa); 40 pass + 35 SKIP (base, no NW07) |
| … CC-26 baseline before the migrations | 16 FAIL on both states: the defects reproduced |
| … mutation tests (6 on base, 12 on qa, incl. the exact QA function body MU8) | every re-opened defect caught |
| … rollback 0026 → 0023 | catalog and default ACL **byte-identical** to before |
| … NW07: patched file without 0023 is caseload-only; every apply order converges; rollback restores the state it replaced | pass |
| … forward path with NW-F01 (01–03, 05, 06) + NW01, both orders | identical catalog; suites pass; no unpinned definer |
| `scripts/security/cc25-counsellor-identity.db.test.mjs` | **11/11** (baseline 48/41; final 89/89) |
| NW-F01 suites (CC-18 protected, unchanged): rehearsal / offline PGlite / concurrency | **12/12, 79/79, 10/10** |
| `assemble-nw09-2-atomic.mjs --check` | no drift |

## 5. Test assertions changed (none weakened)

| File | Old assertion | Why it changed | New assertion |
|---|---|---|---|
| `src/lib/recommendations/recommendation-drafts-migration-security.test.ts` | Five tests asserting NW07 **widens** access to any `discovery_sessions` assignment, and `revoke execute … from public` for `counsellor_has_case_access` | They asserted the insecure rule that S1 removes | Seven tests: no executable raw-session basis; caseload-only fallback without 0023; profiles = 0004; all 11 tables, meta and notes require `counsellor_has_case_access`; that function is definer, stable, pinned, caseload OR approved active session; and `revoke all … from public, anon, service_role` (stricter). Verified: all 8 fail on the original file. |
| `src/lib/discovery-sessions/cc25-identity-lookup.test.ts` | "adds no profiles policy"; "pins an empty search_path" | Section 7b re-creates NW07's profiles policy **as the caseload-only rule**; search_path changed (S9) | "never widens profiles: any profiles policy is the 0004 caseload-only rule, only inside 7b"; grant checks extended to EXECUTE strings; "pins search_path with pg_temp last; no empty search_path". Verified: both fail when a session branch or `''` is re-inserted. |
| `cc25/0023_cc25_rls_tests.sql` G02 | `search_path=""` | S9 | `search_path=pg_catalog, pg_temp` (same strength) |
| CC-25 browser E9, P2 | Accepted a soft 404, and an unpaid invoice as a "note" | Both defects are fixed | Require HTTP 404; require refusal with no invoice, purchase or invoice number (P2), plus new P2b |
