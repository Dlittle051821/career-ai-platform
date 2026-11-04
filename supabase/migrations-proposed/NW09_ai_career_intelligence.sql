-- ============================================================================
-- NW09 — AI Career Intelligence: run ledger, limits and budget enforcement.
--
-- STATUS: PROPOSED. NOT APPLIED. Review before use.
--
-- DEPENDS ON (must be applied first, in this order):
--   supabase/migrations/0001 … 0022            (applied history)
--   supabase/migrations-proposed/NW07_counsellor_studio_foundation.sql
--     — provides public.recommendation_drafts and
--       public.counsellor_has_case_access(uuid). NW07 is itself still
--       PROPOSED/UNAPPLIED (docs/milestones/NW07/NW07_DATABASE_CHANGE_PLAN.md);
--       this file fails fast below if it has not been applied.
--
-- WHAT THIS ADDS
--   1. public.ai_usage_settings      — singleton row of hard limits that the
--                                      server's environment can only TIGHTEN.
--   2. public.ai_generation_runs     — one row per requested AI analysis:
--                                      who, for which student, which provider/
--                                      model, tokens, estimated cost, outcome,
--                                      the staff-only analysis, and the NW07
--                                      draft it produced.
--   3. RPCs (SECURITY DEFINER, search_path pinned, EXECUTE revoked from
--      public and granted to authenticated only):
--        staff_reserve_ai_generation_run()      atomic limits + idempotency
--        staff_complete_ai_generation_run()     requester-only, once
--        staff_link_ai_generation_run_draft()   requester-only, once
--        admin_purge_ai_generation_reports()    retention (super_admin)
--
-- WHAT THIS DELIBERATELY DOES NOT DO
--   * No student policy of any kind on either table. Students never see an
--     AI run, an analysis, or a draft. Their only access to the approved
--     report remains NW07's get_my_recommendation_report*() RPCs, after a
--     counsellor-authored draft has been independently approved AND released.
--   * No change to recommendation_drafts or its RPCs: an AI-assisted draft is
--     created through the SAME staff_create_recommendation_draft() a human
--     counsellor uses, so NW07's self-approval prevention and
--     approval-before-release rules apply unchanged.
--   * No insert/update/delete policies: every write goes through an RPC that
--     re-validates the caller.
--
-- ROLLBACK (only if no data needs keeping):
--   drop function if exists public.admin_purge_ai_generation_reports(integer);
--   drop function if exists public.staff_link_ai_generation_run_draft(uuid, uuid);
--   drop function if exists public.staff_complete_ai_generation_run(uuid, text, text, text, integer, integer, numeric, integer, integer, jsonb);
--   drop function if exists public.staff_reserve_ai_generation_run(uuid, text, text, text, text, text, text, boolean, numeric, integer, integer, integer, numeric, uuid, text);
--   drop table if exists public.ai_generation_runs;
--   drop table if exists public.ai_usage_settings;
-- ============================================================================

do $$
begin
  if to_regclass('public.recommendation_drafts') is null
     or to_regprocedure('public.counsellor_has_case_access(uuid)') is null then
    raise exception 'NW09 requires NW07_counsellor_studio_foundation.sql to be applied first (recommendation_drafts, counsellor_has_case_access).';
  end if;
end $$;


-- ----------------------------------------------------------------------------
-- 1. ai_usage_settings — the database's own ceiling on AI usage.
--    The application passes its configured limits to the reserve RPC; the RPC
--    uses LEAST(passed, stored), so a misconfigured server (or a staff member
--    calling the RPC directly) can never raise a limit above what is stored
--    here. Only super_admin can change these values.
-- ----------------------------------------------------------------------------

create table if not exists public.ai_usage_settings (
  id smallint primary key default 1,
  per_staff_daily integer not null default 20,
  per_student_daily integer not null default 3,
  global_daily integer not null default 100,
  monthly_budget_usd numeric(10, 2) not null default 25.00,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  constraint ai_usage_settings_singleton check (id = 1),
  constraint ai_usage_settings_ranges check (
    per_staff_daily between 0 and 500
    and per_student_daily between 0 and 50
    and global_daily between 0 and 5000
    and monthly_budget_usd between 0 and 10000
  )
);

