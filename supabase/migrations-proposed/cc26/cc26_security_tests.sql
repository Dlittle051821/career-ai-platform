-- ============================================================================
-- CC-26 — executable security tests for 0023 revision 2 (NW07 section),
-- 0024, 0025 and 0026.
--
-- Pure SQL (no psql meta-commands). ONE transaction, never committed: the
-- fictional fixture (ids 0c260000-…, addresses @example.test) leaves no row.
-- Each check prints  CC26|PASS|<id>|<name>   or   CC26|FAIL|<id>|<name>|<detail>
-- NW07 checks print  CC26|SKIP|…  when NW07 is not applied (never PASS).
-- P09 prints  CC26|INFO|…  (a measured value, not a pass/fail check).
-- The script ends with an ERROR when any check failed:
--     psql -v ON_ERROR_STOP=1 -X -q -f cc26_security_tests.sql      -> exit 3 on failure
-- Runs against the real policies, grants, triggers and functions of the target
-- database (local disposable PostgreSQL, or QA after approval). NEVER production.
-- Before the CC-26 migrations are applied the checks tagged [0024], [0025],
-- [0026] and [NW07] are EXPECTED to fail: they reproduce the defects.
-- Requires cc25/0023 (revision 2) for the fixture's approval semantics.
-- ============================================================================

begin;

do $guard$
begin
  if coalesce(current_setting('nextwise.cc26_test_target', true), '') not in ('LOCAL-DISPOSABLE-TEST', 'QA-ynwzijulzksmrcwdhudv') then
    raise exception 'CC26 tests refused: set nextwise.cc26_test_target to LOCAL-DISPOSABLE-TEST or QA-ynwzijulzksmrcwdhudv (never production).';
  end if;
  if to_regprocedure('public.counsellor_has_active_session_for_student(uuid)') is null then
    raise exception 'CC26 tests refused: cc25/0023 (revision 2) is not applied.';
  end if;
end
$guard$;

create temp table cc26_results (ts timestamptz not null default clock_timestamp(), id text not null, name text not null, status text not null, detail text);
grant select, insert on cc26_results to anon, authenticated, service_role;

create function pg_temp.cc26_login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end $$;

create function pg_temp.cc26_logout() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', '', true);
end $$;

create function pg_temp.cc26_record(p_id text, p_name text, p_status text, p_detail text default null) returns void language plpgsql as $$
begin
  insert into cc26_results (id, name, status, detail) values (p_id, p_name, p_status, p_detail);
  raise notice 'CC26|%|%|%', p_status, p_id, p_name || case when p_detail is null then '' else '|' || p_detail end;
end $$;

create function pg_temp.cc26_check(p_id text, p_name text, p_sql text) returns void language plpgsql as $$
declare v boolean;
begin
  begin
    execute p_sql into v;
    perform pg_temp.cc26_record(p_id, p_name, case when coalesce(v, false) then 'PASS' else 'FAIL' end,
                                case when coalesce(v, false) then null else 'returned ' || coalesce(v::text, 'null') end);
  exception when others then
    perform pg_temp.cc26_record(p_id, p_name, 'FAIL', 'error ' || sqlstate || ': ' || sqlerrm);
  end;
end $$;

-- Statement must have no effect (an error, or zero rows). An effect is undone and fails.
create function pg_temp.cc26_denied(p_id text, p_name text, p_sql text) returns void language plpgsql as $$
declare v_rows bigint;
begin
  begin
    execute p_sql;
    get diagnostics v_rows = row_count;
    if v_rows > 0 then
      raise exception '% row(s) affected (undone)', v_rows using errcode = 'CC260';
    end if;
    perform pg_temp.cc26_record(p_id, p_name, 'PASS');
  exception
    when sqlstate 'CC260' then perform pg_temp.cc26_record(p_id, p_name, 'FAIL', sqlerrm);
    when others then perform pg_temp.cc26_record(p_id, p_name, 'PASS', null);
  end;
end $$;

