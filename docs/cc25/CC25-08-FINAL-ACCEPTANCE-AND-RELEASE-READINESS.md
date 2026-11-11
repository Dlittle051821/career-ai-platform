# CC25-08: Final acceptance and release readiness

**Decision: CC-25 is NOT fully accepted.** The code-side release candidate is complete and verified locally. Full acceptance waits on actions that need you: QA migration approval, push and Preview, Preview journeys, and portrait rights.

| Gate | Decision |
|---|---|
| Release candidate (code), for a local commit | **GO**, once `Finish-CC25.ps1 -InstallDependencies -Commit` passes on the PC |
| QA migration 0023 (and optional 0024) | **GO to request approval.** Package verified locally: 89/89, rollback exact, 4 of 4 mutants caught. *Not applied* |
| Push and CC-25 QA Preview | **GO to request authorization**, after the commit |
| Staging acceptance | **NOT YET**: needs 0023 on QA, a Preview and the CC25-09 §4 journeys |
| Production | **NO-GO**: see §4 |
| Payments | **NO-GO**: CC-19/CC-20/NW01 GST work outstanding (checkout verified closed) |

## 1. Definition of Done

| Condition | Status | Evidence |
|---|---|---|
| The new authorization model is secure | **MET (locally)**: least-privilege RPC, database-controlled approval, immutable student IDs, active-state limit, inactive counsellors excluded | CC25-02, CC25-03 |
| Database tests prove the intended RLS boundaries | **MET (locally)**: 89 executable checks; baseline 48/41 reproduces the defects; final 89/89 | CC25-03 |
| Migration and rollback work correctly | **MET (locally)**: 7-step cycle; catalog identical after rollback; re-runnable; atomic on forced failure; approval-gated | CC25-03 §1 |
| Required QA migration applied and verified, if approved | **NOT MET**: approval not given yet; nothing was run on QA | CC25-02 §8 |
| Student registration and login pass | **MET (locally)**: B1–B12b | CC25-04 |
| Profile saves persist | **MET (locally)**: C1–C17 | CC25-04 |
| Discovery Sessions work | **MET (locally)**: F1–F11. F11 (counsellor sees the student) now passes | CC25-04 |
| Admin and counsellor permissions validated | **MET (locally)**: R25-01 to R25-11 plus the SQL suite | CC25-04, CC25-03 |
| Career and Abroad discovery work | **MET (locally)**, except: D8 BLOCKED (needs NW07); E9 is a soft 404 on an authenticated page (P3) | CC25-04 |
| Payment collection remains disabled | **MET**: G1–G8, P1–P7, unit guards | CC25-06 |
| V5.4 homepage approved and functional | **MET**: DOM identical, 16/16 frames, 39 protected files unchanged | CC25-05 §5 |
| Required browser checks pass | **PARTLY**: Chromium at 5 widths passes, apart from H6b (protected homepage rail, P2). Firefox, Edge, Safari, iOS and Android NOT RUN | CC25-05 |
| No unresolved P0 security defect remains | **NOT MET in any shared database.** The three P0s (self-claim access, session hijack, caseload hijack) are **pre-existing**. They are present wherever migrations 0004/0013/0014 are applied, which very likely includes QA and production today. Each needs a signed-in counsellor account to exploit. 0023 fixes them, but it is not on QA or production yet | CC25-01 |
| All automated tests and builds pass | **MET (locally)**: TypeScript; ESLint 0 errors; Vitest 176 files, 3,060 passed, 1 skipped; build; `npm audit` 0; `git diff --check` | `evidence/regression/` |
| Dependency vulnerabilities assessed | **MET**: 8 → 0 (dev-only override) | CC25-06 |
| Full staging evidence exists | **NOT MET**: no Preview yet | CC25-07 |
| Release-readiness documentation complete | **MET**: CC25-01 to CC25-09 | `docs/cc25/` |

## 2. What changed (32 paths: 11 modified, 21 added)

The authoritative list, with hashes, is `CC25-FILE-MANIFEST.json` in the milestone folder. No file was deleted. `src/types/database.ts` (a protected CC-18 file) is unchanged.

