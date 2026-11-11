-- ============================================================================
-- CC-25 — executable RLS / authorization tests for counsellor identity access
--
-- Pure SQL (no psql meta-commands). Everything runs in ONE transaction that is
-- never committed: the fictional fixture (example.test addresses) leaves no row.
-- Each check prints  CC25|PASS|<id>|<name>  or  CC25|FAIL|<id>|<name>|<detail>
-- and the script ends with an ERROR when any check failed, so:
--     psql -v ON_ERROR_STOP=1 -X -q -f 0023_cc25_rls_tests.sql   -> exit code 3 on failure
--     scripts/security/cc25-counsellor-identity.db.test.mjs       -> node:test failure
-- Runs against the real policies, grants, triggers and functions of the target
-- database (local disposable PostgreSQL or QA). NEVER run against production.
-- Before CC-25 0023 is applied the checks tagged [CC25] are EXPECTED to fail:
-- they reproduce the defects the migration fixes.
-- ============================================================================

begin;

-- Refuse obvious production use: production data must never be touched.
do $guard$
begin
  if coalesce(current_setting('nextwise.cc25_test_target', true), '') not in ('LOCAL-DISPOSABLE-TEST', 'QA-ynwzijulzksmrcwdhudv') then
    raise exception 'CC25 tests refused: set nextwise.cc25_test_target to LOCAL-DISPOSABLE-TEST or QA-ynwzijulzksmrcwdhudv (never production).';
  end if;
end
$guard$;

create temp table cc25_results (ts timestamptz not null default clock_timestamp(), id text not null, name text not null, pass boolean not null, detail text);
grant select, insert on cc25_results to anon, authenticated;

create function pg_temp.cc25_login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end $$;

create function pg_temp.cc25_logout() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', '', true);
end $$;

create function pg_temp.cc25_record(p_id text, p_name text, p_pass boolean, p_detail text default null) returns void language plpgsql as $$
begin
  insert into cc25_results (id, name, pass, detail) values (p_id, p_name, coalesce(p_pass, false), p_detail);
  raise notice 'CC25|%|%|%', case when coalesce(p_pass, false) then 'PASS' else 'FAIL' end, p_id,
    p_name || case when coalesce(p_pass, false) or p_detail is null then '' else '|' || p_detail end;
end $$;

-- Boolean query must return true.
create function pg_temp.cc25_check(p_id text, p_name text, p_sql text) returns void language plpgsql as $$
declare v boolean;
begin
  begin
    execute p_sql into v;
    perform pg_temp.cc25_record(p_id, p_name, v, case when v then null else 'returned ' || coalesce(v::text, 'null') end);
  exception when others then
    perform pg_temp.cc25_record(p_id, p_name, false, 'error ' || sqlstate || ': ' || sqlerrm);
  end;
end $$;

-- Statement must have no effect: an error, or zero rows affected.
-- If it DOES take effect, the effect is undone (sub-transaction) so one
-- defect cannot corrupt the fixture for later checks, and the check fails.
create function pg_temp.cc25_denied(p_id text, p_name text, p_sql text) returns void language plpgsql as $$
declare v_rows bigint;
begin
  begin
    execute p_sql;
    get diagnostics v_rows = row_count;
    if v_rows > 0 then
      raise exception '% row(s) affected (undone)', v_rows using errcode = 'CC250';
    end if;
    perform pg_temp.cc25_record(p_id, p_name, true, null);
  exception
    when sqlstate 'CC250' then perform pg_temp.cc25_record(p_id, p_name, false, sqlerrm);
    when others then perform pg_temp.cc25_record(p_id, p_name, true, null);
  end;
end $$;

