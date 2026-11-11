# CC24-03 — Security and RLS report

All tests in this report ran on the local, disposable stack:
- the repository's migrations 0001–0022;
- real GoTrue and PostgREST;
- fictional `@example.test` accounts.

Nothing ran against QA or production, and **no migration was applied anywhere except the local container database**. There, 0023 was applied inside rolled-back transactions and during suite R, then rolled back.

## 1. Role isolation matrix (browser, suite R + B/F/G)

| Role | Check | Result |
|---|---|---|
| Anonymous | `/dashboard`, `/profile`, `/admin`, `/admin/*`, `/counsellor`, `/counsellor/*` redirect to `/login?next=` (R1, B10: 17 student routes) | **PASS** (`/counsellor` fixed in CC-24, D05) |
| Anonymous | `?next` open-redirect payloads (7) stay on the app origin (B12, B12b) | **PASS** |
| New student | Can read and write only their own profile rows (C2 rows verified per table). Cannot read another student (SQL test) | **PASS** |
| Returning student | `/admin` shows "Access denied". A counsellor session URL shows no other student's identity (R2) | **PASS** |
| Assigned counsellor | Sees their assigned session. Today: the student's identity is hidden by RLS and labelled "Student details restricted" (R3) | **PASS** for the label; identity access **BLOCKED** on 0023 |
| Unassigned counsellor | Cannot list or open another counsellor's session (direct URL: 404). Sees the open request queue without names (R4) | **PASS** |
| Admin | Sees all students' identities, unchanged (R5) | **PASS** |
| Payments (all roles) | Direct Server Action calls create no purchase, invoice, order or attempt (G2–G7). Verify action refused while off (unit) | **PASS** |

## 2. The "Unnamed student" root cause (D01)

`public.discovery_sessions` RLS (0013) lets a counsellor read:
- unassigned sessions (the triage queue);
- sessions where `assigned_counsellor_id = current_counsellor_id()`.

The staff screens then read the student's name and email from `public.profiles`. Its counsellor policy, "Admins/assigned counsellor can read student profiles (m7)" from 0004 PART 12, only allows students in the counsellor's **caseload**, i.e. an `admin_student_meta` row with `assigned_counsellor_id = current_counsellor_id()`.

Assigning a Discovery Session sets `discovery_sessions.assigned_counsellor_id` but never creates a caseload row, and counsellors cannot insert one themselves (by M7 design). So RLS returns no profile row and the screen printed "Unnamed student". Migration 0014 already recognised the problem for `student_profile_section_provenance` and `student_recommendation_verifications` ("you ran this student's Discovery Session" is a sufficient basis), but did not extend it to `profiles`.

**Not a frontend issue, and not worked around in the frontend.**
- CC-24 does not use the service-role key and does not copy names into the session row.
- It only labels the hidden state honestly (`src/lib/discovery-sessions/student-identity.ts`).
- The fix is the database policy below.

## 3. Proposed migration 0023 — needs your approval

**Files:** `supabase/migrations-proposed/cc24/`
- `0023_counsellor_discovery_session_profile_read.sql`
- `0023_ROLLBACK.sql`
- `0023_rls_tests.sql`

**Change.** One new **permissive SELECT** policy on `public.profiles`, named "Assigned DS counsellor can read student profile (cc24)":

```sql
using (
  public.is_admin_role(array['counsellor'])
  and exists (
    select 1 from public.discovery_sessions ds
    where ds.student_user_id = profiles.id
      and ds.assigned_counsellor_id is not null
      and ds.assigned_counsellor_id = public.current_counsellor_id()
  )
)
```

**What it does not do:**
- **No write access.** No INSERT, UPDATE or DELETE rights for anyone; `profiles` keeps its column-level grants.
- **No existing policy changes.** Policies are ORed, so students, admins and caseload counsellors keep exactly their current access.
- **No access through unassigned sessions.** The triage queue stays anonymous to counsellors.
- **Reassignment moves access** (the check is on the current assignment).
- **The `student_*` onboarding tables stay caseload-only.** The Discovery Session workspace reads only `profiles` for identity.
- No table, column, function, trigger or data change.

