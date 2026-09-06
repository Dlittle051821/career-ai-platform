-- ============================================================================
-- Milestone 11-B — Discovery Session duplicate-booking guard (database-level
-- defense-in-depth).
--
-- HOW TO RUN THIS (no SQL knowledge required):
--   1. Open your Supabase project dashboard (supabase.com/dashboard).
--   2. Click "SQL Editor" in the left sidebar.
--   3. Click "New query".
--   4. Paste the entire contents of this file.
--   5. Click "Run".
--
-- Safe to run once. Re-running is also safe (CREATE UNIQUE INDEX IF NOT
-- EXISTS; no table/column/policy changes at all in this file).
--
-- WHY THIS EXISTS (a gap found during the M11-B security audit, fixed with a
-- new additive migration rather than editing 0013 after it already shipped
-- — same "never rewrite a migration once committed" discipline this
-- codebase follows everywhere else):
--
-- 0013 PART 2 created discovery_sessions with an app-layer-only guard
-- against a student booking more than one active (requested/scheduled)
-- Discovery Session at a time: bookDiscoverySession()
-- (src/lib/supabase/discovery-sessions/book.ts) reads the student's current
-- sessions, then calls validateBookDiscoverySession()
-- (src/lib/discovery-sessions/rules.ts) before inserting. That read-then-
-- write is not atomic, so two concurrent booking requests from the same
-- student (a double-submit, or two open tabs) could both pass the
-- "no active session" check before either INSERT lands, producing two
-- simultaneous active Discovery Session rows for one student — confusing
-- for the counsellor workspace (which session is the real one to work?)
-- and inconsistent with how every other "one active X per Y" invariant in
-- this codebase is enforced. Compare:
--   - stamp_requests_one_active_per_version
--     (0012_electronic_stamping_and_assisted_onboarding.sql PART 1)
--   - the unique(student_user_id, entity_type, entity_id) constraint behind
--     education_saved_items' idempotent saveItem()
-- Both pair an application-level check (for a fast, friendly error message)
-- with a database-level constraint (the actual guarantee). discovery_sessions
-- had the former but not the latter — this migration adds it.
--
-- A partial unique index — rather than a full unique(student_user_id)
-- constraint — is used because a student legitimately accumulates many
-- discovery_sessions rows over time (completed, cancelled, no_show); only
-- ACTIVE ones (requested/scheduled — the same ACTIVE_STATUSES list already
-- used by src/lib/discovery-sessions/rules.ts and
-- src/lib/supabase/discovery-sessions/book.ts) must be unique per student.
-- ============================================================================

create unique index if not exists discovery_sessions_one_active_per_student
  on public.discovery_sessions (student_user_id)
  where status in ('requested', 'scheduled');

comment on index public.discovery_sessions_one_active_per_student is
  'Milestone 11-B — database-level guard: a student can have at most one active (requested/scheduled) Discovery Session at a time. Defense-in-depth alongside the application-level check in validateBookDiscoverySession() (src/lib/discovery-sessions/rules.ts), which is what a student actually sees as a friendly error — this index is what makes that guarantee true under concurrent requests.';

-- ============================================================================
-- Verification queries (run manually after applying this migration):
--
-- 1) Confirm the index exists and is partial:
--      select indexname, indexdef from pg_indexes
--      where tablename = 'discovery_sessions' and indexname = 'discovery_sessions_one_active_per_student';
--
-- 2) Confirm no existing data violates it (should return zero rows — if this
--    ever returns rows, resolve them manually before relying on the index):
--      select student_user_id, count(*) from public.discovery_sessions
--      where status in ('requested', 'scheduled')
--      group by student_user_id having count(*) > 1;
--
-- 3) Confirm a second concurrent "requested" insert for the same student is
--    now rejected at the database level (e.g. via two overlapping
--    transactions in separate SQL Editor tabs, or by reviewing
--    bookDiscoverySession()'s new isUniqueViolation() handling, which turns
--    this constraint's error into the same friendly message
--    validateBookDiscoverySession() already produces for the common case).
-- ============================================================================