-- Statement must raise an error. A success is undone and fails.
create function pg_temp.cc26_error(p_id text, p_name text, p_sql text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
    raise exception 'statement succeeded (undone)' using errcode = 'CC260';
  exception
    when sqlstate 'CC260' then perform pg_temp.cc26_record(p_id, p_name, 'FAIL', sqlerrm);
    when others then perform pg_temp.cc26_record(p_id, p_name, 'PASS', null);
  end;
end $$;

-- Statement must succeed and affect at least one row; the effect is then undone.
create function pg_temp.cc26_allowed(p_id text, p_name text, p_sql text) returns void language plpgsql as $$
declare v_rows bigint;
begin
  begin
    execute p_sql;
    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      perform pg_temp.cc26_record(p_id, p_name, 'FAIL', 'no row affected');
      return;
    end if;
    raise exception 'ok' using errcode = 'CC261';
  exception
    when sqlstate 'CC261' then perform pg_temp.cc26_record(p_id, p_name, 'PASS');
    when others then perform pg_temp.cc26_record(p_id, p_name, 'FAIL', 'error ' || sqlstate || ': ' || sqlerrm);
  end;
end $$;

create function pg_temp.cc26_skip(p_id text, p_name text, p_why text) returns void language plpgsql as $$
begin
  perform pg_temp.cc26_record(p_id, p_name, 'SKIP', p_why);
end $$;

create function pg_temp.cc26_must(p_sql text) returns void language plpgsql as $$
declare v_rows bigint;
begin
  execute p_sql;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then raise exception 'CC26 fixture step affected no row: %', p_sql; end if;
end $$;

grant execute on all functions in schema pg_temp to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Fictional fixture
--   a1 admin; c1..c5 counsellors; s1..s8 students
--   d1 s1: admin-assigned to c1, scheduled            (approved, active)
--   d2 s2: self-claimed by c2                          (unapproved)
--   d3 s3: admin-assigned to c3, then completed         (approved, finished)
--   d6 s6: unassigned request                          (triage queue)
--   caseload: s4 -> c4 (c4 is then DEACTIVATED), s5 -> c5 (active)
-- ---------------------------------------------------------------------------
select pg_temp.cc26_logout();

insert into auth.users (id, email)
select ('0c260000-0000-4000-8000-' || x)::uuid, 'cc26.sqltest.' || x || '@example.test'
from unnest(array['0000000000a1','0000000000c1','0000000000c2','0000000000c3','0000000000c4','0000000000c5',
                  '000000000601','000000000602','000000000603','000000000604','000000000605','000000000606',
                  '000000000607','000000000608']) x;

insert into public.profiles (id, full_name, email)
select ('0c260000-0000-4000-8000-' || x)::uuid, 'Fictional CC26 ' || right(x, 3), 'cc26.sqltest.' || x || '@example.test'
from unnest(array['0000000000a1','0000000000c1','0000000000c2','0000000000c3','0000000000c4','0000000000c5',
                  '000000000601','000000000602','000000000603','000000000604','000000000605','000000000606',
                  '000000000607','000000000608']) x
on conflict (id) do update set full_name = excluded.full_name, email = excluded.email;

insert into public.student_profiles (user_id, city)
select ('0c260000-0000-4000-8000-' || x)::uuid, 'Fictional City'
from unnest(array['000000000601','000000000602','000000000603','000000000604','000000000605','000000000606']) x
on conflict (user_id) do update set city = excluded.city;

insert into public.admin_roles (user_id, role) values
  ('0c260000-0000-4000-8000-0000000000a1', 'admin'),
  ('0c260000-0000-4000-8000-0000000000c1', 'counsellor'),
  ('0c260000-0000-4000-8000-0000000000c2', 'counsellor'),
  ('0c260000-0000-4000-8000-0000000000c3', 'counsellor'),
  ('0c260000-0000-4000-8000-0000000000c4', 'counsellor'),
  ('0c260000-0000-4000-8000-0000000000c5', 'counsellor');

insert into public.counsellors (id, user_id, display_name) values
  ('0c260000-0000-4000-8000-0000000001c1', '0c260000-0000-4000-8000-0000000000c1', 'Fictional CC26 Counsellor 1'),
  ('0c260000-0000-4000-8000-0000000001c2', '0c260000-0000-4000-8000-0000000000c2', 'Fictional CC26 Counsellor 2'),
  ('0c260000-0000-4000-8000-0000000001c3', '0c260000-0000-4000-8000-0000000000c3', 'Fictional CC26 Counsellor 3'),
  ('0c260000-0000-4000-8000-0000000001c4', '0c260000-0000-4000-8000-0000000000c4', 'Fictional CC26 Counsellor 4'),
  ('0c260000-0000-4000-8000-0000000001c5', '0c260000-0000-4000-8000-0000000000c5', 'Fictional CC26 Counsellor 5');

insert into public.admin_student_meta (student_user_id, status, assigned_counsellor_id) values
  ('0c260000-0000-4000-8000-000000000602', 'active', null),
  ('0c260000-0000-4000-8000-000000000604', 'active', '0c260000-0000-4000-8000-0000000001c4'),
  ('0c260000-0000-4000-8000-000000000605', 'active', '0c260000-0000-4000-8000-0000000001c5');

insert into public.admin_student_notes (student_user_id, author_user_id, note) values
  ('0c260000-0000-4000-8000-000000000601', '0c260000-0000-4000-8000-0000000000a1', 'Fictional note S1'),
  ('0c260000-0000-4000-8000-000000000602', '0c260000-0000-4000-8000-0000000000a1', 'Fictional note S2'),
  ('0c260000-0000-4000-8000-000000000604', '0c260000-0000-4000-8000-0000000000a1', 'Fictional note S4');

insert into public.discovery_sessions (id, student_user_id, status) values
  ('0c260000-0000-4000-8000-000000000d01', '0c260000-0000-4000-8000-000000000601', 'requested'),
  ('0c260000-0000-4000-8000-000000000d02', '0c260000-0000-4000-8000-000000000602', 'requested'),
  ('0c260000-0000-4000-8000-000000000d03', '0c260000-0000-4000-8000-000000000603', 'requested'),
  ('0c260000-0000-4000-8000-000000000d06', '0c260000-0000-4000-8000-000000000606', 'requested');

select pg_temp.cc26_login('0c260000-0000-4000-8000-0000000000a1');
set local role authenticated;
select pg_temp.cc26_must($q$update public.discovery_sessions set assigned_counsellor_id = '0c260000-0000-4000-8000-0000000001c1', status = 'scheduled', scheduled_at = now() + interval '2 days' where id = '0c260000-0000-4000-8000-000000000d01'$q$);
select pg_temp.cc26_must($q$update public.discovery_sessions set assigned_counsellor_id = '0c260000-0000-4000-8000-0000000001c3' where id = '0c260000-0000-4000-8000-000000000d03'$q$);
select pg_temp.cc26_must($q$update public.discovery_sessions set status = 'completed', completed_at = now() where id = '0c260000-0000-4000-8000-000000000d03'$q$);
reset role;
select pg_temp.cc26_logout();

select pg_temp.cc26_login('0c260000-0000-4000-8000-0000000000c2');
set local role authenticated;
select pg_temp.cc26_must($q$update public.discovery_sessions set assigned_counsellor_id = '0c260000-0000-4000-8000-0000000001c2' where id = '0c260000-0000-4000-8000-000000000d02'$q$);
reset role;
select pg_temp.cc26_logout();

-- c4 is deactivated by an admin (the documented way to remove a counsellor).
select pg_temp.cc26_login('0c260000-0000-4000-8000-0000000000a1');
set local role authenticated;
select pg_temp.cc26_must($q$update public.counsellors set is_active = false where id = '0c260000-0000-4000-8000-0000000001c4'$q$);
reset role;
select pg_temp.cc26_logout();

-- Fictional plan for payment checks: ₹1,999 (199,900 paise), tax-inclusive.
insert into public.pricing_plans (id, slug, category, internal_name, is_active)
values ('0c260000-0000-4000-8000-00000000f001', 'cc26-fictional-verified', 'bachelor_abroad', 'CC26 fictional Verified', true);
insert into public.pricing_plan_versions (id, plan_id, version_number, public_title, currency, amount_minor_units, tax_status, status)
values ('0c260000-0000-4000-8000-00000000f011', '0c260000-0000-4000-8000-00000000f001', 1, 'Fictional Verified', 'INR', 199900, 'tax_inclusive', 'published');
insert into public.pricing_offers (id, plan_id, public_offer_name, discount_type, discount_percent_bps, starts_at, ends_at, is_active, status, coupon_code, max_redemptions)
values ('0c260000-0000-4000-8000-00000000f021', '0c260000-0000-4000-8000-00000000f001', 'Fictional limited offer', 'percentage', 1000,
        now() - interval '1 day', now() + interval '30 days', true, 'published', 'CC26FICTION', 3);

-- An admin-issued invoice for s7 (the attempt-forgery target).
select pg_temp.cc26_login('0c260000-0000-4000-8000-0000000000a1');
set local role authenticated;
select pg_temp.cc26_must($q$insert into public.invoices (id, invoice_number, student_user_id, status, currency, subtotal_minor_units, total_minor_units, issue_date)
  values ('0c260000-0000-4000-8000-00000000e001', 'CC26-FICTION-0001', '0c260000-0000-4000-8000-000000000607', 'issued', 'INR', 199900, 199900, current_date)$q$);
reset role;
select pg_temp.cc26_logout();

create temp table cc26_ledger as
select (select count(*) from public.invoices where student_user_id = '0c260000-0000-4000-8000-000000000607') as s7_invoices,
       (select count(*) from public.pricing_purchases where student_user_id = '0c260000-0000-4000-8000-000000000607') as s7_purchases,
       (select coalesce(sum(last_value), 0) from public.invoice_number_sequences) as seq_total,
       (select redemption_count from public.pricing_offers where id = '0c260000-0000-4000-8000-00000000f021') as redemptions;
grant select on cc26_ledger to anon, authenticated;

-- ===========================================================================
-- [NW07] Case access through Discovery Sessions (0023 revision 2, section 7b)
-- ===========================================================================
do $nw07$
begin
  if to_regprocedure('public.counsellor_has_case_access(uuid)') is null then
    perform pg_temp.cc26_skip(id, name, 'NW07 not applied on this database')
    from (values ('N01','unapproved self-claim cannot read student_profiles'), ('N02','unapproved self-claim cannot read case notes'),
                 ('N03','unapproved self-claim cannot add a case note'), ('N04','unapproved self-claim cannot read admin_student_meta'),
                 ('N05','counsellor_has_case_access is false for an unapproved self-claim'), ('N06','unapproved self-claim cannot create a recommendation draft'),
                 ('N07','approved active session reads student_profiles'), ('N08','counsellor_has_case_access is true for an approved active session'),
                 ('N09','approved session still cannot read the profiles row'), ('N10','approved but completed session grants nothing'),
                 ('N11','anon cannot execute counsellor_has_case_access'), ('N12','caseload counsellor reads student_profiles'),
                 ('N13','approved active session may add a case note')) v(id, name);
  end if;
end
$nw07$;

create function pg_temp.cc26_nw07() returns boolean language sql as $$ select to_regprocedure('public.counsellor_has_case_access(uuid)') is not null $$;

select pg_temp.cc26_login('0c260000-0000-4000-8000-0000000000c2');
set local role authenticated;
select pg_temp.cc26_check('N01', '[NW07] unapproved self-claim cannot read student_profiles',
  $q$select count(*) = 0 from public.student_profiles where user_id = '0c260000-0000-4000-8000-000000000602'$q$) where pg_temp.cc26_nw07();
select pg_temp.cc26_check('N02', '[NW07] unapproved self-claim cannot read case notes',
  $q$select count(*) = 0 from public.admin_student_notes where student_user_id = '0c260000-0000-4000-8000-000000000602'$q$) where pg_temp.cc26_nw07();
select pg_temp.cc26_denied('N03', '[NW07] unapproved self-claim cannot add a case note',
  $q$insert into public.admin_student_notes (student_user_id, author_user_id, note) values ('0c260000-0000-4000-8000-000000000602', '0c260000-0000-4000-8000-0000000000c2', 'should be refused')$q$) where pg_temp.cc26_nw07();
select pg_temp.cc26_check('N04', '[NW07] unapproved self-claim cannot read admin_student_meta',
  $q$select count(*) = 0 from public.admin_student_meta where student_user_id = '0c260000-0000-4000-8000-000000000602'$q$) where pg_temp.cc26_nw07();
select pg_temp.cc26_check('N05', '[NW07] counsellor_has_case_access is false for an unapproved self-claim',
  $q$select not public.counsellor_has_case_access('0c260000-0000-4000-8000-000000000602')$q$) where pg_temp.cc26_nw07();
select pg_temp.cc26_error('N06', '[NW07] unapproved self-claim cannot create a recommendation draft',
  $q$select public.staff_create_recommendation_draft('0c260000-0000-4000-8000-000000000602', 'Fictional draft', null, '{}'::jsonb)$q$) where pg_temp.cc26_nw07();
reset role;
select pg_temp.cc26_logout();

select pg_temp.cc26_login('0c260000-0000-4000-8000-0000000000c1');
set local role authenticated;
select pg_temp.cc26_check('N07', '[NW07] approved active session reads student_profiles',
  $q$select count(*) = 1 from public.student_profiles where user_id = '0c260000-0000-4000-8000-000000000601'$q$) where pg_temp.cc26_nw07();
select pg_temp.cc26_check('N08', '[NW07] counsellor_has_case_access is true for an approved active session',
  $q$select public.counsellor_has_case_access('0c260000-0000-4000-8000-000000000601')$q$) where pg_temp.cc26_nw07();
select pg_temp.cc26_check('N09', '[NW07] approved session still cannot read the profiles row (identity only via RPC)',
  $q$select count(*) = 0 from public.profiles where id = '0c260000-0000-4000-8000-000000000601'$q$) where pg_temp.cc26_nw07();
select pg_temp.cc26_allowed('N13', '[NW07] approved active session may add a case note',
  $q$insert into public.admin_student_notes (student_user_id, author_user_id, note) values ('0c260000-0000-4000-8000-000000000601', '0c260000-0000-4000-8000-0000000000c1', 'Fictional allowed note')$q$) where pg_temp.cc26_nw07();
reset role;
select pg_temp.cc26_logout();

select pg_temp.cc26_login('0c260000-0000-4000-8000-0000000000c3');
set local role authenticated;
select pg_temp.cc26_check('N10', '[NW07] approved but completed session grants nothing',
  $q$select not public.counsellor_has_case_access('0c260000-0000-4000-8000-000000000603')
       and (select count(*) from public.student_profiles where user_id = '0c260000-0000-4000-8000-000000000603') = 0$q$) where pg_temp.cc26_nw07();
reset role;
select pg_temp.cc26_logout();

select pg_temp.cc26_check('N11', '[NW07] anon cannot execute counsellor_has_case_access',
  $q$select not has_function_privilege('anon', 'public.counsellor_has_case_access(uuid)', 'execute')$q$) where pg_temp.cc26_nw07();

select pg_temp.cc26_login('0c260000-0000-4000-8000-0000000000c5');
set local role authenticated;
select pg_temp.cc26_check('N12', 'caseload counsellor reads student_profiles (regression)',
  $q$select count(*) = 1 from public.student_profiles where user_id = '0c260000-0000-4000-8000-000000000605'$q$) where pg_temp.cc26_nw07();
reset role;
select pg_temp.cc26_logout();

-- ===========================================================================
-- [0025] Inactive counsellors and table privileges
-- ===========================================================================
select pg_temp.cc26_login('0c260000-0000-4000-8000-0000000000c4');
set local role authenticated;
select pg_temp.cc26_check('I01', '[0025] current_counsellor_id() is null for a deactivated counsellor',
  $q$select public.current_counsellor_id() is null$q$);
select pg_temp.cc26_check('I02', '[0025] deactivated counsellor cannot read their former caseload row',
  $q$select count(*) = 0 from public.admin_student_meta where student_user_id = '0c260000-0000-4000-8000-000000000604'$q$);
select pg_temp.cc26_check('I03', '[0025] deactivated counsellor cannot read the caseload student''s profiles row',
  $q$select count(*) = 0 from public.profiles where id = '0c260000-0000-4000-8000-000000000604'$q$);
select pg_temp.cc26_check('I04', '[0025] deactivated counsellor cannot read the caseload student''s Student Digital Profile',
  $q$select count(*) = 0 from public.student_profiles where user_id = '0c260000-0000-4000-8000-000000000604'$q$);
select pg_temp.cc26_check('I05', '[0025] deactivated counsellor cannot read case notes',
  $q$select count(*) = 0 from public.admin_student_notes where student_user_id = '0c260000-0000-4000-8000-000000000604'$q$);
select pg_temp.cc26_check('I06', '[0025] deactivated counsellor cannot see the unassigned Discovery Session queue',
  $q$select count(*) = 0 from public.discovery_sessions where id = '0c260000-0000-4000-8000-000000000d06'$q$);
select pg_temp.cc26_denied('I07', '[0025] deactivated counsellor cannot touch an unassigned Discovery Session',
  $q$update public.discovery_sessions set preferred_language = 'xx' where id = '0c260000-0000-4000-8000-000000000d06'$q$);
reset role;
select pg_temp.cc26_logout();

select pg_temp.cc26_login('0c260000-0000-4000-8000-0000000000c5');
set local role authenticated;
select pg_temp.cc26_check('I08', 'active counsellor still resolves current_counsellor_id() (regression)',
  $q$select public.current_counsellor_id() = '0c260000-0000-4000-8000-0000000001c5'$q$);
select pg_temp.cc26_check('I09', 'active counsellor still sees the unassigned queue (regression)',
  $q$select count(*) = 1 from public.discovery_sessions where id = '0c260000-0000-4000-8000-000000000d06'$q$);
select pg_temp.cc26_check('I10', 'active caseload counsellor still reads the profiles row (regression)',
  $q$select count(*) = 1 from public.profiles where id = '0c260000-0000-4000-8000-000000000605'$q$);
select pg_temp.cc26_allowed('I11', 'active counsellor can still claim an unassigned session (regression)',
  $q$update public.discovery_sessions set assigned_counsellor_id = '0c260000-0000-4000-8000-0000000001c5' where id = '0c260000-0000-4000-8000-000000000d06'$q$);
reset role;
select pg_temp.cc26_logout();

select pg_temp.cc26_check('G01', '[0025] anon and authenticated hold no TRUNCATE on any public table',
  $q$select not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','p')
       and (has_table_privilege('anon', c.oid, 'TRUNCATE') or has_table_privilege('authenticated', c.oid, 'TRUNCATE')))$q$);
