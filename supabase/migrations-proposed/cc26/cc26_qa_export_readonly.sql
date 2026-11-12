-- ============================================================================
-- CC-26 — READ-ONLY export of the QA security definitions (Task A).
-- QA ynwzijulzksmrcwdhudv ONLY. Writes nothing. Never run against production.
--
-- Exports DEFINITIONS, never rows: functions, policies, grants, triggers,
-- constraints, columns and the migration history of the schemas the CC-26
-- migrations touch. No names, e-mails, phone numbers or other personal data.
-- Function bodies are copied as written; review the output before sharing it.
--
-- Run (one session, port 5432):  Run-CC26-Qa.ps1 -Step Export
-- or:  psql -X -A -P footer=off -v ON_ERROR_STOP=1 -f cc26_qa_export_readonly.sql
-- The output lets the reviewer compare QA with the local reference database
-- definition by definition instead of inferring anything.
-- ============================================================================
begin read only;

select 'identity' as section, current_database() as database, current_user as connected_as,
       inet_server_addr()::text as server_addr, version() as server_version,
       current_setting('server_version_num') as server_version_num,
       current_setting('transaction_read_only') as read_only;

-- Applied migration history, when migrations went through the Supabase CLI.
-- (Files pasted into the SQL editor leave no row here; the markers in the
-- preflight cover that case.)
select 'migration_history' as section,
       case when to_regclass('supabase_migrations.schema_migrations') is null then 'table absent'
            else query_to_xml('select version, name from supabase_migrations.schema_migrations order by version', false, true, '')::text
       end as rows_xml;

-- Every function in public and nextwise_security, in full.
select 'function' as section, n.nspname as schema, p.oid::regprocedure::text as signature,
       pg_get_userbyid(p.proowner) as owner, p.prosecdef as security_definer, p.provolatile as volatility,
       coalesce(array_to_string(p.proconfig, ','), '') as config, coalesce(p.proacl::text, '(default)') as acl,
       md5(replace(p.prosrc, chr(13), '')) as body_md5_lf,
       coalesce(obj_description(p.oid, 'pg_proc'), '') as comment,
       pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'nextwise_security') and p.prokind in ('f', 'p')
order by 2, 3;

-- auth.uid() (the policies and the test login helper depend on it).
select 'auth_function' as section, p.oid::regprocedure::text as signature, pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'auth' and p.proname in ('uid', 'role', 'jwt')
order by 2;

-- Every row-level security policy in public and storage.
select 'policy' as section, schemaname, tablename, policyname, permissive, cmd, roles::text as roles,
       coalesce(qual, '') as using_expression, coalesce(with_check, '') as check_expression
from pg_policies where schemaname in ('public', 'storage')
order by 2, 3, 4;

-- Table-level privileges and RLS flags.
select 'table' as section, n.nspname as schema, c.relname as table_name, c.relkind as kind,
       c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced,
       pg_get_userbyid(c.relowner) as owner, coalesce(c.relacl::text, '(default)') as acl
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'nextwise_security') and c.relkind in ('r', 'p', 'v', 'm')
order by 2, 3;

-- Columns (names and types only) of the tables the CC-26 migrations read or change.
select 'column' as section, table_name, ordinal_position, column_name, data_type, is_nullable, coalesce(column_default, '') as column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('discovery_sessions', 'admin_student_meta', 'counsellors', 'admin_roles', 'profiles',
                     'recommendation_drafts', 'recommendation_draft_versions', 'ai_generation_runs',
                     'invoices', 'payment_attempts', 'pricing_purchases', 'payment_launch_controls')
order by 2, 3;

-- Constraints on the same tables.
select 'constraint' as section, c.conrelid::regclass::text as table_name, c.conname, c.contype, pg_get_constraintdef(c.oid) as definition
from pg_constraint c
where c.conrelid::regclass::text in ('discovery_sessions', 'admin_student_meta', 'counsellors', 'recommendation_drafts',
                                     'recommendation_draft_versions', 'ai_generation_runs', 'invoices', 'payment_attempts')
order by 2, 3;

-- Triggers in public.
select 'trigger' as section, c.relname as table_name, t.tgname, t.tgenabled, pg_get_triggerdef(t.oid) as definition
from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and not t.tgisinternal
order by 2, 3;

-- Default privileges (what new tables and functions will grant).
select 'default_acl' as section, defaclrole::regrole::text as owner_role, coalesce(defaclnamespace::regnamespace::text, '(all)') as schema,
       defaclobjtype as object_type, defaclacl::text as acl
from pg_default_acl order by 2, 3, 4;

-- Roles the policies and grants name (attributes only).
select 'role' as section, rolname, rolsuper, rolinherit, rolcanlogin, rolbypassrls
from pg_roles where rolname in ('anon', 'authenticated', 'service_role', 'postgres', 'authenticator', 'supabase_admin')
order by 2;

rollback;
