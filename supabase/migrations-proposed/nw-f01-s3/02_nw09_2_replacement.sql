-- PROPOSED - DO NOT APPLY. Requires separate written approval and completed security gates (see docs/stabilization/nw-f01-s3/CC-15-REVIEW.md).
-- REVIEW ONLY. NOT APPLIED. Outside the normal migration pipeline.
-- Target approval is QA ynwzijulzksmrcwdhudv only. Never use a linked default.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
do $$ begin
  if current_user <> 'postgres' then raise exception 'Reviewed migration owner must be postgres'; end if;
end $$;

do $$
declare t text; c text;
begin
 foreach t in array array['ai_generation_runs','ai_usage_settings','recommendation_drafts','recommendation_draft_versions'] loop
   if to_regclass('public.'||t) is null then raise exception 'Missing baseline table %',t; end if;
 end loop;
 if to_regprocedure('public.staff_complete_ai_generation_run(uuid,text,text,text,integer,integer,numeric,integer,integer,jsonb)') is null
 or to_regprocedure('public.staff_link_ai_generation_run_draft(uuid,uuid)') is null
 or to_regprocedure('public.current_admin_role()') is null
 or to_regprocedure('public.is_admin_role(text[])') is null then raise exception 'Missing baseline function'; end if;
 if not exists(select 1 from public.ai_usage_settings where id=1) then raise exception 'AI settings singleton is missing'; end if;
 if exists(select 1 from public.ai_generation_runs where status='reserved') then
   raise exception 'Quiesce and reconcile outstanding AI reservations before migration';
 end if;
 if exists(select 1 from public.ai_generation_runs where reserved_cost_usd<0 or estimated_cost_usd<0
   or reserved_cost_usd='NaN'::numeric or estimated_cost_usd='NaN'::numeric) then
   raise exception 'Invalid historical accounting';
 end if;
end $$;


do $$
declare x record; actual oid;
begin
 for x in select * from (values
 ('ai_generation_runs','requested_by','uuid'),('ai_generation_runs','student_user_id','uuid'),
 ('ai_generation_runs','reserved_cost_usd','numeric'),('ai_generation_runs','estimated_cost_usd','numeric'),
 ('ai_generation_runs','status','text'),('ai_generation_runs','idempotency_key','text'),
 ('ai_usage_settings','per_staff_daily','integer'),('ai_usage_settings','monthly_budget_usd','numeric')
 ) as expected(tbl,col,typ) loop
  select atttypid into actual from pg_catalog.pg_attribute
   where attrelid=to_regclass('public.'||x.tbl) and attname=x.col and not attisdropped;
  if actual is distinct from to_regtype(x.typ)::oid then raise exception 'Incompatible baseline %.%',x.tbl,x.col; end if;
 end loop;
 -- Existing optional columns must have the intended types. No silent IF NOT EXISTS drift.
 for x in select * from (values
 ('ai_usage_settings','paid_max_runs','integer'),('ai_usage_settings','paid_total_budget_usd','numeric'),
 ('ai_usage_settings','real_student_processing_approved','boolean'),('ai_usage_settings','real_student_approval_reference','text'),
 ('ai_usage_settings','real_student_approved_at','timestamptz'),('ai_usage_settings','real_student_approved_by','uuid'),
 ('ai_generation_runs','consent_id','uuid'),('ai_generation_runs','provider_response_id','text'),
 ('ai_generation_runs','cached_input_tokens','integer'),('ai_generation_runs','reasoning_tokens','integer')
 ) as expected(tbl,col,typ) loop
  select atttypid into actual from pg_catalog.pg_attribute
   where attrelid=to_regclass('public.'||x.tbl) and attname=x.col and not attisdropped;
  if found and actual <> to_regtype(x.typ)::oid then raise exception 'Incompatible existing %.%',x.tbl,x.col; end if;
 end loop;
end $$;