select pg_temp.cc26_check('G02', '[0025] anon and authenticated hold no TRIGGER or REFERENCES on any public table',
  $q$select not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','p')
       and (has_table_privilege('anon', c.oid, 'TRIGGER') or has_table_privilege('authenticated', c.oid, 'TRIGGER')
            or has_table_privilege('anon', c.oid, 'REFERENCES') or has_table_privilege('authenticated', c.oid, 'REFERENCES')))$q$);
select pg_temp.cc26_check('G03', 'ordinary API privileges are unchanged (regression)',
  $q$select has_table_privilege('authenticated', 'public.profiles', 'SELECT,UPDATE')
       and has_table_privilege('anon', 'public.careers', 'SELECT')
       and has_table_privilege('service_role', 'public.profiles', 'TRUNCATE')$q$);
select pg_temp.cc26_check('G04', '[0025] new tables created by the owner do not grant TRUNCATE to client roles',
  $q$select not exists (select 1 from pg_default_acl d, aclexplode(d.defaclacl) a
       where d.defaclnamespace = 'public'::regnamespace and d.defaclobjtype = 'r'
         and a.grantee in ('anon'::regrole, 'authenticated'::regrole) and a.privilege_type in ('TRUNCATE','TRIGGER','REFERENCES'))$q$);

