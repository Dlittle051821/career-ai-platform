-- ============================================================================
-- NW09.2 — OpenAI live pilot: recorded AI-processing consent, paid-pilot
-- ceilings, the real-student gate, and provider evidence on the run ledger.
--
-- STATUS: PROPOSED. NOT APPLIED. Review before use. Apply to
-- Nextwise-Development-QA (ynwzijulzksmrcwdhudv) first; NEVER run
-- `supabase db push` against the production project (bwlkxunujngksibfzzfv).
--
-- DEPENDS ON (must already be applied, in this order):
--   supabase/migrations/0001 … 0022
--   supabase/migrations-proposed/NW07_counsellor_studio_foundation.sql
--   supabase/migrations-proposed/NW09_ai_career_intelligence.sql
-- This file fails fast below if either is missing.
--
-- WHAT THIS ADDS
--   1. public.student_ai_processing_consents — the consent REGISTER. One row
--      per recorded consent: who consented (student / parent-guardian /
--      both), how (signed form, recorded meeting, written confirmation, or —
--      development only — a fictional test account), an evidence reference
--      (e.g. the signed form's document id), the date it was given, who
--      recorded it, and its withdrawal. A checkbox in a request form is no
--      longer accepted as consent: an analysis now needs a valid row here.
--   2. ai_usage_settings: paid_max_runs (default 5), paid_total_budget_usd
--      (default 2.00) — ALL-TIME ceilings on the paid provider (the pilot
--      budget), and real_student_processing_approved (default FALSE) — a
--      super-admin flag that must be set, after the privacy review, before a
--      real student's profile may be sent to OpenAI.
--   3. ai_generation_runs: consent_id (which consent covered the run),
--      provider_response_id (OpenAI "resp_…" — evidence of a genuine API
--      response), cached_input_tokens, reasoning_tokens.
--   4. RPCs (SECURITY DEFINER, search_path pinned, EXECUTE revoked from
--      public and anon, granted to authenticated):
--        staff_record_ai_processing_consent()
--        staff_withdraw_ai_processing_consent()
--        staff_reserve_ai_generation_run_v2()   — v1 checks + valid consent,
--            one analysis in progress per student, real-student gate,
--            all-time paid caps; v1's EXECUTE is revoked so it cannot be
--            used to bypass the consent check
--        staff_complete_ai_generation_run_v2()  — v1 + provider evidence
--        staff_get_ai_usage_summary()           — aggregate counters only
--                                                 (no student data) for the
--                                                 Counsellor Studio usage card
--
-- WHAT THIS DELIBERATELY DOES NOT DO
--   * No student policy on any table: students never see consent records,
--     AI runs or analyses. Their only access to a report remains NW07's
--     get_my_recommendation_report*() after independent approval + release.
--   * No change to recommendation_drafts or its RPCs (NW07): AI-assisted
--     drafts still go through staff_create_recommendation_draft() and the
--     unchanged review → approve → release workflow.
--   * Does not set real_student_processing_approved. That is a deliberate,
--     separate super-admin action after the privacy review.
--
-- ROLLBACK (only if no data needs keeping):
--   grant execute on function public.staff_reserve_ai_generation_run(uuid, text, text, text, text, text, text, boolean, numeric, integer, integer, integer, numeric, uuid, text) to authenticated;  -- (anon stays revoked)
--   grant execute on function public.staff_complete_ai_generation_run(uuid, text, text, text, integer, integer, numeric, integer, integer, jsonb) to authenticated;
--   drop function if exists public.staff_get_ai_usage_summary();
--   drop function if exists public.staff_complete_ai_generation_run_v2(uuid, text, text, text, integer, integer, integer, integer, numeric, integer, integer, text, jsonb);
--   drop function if exists public.staff_reserve_ai_generation_run_v2(uuid, text, text, text, text, text, text, uuid, numeric, integer, integer, integer, numeric, integer, numeric, uuid, text);
--   drop function if exists public.staff_withdraw_ai_processing_consent(uuid, text);
--   drop function if exists public.staff_record_ai_processing_consent(uuid, text, text, text, date, text);
--   alter table public.ai_generation_runs drop column if exists consent_id, drop column if exists provider_response_id,
--     drop column if exists cached_input_tokens, drop column if exists reasoning_tokens;
--   alter table public.ai_usage_settings drop column if exists paid_max_runs, drop column if exists paid_total_budget_usd,
--     drop column if exists real_student_processing_approved, drop column if exists real_student_approval_reference,
--     drop column if exists real_student_approved_at, drop column if exists real_student_approved_by;
--   drop table if exists public.student_ai_processing_consents;
-- ============================================================================

do $$
begin
  if to_regclass('public.recommendation_drafts') is null
     or to_regprocedure('public.counsellor_has_case_access(uuid)') is null then
    raise exception 'NW09.2 requires NW07_counsellor_studio_foundation.sql to be applied first.';
  end if;
  if to_regclass('public.ai_generation_runs') is null
     or to_regclass('public.ai_usage_settings') is null
     or to_regprocedure('public.staff_reserve_ai_generation_run(uuid, text, text, text, text, text, text, boolean, numeric, integer, integer, integer, numeric, uuid, text)') is null then
    raise exception 'NW09.2 requires NW09_ai_career_intelligence.sql to be applied first.';
  end if;
end $$;


-- ----------------------------------------------------------------------------
-- 1. The consent register.
-- ----------------------------------------------------------------------------

create table if not exists public.student_ai_processing_consents (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references auth.users (id) on delete cascade,
  scope text not null default 'career_intelligence',
  consenting_party text not null,
  method text not null,
  evidence_reference text not null,
  notes text,
  given_on date not null,
  recorded_by uuid references auth.users (id) on delete set null,
  recorded_by_role text,
  recorded_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  withdrawn_by uuid references auth.users (id) on delete set null,
  withdrawal_reason text,
  constraint student_ai_consents_scope_check check (scope in ('career_intelligence')),
  constraint student_ai_consents_party_check check (consenting_party in ('student', 'parent_guardian', 'student_and_parent_guardian')),
  constraint student_ai_consents_method_check check (method in ('signed_consent_form', 'recorded_meeting', 'written_confirmation', 'fictional_test_account')),
  constraint student_ai_consents_evidence_check check (length(trim(evidence_reference)) between 3 and 200),
  constraint student_ai_consents_notes_check check (notes is null or length(notes) <= 500),
  constraint student_ai_consents_given_check check (given_on <= current_date and given_on >= date '2020-01-01'),
  constraint student_ai_consents_withdrawal_check check (
    (withdrawn_at is null and withdrawn_by is null and withdrawal_reason is null)
    or (withdrawn_at is not null and length(trim(coalesce(withdrawal_reason, ''))) between 3 and 500)
  )
);

-- At most ONE active (not withdrawn) consent per student and scope.
create unique index if not exists student_ai_consents_one_active
  on public.student_ai_processing_consents (student_user_id, scope) where withdrawn_at is null;
create index if not exists student_ai_consents_student_idx on public.student_ai_processing_consents (student_user_id, recorded_at desc);

comment on table public.student_ai_processing_consents is
  'NW09.2 — register of recorded consent to AI-assisted processing (Career Intelligence). Staff-only (admins; counsellors with case access). Written only through staff_record_/staff_withdraw_ai_processing_consent(). An AI analysis requires a valid (not withdrawn) row.';

alter table public.student_ai_processing_consents enable row level security;

drop policy if exists "Admins and case counsellors can read AI consents" on public.student_ai_processing_consents;
create policy "Admins and case counsellors can read AI consents"
  on public.student_ai_processing_consents for select to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin'])
    or (
      public.is_admin_role(array['counsellor'])
      and public.counsellor_has_case_access(student_ai_processing_consents.student_user_id)
    )
  );
