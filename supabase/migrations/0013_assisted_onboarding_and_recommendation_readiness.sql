-- ============================================================================
-- Milestone 11-B/C — Assisted Onboarding Revision (F-123 companion spec)
--
-- HOW TO RUN THIS (no SQL knowledge required):
--   1. Open your Supabase project dashboard (supabase.com/dashboard).
--   2. Click "SQL Editor" in the left sidebar.
--   3. Click "New query".
--   4. Paste the entire contents of this file.
--   5. Click "Run".
--
-- Safe to run once. Re-running is also safe (IF NOT EXISTS / OR REPLACE /
-- DROP POLICY IF EXISTS before CREATE POLICY throughout).
--
-- Covers the full Assisted Onboarding Revision schema in one migration —
-- M11-B1 (onboarding choice + Discovery Session booking), M11-B2 (Discovery
-- Session Counsellor Workspace), M11-C1 (Profile Field Provenance), and
-- M11-C2 (Recommendation Readiness verification overrides) — the same
-- "ship the whole milestone's schema once" choice 0012 already made for
-- product_events (see that file's PART 6 comment). Code lands across four
-- separate, separately-committed submilestones on top of this one migration,
-- exactly like 0012's schema landed once but M11-A shipped as two commits
-- (m11-a-stamping-provider-foundation, m11-a-stamping-workflow).
--
-- Does NOT touch any existing table's data, and does not reset any existing
-- student's profile — every change here is either a new table or an
-- additive nullable column on student_profiles. The product_events CHECK
-- constraint for this milestone's event names was already widened by 0012
-- PART 6 (it lists every onboarding/profile/recommendation event name this
-- migration's features fire) — nothing further is needed here for that.
-- ============================================================================


-- ============================================================================
-- PART 1 — student_profiles gains onboarding_path (additive, nullable)
--
-- Tracks which of the two post-registration choices a student made — never
-- forced, never defaulted to a value that implies a choice was made when it
-- wasn't. Existing students (registered before this migration) simply have
-- both columns null, which the app treats identically to "hasn't chosen
-- yet" — same as a brand new registrant. Nothing is backfilled.
-- ============================================================================

alter table public.student_profiles add column if not exists onboarding_path text;
alter table public.student_profiles add column if not exists onboarding_path_chosen_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'student_profiles_onboarding_path_check'
  ) then
    alter table public.student_profiles add constraint student_profiles_onboarding_path_check
      check (onboarding_path is null or onboarding_path in ('discovery_session', 'self_serve'));
  end if;
end $$;

comment on column public.student_profiles.onboarding_path is
  'Milestone 11-B — which post-registration choice the student made: ''discovery_session'' (booked a free Discovery Session) or ''self_serve'' (chose to build their profile themselves). Null means no choice recorded yet (includes every student who registered before this migration) — the app never forces this and never blocks any feature on it being set.';


-- ============================================================================
-- PART 2 — discovery_sessions (Discovery Session booking)
--
-- A minimal, purpose-built booking table — NOT a general-purpose scheduler.
-- session_type is constrained to the single value 'DISCOVERY_SESSION' by
-- design (spec calls for a DISCOVERY_SESSION type specifically); widening it
-- to other session types later is an additive CHECK-constraint change, not a
-- redesign. This is new: no counselling-booking backend existed anywhere in
-- this codebase before this migration — the public /book-counselling page
-- (BookingForm.tsx) is an explicit Milestone-1 demo whose own on-screen copy
-- says submissions are "not transmitted, booked, or stored anywhere"; that
-- page is untouched by this migration and stays a demo. Discovery Sessions
-- are booked from a new, authenticated student-only flow instead.
-- ============================================================================

create table if not exists public.discovery_sessions (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references auth.users (id) on delete cascade,
  session_type text not null default 'DISCOVERY_SESSION',
  status text not null default 'requested',
  assigned_counsellor_id uuid references public.counsellors (id) on delete set null,
  preferred_contact_method text,
  preferred_time_range text,
  preferred_language text,
  student_notes text,
  scheduled_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discovery_sessions_session_type_check check (session_type in ('DISCOVERY_SESSION')),
  constraint discovery_sessions_status_check check (status in ('requested', 'scheduled', 'completed', 'cancelled', 'no_show')),
  constraint discovery_sessions_contact_method_check
    check (preferred_contact_method is null or preferred_contact_method in ('phone', 'video', 'whatsapp'))
);
create index if not exists discovery_sessions_student_idx on public.discovery_sessions (student_user_id);
create index if not exists discovery_sessions_status_idx on public.discovery_sessions (status);
create index if not exists discovery_sessions_counsellor_idx on public.discovery_sessions (assigned_counsellor_id);

comment on table public.discovery_sessions is
  'Milestone 11-B — one row per booked free Discovery Session. session_type is deliberately locked to ''DISCOVERY_SESSION'' only (a real general-purpose counselling scheduler is explicitly out of scope for this milestone) — this is intentionally minimal, purpose-built booking for the Assisted Onboarding flow, not a rebuild of a scheduling system. Always clearly the FREE first conversation — distinct from any paid plan purchased through the existing pricing_plans/pricing_plan_versions system (Milestone 10).';

alter table public.discovery_sessions enable row level security;

drop policy if exists "Students can book their own discovery sessions" on public.discovery_sessions;
create policy "Students can book their own discovery sessions"
  on public.discovery_sessions for insert to authenticated
  with check (student_user_id = auth.uid() and status = 'requested' and assigned_counsellor_id is null);

drop policy if exists "Students can read their own discovery sessions" on public.discovery_sessions;
create policy "Students can read their own discovery sessions"
  on public.discovery_sessions for select to authenticated
  using (student_user_id = auth.uid());

-- Deliberately no student UPDATE/DELETE policy: once booked, a Discovery
-- Session is staff-managed (assignment, scheduling, status). A student
-- self-cancel flow is a reasonable future addition, not implemented here —
-- noted as an explicit gap in docs/milestones/M11-electronic-stamping-
-- assisted-onboarding.md rather than silently left out.

drop policy if exists "Admins/counsellors can read discovery sessions" on public.discovery_sessions;
create policy "Admins/counsellors can read discovery sessions"
  on public.discovery_sessions for select to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin'])
    or (
      public.is_admin_role(array['counsellor'])
      and (assigned_counsellor_id is null or assigned_counsellor_id = public.current_counsellor_id())
    )
  );

