-- ============================================================================
-- Milestone 9 — Audit + Outcome Instrumentation
--
-- HOW TO RUN THIS (no SQL knowledge required):
--   1. Open your Supabase project dashboard (supabase.com/dashboard).
--   2. Click "SQL Editor" in the left sidebar.
--   3. Click "New query".
--   4. Paste the entire contents of this file.
--   5. Click "Run".
--
-- Safe to run once. Re-running is also safe — every statement is written to
-- not fail if already applied (`if not exists` / `or replace` / `drop
-- policy if exists` before `create policy`), same convention as 0001-0009.
--
-- This migration does NOT modify 0001-0009 in place. It only ADDS two new
-- tables and their supporting functions/triggers/policies:
--
--   - product_events     a narrow, CHECK-constrained, append-only first-
--                         party event log — the same design pattern as
--                         pricing_analytics_events (0007 PART 5), extended
--                         to cover the whole product (not just pricing).
--                         Anonymous- and signed-in-writable, admin-readable
--                         only. See docs/M9_EVENT_TAXONOMY.md for the full
--                         event list and docs/M9_IMPLEMENTATION.md for how
--                         application code writes to it (src/lib/analytics/,
--                         src/lib/supabase/analytics/).
--
--   - student_outcomes    one evolving row per student summarising where
--                         they currently are in the discovery -> application
--                         -> enrollment journey. Deliberately does NOT
--                         duplicate applications/leads — it references
--                         applications via final_application_id and is kept
--                         in sync automatically by a trigger on
--                         `applications` (PART 4 below) for the parts that
--                         table already tracks authoritatively, plus a
--                         manual admin/counsellor write path
--                         (src/lib/supabase/admin/outcomes.ts) for the parts
--                         it doesn't (target career/course/university,
--                         destination country, free-text metadata). See
--                         docs/OUT-001_OUTCOME_DATA_FOUNDATION.md for the
--                         full design rationale, including why this is one
--                         evolving row per student rather than one row per
--                         snapshot.
-- ============================================================================


-- ============================================================================
-- PART 1 — product_events
--
-- Modeled directly on pricing_analytics_events (0007_nextwise_pricing_
-- offers.sql PART 5) — narrow CHECK-constrained event_name, anon+
-- authenticated INSERT, admin-only SELECT, no update/delete, a BEFORE
-- INSERT trigger that unconditionally server-stamps user_id/occurred_at so
-- a browser can never forge who performed an event or backdate it. The
-- event_name CHECK constraint below MUST be kept in sync with the
-- `PRODUCT_EVENTS` registry in src/lib/analytics/events.ts — that TS file
-- is the source of truth for what each event means and whether it is
-- actually fired anywhere; this CHECK constraint is only the database-side
-- enforcement that nothing outside that agreed vocabulary can ever be
-- written, including the four `assessment_*` and other names reserved for
-- a feature that does not exist yet (see docs/M9_EVENT_TAXONOMY.md) — they
-- are listed here so the column is ready the day that feature ships,
-- without ever having been inserted by any code path in this milestone.
-- ============================================================================

create table if not exists public.product_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  user_id uuid references auth.users (id) on delete set null,
  session_id text,
  anonymous_id text,
  source text,
  path text,
  feature text,
  entity_type text,
  entity_id uuid,
  properties jsonb not null default '{}'::jsonb,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint product_events_event_name_check check (event_name in (
    -- Auth / account
    'user_registered',
    'user_logged_in',
    -- Student profile
    'profile_started',
    'profile_completed',
    -- Assessment / quiz — RESERVED, never fired: no assessment/quiz UI
    -- exists in this codebase yet. See docs/M9_EVENT_TAXONOMY.md.
    'assessment_started',
    'assessment_answered',
    'assessment_completed',
    'assessment_result_viewed',
    -- Career discovery
    'career_recommendations_generated',
    'career_viewed',
    'career_compared',
    'career_saved',
    -- Course discovery
    'course_viewed',
    'course_compared',
    'course_saved',
    'application_started',
    -- College / university discovery
    'college_viewed',
    'college_compared',
    'college_saved',
    -- Lead / conversion
    'lead_created',
    'counselling_requested',
    -- Commercial
    'package_viewed',
    'package_selected',
    'payment_started',
    'payment_completed',
    -- Outcome
    'offer_received',
    'enrollment_confirmed'
  )),
  constraint product_events_session_id_length_check check (session_id is null or length(session_id) <= 128),
  constraint product_events_anonymous_id_length_check check (anonymous_id is null or length(anonymous_id) <= 128),
  constraint product_events_source_length_check check (source is null or length(source) <= 64),
  constraint product_events_path_length_check check (path is null or length(path) <= 512),
  constraint product_events_feature_length_check check (feature is null or length(feature) <= 64),
  constraint product_events_entity_type_length_check check (entity_type is null or length(entity_type) <= 64)
);

