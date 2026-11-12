# CC26-11: Changed files (against `706df7d`)

43 paths: 11 modified, 31 added, 1 deleted. The exact hashes are in `CC26-FILE-MANIFEST.json` (milestone folder).

There are no dependency changes. No CC-18 protected file (45) or V5.4 protected file (39) was changed.

## App

| Path | Change |
|---|---|
| `src/app/(site)/applications/[id]/layout.tsx` | **Added.** Login redirect plus an ownership check before the Suspense boundary, so an unknown application answers a genuine 404 |
| `src/app/(site)/applications/[id]/page.tsx` | Uses the shared cached lookup |
| `src/app/(site)/applications/page.tsx` | The list skeleton is now the page's own Suspense fallback |
| `src/app/(site)/applications/list-skeleton.tsx` | **Added.** The skeleton markup, unchanged, moved here from `loading.tsx` |
| `src/app/(site)/applications/loading.tsx` | **Deleted** (applied by `Finish-CC26.ps1`) |
| `src/lib/supabase/education/application-lookup-cached.ts` | **Added.** `cache(getMyApplicationById)` |
| `src/lib/supabase/pricing/checkout.ts` | The database gate's refusal is shown as "checkout paused"; `studentSafePurchaseError` is exported |
| `package.json` | `test:db-security` also runs the CC-26 harness |

## Database (proposed; not applied anywhere)

| Path | Change |
|---|---|
| `supabase/migrations-proposed/cc25/0023_cc25_counsellor_identity_least_privilege.sql` | **Revision 2:** NW07 narrowing (section 7b), NW07 drift check, pinned `search_path`, stricter postconditions |
| `…/cc25/0023_cc25_ROLLBACK.sql` | Restores the NW07 state it replaced (marker); re-run safe |
| `…/cc25/0023_cc25_rls_tests.sql` | G02 expects `pg_catalog, pg_temp` |
| `…/cc25/0024_cc25_ROLLBACK.sql` | Restores the exact ACL order |
| `…/cc26/0025_*` (+ rollback) | **Added.** Inactive counsellors; table privileges |
| `…/cc26/0026_*` (+ rollback) | **Added.** Database checkout gate |
| `…/cc26/cc26_qa_preflight_readonly.sql` | **Added.** Read-only QA preflight |
| `…/cc26/cc26_security_tests.sql` | **Added.** 45-check suite, always rolled back |
| `supabase/migrations-proposed/NW07_counsellor_studio_foundation.sql` | PART 1 replaced: caseload-only without 0023, approval-gated with it |

## Tests and tools

| Path | Change |
|---|---|
| `scripts/security/cc26-security-closure.db.test.mjs` | **Added.** 32-test disposable-database harness |
| `scripts/security/fixtures/NW07_part1_original.sql` | **Added.** The original NW07 PART 1, to rebuild QA's recorded state in tests |
| `src/lib/applications/cc26-application-404.test.ts` | **Added.** 7 tests |
| `src/lib/payments/cc26-database-checkout-gate.test.ts` | **Added.** 6 tests |
| `src/lib/recommendations/recommendation-drafts-migration-security.test.ts` | PART 1 tests now assert the secure rule (CC26-01 §5) |
| `src/lib/discovery-sessions/cc25-identity-lookup.test.ts` | Two static guards updated, same strength (CC26-01 §5) |
| `scripts/home/validate-v54-portrait.mjs` and `.test.ts` | **Added.** Portrait replacement gate (rights and composition); 7 tests |
| `docs/home-v5-4/portrait-composition-reference.json` | **Added.** Measured framing of the approved portrait |

## Docs

`docs/cc26/CC26-00` to `CC26-12`, `docs/cc26/qa/Run-CC26-Qa.ps1`, `docs/cc26/templates/PORTRAIT-RIGHTS-RECORD.template.md`.

## Follow-up commit on top of `387c53d` (2026-11-12, NW07 remediation)

| Path | Change |
|---|---|
| `supabase/migrations-proposed/cc26/0025_cc26_inactive_counsellor_and_grant_hardening.sql` | F4: recommendation drafts need current case access (S11) |
| `supabase/migrations-proposed/cc26/0025_cc26_ROLLBACK.sql` | F4 rollback (exact NW07 text, only over the CC-26 bodies) |
| `supabase/migrations-proposed/cc26/cc26_security_tests.sql` | Revision 2: 76 checks on an NW07 database (+31) |
| `supabase/migrations-proposed/cc26/cc26_qa_preflight_readonly.sql` | Revision 2: sections 7–10 (NW07 classification, dependants, F4 drift, exposure scope, apply window) |
| `supabase/migrations-proposed/cc26/cc26_qa_export_readonly.sql` | **Added.** Read-only definitions export |
| `docs/cc26/qa/Run-CC26-Qa.ps1` | Export and Backup steps; SHA-256 pinning |
| `docs/cc26/qa/CC26-QA-SQL-SHA256.txt` | **Added.** 12 pinned hashes |
| `scripts/security/cc26-security-closure.db.test.mjs` | New counts; mutants MU8–MU12 |
| `src/lib/recommendations/cc26-recommendation-author-access.test.ts` | **Added.** 25 static guards |
| `docs/cc26/CC26-00`, `-01`, `-02`, `-09`, `-10`, `-11`, `-12`; `CC26-13` **added** | Evidence package updated |

No app code, dependency, protected CC-18 file or V5.4 homepage file changed.

## Follow-up 2 on top of `ea7c1cd` (2026-11-12, independent SQL review)

| Path | Change |
|---|---|
| `supabase/migrations-proposed/cc26/0025_cc26_inactive_counsellor_and_grant_hardening.sql` | F3 records the exact revoked privileges (schema `nextwise_cc26_state`); F4 accepts only the three known fingerprints; new postconditions |
| `supabase/migrations-proposed/cc26/0025_cc26_ROLLBACK.sql` | Re-grants only the recorded privileges; re-runnable; keeps NW-F01's stricter grants |
| `supabase/migrations-proposed/cc26/cc26_qa_preflight_readonly.sql` | F4 state shows each fingerprint and marks unknown ones; 0025 record state |
| `docs/cc26/qa/Run-CC26-Qa.ps1` | Resolves and validates the CC-26 worktree (also from the milestone copy); `-RepoRoot` |
| `docs/cc26/qa/CC26-QA-SQL-SHA256.txt` | New hashes for 0025, its rollback and the preflight |
| `scripts/security/cc26-security-closure.db.test.mjs` | +9 tests (grant configurations, unknown fingerprints) |
| `src/lib/recommendations/cc26-recommendation-author-access.test.ts` | Stricter F4 guard; 2 new F3 rollback guards |
| `docs/cc26/CC26-01`, `-02`, `-09`, `-11`, `-13` | Updated |
