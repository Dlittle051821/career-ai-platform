-- ============================================================================
-- CC-26 — READ-ONLY QA preflight for cc25/0023 (revision 2), cc25/0024,
-- cc26/0025 and cc26/0026. QA ynwzijulzksmrcwdhudv ONLY. Writes nothing.
--
-- Run as the project's postgres role through the session pooler. The file opens
-- and closes its own READ ONLY transaction (it ends with ROLLBACK).
-- Returns catalog facts and COUNTS only: no names, e-mails, phone numbers or
-- other personal data, and no identifiers of people.
-- Run it before approval 2 (apply) and keep the output with the evidence.
--
-- DECISIVE QUESTIONS IT ANSWERS
--   Q1 Is the proposed NW07 already applied?  (If yes, the NW07 self-claim
--      exposure is LIVE on QA until 0023 revision 2 is applied.)
--   Q2 Which of 0023 / 0024 / 0025 / 0026 are already applied?
--   Q3 Is the database in the state the migrations expect (drift)?
--   Q4 Indicators of exposure (counts): self-claimed sessions, inactive
--      counsellors with caseload, student-created plan invoices, anon-executable
--      internal functions, client TRUNCATE grants.
-- ============================================================================
begin read only;

-- 1. Identity (compare with the dashboard project ref; never production).
select 'identity' as section, current_database() as database, current_user as connected_as,
       inet_server_addr()::text as server_addr, version() as server_version,
       current_setting('transaction_read_only') as read_only;

-- 2. State markers.
select 'markers' as section, *
from (values
  ('0001-0022: 0022 submitted-transition invariant', exists (select 1 from pg_proc where proname = 'applications_enforce_submitted_transition')),
  ('NW05 applied', exists (select 1 from pg_proc where proname = 'student_mark_section_self_entered')),
  ('NW06 applied', to_regclass('public.application_tasks') is not null),
  ('Q1 NW07 applied (counsellor_has_case_access exists)', to_regprocedure('public.counsellor_has_case_access(uuid)') is not null),
  ('Q1 NW07 rule is the ORIGINAL unapproved-session rule', exists (select 1 from pg_proc where oid = to_regprocedure('public.counsellor_has_case_access(uuid)') and prosrc like '%discovery_sessions%')),
  ('NW09 applied', to_regclass('public.ai_generation_runs') is not null),
  ('NW-F01 NW09.2 atomic applied (consents table)', to_regclass('public.student_ai_processing_consents') is not null),
  ('NW-F01 05 applied (check_invoice_charge)', exists (select 1 from pg_proc where proname = 'check_invoice_charge')),
  ('NW01 applied (purchase_pricing_plan handles tax_inclusive)', exists (select 1 from pg_proc where oid = 'public.purchase_pricing_plan(uuid,uuid,text)'::regprocedure and prosrc like '%tax_inclusive%')),
  ('Q2 cc25/0023 applied (any revision)', to_regprocedure('public.staff_discovery_session_student_identities(uuid[])') is not null),
  ('Q2 cc25/0023 revision 2 effective (no policy outside discovery_sessions uses the raw table)', to_regprocedure('public.staff_discovery_session_student_identities(uuid[])') is not null and not exists (select 1 from pg_policies where schemaname = 'public' and tablename <> 'discovery_sessions' and coalesce(qual, '') || coalesce(with_check, '') like '%discovery_sessions%')),
  ('Q2 cc25/0024 applied (anon cannot execute record_system_audit_log)', not has_function_privilege('anon', 'public.record_system_audit_log(text,text,text,text,jsonb,jsonb)', 'execute')),
  ('Q2 cc26/0025 applied (current_counsellor_id checks is_active)', exists (select 1 from pg_proc where oid = 'public.current_counsellor_id()'::regprocedure and prosrc like '%is_active%')),
  ('Q2 cc26/0026 applied (payment_launch_controls exists)', to_regclass('public.payment_launch_controls') is not null),
  ('REJECTED CC-24 policy present (must be FALSE)', exists (select 1 from pg_policies where tablename = 'profiles' and policyname like '%(cc24)%'))
) as m(marker, value);