-- Deliberately no more than these four — one per the spec's own "do not
-- create excessive indexes" instruction, matching what the admin analytics
-- queries and funnel-reconstruction queries documented in
-- docs/OUT-001_OUTCOME_DATA_FOUNDATION.md actually filter/group by.
create index if not exists product_events_event_name_idx on public.product_events (event_name);
create index if not exists product_events_user_id_idx on public.product_events (user_id);
create index if not exists product_events_created_at_idx on public.product_events (created_at);
create index if not exists product_events_entity_idx on public.product_events (entity_type, entity_id);

comment on table public.product_events is
  'Milestone 9 — first-party, append-only product event log covering the whole application (career/course/college discovery, profile, lead/CRM, commercial, outcome signals). event_name is restricted by CHECK to the exact vocabulary maintained in src/lib/analytics/events.ts (PRODUCT_EVENTS) — some names in that list (all four assessment_* names, college_compared, career_saved, counselling_requested, package_viewed, package_selected, offer_received, enrollment_confirmed) are RESERVED for functionality that does not exist yet or is intentionally satisfied by an existing narrower table (pricing_analytics_events, for package_viewed/package_selected) and are never actually inserted by any code path — see docs/M9_EVENT_TAXONOMY.md for the full status of every name. `user_id`/`occurred_at` are always server-stamped by the trigger below from auth.uid()/now(), never trusted from the client. `session_id`/`anonymous_id` are optional, non-identifying, length-capped tokens for grouping a visitor''s own events — never a cookie, IP address, or device fingerprint; `anonymous_id` is a documented-but-not-yet-wired capability in this milestone (no page currently generates or passes one) — see docs/M9_IMPLEMENTATION.md. `properties` is validated/sanitized at the application layer (src/lib/analytics/track.ts) before it ever reaches this insert — size-capped and stripped of any key that looks like it might carry a password, token, full address, or other sensitive free text — this CHECK-constrained table has no equivalent DB-side shape enforcement on `properties` beyond it being valid jsonb.';

alter table public.product_events enable row level security;

drop policy if exists "Anyone can record a product event" on public.product_events;
create policy "Anyone can record a product event"
  on public.product_events for insert to anon, authenticated
  with check (true);
-- The event_name CHECK constraint above is the real restriction on what can
-- ever land in this table — this policy only decides who may attempt an
-- insert at all (anyone: recording a first-party product event about your
-- own browsing/use of the site is not a privileged act), exactly the same
-- reasoning pricing_analytics_events' insert policy documents.

drop policy if exists "super_admin/admin/analyst can read product events" on public.product_events;
create policy "super_admin/admin/analyst can read product events"
  on public.product_events for select to authenticated
  using (public.is_admin_role(array['super_admin', 'admin', 'analyst']));

-- No update/delete policy for anyone — append-only, same as
-- conversion_events/pricing_analytics_events/admin_audit_log. No public or
-- unauthenticated read access either: only an admin/analyst-role session
-- can ever SELECT from this table.

create or replace function public.stamp_product_event()
returns trigger
language plpgsql
as $$
begin
  new.user_id := auth.uid();
  new.occurred_at := now();
  return new;
end;
$$;

comment on function public.stamp_product_event() is
  'BEFORE INSERT trigger on product_events: unconditionally overwrites user_id with auth.uid() (null for an anonymous visitor) and occurred_at with now(), regardless of whatever the client sent in either column — so a signed-in user can never be spoofed as someone else or as anonymous, and no event can be backdated. Plain SECURITY INVOKER (the default): auth.uid()/now() are readable by any role and it only ever touches the one row already being inserted. Exact same shape as pricing_analytics_events'' stamp_pricing_analytics_event().';