drop policy if exists "Admins/counsellors can update discovery sessions" on public.discovery_sessions;
create policy "Admins/counsellors can update discovery sessions"
  on public.discovery_sessions for update to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin'])
    or (
      public.is_admin_role(array['counsellor'])
      and (assigned_counsellor_id is null or assigned_counsellor_id = public.current_counsellor_id())
    )
  )
  with check (
    public.is_admin_role(array['super_admin', 'admin'])
    or (public.is_admin_role(array['counsellor']) and assigned_counsellor_id = public.current_counsellor_id())
  );

drop trigger if exists set_discovery_sessions_updated_at on public.discovery_sessions;
create trigger set_discovery_sessions_updated_at before update on public.discovery_sessions
  for each row execute function public.set_updated_at();


-- ============================================================================
-- PART 3 — discovery_session_workspace (Discovery Session Counsellor
-- Workspace, sections A-J)
--
-- One row per discovery_sessions row. Staff-only, internal working document
-- — never directly readable by the student (same "never shown to the
-- student" posture as admin_student_notes, PART 4 of 0004_admin_system.sql).
-- Sections A-G and I are structured jsonb objects (shape documented and
-- type-checked in src/types/discovery-session.ts, not by a DB CHECK, same
-- tradeoff already made for pricing_plan_versions.included_services and
-- education_import_rows.errors/warnings elsewhere in this schema); Section H
-- (free-text counsellor notes) and Section J (missing-information checklist)
-- are plain text/text[] since they are genuinely unstructured.
-- ============================================================================

create table if not exists public.discovery_session_workspace (
  session_id uuid primary key references public.discovery_sessions (id) on delete cascade,
  student_basics jsonb not null default '{}'::jsonb,
  academics jsonb not null default '{}'::jsonb,
  interests jsonb not null default '{}'::jsonb,
  goals jsonb not null default '{}'::jsonb,
  budget_financial jsonb not null default '{}'::jsonb,
  parent_sponsor_input jsonb not null default '{}'::jsonb,
  student_uncertainty jsonb not null default '{}'::jsonb,
  counsellor_notes text,
  recommendation_readiness_notes jsonb not null default '{}'::jsonb,
  missing_information text[] not null default '{}',
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discovery_session_workspace_student_basics_is_object check (jsonb_typeof(student_basics) = 'object'),
  constraint discovery_session_workspace_academics_is_object check (jsonb_typeof(academics) = 'object'),
  constraint discovery_session_workspace_interests_is_object check (jsonb_typeof(interests) = 'object'),
  constraint discovery_session_workspace_goals_is_object check (jsonb_typeof(goals) = 'object'),
  constraint discovery_session_workspace_budget_is_object check (jsonb_typeof(budget_financial) = 'object'),
  constraint discovery_session_workspace_parent_input_is_object check (jsonb_typeof(parent_sponsor_input) = 'object'),
  constraint discovery_session_workspace_uncertainty_is_object check (jsonb_typeof(student_uncertainty) = 'object'),
  constraint discovery_session_workspace_readiness_notes_is_object check (jsonb_typeof(recommendation_readiness_notes) = 'object')
);

comment on table public.discovery_session_workspace is
  'Milestone 11-B2 — the structured Discovery Session Counsellor Workspace (spec sections A-J), one row per discovery_sessions row. Internal, staff-only — never exposed to the student directly. Column-to-section mapping: student_basics=A, academics=B, interests=C, goals=D, budget_financial=E, parent_sponsor_input=F, student_uncertainty=G, counsellor_notes=H, recommendation_readiness_notes=I, missing_information=J.';

alter table public.discovery_session_workspace enable row level security;

drop policy if exists "Admins/assigned counsellor can read the workspace" on public.discovery_session_workspace;
create policy "Admins/assigned counsellor can read the workspace"
  on public.discovery_session_workspace for select to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin'])
    or (
      public.is_admin_role(array['counsellor'])
      and exists (
        select 1 from public.discovery_sessions s
        where s.id = discovery_session_workspace.session_id
          and s.assigned_counsellor_id = public.current_counsellor_id()
      )
    )
  );

