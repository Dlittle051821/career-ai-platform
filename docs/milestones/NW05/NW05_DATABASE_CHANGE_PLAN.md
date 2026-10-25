# NW05 — Database Change Plan

**No migration was applied to any database by this milestone.** This document records what NW05 reused, the one schema change it proposes (unapplied), and why no other schema change was needed.

## 1. Existing tables/functions reused (zero change)

| Table / function | How NW05 used it |
|---|---|
| `student_profiles`, `student_education`, `student_subject_strengths`, `student_interests`, `student_skills`, `student_work_preferences`, `student_career_priorities`, `student_career_goals`, `student_study_preferences`, `student_funding_preferences`, `student_experience` | Unchanged — the full existing Student Digital Profile schema, read via `getStudentProfileSnapshot()`/`calculateCompletion()` on `/studio` and `/studio/abroad` |
| `education_saved_items` | Unchanged — read via `listSavedItems()`, Abroad-scoped by joining the resolved `countryName` against `EUROPE_COUNTRIES` (application code, not SQL) |
| `pricing_purchases`, `pricing_plans` | Unchanged schema — `pricing_purchases.invoice_id` (already existed) is now actually joined against `invoices.status` (NW05.6) |
| `invoices` | Unchanged — read through its existing "Students can read their own invoices" RLS policy; `recompute_invoice_status()` (already existed, already correct) remains the sole writer of `status` |
| `student_profile_section_provenance`, `student_recommendation_verifications` | Unchanged schema and RLS — confirmed secure (NW05.1, re-verified NW05.7); only a new, narrow caller is proposed (below) |
| `get_my_applications()` (RPC) | Unchanged — already resolves `universityCountryName`, used to Abroad-scope `/studio/abroad`'s Application Journey |
| Discovery Session system (`discovery_sessions` et al.) | Unchanged — read via `getMyActiveDiscoverySession()` |

## 2. New schema proposed (NOT applied)

**File:** `supabase/migrations-proposed/NW05_student_mark_section_self_entered.sql`

**What:** one new function, `public.student_mark_section_self_entered(p_section_key text) returns void`.

**Why:** closes the one real gap NW05.1's audit found — a student editing a section a counsellor had previously entered/verified never downgraded that section's provenance, leaving it falsely marked as counsellor-attributed. See `NW05_03_SHARED_PROFILE.md` for the full writeup.

**Ownership model:** scoped entirely to `auth.uid()` (the calling student); no parameter can target another student. No new table, no new column, no new index.

**RLS rationale:** none needed for a `SECURITY DEFINER` function — the function itself is the access-control boundary (narrower than any RLS policy could express: it can only move a row's `provenance` to `'SELF_ENTERED'`, nothing else, on nothing but the caller's own row, and only when a counsellor-attributed row already exists).

**Rollback:** `drop function if exists public.student_mark_section_self_entered(text);` — safe at any time; the calling code (`downgradeSectionProvenanceIfNeeded()` in `student-profile-actions.ts`) already tolerates the function not existing (it's how every environment behaves today, before this migration is approved).

**Verification queries:** included in the migration file's own header comment (§ "VERIFY").

**Deployment prerequisites:** none beyond ordinary founder/admin review and a normal `supabase/migrations/` promotion (copy the file, assign the next sequential number, apply via the standard process). No data backfill, no downtime, no coordinated deploy with application code required — `student-profile-actions.ts` already ships in a state that works correctly whether or not this migration has been applied.

## 3. Why no other migration was needed

- **NW05.2 (Student Studio):** every new data point is a read of an existing table/function.
- **NW05.4 (Career Workspace):** no code change at all.
- **NW05.5 (Abroad Workspace):** every new data point is a read of an existing table/function, Abroad-scoped entirely in application code (`src/lib/abroad/scope.ts`) rather than a new SQL view or column.
- **NW05.6 (Entitlements P0 fix):** a read-side join (`invoices.status`) that was simply missing from application code — `invoices`, `pricing_purchases`, and `recompute_invoice_status()` already existed and were already correct.
- **NW05.7 (Counsellor verification surfacing):** the backend was already secure; nothing to change.

## 4. Explicitly NOT done

- No migration was applied to `supabase/migrations/`.
- No database reset, backfill, or seed command was run.
- No production role or policy was altered.
- No student record was backfilled with fictional data.