-- Statement must raise an error (a success is undone and fails the check).
create function pg_temp.cc25_error(p_id text, p_name text, p_sql text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
    raise exception 'statement succeeded (undone)' using errcode = 'CC250';
  exception
    when sqlstate 'CC250' then perform pg_temp.cc25_record(p_id, p_name, false, sqlerrm);
    when others then perform pg_temp.cc25_record(p_id, p_name, true, null);
  end;
end $$;

-- Fixture step: must succeed (any error aborts the whole run).
create function pg_temp.cc25_must(p_sql text) returns void language plpgsql as $$
declare v_rows bigint;
begin
  execute p_sql;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then raise exception 'CC25 fixture step affected no row: %', p_sql; end if;
end $$;

grant execute on all functions in schema pg_temp to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Fictional fixture (ids 0c250000-…; addresses @example.test)
-- ---------------------------------------------------------------------------
select pg_temp.cc25_logout();

insert into auth.users (id, email)
select ('0c250000-0000-4000-8000-' || x)::uuid, 'cc25.sqltest.' || x || '@example.test'
from unnest(array['0000000000a1','0000000000c1','0000000000c2','0000000000c3','0000000000c4',
                  '000000000501','000000000502','000000000503','000000000504','000000000505','000000000506',
                  '000000000507','000000000508','000000000509','000000000510','000000000511','000000000512','000000000513']) x;

insert into public.profiles (id, full_name, email, phone)
select ('0c250000-0000-4000-8000-' || x)::uuid, 'Fictional Student ' || right(x, 2), 'cc25.sqltest.' || x || '@example.test', '+910000000' || right(x, 3)
from unnest(array['000000000501','000000000502','000000000503','000000000504','000000000505','000000000506',
                  '000000000507','000000000508','000000000509','000000000510','000000000511','000000000512','000000000513']) x
on conflict (id) do update set full_name = excluded.full_name, email = excluded.email, phone = excluded.phone;

insert into public.admin_roles (user_id, role) values
  ('0c250000-0000-4000-8000-0000000000a1', 'admin'),
  ('0c250000-0000-4000-8000-0000000000c1', 'counsellor'),
  ('0c250000-0000-4000-8000-0000000000c2', 'counsellor'),
  ('0c250000-0000-4000-8000-0000000000c3', 'counsellor'),
  ('0c250000-0000-4000-8000-0000000000c4', 'counsellor');

insert into public.counsellors (id, user_id, display_name) values
  ('0c250000-0000-4000-8000-0000000001c1', '0c250000-0000-4000-8000-0000000000c1', 'Fictional Counsellor A'),
  ('0c250000-0000-4000-8000-0000000001c2', '0c250000-0000-4000-8000-0000000000c2', 'Fictional Counsellor B'),
  ('0c250000-0000-4000-8000-0000000001c3', '0c250000-0000-4000-8000-0000000000c3', 'Fictional Counsellor C'),
  ('0c250000-0000-4000-8000-0000000001c4', '0c250000-0000-4000-8000-0000000000c4', 'Fictional Counsellor D');

-- Caseload: S8 belongs to counsellor D.
insert into public.admin_student_meta (student_user_id, status, assigned_counsellor_id)
values ('0c250000-0000-4000-8000-000000000508', 'active', '0c250000-0000-4000-8000-0000000001c4');

-- Every session is booked unassigned, as a student would.
insert into public.discovery_sessions (id, student_user_id, status) values
  ('0c250000-0000-4000-8000-000000000d01', '0c250000-0000-4000-8000-000000000501', 'requested'),
  ('0c250000-0000-4000-8000-000000000d02', '0c250000-0000-4000-8000-000000000502', 'requested'),
  ('0c250000-0000-4000-8000-000000000d03', '0c250000-0000-4000-8000-000000000503', 'requested'),
  ('0c250000-0000-4000-8000-000000000d04', '0c250000-0000-4000-8000-000000000504', 'requested'),
  ('0c250000-0000-4000-8000-000000000d05', '0c250000-0000-4000-8000-000000000505', 'requested'),
  ('0c250000-0000-4000-8000-000000000d06', '0c250000-0000-4000-8000-000000000506', 'requested'),
  ('0c250000-0000-4000-8000-000000000d7a', '0c250000-0000-4000-8000-000000000507', 'requested'),
  ('0c250000-0000-4000-8000-000000000d08', '0c250000-0000-4000-8000-000000000508', 'requested'),
  ('0c250000-0000-4000-8000-000000000d09', '0c250000-0000-4000-8000-000000000509', 'requested'),
  ('0c250000-0000-4000-8000-000000000d10', '0c250000-0000-4000-8000-000000000510', 'requested'),
  ('0c250000-0000-4000-8000-000000000d11', '0c250000-0000-4000-8000-000000000511', 'requested');

-- Admin assigns through the real update path (RLS + triggers apply).
select pg_temp.cc25_login('0c250000-0000-4000-8000-0000000000a1');
set local role authenticated;
select pg_temp.cc25_must($q$update public.discovery_sessions set assigned_counsellor_id = '0c250000-0000-4000-8000-0000000001c1', status = 'scheduled', scheduled_at = now() + interval '2 days' where id = '0c250000-0000-4000-8000-000000000d01'$q$);
select pg_temp.cc25_must($q$update public.discovery_sessions set assigned_counsellor_id = '0c250000-0000-4000-8000-0000000001c1' where id in ('0c250000-0000-4000-8000-000000000d04','0c250000-0000-4000-8000-000000000d05','0c250000-0000-4000-8000-000000000d06','0c250000-0000-4000-8000-000000000d7a','0c250000-0000-4000-8000-000000000d11')$q$);
select pg_temp.cc25_must($q$update public.discovery_sessions set status = 'completed', completed_at = now() where id in ('0c250000-0000-4000-8000-000000000d04','0c250000-0000-4000-8000-000000000d7a')$q$);
select pg_temp.cc25_must($q$update public.discovery_sessions set status = 'cancelled', cancelled_at = now(), cancellation_reason = 'fixture' where id = '0c250000-0000-4000-8000-000000000d05'$q$);
select pg_temp.cc25_must($q$update public.discovery_sessions set status = 'no_show' where id = '0c250000-0000-4000-8000-000000000d06'$q$);
select pg_temp.cc25_must($q$update public.discovery_sessions set assigned_counsellor_id = '0c250000-0000-4000-8000-0000000001c4', status = 'completed', completed_at = now() where id = '0c250000-0000-4000-8000-000000000d08'$q$);
select pg_temp.cc25_must($q$update public.discovery_sessions set assigned_counsellor_id = '0c250000-0000-4000-8000-0000000001c3', status = 'scheduled' where id = '0c250000-0000-4000-8000-000000000d09'$q$);
select pg_temp.cc25_must($q$update public.counsellors set is_active = false where id = '0c250000-0000-4000-8000-0000000001c3'$q$);
reset role;
select pg_temp.cc25_logout();

-- S7 books a second session after the first completed; admin assigns it to B.
insert into public.discovery_sessions (id, student_user_id, status)
values ('0c250000-0000-4000-8000-000000000d7b', '0c250000-0000-4000-8000-000000000507', 'requested');
select pg_temp.cc25_login('0c250000-0000-4000-8000-0000000000a1');
set local role authenticated;
select pg_temp.cc25_must($q$update public.discovery_sessions set assigned_counsellor_id = '0c250000-0000-4000-8000-0000000001c2', status = 'scheduled' where id = '0c250000-0000-4000-8000-000000000d7b'$q$);
reset role;
select pg_temp.cc25_logout();

-- Counsellor A self-claims S3's unassigned request (the triage workflow).
select pg_temp.cc25_login('0c250000-0000-4000-8000-0000000000c1');
set local role authenticated;
select pg_temp.cc25_must($q$update public.discovery_sessions set assigned_counsellor_id = '0c250000-0000-4000-8000-0000000001c1' where id = '0c250000-0000-4000-8000-000000000d03'$q$);
reset role;
select pg_temp.cc25_logout();

-- ---------------------------------------------------------------------------
-- Catalog checks (run as the database owner)
-- ---------------------------------------------------------------------------
select pg_temp.cc25_check('G01', '[CC25] identity RPC exists and returns exactly session_id, student_user_id, full_name, email',
  $q$select pg_get_function_result('public.staff_discovery_session_student_identities(uuid[])'::regprocedure) = 'TABLE(session_id uuid, student_user_id uuid, full_name text, email text)'$q$);
select pg_temp.cc25_check('G02', '[CC25] identity RPC is SECURITY DEFINER with an empty search_path',
  $q$select prosecdef and array_to_string(proconfig, ',') = 'search_path=""' from pg_proc where oid = 'public.staff_discovery_session_student_identities(uuid[])'::regprocedure$q$);
select pg_temp.cc25_check('G03', '[CC25] anon and PUBLIC cannot execute any CC-25 function',
  $q$select not has_function_privilege('anon', 'public.staff_discovery_session_student_identities(uuid[])', 'execute')
       and not has_function_privilege('anon', 'public.admin_set_discovery_session_assignment_approval(uuid,uuid,boolean)', 'execute')
       and not has_function_privilege('anon', 'public.counsellor_has_active_session_for_student(uuid)', 'execute')
       and not has_function_privilege('anon', 'public.counsellor_has_approved_session(uuid)', 'execute')
       and not exists (select 1 from pg_proc p, aclexplode(p.proacl) a where p.proname in ('staff_discovery_session_student_identities','admin_set_discovery_session_assignment_approval','counsellor_has_active_session_for_student','counsellor_has_approved_session','discovery_sessions_guard_cc25','admin_student_meta_guard_cc25') and a.grantee = 0)$q$);
select pg_temp.cc25_check('G04', 'no profiles policy references discovery_sessions (profiles RLS not widened)',
  $q$select not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and coalesce(qual, '') || coalesce(with_check, '') like '%discovery_sessions%')$q$);