drop policy if exists "Admins/assigned counsellor can write the workspace" on public.discovery_session_workspace;
create policy "Admins/assigned counsellor can write the workspace"
  on public.discovery_session_workspace for all to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin'])
    or (
      public.is_admin_role(array['counsellor'])
      and exists (
        select 1 from public.discovery_sessions s
        where s.id = discovery_session_workspace.session_id
          and s.assigned_counsellor_id = public.current_counsellor_id()
      )
    )
  )
  with check (
    public.is_admin_role(array['super_admin', 'admin'])
    or (
      public.is_admin_role(array['counsellor'])
      and exists (
        select 1 from public.discovery_sessions s
        where s.id = discovery_session_workspace.session_id
          and s.assigned_counsellor_id = public.current_counsellor_id()
      )
    )
  );

drop trigger if exists set_discovery_session_workspace_updated_at on public.discovery_session_workspace;
create trigger set_discovery_session_workspace_updated_at before update on public.discovery_session_workspace
  for each row execute function public.set_updated_at();


-- ============================================================================
-- PART 4 — student_profile_section_provenance (Milestone 11-C1)
--
-- One row per (student, profile-completion-section) — section_key matches
-- CompletionSection.key from src/lib/profile/completion.ts EXACTLY (about_
-- you, education, subject_strengths, interests, skills, work_preferences,
-- career_priorities, career_goals, study_location, budget_funding,
-- experience). Deliberately section-level, not per-column: the Student
-- Digital Profile is spread across 11 physical tables (0002_student_
-- profile.sql), and per-field provenance across all of them would be a
-- disproportionate schema rewrite this milestone's spec does not explicitly
-- demand — the existing completion model is already section-weighted, so
-- provenance follows the same granularity.
--
-- ABSENCE OF A ROW MEANS 'SELF_ENTERED' — the default, and the true state of
-- every section for every student today. This is what makes the migration
-- purely additive with zero backfill: no existing student's data is
-- touched, reinterpreted, or reset by this migration. A row is only ever
-- inserted the moment a counsellor actually enters or verifies data on a
-- student's behalf.
-- ============================================================================