-- ===========================================================================
-- [0024] Internal SECURITY DEFINER functions
-- ===========================================================================
select pg_temp.cc26_check('R01', '[0024] anon and authenticated cannot execute record_system_audit_log',
  $q$select not has_function_privilege('anon', 'public.record_system_audit_log(text,text,text,text,jsonb,jsonb)', 'execute')
       and not has_function_privilege('authenticated', 'public.record_system_audit_log(text,text,text,text,jsonb,jsonb)', 'execute')$q$);
select pg_temp.cc26_check('R02', '[0024] anon and authenticated cannot execute the document-path setters',
  $q$select not has_function_privilege('anon', 'public.set_signature_document_path(text,text,text)', 'execute')
       and not has_function_privilege('authenticated', 'public.set_signature_document_path(text,text,text)', 'execute')
       and not has_function_privilege('anon', 'public.set_stamp_document_path(text,text,text)', 'execute')
       and not has_function_privilege('authenticated', 'public.set_stamp_document_path(text,text,text)', 'execute')$q$);
select pg_temp.cc26_check('R03', 'service_role keeps the document-path setters (the app''s webhook path)',
  $q$select has_function_privilege('service_role', 'public.set_signature_document_path(text,text,text)', 'execute')
       and has_function_privilege('service_role', 'public.set_stamp_document_path(text,text,text)', 'execute')$q$);