select pg_temp.cc25_check('G05', 'the rejected CC-24 profiles policy is absent',
  $q$select not exists (select 1 from pg_policies where tablename = 'profiles' and policyname like '%(cc24)%')$q$);
select pg_temp.cc25_check('G06', 'profiles still has exactly its three pre-existing policies',
  $q$select array_agg(policyname order by policyname) = array['Admins/assigned counsellor can read student profiles (m7)','Students can read their own profile','Students can update their own profile']::name[] from pg_policies where schemaname = 'public' and tablename = 'profiles'$q$);
select pg_temp.cc25_check('G07', '[CC25] no workspace/provenance/verification policy trusts an unapproved discovery_sessions assignment',
  $q$select not exists (select 1 from pg_policies where schemaname = 'public' and tablename in ('discovery_session_workspace','student_profile_section_provenance','student_recommendation_verifications') and coalesce(qual, '') || coalesce(with_check, '') like '%discovery_sessions%')$q$);
select pg_temp.cc25_check('G08', '[CC25] guard triggers are installed on discovery_sessions and admin_student_meta',
  $q$select count(*) = 2 from pg_trigger where not tgisinternal and tgname in ('discovery_sessions_guard_cc25','admin_student_meta_guard_cc25')$q$);
select pg_temp.cc25_check('G09', '[CC25] admin assignment is recorded as approved by the admin (database-stamped)',
  $q$select assignment_approved_counsellor_id = assigned_counsellor_id and assignment_approved_by = '0c250000-0000-4000-8000-0000000000a1' and assignment_approved_at is not null from public.discovery_sessions where id = '0c250000-0000-4000-8000-000000000d01'$q$);
select pg_temp.cc25_check('G10', '[CC25] a counsellor self-claim is recorded as NOT approved',
  $q$select assigned_counsellor_id = '0c250000-0000-4000-8000-0000000001c1' and assignment_approved_counsellor_id is null and assignment_approved_at is null from public.discovery_sessions where id = '0c250000-0000-4000-8000-000000000d03'$q$);

