-- CC-24 RLS tests for 0023. Runs in ONE transaction and ROLLS BACK: leaves no data.
-- Usage (local/QA only, never production):
--   psql ... -v apply_0023=1 -f 0023_rls_tests.sql     (applies the migration INSIDE the rolled-back transaction)
--   psql ... -v apply_0023=0 -f 0023_rls_tests.sql     (current policies only)
-- Output lines: CHECK|<name>|<expected>|<actual>
\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned
begin;
-- fictional fixture -------------------------------------------------------
insert into auth.users (id, email, aud, role) values
 ('00000000-0000-4000-8000-0000000c0a01','cc24.sqltest.counsellor.a@example.test','authenticated','authenticated'),
 ('00000000-0000-4000-8000-0000000c0b01','cc24.sqltest.counsellor.b@example.test','authenticated','authenticated'),
 ('00000000-0000-4000-8000-00000000ad01','cc24.sqltest.admin@example.test','authenticated','authenticated'),
 ('00000000-0000-4000-8000-000000005101','cc24.sqltest.student.assigned@example.test','authenticated','authenticated'),
 ('00000000-0000-4000-8000-000000005201','cc24.sqltest.student.unassigned@example.test','authenticated','authenticated'),
 ('00000000-0000-4000-8000-000000005301','cc24.sqltest.student.nosession@example.test','authenticated','authenticated');
insert into public.profiles (id, full_name, email) values
 ('00000000-0000-4000-8000-000000005101','Fictional Assigned Student','cc24.sqltest.student.assigned@example.test'),
 ('00000000-0000-4000-8000-000000005201','Fictional Unassigned Student','cc24.sqltest.student.unassigned@example.test'),
 ('00000000-0000-4000-8000-000000005301','Fictional No-Session Student','cc24.sqltest.student.nosession@example.test')
 on conflict (id) do update set full_name = excluded.full_name, email = excluded.email;
insert into public.admin_roles (user_id, role) values
 ('00000000-0000-4000-8000-0000000c0a01','counsellor'),
 ('00000000-0000-4000-8000-0000000c0b01','counsellor'),
 ('00000000-0000-4000-8000-00000000ad01','admin');
insert into public.counsellors (id, user_id, display_name) values
 ('00000000-0000-4000-8000-00000000ca01','00000000-0000-4000-8000-0000000c0a01','Fictional Counsellor A'),
 ('00000000-0000-4000-8000-00000000cb01','00000000-0000-4000-8000-0000000c0b01','Fictional Counsellor B');
insert into public.discovery_sessions (id, student_user_id, status, assigned_counsellor_id) values
 ('00000000-0000-4000-8000-00000000d501','00000000-0000-4000-8000-000000005101','scheduled','00000000-0000-4000-8000-00000000ca01'),
 ('00000000-0000-4000-8000-00000000d502','00000000-0000-4000-8000-000000005201','requested',null);

\if :apply_0023
\ir 0023_counsellor_discovery_session_profile_read.sql
\endif

-- helper: run a count as a given user ------------------------------------
create temp table _who(sub text);
grant select on _who to authenticated;

-- Counsellor A (assigned to S1's session)
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000c0a01","role":"authenticated"}';
select 'CHECK|A reads assigned student profile|1|' || count(*) from public.profiles where id = '00000000-0000-4000-8000-000000005101';
select 'CHECK|A sees assigned student name|Fictional Assigned Student|' || coalesce(max(full_name),'<none>') from public.profiles where id = '00000000-0000-4000-8000-000000005101';
select 'CHECK|A cannot read unassigned-session student|0|' || count(*) from public.profiles where id = '00000000-0000-4000-8000-000000005201';
select 'CHECK|A cannot read student with no session|0|' || count(*) from public.profiles where id = '00000000-0000-4000-8000-000000005301';
select 'CHECK|A sees the unassigned request in the queue (unchanged)|1|' || count(*) from public.discovery_sessions where id = '00000000-0000-4000-8000-00000000d502';
select 'CHECK|A cannot read student education rows via session (unchanged)|0|' || count(*) from public.student_education where user_id = '00000000-0000-4000-8000-000000005101';
-- update attempt must change nothing
update public.profiles set full_name = 'HACKED' where id = '00000000-0000-4000-8000-000000005101';
reset role;
select 'CHECK|A update attempt changed nothing|Fictional Assigned Student|' || full_name from public.profiles where id = '00000000-0000-4000-8000-000000005101';

-- Counsellor B (not assigned)
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000c0b01","role":"authenticated"}';
select 'CHECK|B cannot read A''s assigned student|0|' || count(*) from public.profiles where id = '00000000-0000-4000-8000-000000005101';
select 'CHECK|B cannot read unassigned-session student|0|' || count(*) from public.profiles where id = '00000000-0000-4000-8000-000000005201';
select 'CHECK|B cannot see A''s assigned session|0|' || count(*) from public.discovery_sessions where id = '00000000-0000-4000-8000-00000000d501';
reset role;

-- Student S2 (another student) cannot read S1
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000005201","role":"authenticated"}';
select 'CHECK|Student cannot read another student|0|' || count(*) from public.profiles where id = '00000000-0000-4000-8000-000000005101';
select 'CHECK|Student reads own profile|1|' || count(*) from public.profiles where id = '00000000-0000-4000-8000-000000005201';
reset role;

-- Admin unchanged
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000ad01","role":"authenticated"}';
select 'CHECK|Admin reads all three fixture students|3|' || count(*) from public.profiles where id in ('00000000-0000-4000-8000-000000005101','00000000-0000-4000-8000-000000005201','00000000-0000-4000-8000-000000005301');
reset role;

-- Reassignment: S1's session moves from A to B
update public.discovery_sessions set assigned_counsellor_id = '00000000-0000-4000-8000-00000000cb01' where id = '00000000-0000-4000-8000-00000000d501';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000c0a01","role":"authenticated"}';
select 'CHECK|After reassignment A loses access|0|' || count(*) from public.profiles where id = '00000000-0000-4000-8000-000000005101';
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000c0b01","role":"authenticated"}';
select 'CHECK|After reassignment B gains access|1|' || count(*) from public.profiles where id = '00000000-0000-4000-8000-000000005101';
reset role;

-- Anonymous
set local role anon;
select 'CHECK|Anonymous reads no fixture profile|0|' || count(*) from public.profiles where id::text like '00000000-0000-4000-8000-0000000053%' or id::text like '00000000-0000-4000-8000-0000000052%' or id::text like '00000000-0000-4000-8000-0000000051%';
reset role;
rollback;