-- No insert/update/delete policy: writes only through the RPCs below.


create or replace function public.staff_record_ai_processing_consent(
  p_student_user_id uuid,
  p_consenting_party text,
  p_method text,
  p_evidence_reference text,
  p_given_on date,
  p_notes text
)
returns public.student_ai_processing_consents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.student_ai_processing_consents;
begin
  if v_uid is null then
    raise exception 'Not signed in.';
  end if;
  if not (
    public.is_admin_role(array['super_admin', 'admin'])
    or (public.is_admin_role(array['counsellor']) and public.counsellor_has_case_access(p_student_user_id))
  ) then
    raise exception 'Not authorized to record consent for this student.';
  end if;
  if exists (
    select 1 from public.student_ai_processing_consents c
    where c.student_user_id = p_student_user_id and c.scope = 'career_intelligence' and c.withdrawn_at is null
  ) then
    raise exception 'An active AI-processing consent is already recorded for this student. Withdraw it first to record a new one.';
  end if;

  insert into public.student_ai_processing_consents (
    student_user_id, consenting_party, method, evidence_reference, notes, given_on, recorded_by, recorded_by_role
  ) values (
    p_student_user_id, p_consenting_party, p_method, trim(p_evidence_reference), nullif(trim(coalesce(p_notes, '')), ''), p_given_on,
    v_uid, public.current_admin_role()
  )
  returning * into v_row;
  return v_row;
