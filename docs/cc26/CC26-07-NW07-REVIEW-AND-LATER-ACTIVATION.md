# CC26-07: NW07 review and features that need later activation

**NW07 was not applied anywhere by CC-26.** The proposal file was reviewed and patched so that no unapproved Discovery Session assignment can grant access to a student's information.

## 1. Review result

`supabase/migrations-proposed/NW07_counsellor_studio_foundation.sql` (as committed at `706df7d`) has two parts:

- **PART 1** widened 15 counsellor policies and the new `counsellor_has_case_access()` to a "dual basis": the caseload assignment **or any Discovery Session assigned to the counsellor**. Counsellors may claim unassigned requests themselves, so in effect any counsellor could obtain any requesting student's identity, full Student Digital Profile and case notes, and could write notes. This is CC26-01 finding **S1** (P0 where applied).
- **PART 2** (Recommendation Workflow) is sound: an RPC-only state machine, self-approval blocked in the database, and student reads only through `get_my_*` functions with safe return shapes. It is unchanged.

The project notes record NW07 (with NW05, NW06 and NW09) as **already applied to QA**. The CC-26 preflight (marker Q1) confirms or refutes this before anything is applied.

## 2. Patch (PART 1 only)

PART 1 is now one block that adapts to the database it runs on:

| Database | What the patched PART 1 does |
|---|---|
| **cc25/0023 r2 already applied** | Runs the CC-26 shared block, which is byte-identical to 0023 r2 section 7b. `counsellor_has_case_access` = caseload **or** `counsellor_has_active_session_for_student` (admin-approved, requested or scheduled, active counsellor). The 11 profile tables, `admin_student_meta` SELECT and `admin_student_notes` SELECT and INSERT require it. `profiles` stays the 0004 caseload-only rule. |
| **0023 not applied** | Defines `counsellor_has_case_access` as **caseload only** and leaves the 0004 policies untouched. It never refuses and is never unsafe; applying 0023 r2 later adds the approved-session basis. |

Common to both:
- the function is `SECURITY DEFINER`, `STABLE`, with `search_path = pg_catalog, public, pg_temp`;
- EXECUTE is granted to `authenticated` only (revoked from PUBLIC, `anon` and `service_role`).

Proven on local PostgreSQL 16 (`scripts/security/cc26-security-closure.db.test.mjs`):

- **Three apply orders converge to the identical catalog:** original NW07 then 0023 r2 (QA today), patched NW07 then 0023 r2, and 0023 r2 then patched NW07.
- **Patched NW07 without 0023:** no Discovery Session basis anywhere, and a self-claim exposes nothing.
- **Rollback of 0023:** restores exactly the NW07 state it replaced. The rollback also leaves the safe caseload-only state when NW07 was applied after 0023.
- **Behaviour (CC-26 suite N01–N13):**
  - an unapproved self-claim cannot read profiles, meta or notes, write notes, or create recommendation drafts;
  - an approved active session can read the profile tables and add notes, but **not** the `profiles` row;
  - a completed session grants nothing;
  - caseload access is unchanged;
  - `anon` cannot execute the helper.
- **The CC-18 NW-F01 suites,** which apply NW07 without 0023, still pass unchanged: 12/12, 79/79 and 10/10.

## 3. Prerequisites before NW07 features are activated anywhere

1. `cc25/0023` revision 2 (approval-gated sessions). Then `cc26/0025` (inactive counsellors).
2. NW05 and NW06, in that order (application tasks are read on the application page).
3. NW07, the **patched** file. Never the `706df7d` version.
4. NW09, then the NW-F01 `NW09_2_ATOMIC_01-03.sql`. **Never** `NW09_2_openai_live_pilot.sql`.
5. A human security review of NW07 PART 2 and NW09, recorded in writing.
6. For AI features only: legal and privacy sign-off, a data processing addendum with the provider, and budget caps. These are separate business approvals (NW09.2 report).

## 4. Features waiting for activation

| Feature | Where | Needs | Behaviour today without the migration |
|---|---|---|---|
| Student recommendation reports | `/recommendations` (student) | NW07 | Honest "temporarily unavailable" state (journey D8 BLOCKED, by design) |
| Counsellor Studio: student case pages, recommendation drafts and review, verifications queue | `/counsellor/students/*`, `/counsellor/recommendations/*`, `/counsellor/verifications` | NW07 (+ 0023 r2) | Not exercised in CC-26 (NW07 is not applied locally). The AI page shows "not available" states; the other counsellor pages were not checked without NW07. Verify them on the QA Preview |
| Application tasks | `/applications/[id]`, `/counsellor/tasks` | NW06 | Tasks section hidden or empty |
| "Self-entered" profile provenance | Profile wizard | NW05 | Save still works; provenance marking skipped |
| AI Career Intelligence (counsellor-only, mock provider) | `/counsellor/students/[id]/ai-career-intelligence` | NW09 + NW-F01 atomic | "Not available yet"; production keeps AI disabled |
| Live OpenAI provider | — | NW-F01 atomic + legal/DPA + explicit approval | Disabled (no keys; `AI_OPENAI_APPROVED` unset) |

No unfinished recommendation-report functionality was added in CC-26.
