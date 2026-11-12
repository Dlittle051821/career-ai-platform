# CC26-09: Release verification

Run on the CC-26 tree in the Linux build environment (Node 22, PostgreSQL 16, Chromium 141). The Windows equivalent is `Finish-CC26.ps1` in the milestone folder: it re-runs typecheck, lint, Vitest, audit, build and diff check on the PC, and refuses to commit if any check fails.

| Check | Command | Result | Evidence |
|---|---|---|---|
| TypeScript | `tsc --noEmit --incremental false` | **exit 0** | `evidence/regression/typecheck.log` |
| ESLint | `eslint .` | **0 errors**, 18 warnings (all `no-img-element`, unchanged since CC-24) | `eslint.log` |
| Vitest | `vitest run` | **179 files; 3,082 passed, 1 skipped** (CC-25: 176 files, 3,060). The +22 are new CC-26 tests. | `vitest.log` |
| DB security, CC-26 | `node --test scripts/security/cc26-security-closure.db.test.mjs` | **32/32** | `evidence/db/cc26-security-closure.db.test.log` |
| DB security, CC-25 | `node --test scripts/security/cc25-counsellor-identity.db.test.mjs` | **11/11** | `evidence/db/cc25-counsellor-identity.db.test.log` |
| NW-F01 SQL suites (CC-18 protected) | rehearsal / offline PGlite 0.5.15 / concurrency | **12/12, 79/79, 10/10** | `evidence/payments/` |
| Atomic artifact drift | `assemble-nw09-2-atomic.mjs --check` | no drift | `evidence/payments/nw09-atomic-drift-check.log` |
| Browser E2E | CC-26 harness (`harness/run-all.sh`) | **124 checks: 123 PASS, 1 BLOCKED (D8)** | CC26-06, `evidence/final/` |
| Homepage visual regression | suite V against the deployed `a1017b9` | DOM identical; 16/16 frames match | `evidence/final/suite-v-homepage.log` |
| Homepage touch targets and skip links | `probe-skipnav.cjs`, `probe-targets-cc26.cjs`, control | 0 failures at 10 configurations; the evaluator control still flags real failures | `evidence/skipnav/` |
| Payment safety | CC-26 SQL P00–P11, browser suites P and G, Vitest payment tests | all pass (P11 is a measurement) | CC26-03 |
| Production build | `next build` | **exit 0** | `evidence/regression/build.log` |
| npm audit | `npm audit --audit-level=low` | **0 vulnerabilities**; no dependency change in CC-26 | `npm-audit.log` |
| Secret scan | CC-25 patterns over every changed or added file | **0 hits** | `secret-scan.log` |
| Git diff check | `git diff --check` plus a whitespace scan of new files | clean | `diff-check.log` |
| Protected files | 45 CC-18 security files; 39 V5.4 homepage/brand files | **all unchanged** | manifest `cc18Files`, `homepageFiles` |
| QA runner and Preview smoke test | PowerShell parse check; guard refusals; Preview smoke rehearsed locally | parse 0 errors; production, foreign-host and port refusals work; smoke **24/24** | `evidence/regression/` |

## Windows line-ending fix (2026-11-12)

The first `Finish-CC26.ps1` run on the PC failed 8 Vitest tests: 7 in `recommendation-drafts-migration-security.test.ts` and 1 in `cc25-identity-lookup.test.ts`.

- **Cause:** a test-parser defect, not a security defect. On Windows the worktree is CRLF. The assertions added in CC-26 match multi-line SQL text containing `"\n"` (for example `"do $nw07$\n"` and `"set search_path = pg_catalog, pg_temp\n"`), and that never matches CRLF. The SQL is byte-identical to the tested source apart from line endings, and its behaviour was proven on PostgreSQL by the database harness, which normalises line endings.
- **Fix:** both tests now normalise `\r\n` to `\n` when reading the SQL. No assertion was removed, skipped or relaxed.
- **Verified:**
  - the two suites pass, 56/56;
  - the full Vitest suite passes 179 files / 3,082 passed / 1 skipped, both on the normal tree and on a full CRLF copy of the tree (the Windows simulation, `vitest-crlf-windows-simulation.log`);
  - under CRLF the assertions still fail against the original unsafe NW07 (8 failures) and against an empty `search_path` in 0023 (1 failure);
  - TypeScript, ESLint (0 errors / 18 warnings), npm audit (0) and `next build` pass again.

## Follow-up after `387c53d` (2026-11-12, NW07 remediation)

| Check | Result |
|---|---|
| TypeScript / ESLint | exit 0 / 0 errors, 18 warnings (unchanged) |
| Vitest | **180 files; 3,107 passed, 1 skipped** (+1 file, +25 static guards in `cc26-recommendation-author-access.test.ts`) |
| DB harness CC-26 / CC-25 | **32/32** (suite revision 2: 76 on qa, 40 + 35 SKIP on base; 12 mutants on qa) / **11/11** |
| npm audit / build / secret scan / diff check | 0 / exit 0 / 0 hits / clean |
| QA runner rehearsal (Linux pwsh 7.4, local copy of the QA model, SSL, port 5432) | Preflight, Export, Backup, hash-tamper refusal, Apply (+gate), Tests 89/89 and 76/76, drift stop after 0023/0024, Rollback back to the exact pre-state fingerprint |
| Preview, signed out | QA ref only; no production ref, `service_role` or `rzp_live_` in client chunks; protected routes redirect to `/login`; unknown page 404; homepage main DOM identical to www.nextwise.world |

## Not run (needs access or approval)

- Any SQL against QA (approvals A1–A3) or production (never).
- The QA Preview and its signed-in journeys (A5).
- Firefox, Safari, Edge, real iOS and Android devices (BLOCKED, CC26-08).
- `npm run test:db-security` on the Windows PC: it needs a local PostgreSQL there. It ran in the build environment (rows above).
