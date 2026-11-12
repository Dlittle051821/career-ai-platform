# CC-26 evidence package: Launch Readiness, Security Closure & Production Hardening

**Base:** `706df7d` (the CC-25 commit) on branch `cc26/launch-readiness`, worktree `C:\ClaudeBuilds\CC26-LAUNCH-READINESS`.

**Prepared by:** Claude, 2026-11-11 (Europe/Berlin).

Nothing was committed, pushed, deployed or applied to any shared database:
- not QA `ynwzijulzksmrcwdhudv`;
- not production;
- not `C:\carrier.ai` or the CC-25 worktree.

Payments and paid AI remain off.

| Doc | Deliverable |
|---|---|
| CC26-01 Security closure | Findings S1–S10, fixes, verification, changed test assertions |
| CC26-02 QA migration procedure | Preflight, apply order, tests, recovery, **approval requests A1–A7** |
| CC26-03 Payment safety | Database checkout gate, ₹1,999 tax boundary, entitlements |
| CC26-04 Homepage accessibility and visual | The six skip links (not touch targets), evaluator correction, V5.4 unchanged |
| CC26-05 Portrait rights and replacement | Investigation, options, creative brief, swap gate |
| CC26-06 Student journey acceptance | Browser journeys on the CC-26 build |
| CC26-07 NW07 review | Patch, prerequisites, features waiting for activation |
| CC26-08 Browser matrix | Chromium PASS; other engines BLOCKED |
| CC26-09 Release verification | Typecheck, lint, Vitest, DB tests, build, audit, secret scan, diff check |
| CC26-10 Production readiness and GO/NO-GO | Checklist and recommendation |
| CC26-11 Changed files | Every file and its purpose |
| CC26-12 QA Preview | Prepared Preview steps and smoke test |
| **CC26-13 QA remediation and approval checkpoint** | **2026-11-12: confirmed NW07 defect on QA, root cause, F4, closure status, hashes, approvals A1–A8** |
| `qa/Run-CC26-Qa.ps1` | Guarded QA runner (Preflight / Export / Backup / Apply / Tests / Rollback); every SQL file pinned by `qa/CC26-QA-SQL-SHA256.txt` |
| `templates/PORTRAIT-RIGHTS-RECORD.template.md` | Rights record required before any portrait swap |

The evidence logs and screenshots are in the milestone folder `C:\ClaudeBuilds\Milestones\CC26-LAUNCH-READINESS\evidence`.