-- ---------------------------------------------------------------------------
-- Counsellor A
-- ---------------------------------------------------------------------------
select pg_temp.cc25_login('0c250000-0000-4000-8000-0000000000c1');
set local role authenticated;

select pg_temp.cc25_check('I01', '[CC25] A gets name and email of the student in an admin-approved scheduled session',
  $q$select count(*) = 1 and bool_and(full_name = 'Fictional Student 01' and email = 'cc25.sqltest.000000000501@example.test' and student_user_id = '0c250000-0000-4000-8000-000000000501') from public.staff_discovery_session_student_identities(array['0c250000-0000-4000-8000-000000000d01']::uuid[])$q$);
select pg_temp.cc25_check('I02', '[CC25] A gets nothing for an unassigned session',
  $q$select count(*) = 0 from public.staff_discovery_session_student_identities(array['0c250000-0000-4000-8000-000000000d02']::uuid[])$q$);
select pg_temp.cc25_check('I03', '[CC25] A gets nothing for a self-claimed, unapproved session',
  $q$select count(*) = 0 from public.staff_discovery_session_student_identities(array['0c250000-0000-4000-8000-000000000d03']::uuid[])$q$);
select pg_temp.cc25_check('I04', '[CC25] A gets nothing for completed, cancelled and no-show sessions',
  $q$select count(*) = 0 from public.staff_discovery_session_student_identities(array['0c250000-0000-4000-8000-000000000d04','0c250000-0000-4000-8000-000000000d05','0c250000-0000-4000-8000-000000000d06']::uuid[])$q$);
select pg_temp.cc25_check('I05', '[CC25] multiple sessions: A gets nothing for S7 (own session completed, active one is B''s)',
  $q$select count(*) = 0 from public.staff_discovery_session_student_identities(array['0c250000-0000-4000-8000-000000000d7a','0c250000-0000-4000-8000-000000000d7b']::uuid[])$q$);
select pg_temp.cc25_check('I06', '[CC25] a mixed batch returns only the authorized session',
  $q$select array_agg(session_id) = array['0c250000-0000-4000-8000-000000000d01']::uuid[] from public.staff_discovery_session_student_identities(array['0c250000-0000-4000-8000-000000000d01','0c250000-0000-4000-8000-000000000d02','0c250000-0000-4000-8000-000000000d03','0c250000-0000-4000-8000-000000000d7b','0c250000-0000-4000-8000-000000000d09']::uuid[])$q$);
select pg_temp.cc25_error('I07', 'identity RPC rejects more than 100 ids',
  $q$select count(*) from public.staff_discovery_session_student_identities((select array_agg(gen_random_uuid()) from generate_series(1, 101)))$q$);
select pg_temp.cc25_check('I08', '[CC25] identity RPC with an empty or null list returns nothing',
  $q$select (select count(*) from public.staff_discovery_session_student_identities(null)) = 0 and (select count(*) from public.staff_discovery_session_student_identities('{}'::uuid[])) = 0$q$);
select pg_temp.cc25_check('P01', 'A cannot read the approved student''s profiles row directly (no table-level widening)',
  $q$select count(*) = 0 from public.profiles where id = '0c250000-0000-4000-8000-000000000501'$q$);
select pg_temp.cc25_check('P02', 'A cannot read any fixture student profile directly',
  $q$select count(*) = 0 from public.profiles where id::text like '0c250000-0000-4000-8000-0000000005%'$q$);
select pg_temp.cc25_denied('P03', 'A cannot update a student profile',
  $q$update public.profiles set full_name = 'HACKED' where id = '0c250000-0000-4000-8000-000000000501'$q$);
select pg_temp.cc25_denied('P04', 'A cannot delete a student profile',
  $q$delete from public.profiles where id = '0c250000-0000-4000-8000-000000000501'$q$);

select pg_temp.cc25_check('Q01', 'A still sees unassigned requests in the triage queue',
  $q$select count(*) = 1 from public.discovery_sessions where id = '0c250000-0000-4000-8000-000000000d02'$q$);
select pg_temp.cc25_check('Q02', 'A cannot see B''s session',
  $q$select count(*) = 0 from public.discovery_sessions where id = '0c250000-0000-4000-8000-000000000d7b'$q$);
select pg_temp.cc25_error('A01', '[CC25] A cannot change student_user_id on a session A holds (approved)',
  $q$update public.discovery_sessions set student_user_id = '0c250000-0000-4000-8000-000000000512' where id = '0c250000-0000-4000-8000-000000000d01'$q$);
select pg_temp.cc25_error('A02', '[CC25] A cannot change student_user_id on A''s own unapproved claim',
  $q$update public.discovery_sessions set student_user_id = '0c250000-0000-4000-8000-000000000512' where id = '0c250000-0000-4000-8000-000000000d03'$q$);
select pg_temp.cc25_error('A03', '[CC25] A cannot claim an unassigned session while changing its student',
  $q$update public.discovery_sessions set assigned_counsellor_id = '0c250000-0000-4000-8000-0000000001c1', student_user_id = '0c250000-0000-4000-8000-000000000512' where id = '0c250000-0000-4000-8000-000000000d02'$q$);
