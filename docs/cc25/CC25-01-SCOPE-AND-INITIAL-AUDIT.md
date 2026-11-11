# CC25-01: Scope and initial audit

**Milestone:** CC-25, Complete Staging Acceptance, Security Hardening & Release Candidate. Started 11 Nov 2026 (Europe/Berlin).

## 1. Workspace (verified, read-only)

| Item | Verified value | How |
|---|---|---|
| Worktree | `C:\ClaudeBuilds\CC25-STAGING-ACCEPTANCE` (already existed, created on the PC on 11 Nov; **resumed, not recreated**) | The worktree's `.git` file points to `C:/carrier.ai/.git/worktrees/CC25-STAGING-ACCEPTANCE` |
| Branch | `cc25/staging-acceptance` | Worktree `HEAD` = `ref: refs/heads/cc25/staging-acceptance` |
| Base commit | `3d5e3736f528777d933f00c8ed909139f8d8bdf5` | Worktree reflog: created at `3d5e373`, then `reset: moving to HEAD` |
| Contents of `3d5e373` | 1,730 tracked files. Every blob hash equals the CC-24 delivery: 485 untouched since `a1017b9`, 1,245 CC-24 files, and the 2 obsolete `loading.tsx` files removed | Parsed the worktree's git index (read only) and compared every blob hash |
| Clean state | Root listing matches the index. No `node_modules`, no stray files. `Finish-CC25.ps1` re-checks `git status` for every path | File bridge listing |
| `C:\carrier.ai` | Only its `.git/worktrees/CC25-STAGING-ACCEPTANCE` metadata was **read**. Nothing was written | |
| CC-24 worktree | Not modified | |

**Execution environment.**
- The PC has **no shell** in this session; only the file bridge (list, read, write) is available.
- All building, testing and database work ran in a cloud workspace on an exact copy of `3d5e373`. Its tree hash matches all 1,730 index entries.
- Results are delivered into the CC-25 worktree, and `Finish-CC25.ps1` repeats the checks on Windows.
- "Local" in these documents means that disposable cloud copy, never your PC.

## 2. Documents read

- CC-24: CC24-01 to CC24-07, the 0023 proposal and its RLS tests, and the CC-24 final evidence (`results.jsonl`, H6 detail).
- CC-22 and CC-23 project notes, plus the CC-14 to CC-18 security reports (project knowledge base).
- Migrations 0001–0022 (full text for 0004, 0013, 0014, 0015), the proposed NW07 and NW-F01 packages, and `PORTRAIT-ASSET.md`.

## 3. Defect register (prioritized)

| ID | Pri | Area | Finding | Source | CC-25 outcome |
|---|---|---|---|---|---|
| S1 | **P0** | DB auth | A counsellor **self-claim** unlocks the student's workspace, section provenance and recommendation verifications (0013 PART 3 and 0014 grant on any assignment) | Review concern 1; reproduced (W02, V02, V05) | **Fixed in proposed 0023 CC-25.** Awaiting QA approval |
| S2 | **P0** | DB auth | `discovery_sessions.student_user_id` can be changed by the counsellor holding the session, which **hijacks** another student's data | Review concern 2; reproduced (A01–A03) | Fixed (guard trigger: immutable for every role) |
| S3 | **P0** | DB auth | **New:** a counsellor can repoint their own `admin_student_meta` caseload row at any student (caseload hijack: profiles and student data) | Found in CC-25; reproduced (C04) | Fixed (immutability trigger) |
| S4 | P1 | DB auth | Completed, cancelled and no-show sessions keep student-level access | Review concern 4; reproduced (V03, V04) | Fixed (active states only) |
| S5 | P1 | DB auth | A counsellor holding an unapproved claim can cancel or reschedule the student's session | Found in CC-25 (A06) | Fixed |
| S6 | P1 | DB auth | An inactive counsellor keeps session-based access | Found in CC-25 (X02) | Fixed for session paths. The caseload path remains (residual, CC24 D23) |
| S7 | P1 | UX/auth | An assigned counsellor can't see who they're meeting (CC-23 F11) | CC-24 | Fixed through the least-privilege identity RPC (needs 0023 on QA) |
| S8 | P1 | DB auth | The rejected CC-24 0023 policy exposes the whole `profiles` row | Review concern 3 | Superseded; `cc24/REJECTED.md` added. Never applied |
| S9 | P1 | Testing | CC-24 SQL tests never failed on unexpected access | Review concern 6 | 89-check executable suite, exit code ≠ 0 on failure, 7-step cycle and mutation tests |
| S10 | **P1** | DB grants | **New, pre-existing:** `anon` can execute `record_system_audit_log` (forging "system" audit rows) and the signed/stamped document-path setters | Found in CC-25; reproduced locally | Fix is in the pending NW-F01 `01`. **Optional stopgap 0024** provided and tested. Not applied |
| S11 | P2 | DB grants | Supabase default grants: `anon`/`authenticated` hold TRUNCATE/REFERENCES/TRIGGER on all in-scope tables (not reachable through PostgREST) | Found in CC-25 | Documented; separate hardening recommended |
| S12 | P2 | DB auth | The proposed NW07 migration copies the unsafe "any Discovery Session assignment" rule | Found in CC-25 | Must be revised before NW07 is approved (CC25-02 §3) |
| D1 | P2 | Dependencies | 8 moderate npm advisories (7 on the PC): all are `minimatch` ≥7 <11.0.1 (GHSA-g3hv-75wg-m249) in the **dev-only** ESLint toolchain | `npm audit` | Fixed with a targeted `overrides` entry → **0 vulnerabilities** |
| D2 | P2 | A11y | CC-24 H6 touch targets. Re-measured against real WCAG 2.5.8 (spacing and inline exceptions): every flagged target outside the homepage qualifies for an exception, including the filter checkboxes, whose 20 px rows sit 26 px apart | CC-24 H6 | **No code change needed** (a row-height tweak was tried and reverted). The 6 homepage chapter-rail links still fail; they're in a protected V5.4 file (CC25-05 §3) |
| D3 | P2 | Payments | A signed-in student can call `purchase_pricing_plan` directly and get an **unpaid** invoice (exactly ₹1,999). No payment attempt or gateway order is possible while checkout is closed | Found in CC-25 (suite P) | Documented. Owned by NW01 / CC-19/CC-20 |
| D4 | P2 | Test harness | B2-mobile focus check read focus in the same tick (flaky 1/5) | CC-25 run 1 | Test waits up to 2 s for focus (same assertion) |
| B1 | Blocker | Legal | V5.4 portrait: no documented commercial or model-release rights (cut from a third-party reference) | CC-24 D21 | **BLOCKED**: replacement criteria in CC25-05 §6 |
| B2 | Blocker | Payments | GST tax and database dependencies (CC-19/CC-20, NW01) unresolved | CC-24 D14 | Payments stay off. Verified closed (CC25-06) |
| B3 | Blocked | Access | QA migration and Vercel Preview need your approval and access, which this session doesn't have | Brief §05, §11 | **BLOCKED**: procedures in CC25-02 §8 and CC25-07 |

## 4. Scope boundaries kept

- No university database expansion.
- No homepage redesign or visual change: the 39 protected V5.4 files are hash-identical.
- No payments or paid AI.
- No production access.
- No push, merge or deploy.
- No SQL on any shared database.