end;
$$;

revoke execute on function public.staff_record_ai_processing_consent(uuid, text, text, text, date, text) from public, anon;
grant execute on function public.staff_record_ai_processing_consent(uuid, text, text, text, date, text) to authenticated;


create or replace function public.staff_withdraw_ai_processing_consent(p_consent_id uuid, p_reason text)
returns public.student_ai_processing_consents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.student_ai_processing_consents;
begin
  if v_uid is null then
    raise exception 'Not signed in.';
  end if;
  select * into v_row from public.student_ai_processing_consents where id = p_consent_id for update;
  if not found then
    raise exception 'Consent record not found.';
  end if;
  if not (
    public.is_admin_role(array['super_admin', 'admin'])
    or (public.is_admin_role(array['counsellor']) and public.counsellor_has_case_access(v_row.student_user_id))
  ) then
    raise exception 'Not authorized to withdraw consent for this student.';
  end if;
  if v_row.withdrawn_at is not null then
    raise exception 'This consent has already been withdrawn.';
  end if;
  update public.student_ai_processing_consents
     set withdrawn_at = now(), withdrawn_by = v_uid, withdrawal_reason = trim(p_reason)
   where id = p_consent_id
  returning * into v_row;
  return v_row;
end;
$$;

revoke execute on function public.staff_withdraw_ai_processing_consent(uuid, text) from public, anon;
grant execute on function public.staff_withdraw_ai_processing_consent(uuid, text) to authenticated;


-- ----------------------------------------------------------------------------
-- 2. Paid-pilot ceilings and the real-student gate (database half).
-- ----------------------------------------------------------------------------

alter table public.ai_usage_settings
  add column if not exists paid_max_runs integer not null default 5,
  add column if not exists paid_total_budget_usd numeric(10, 2) not null default 2.00,
  add column if not exists real_student_processing_approved boolean not null default false,
  add column if not exists real_student_approval_reference text,
  add column if not exists real_student_approved_at timestamptz,
  add column if not exists real_student_approved_by uuid references auth.users (id) on delete set null;

alter table public.ai_usage_settings drop constraint if exists ai_usage_settings_paid_ranges;
alter table public.ai_usage_settings add constraint ai_usage_settings_paid_ranges check (
  paid_max_runs between 0 and 100000 and paid_total_budget_usd between 0 and 100000
);
alter table public.ai_usage_settings drop constraint if exists ai_usage_settings_real_student_approval;
alter table public.ai_usage_settings add constraint ai_usage_settings_real_student_approval check (
  real_student_processing_approved = false
  or (length(trim(coalesce(real_student_approval_reference, ''))) >= 3 and real_student_approved_at is not null)
);

comment on column public.ai_usage_settings.paid_max_runs is
  'NW09.2 — all-time ceiling on paid-provider (OpenAI) analyses (every reserved run except "blocked" counts, including failures and expired reservations, which may have been billed).';
comment on column public.ai_usage_settings.paid_total_budget_usd is
  'NW09.2 — all-time ceiling on ESTIMATED paid-provider spend (USD). The OpenAI dashboard remains the authoritative figure; set an OpenAI project budget as well.';