create schema if not exists nextwise_security authorization postgres;
revoke all on schema nextwise_security from public,anon,authenticated,service_role;
-- No rows are seeded. Fictional classification requires separately approved trusted registration.
create table if not exists nextwise_security.fictional_students(
 student_user_id uuid primary key references auth.users(id) on delete cascade,
 approval_reference text not null check(length(trim(approval_reference))>=3),
 approved_by uuid not null references auth.users(id),
 approved_at timestamptz not null default now(),
 expires_at timestamptz not null check(expires_at>approved_at)
);
-- A reviewed per-call ceiling, covering the server's maximum input/output and attempts.
-- No paid model is enabled by this migration; absence fails closed.
create table if not exists nextwise_security.ai_model_reservations(
 provider text not null check(provider='openai'),
 model text not null,
 worst_case_cost_usd numeric(12,6) not null check(worst_case_cost_usd>0),
 approval_reference text not null check(length(trim(approval_reference))>=3),
 primary key(provider,model)
);
revoke all on all tables in schema nextwise_security from public,anon,authenticated,service_role;
alter table nextwise_security.fictional_students enable row level security;
alter table nextwise_security.ai_model_reservations enable row level security;

create or replace function nextwise_security.assert_staff_case(p_student uuid)
returns void language plpgsql security invoker
set search_path = pg_catalog, public, pg_temp as $$
begin
 if auth.uid() is null or not (
   public.is_admin_role(array['super_admin','admin'])
   or (public.is_admin_role(array['counsellor']) and public.counsellor_has_case_access(p_student))
 ) then raise exception 'Not authorized for this case' using errcode='42501'; end if;
end;
$$;
revoke all on function nextwise_security.assert_staff_case(uuid) from public,anon,authenticated,service_role;
create or replace function nextwise_security.is_fictional(p_student uuid)
returns boolean language sql stable security invoker
set search_path = pg_catalog, public, pg_temp as $$
 select exists(select 1 from nextwise_security.fictional_students
 where student_user_id=p_student and expires_at>now());
$$;
revoke all on function nextwise_security.is_fictional(uuid) from public,anon,authenticated,service_role;
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
  'NW09.2 â€” register of recorded consent to AI-assisted processing (Career Intelligence). Staff-only (admins; counsellors with case access). Written only through staff_record_/staff_withdraw_ai_processing_consent(). An AI analysis requires a valid (not withdrawn) row.';

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
set search_path = pg_catalog, public, pg_temp
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
  perform pg_advisory_xact_lock(hashtext('public.ai_generation_runs'));
  if p_method = 'fictional_test_account' and not nextwise_security.is_fictional(p_student_user_id) then
    raise exception 'Fictional consent requires trusted registration';
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
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.student_ai_processing_consents;
begin
  if v_uid is null then
    raise exception 'Not signed in.';
  end if;
  perform pg_advisory_xact_lock(hashtext('public.ai_generation_runs'));
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
  if p_reason is null or length(trim(p_reason)) not between 3 and 500 then
    raise exception 'A withdrawal reason is required';
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
  'NW09.2 â€” all-time ceiling on paid-provider (OpenAI) analyses (every reserved run except "blocked" counts, including failures and expired reservations, which may have been billed).';
comment on column public.ai_usage_settings.paid_total_budget_usd is
  'NW09.2 â€” all-time ceiling on ESTIMATED paid-provider spend (USD). The OpenAI dashboard remains the authoritative figure; set an OpenAI project budget as well.';
