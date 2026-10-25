# NW05.3 — Shared Profile & Provenance Safeguard

Status: **COMPLETE** (code shipped and tested; the one enabling migration is PROPOSED and unapplied, by design)

## 1. What NW05.1's audit found

The Student Digital Profile is already a single, shared identity used identically by Career Intelligence and (wherever profile data is relevant) Nextwise Abroad — there is no duplicate-identity risk to fix. Counsellor-verification provenance (`student_profile_section_provenance`, 0013 PART 4) already fully prevents a student from self-verifying: there is no student INSERT/UPDATE RLS policy on that table at all, by design.

The real, narrower gap: **nothing downgraded a section's provenance when a student edited it after a counsellor had already entered or verified it.** A counsellor marks "Education" `COUNSELLOR_VERIFIED`; the student later edits Education themselves via the ordinary profile UI; the provenance row was left untouched, so the UI kept claiming counsellor verification for data the student had since overwritten. The brief's own instruction is the fix's spec: "Do not allow student edits to silently overwrite counsellor-verified facts without clearly defined rules."

## 2. The fix — a narrow, downgrade-only RPC

`supabase/migrations-proposed/NW05_student_mark_section_self_entered.sql` (**PROPOSED, NOT APPLIED** — same convention as `NW01_fix_purchase_pricing_plan_tax_handling.sql`) adds `public.student_mark_section_self_entered(p_section_key text)`:

- `SECURITY DEFINER`, callable only by `authenticated`.
- Scoped to `auth.uid()` — not a parameter, so it cannot touch another student's row.
- Can only ever **set** `provenance = 'SELF_ENTERED'`. There is no code path to write `COUNSELLOR_ENTERED` or `COUNSELLOR_VERIFIED` — that direction stays exclusively the admin/counsellor write policy's.
- Only updates an *existing* row whose current provenance is counsellor-attributed. A `SELF_ENTERED` section (the default — no row exists) is left untouched: zero writes for the overwhelming majority of students with no counsellor involvement.
- Clears `verified_by_counsellor_id`/`verified_at`/`note` and sets `last_updated_by = auth.uid()`.

See the migration file's own header comment for the full writeup, safety argument, and a manual verification query.

## 3. Wiring into the save path

`src/lib/supabase/student-profile-actions.ts` adds `downgradeSectionProvenanceIfNeeded(supabase, sectionKey)`, called from all 11 section-save functions (`saveAboutYou` → `saveExperience`) immediately after each one's write succeeds, each passing its own literal, hardcoded section key — never a client-suppliable value:

| Save function | Section key |
|---|---|
| `saveAboutYou` | `about_you` |
| `saveEducation` | `education` |
| `saveSubjectStrengths` | `subject_strengths` |
| `saveInterests` | `interests` |
| `saveSkills` | `skills` |
| `saveWorkPreferences` | `work_preferences` |
| `saveCareerPriorities` | `career_priorities` |
| `saveCareerGoals` | `career_goals` |
| `saveStudyPreferences` | `study_location` |
| `saveFundingPreferences` | `budget_funding` |
| `saveExperience` | `experience` |

The call is wrapped so that the RPC not existing yet (true in every environment until a human reviews and applies the migration) never fails the student's actual save — any error from `supabase.rpc(...)`, including the function-not-found case, is logged server-side (`console.warn`) and swallowed. The save's success/failure result to the student is entirely unaffected either way.

`src/types/database.ts` gained one new `Functions` entry (`student_mark_section_self_entered`) so this call site type-checks against the function's real intended signature now, rather than needing an `as any` escape hatch — clearly commented as proposed/unapplied.

## 4. Why this needed no other schema change

Every "candidate field" the brief listed for NW05.3 (identity/academic/career/abroad/other) already exists in the 11-table Student Digital Profile schema (0002_student_profile.sql and friends) — this stage reused it entirely, adding zero new columns or tables beyond the one narrow RPC above.

## 5. Tests

`src/lib/supabase/student-profile-actions-provenance.test.ts` (new, 14 tests) — a narrow, explicitly-justified exception to this codebase's "`src/lib/supabase/` is untested here" convention (same reasoning as `refunds.test.ts`/`applications.test.ts`/etc.), mocking `createClient` behind a hand-rolled in-memory Supabase fake:

- One test per save function (11 total) confirming it calls `student_mark_section_self_entered` with exactly its own real section key, exactly once, after a successful save.
- A test confirming `saveAboutYou()` still succeeds when the RPC returns an error.
- A test confirming `saveEducation()` still succeeds when the RPC returns an error.
- A test confirming `saveEducation()` still succeeds when the RPC call throws outright (network/unexpected failure, not just a Postgres error response).

Registered in `vitest.config.mts`'s include list as a documented, narrow exception, consistent with every prior such exception in that file.

## 6. Validation

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Clean — 0 errors |
| `npx vitest run` | 131 files / 2151 tests — all passing (131 files / 2151 tests, +1 file / +14 tests from this stage) |
| `npm run lint` | 0 errors, 18 pre-existing warnings (unchanged) |
| `npm run build` | Succeeds |

## 7. What this stage did not do

- Did not apply the migration to any database (it is `supabase/migrations-proposed/`, not `supabase/migrations/`).
- Did not add a student-facing UI element for this (no "verification cleared" banner) — the brief's NW05.7 stage covers counsellor-verification *surfacing*; this stage is the backend safeguard underneath it.
- Did not touch `student_recommendation_verifications` (the separate, already-secure recommendation-readiness verification table) — that was not the gap the audit found.