select pg_temp.cc26_check('R04', 'the three webhook appliers stay callable without a session (regression)',
  $q$select has_function_privilege('anon', 'public.apply_webhook_event(text,text)', 'execute')
       and has_function_privilege('anon', 'public.apply_signature_webhook_event(text,text)', 'execute')
       and has_function_privilege('anon', 'public.apply_stamp_webhook_event(text,text)', 'execute')$q$);
create temp table cc26_audit_before as select count(*) n from public.admin_audit_log;
grant select on cc26_audit_before to anon;
set local role anon;
select pg_temp.cc26_error('R05', '[0024] an anonymous caller cannot forge a system audit row',
  $q$select public.record_system_audit_log('forged', 'invoice', 'x', 'forged by anon', null, null)$q$);
reset role;
select pg_temp.cc26_check('R06', 'no audit row was written by the anonymous attempt',
  $q$select (select count(*) from public.admin_audit_log) = (select n from cc26_audit_before)$q$);

-- ===========================================================================
-- [0026] Database checkout gate (payments OFF)
-- ===========================================================================
select pg_temp.cc26_check('P00', '[0026] the checkout gate exists and is closed',
  $q$select to_regclass('public.payment_launch_controls') is not null
       and not coalesce((select student_self_checkout_enabled from public.payment_launch_controls where id = 1), true)$q$);