**Rollback.** `drop policy if exists "Assigned DS counsellor can read student profile (cc24)" on public.profiles;` Only this policy is removed.

**Evidence (local PostgreSQL 16 with migrations 0001–0022):**

| Run | Result |
|---|---|
| `0023_rls_tests.sql` with today's policies | 13 PASS, **3 FAIL**: exactly the defect (A can't read the assigned student's row or name; after reassignment B can't either) |
| `0023_rls_tests.sql` with 0023 applied inside the rolled-back transaction | **16/16 PASS** |
| Idempotency | Applying twice leaves 4 policies on `profiles`; the rollback returns to the original 3 |
| Residue | 0 fixture users, 0 cc24 policies after each run |
| Browser, suite R (0023 applied to the local DB, then rolled back) | R6: the assigned counsellor sees name and email; the open request stays hidden. R7: the unassigned counsellor still sees nothing. R8: reassignment A→B moves access. R9: rollback verified |

**SQL test coverage.** Positive cases:
- the assigned counsellor reads the profile and name;
- the student reads their own profile;
- the admin reads all students;
- after reassignment, the new counsellor gains access.

Negative cases:
- the assigned counsellor can't read an unassigned-session student;
- or a student with no session;
- or education rows (still caseload-only);
- an UPDATE attempt changes nothing;
- the unassigned counsellor reads nothing;
- a student can't read another student;
- anonymous reads nothing;
- after reassignment, the old counsellor loses access.

**Suggested approval sequence (separate approvals):**
1. Read-only QA check: `select policyname from pg_policies where tablename='profiles';` should show the 3 existing policies, and the migration list should end at 0022.
2. Take a QA backup.
3. Run `0023_rls_tests.sql` on QA with `-v apply_0023=0`. Expect 13/3: today's behaviour, with no residue.
4. Apply `0023_…sql` on QA.
5. Run the tests again with `apply_0023=0`. Expect 16/16 now that the policy exists. Then rerun suite R against the Preview.
6. Production only after QA sign-off.

## 4. Server-side validation added in CC-24

| Entry point | Before | After |
|---|---|---|
| `bookDiscoverySessionAction` | Stored any value; only `preferred_contact_method` was DB-checked | Allow-lists for contact, time range and language; note ≤ 1,000 characters; non-object payload rejected. Nothing reaches the DB on rejection |
| 11 profile save actions | Enum checks only; unbounded text and row counts | Per-field length limits (`src/lib/profile/input-limits.ts`); ≤ 10 education and ≤ 15 experience rows; destination lists capped. Rejected before any delete, insert or upsert |
| `recordOnboardingChoiceAction` | TypeScript-only type | Runtime check of the two allowed values |
| `verifyCheckoutAction` | Not gated | Refused while paid checkout is off |

## 5. Other findings

| Finding | Note |
|---|---|
| **Webhooks** | Razorpay, signature and stamp routes read the raw body and fail closed when unconfigured (503) or invalid (400). The DB re-verifies the HMAC. Unchanged and correct. |
| **Service role** | Used only in server-only modules for system tasks (`src/lib/supabase/service-role.ts`, CC-18 protected). Never in student or counsellor request paths. CC-24 adds no service-role use. |
| **Error messages** | Students see generic messages; DB errors are logged server-side only (F7, booking, profile). |
| **Deactivated counsellors (D23)** | `current_counsellor_id()` ignores `counsellors.is_active`. Offboarding must remove the `admin_roles` row. Consider adding `and is_active` in a future reviewed migration (affects every counsellor policy). |
| **Session handling** | Logout clears cookies (B8). An ended session gives a clear "log in again" (H7). Password reset uses PKCE and works only on the same device (documented in the copy). |
| **Secrets** | No secret is in the repository or in CC-24 artifacts. Local throwaway keys stay in the container. `supabase/.temp` holds identifiers only (D18). |
