# CC26-13: NW07 remediation, QA approval checkpoint and closure status

**Date:** 2026-11-12. **Base:** `387c53d` on `cc26/launch-readiness`. This continues CC-26; it is not a new milestone.

**Nothing in this document has been run against QA or production.** QA writes wait for your approval (§6). Production is never a target.

Each result carries one label:
- **Locally verified:** proven on the disposable PostgreSQL 16 model or the local build.
- **QA verified:** proven on `ynwzijulzksmrcwdhudv` itself.
- **Production verified.**
- **Not tested.**
- **Blocked:** needs access, credentials or an approval that is not available.

## 1. Root cause (confirmed on QA by your read-only SQL)

QA has the proposed NW07 Counsellor Studio migration in its **original** form. Its `public.counsellor_has_case_access(uuid)` grants access when **either**:
- the counsellor holds the caseload (`admin_student_meta`); **or**
- the counsellor is the `assigned_counsellor_id` of **any** Discovery Session of the student.

The second branch checks nothing else: no admin approval, no session status and no `is_active`. A counsellor may self-claim any unassigned request, so a self-claim alone satisfies it. The function is SECURITY DEFINER, pinned only to `search_path = public`, and executable by `anon`.

NW07 also wrote the same unapproved predicate **inline** into its other counsellor policies, not only through the function. On the QA model (original NW07 + NW09 over 0001–0022), the self-claim basis reaches:

| Path | Objects | Data category | R/W |
|---|---|---|---|
| `counsellor_has_case_access` | `recommendation_drafts`, `recommendation_draft_versions`, `ai_generation_runs` (SELECT policies) | Recommendation reports and every version; AI-generation records and stored reports | Read |
| `counsellor_has_case_access`, inside 8 SECURITY DEFINER RPCs | `staff_create/update/submit/review/release/withdraw/archive_recommendation_draft`, `staff_reserve_ai_generation_run` | Create and change drafts; reserve AI runs (cost budget) | **Write** |
| Inline raw `discovery_sessions` (NW07) | `profiles` (m7) | **Identity:** name, e-mail, phone | Read |
| Inline (NW07) | 11 `student_*` m7 tables | Student Digital Profile: date of birth, city, education, preferences, funding, goals | Read |
| Inline (NW07) | `admin_student_meta`; `admin_student_notes` read **and insert** | Case status; internal case notes | Read / **write** |
| Inline (0013/0014, fixed by CC-25 0023) | `discovery_session_workspace`, `student_profile_section_provenance`, `student_recommendation_verifications` (read and write) | Session workspace, provenance and verifications | Read / **write** |

So `profiles` is **not** caseload-only on QA today: its NW07 m7 policy also uses the session branch.

Reproduced locally:
- The CC-26 SQL suite, with the exact QA function body put back (mutant MU8), fails **13 checks**: N01–N06, N10, N14–N16, N24, N29 and N32.
- The harness step "baseline: an unapproved self-claim exposes the Student Digital Profile" passes on the unfixed QA model.

**Was real data accessed?** Not established. PostgreSQL does not log reads, and no access evidence was available. The preflight (§3) gives the exposure **scope** as counts only. Whether QA holds real student data at all is for you to confirm.

### A second defect found while reviewing (S11, P1)

NW07's two draft SELECT policies and five draft RPCs also accept `created_by = auth.uid()`: the author keeps access.

Authorship outlives case access. After any of these, the former author could still read every version of the drafts they wrote, and edit, submit, withdraw, release or archive them:
- approval is revoked;
- the session is reassigned, completed or cancelled;
- the counsellor is deactivated.

On QA this also covers drafts written while the self-claim rule was open. NW-F01 03 (not yet on QA) removes the clause from the five RPCs but **not** from the two SELECT policies.

## 2. Exact changes after `387c53d` (follow-up commit)