drop trigger if exists stamp_product_event on public.product_events;
create trigger stamp_product_event
  before insert on public.product_events
  for each row execute function public.stamp_product_event();

revoke execute on function public.stamp_product_event() from public;


-- ============================================================================
-- PART 2 — student_outcomes
--
-- One evolving row per student — not one row per application, and not one
-- row per stage transition. Fine-grained stage-transition history already
-- exists elsewhere (application_status_history, lead_status_history,
-- 0004_admin_system.sql) and, going forward, in product_events — this
-- table only ever holds CURRENT state, so a funnel reconstruction over
-- time reads those other sources, not this one. See
-- docs/OUT-001_OUTCOME_DATA_FOUNDATION.md.
-- ============================================================================

create table if not exists public.student_outcomes (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references auth.users (id) on delete cascade,
  journey_stage text not null default 'not_started',
  outcome_status text not null default 'unknown',
  target_career_id uuid references public.careers (id) on delete set null,
  target_course_id uuid references public.courses (id) on delete set null,
  target_university_id uuid references public.universities (id) on delete set null,
  final_application_id uuid references public.applications (id) on delete set null,
  destination_country text,
  application_count integer not null default 0,
  offer_count integer not null default 0,
  final_decision_status text,
  outcome_source text not null default 'system',
  recorded_by uuid references auth.users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_outcomes_student_unique unique (student_user_id),
  -- journey_stage tracks WHERE the student currently is in the funnel
  -- (discovery -> shortlisting -> application -> decision -> enrollment);
  -- outcome_status tracks the RESOLVED classification of that journey once
  -- it reaches a conclusion (stays 'unknown' while still in progress). Both
  -- columns are deliberately drawn from the same controlled vocabulary —
  -- see docs/OUT-001_OUTCOME_DATA_FOUNDATION.md for the full mapping and
  -- why two columns, not one.
  constraint student_outcomes_journey_stage_check check (journey_stage in (
    'not_started', 'exploring', 'shortlisted', 'application_started', 'application_submitted',
    'offer_received', 'accepted', 'enrolled', 'not_enrolled', 'deferred', 'unknown'
  )),
  constraint student_outcomes_outcome_status_check check (outcome_status in (
    'not_started', 'exploring', 'shortlisted', 'application_started', 'application_submitted',
    'offer_received', 'accepted', 'enrolled', 'not_enrolled', 'deferred', 'unknown'
  )),
  constraint student_outcomes_source_check check (outcome_source in ('student', 'counsellor', 'admin', 'system', 'integration')),
  constraint student_outcomes_application_count_check check (application_count >= 0),
  constraint student_outcomes_offer_count_check check (offer_count >= 0)
);

create index if not exists student_outcomes_journey_stage_idx on public.student_outcomes (journey_stage);
create index if not exists student_outcomes_outcome_status_idx on public.student_outcomes (outcome_status);

comment on table public.student_outcomes is
  'Milestone 9 — one evolving row per student (unique on student_user_id), summarising CURRENT journey/outcome state. Never duplicates applications'' own fields: final_application_id links to the real winning/most-relevant applications row, and its course_id/university_id are resolved via that join rather than copied here — see docs/OUT-001_OUTCOME_DATA_FOUNDATION.md. `application_count`/`offer_count`/`final_decision_status`/`final_application_id`/`journey_stage`/`outcome_status` are kept in sync automatically by sync_student_outcome_from_application() (PART 4) whenever any of this student''s applications rows change — application data is authoritative once an application exists. `target_career_id`/`target_course_id`/`target_university_id`/`destination_country`/`metadata` are never touched by that trigger; they are set only via the manual admin/counsellor path (src/lib/supabase/admin/outcomes.ts), and remain whatever an admin/counsellor last set even as the trigger keeps the application-derived fields current. `outcome_source` records the COARSE category of who/what last determined outcome_status (student self-report, counsellor, admin, automatic system sync from applications, or a future external integration); `recorded_by` records the SPECIFIC user (null for a system-triggered sync) — the two are deliberately separate columns, one categorical and one an actual identity, for admin provenance review.';

alter table public.student_outcomes enable row level security;