comment on column public.ai_usage_settings.real_student_processing_approved is
  'NW09.2 â€” must be TRUE (set by a super admin after the privacy review, with a reference) before a REAL student''s profile may be sent to OpenAI. The application flag AI_REAL_STUDENT_DATA_APPROVED is also required.';


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
-- CC-14 (independent review F2): numeric accepts 'NaN', which sorts above every
-- number, passes ">= 0" checks and would poison every budget sum.
alter table public.ai_generation_runs drop constraint if exists ai_generation_runs_cost_not_nan_check;
alter table public.ai_generation_runs add constraint ai_generation_runs_cost_not_nan_check check (
  reserved_cost_usd <> 'NaN'::numeric and estimated_cost_usd <> 'NaN'::numeric
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
set search_path = pg_catalog, public, pg_temp
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
  v_reserved_cost numeric;
  v_trusted_cost numeric;
  v_fictional boolean;
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
  if p_worst_case_cost_usd is null or p_worst_case_cost_usd < 0 or p_worst_case_cost_usd = 'NaN'::numeric then
    raise exception 'Invalid cost reservation.';
  end if;

  perform pg_advisory_xact_lock(hashtext('public.ai_generation_runs'));
  v_fictional := nextwise_security.is_fictional(p_student_user_id);
  if p_data_class is null or p_data_class <> (case when v_fictional then 'fictional' else 'real_student' end) then
    raise exception 'Data classification does not match trusted registration';
  end if;
  if p_provider is null then raise exception 'Provider is required'; end if;
  v_reserved_cost := p_worst_case_cost_usd;
  if p_provider='openai' then
    select worst_case_cost_usd into v_trusted_cost from nextwise_security.ai_model_reservations
    where provider=p_provider and model=p_model;
    if not found then raise exception 'Paid model has no approved reservation ceiling'; end if;
    v_reserved_cost := greatest(v_reserved_cost,v_trusted_cost);
  end if;
  -- Recorded, valid consent for THIS student (never a checkbox).
  select * into v_consent from public.student_ai_processing_consents c where c.id = p_consent_id for update;
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

  select * into v_existing from public.ai_generation_runs r
  where r.requested_by = v_uid and r.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.student_user_id <> p_student_user_id or v_existing.consent_id is distinct from p_consent_id then
      raise exception 'Idempotency key belongs to a different request';
    end if;
    perform nextwise_security.assert_staff_case(v_existing.student_user_id);
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

  select * into v_settings from public.ai_usage_settings where id = 1 for share;
  if not found then raise exception 'AI settings singleton is missing'; end if;

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
  select coalesce(sum(greatest(r.reserved_cost_usd, r.estimated_cost_usd)), 0)
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
  if v_month_cost + v_reserved_cost > least(coalesce(p_monthly_budget_usd, 0), v_settings.monthly_budget_usd) then
    return query select null::uuid, 'denied'::text, null::text, null::uuid, 'This month''s AI budget would be exceeded.'::text;
    return;
  end if;

  -- All-time paid-pilot ceilings (every non-blocked paid run counts: failures and expired reservations may have been billed).
  if p_provider = 'openai' then
    select count(*), coalesce(sum(greatest(r.reserved_cost_usd, r.estimated_cost_usd)), 0)
      into v_paid_runs, v_paid_cost
      from public.ai_generation_runs r
     where r.provider = 'openai';
    if v_paid_runs >= least(coalesce(p_paid_max_runs, 0), v_settings.paid_max_runs) then
      return query select null::uuid, 'denied'::text, null::text, null::uuid, 'The paid AI pilot''s limit on the number of analyses has been reached.'::text;
      return;
    end if;
    if v_paid_cost + v_reserved_cost > least(coalesce(p_paid_total_budget_usd, 0), v_settings.paid_total_budget_usd) then
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
    p_prompt_version, p_report_schema_version, p_data_class, 'reserved', v_reserved_cost,
    true, v_consent.id, p_regenerates_run_id, nullif(trim(coalesce(p_regeneration_reason, '')), '')
  )
  returning id into v_new_id;

  return query select v_new_id, 'reserved'::text, null::text, null::uuid, null::text;
end;
$$;

comment on function public.staff_reserve_ai_generation_run_v2(uuid, text, text, text, text, text, text, uuid, numeric, integer, integer, integer, numeric, integer, numeric, uuid, text) is
  'NW09.2 â€” reserve an AI analysis BEFORE any provider call: role / case access; a valid recorded consent for this student; Gemini never for real students; one in-progress analysis per student; the real-student OpenAI gate; daily, monthly and all-time paid ceilings as LEAST(app value, ai_usage_settings); idempotency.';

revoke execute on function public.staff_reserve_ai_generation_run_v2(uuid, text, text, text, text, text, text, uuid, numeric, integer, integer, integer, numeric, integer, numeric, uuid, text) from public, anon;
grant execute on function public.staff_reserve_ai_generation_run_v2(uuid, text, text, text, text, text, text, uuid, numeric, integer, integer, integer, numeric, integer, numeric, uuid, text) to authenticated;

-- v1 accepted a boolean "consent confirmed" â€” no longer sufficient. Close it so it cannot bypass the consent register.
revoke execute on function public.staff_reserve_ai_generation_run(uuid, text, text, text, text, text, text, boolean, numeric, integer, integer, integer, numeric, uuid, text) from authenticated, anon;