| File | Change |
|---|---|
| `supabase/migrations-proposed/cc26/0025_cc26_inactive_counsellor_and_grant_hardening.sql` | **New section F4** (NW07 databases only): the two draft SELECT policies require `counsellor_has_case_access` for counsellors (admins unchanged). The five write RPCs are re-created from NW07 verbatim except two lines: the authorization line, and `search_path = pg_catalog, public, pg_temp`. This happens only when the body hash is exactly the NW07 original; a body without the clause (NW-F01) is left alone; anything else refuses as drift. CRLF-safe hashing. Two new postconditions. ACLs, comments and data untouched. |
| `…/cc26/0025_cc26_ROLLBACK.sql` | Restores the NW07 policies and bodies verbatim, but only over the exact CC-26 bodies |
| `…/cc26/cc26_security_tests.sql` | Revision 2: **+31 checks** (N14–N34 with N20b, S01–S07, R07–R08). They cover brief scenarios 1–15 with fictional drafts, versions and AI records, approval, revocation, reassignment, cancellation, a deactivated author, and student isolation. Totals: 76 on an NW07 database; 40 + 35 SKIP without NW07. |
| `…/cc26/cc26_qa_preflight_readonly.sql` | Revision 2, sections 7–10: classify the QA function (exact NW07 original / CC-26 fixed / unknown); every policy and RPC that depends on it; F4 drift state; exposure scope (counts only); apply-window lock facts |
| `…/cc26/cc26_qa_export_readonly.sql` | **New.** Read-only export of every function, policy, grant, trigger, constraint, column and migration-history row in the touched schemas. Definitions only, no rows. |
| `docs/cc26/qa/Run-CC26-Qa.ps1` | New steps: **Export** and **Backup** (schema-only `pg_dump`). Every SQL file is now pinned to its SHA-256 and a changed file is refused. |
| `docs/cc26/qa/CC26-QA-SQL-SHA256.txt` | **New:** the 12 pinned hashes (§4) |
| `scripts/security/cc26-security-closure.db.test.mjs` | New counts; **mutants MU8–MU12**: the exact QA body; the author policy; the author RPC; a helper without approval; a helper without the status filter |
| `src/lib/recommendations/cc26-recommendation-author-access.test.ts` | **New**, 25 static guards that run on the PC: F4 equals NW07 apart from two lines; hash guards; rollback; read-only files; hash pins |
| `docs/cc26/*` | CC26-00, -01, -02, -09, -10, -11 and -12 updated; this file added |

**0023 r2 needed no change.** It already replaces the QA function body (whitespace-tolerant detection), so the 3 policies and 8 RPCs that call the function are fixed with it. It also narrows the 15 inline NW07 policies and restores `profiles` to the 0004 caseload-only rule. The old CC-24 migration is not used anywhere.

## 3. QA preflight findings

| Item | Status |
|---|---|
| Function body and the 3 dependent policies, as quoted by you | **QA verified** (your read-only SQL) |
| Which migrations are on QA, the inline NW07 policies, grants, drift, the exposure counts | **Blocked:** needs approval A1 (`-Step Preflight` and `-Step Export`). The SQL is ready and was rehearsed. |
| The same queries on the local QA model | **Locally verified.** Classification "NW07 original (unsafe)"; 24 dependent policies; 8 dependent RPCs; F4 state "NW07 original" ×5. Exposure counts tested against seeded fictional rows. |

No missing definition was inferred. Where QA might differ from the model (whitespace, extra policies, a hand-edited body), the preflight reports it and the migrations refuse.

## 4. Approval checkpoint (Phase 3): files, hashes, order

SHA-256 over LF-normalised text. This equals the Git blob, and is what the runner checks on the CRLF Windows worktree.