select pg_temp.cc26_login('0c260000-0000-4000-8000-000000000607');
set local role authenticated;
select pg_temp.cc26_error('P01', '[0026] a student cannot create an invoice by calling purchase_pricing_plan directly',
  $q$select public.purchase_pricing_plan('0c260000-0000-4000-8000-00000000f001', null, null)$q$);
select pg_temp.cc26_error('P02', '[0026] … nor with a limited offer coupon',
  $q$select public.purchase_pricing_plan('0c260000-0000-4000-8000-00000000f001', null, 'CC26FICTION')$q$);
select pg_temp.cc26_denied('P03', '[0026] a student cannot insert a payment attempt on their own invoice',
  $q$insert into public.payment_attempts (invoice_id, provider, provider_order_id, idempotency_key, amount_minor_units, currency, status)
     values ('0c260000-0000-4000-8000-00000000e001', 'razorpay', 'order_FICTIONAL', 'cc26-fictional-key', 1000, 'INR', 'created')$q$);
select pg_temp.cc26_error('P04', 'a student cannot read the launch switch',
  $q$select student_self_checkout_enabled from public.payment_launch_controls$q$);
select pg_temp.cc26_error('P05', 'a student cannot open the launch switch',
  $q$update public.payment_launch_controls set student_self_checkout_enabled = true$q$);