insert into public.ai_usage_settings (id) values (1) on conflict (id) do nothing;

comment on table public.ai_usage_settings is
  'NW09 — singleton (id = 1) hard ceilings for AI Career Intelligence usage. The reserve RPC applies LEAST(application limit, this row). super_admin-only to change.';

alter table public.ai_usage_settings enable row level security;

drop policy if exists "Admins can read AI usage settings" on public.ai_usage_settings;
create policy "Admins can read AI usage settings"
  on public.ai_usage_settings for select to authenticated
  using (public.is_admin_role(array['super_admin', 'admin']));

drop policy if exists "Super admin can update AI usage settings" on public.ai_usage_settings;
create policy "Super admin can update AI usage settings"
  on public.ai_usage_settings for update to authenticated
  using (public.is_admin_role(array['super_admin']))
  with check (public.is_admin_role(array['super_admin']));


-- ----------------------------------------------------------------------------
-- 2. ai_generation_runs — the ledger.
-- ----------------------------------------------------------------------------

create table if not exists public.ai_generation_runs (
  id uuid primary key default gen_random_uuid(),
  task text not null default 'career_intelligence.v1',
  student_user_id uuid not null references auth.users (id) on delete cascade,
  requested_by uuid references auth.users (id) on delete set null,
  requested_by_role text,
  idempotency_key text not null,
  provider text not null,
  model text not null,
  prompt_version text not null,
  report_schema_version text not null,
  data_class text not null,
  status text not null default 'reserved',
  reason text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  reserved_cost_usd numeric(12, 6) not null default 0,
  estimated_cost_usd numeric(12, 6) not null default 0,
  attempts integer not null default 0,
  latency_ms integer not null default 0,
  consent_confirmed boolean not null,
  regenerates_run_id uuid references public.ai_generation_runs (id) on delete set null,
  regeneration_reason text,
  draft_id uuid references public.recommendation_drafts (id) on delete set null,
  -- STAFF-ONLY analysis (evidence, uncertainties, counsellor flags, engine
  -- bands). Never shown to a student. Purged by admin_purge_ai_generation_reports().
  report jsonb,
  report_purged_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint ai_generation_runs_task_check check (task in ('career_intelligence.v1')),
  constraint ai_generation_runs_provider_check check (provider in ('mock', 'gemini', 'openai')),
  constraint ai_generation_runs_data_class_check check (data_class in ('fictional', 'real_student')),
  -- A real student's data may never be recorded as processed by the Gemini free tier.
  constraint ai_generation_runs_gemini_fictional_only check (provider <> 'gemini' or data_class = 'fictional'),
  constraint ai_generation_runs_status_check check (status in (
    'reserved', 'succeeded', 'failed', 'refused', 'invalid_output', 'blocked', 'expired'
  )),
  constraint ai_generation_runs_idempotency_check check (idempotency_key ~ '^[A-Za-z0-9_-]{16,80}$'),
  constraint ai_generation_runs_model_check check (model ~ '^[A-Za-z0-9._:-]{2,64}$'),
  constraint ai_generation_runs_reason_check check (reason is null or length(reason) <= 500),
  constraint ai_generation_runs_regen_reason_check check (
    (regenerates_run_id is null and regeneration_reason is null)
    or (regenerates_run_id is not null and length(trim(regeneration_reason)) between 10 and 500)
  ),
  constraint ai_generation_runs_tokens_check check (input_tokens >= 0 and output_tokens >= 0 and attempts >= 0 and latency_ms >= 0),
  constraint ai_generation_runs_cost_check check (reserved_cost_usd >= 0 and estimated_cost_usd >= 0),
  constraint ai_generation_runs_report_size_check check (report is null or pg_column_size(report) <= 262144),
  constraint ai_generation_runs_report_only_on_success check (report is null or status = 'succeeded'),
  constraint ai_generation_runs_completion_check check ((status = 'reserved') = (completed_at is null)),
  constraint ai_generation_runs_unique_request unique (requested_by, idempotency_key)
);