**Application:**
- `src/lib/supabase/admin/discovery-sessions.ts`: identity is looked up through the RPC, keyed by session, in batches of ≤100. It falls back safely before 0023 exists, reports the approval state, and adds `setDiscoverySessionAssignmentApproval`.
- `src/lib/supabase/admin/discovery-session-rpc.ts` (new): typed RPC calls; no service role.
- `src/lib/discovery-sessions/assignment-approval.ts` (new): approval states and safe error messages.
- `src/lib/discovery-sessions/student-identity.ts`: explains *why* details are restricted.
- `src/types/discovery-session.ts`: `assignmentApproved`, `assignmentApprovedAt`.
- Admin: an "Assignment approval" card (`AssignmentApprovalCard.tsx`, new), plus a server action and the detail page; "Awaiting admin approval" in the list.
- Counsellor: the waiting-for-approval notice and the list hint.

**Database (proposed, not applied):** `supabase/migrations-proposed/cc25/` (6 SQL files) and `cc24/REJECTED.md`.

**Tests:**
- `src/lib/discovery-sessions/cc25-identity-lookup.test.ts`: 15 tests. On the unmodified `3d5e373` code, 9 of them fail.
- `scripts/security/cc25-counsellor-identity.db.test.mjs`: 11 database tests.
- The CC-24 identity test's mock gained an `rpc` stub that answers "function not found". Its assertions are unchanged.

**Dependencies:** a `package.json` override and a 2-entry lockfile change, plus the `test:db-security` script.

**Docs:** `docs/cc25/` CC25-01 to CC25-09.

## 3. Results (local, disposable)

| Suite | Result |
|---|---|
| Database security cycle (11 node tests, 89 SQL checks per run) | **11/11 PASS** |
| Browser journeys, final run | **121 checks: 119 PASS, 1 FAIL (H6b, protected homepage rail, P2), 1 BLOCKED (D8, needs NW07)** |
| Vitest | **176 files, 3,060 passed, 1 skipped** (CC-24: 175 files, 3,045 passed, 1 skipped; no test removed or weakened) |
| TypeScript, ESLint, build, `npm audit`, `git diff --check` | PASS; 0 errors / 18 warnings (unchanged); PASS; 0 vulnerabilities; clean |
| V5.4 homepage | DOM identical; 16/16 frames; 39/39 protected files unchanged |
| CC-18 security files | 45/45 unchanged |

## 4. Open items blocking production

**Urgency.** The three P0 counsellor-access defects and the anonymous audit-log forgery (P1) are pre-existing in the current schema. They are probably live in production already. Treat 0023, and NW-F01 `01` or the 0024 stopgap, as security fixes to fast-track: QA first, then a separately approved production change. Until then, keep counsellor accounts limited to trusted staff and review `admin_audit_log` entries whose actor is "system" with care.

1. **QA:** approve and apply 0023 (CC25-02 §8), then run the Preview journeys (CC25-09 §4).
2. **Human security sign-off** on the 0023 package.
3. **Pre-existing P1:** anonymous EXECUTE on internal definer RPCs. Approve NW-F01 `01` or the 0024 stopgap.
4. **Portrait rights:** BLOCKED (CC25-05 §6).
5. **Safari/iOS, Firefox, Edge, Android** checks.
6. **Payments:** CC-19/CC-20/NW01. Keep checkout off until then.
7. **NW07:** revise its counsellor case-access rule before approval (CC25-02 §3).

**Lower priority:**
- H6b: homepage rail hit area (needs design sign-off).
- E9: soft 404 for an unknown application (P3).
- Default table grants: TRUNCATE etc. (P2).
- Inactive-counsellor caseload path (P2).
- Direct unpaid-invoice creation through the API (P2, payment workstream).

## 5. Exact next release action

On the PC:

```powershell
powershell -ExecutionPolicy Bypass -File C:\ClaudeBuilds\Milestones\CC25-STAGING-ACCEPTANCE\Finish-CC25.ps1 -InstallDependencies -Commit
```

Then reply with:
- **approval to apply 0023 to QA** `ynwzijulzksmrcwdhudv` (and whether to include 0024);
- **authorization to push** `cc25/staging-acceptance` and build the QA Preview.
