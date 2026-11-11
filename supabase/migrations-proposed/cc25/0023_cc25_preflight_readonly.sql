-- ============================================================================
-- CC-25 0023 — READ-ONLY preflight for QA (ynwzijulzksmrcwdhudv). Writes nothing.
-- Run as the project's postgres role, inside a read-only transaction:
--     begin read only;  \i 0023_cc25_preflight_readonly.sql  rollback;
-- (or paste into the SQL editor: the file opens and closes its own read-only
-- transaction). Returns catalog facts and COUNTS only — no names, emails or
-- other personal data.
-- ============================================================================
begin read only;

-- 1. Identity of the connected database (compare with the dashboard project ref).
select 'identity' as section, current_database() as database, current_user as connected_as,
       inet_server_addr()::text as server_addr, version() as server_version;

-- 2. Migration state markers (expected: every 0013-0022 marker TRUE, CC-24 policy FALSE, CC-25 FALSE).
select 'markers' as section, *
from (values
  ('0013 discovery_sessions table', to_regclass('public.discovery_sessions') is not null),
  ('0013 discovery_session_workspace table', to_regclass('public.discovery_session_workspace') is not null),
  ('0014 provenance policy uses discovery_sessions basis', exists (select 1 from pg_policies where tablename = 'student_profile_section_provenance' and policyname = 'Admins/assigned counsellor can write section provenance' and with_check like '%discovery_sessions%')),
  ('0015 one-active-session index', to_regclass('public.discovery_sessions_one_active_per_student') is not null),
  ('0016 refund finalize function', exists (select 1 from pg_proc where proname = 'finalize_refund')),
  ('0017 student application functions', exists (select 1 from pg_proc where proname = 'student_advance_application')),
  ('0018 application_documents table', to_regclass('public.application_documents') is not null),
  ('0020 application_checklist_items table', to_regclass('public.application_checklist_items') is not null),
  ('0021 application_submissions table', to_regclass('public.application_submissions') is not null),
  ('0022 submitted-transition invariant', exists (select 1 from pg_proc where proname = 'applications_enforce_submitted_transition')),
  ('REJECTED CC-24 0023 policy present (must be FALSE)', exists (select 1 from pg_policies where tablename = 'profiles' and policyname like '%(cc24)%')),
  ('CC-25 0023 already applied', to_regprocedure('public.staff_discovery_session_student_identities(uuid[])') is not null),
  ('supabase_migrations history table present', to_regclass('supabase_migrations.schema_migrations') is not null)
) as m(marker, present);

-- 3. Recorded migration history, if the CLI history table exists (versions only; shown as a NOTICE).
do $hist$
declare v text;
begin
  if to_regclass('supabase_migrations.schema_migrations') is null then
    raise notice 'history: supabase_migrations.schema_migrations not present (migrations were applied through the SQL editor); rely on the markers above';
  else
    execute 'select string_agg(version, '', '' order by version) from supabase_migrations.schema_migrations' into v;
    raise notice 'history: %', coalesce(v, '(empty)');
  end if;
end
$hist$;

-- 4. Drift check: exact policy definitions the migration replaces or must leave untouched.
select 'policies' as section, tablename, policyname, cmd, md5(coalesce(qual, '') || '|' || coalesce(with_check, '')) as definition_md5
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles', 'discovery_sessions', 'discovery_session_workspace', 'student_profile_section_provenance',
                    'student_recommendation_verifications', 'admin_student_meta', 'counsellors', 'admin_roles')
order by tablename, policyname;

-- 5. Helper function definitions the migration depends on.
select 'functions' as section, p.oid::regprocedure::text as function, p.prosecdef as security_definer,
       coalesce(array_to_string(p.proconfig, ','), '') as config, md5(p.prosrc) as body_md5, coalesce(p.proacl::text, '(default)') as acl
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('is_admin_role', 'current_counsellor_id', 'record_admin_audit_log', 'set_updated_at', 'is_any_admin')
order by 2;

-- 6. Effective table privileges on the in-scope tables.
select 'table_grants' as section, c.relname as table_name, g.grantee, string_agg(g.privilege_type, ',' order by g.privilege_type) as privileges
from information_schema.role_table_grants g
join pg_class c on c.relname = g.table_name
join pg_namespace n on n.oid = c.relnamespace and n.nspname = g.table_schema
where g.table_schema = 'public'
  and g.table_name in ('profiles', 'discovery_sessions', 'discovery_session_workspace', 'student_profile_section_provenance',
                       'student_recommendation_verifications', 'admin_student_meta', 'counsellors', 'admin_roles')
  and g.grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC')
group by c.relname, g.grantee
order by 2, 3;

-- 7. Row-level security switched on for every in-scope table.
select 'rls' as section, c.relname as table_name, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('profiles', 'discovery_sessions', 'discovery_session_workspace', 'student_profile_section_provenance',
                    'student_recommendation_verifications', 'admin_student_meta', 'counsellors', 'admin_roles')
order by 2;

-- 8. Impact (counts only): assignments that will need an admin approval after the migration.
select 'impact' as section, status,
       count(*) as sessions,
       count(*) filter (where assigned_counsellor_id is not null) as assigned_now_unapproved_after_migration
from public.discovery_sessions
group by status
order by status;

-- 9. Existing SECURITY DEFINER functions without a pinned search_path (informational).
select 'definer_without_search_path' as section, p.oid::regprocedure::text as function
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef and coalesce(array_to_string(p.proconfig, ','), '') not like '%search_path=%'
order by 2;

rollback;