-- ----------------------------------------------------------------------------
-- 4b. staff_complete_ai_generation_run_v2() â€” v1 + provider evidence.
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
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_run public.ai_generation_runs;
begin
  if auth.uid() is null then raise exception 'Not signed in.' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtext('public.ai_generation_runs'));
  select * into v_run from public.ai_generation_runs where id = p_run_id for update;
  if not found then
    raise exception 'AI analysis not found.';
  end if;
  perform nextwise_security.assert_staff_case(v_run.student_user_id);
  if v_run.requested_by is null or v_run.requested_by is distinct from auth.uid() then
    raise exception 'Only the person who requested this analysis can record its outcome.';
  end if;
  if v_run.status <> 'reserved' then
    raise exception 'This analysis has already been completed.';
  end if;
  if p_status is null or p_status not in ('succeeded', 'failed', 'refused', 'invalid_output', 'blocked') then
    raise exception 'Invalid completion status.';
  end if;
  if p_estimated_cost_usd = 'NaN'::numeric then
    raise exception 'Invalid cost.';
  end if;
  if p_report is not null and (p_status <> 'succeeded' or jsonb_typeof(p_report) <> 'object') then
    raise exception 'An analysis report can only be stored for a successful run.';
  end if;
  if v_run.provider='openai' and p_status='blocked' then
    raise exception 'Paid reservations retain their cost liability; use failed for uncertain outcomes';
  end if;
  if p_status='succeeded' and (p_report is null or
     (v_run.provider='openai' and nullif(p_provider_response_id,'') is null)) then
    raise exception 'Successful generation requires a report and provider evidence';
  end if;
  if p_report is not null and not exists(select 1 from public.student_ai_processing_consents
       where id=v_run.consent_id and withdrawn_at is null) then
    raise exception 'Consent was withdrawn; retain accounting without a report';
  end if;
  -- Accounting-only endpoint. Success/content must use atomic finalization.
  if p_status='succeeded' or p_report is not null then
    raise exception 'Atomic finalization required for AI content';
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
         estimated_cost_usd = greatest(coalesce(p_estimated_cost_usd, 0), v_run.reserved_cost_usd),
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
-- 4c. staff_get_ai_usage_summary() â€” aggregate counters only (no student data).
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
set search_path = pg_catalog, public, pg_temp
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
    (select coalesce(sum(greatest(r.reserved_cost_usd, r.estimated_cost_usd)), 0) from public.ai_generation_runs r where r.created_at >= date_trunc('month', now())),
    (select count(*)::integer from public.ai_generation_runs r where r.provider = 'openai'),
    (select coalesce(sum(greatest(r.reserved_cost_usd, r.estimated_cost_usd)), 0) from public.ai_generation_runs r where r.provider = 'openai'),
    s.per_staff_daily, s.per_student_daily, s.global_daily, s.monthly_budget_usd,
    s.paid_max_runs, s.paid_total_budget_usd, s.real_student_processing_approved
  from public.ai_usage_settings s
  where s.id = 1;
end;
$$;

revoke execute on function public.staff_get_ai_usage_summary() from public, anon;
grant execute on function public.staff_get_ai_usage_summary() to authenticated;

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
set search_path = pg_catalog, public, pg_temp
as $$
begin raise exception 'Legacy AI entry point is closed; use reviewed v2' using errcode='42501'; end;
$$;

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
set search_path = pg_catalog, public, pg_temp
as $$
begin raise exception 'Legacy AI entry point is closed; use reviewed v2' using errcode='42501'; end;
$$;

create or replace function public.staff_link_ai_generation_run_draft(p_run_id uuid, p_draft_id uuid)
returns public.ai_generation_runs
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  raise exception 'Atomic finalization required; direct AI draft linking is closed' using errcode='42501';
end;
$$;

revoke all on function public.staff_record_ai_processing_consent(uuid, text, text, text, date, text) from public,anon,authenticated,service_role;
grant execute on function public.staff_record_ai_processing_consent(uuid, text, text, text, date, text) to authenticated;

revoke all on function public.staff_withdraw_ai_processing_consent(uuid, text) from public,anon,authenticated,service_role;
grant execute on function public.staff_withdraw_ai_processing_consent(uuid, text) to authenticated;

revoke all on function public.staff_reserve_ai_generation_run_v2(uuid, text, text, text, text, text, text, uuid, numeric, integer, integer, integer, numeric, integer, numeric, uuid, text) from public,anon,authenticated,service_role;
grant execute on function public.staff_reserve_ai_generation_run_v2(uuid, text, text, text, text, text, text, uuid, numeric, integer, integer, integer, numeric, integer, numeric, uuid, text) to authenticated;

