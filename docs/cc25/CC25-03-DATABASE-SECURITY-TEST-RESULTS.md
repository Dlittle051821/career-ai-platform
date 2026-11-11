# CC25-03: Database security test results

**Where these ran:** a disposable local PostgreSQL 16, built from the repository's real migrations 0001–0022 with the Supabase-style role and default-grant shim. No QA or production database was used. Every user and record is fictional (`@example.test`).

**How to re-run:**

```
NW_SECURITY_PG_ADMIN_URL=postgres://postgres@127.0.0.1:<port>/postgres NW_SECURITY_PG_DISPOSABLE=1 npm run test:db-security
```

That command runs `scripts/security/cc25-counsellor-identity.db.test.mjs`. The same checks can be run on QA, after approval, with `psql -v ON_ERROR_STOP=1 -f 0023_cc25_rls_tests.sql`. The file exits 3 when any check fails.

## 1. The required sequence

| Step | What | Result |
|---|---|---|
| 1 | 1. baseline: the [CC25] checks fail (defects reproduced), every other check passes | **PASS** |
| 2 | 2a. the migration is refused without the approval setting and changes nothing | **PASS** |
| 3 | 2b. a forced failure before COMMIT leaves the catalog and data byte-identical | **PASS** |
| 4 | 2c/3. migration applies; every security check passes | **PASS** |
| 5 | 4/5. rollback restores the exact pre-migration catalog and the baseline behaviour | **PASS** |
| 6 | 6/7. reapply, idempotent re-run, final security tests | **PASS** |
| 7 | 8. mutation "identity RPC ignores the session status" is detected by the suite | **PASS** |
| 8 | 8. mutation "identity RPC ignores the approval" is detected by the suite | **PASS** |
| 9 | 8. mutation "guard trigger does not lock student_user_id" is detected by the suite | **PASS** |
| 10 | 8. mutation "provenance helper ignores the status" is detected by the suite | **PASS** |
| 11 | 9. stopgap 0024: anon and students lose EXECUTE, service_role keeps it, rollback restores the grants | **PASS** |

Checks per run (out of 89):

| Run | PASS | FAIL | Expected |
|---|---|---|---|
| 1 Baseline (before 0023) | 48 | 41 | every [CC25] check FAILs (defect reproduced), every other check PASSes |
| 3 After migration | 89 | 0 | all PASS |
| 5 After rollback | 48 | 41 | identical to baseline |
| 7 After reapply (final) | 89 | 0 | all PASS |
| 9 Final with optional 0024 also applied | 89 | 0 | all PASS |

`psql` exit codes on the local stack database: **3** before the migration (41 of 89 failed) and **0** after (89/89). Running the tests without the target setting also exits 3. Logs: `evidence/psql-tests-stackdb-before.txt` and `-after.txt`.

## 2. Mutation tests (the suite catches weakened SQL)

Each mutant is the real migration with one safeguard removed; the suite must fail on the stated checks.

| Mutant | Must be caught by | Result |
|---|---|---|
| identity RPC ignores the session status | I04 | **PASS** |
| identity RPC ignores the approval | I03 | **PASS** |
| guard trigger does not lock student_user_id | A01, M08 | **PASS** |
| provenance helper ignores the status | V03, V04 | **PASS** |

The mutation step found one weak check during development. M08 had passed for the wrong reason: a unique index raised the error instead of the lock. It was fixed by giving M08 a target student with no other booking.

## 3. Optional stopgap 0024

| Check | Result |
|---|---|
| Baseline: `anon` can execute `record_system_audit_log` and forge a system audit row (defect reproduced) | **PASS** (reproduced) |
| Refused without approval setting | **PASS** |
| After 0024: anon/authenticated get 42501; service_role still executes | **PASS** |
| Re-runnable; rollback restores the exact privilege matrix | **PASS** |
| 0023 suite still 89/89 with 0024 applied | **PASS** |

Overall step 9: **PASS**.

## 4. Every check: baseline vs final

`[CC25]` marks checks that can only pass with the CC-25 migration. The baseline must fail them.