drop policy if exists "Students can read their own outcome" on public.student_outcomes;
create policy "Students can read their own outcome"
  on public.student_outcomes for select to authenticated
  using (auth.uid() = student_user_id);

drop policy if exists "super_admin/admin/analyst can read all outcomes" on public.student_outcomes;
create policy "super_admin/admin/analyst can read all outcomes"
  on public.student_outcomes for select to authenticated
  using (public.is_admin_role(array['super_admin', 'admin', 'analyst']));

drop policy if exists "counsellor can read their assigned students' outcomes" on public.student_outcomes;
create policy "counsellor can read their assigned students' outcomes"
  on public.student_outcomes for select to authenticated
  using (
    public.is_admin_role(array['counsellor'])
    and exists (
      select 1 from public.admin_student_meta m
      where m.student_user_id = student_outcomes.student_user_id and m.assigned_counsellor_id = public.current_counsellor_id()
    )
  );

drop policy if exists "super_admin/admin can write any outcome" on public.student_outcomes;
create policy "super_admin/admin can write any outcome"
  on public.student_outcomes for insert to authenticated
  with check (public.is_admin_role(array['super_admin', 'admin']));

drop policy if exists "super_admin/admin can update any outcome" on public.student_outcomes;
create policy "super_admin/admin can update any outcome"
  on public.student_outcomes for update to authenticated
  using (public.is_admin_role(array['super_admin', 'admin']))
  with check (public.is_admin_role(array['super_admin', 'admin']));

drop policy if exists "counsellor can write their assigned students' outcomes" on public.student_outcomes;
create policy "counsellor can write their assigned students' outcomes"
  on public.student_outcomes for insert to authenticated
  with check (
    public.is_admin_role(array['counsellor'])
    and exists (
      select 1 from public.admin_student_meta m
      where m.student_user_id = student_outcomes.student_user_id and m.assigned_counsellor_id = public.current_counsellor_id()
    )
  );

drop policy if exists "counsellor can update their assigned students' outcomes" on public.student_outcomes;
create policy "counsellor can update their assigned students' outcomes"
  on public.student_outcomes for update to authenticated
  using (
    public.is_admin_role(array['counsellor'])
    and exists (
      select 1 from public.admin_student_meta m
      where m.student_user_id = student_outcomes.student_user_id and m.assigned_counsellor_id = public.current_counsellor_id()
    )
  )
  with check (
    public.is_admin_role(array['counsellor'])
    and exists (
      select 1 from public.admin_student_meta m
      where m.student_user_id = student_outcomes.student_user_id and m.assigned_counsellor_id = public.current_counsellor_id()
    )
  );

-- No delete policy for anyone, matching pricing_purchases/admin_audit_log —
-- an outcome that needs correcting gets a new write (it is a mutable
-- "current state" row, not an immutable ledger, so corrections are simply
-- updates, never deletes-and-reinserts).

drop trigger if exists set_student_outcomes_updated_at on public.student_outcomes;
create trigger set_student_outcomes_updated_at before update on public.student_outcomes for each row execute function public.set_updated_at();


-- ============================================================================
-- PART 3 — RLS/permission cross-check: does `counsellor` already have write
-- access to comparable student data elsewhere?
--
-- Yes — admin_student_notes (0004_admin_system.sql PART 4) grants INSERT to
-- "super_admin/admin, or counsellor assigned via admin_student_meta", and
-- pricing_purchases (0007 PART 4) grants counsellor SELECT on the same
-- assigned-student basis. PART 2 above matches that exact role set and
-- assignment-scoping mechanism (admin_student_meta.assigned_counsellor_id =
-- current_counsellor_id()) rather than inventing a new one.
-- ============================================================================


-- ============================================================================
-- PART 4 — sync_student_outcome_from_application(): keeps the
-- application-derived fields of student_outcomes current automatically.
--
-- WHY SECURITY DEFINER: the invoking role here is whoever already has
-- permission to INSERT/UPDATE the applications row that fired this trigger
-- (the student themself via startApplicationFromCourse, or an admin/their
-- assigned counsellor via the admin console) — applications' own RLS
-- already gated that write. This trigger only ever writes ONE row, keyed to
-- NEW.student_user_id (the exact same student whose application row the
-- caller was already authorized to change), and only ever touches the
-- application-derived columns (journey_stage, outcome_status,
-- application_count, offer_count, final_decision_status,
-- final_application_id, outcome_source, recorded_by, recorded_at) — never
-- target_career_id/target_course_id/target_university_id/
-- destination_country/metadata, which stay under manual admin/counsellor
-- control. It is a deterministic, mechanical restatement of application
-- state for the same student the caller was already allowed to touch, not
-- a privilege escalation — matching the review discipline
-- 0007_nextwise_pricing_offers.sql PART 7.2 applies to its own DEFINER
-- functions (see the safety-review table in PART 5 below).
-- ============================================================================

