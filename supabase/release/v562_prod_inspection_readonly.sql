-- ============================================================================
-- V5.6.2 PUBLIC LAUNCH — READ-ONLY PRODUCTION INSPECTION
--
-- Run ONCE in the Supabase dashboard, production project, SQL editor (role
-- postgres). It is a single SELECT statement: it reads the catalog and counts
-- rows, and writes nothing. It calls no function that changes data.
--
-- It returns ONE value (a JSON document). Copy that value into
-- prod-inspection.json and run:  node scripts/release/v562-evaluate-inspection.mjs prod-inspection.json
--
-- What it returns: catalog facts (function, policy, table and bucket NAMES,
-- grants, policy-definition hashes) and COUNTS. It returns no names, emails,
-- phone numbers, ids or any other data about people, and no secrets.
--
-- What it answers:
--   A. Is the NW07 counsellor SQL in production, and in which version?
--   B. Which CC-25/CC-26 fixes (0023, 0024, 0025, 0026) are applied?
--   C. What can the anonymous role (the public website key) execute or write?
--   D. Is any public table reachable without RLS?
--   E. Can a non-admin create staff access (counsellors, admin_roles, account type)?
--   F. How many staff, student and unconfirmed accounts exist (counts only)?
--   G. Which storage buckets are public?
-- ============================================================================
with
fn as (
  select p.oid, p.proname, p.oid::regprocedure::text as signature, p.prosecdef, p.prosrc, p.prorettype,
         has_function_privilege('anon', p.oid, 'execute') as anon_exec,
         has_function_privilege('authenticated', p.oid, 'execute') as auth_exec
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
),
tbl as (
  select c.oid, c.relname, c.relkind, c.relrowsecurity as rls,
         has_table_privilege('anon', c.oid, 'SELECT') or has_table_privilege('anon', c.oid, 'INSERT')
           or has_table_privilege('anon', c.oid, 'UPDATE') or has_table_privilege('anon', c.oid, 'DELETE') as anon_any,
         has_table_privilege('authenticated', c.oid, 'SELECT') or has_table_privilege('authenticated', c.oid, 'INSERT')
           or has_table_privilege('authenticated', c.oid, 'UPDATE') or has_table_privilege('authenticated', c.oid, 'DELETE') as auth_any,
         has_table_privilege('anon', c.oid, 'TRUNCATE') or has_table_privilege('authenticated', c.oid, 'TRUNCATE') as client_truncate
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
),
pol as (
  select tablename, policyname, cmd, permissive, roles::text[] as roles,
         md5(coalesce(qual, '') || '|' || coalesce(with_check, '')) as definition_md5,
         coalesce(qual, '') || coalesce(with_check, '') as body
  from pg_policies where schemaname = 'public'
),
-- Counts in tables that may not exist in production (NW05-NW09) are read dynamically.
cnt(label, sql, needs) as (values
  ('counsellors_total', 'select count(*) n from public.counsellors', array[]::text[]),
  ('counsellors_active', 'select count(*) n from public.counsellors where is_active', array['public.counsellors.is_active']::text[]),
  ('counsellors_inactive', 'select count(*) n from public.counsellors where not is_active', array['public.counsellors.is_active']::text[]),
  ('discovery_sessions_total', 'select count(*) n from public.discovery_sessions', array[]::text[]),
  ('discovery_sessions_assigned', 'select count(*) n from public.discovery_sessions where assigned_counsellor_id is not null', array['public.discovery_sessions.assigned_counsellor_id']::text[]),
  ('discovery_sessions_assigned_active', 'select count(*) n from public.discovery_sessions where assigned_counsellor_id is not null and status in (''requested'',''scheduled'')', array['public.discovery_sessions.status','public.discovery_sessions.assigned_counsellor_id']::text[]),
  ('session_only_assignments', 'select count(*) n from public.discovery_sessions ds where ds.assigned_counsellor_id is not null and not exists (select 1 from public.admin_student_meta m where m.student_user_id = ds.student_user_id and m.assigned_counsellor_id = ds.assigned_counsellor_id)', array['public.discovery_sessions.assigned_counsellor_id']::text[]),
  ('caseload_rows_held_by_inactive_counsellors', 'select count(*) n from public.admin_student_meta m join public.counsellors c on c.id = m.assigned_counsellor_id where not c.is_active', array['public.admin_student_meta.is_active','public.admin_student_meta.assigned_counsellor_id']::text[]),
  ('student_profiles_with_data', 'select count(*) n from public.student_profiles', array[]::text[]),
  ('recommendation_drafts', 'select count(*) n from public.recommendation_drafts', array[]::text[]),
  ('ai_generation_runs_real_student', 'select count(*) n from public.ai_generation_runs where data_class = ''real_student''', array['public.ai_generation_runs.data_class']::text[]),
  ('invoices_total', 'select count(*) n from public.invoices', array[]::text[]),
  ('invoices_self_created_plan_unpaid', 'select count(*) n from public.invoices where pricing_plan_id is not null and created_by = student_user_id and status in (''issued'',''overdue'',''partially_paid'')', array['public.invoices.status','public.invoices.pricing_plan_id']::text[]),
  ('payments_captured', 'select count(*) n from public.payments where status = ''captured''', array['public.payments.status']::text[]),
  ('applications_total', 'select count(*) n from public.applications', array[]::text[]),
  ('application_documents_total', 'select count(*) n from public.application_documents', array[]::text[]),
  ('system_audit_rows', 'select count(*) n from public.admin_audit_log where actor_role = ''system''', array['public.admin_audit_log.actor_role']::text[]),
  ('auth_users_total', 'select count(*) n from auth.users', array[]::text[]),
  ('auth_users_unconfirmed', 'select count(*) n from auth.users where email_confirmed_at is null and phone_confirmed_at is null', array['auth.users.email_confirmed_at','auth.users.phone_confirmed_at']::text[]),
  ('auth_users_created_last_30d', 'select count(*) n from auth.users where created_at > now() - interval ''30 days''', array['auth.users.created_at']::text[]),
  ('auth_users_signed_in_last_30d', 'select count(*) n from auth.users where last_sign_in_at > now() - interval ''30 days''', array['auth.users.last_sign_in_at']::text[]),
  ('auth_users_anonymous', 'select count(*) n from auth.users where is_anonymous', array['auth.users.is_anonymous']::text[]),
  ('auth_users_banned', 'select count(*) n from auth.users where banned_until > now()', array['auth.users.banned_until']::text[]),
  ('auth_identities_by_provider_non_email', 'select count(*) n from auth.identities where provider <> ''email''', array['auth.identities.provider']::text[])
),
cnt_eval as (
  select label,
         case when to_regclass(substring(sql from 'from ([a-z_]+\.[a-z_]+)')) is null then null
              when exists (select 1 from unnest(needs) c where not exists (select 1 from information_schema.columns ic
                     where ic.table_schema || '.' || ic.table_name || '.' || ic.column_name = c)) then null
              else (xpath('/row/n/text()', query_to_xml(sql, false, true, '')))[1]::text::bigint end as n
  from cnt
)
select jsonb_pretty(jsonb_build_object(
  'inspection', 'nextwise-v562-production-readonly',
  'format', 2,
  'identity', jsonb_build_object(
    'database', current_database(),
    'connected_as', current_user,
    'server_version', current_setting('server_version'),
    'transaction_read_only', current_setting('transaction_read_only'),
    'inspected_at_utc', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  ),
  'migrations_recorded', (select coalesce(jsonb_agg(v order by v), '[]'::jsonb) from (
      select (xpath('/row/version/text()', x))[1]::text as v
      from unnest(case when to_regclass('supabase_migrations.schema_migrations') is null then array[]::xml[]
                       else xpath('/table/row', query_to_xml('select version from supabase_migrations.schema_migrations', false, false, '')) end) as x) m),
  'markers', jsonb_build_object(
    'nw05_applied', exists (select 1 from fn where proname = 'student_mark_section_self_entered'),
    'nw06_applied', to_regclass('public.application_tasks') is not null,
    'nw07_applied', to_regprocedure('public.counsellor_has_case_access(uuid)') is not null,
    'nw09_applied', to_regclass('public.ai_generation_runs') is not null,
    'nwf01_consents_applied', to_regclass('public.student_ai_processing_consents') is not null,
    'cc25_0023_applied', to_regprocedure('public.staff_discovery_session_student_identities(uuid[])') is not null,
    'cc25_0023_r2_effective', to_regprocedure('public.staff_discovery_session_student_identities(uuid[])') is not null
        and not exists (select 1 from pol where tablename <> 'discovery_sessions' and body like '%discovery_sessions%'),
    'cc25_0024_applied', not exists (select 1 from fn where proname in ('record_system_audit_log', 'set_signature_document_path', 'set_stamp_document_path') and anon_exec),
    'cc26_0025_applied', exists (select 1 from fn where proname = 'current_counsellor_id' and prosrc like '%is_active%'),
    'cc26_0026_applied', to_regclass('public.payment_launch_controls') is not null,
    'rejected_cc24_policy_present', exists (select 1 from pol where tablename = 'profiles' and policyname like '%(cc24)%')
  ),
  'nw07', jsonb_build_object(
    'case_access_classification', (select case md5(replace(prosrc, chr(13), ''))
         when 'af8e1b283e823e2002b909fe8b610561' then 'NW07 original (unsafe)'
         when '2a2f5e7f4f183185aced2356e5a58857' then 'CC-26 fixed'
         else case when prosrc like '%discovery_sessions%' then 'UNKNOWN (reads discovery_sessions directly: treat as unsafe)' else 'UNKNOWN' end end
       from fn where signature = 'counsellor_has_case_access(uuid)'),
    'case_access_body_md5_lf', (select md5(replace(prosrc, chr(13), '')) from fn where signature = 'counsellor_has_case_access(uuid)'),
    'policies_using_case_access', (select count(*) from pol where body like '%counsellor_has_case_access%'),
    'policies_reading_discovery_sessions_directly', (select count(*) from pol where tablename <> 'discovery_sessions' and body like '%discovery_sessions%'),
    'draft_rpcs', (select coalesce(jsonb_object_agg(v.fn, case md5(replace(f.prosrc, chr(13), ''))
             when v.nw07 then 'NW07 original' when v.cc26 then 'CC-26' when v.nwf01 then 'NW-F01 03'
             else case when f.oid is null then 'ABSENT' else 'UNKNOWN' end end), '{}'::jsonb)
       from (values
         ('staff_update_recommendation_draft_content(uuid,jsonb)', '5eef6dced30ca13c6b1354870f2e441b', '8d76caf129e0b33c6b70956ccf3be211', '98bccd1b7a5b72c049a69ce86afb12db'),
         ('staff_submit_recommendation_draft_for_review(uuid)', '3f365eacdd071abecbdf7a680e5d1775', '1a69bbfe9644efd7d8996275cc45fbf9', '010668295aab4a7ee5d466e8a6b4e464'),
         ('staff_release_recommendation_draft(uuid)', '5ddb8bc143a32a1109043b7e7cc2ef9c', 'dc4d3efb964868219c208369adb05ce6', '37eb052c70a08fb28a22231434c3597d'),
         ('staff_withdraw_recommendation_draft(uuid)', 'adb19f89b3d97167eaa8a7fa989db725', '3d65d505806b342f0e2659f618145dbd', 'cec7f6744961e4124b9081b325147b94'),
         ('staff_archive_recommendation_draft(uuid)', 'ebcc9aab425723c73db5784bc33b9ea2', '9d0f5dcbc0ecd98cedbc669552feec2f', '7435c90a98c41e03cff15f8b44e522d9')
       ) v(fn, nw07, cc26, nwf01)
       left join fn f on f.signature = v.fn)
  ),
  'anon_executable_security_definer_functions', (select coalesce(jsonb_agg(jsonb_build_object(
         'function', signature,
         'returns_trigger', prorettype = 'trigger'::regtype,
         'body_checks_caller', prosrc ~ '(auth\.uid\(\)|is_admin_role|is_any_admin|current_admin_role|current_counsellor_id|razorpay_webhook_secret|webhook_secret|_signature|hmac)',
         'body_md5_lf', md5(replace(prosrc, chr(13), ''))) order by signature), '[]'::jsonb)
       from fn where prosecdef and anon_exec),
  'authenticated_executable_security_definer_function_count', (select count(*) from fn where prosecdef and auth_exec),
  'tables_without_rls_reachable_by_clients', (select coalesce(jsonb_agg(relname order by relname), '[]'::jsonb) from tbl where not rls and (anon_any or auth_any) and relkind in ('r', 'p')),
  'views_reachable_by_anon', (select coalesce(jsonb_agg(relname order by relname), '[]'::jsonb) from tbl where relkind in ('v', 'm') and anon_any),
  'tables_with_client_truncate', (select count(*) from tbl where client_truncate),
  'anon_policies', (select coalesce(jsonb_agg(jsonb_build_object('table', tablename, 'policy', policyname, 'cmd', cmd, 'roles', roles, 'permissive', permissive) order by tablename, policyname), '[]'::jsonb)
       from pol where roles && array['anon', 'public']),
  'privilege_policies', (select coalesce(jsonb_agg(jsonb_build_object('table', tablename, 'policy', policyname, 'cmd', cmd, 'roles', roles, 'definition_md5', definition_md5,
         'mentions_is_admin_or_super_admin', body ~ '(is_admin|is_super_admin|admin_roles|super_admin)') order by tablename, policyname), '[]'::jsonb)
       from pol where tablename in ('counsellors', 'admin_roles', 'profiles')),
  'profiles_account_type_guard', jsonb_build_object(
    'signup_trigger_forces_student', exists (select 1 from fn where proname = 'handle_new_user' and prosrc like '%''student''%' and prosrc not like '%raw_user_meta_data ->> ''account_type''%'),
    'authenticated_can_update_account_type_column', has_column_privilege('authenticated', 'public.profiles', 'account_type', 'UPDATE')
  ),
  'role_counts', jsonb_build_object(
    'admin_roles_by_role', (select coalesce(jsonb_object_agg(role, n), '{}'::jsonb) from (select role::text, count(*) n from public.admin_roles group by role) r),
    'profiles_by_account_type', (select coalesce(jsonb_object_agg(coalesce(account_type, '(null)'), n), '{}'::jsonb) from (select account_type, count(*) n from public.profiles group by account_type) r)
  ),
  'counts', (select jsonb_object_agg(label, n) from cnt_eval),
  'storage_buckets', (select coalesce(jsonb_agg(jsonb_build_object('bucket', id, 'public', public) order by id), '[]'::jsonb) from storage.buckets),
  'storage_object_policies_for_anon', (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and roles && array['anon'::name, 'public'::name])
)) as v562_inspection;