reset role;
select pg_temp.cc26_logout();

select pg_temp.cc26_check('P06', 'after the refused attempts the ledger is untouched: no invoice, purchase, invoice number or offer redemption',
  $q$select (select count(*) from public.invoices where student_user_id = '0c260000-0000-4000-8000-000000000607') = l.s7_invoices
       and (select count(*) from public.pricing_purchases where student_user_id = '0c260000-0000-4000-8000-000000000607') = l.s7_purchases
       and (select coalesce(sum(last_value), 0) from public.invoice_number_sequences) = l.seq_total
       and (select redemption_count from public.pricing_offers where id = '0c260000-0000-4000-8000-00000000f021') = l.redemptions
     from cc26_ledger l$q$);

set local role anon;
select pg_temp.cc26_error('P07', 'an anonymous caller cannot purchase', $q$select public.purchase_pricing_plan('0c260000-0000-4000-8000-00000000f001', null, null)$q$);
reset role;

select pg_temp.cc26_login('0c260000-0000-4000-8000-0000000000a1');
set local role authenticated;
select pg_temp.cc26_allowed('P08', 'an admin can still issue a plan invoice while checkout is closed (regression)',
  $q$insert into public.invoices (invoice_number, student_user_id, status, currency, subtotal_minor_units, total_minor_units, issue_date, pricing_plan_id)
     values ('CC26-FICTION-0002', '0c260000-0000-4000-8000-000000000607', 'issued', 'INR', 199900, 199900, current_date, '0c260000-0000-4000-8000-00000000f001')$q$);