| Order | File | SHA-256 |
|---|---|---|
| P1 | `cc26/cc26_qa_preflight_readonly.sql` | `d6ad11a15017edc95141a67958455b980344c006b79947bec87d0244da58e27a` |
| P1 | `cc26/cc26_qa_export_readonly.sql` | `3aa9beba09a197afcfc3585314d77ca15f6a064362080051864f3d43e1a0e76a` |
| 1 | `cc25/0023_cc25_counsellor_identity_least_privilege.sql` (r2) | `a897b24ce685691327830c44d485f6f236a508c1dffeb4cc8fdd2bc14fa77723` |
| 2 | `cc25/0024_cc25_revoke_anon_internal_rpcs.sql` | `b991759091be4ff0456cd90d4a70f077160e8cf8e4439f230153cc16f984b68f` |
| 3 | `cc26/0025_cc26_inactive_counsellor_and_grant_hardening.sql` (with F4) | `b0ab3080b916e007eaf0a495500060b07f523c21bd9409d0c7eb770cf2635f83` |
| 4 | `cc26/0026_cc26_database_checkout_gate.sql` | `0dc661447293c9106780eee88cffa1e8b3628730b312fb62c8d91b377b1e9fd6` |
| T | `cc25/0023_cc25_rls_tests.sql` | `cb9af86e6610138e00a8f6c1e83f853a942cbd5e2d75caff56ae879ed3037c29` |
| T | `cc26/cc26_security_tests.sql` (r2) | `eb6bc3a4d5568d073b8c19979a38b68a3182f12601dad67cd949d0f56c67c54a` |
| R | `cc26/0026_cc26_ROLLBACK.sql` | `3ea96a2f2542ac292af2ad144f9e5406f16d04f9b28a22b92beb1ea7cf97537a` |
| R | `cc26/0025_cc26_ROLLBACK.sql` | `31ebce1ea0bd6e6b72f759f639a9229662c2575af3bb5c4930c37896a754ca87` |
| R | `cc25/0024_cc25_ROLLBACK.sql` | `1e07fecc8ba24ddc83941abe0bcf3d782c27896f68d84e76be0af950774b25ce` |
| R | `cc25/0023_cc25_ROLLBACK.sql` | `de3f424be316c454af9c5407f1cf32f1bd7c85f65d205d18ffb4ca97fe982dd7` |

Paths are under `supabase/migrations-proposed/`.

### Database identity evidence

The runner protects the target in four ways:
- It refuses a host or user that does not contain `ynwzijulzksmrcwdhudv`, and any target naming `bwlkxunujngksibfzzfv`.
- Port 5432 only.
- You type the ref; writes also need a typed phrase.
- Every migration refuses any approval value except `APPROVED-QA-ynwzijulzksmrcwdhudv` or `LOCAL-DISPOSABLE-TEST`.

The preflight's first row records the database, user, server address and version for the evidence file.

### Impact

- **Data:** no existing row is changed or deleted. 0023 adds three nullable columns and a CHECK constraint to `discovery_sessions`; the constraint scans the table under a short ACCESS EXCLUSIVE lock (`lock_timeout 5s`). 0026 adds one table and one control row.
- **Access, intended:** every existing Discovery Session assignment becomes **unapproved**, so counsellors lose session-based student access until an admin approves (A4). Caseload access is unchanged. Deactivated counsellors lose caseload and queue. Former draft authors without case access lose those drafts. Students can no longer create invoices or payment attempts through the API.
- **Legitimate workflows:** admin, active caseload counsellor, approved-session counsellor and student paths all pass (N07, N12, N13, N21, N23, N25, N28, N31, N33, S05, S06, I08–I11, P08).

### Expected postconditions (checked inside each file; re-checked by Tests and a second Preflight)

- `counsellor_has_case_access` classification is "CC-26 fixed": caseload OR approved, active session of an active counsellor; `anon` cannot execute it.
- No policy outside `discovery_sessions` reads `discovery_sessions` directly.
- `profiles` is caseload-only.
- No draft policy or RPC grants access by authorship.
- `current_counsellor_id()` checks `is_active`.
- Client roles hold no TRUNCATE, TRIGGER or REFERENCES.
- The checkout gate exists and is closed.
- Tests: `89 checks, 89 passed` and `CC26|SUMMARY|pass=76|fail=0|skip=0|info=1`.

### Remaining risks

1. QA may differ from the model. The migrations then refuse cleanly (atomic). The preflight shows it first.
2. Apply runs 0023, 0024 and 0025 as three transactions in one session with `ON_ERROR_STOP`.
   - If a later file refuses, the earlier ones stay applied. Rehearsed: a drifted RPC made 0025 refuse after 0023 and 0024 committed; 0026 did not run.
   - That state is safe, because 0023 alone closes the self-claim path. **Do not retry**: run the preflight and report.