revoke all on function public.staff_complete_ai_generation_run_v2(uuid, text, text, text, integer, integer, integer, integer, numeric, integer, integer, text, jsonb) from public,anon,authenticated,service_role;
grant execute on function public.staff_complete_ai_generation_run_v2(uuid, text, text, text, integer, integer, integer, integer, numeric, integer, integer, text, jsonb) to authenticated;

revoke all on function public.staff_get_ai_usage_summary() from public,anon,authenticated,service_role;
grant execute on function public.staff_get_ai_usage_summary() to authenticated;

revoke all on function public.staff_link_ai_generation_run_draft(uuid, uuid) from public,anon,authenticated,service_role;

revoke all on function public.staff_reserve_ai_generation_run(uuid,text,text,text,text,text,text,boolean,numeric,integer,integer,integer,numeric,uuid,text) from public,anon,authenticated,service_role;

revoke all on function public.staff_complete_ai_generation_run(uuid,text,text,text,integer,integer,numeric,integer,integer,jsonb) from public,anon,authenticated,service_role;

revoke all on public.student_ai_processing_consents from public,anon,authenticated,service_role;
grant select on public.student_ai_processing_consents to authenticated;
revoke insert,update,delete,truncate,references,trigger on public.ai_generation_runs from public,anon,authenticated;
revoke all on public.ai_generation_runs from anon;
grant select on public.ai_generation_runs to authenticated;
-- Existing settings UPDATE is super-admin-only through its RLS policy.
revoke insert,delete,truncate,references,trigger on public.ai_usage_settings from public,anon,authenticated;
revoke all on public.ai_usage_settings from anon;
grant select,update on public.ai_usage_settings to authenticated;

do $$
declare s text;
begin
 if has_function_privilege('anon','public.staff_record_ai_processing_consent(uuid, text, text, text, date, text)','execute') then raise exception 'Inherited anon execution remains'; end if;
 if has_function_privilege('anon','public.staff_withdraw_ai_processing_consent(uuid, text)','execute') then raise exception 'Inherited anon execution remains'; end if;
 if has_function_privilege('anon','public.staff_reserve_ai_generation_run_v2(uuid, text, text, text, text, text, text, uuid, numeric, integer, integer, integer, numeric, integer, numeric, uuid, text)','execute') then raise exception 'Inherited anon execution remains'; end if;
 if has_function_privilege('anon','public.staff_complete_ai_generation_run_v2(uuid, text, text, text, integer, integer, integer, integer, numeric, integer, integer, text, jsonb)','execute') then raise exception 'Inherited anon execution remains'; end if;
 if has_function_privilege('anon','public.staff_get_ai_usage_summary()','execute') then raise exception 'Inherited anon execution remains'; end if;
 if has_function_privilege('anon','public.staff_link_ai_generation_run_draft(uuid, uuid)','execute') then raise exception 'Inherited anon execution remains'; end if;
 if has_function_privilege('anon','public.staff_reserve_ai_generation_run(uuid,text,text,text,text,text,text,boolean,numeric,integer,integer,integer,numeric,uuid,text)','execute') then raise exception 'Inherited anon execution remains'; end if;
 if has_function_privilege('anon','public.staff_complete_ai_generation_run(uuid,text,text,text,integer,integer,numeric,integer,integer,jsonb)','execute') then raise exception 'Inherited anon execution remains'; end if;
 if has_function_privilege('authenticated','public.staff_reserve_ai_generation_run(uuid,text,text,text,text,text,text,boolean,numeric,integer,integer,integer,numeric,uuid,text)','execute') or has_function_privilege('service_role','public.staff_reserve_ai_generation_run(uuid,text,text,text,text,text,text,boolean,numeric,integer,integer,integer,numeric,uuid,text)','execute') then raise exception 'Legacy execution remains'; end if;
 if has_function_privilege('authenticated','public.staff_complete_ai_generation_run(uuid,text,text,text,integer,integer,numeric,integer,integer,jsonb)','execute') or has_function_privilege('service_role','public.staff_complete_ai_generation_run(uuid,text,text,text,integer,integer,numeric,integer,integer,jsonb)','execute') then raise exception 'Legacy execution remains'; end if;
end $$;

