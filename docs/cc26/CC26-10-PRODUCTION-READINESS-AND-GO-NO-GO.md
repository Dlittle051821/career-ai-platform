# CC26-10: Production-readiness checklist and GO/NO-GO

## 1. Checklist

| # | Item | Status |
|---|---|---|
| 1 | P0/P1 security defects fixed in code and proven on a disposable database (S1–S10) | **DONE locally** |
| 2 | The same fixes applied and tested on QA (A1–A3) | **OPEN**: needs your approval. QA confirmed vulnerable (original NW07), 2026-11-12; see CC26-13 |
| 2b | Draft authorship bypass (S11) closed by 0025 F4 | **DONE locally**; QA with A2 |
| 3 | Production exposure to S1 known (does production have NW07?) | **OPEN**: your read-only dashboard check (A7) |
| 4 | Existing Discovery Session assignments approved by admins after 0023 (A4) | OPEN |
| 5 | Human (non-AI) security review of 0023 r2–0026 and NW07 | OPEN |
| 6 | Typecheck, lint, Vitest 3,082/3,082, build, audit 0, secret scan, diff check | **PASS** (here); `Finish-CC26.ps1` repeats them on the PC |
| 7 | Browser journeys on the identical build (Chromium) | **123 PASS, 1 BLOCKED** (D8, NW07) |
| 8 | Journeys on the QA Preview | Signed-out checks PASS (CC26-13 §7). Signed-in: **BLOCKED** (A8; best after A2) |
| 9 | Firefox, Safari, Edge, iOS and Android | **BLOCKED**: not available here |
| 10 | Application detail answers a genuine 404 | **DONE** |
| 11 | V5.4 homepage preserved; touch targets | **DONE**: unchanged; 0 failures (H6b was a false positive) |
| 12 | Commercially safe portrait | **OPEN**: no rights documented; the replacement gate is ready; needs a licensed image and your design approval |
| 13 | Payments | **OFF**, now enforced in the database as well (0026 on QA pending). Activation needs NW01, NW-F01 05/06, test-mode checks and written approval |
| 14 | Paid AI | **OFF**; NW09 live pilot never to be applied |
| 15 | Rollback ready: code (`Rollback-CC26.ps1`), each SQL migration (byte-identical rollback), backup | **READY** |
| 16 | Other student images' provenance (4 files) | OPEN (P2) |

## 2. Recommendation

| Decision | Recommendation |
|---|---|
| Local commit of CC-26 (`Finish-CC26.ps1 -Commit`) | **GO** |
| QA preflight (A1) | **GO**, now |
| QA migrations 0023 r2, 0024, 0025 (A2), then 0026 (A3) | **GO after A1 shows no drift.** If Q1 shows NW07 on QA, treat A2 as urgent: S1 is live there |
| QA Preview of `cc26/launch-readiness` (A5) | **GO** after the commit; best after A2 |
| Milestone acceptance | **NOT YET.** S1 (P0) and the S3–S8 P1s stay open on QA until A2 and A3 run, and a milestone cannot be accepted with a P0 open |
| Production deployment | **NO-GO** |
| Production SQL | **NO-GO** (never from here). If A7 finds NW07 in production, plan 0023 r2 for production as an urgent, separately approved change |
| Payments / paid AI | **NO-GO** |

**Path to production GO:**
1. A1–A4 green on QA.
2. Preview journeys pass on Chrome, Safari/iOS and Android.
3. Human security sign-off.
4. A licensed portrait is in place (or legal accepts the current one in writing).
5. A production migration plan is approved.