3. Counsellors lose session-based access until admins approve (A4). Plan the approvals with the team.
4. After the CC-26 set, 46 SECURITY DEFINER functions on the QA model (from 0001–0022, NW05–NW09) still pin `search_path` without `pg_temp` last. NW-F01 F7 pins them all; the forward-path test proves it in both orders. PostgREST callers cannot create temporary objects, so this is P3 until NW-F01 lands.
5. The 8 `staff_*` RPCs stay executable by `anon`. Each refuses without a signed-in admin or counsellor (R08, N32). NW-F01 03 revokes it.

## 5. Backup and recovery (Phase 2)

| Item | Status |
|---|---|
| Supabase plan and an existing backup for QA | **Blocked:** dashboard only (Database → Backups). Supabase gives daily backups on Pro (7 days), Team (14 days) and Enterprise (up to 30 days), and PITR as a paid add-on. Free projects get none. A restore takes the project offline. |
| Catalog restore point | Ready: `-Step Backup` (schema-only `pg_dump` of `public` and `nextwise_security`, no rows). It checks key objects and prints the SHA-256. **Locally verified** (rehearsal); on QA it is part of A1. |
| Data | These migrations change no existing rows, so data recovery is not needed for them. If you want a data copy anyway, take it in the dashboard or with `supabase db dump --data-only` and store it as personal data. |
| Tested restoration | The rollback chain restores the exact pre-migration catalog: the harness checks it byte for byte, and the runner rehearsal returned the same function and policy fingerprint. **Locally verified.** Rollback re-opens the defects (rule 7): use it only to recover a broken release, then forward-fix. |

## 6. Approval requests

| # | Request | Writes |
|---|---|---|
| **A1** | `Run-CC26-Qa.ps1 -Step Preflight`, `-Step Export`, `-Step Backup`, then send me the three output files | nothing |
| **A2** | `-Step Apply` (0023 r2, 0024, 0025), then `-Step Tests` and `-Step Preflight` again | QA schema |
| **A3** | `-Step Apply -IncludeCheckoutGate` (0026) | QA schema |
| **A4** | Admins re-approve the legitimate Discovery Session assignments | QA data (audited) |
| **A5** | `git push` of the follow-up commit (plain push), so the Preview rebuilds | remote |
| **A8** | Fictional QA accounts (admin, two counsellors, two students) for the signed-in Preview checks, or permission to create them on QA | QA data |

## 7. Status of the brief's tasks

| Task | Result | Label |
|---|---|---|
| A: audit | Root cause, impact matrix, read-only preflight and export ready | Locally verified; QA run **Blocked** (A1) |
| B: authorization rules | Approved + active session + active counsellor + matching IDs + timestamp; author bypass closed (F4) | Locally verified |
| C: migration sequence | Ordering, atomicity, idempotency, locks, rollback identity, drift refusal, NW-F01 in both orders | Locally verified (harness 32/32) |
| D: QA procedure | Phases 1–4 scripted and rehearsed end to end through the runner (Preflight, Export, Backup, hash refusal, Apply, Tests, drift stop, Rollback) on a local copy of the QA model | Locally verified; QA **Blocked** (A1–A3) |
| E: security tests | 76/76 on the QA model; 15 scenarios covered; 12 mutants caught | Locally verified; QA **Blocked** (A2) |
| F: Preview | Page loads; Supabase ref in client bundles = QA only, no production ref, no `service_role`, no `rzp_live_`; protected routes, including `/applications/<id>`, redirect to `/login`; 404 for unknown pages; pricing has no buy control; homepage main DOM, text and 76 links identical to www.nextwise.world | Signed-out only. **Not tested:** READY status and SHA (no Vercel access); signed-in journeys **Blocked** (A8, and best after A2) |
| G: checks | tsc 0; ESLint 0 errors (18 warnings, unchanged); Vitest **180 files, 3,107 passed, 1 skipped**; audit 0; build 0; secret scan 0; diff check clean | Locally verified; `Finish-CC26-Followup.ps1` repeats them on the PC |

## 8. GO/NO-GO

- **CC-26 acceptance: NO-GO for now.** The defect is fixed and proven locally, but it is **open on QA** until A2 runs and Tests pass there. That is required for acceptance.
- **Follow-up commit:** GO.
- **A1:** GO now.
- **A2 and A3:** GO once A1 shows no drift. Urgent, because the exposure is live on QA.
- **Production deploy, production SQL, payments and paid AI:** NO-GO. A7 (does production have NW07?) is still open.