-- 3. Q3 drift: the 17 policies 0023 r2 / 0025 rewrite, with definition hashes.
--    Expected on an NW07 database: 15 NW07 counsellor policies + 2 discovery_sessions policies.
select 'policies' as section, tablename, policyname, cmd,
       (coalesce(qual, '') || coalesce(with_check, '')) like '%discovery_sessions%' as uses_raw_discovery_sessions,
       md5(coalesce(qual, '') || '|' || coalesce(with_check, '')) as definition_md5
from pg_policies
where schemaname = 'public'
  and (tablename in ('profiles', 'admin_student_meta', 'admin_student_notes', 'discovery_sessions', 'discovery_session_workspace',
                     'student_profile_section_provenance', 'student_recommendation_verifications')
       or (tablename like 'student\_%' and policyname like 'Admins/assigned counsellor can read student%'))
order by tablename, policyname;

select 'functions' as section, p.oid::regprocedure::text as function, p.prosecdef as security_definer,
       coalesce(array_to_string(p.proconfig, ','), '') as config, md5(p.prosrc) as body_md5, coalesce(p.proacl::text, '(default)') as acl
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('current_counsellor_id', 'counsellor_has_case_access', 'is_admin_role', 'record_system_audit_log',
                    'set_signature_document_path', 'set_stamp_document_path', 'purchase_pricing_plan',
                    'apply_webhook_event', 'apply_signature_webhook_event', 'apply_stamp_webhook_event')
order by 2;

-- 4. Q4 exposure indicators (COUNTS only).
select 'exposure' as section, *
from (values
  ('discovery sessions assigned to a counsellor (all; unapproved until an admin approves after 0023)',
     (select count(*) from public.discovery_sessions where assigned_counsellor_id is not null)),
  ('… of which requested/scheduled (active)',
     (select count(*) from public.discovery_sessions where assigned_counsellor_id is not null and status in ('requested', 'scheduled'))),
  ('inactive counsellors', (select count(*) from public.counsellors where not is_active)),
  ('caseload rows held by inactive counsellors (access removed by 0025)',
     (select count(*) from public.admin_student_meta m join public.counsellors c on c.id = m.assigned_counsellor_id where not c.is_active)),
  ('plan invoices created by the student themselves (self-checkout path)',
     (select count(*) from public.invoices where pricing_plan_id is not null and created_by = student_user_id)),
  ('… of which not paid (issued/overdue/partially_paid)',
     (select count(*) from public.invoices where pricing_plan_id is not null and created_by = student_user_id and status in ('issued', 'overdue', 'partially_paid'))),
  ('payment attempts created by students', (select count(*) from public.payment_attempts a join public.invoices i on i.id = a.invoice_id where a.created_by = i.student_user_id)),
  ('system audit rows (actor_role = system)', (select count(*) from public.admin_audit_log where actor_role = 'system')),
  ('public SECURITY DEFINER functions executable by anon',
     (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute'))),
  ('public tables where anon or authenticated hold TRUNCATE',
     (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'p')
        and (has_table_privilege('anon', c.oid, 'TRUNCATE') or has_table_privilege('authenticated', c.oid, 'TRUNCATE'))))
) as e(indicator, count);

-- 5. Owner and default privileges (the migrations' ALTER/REVOKE need the owner).
select 'owners' as section, p.oid::regprocedure::text as function, pg_get_userbyid(p.proowner) as owner
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('current_counsellor_id', 'counsellor_has_case_access', 'record_system_audit_log', 'purchase_pricing_plan')
order by 2;
select 'default_acl' as section, defaclrole::regrole::text as owner_role, defaclnamespace::regnamespace::text as schema, defaclobjtype as object_type, defaclacl::text as acl
from pg_default_acl order by 2, 3, 4;

-- 6. auth.uid() reads request.jwt.claim.sub first (the tests' login helper relies on it).
select 'auth_uid' as section, pg_get_functiondef('auth.uid()'::regprocedure) like '%request.jwt.claim.sub%' as reads_claim_sub;

rollback;