do $$ begin
 if has_function_privilege('anon','public.staff_record_ai_processing_consent(uuid, text, text, text, date, text)','execute') or has_function_privilege('service_role','public.staff_record_ai_processing_consent(uuid, text, text, text, date, text)','execute') or not has_function_privilege('authenticated','public.staff_record_ai_processing_consent(uuid, text, text, text, date, text)','execute') then raise exception 'Unexpected effective permission on reviewed RPC'; end if;
 if has_function_privilege('anon','public.staff_withdraw_ai_processing_consent(uuid, text)','execute') or has_function_privilege('service_role','public.staff_withdraw_ai_processing_consent(uuid, text)','execute') or not has_function_privilege('authenticated','public.staff_withdraw_ai_processing_consent(uuid, text)','execute') then raise exception 'Unexpected effective permission on reviewed RPC'; end if;
 if has_function_privilege('anon','public.staff_reserve_ai_generation_run_v2(uuid, text, text, text, text, text, text, uuid, numeric, integer, integer, integer, numeric, integer, numeric, uuid, text)','execute') or has_function_privilege('service_role','public.staff_reserve_ai_generation_run_v2(uuid, text, text, text, text, text, text, uuid, numeric, integer, integer, integer, numeric, integer, numeric, uuid, text)','execute') or not has_function_privilege('authenticated','public.staff_reserve_ai_generation_run_v2(uuid, text, text, text, text, text, text, uuid, numeric, integer, integer, integer, numeric, integer, numeric, uuid, text)','execute') then raise exception 'Unexpected effective permission on reviewed RPC'; end if;
 if has_function_privilege('anon','public.staff_complete_ai_generation_run_v2(uuid, text, text, text, integer, integer, integer, integer, numeric, integer, integer, text, jsonb)','execute') or has_function_privilege('service_role','public.staff_complete_ai_generation_run_v2(uuid, text, text, text, integer, integer, integer, integer, numeric, integer, integer, text, jsonb)','execute') or not has_function_privilege('authenticated','public.staff_complete_ai_generation_run_v2(uuid, text, text, text, integer, integer, integer, integer, numeric, integer, integer, text, jsonb)','execute') then raise exception 'Unexpected effective permission on reviewed RPC'; end if;
 if has_function_privilege('anon','public.staff_get_ai_usage_summary()','execute') or has_function_privilege('service_role','public.staff_get_ai_usage_summary()','execute') or not has_function_privilege('authenticated','public.staff_get_ai_usage_summary()','execute') then raise exception 'Unexpected effective permission on reviewed RPC'; end if;
 if has_function_privilege('anon','public.staff_link_ai_generation_run_draft(uuid, uuid)','execute') or has_function_privilege('service_role','public.staff_link_ai_generation_run_draft(uuid, uuid)','execute') or has_function_privilege('authenticated','public.staff_link_ai_generation_run_draft(uuid, uuid)','execute') then raise exception 'Unexpected effective permission on reviewed RPC'; end if;
end $$;