| ID | Check | Baseline | Final |
|---|---|---|---|
| G01 | [CC25] identity RPC exists and returns exactly session_id, student_user_id, full_name, email | FAIL | PASS |
| G02 | [CC25] identity RPC is SECURITY DEFINER with an empty search_path | FAIL | PASS |
| G03 | [CC25] anon and PUBLIC cannot execute any CC-25 function | FAIL | PASS |
| G04 | no profiles policy references discovery_sessions (profiles RLS not widened) | PASS | PASS |
| G05 | the rejected CC-24 profiles policy is absent | PASS | PASS |
| G06 | profiles still has exactly its three pre-existing policies | PASS | PASS |
| G07 | [CC25] no workspace/provenance/verification policy trusts an unapproved discovery_sessions assignment | FAIL | PASS |
| G08 | [CC25] guard triggers are installed on discovery_sessions and admin_student_meta | FAIL | PASS |
| G09 | [CC25] admin assignment is recorded as approved by the admin (database-stamped) | FAIL | PASS |
| G10 | [CC25] a counsellor self-claim is recorded as NOT approved | FAIL | PASS |
| I01 | [CC25] A gets name and email of the student in an admin-approved scheduled session | FAIL | PASS |
| I02 | [CC25] A gets nothing for an unassigned session | FAIL | PASS |
| I03 | [CC25] A gets nothing for a self-claimed, unapproved session | FAIL | PASS |
| I04 | [CC25] A gets nothing for completed, cancelled and no-show sessions | FAIL | PASS |
| I05 | [CC25] multiple sessions: A gets nothing for S7 (own session completed, active one is B's) | FAIL | PASS |
| I06 | [CC25] a mixed batch returns only the authorized session | FAIL | PASS |
| I07 | identity RPC rejects more than 100 ids | PASS | PASS |
| I08 | [CC25] identity RPC with an empty or null list returns nothing | FAIL | PASS |
| P01 | A cannot read the approved student's profiles row directly (no table-level widening) | PASS | PASS |
| P02 | A cannot read any fixture student profile directly | PASS | PASS |
| P03 | A cannot update a student profile | PASS | PASS |
| P04 | A cannot delete a student profile | PASS | PASS |
| Q01 | A still sees unassigned requests in the triage queue | PASS | PASS |
| Q02 | A cannot see B's session | PASS | PASS |
| A01 | [CC25] A cannot change student_user_id on a session A holds (approved) | FAIL | PASS |
| A02 | [CC25] A cannot change student_user_id on A's own unapproved claim | FAIL | PASS |
| A03 | [CC25] A cannot claim an unassigned session while changing its student | FAIL | PASS |
| A04 | A cannot approve A's own claim by writing the approval column | PASS | PASS |
| A05 | A cannot approve via the admin approval RPC | PASS | PASS |
| A06 | [CC25] with an unapproved claim A cannot cancel the session | FAIL | PASS |
| A07 | with an unapproved claim a no-op save is still allowed (form re-submit) | PASS | PASS |
| A08 | A cannot hand A's session to B | PASS | PASS |
| A09 | A cannot update B's session | PASS | PASS |
| A10 | A cannot delete a Discovery Session | PASS | PASS |
| A11 | A cannot insert a Discovery Session for a student | PASS | PASS |
| A12 | A cannot create a caseload row (admin_student_meta) | PASS | PASS |
| A13 | A cannot grant itself an admin role | PASS | PASS |
| A14 | A cannot reactivate counsellor C | PASS | PASS |
| W01 | A can create the workspace of the approved session | PASS | PASS |
| W02 | [CC25] A cannot create the workspace of an unapproved claim | FAIL | PASS |
| V01 | A can record provenance for the approved, active session's student | PASS | PASS |
| V02 | [CC25] A cannot record provenance after only self-claiming the session | FAIL | PASS |
| V03 | [CC25] A cannot record provenance for the student of a completed session | FAIL | PASS |
| V04 | [CC25] A cannot record provenance for the student of a cancelled session | FAIL | PASS |
| V05 | [CC25] A cannot record a recommendation verification after only self-claiming | FAIL | PASS |
| V06 | A can record a recommendation verification for the approved, active session's student | PASS | PASS |
| C01 | caseload counsellor D still reads the caseload student's profile directly | PASS | PASS |
| C02 | [CC25] caseload counsellor D gets the identity even for a completed session | FAIL | PASS |
| C03 | caseload counsellor D can still record provenance for the caseload student | PASS | PASS |
| C04 | [CC25] D cannot repoint D's caseload row at another student (caseload hijack) | FAIL | PASS |
| C05 | D can still update the status of D's caseload row | PASS | PASS |
| C06 | D cannot read profiles of students outside D's caseload | PASS | PASS |
| B01 | [CC25] B gets the identity for B's approved scheduled session (S7, second session) | FAIL | PASS |
| B02 | [CC25] B gets nothing for A's sessions | FAIL | PASS |
| B03 | B cannot read A's workspace | PASS | PASS |
| B04 | B cannot read provenance A recorded for S1 | PASS | PASS |
| X01 | [CC25] an inactive counsellor gets no identity, even for an approved scheduled session | FAIL | PASS |
| X02 | [CC25] an inactive counsellor cannot record provenance through a session | FAIL | PASS |
| S01 | a student reads only their own profile | PASS | PASS |
| S02 | a student sees only their own Discovery Sessions | PASS | PASS |
| S03 | a student cannot use the staff identity RPC | PASS | PASS |
| S04 | a student cannot update their own booked session (staff-managed) | PASS | PASS |
| S05 | a student cannot book a session pre-assigned to a counsellor | PASS | PASS |
| S06 | a student cannot read the staff workspace of their own session | PASS | PASS |
| S07 | a student cannot grant themselves an admin role | PASS | PASS |
| S08 | a student cannot delete their profile row | PASS | PASS |
| S09 | [CC25] a student's booking cannot carry a forged approval | FAIL | PASS |
| N01 | anonymous reads no profile, session or workspace | PASS | PASS |
| N02 | anonymous cannot execute the identity RPC | PASS | PASS |
| N03 | anonymous cannot book a session | PASS | PASS |
| N04 | anonymous cannot update or delete sessions | PASS | PASS |
| M01 | admin reads every fixture student profile | PASS | PASS |
| M02 | [CC25] admin gets identities for any session | FAIL | PASS |
| M03 | approval RPC refuses a stale counsellor id | PASS | PASS |
| M04 | approval RPC refuses a completed session | PASS | PASS |
| M05 | [CC25] admin approves A's self-claim of S3 through the RPC | FAIL | PASS |
| M06 | [CC25] the approval is audited with the admin as actor | FAIL | PASS |
| M07 | [CC25] approved_by cannot be forged, even by an admin writing the column | FAIL | PASS |
| M08 | [CC25] even an admin cannot change the student on a booking (target has no other booking) | FAIL | PASS |
| M09 | [CC25] unassignment clears the approval | FAIL | PASS |
| R01 | [CC25] after approval A gets S3's identity | FAIL | PASS |
| R02 | [CC25] after reassignment to B, A gets nothing for S1 | FAIL | PASS |
| R03 | after reassignment, A loses the workspace of S1's session | PASS | PASS |
| R04 | after reassignment, A loses S1's provenance | PASS | PASS |
| R05 | [CC25] after unassignment, A gets nothing for S11 | FAIL | PASS |
| R06 | [CC25] after an admin reassigns S1 to B, B gets S1's identity | FAIL | PASS |
| R07 | after reassignment, B reads the session workspace | PASS | PASS |
| Z01 | a privileged server role can delete a counsellor who holds approved assignments | PASS | PASS |
| Z02 | [CC25] deleting that counsellor left the session unassigned with no approval | FAIL | PASS |

## 5. Coverage against the brief

| Required test | Checks |
|---|---|
| Admin-approved assignment | G09, I01, B01, M05, R01, R06 |
| Counsellor self-claim | G10, I03, A02, A04, A06, W02, V02, V05 |
| Unassigned sessions | I02, Q01, R05 |
| Reassignment | R02, R03, R04, R06, R07 |
| Unassignment | M09, R05 |
| Completed / cancelled / no-show | I04, V03, V04 |
| Multiple sessions for one student | I05, B01 |
| Attempts to modify student_user_id | A01, A02, A03, M08, C04 |
| Unauthorized student profiles | P01, P02, B02, C06, S01 |
| Extra profile columns | G01 (exact result type), P01/P02 (no direct row) |
| RPC misuse | I06, I07, I08, A05, S03, N02, M03, M04 |
| Counsellor-to-counsellor isolation | Q02, A08, A09, B02, B03, B04 |
| Existing caseload access | C01, C02, C03, C05 |
| Student-to-student isolation | S01, S02 |
| Anonymous access | N01, N02, N03, N04 |
| Unauthorized INSERT / UPDATE / DELETE | P03, P04, A10, A11, A12, A13, A14, S04, S05, S07, S08, N03, N04 |
| Inactive counsellor | X01, X02 |
| Privileged deletion consistency | Z01, Z02 |

## 6. What was NOT run

- **QA (`ynwzijulzksmrcwdhudv`): NOT RUN.** It needs your approval (CC25-02 §8). No credentials for QA were used in CC-25.
- **Production: never.**
- **The Windows PC:** these tests need a PostgreSQL server, and the PC has none set up. They ran in the cloud workspace only.

