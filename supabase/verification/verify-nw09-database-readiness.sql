-- ============================================================================
-- NW09.2 — READ-ONLY database readiness check for AI Career Intelligence.
--
-- Safe to run against EITHER project (QA ynwzijulzksmrcwdhudv or Production
-- bwlkxunujngksibfzzfv): it only reads the catalogue (pg_class, pg_proc,
-- pg_policies, privileges) and counts rows. It changes nothing, and the
-- transaction is READ ONLY and rolled back, so any accidental write fails.
-- It returns no student data: only object names, flags and counts.
--
-- HOW TO RUN: Supabase Dashboard → (check the project ref in the URL!) →
-- SQL Editor → paste this whole file → Run. Read the result table:
--   status = PASS     ready
--   status = MISSING  the object is not there → its migration is not applied
--   status = FAIL     present but not in the required state
--   status = INFO     a value to note (no pass/fail)
-- Real AI activation is BLOCKED while any row is MISSING or FAIL.
-- ============================================================================

begin;
set transaction read only;

with
tables(name, milestone) as (
  values
    ('student_profile_section_provenance', 'M11-C1 / NW05'),
    ('pricing_purchases', 'M12 / NW05.6 entitlement'),
    ('invoices', 'M7 billing / entitlement'),
    ('counsellors', 'M7'),
    ('admin_student_meta', 'M7 (case assignment)'),
    ('application_tasks', 'NW06'),
    ('recommendation_drafts', 'NW07'),
    ('recommendation_draft_versions', 'NW07'),
    ('ai_generation_runs', 'NW09'),
    ('ai_usage_settings', 'NW09'),
    ('student_ai_processing_consents', 'NW09.2')
),
functions(name, milestone) as (
  values
    ('student_mark_section_self_entered', 'NW05'),
    ('staff_create_application_task', 'NW06'),
    ('current_counsellor_id', 'NW07'),
    ('counsellor_has_case_access', 'NW07'),
    ('staff_create_recommendation_draft', 'NW07'),
    ('staff_update_recommendation_draft_content', 'NW07'),
    ('staff_submit_recommendation_draft_for_review', 'NW07'),
    ('staff_review_recommendation_draft', 'NW07'),
    ('staff_release_recommendation_draft', 'NW07'),
    ('get_my_recommendation_reports', 'NW07'),
    ('get_my_recommendation_report_content', 'NW07'),
    ('staff_reserve_ai_generation_run', 'NW09'),
    ('staff_complete_ai_generation_run', 'NW09'),
    ('staff_link_ai_generation_run_draft', 'NW09'),
    ('admin_purge_ai_generation_reports', 'NW09'),
    ('staff_record_ai_processing_consent', 'NW09.2'),
    ('staff_withdraw_ai_processing_consent', 'NW09.2'),
    ('staff_reserve_ai_generation_run_v2', 'NW09.2'),
    ('staff_complete_ai_generation_run_v2', 'NW09.2'),
    ('staff_get_ai_usage_summary', 'NW09.2')
),
table_checks as (
  select 10 as ord, t.milestone, 'table ' || t.name as check_name,
         case when to_regclass('public.' || t.name) is null then 'MISSING' else 'PASS' end as status,
         case when to_regclass('public.' || t.name) is null then 'apply the ' || t.milestone || ' migration' else 'present' end as detail
  from tables t
),
rls_checks as (
  select 20, t.milestone, 'RLS enabled on ' || t.name,
         case when c.oid is null then 'MISSING' when c.relrowsecurity then 'PASS' else 'FAIL' end,
         case when c.oid is null then 'table missing' when c.relrowsecurity then 'row level security is on' else 'ROW LEVEL SECURITY IS OFF' end
  from tables t
  left join pg_class c on c.oid = to_regclass('public.' || t.name)
),
function_checks as (
  select 30, f.milestone, 'function ' || f.name || '()',
         case when p.oid is null then 'MISSING' else 'PASS' end,
         case when p.oid is null then 'apply the ' || f.milestone || ' migration'
              when p.prosecdef then 'present · security definer' else 'present · security invoker' end
  from functions f
  left join lateral (
    select p.oid, p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = f.name limit 1
  ) p on true
),
policy_checks as (
  -- Students must have NO direct read path to AI runs, AI usage settings or consent records.
  select 40, 'NW09 / NW09.2', 'no student/anon policy on ' || t.name,
         case when to_regclass('public.' || t.name) is null then 'MISSING'
              when exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t.name and ('anon' = any(p.roles) or p.qual ilike '%auth.uid() = student_user_id%' or p.qual ilike '%student_user_id = auth.uid()%')) then 'FAIL'
              else 'PASS' end,
         coalesce((select count(*)::text || ' polic' || case when count(*) = 1 then 'y' else 'ies' end from pg_policies p where p.schemaname = 'public' and p.tablename = t.name), '0 policies')
  from (values ('ai_generation_runs'), ('ai_usage_settings'), ('student_ai_processing_consents')) t(name)
),
privilege_checks as (
  select 50, 'NW09.2', 'v1 reserve RPC closed to authenticated',
         case when to_regprocedure('public.staff_reserve_ai_generation_run(uuid, text, text, text, text, text, text, boolean, numeric, integer, integer, integer, numeric, uuid, text)') is null then 'MISSING'
              when has_function_privilege('authenticated', 'public.staff_reserve_ai_generation_run(uuid, text, text, text, text, text, text, boolean, numeric, integer, integer, integer, numeric, uuid, text)', 'execute') then 'FAIL'
              else 'PASS' end,
         'the boolean-consent v1 RPC must not be callable once NW09.2 is applied'
  union all
  select 51, 'NW09.2', 'v2 reserve RPC callable by authenticated',
         case when to_regprocedure('public.staff_reserve_ai_generation_run_v2(uuid, text, text, text, text, text, text, uuid, numeric, integer, integer, integer, numeric, integer, numeric, uuid, text)') is null then 'MISSING'
              when has_function_privilege('authenticated', 'public.staff_reserve_ai_generation_run_v2(uuid, text, text, text, text, text, text, uuid, numeric, integer, integer, integer, numeric, integer, numeric, uuid, text)', 'execute')
               and not has_function_privilege('anon', 'public.staff_reserve_ai_generation_run_v2(uuid, text, text, text, text, text, text, uuid, numeric, integer, integer, integer, numeric, integer, numeric, uuid, text)', 'execute') then 'PASS'
              else 'FAIL' end,
         'granted to authenticated, not to anon'
),
column_checks as (
  select 60, 'NW09.2', 'column ' || c.tbl || '.' || c.col,
         case when exists (select 1 from information_schema.columns ic where ic.table_schema = 'public' and ic.table_name = c.tbl and ic.column_name = c.col) then 'PASS' else 'MISSING' end,
         'NW09.2 migration'
  from (values ('ai_generation_runs', 'consent_id'), ('ai_generation_runs', 'provider_response_id'), ('ai_generation_runs', 'cached_input_tokens'), ('ai_generation_runs', 'reasoning_tokens'),
               ('ai_usage_settings', 'paid_max_runs'), ('ai_usage_settings', 'paid_total_budget_usd'), ('ai_usage_settings', 'real_student_processing_approved')) c(tbl, col)
),
linkage as (
  -- Counsellor linkage: every counsellor-role user should have a counsellors row (counsellor_has_case_access needs it).
  select 70, 'M7 / NW07', 'counsellor-role users linked to a counsellors row',
         case when to_regclass('public.admin_roles') is null or to_regclass('public.counsellors') is null then 'MISSING'
              when exists (select 1 from public.admin_roles r where r.role = 'counsellor' and not exists (select 1 from public.counsellors c where c.user_id = r.user_id)) then 'FAIL'
              else 'PASS' end,
         (select count(*)::text from public.admin_roles r where r.role = 'counsellor') || ' counsellor role(s); '
           || (select count(*)::text from public.admin_roles r where r.role = 'counsellor' and not exists (select 1 from public.counsellors c where c.user_id = r.user_id)) || ' unlinked'
)
select ord, milestone, check_name, status, detail from table_checks
union all select * from rls_checks
union all select * from function_checks
union all select * from policy_checks
union all select * from privilege_checks
union all select * from column_checks
union all select * from linkage
order by 1, 3;

-- Usage settings and ledger summary (INFO only; aggregate counts, no student data).
-- Run separately if the query above reports ai_usage_settings / ai_generation_runs as MISSING (this one would error).
select 'ai_usage_settings' as item, to_jsonb(s) - 'updated_by' - 'real_student_approved_by' as value
from public.ai_usage_settings s
union all
select 'ai_generation_runs by provider/status', coalesce(jsonb_object_agg(k, n), '{}'::jsonb)
from (select provider || ':' || status as k, count(*) as n from public.ai_generation_runs group by 1) x
union all
select 'recommendation_drafts by status', coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
from (select status, count(*) as n from public.recommendation_drafts group by 1) y;

rollback;