select pg_temp.cc25_error('A04', 'A cannot approve A''s own claim by writing the approval column',
  $q$update public.discovery_sessions set assignment_approved_counsellor_id = '0c250000-0000-4000-8000-0000000001c1' where id = '0c250000-0000-4000-8000-000000000d03'$q$);
select pg_temp.cc25_error('A05', 'A cannot approve via the admin approval RPC',
  $q$select public.admin_set_discovery_session_assignment_approval('0c250000-0000-4000-8000-000000000d03', '0c250000-0000-4000-8000-0000000001c1', true)$q$);
select pg_temp.cc25_error('A06', '[CC25] with an unapproved claim A cannot cancel the session',
  $q$update public.discovery_sessions set status = 'cancelled', cancelled_at = now() where id = '0c250000-0000-4000-8000-000000000d03'$q$);
select pg_temp.cc25_check('A07', 'with an unapproved claim a no-op save is still allowed (form re-submit)',
  $q$with u as (update public.discovery_sessions set status = status where id = '0c250000-0000-4000-8000-000000000d03' returning 1) select count(*) = 1 from u$q$);
select pg_temp.cc25_error('A08', 'A cannot hand A''s session to B',
  $q$update public.discovery_sessions set assigned_counsellor_id = '0c250000-0000-4000-8000-0000000001c2' where id = '0c250000-0000-4000-8000-000000000d01'$q$);
select pg_temp.cc25_denied('A09', 'A cannot update B''s session',
  $q$update public.discovery_sessions set status = 'cancelled' where id = '0c250000-0000-4000-8000-000000000d7b'$q$);
select pg_temp.cc25_denied('A10', 'A cannot delete a Discovery Session',
  $q$delete from public.discovery_sessions where id = '0c250000-0000-4000-8000-000000000d01'$q$);
select pg_temp.cc25_denied('A11', 'A cannot insert a Discovery Session for a student',
  $q$insert into public.discovery_sessions (student_user_id, status) values ('0c250000-0000-4000-8000-000000000512', 'requested')$q$);
select pg_temp.cc25_denied('A12', 'A cannot create a caseload row (admin_student_meta)',
  $q$insert into public.admin_student_meta (student_user_id, assigned_counsellor_id) values ('0c250000-0000-4000-8000-000000000512', '0c250000-0000-4000-8000-0000000001c1')$q$);
select pg_temp.cc25_denied('A13', 'A cannot grant itself an admin role',
  $q$insert into public.admin_roles (user_id, role) values ('0c250000-0000-4000-8000-0000000000c1', 'admin')$q$);
select pg_temp.cc25_denied('A14', 'A cannot reactivate counsellor C',
  $q$update public.counsellors set is_active = true where id = '0c250000-0000-4000-8000-0000000001c3'$q$);

-- Workspace (session-level) -------------------------------------------------
select pg_temp.cc25_check('W01', 'A can create the workspace of the approved session',
  $q$with i as (insert into public.discovery_session_workspace (session_id, counsellor_notes) values ('0c250000-0000-4000-8000-000000000d01', 'fixture note') returning 1) select count(*) = 1 from i$q$);
select pg_temp.cc25_denied('W02', '[CC25] A cannot create the workspace of an unapproved claim',
  $q$insert into public.discovery_session_workspace (session_id, counsellor_notes) values ('0c250000-0000-4000-8000-000000000d03', 'x')$q$);

-- Provenance and verifications (student-level) ------------------------------
select pg_temp.cc25_check('V01', 'A can record provenance for the approved, active session''s student',
  $q$with i as (insert into public.student_profile_section_provenance (student_user_id, section_key, provenance, last_updated_by) values ('0c250000-0000-4000-8000-000000000501', 'about_you', 'COUNSELLOR_ENTERED', '0c250000-0000-4000-8000-0000000000c1') returning 1) select count(*) = 1 from i$q$);
select pg_temp.cc25_denied('V02', '[CC25] A cannot record provenance after only self-claiming the session',
  $q$insert into public.student_profile_section_provenance (student_user_id, section_key, provenance, last_updated_by) values ('0c250000-0000-4000-8000-000000000503', 'about_you', 'COUNSELLOR_ENTERED', '0c250000-0000-4000-8000-0000000000c1')$q$);
select pg_temp.cc25_denied('V03', '[CC25] A cannot record provenance for the student of a completed session',
  $q$insert into public.student_profile_section_provenance (student_user_id, section_key, provenance, last_updated_by) values ('0c250000-0000-4000-8000-000000000504', 'about_you', 'COUNSELLOR_ENTERED', '0c250000-0000-4000-8000-0000000000c1')$q$);
select pg_temp.cc25_denied('V04', '[CC25] A cannot record provenance for the student of a cancelled session',
  $q$insert into public.student_profile_section_provenance (student_user_id, section_key, provenance, last_updated_by) values ('0c250000-0000-4000-8000-000000000505', 'about_you', 'COUNSELLOR_ENTERED', '0c250000-0000-4000-8000-0000000000c1')$q$);
select pg_temp.cc25_denied('V05', '[CC25] A cannot record a recommendation verification after only self-claiming',
  $q$insert into public.student_recommendation_verifications (student_user_id, recommendation_type, verified_by_counsellor_id) values ('0c250000-0000-4000-8000-000000000503', 'career', '0c250000-0000-4000-8000-0000000001c1')$q$);