comment on column public.ai_usage_settings.real_student_processing_approved is
  'NW09.2 — must be TRUE (set by a super admin after the privacy review, with a reference) before a REAL student''s profile may be sent to OpenAI. The application flag AI_REAL_STUDENT_DATA_APPROVED is also required.';


-- ----------------------------------------------------------------------------
-- 3. Provider evidence on the ledger.
-- ----------------------------------------------------------------------------

alter table public.ai_generation_runs
  add column if not exists consent_id uuid references public.student_ai_processing_consents (id) on delete set null,
  add column if not exists provider_response_id text,
  add column if not exists cached_input_tokens integer not null default 0,
  add column if not exists reasoning_tokens integer not null default 0;

alter table public.ai_generation_runs drop constraint if exists ai_generation_runs_provider_response_id_check;
alter table public.ai_generation_runs add constraint ai_generation_runs_provider_response_id_check check (
  provider_response_id is null or provider_response_id ~ '^[A-Za-z0-9_-]{1,128}$'
);
alter table public.ai_generation_runs drop constraint if exists ai_generation_runs_detail_tokens_check;
alter table public.ai_generation_runs add constraint ai_generation_runs_detail_tokens_check check (
  cached_input_tokens >= 0 and reasoning_tokens >= 0
);


-- ----------------------------------------------------------------------------
-- 4a. staff_reserve_ai_generation_run_v2()
-- ----------------------------------------------------------------------------