-- NW-F01-S4: sole success/content writer. No provider network I/O in this RPC.
-- READ COMMITTED: lock first, then fresh statements see withdrawal's commit.
-- Higher-isolation serialization errors must be retried as this RPC, never AI I/O.
-- CC-16 (F1): this is the PRIVATE implementation. Only the service-role wrapper
-- public.staff_finalize_ai_generation_run(requester, ...) below can reach it, so
-- an authenticated client can no longer submit fabricated "AI" results directly.
drop function if exists public.staff_finalize_ai_generation_run(uuid,uuid,uuid,jsonb,jsonb,jsonb);
create or replace function nextwise_security.finalize_ai_generation_run_impl(
 p_run_id uuid, p_student_user_id uuid, p_consent_id uuid,
 p_report jsonb, p_draft_content jsonb, p_usage jsonb
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
 v_uid uuid := auth.uid(); v_run public.ai_generation_runs;
 v_consent public.student_ai_processing_consents;
 v_draft public.recommendation_drafts; v_version uuid;
 v_outcome text := 'failed';
begin
 if v_uid is null then raise exception 'Not signed in' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtext('public.ai_generation_runs'));
 select * into v_run from public.ai_generation_runs where id=p_run_id for update;
 if not found then raise exception 'AI analysis not found'; end if;
 perform nextwise_security.assert_staff_case(v_run.student_user_id);
 if v_run.requested_by is null or v_run.requested_by is distinct from v_uid then
   raise exception 'Only the requester may finalize this analysis' using errcode='42501';
 end if;
 if p_student_user_id is distinct from v_run.student_user_id
 or p_consent_id is distinct from v_run.consent_id then
   raise exception 'AI reservation identity mismatch' using errcode='42501';
 end if;
 -- Retry after a lost response returns IDs only, without rewriting content,
 -- cost, audit or consent. Recheck requester/current case even on this path.
 if v_run.status='succeeded' and v_run.draft_id is not null then
   return jsonb_build_object('outcome','duplicate','draft_id',v_run.draft_id);
 end if;
 if v_run.status='failed' then
   return jsonb_build_object('outcome',case when v_run.reason='Consent unavailable at AI finalization.' then 'consent_withdrawn' else 'failed' end);
 end if;
 if v_run.status<>'reserved' then raise exception 'AI analysis cannot be finalized'; end if;
 if p_usage is null or jsonb_typeof(p_usage)<>'object' then raise exception 'Invalid usage summary'; end if;
 -- NaN would poison budgets (review F2). Raising here rolls back; the reservation floor stays.
 if (p_usage->>'estimatedCostUsd')::numeric = 'NaN'::numeric then raise exception 'Invalid usage summary'; end if;
 -- Preserve liability BEFORE attempting content. A later SQL exception rolls
 -- the whole RPC back, leaving the original reserved floor, never a refund.
 update public.ai_generation_runs set
   status='failed', reason='AI finalization did not persist a report.', completed_at=now(),
   input_tokens=greatest(coalesce((p_usage->>'inputTokens')::integer,0),0),
   output_tokens=greatest(coalesce((p_usage->>'outputTokens')::integer,0),0),
   cached_input_tokens=greatest(coalesce((p_usage->>'cachedInputTokens')::integer,0),0),
   reasoning_tokens=greatest(coalesce((p_usage->>'reasoningTokens')::integer,0),0),
   estimated_cost_usd=greatest(coalesce((p_usage->>'estimatedCostUsd')::numeric,0),reserved_cost_usd,estimated_cost_usd),
   attempts=greatest(coalesce((p_usage->>'attempts')::integer,0),0),
   latency_ms=greatest(coalesce((p_usage->>'latencyMs')::integer,0),0),
   provider_response_id=nullif(p_usage->>'providerResponseId','')
 where id=v_run.id;
 select * into v_consent from public.student_ai_processing_consents
 where id=v_run.consent_id for update;
 if not found or v_consent.student_user_id is distinct from v_run.student_user_id
 or v_consent.scope<>'career_intelligence' or v_consent.withdrawn_at is not null then
   update public.ai_generation_runs set reason='Consent unavailable at AI finalization.' where id=v_run.id;
   v_outcome := 'consent_withdrawn';
 else
   -- Subtransaction: any draft/version/link/report/audit failure rolls back
   -- ALL content writes, while retaining the failed accounting above.
   begin
     if p_report is null or jsonb_typeof(p_report)<>'object'
     or p_report#>>'{studentProfileRef,studentUserId}' is distinct from v_run.student_user_id::text
     or p_report#>>'{generation,provider}' is distinct from v_run.provider
     or p_report#>>'{generation,model}' is distinct from v_run.model
     or p_report#>>'{generation,dataClass}' is distinct from v_run.data_class
     or p_usage->>'model' is distinct from v_run.model
     or (v_run.provider='openai' and nullif(p_usage->>'providerResponseId','') is null)
     or p_report#>>'{generation,providerResponseId}' is distinct from nullif(p_usage->>'providerResponseId','')
     or p_draft_content is null or jsonb_typeof(p_draft_content)<>'object'
     or p_draft_content->'aiAssisted' is distinct from 'true'::jsonb then
       raise exception 'Invalid AI finalization payload';
     end if;
     insert into public.recommendation_drafts(student_user_id,title,recommendation_type,created_by,author_counsellor_id,status)
     values(v_run.student_user_id,'Career guidance (AI-assisted draft)','career',v_uid,public.current_counsellor_id(),'draft')
     returning * into v_draft;
     update public.ai_generation_runs set status='succeeded',reason=null,report=p_report,draft_id=v_draft.id where id=v_run.id;
     insert into public.recommendation_draft_versions(draft_id,version_number,content,authored_by)
     values(v_draft.id,1,p_draft_content,v_uid) returning id into v_version;
     update public.recommendation_drafts set current_version_id=v_version where id=v_draft.id;
     insert into public.admin_audit_log(actor_user_id,actor_role,action,entity_type,entity_id,summary,context)
     values(v_uid,public.current_admin_role(),'AI-assisted career draft generated','student',v_run.student_user_id::text,
       'AI result finalized atomically',jsonb_build_object('runId',v_run.id,'draftId',v_draft.id,'provider',v_run.provider));
     return jsonb_build_object('outcome','finalized','draft_id',v_draft.id);
   exception
     -- Transient lock/serialization/timeout errors abort the whole RPC so the
     -- caller can retry it with the run still reserved (review F8).
     when serialization_failure or deadlock_detected or lock_not_available or query_canceled then raise;
     when others then
     -- Never persist SQLERRM, report/prompt text or provider payload in logs.
     v_outcome := 'failed';
   end;
 end if;
 insert into public.admin_audit_log(actor_user_id,actor_role,action,entity_type,entity_id,summary,context)
 values(v_uid,public.current_admin_role(),'AI career analysis not generated','student',v_run.student_user_id::text,
   'AI result not persisted',jsonb_build_object('runId',v_run.id,'outcome',v_outcome));
 return jsonb_build_object('outcome',v_outcome);