create index if not exists ai_generation_runs_student_idx on public.ai_generation_runs (student_user_id, created_at desc);
create index if not exists ai_generation_runs_requester_idx on public.ai_generation_runs (requested_by, created_at desc);
create index if not exists ai_generation_runs_created_idx on public.ai_generation_runs (created_at desc);
create index if not exists ai_generation_runs_reserved_idx on public.ai_generation_runs (created_at) where status = 'reserved';

comment on table public.ai_generation_runs is
  'NW09 — one row per requested AI Career Intelligence analysis. Staff-only (admins; counsellors for students they have case access to). The report column holds the staff-only analysis; the student-facing text lives in the NW07 draft (draft_id) and only reaches the student after independent approval and release.';

alter table public.ai_generation_runs enable row level security;

drop policy if exists "Admins and case counsellors can read AI generation runs" on public.ai_generation_runs;
create policy "Admins and case counsellors can read AI generation runs"
  on public.ai_generation_runs for select to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin'])
    or (
      public.is_admin_role(array['counsellor'])
      and public.counsellor_has_case_access(ai_generation_runs.student_user_id)
    )
  );
-- No insert/update/delete policy: writes only through the RPCs below.


-- ----------------------------------------------------------------------------
-- 3a. staff_reserve_ai_generation_run() — called BEFORE any provider call.
--     Atomic (transaction-scoped advisory lock serialises concurrent
--     reservations, so two simultaneous requests cannot both pass a limit).
--     Returns one row: outcome = 'reserved' | 'duplicate' | 'denied'.
-- ----------------------------------------------------------------------------