select pg_temp.cc25_check('V06', 'A can record a recommendation verification for the approved, active session''s student',
  $q$with i as (insert into public.student_recommendation_verifications (student_user_id, recommendation_type, verified_by_counsellor_id) values ('0c250000-0000-4000-8000-000000000501', 'career', '0c250000-0000-4000-8000-0000000001c1') returning 1) select count(*) = 1 from i$q$);

reset role;
select pg_temp.cc25_logout();

-- ---------------------------------------------------------------------------
-- Counsellor D (caseload) — existing permissions must stay intact
-- ---------------------------------------------------------------------------
select pg_temp.cc25_login('0c250000-0000-4000-8000-0000000000c4');
set local role authenticated;
select pg_temp.cc25_check('C01', 'caseload counsellor D still reads the caseload student''s profile directly',
  $q$select count(*) = 1 from public.profiles where id = '0c250000-0000-4000-8000-000000000508'$q$);
select pg_temp.cc25_check('C02', '[CC25] caseload counsellor D gets the identity even for a completed session',
  $q$select count(*) = 1 from public.staff_discovery_session_student_identities(array['0c250000-0000-4000-8000-000000000d08']::uuid[])$q$);
select pg_temp.cc25_check('C03', 'caseload counsellor D can still record provenance for the caseload student',
  $q$with i as (insert into public.student_profile_section_provenance (student_user_id, section_key, provenance, last_updated_by) values ('0c250000-0000-4000-8000-000000000508', 'education', 'COUNSELLOR_ENTERED', '0c250000-0000-4000-8000-0000000000c4') returning 1) select count(*) = 1 from i$q$);
select pg_temp.cc25_error('C04', '[CC25] D cannot repoint D''s caseload row at another student (caseload hijack)',
  $q$update public.admin_student_meta set student_user_id = '0c250000-0000-4000-8000-000000000512' where student_user_id = '0c250000-0000-4000-8000-000000000508'$q$);
select pg_temp.cc25_check('C05', 'D can still update the status of D''s caseload row',
  $q$with u as (update public.admin_student_meta set status = 'inactive' where student_user_id = '0c250000-0000-4000-8000-000000000508' returning 1) select count(*) = 1 from u$q$);
select pg_temp.cc25_check('C06', 'D cannot read profiles of students outside D''s caseload',
  $q$select count(*) = 0 from public.profiles where id = '0c250000-0000-4000-8000-000000000501'$q$);
reset role;
select pg_temp.cc25_logout();

-- ---------------------------------------------------------------------------
-- Counsellor B and inactive counsellor C
-- ---------------------------------------------------------------------------
select pg_temp.cc25_login('0c250000-0000-4000-8000-0000000000c2');
set local role authenticated;
select pg_temp.cc25_check('B01', '[CC25] B gets the identity for B''s approved scheduled session (S7, second session)',
  $q$select count(*) = 1 from public.staff_discovery_session_student_identities(array['0c250000-0000-4000-8000-000000000d7b']::uuid[])$q$);
select pg_temp.cc25_check('B02', '[CC25] B gets nothing for A''s sessions',
  $q$select count(*) = 0 from public.staff_discovery_session_student_identities(array['0c250000-0000-4000-8000-000000000d01','0c250000-0000-4000-8000-000000000d03','0c250000-0000-4000-8000-000000000d11']::uuid[])$q$);
select pg_temp.cc25_check('B03', 'B cannot read A''s workspace',
  $q$select count(*) = 0 from public.discovery_session_workspace where session_id = '0c250000-0000-4000-8000-000000000d01'$q$);
select pg_temp.cc25_check('B04', 'B cannot read provenance A recorded for S1',
  $q$select count(*) = 0 from public.student_profile_section_provenance where student_user_id = '0c250000-0000-4000-8000-000000000501'$q$);
reset role;
select pg_temp.cc25_logout();

select pg_temp.cc25_login('0c250000-0000-4000-8000-0000000000c3');
set local role authenticated;
select pg_temp.cc25_check('X01', '[CC25] an inactive counsellor gets no identity, even for an approved scheduled session',
  $q$select count(*) = 0 from public.staff_discovery_session_student_identities(array['0c250000-0000-4000-8000-000000000d09']::uuid[])$q$);
select pg_temp.cc25_denied('X02', '[CC25] an inactive counsellor cannot record provenance through a session',
  $q$insert into public.student_profile_section_provenance (student_user_id, section_key, provenance, last_updated_by) values ('0c250000-0000-4000-8000-000000000509', 'about_you', 'COUNSELLOR_ENTERED', '0c250000-0000-4000-8000-0000000000c3')$q$);
reset role;
select pg_temp.cc25_logout();

-- ---------------------------------------------------------------------------
-- Students and anonymous
-- ---------------------------------------------------------------------------
select pg_temp.cc25_login('0c250000-0000-4000-8000-000000000502');
set local role authenticated;
select pg_temp.cc25_check('S01', 'a student reads only their own profile',
  $q$select count(*) = 1 and bool_and(id = '0c250000-0000-4000-8000-000000000502') from public.profiles where id::text like '0c250000-0000-4000-8000-0000000005%'$q$);