end;
$$;
revoke all on function nextwise_security.finalize_ai_generation_run_impl(uuid,uuid,uuid,jsonb,jsonb,jsonb) from public,anon,authenticated,service_role;

-- CC-16 (F1): trusted-server-only finalization. The application server calls
-- this with the service-role key AFTER it made the provider call itself, and
-- passes the staff user it authenticated from that user's own session. The
-- requester is then re-checked exactly as before (current role, case access,
-- run ownership, consent under the shared lock): auth.uid() is bound to the
-- requester for this call only, so every existing helper and the content
-- guard trigger evaluate the real staff user, not the service identity.
create or replace function public.staff_finalize_ai_generation_run(
 p_requester_user_id uuid, p_run_id uuid, p_student_user_id uuid, p_consent_id uuid,
 p_report jsonb, p_draft_content jsonb, p_usage jsonb
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare v_prev_sub text; v_result jsonb;
begin
 if coalesce(current_setting('role', true), '') <> 'service_role' then
   raise exception 'AI results can only be finalized by the trusted server' using errcode='42501';
 end if;
 if p_requester_user_id is null or not exists(select 1 from auth.users where id = p_requester_user_id) then
   raise exception 'Not signed in' using errcode='42501';
 end if;
 v_prev_sub := current_setting('request.jwt.claim.sub', true);
 perform set_config('request.jwt.claim.sub', p_requester_user_id::text, true);
 if auth.uid() is distinct from p_requester_user_id then
   raise exception 'Requester binding failed' using errcode='42501';
 end if;
 v_result := nextwise_security.finalize_ai_generation_run_impl(
   p_run_id, p_student_user_id, p_consent_id, p_report, p_draft_content, p_usage);
 perform set_config('request.jwt.claim.sub', coalesce(v_prev_sub, ''), true);
 return v_result;
end;
$$;
revoke all on function public.staff_finalize_ai_generation_run(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.staff_finalize_ai_generation_run(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb) to service_role;
do $$ begin
 if has_function_privilege('anon','public.staff_finalize_ai_generation_run(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb)','execute')
 or has_function_privilege('authenticated','public.staff_finalize_ai_generation_run(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb)','execute')
 or not has_function_privilege('service_role','public.staff_finalize_ai_generation_run(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb)','execute')
 or has_function_privilege('authenticated','nextwise_security.finalize_ai_generation_run_impl(uuid,uuid,uuid,jsonb,jsonb,jsonb)','execute')
 or has_function_privilege('service_role','nextwise_security.finalize_ai_generation_run_impl(uuid,uuid,uuid,jsonb,jsonb,jsonb)','execute')
 or to_regprocedure('public.staff_finalize_ai_generation_run(uuid,uuid,uuid,jsonb,jsonb,jsonb)') is not null then
   raise exception 'Unexpected effective finalization grants';
 end if;
end $$;

commit;