create or replace function public.staff_reserve_ai_generation_run(
  p_student_user_id uuid,
  p_idempotency_key text,
  p_provider text,
  p_model text,
  p_prompt_version text,
  p_report_schema_version text,
  p_data_class text,
  p_consent_confirmed boolean,
  p_worst_case_cost_usd numeric,
  p_limit_staff_daily integer,
  p_limit_student_daily integer,
  p_limit_global_daily integer,
  p_monthly_budget_usd numeric,
  p_regenerates_run_id uuid,
  p_regeneration_reason text
)
returns table (run_id uuid, outcome text, existing_status text, existing_draft_id uuid, denial_reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text := public.current_admin_role();
  v_settings public.ai_usage_settings;
  v_existing public.ai_generation_runs;
  v_staff_today integer;
  v_student_today integer;
  v_global_today integer;
  v_month_cost numeric;
  v_day_start timestamptz := date_trunc('day', now());
  v_month_start timestamptz := date_trunc('month', now());
  v_new_id uuid;
begin
  if v_uid is null then
    raise exception 'Not signed in.';
  end if;
  if not (
    public.is_admin_role(array['super_admin', 'admin'])
    or (public.is_admin_role(array['counsellor']) and public.counsellor_has_case_access(p_student_user_id))
  ) then
    raise exception 'Not authorized to request an AI analysis for this student.';
  end if;
  if p_consent_confirmed is distinct from true then
    raise exception 'AI-assisted processing must be confirmed with the student before requesting an analysis.';
  end if;
  if p_provider not in ('mock', 'gemini', 'openai') then
    raise exception 'Unknown AI provider.';
  end if;
  if p_data_class not in ('fictional', 'real_student') or (p_provider = 'gemini' and p_data_class <> 'fictional') then
    raise exception 'This provider may not process this data.';
  end if;
  if p_worst_case_cost_usd is null or p_worst_case_cost_usd < 0 then
    raise exception 'Invalid cost reservation.';
  end if;
  if p_regenerates_run_id is not null and not exists (
    select 1 from public.ai_generation_runs r
    where r.id = p_regenerates_run_id and r.student_user_id = p_student_user_id
  ) then
    raise exception 'The analysis being regenerated does not belong to this student.';
  end if;

  perform pg_advisory_xact_lock(hashtext('public.ai_generation_runs'));

  -- Idempotency: the same requester + key returns the original run, whatever its state.
  select * into v_existing from public.ai_generation_runs r
  where r.requested_by = v_uid and r.idempotency_key = p_idempotency_key;
  if found then
    return query select v_existing.id, 'duplicate'::text, v_existing.status, v_existing.draft_id, null::text;
    return;
  end if;

  -- Reservations abandoned for 15 minutes (e.g. a crashed server) stop counting toward budgets.
  update public.ai_generation_runs
     set status = 'expired', reason = 'Reservation expired without completion.', completed_at = now()
   where status = 'reserved' and created_at < now() - interval '15 minutes';

  select * into v_settings from public.ai_usage_settings where id = 1;

  select count(*) into v_staff_today from public.ai_generation_runs r
   where r.requested_by = v_uid and r.created_at >= v_day_start and r.status <> 'blocked';
  select count(*) into v_student_today from public.ai_generation_runs r
   where r.student_user_id = p_student_user_id and r.created_at >= v_day_start and r.status <> 'blocked';
  select count(*) into v_global_today from public.ai_generation_runs r
   where r.created_at >= v_day_start and r.status <> 'blocked';
  select coalesce(sum(case when r.status = 'reserved' then r.reserved_cost_usd else r.estimated_cost_usd end), 0)
    into v_month_cost from public.ai_generation_runs r
   where r.created_at >= v_month_start;

  if v_staff_today >= least(coalesce(p_limit_staff_daily, 0), v_settings.per_staff_daily) then
    return query select null::uuid, 'denied'::text, null::text, null::uuid, 'You have reached today''s limit of AI analyses.'::text;
    return;
  end if;
  if v_student_today >= least(coalesce(p_limit_student_daily, 0), v_settings.per_student_daily) then
    return query select null::uuid, 'denied'::text, null::text, null::uuid, 'This student has reached today''s limit of AI analyses.'::text;
    return;
  end if;
  if v_global_today >= least(coalesce(p_limit_global_daily, 0), v_settings.global_daily) then
    return query select null::uuid, 'denied'::text, null::text, null::uuid, 'The organisation''s daily AI limit has been reached.'::text;
    return;
  end if;
  if v_month_cost + p_worst_case_cost_usd > least(coalesce(p_monthly_budget_usd, 0), v_settings.monthly_budget_usd) then
    return query select null::uuid, 'denied'::text, null::text, null::uuid, 'This month''s AI budget would be exceeded.'::text;
    return;
  end if;

  insert into public.ai_generation_runs (
    student_user_id, requested_by, requested_by_role, idempotency_key, provider, model,
    prompt_version, report_schema_version, data_class, status, reserved_cost_usd,
    consent_confirmed, regenerates_run_id, regeneration_reason
  ) values (
    p_student_user_id, v_uid, v_role, p_idempotency_key, p_provider, p_model,
    p_prompt_version, p_report_schema_version, p_data_class, 'reserved', p_worst_case_cost_usd,
    true, p_regenerates_run_id, nullif(trim(coalesce(p_regeneration_reason, '')), '')
  )
  returning id into v_new_id;

  return query select v_new_id, 'reserved'::text, null::text, null::uuid, null::text;
end;
$$;

comment on function public.staff_reserve_ai_generation_run(uuid, text, text, text, text, text, text, boolean, numeric, integer, integer, integer, numeric, uuid, text) is
  'NW09 — reserve an AI analysis BEFORE any provider call. Re-checks admin role or counsellor case access; requires recorded AI-processing consent; refuses Gemini for real student data; serialises limit checks with an advisory lock; enforces LEAST(app limit, ai_usage_settings); returns the original run for a repeated idempotency key.';

revoke execute on function public.staff_reserve_ai_generation_run(uuid, text, text, text, text, text, text, boolean, numeric, integer, integer, integer, numeric, uuid, text) from public;
grant execute on function public.staff_reserve_ai_generation_run(uuid, text, text, text, text, text, text, boolean, numeric, integer, integer, integer, numeric, uuid, text) to authenticated;


-- ----------------------------------------------------------------------------
-- 3b. staff_complete_ai_generation_run() — the requester records the outcome,
--     exactly once (row lock + 'reserved' guard).
-- ----------------------------------------------------------------------------

create or replace function public.staff_complete_ai_generation_run(
  p_run_id uuid,
  p_status text,
  p_reason text,
  p_model text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_estimated_cost_usd numeric,
  p_attempts integer,
  p_latency_ms integer,
  p_report jsonb
)
returns public.ai_generation_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.ai_generation_runs;
begin
  select * into v_run from public.ai_generation_runs where id = p_run_id for update;
  if not found then
    raise exception 'AI analysis not found.';
  end if;
  if v_run.requested_by is distinct from auth.uid() then
    raise exception 'Only the person who requested this analysis can record its outcome.';
  end if;
  if v_run.status <> 'reserved' then
    raise exception 'This analysis has already been completed.';
  end if;
  if p_status not in ('succeeded', 'failed', 'refused', 'invalid_output', 'blocked') then
    raise exception 'Invalid completion status.';
  end if;
  if p_report is not null and (p_status <> 'succeeded' or jsonb_typeof(p_report) <> 'object') then
    raise exception 'An analysis report can only be stored for a successful run.';
  end if;

  update public.ai_generation_runs
     set status = p_status,
         reason = left(p_reason, 500),
         model = coalesce(nullif(p_model, ''), model),
         input_tokens = greatest(coalesce(p_input_tokens, 0), 0),
         output_tokens = greatest(coalesce(p_output_tokens, 0), 0),
         estimated_cost_usd = greatest(coalesce(p_estimated_cost_usd, 0), 0),
         attempts = greatest(coalesce(p_attempts, 0), 0),
         latency_ms = greatest(coalesce(p_latency_ms, 0), 0),
         report = p_report,
         completed_at = now()
   where id = p_run_id
  returning * into v_run;
  return v_run;
end;
$$;

revoke execute on function public.staff_complete_ai_generation_run(uuid, text, text, text, integer, integer, numeric, integer, integer, jsonb) from public;
grant execute on function public.staff_complete_ai_generation_run(uuid, text, text, text, integer, integer, numeric, integer, integer, jsonb) to authenticated;


-- ----------------------------------------------------------------------------
-- 3c. staff_link_ai_generation_run_draft() — attach the NW07 draft created
--     from a successful run (requester only, once, same student).
-- ----------------------------------------------------------------------------

create or replace function public.staff_link_ai_generation_run_draft(p_run_id uuid, p_draft_id uuid)
returns public.ai_generation_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.ai_generation_runs;
begin
  select * into v_run from public.ai_generation_runs where id = p_run_id for update;
  if not found then
    raise exception 'AI analysis not found.';
  end if;
  if v_run.requested_by is distinct from auth.uid() then
    raise exception 'Only the person who requested this analysis can link its draft.';
  end if;
  if v_run.status <> 'succeeded' or v_run.draft_id is not null then
    raise exception 'This analysis cannot be linked to a draft.';
  end if;
  if not exists (
    select 1 from public.recommendation_drafts d
    where d.id = p_draft_id and d.student_user_id = v_run.student_user_id and d.status = 'draft'
  ) then
    raise exception 'The draft does not belong to this student or is no longer a draft.';
  end if;

  update public.ai_generation_runs set draft_id = p_draft_id where id = p_run_id returning * into v_run;
  return v_run;
end;
$$;

revoke execute on function public.staff_link_ai_generation_run_draft(uuid, uuid) from public;
grant execute on function public.staff_link_ai_generation_run_draft(uuid, uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 3d. admin_purge_ai_generation_reports() — retention. Clears the staff-only
--     analysis (report) on completed runs older than N days (minimum 30),
--     keeping the accounting row (tokens, cost, outcome) for audit. The
--     approved, student-facing report lives on in the NW07 draft versions.
--     Schedule it (e.g. weekly) once a retention period is agreed.
-- ----------------------------------------------------------------------------

create or replace function public.admin_purge_ai_generation_reports(p_older_than_days integer default 180)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_admin_role(array['super_admin']) then
    raise exception 'Only a super admin can purge AI analyses.';
  end if;
  if p_older_than_days is null or p_older_than_days < 30 then
    raise exception 'Retention period must be at least 30 days.';
  end if;
  update public.ai_generation_runs
     set report = null, report_purged_at = now()
   where report is not null and completed_at < now() - make_interval(days => p_older_than_days);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.admin_purge_ai_generation_reports(integer) from public;
grant execute on function public.admin_purge_ai_generation_reports(integer) to authenticated;