select pg_temp.cc25_check('S02', 'a student sees only their own Discovery Sessions',
  $q$select count(*) = 1 from public.discovery_sessions where id::text like '0c250000-0000-4000-8000-000000000d%'$q$);
select pg_temp.cc25_error('S03', 'a student cannot use the staff identity RPC',
  $q$select count(*) from public.staff_discovery_session_student_identities(array['0c250000-0000-4000-8000-000000000d01']::uuid[])$q$);
select pg_temp.cc25_denied('S04', 'a student cannot update their own booked session (staff-managed)',
  $q$update public.discovery_sessions set status = 'scheduled' where id = '0c250000-0000-4000-8000-000000000d02'$q$);
select pg_temp.cc25_denied('S05', 'a student cannot book a session pre-assigned to a counsellor',
  $q$insert into public.discovery_sessions (student_user_id, status, assigned_counsellor_id) values ('0c250000-0000-4000-8000-000000000502', 'requested', '0c250000-0000-4000-8000-0000000001c1')$q$);
select pg_temp.cc25_check('S06', 'a student cannot read the staff workspace of their own session',
  $q$select count(*) = 0 from public.discovery_session_workspace$q$);
select pg_temp.cc25_denied('S07', 'a student cannot grant themselves an admin role',
  $q$insert into public.admin_roles (user_id, role) values ('0c250000-0000-4000-8000-000000000502', 'admin')$q$);
select pg_temp.cc25_denied('S08', 'a student cannot delete their profile row',
  $q$delete from public.profiles where id = '0c250000-0000-4000-8000-000000000502'$q$);
reset role;
select pg_temp.cc25_logout();

select pg_temp.cc25_login('0c250000-0000-4000-8000-000000000512');
set local role authenticated;
select pg_temp.cc25_check('S09', '[CC25] a student''s booking cannot carry a forged approval',
  $q$with i as (insert into public.discovery_sessions (student_user_id, status, assignment_approved_counsellor_id) values ('0c250000-0000-4000-8000-000000000512', 'requested', '0c250000-0000-4000-8000-0000000001c1') returning assignment_approved_counsellor_id) select bool_and(assignment_approved_counsellor_id is null) from i$q$);
reset role;
select pg_temp.cc25_logout();

set local role anon;
select pg_temp.cc25_check('N01', 'anonymous reads no profile, session or workspace',
  $q$select (select count(*) from public.profiles) = 0 and (select count(*) from public.discovery_sessions) = 0 and (select count(*) from public.discovery_session_workspace) = 0$q$);
select pg_temp.cc25_error('N02', 'anonymous cannot execute the identity RPC',
  $q$select count(*) from public.staff_discovery_session_student_identities(array['0c250000-0000-4000-8000-000000000d01']::uuid[])$q$);
select pg_temp.cc25_denied('N03', 'anonymous cannot book a session',
  $q$insert into public.discovery_sessions (student_user_id, status) values ('0c250000-0000-4000-8000-000000000502', 'requested')$q$);
select pg_temp.cc25_denied('N04', 'anonymous cannot update or delete sessions',
  $q$with u as (update public.discovery_sessions set status = 'cancelled' returning 1), d as (delete from public.discovery_sessions returning 1) select 1 from u union all select 1 from d$q$);
reset role;

-- ---------------------------------------------------------------------------
-- Admin: approval, reassignment, unassignment
-- ---------------------------------------------------------------------------
select pg_temp.cc25_login('0c250000-0000-4000-8000-0000000000a1');
set local role authenticated;
select pg_temp.cc25_check('M01', 'admin reads every fixture student profile',
  $q$select count(*) = 13 from public.profiles where id::text like '0c250000-0000-4000-8000-0000000005%'$q$);
select pg_temp.cc25_check('M02', '[CC25] admin gets identities for any session',
  $q$select count(*) = 3 from public.staff_discovery_session_student_identities(array['0c250000-0000-4000-8000-000000000d02','0c250000-0000-4000-8000-000000000d03','0c250000-0000-4000-8000-000000000d04']::uuid[])$q$);
select pg_temp.cc25_error('M03', 'approval RPC refuses a stale counsellor id',
  $q$select public.admin_set_discovery_session_assignment_approval('0c250000-0000-4000-8000-000000000d03', '0c250000-0000-4000-8000-0000000001c2', true)$q$);
select pg_temp.cc25_error('M04', 'approval RPC refuses a completed session',
  $q$select public.admin_set_discovery_session_assignment_approval('0c250000-0000-4000-8000-000000000d04', '0c250000-0000-4000-8000-0000000001c1', true)$q$);
select pg_temp.cc25_check('M05', '[CC25] admin approves A''s self-claim of S3 through the RPC',
  $q$select (public.admin_set_discovery_session_assignment_approval('0c250000-0000-4000-8000-000000000d03', '0c250000-0000-4000-8000-0000000001c1', true) ->> 'approved')::boolean$q$);
select pg_temp.cc25_check('M06', '[CC25] the approval is audited with the admin as actor',
  $q$select count(*) = 1 from public.admin_audit_log where entity_type = 'discovery_session' and entity_id = '0c250000-0000-4000-8000-000000000d03' and action = 'Approved' and actor_user_id = '0c250000-0000-4000-8000-0000000000a1'$q$);