create table if not exists public.student_profile_section_provenance (
  student_user_id uuid not null references auth.users (id) on delete cascade,
  section_key text not null,
  provenance text not null default 'SELF_ENTERED',
  verified_by_counsellor_id uuid references public.counsellors (id) on delete set null,
  verified_at timestamptz,
  last_updated_by uuid references auth.users (id) on delete set null,
  note text,
  updated_at timestamptz not null default now(),
  primary key (student_user_id, section_key),
  constraint student_profile_section_provenance_section_check check (section_key in (
    'about_you', 'education', 'subject_strengths', 'interests', 'skills',
    'work_preferences', 'career_priorities', 'career_goals', 'study_location',
    'budget_funding', 'experience'
  )),
  constraint student_profile_section_provenance_value_check
    check (provenance in ('SELF_ENTERED', 'COUNSELLOR_ENTERED', 'COUNSELLOR_VERIFIED', 'SYSTEM_DERIVED')),
  constraint student_profile_section_provenance_verified_consistency check (
    (provenance = 'COUNSELLOR_VERIFIED' and verified_by_counsellor_id is not null and verified_at is not null)
    or (provenance <> 'COUNSELLOR_VERIFIED')
  )
);
create index if not exists student_profile_section_provenance_student_idx
  on public.student_profile_section_provenance (student_user_id);

comment on table public.student_profile_section_provenance is
  'Milestone 11-C1 — per-section provenance override for the Student Digital Profile. A MISSING row means SELF_ENTERED (the default and the true state of every pre-existing student — nothing is backfilled). A row exists only once a counsellor has entered data for the student (COUNSELLOR_ENTERED) or explicitly reviewed and confirmed existing data (COUNSELLOR_VERIFIED, which requires verified_by_counsellor_id/verified_at to be set — see the CHECK constraint). SYSTEM_DERIVED is reserved for a future automated-inference feature; nothing in this codebase writes it yet.';

alter table public.student_profile_section_provenance enable row level security;

drop policy if exists "Students can read their own section provenance" on public.student_profile_section_provenance;
create policy "Students can read their own section provenance"
  on public.student_profile_section_provenance for select to authenticated
  using (student_user_id = auth.uid());

-- Deliberately no student INSERT/UPDATE policy anywhere — a student can
-- never mark their own profile "counsellor verified". This is read-only
-- from the student's side by design.

drop policy if exists "Admins/assigned counsellor can read section provenance" on public.student_profile_section_provenance;
create policy "Admins/assigned counsellor can read section provenance"
  on public.student_profile_section_provenance for select to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin', 'analyst'])
    or (
      public.is_admin_role(array['counsellor'])
      and exists (
        select 1 from public.admin_student_meta m
        where m.student_user_id = student_profile_section_provenance.student_user_id
          and m.assigned_counsellor_id = public.current_counsellor_id()
      )
    )
  );

drop policy if exists "Admins/assigned counsellor can write section provenance" on public.student_profile_section_provenance;
create policy "Admins/assigned counsellor can write section provenance"
  on public.student_profile_section_provenance for all to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin'])
    or (
      public.is_admin_role(array['counsellor'])
      and exists (
        select 1 from public.admin_student_meta m
        where m.student_user_id = student_profile_section_provenance.student_user_id
          and m.assigned_counsellor_id = public.current_counsellor_id()
      )
    )
  )
  with check (
    last_updated_by = auth.uid()
    and (
      public.is_admin_role(array['super_admin', 'admin'])
      or (
        public.is_admin_role(array['counsellor'])
        and exists (
          select 1 from public.admin_student_meta m
          where m.student_user_id = student_profile_section_provenance.student_user_id
            and m.assigned_counsellor_id = public.current_counsellor_id()
        )
      )
    )
  );

drop trigger if exists set_student_profile_section_provenance_updated_at on public.student_profile_section_provenance;
create trigger set_student_profile_section_provenance_updated_at before update on public.student_profile_section_provenance
  for each row execute function public.set_updated_at();


-- ============================================================================
-- PART 5 — student_recommendation_verifications (Milestone 11-C2)
--
-- Recommendation Readiness itself (NOT_READY/PRELIMINARY/READY) is a PURE,
-- COMPUTED value (src/lib/recommendations/readiness.ts) — deliberately NOT
-- stored, exactly like profile completion percent/status is computed fresh
-- from calculateCompletion() rather than trusted from a stored column. This
-- table stores ONLY the one thing that cannot be computed: an explicit
-- counsellor override that raises a type to COUNSELLOR_VERIFIED. Presence of
-- a row = that recommendation_type is counsellor-verified for that student;
-- absence = the readiness is whatever the pure function computes.
-- ============================================================================

