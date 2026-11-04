-- ============================================================================
-- NW05.3 "Shared Profile and Onboarding" — PROPOSED FIX, NOT AUTO-APPLIED.
--
-- *** FOR FOUNDER/ADMIN REVIEW ONLY. NOT EXECUTED AGAINST ANY DATABASE BY
-- *** this milestone, and deliberately placed OUTSIDE supabase/migrations/
-- *** so ordinary migration tooling will never pick this up automatically
-- *** — same convention as supabase/migrations-proposed/
-- *** NW01_fix_purchase_pricing_plan_tax_handling.sql. A human administrator
-- *** reviews this file, then — only after approving it — copies it into
-- *** supabase/migrations/ with the next sequential number and applies it
-- *** through the normal process.
--
-- WHAT THIS FIXES — the stale-provenance gap NW05.1's audit found:
--   `public.student_profile_section_provenance` (0013 PART 4) already
--   correctly prevents a student from ever WRITING 'COUNSELLOR_ENTERED' or
--   'COUNSELLOR_VERIFIED' themselves — there is no student INSERT/UPDATE
--   RLS policy on this table at all, by design (0013's own comment: "a
--   student can never mark their own profile 'counsellor verified'").
--   That part of the system is already secure.
--
--   The gap is the OTHER direction: nothing today downgrades a section's
--   provenance when the STUDENT edits it after a counsellor already
--   entered or verified it. A counsellor marks "Education" COUNSELLOR_
--   VERIFIED; the student later edits their own Education section via the
--   normal profile UI (student-profile-actions.ts's saveEducation()); the
--   provenance row is left untouched, so the UI keeps telling the student
--   (and would keep telling a counsellor reviewing recommendation
--   readiness) that this section is still counsellor-verified, when it now
--   reflects the student's own, unreviewed edit. Per the brief: "Do not
--   allow student edits to silently overwrite counsellor-verified facts
--   without clearly defined rules." This migration is that rule.
--
-- THE FIX: a new, narrow, DOWNGRADE-ONLY SECURITY DEFINER RPC.
--   `student_mark_section_self_entered(p_section_key text)`:
--     - Is callable only by `authenticated` (never `anon`).
--     - Only ever touches the CALLING student's own row
--       (`student_user_id = auth.uid()` — not a parameter, so it is
--       structurally impossible to pass another student's id).
--     - Only ever SETS provenance to 'SELF_ENTERED'. It has no code path
--       that can write 'COUNSELLOR_ENTERED' or 'COUNSELLOR_VERIFIED' —
--       that direction remains exclusively the admin/counsellor write
--       policy's (0013 PART 4 / 0014_discovery_session_counsellor_scope).
--     - Only UPDATEs an EXISTING row whose current provenance is
--       'COUNSELLOR_ENTERED' or 'COUNSELLOR_VERIFIED'. A section with no
--       override row (the default/true state of every section for a
--       student with no counsellor involvement — see 0013's own comment)
--       is left exactly as-is: zero writes, zero new rows, for the
--       overwhelming majority of students. This is also why calling it is
--       always safe to add to every save action unconditionally — for
--       almost every save, this function does nothing at all.
--     - Clears `verified_by_counsellor_id`/`verified_at`/`note` alongside
--       the provenance reset, so no stale verifier identity or note
--       survives under a SELF_ENTERED row (the
--       `..._verified_consistency` CHECK constraint already requires this
--       pairing, but this makes the intent explicit rather than relying
--       on the constraint alone).
--     - Sets `last_updated_by = auth.uid()` — the row now honestly
--       records that the STUDENT, not a counsellor, is the most recent
--       actor on this section's provenance.
--
-- CALLER: `src/lib/supabase/student-profile-actions.ts`'s
--   `downgradeSectionProvenanceIfNeeded()`, called from all 11 section-save
--   functions immediately after a successful write, wrapped so that this
--   RPC not existing yet (true until this migration is applied) never
--   fails the student's actual profile save — see that function's own
--   docblock.
--
-- SAFE TO APPLY:
--   - Purely additive: one new function, granted only to `authenticated`.
--     Touches no existing table structure, no existing row, no existing
--     RLS policy.
--   - Cannot be used to self-verify, self-grant counsellor attribution, or
--     touch any other student's data — see the "only ever" bullets above.
--   - Idempotent to re-run (`create or replace function`, `drop ... if
--     exists` is not needed since this is a brand-new function name).
--
-- VERIFY (run after applying, as a test student, read-only afterwards):
--   select section_key, provenance, verified_by_counsellor_id, verified_at,
--          last_updated_by
--   from public.student_profile_section_provenance
--   where student_user_id = auth.uid();
--   -- Before: a row with provenance = 'COUNSELLOR_VERIFIED'.
--   -- After calling select public.student_mark_section_self_entered('education');
--   -- as that same student: that row's provenance = 'SELF_ENTERED',
--   -- verified_by_counsellor_id/verified_at = null, last_updated_by = that
--   -- student's own auth.uid().
-- ============================================================================

create or replace function public.student_mark_section_self_entered(p_section_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'You must be signed in.';
  end if;

  if p_section_key not in (
    'about_you', 'education', 'subject_strengths', 'interests', 'skills',
    'work_preferences', 'career_priorities', 'career_goals', 'study_location',
    'budget_funding', 'experience'
  ) then
    raise exception 'Unknown profile section.';
  end if;

  -- Downgrade-only, and only when a counsellor-attributed row actually
  -- exists for this exact (student, section). A SELF_ENTERED section has
  -- no override row to begin with (absence IS 'SELF_ENTERED' — see 0013
  -- PART 4's own comment), so the WHERE clause below naturally makes this
  -- a no-op for that case: no row is ever inserted by this function.
  update public.student_profile_section_provenance
  set provenance = 'SELF_ENTERED',
      verified_by_counsellor_id = null,
      verified_at = null,
      last_updated_by = v_uid,
      note = null
  where student_user_id = v_uid
    and section_key = p_section_key
    and provenance in ('COUNSELLOR_ENTERED', 'COUNSELLOR_VERIFIED');
end;
$$;

comment on function public.student_mark_section_self_entered(text) is
  'NW05.3 — called by the student''s own profile save actions (student-profile-actions.ts) immediately after they save a section themselves. Downgrade-only: if that section currently carries counsellor attribution (COUNSELLOR_ENTERED/COUNSELLOR_VERIFIED), it is reset to SELF_ENTERED (the honest state once the student has overwritten the counsellor-entered/verified value) and verified_by_counsellor_id/verified_at/note are cleared. This function has no code path that can write COUNSELLOR_ENTERED or COUNSELLOR_VERIFIED — a student can never use it to self-verify. A SELF_ENTERED section (the default — no row) is left untouched.';

revoke all on function public.student_mark_section_self_entered(text) from public;
grant execute on function public.student_mark_section_self_entered(text) to authenticated;