select pg_temp.cc26_error('P09', 'an admin cannot open the launch switch through the API',
  $q$update public.payment_launch_controls set student_self_checkout_enabled = true$q$);
reset role;
select pg_temp.cc26_logout();

-- Owner opens the gate inside this (never committed) transaction to prove the
-- gate is the only thing in the way, then measures the GST outcome.
do $open$
begin
  if to_regclass('public.payment_launch_controls') is not null then
    update public.payment_launch_controls set student_self_checkout_enabled = true where id = 1;
  end if;
end
$open$;
select pg_temp.cc26_login('0c260000-0000-4000-8000-000000000608');
set local role authenticated;
select pg_temp.cc26_check('P10', 'with the gate opened by the owner, checkout works and charges exactly ₹1,999 (GST not registered)',
  $q$select (public.purchase_pricing_plan('0c260000-0000-4000-8000-00000000f001', null, null) ->> 'total_minor_units')::int = 199900$q$);
reset role;
select pg_temp.cc26_logout();

update public.billing_settings set gst_registered = true, gstin = '29AAAAA0000A1Z5', default_tax_rate_bps = 1800 where id = 1;
select pg_temp.cc26_login('0c260000-0000-4000-8000-000000000606');
set local role authenticated;
do $info$
declare v jsonb; v_inclusive boolean;
begin
  v := public.purchase_pricing_plan('0c260000-0000-4000-8000-00000000f001', null, null);
  v_inclusive := (v ->> 'total_minor_units')::int = 199900;
  perform pg_temp.cc26_record('P11', 'GST-registered checkout total for the ₹1,999 tax-inclusive plan',
    'INFO', 'total_minor_units=' || (v ->> 'total_minor_units') ||
    case when v_inclusive then ' (tax-inclusive: correct)' else ' (tax added ON TOP: NW01 is required before GST-registered payments)' end);
end
$info$;
reset role;
select pg_temp.cc26_logout();

-- ---------------------------------------------------------------------------
-- Summary
-- ---------------------------------------------------------------------------
do $summary$
declare
  v_pass int; v_fail int; v_skip int; v_info int;
begin
  select count(*) filter (where status = 'PASS'), count(*) filter (where status = 'FAIL'),
         count(*) filter (where status = 'SKIP'), count(*) filter (where status = 'INFO')
    into v_pass, v_fail, v_skip, v_info from cc26_results;
  raise notice 'CC26|SUMMARY|pass=%|fail=%|skip=%|info=%', v_pass, v_fail, v_skip, v_info;
  if v_fail > 0 then
    raise exception 'CC26 SECURITY TESTS FAILED: % check(s) failed', v_fail;
  end if;
end
$summary$;

rollback;