create table if not exists public.student_recommendation_verifications (
  student_user_id uuid not null references auth.users (id) on delete cascade,
  recommendation_type text not null,
  verified_by_counsellor_id uuid not null references public.counsellors (id) on delete cascade,
  verified_at timestamptz not null default now(),
  note text,
  primary key (student_user_id, recommendation_type),
  constraint student_recommendation_verifications_type_check
    check (recommendation_type in ('career', 'course', 'college', 'pathway'))
);
create index if not exists student_recommendation_verifications_student_idx
  on public.student_recommendation_verifications (student_user_id);

comment on table public.student_recommendation_verifications is
  'Milestone 11-C2 — an explicit counsellor override recording that a recommendation type is COUNSELLOR_VERIFIED for a student. This is the only piece of Recommendation Readiness that is stored; the NOT_READY/PRELIMINARY/READY levels are always computed fresh from the Student Digital Profile by src/lib/recommendations/readiness.ts. course/college/pathway readiness is forward-looking infrastructure — this codebase currently has a real recommendation ENGINE for career only (src/lib/recommendations/engine.ts); course/college/pathway readiness can be computed and verified today even though their own matching engines do not exist yet.';

alter table public.student_recommendation_verifications enable row level security;

drop policy if exists "Students can read their own recommendation verifications" on public.student_recommendation_verifications;
create policy "Students can read their own recommendation verifications"
  on public.student_recommendation_verifications for select to authenticated
  using (student_user_id = auth.uid());

drop policy if exists "Admins/assigned counsellor can read recommendation verifications" on public.student_recommendation_verifications;
create policy "Admins/assigned counsellor can read recommendation verifications"
  on public.student_recommendation_verifications for select to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin', 'analyst'])
    or (
      public.is_admin_role(array['counsellor'])
      and exists (
        select 1 from public.admin_student_meta m
        where m.student_user_id = student_recommendation_verifications.student_user_id
          and m.assigned_counsellor_id = public.current_counsellor_id()
      )
    )
  );

drop policy if exists "Admins/assigned counsellor can write recommendation verifications" on public.student_recommendation_verifications;
create policy "Admins/assigned counsellor can write recommendation verifications"
  on public.student_recommendation_verifications for all to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin'])
    or (
      public.is_admin_role(array['counsellor'])
      and exists (
        select 1 from public.admin_student_meta m
        where m.student_user_id = student_recommendation_verifications.student_user_id
          and m.assigned_counsellor_id = public.current_counsellor_id()
      )
    )
  )
  with check (
    verified_by_counsellor_id = public.current_counsellor_id()
    and (
      public.is_admin_role(array['super_admin', 'admin'])
      or (
        public.is_admin_role(array['counsellor'])
        and exists (
          select 1 from public.admin_student_meta m
          where m.student_user_id = student_recommendation_verifications.student_user_id
            and m.assigned_counsellor_id = public.current_counsellor_id()
        )
      )
    )
  );

-- No updated_at trigger — this table is a small, append/replace-by-primary-
-- key override log (verified_at is the meaningful timestamp), not a general
-- mutable record.


-- ============================================================================
-- PART 6 — Verification queries (run manually after applying this
-- migration; not executed automatically). Same pattern as 0011 PART 10 /
-- 0012 PART 7.
--
-- 1) Confirm the new tables exist and have RLS enabled:
--      select relname, relrowsecurity from pg_class
--      where relname in ('discovery_sessions', 'discovery_session_workspace',
--        'student_profile_section_provenance', 'student_recommendation_verifications')
--      and relnamespace = 'public'::regnamespace;
--    -> every row should show relrowsecurity = true.
--
-- 2) Confirm student_profiles gained the two new nullable columns without
--    any existing row being touched:
--      select onboarding_path, onboarding_path_chosen_at, count(*)
--      from public.student_profiles group by 1, 2;
--    -> every pre-existing student should show both columns null.
--
-- 3) Confirm a student can insert their own discovery_sessions row but not
--    one for another student_user_id (test as an authenticated student via
--    the Supabase client, not the SQL editor's service-role connection,
--    which bypasses RLS entirely).
-- ============================================================================