select pg_temp.cc25_check('M07', '[CC25] approved_by cannot be forged, even by an admin writing the column',
  $q$with u as (update public.discovery_sessions set assignment_approved_by = '0c250000-0000-4000-8000-0000000000c1', assignment_approved_at = '2000-01-01' where id = '0c250000-0000-4000-8000-000000000d03' returning assignment_approved_by, assignment_approved_at) select bool_and(assignment_approved_by = '0c250000-0000-4000-8000-0000000000a1' and assignment_approved_at > now() - interval '1 hour') from u$q$);
select pg_temp.cc25_error('M08', '[CC25] even an admin cannot change the student on a booking (target has no other booking)',
  $q$update public.discovery_sessions set student_user_id = '0c250000-0000-4000-8000-000000000513' where id = '0c250000-0000-4000-8000-000000000d02'$q$);
select pg_temp.cc25_must($q$update public.discovery_sessions set assigned_counsellor_id = '0c250000-0000-4000-8000-0000000001c2' where id = '0c250000-0000-4000-8000-000000000d01'$q$);
select pg_temp.cc25_must($q$update public.discovery_sessions set assigned_counsellor_id = null where id = '0c250000-0000-4000-8000-000000000d11'$q$);
reset role;
select pg_temp.cc25_logout();

select pg_temp.cc25_check('M09', '[CC25] unassignment clears the approval',
  $q$select assignment_approved_counsellor_id is null and assignment_approved_by is null and assignment_approved_at is null from public.discovery_sessions where id = '0c250000-0000-4000-8000-000000000d11'$q$);

select pg_temp.cc25_login('0c250000-0000-4000-8000-0000000000c1');
set local role authenticated;
select pg_temp.cc25_check('R01', '[CC25] after approval A gets S3''s identity',
  $q$select count(*) = 1 from public.staff_discovery_session_student_identities(array['0c250000-0000-4000-8000-000000000d03']::uuid[])$q$);
select pg_temp.cc25_check('R02', '[CC25] after reassignment to B, A gets nothing for S1',
  $q$select count(*) = 0 from public.staff_discovery_session_student_identities(array['0c250000-0000-4000-8000-000000000d01']::uuid[])$q$);
select pg_temp.cc25_check('R03', 'after reassignment, A loses the workspace of S1''s session',
  $q$select count(*) = 0 from public.discovery_session_workspace where session_id = '0c250000-0000-4000-8000-000000000d01'$q$);
select pg_temp.cc25_check('R04', 'after reassignment, A loses S1''s provenance',
  $q$select count(*) = 0 from public.student_profile_section_provenance where student_user_id = '0c250000-0000-4000-8000-000000000501'$q$);
select pg_temp.cc25_check('R05', '[CC25] after unassignment, A gets nothing for S11',
  $q$select count(*) = 0 from public.staff_discovery_session_student_identities(array['0c250000-0000-4000-8000-000000000d11']::uuid[])$q$);
reset role;
select pg_temp.cc25_logout();

select pg_temp.cc25_login('0c250000-0000-4000-8000-0000000000c2');
set local role authenticated;
select pg_temp.cc25_check('R06', '[CC25] after an admin reassigns S1 to B, B gets S1''s identity',
  $q$select count(*) = 1 from public.staff_discovery_session_student_identities(array['0c250000-0000-4000-8000-000000000d01']::uuid[])$q$);
select pg_temp.cc25_check('R07', 'after reassignment, B reads the session workspace',
  $q$select count(*) = 1 from public.discovery_session_workspace where session_id = '0c250000-0000-4000-8000-000000000d01'$q$);
reset role;
select pg_temp.cc25_logout();

-- Privileged server role (no user JWT): deleting a counsellor keeps the data consistent.
select pg_temp.cc25_check('Z01', 'a privileged server role can delete a counsellor who holds approved assignments',
  $q$with d as (delete from public.counsellors where id = '0c250000-0000-4000-8000-0000000001c2' returning 1) select count(*) = 1 from d$q$);
select pg_temp.cc25_check('Z02', '[CC25] deleting that counsellor left the session unassigned with no approval',
  $q$select assigned_counsellor_id is null and assignment_approved_counsellor_id is null and assignment_approved_by is null and assignment_approved_at is null from public.discovery_sessions where id = '0c250000-0000-4000-8000-000000000d7b'$q$);

-- ---------------------------------------------------------------------------
-- Report and verdict
-- ---------------------------------------------------------------------------
select pg_temp.cc25_logout();
select id || '|' || case when pass then 'PASS' else 'FAIL' end || '|' || name || coalesce(' | ' || detail, '') as result
from cc25_results order by ts;

do $verdict$
declare v_failed int; v_total int;
begin
  select count(*) filter (where not pass), count(*) into v_failed, v_total from cc25_results;
  raise notice 'CC25|SUMMARY|% checks, % passed, % failed', v_total, v_total - v_failed, v_failed;
  if v_failed > 0 then
    raise exception 'CC25 RLS TESTS FAILED: % of % checks failed', v_failed, v_total;
  end if;
end
$verdict$;

rollback;