create or replace function public.staff_reserve_ai_generation_run_v2(
  p_student_user_id uuid,
  p_idempotency_key text,
  p_provider text,
  p_model text,
  p_prompt_version text,
  p_report_schema_version text,
  p_data_class text,
  p_consent_id uuid,
  p_worst_case_cost_usd numeric,
  p_limit_staff_daily integer,
  p_limit_student_daily integer,
  p_limit_global_daily integer,
  p_monthly_budget_usd numeric,
  p_paid_max_runs integer,
  p_paid_total_budget_usd numeric,
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
  v_consent public.student_ai_processing_consents;
  v_staff_today integer;
  v_student_today integer;
  v_global_today integer;
  v_month_cost numeric;
  v_paid_runs integer;
  v_paid_cost numeric;
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
  if p_provider not in ('mock', 'gemini', 'openai') then
    raise exception 'Unknown AI provider.';
  end if;
  if p_data_class not in ('fictional', 'real_student') or (p_provider = 'gemini' and p_data_class <> 'fictional') then
    raise exception 'This provider may not process this data.';
  end if;
  if p_worst_case_cost_usd is null or p_worst_case_cost_usd < 0 then
    raise exception 'Invalid cost reservation.';
  end if;

  -- Recorded, valid consent for THIS student (never a checkbox).
  select * into v_consent from public.student_ai_processing_consents c where c.id = p_consent_id;
  if not found or v_consent.student_user_id <> p_student_user_id or v_consent.scope <> 'career_intelligence' or v_consent.withdrawn_at is not null then
    raise exception 'No valid recorded AI-processing consent for this student.';
  end if;
  if v_consent.method = 'fictional_test_account' and p_data_class <> 'fictional' then
    raise exception 'A fictional-test-account consent cannot cover a real student.';
  end if;

  if p_regenerates_run_id is not null and not exists (
    select 1 from public.ai_generation_runs r
    where r.id = p_regenerates_run_id and r.student_user_id = p_student_user_id
  ) then
    raise exception 'The analysis being regenerated does not belong to this student.';
  end if;

  perform pg_advisory_xact_lock(hashtext('public.ai_generation_runs'));

  select * into v_existing from public.ai_generation_runs r
  where r.requested_by = v_uid and r.idempotency_key = p_idempotency_key;
  if found then
    return query select v_existing.id, 'duplicate'::text, v_existing.status, v_existing.draft_id, null::text;
    return;
  end if;

  update public.ai_generation_runs
     set status = 'expired', reason = 'Reservation expired without completion.', completed_at = now()
   where status = 'reserved' and created_at < now() - interval '15 minutes';

  -- One analysis in progress per student at a time (stops duplicate paid requests from two tabs or two staff).
  if exists (select 1 from public.ai_generation_runs r where r.student_user_id = p_student_user_id and r.status = 'reserved') then
    return query select null::uuid, 'denied'::text, null::text, null::uuid, 'An analysis for this student is already in progress. Wait for it to finish.'::text;
    return;
  end if;

  select * into v_settings from public.ai_usage_settings where id = 1;

  -- Real students + the paid provider: the privacy-review gate (database half).
  if p_provider = 'openai' and p_data_class = 'real_student' and v_settings.real_student_processing_approved is distinct from true then
    return query select null::uuid, 'denied'::text, null::text, null::uuid, 'Real student data is not yet approved for OpenAI processing (privacy review pending).'::text;
    return;
  end if;

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

  -- All-time paid-pilot ceilings (every non-blocked paid run counts: failures and expired reservations may have been billed).
  if p_provider = 'openai' then
    select count(*), coalesce(sum(case when r.status = 'reserved' then r.reserved_cost_usd else r.estimated_cost_usd end), 0)
      into v_paid_runs, v_paid_cost
      from public.ai_generation_runs r
     where r.provider = 'openai' and r.status <> 'blocked';
    if v_paid_runs >= least(coalesce(p_paid_max_runs, 0), v_settings.paid_max_runs) then
      return query select null::uuid, 'denied'::text, null::text, null::uuid, 'The paid AI pilot''s limit on the number of analyses has been reached.'::text;
      return;
    end if;
    if v_paid_cost + p_worst_case_cost_usd > least(coalesce(p_paid_total_budget_usd, 0), v_settings.paid_total_budget_usd) then
      return query select null::uuid, 'denied'::text, null::text, null::uuid, 'The paid AI pilot budget would be exceeded.'::text;
      return;
    end if;
  end if;

  insert into public.ai_generation_runs (
    student_user_id, requested_by, requested_by_role, idempotency_key, provider, model,
    prompt_version, report_schema_version, data_class, status, reserved_cost_usd,
    consent_confirmed, consent_id, regenerates_run_id, regeneration_reason
  ) values (
    p_student_user_id, v_uid, v_role, p_idempotency_key, p_provider, p_model,
    p_prompt_version, p_report_schema_version, p_data_class, 'reserved', p_worst_case_cost_usd,
    true, v_consent.id, p_regenerates_run_id, nullif(trim(coalesce(p_regeneration_reason, '')), '')
  )
  returning id into v_new_id;

  return query select v_new_id, 'reserved'::text, null::text, null::uuid, null::text;
end;
$$;

comment on function public.staff_reserve_ai_generation_run_v2(uuid, text, text, text, text, text, text, uuid, numeric, integer, integer, integer, numeric, integer, numeric, uuid, text) is
  'NW09.2 — reserve an AI analysis BEFORE any provider call: role / case access; a valid recorded consent for this student; Gemini never for real students; one in-progress analysis per student; the real-student OpenAI gate; daily, monthly and all-time paid ceilings as LEAST(app value, ai_usage_settings); idempotency.';

revoke execute on function public.staff_reserve_ai_generation_run_v2(uuid, text, text, text, text, text, text, uuid, numeric, integer, integer, integer, numeric, integer, numeric, uuid, text) from public, anon;
grant execute on function public.staff_reserve_ai_generation_run_v2(uuid, text, text, text, text, text, text, uuid, numeric, integer, integer, integer, numeric, integer, numeric, uuid, text) to authenticated;

-- v1 accepted a boolean "consent confirmed" — no longer sufficient. Close it so it cannot bypass the consent register.
revoke execute on function public.staff_reserve_ai_generation_run(uuid, text, text, text, text, text, text, boolean, numeric, integer, integer, integer, numeric, uuid, text) from authenticated, anon;


-- ----------------------------------------------------------------------------
-- 4b. staff_complete_ai_generation_run_v2() — v1 + provider evidence.
-- ----------------------------------------------------------------------------

create or replace function public.staff_complete_ai_generation_run_v2(
  p_run_id uuid,
  p_status text,
  p_reason text,
  p_model text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_cached_input_tokens integer,
  p_reasoning_tokens integer,
  p_estimated_cost_usd numeric,
  p_attempts integer,
  p_latency_ms integer,
  p_provider_response_id text,
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
  -- A run that reached a paid provider cannot be recorded as 'blocked' (blocked runs do not count toward the paid ceilings).
  if p_status = 'blocked' and v_run.provider = 'openai' and (coalesce(p_input_tokens, 0) > 0 or p_provider_response_id is not null) then
    raise exception 'A run that reached the provider cannot be recorded as blocked.';
  end if;

  update public.ai_generation_runs
     set status = p_status,
         reason = left(p_reason, 500),
         model = coalesce(nullif(p_model, ''), model),
         input_tokens = greatest(coalesce(p_input_tokens, 0), 0),
         output_tokens = greatest(coalesce(p_output_tokens, 0), 0),
         cached_input_tokens = greatest(coalesce(p_cached_input_tokens, 0), 0),
         reasoning_tokens = greatest(coalesce(p_reasoning_tokens, 0), 0),
         estimated_cost_usd = greatest(coalesce(p_estimated_cost_usd, 0), 0),
         attempts = greatest(coalesce(p_attempts, 0), 0),
         latency_ms = greatest(coalesce(p_latency_ms, 0), 0),
         provider_response_id = nullif(p_provider_response_id, ''),
         report = p_report,
         completed_at = now()
   where id = p_run_id
  returning * into v_run;
  return v_run;
end;
$$;

revoke execute on function public.staff_complete_ai_generation_run_v2(uuid, text, text, text, integer, integer, integer, integer, numeric, integer, integer, text, jsonb) from public, anon;
grant execute on function public.staff_complete_ai_generation_run_v2(uuid, text, text, text, integer, integer, integer, integer, numeric, integer, integer, text, jsonb) to authenticated;
revoke execute on function public.staff_complete_ai_generation_run(uuid, text, text, text, integer, integer, numeric, integer, integer, jsonb) from authenticated, anon;


-- ----------------------------------------------------------------------------
-- 4c. staff_get_ai_usage_summary() — aggregate counters only (no student data).
-- ----------------------------------------------------------------------------

create or replace function public.staff_get_ai_usage_summary()
returns table (
  staff_today integer,
  global_today integer,
  month_cost_usd numeric,
  paid_runs_total integer,
  paid_cost_total_usd numeric,
  per_staff_daily integer,
  per_student_daily integer,
  global_daily integer,
  monthly_budget_usd numeric,
  paid_max_runs integer,
  paid_total_budget_usd numeric,
  real_student_processing_approved boolean
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.is_admin_role(array['super_admin', 'admin', 'counsellor']) then
    raise exception 'Not authorized.';
  end if;
  return query
  select
    (select count(*)::integer from public.ai_generation_runs r where r.requested_by = v_uid and r.created_at >= date_trunc('day', now()) and r.status <> 'blocked'),
    (select count(*)::integer from public.ai_generation_runs r where r.created_at >= date_trunc('day', now()) and r.status <> 'blocked'),
    (select coalesce(sum(case when r.status = 'reserved' then r.reserved_cost_usd else r.estimated_cost_usd end), 0) from public.ai_generation_runs r where r.created_at >= date_trunc('month', now())),
    (select count(*)::integer from public.ai_generation_runs r where r.provider = 'openai' and r.status <> 'blocked'),
    (select coalesce(sum(case when r.status = 'reserved' then r.reserved_cost_usd else r.estimated_cost_usd end), 0) from public.ai_generation_runs r where r.provider = 'openai' and r.status <> 'blocked'),
    s.per_staff_daily, s.per_student_daily, s.global_daily, s.monthly_budget_usd,
    s.paid_max_runs, s.paid_total_budget_usd, s.real_student_processing_approved
  from public.ai_usage_settings s
  where s.id = 1;
end;
$$;

revoke execute on function public.staff_get_ai_usage_summary() from public, anon;
grant execute on function public.staff_get_ai_usage_summary() to authenticated;