create or replace function public.sync_student_outcome_from_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student uuid := new.student_user_id;
  v_app_count integer;
  v_offer_count integer;
  v_final_app_id uuid;
  v_final_stage text;
  v_final_decision text;
  v_journey_stage text;
  v_outcome_status text;
begin
  select count(*), count(*) filter (where decision_status = 'offer')
    into v_app_count, v_offer_count
    from public.applications
    where student_user_id = v_student;

  -- Pick the single "best" application row (furthest along the funnel,
  -- ties broken by most recently updated) to represent this student's
  -- final_application_id/final_decision_status/journey position. This is a
  -- deliberate simplification for a student with several applications —
  -- see docs/OUT-001_OUTCOME_DATA_FOUNDATION.md for the full rationale and
  -- the acknowledged edge case (a rejection on the furthest-along
  -- application does not pull journey_stage back down to an earlier,
  -- still-active application's stage).
  select a.id, a.stage, a.decision_status
    into v_final_app_id, v_final_stage, v_final_decision
    from public.applications a
    where a.student_user_id = v_student
    order by
      (case a.stage
        when 'enrolled' then 8
        when 'offer_received' then 7
        when 'decision_pending' then 6
        when 'interview' then 5
        when 'under_review' then 4
        when 'submitted' then 3
        when 'rejected' then 3
        when 'withdrawn' then 3
        when 'preparing' then 2
        when 'inquiry' then 1
        else 0
      end) desc,
      a.updated_at desc
    limit 1;

  v_journey_stage := case v_final_stage
    when 'enrolled' then 'enrolled'
    when 'offer_received' then 'offer_received'
    when 'submitted' then 'application_submitted'
    when 'under_review' then 'application_submitted'
    when 'interview' then 'application_submitted'
    when 'decision_pending' then 'application_submitted'
    when 'rejected' then 'application_submitted'
    when 'withdrawn' then 'application_submitted'
    when 'preparing' then 'application_started'
    when 'inquiry' then 'application_started'
    else 'unknown'
  end;

  v_outcome_status := case
    when v_final_stage = 'enrolled' then 'enrolled'
    when v_final_decision = 'deferred' then 'deferred'
    when v_final_stage = 'offer_received' or v_final_decision = 'offer' then 'offer_received'
    when v_final_stage in ('rejected', 'withdrawn') then 'not_enrolled'
    else 'unknown'
  end;

  insert into public.student_outcomes (
    student_user_id, journey_stage, outcome_status, final_application_id,
    application_count, offer_count, final_decision_status,
    outcome_source, recorded_by, recorded_at
  ) values (
    v_student, v_journey_stage, v_outcome_status, v_final_app_id,
    v_app_count, v_offer_count, v_final_decision,
    'system', null, now()
  )
  on conflict (student_user_id) do update
    set journey_stage = excluded.journey_stage,
        outcome_status = excluded.outcome_status,
        final_application_id = excluded.final_application_id,
        application_count = excluded.application_count,
        offer_count = excluded.offer_count,
        final_decision_status = excluded.final_decision_status,
        outcome_source = 'system',
        recorded_by = null,
        recorded_at = now();

  return new;
end;
$$;

comment on function public.sync_student_outcome_from_application() is
  'AFTER INSERT/UPDATE trigger on applications: recomputes and upserts the application-derived subset of that student''s student_outcomes row (journey_stage/outcome_status/application_count/offer_count/final_decision_status/final_application_id) from ALL of their applications rows, every time any of their applications changes. Never touches target_career_id/target_course_id/target_university_id/destination_country/metadata — those stay under the manual admin/counsellor write path (src/lib/supabase/admin/outcomes.ts) even as this trigger keeps the rest current. SECURITY DEFINER because the derived student_outcomes row must always be writable by whoever the applications table''s own RLS already allowed to change this application (see PART 4''s header comment for the full justification) — this function never reads or writes any other student''s applications or outcome row.';

drop trigger if exists sync_student_outcome_from_application on public.applications;
create trigger sync_student_outcome_from_application
  after insert or update of stage, decision_status on public.applications
  for each row execute function public.sync_student_outcome_from_application();

revoke execute on function public.sync_student_outcome_from_application() from public;


-- ============================================================================
-- PART 5 — SECURITY DEFINER safety review (matching
-- 0007_nextwise_pricing_offers.sql PART 7.2's table for its own DEFINER
-- function)
--
--                                        fixed safe   cannot bypass RLS to    cannot act outside
--                                        search_path  expose data              caller's own scope
-- sync_student_outcome_from_application()    yes      only reads applications  yes — writes exactly
--                                                       rows for NEW.student_    one student_outcomes
--                                                       user_id (the very        row, keyed to
--                                                       student whose             NEW.student_user_id,
--                                                       application row the       which the caller was
--                                                       caller''s own INSERT/     already authorized
--                                                       UPDATE just touched,      (by applications''
--                                                       under applications''      own RLS) to affect
--                                                       own RLS); writes only     via the very write
--                                                       the application-derived   that fired this
--                                                       columns of that one       trigger
--                                                       row
-- ============================================================================


-- ============================================================================
-- PART 6 — Verification queries (run manually after applying this
-- migration; not executed automatically by this file). Same pattern as
-- 0007_nextwise_pricing_offers.sql PART 8 / 0005_payments_billing.sql PART 11.
--
-- 1) `anon` should be able to insert a product_events row with a valid
--    event_name, and unable to read any row back:
--
-- insert into public.product_events (event_name, path) values (''career_viewed'', ''/careers/test'');
-- select count(*) from public.product_events; -- expect 0 rows visible as anon
--
-- 2) An invalid event_name should be rejected outright:
--
-- insert into public.product_events (event_name) values (''not_a_real_event'');
-- -- expected: violates check constraint "product_events_event_name_check"
--
-- 3) A signed-in student inserting an event cannot forge another user''s id
--    — confirm user_id always lands as auth.uid(), never the inserted value:
--
-- insert into public.product_events (event_name, user_id) values (''career_viewed'', ''00000000-0000-0000-0000-000000000000'');
-- select user_id from public.product_events order by created_at desc limit 1;
-- -- expected: your own auth.uid(), never the all-zero uuid supplied above
--
-- 4) Confirm the applications -> student_outcomes sync trigger actually
--    fires (as an admin, against a real application row):
--
-- update public.applications set stage = ''submitted'' where id = ''<some application id>'';
-- select journey_stage, outcome_status, application_count, offer_count, final_application_id
--   from public.student_outcomes where student_user_id = (select student_user_id from public.applications where id = ''<same application id>'');
-- -- expected: journey_stage = ''application_submitted'', application_count >= 1
--
-- 5) Funnel reconstruction sanity check — Activation funnel (registrations
--    -> profile completions) purely from existing/new tables:
--
-- select
--   (select count(*) from auth.users) as total_registered,
--   (select count(*) from public.student_profiles where profile_status = ''completed'') as profile_completed;
--
-- 6) Engagement funnel — discovery events by type, last 30 days:
--
-- select event_name, count(*) from public.product_events
--   where event_name in (''career_viewed'', ''course_viewed'', ''college_viewed'', ''career_recommendations_generated'')
--     and created_at >= now() - interval ''30 days''
--   group by event_name order by 2 desc;
--
-- 7) Commercial funnel — checkout starts vs completions vs actual paid
--    invoices (the ledger, not the event log, remains authoritative for
--    money):
--
-- select
--   (select count(*) from public.product_events where event_name = ''payment_started'') as checkout_started,
--   (select count(*) from public.product_events where event_name = ''payment_completed'') as checkout_verified,
--   (select count(*) from public.invoices where status = ''paid'') as invoices_paid;
--
-- 8) Outcome funnel — student_outcomes distribution:
--
-- select outcome_status, count(*) from public.student_outcomes group by outcome_status order by 2 desc;
-- ============================================================================
