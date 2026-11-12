-- ============================================================================
-- CC-26 — READ-ONLY QA preflight for cc25/0023 (revision 2), cc25/0024,
-- cc26/0025 and cc26/0026. QA ynwzijulzksmrcwdhudv ONLY. Writes nothing.
--
-- Run as the project's postgres role through the session pooler. The file opens
-- and closes its own READ ONLY transaction (it ends with ROLLBACK).
-- Returns catalog facts and COUNTS only: no names, e-mails, phone numbers or
-- other personal data, and no identifiers of people.
-- Run it before approval 2 (apply) and keep the output with the evidence.
-- Revision 2 (2026-11-12) adds sections 7-10: the NW07 function classification,
-- every policy and RPC that depends on it, the 0025 F4 drift check and the
-- exposure scope of the confirmed NW07 defect (counts only).
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

-- ============================================================================
-- Revision 2 (2026-11-12, after the confirmed NW07 finding). Sections 7-10.
-- Still read-only, still counts and catalog facts only.
-- ============================================================================

-- 7. NW07 detail: classify counsellor_has_case_access and list what depends on it.
--    Expected on QA today: 'NW07 original (unsafe)'. After 0023 r2: 'CC-26 fixed'.
select 'nw07_case_access' as section,
       case md5(replace(p.prosrc, chr(13), ''))
         when 'af8e1b283e823e2002b909fe8b610561' then 'NW07 original (unsafe: any assignment, approved or not)'
         when '2a2f5e7f4f183185aced2356e5a58857' then 'CC-26 fixed (caseload OR approved active session)'
         else case when p.prosrc like '%discovery_sessions%' then 'UNKNOWN body that reads discovery_sessions directly (treat as unsafe; export it)'
                   else 'UNKNOWN body (export it before approval)' end
       end as classification,
       md5(replace(p.prosrc, chr(13), '')) as body_md5_lf,
       p.prosrc like '%assignment_approved%' or p.prosrc like '%counsellor_has_active_session_for_student%' as requires_approval,
       coalesce(array_to_string(p.proconfig, ','), '') as config,
       has_function_privilege('anon', p.oid, 'execute') as anon_can_execute
from pg_proc p where p.oid = to_regprocedure('public.counsellor_has_case_access(uuid)');

select 'nw07_dependent_policies' as section, tablename, policyname, cmd,
       (coalesce(qual, '') || coalesce(with_check, '')) like '%counsellor_has_case_access%' as via_case_access,
       (coalesce(qual, '') || coalesce(with_check, '')) like '%discovery_sessions%' as reads_discovery_sessions_directly,
       (coalesce(qual, '') || coalesce(with_check, '')) like '%created_by = auth.uid()%' as grants_by_authorship
from pg_policies
where schemaname = 'public' and tablename <> 'discovery_sessions'
  and ((coalesce(qual, '') || coalesce(with_check, '')) like '%counsellor_has_case_access%'
       or (coalesce(qual, '') || coalesce(with_check, '')) like '%discovery_sessions%')
order by tablename, policyname;

select 'nw07_dependent_functions' as section, p.oid::regprocedure::text as function, p.prosecdef as security_definer,
       md5(replace(p.prosrc, chr(13), '')) as body_md5_lf,
       p.prosrc like '%created_by = auth.uid() or public.counsellor_has_case_access%' as grants_by_authorship,
       coalesce(array_to_string(p.proconfig, ','), '') as config,
       has_function_privilege('anon', p.oid, 'execute') as anon_can_execute
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosrc like '%counsellor_has_case_access%'
order by 2;

-- 8. 0025 F4 drift: each of the five NW07 draft RPCs must have one of three
--    known fingerprints (NW07 original, CC-26 version, NW-F01 03 version).
--    Anything else makes 0025 refuse, whatever the body contains.
select 'f4_rpc_state' as section, v.fn,
       case md5(replace(p.prosrc, chr(13), ''))
         when v.nw07 then 'NW07 original (0025 replaces it)'
         when v.cc26 then 'CC-26 version (left unchanged)'
         when v.nwf01 then 'NW-F01 03 version (left unchanged)'
         else case when p.oid is null then 'ABSENT (0025 will refuse)' else 'UNKNOWN fingerprint (0025 will refuse)' end end as state,
       md5(replace(p.prosrc, chr(13), '')) as body_md5_lf
from (values
  ('staff_update_recommendation_draft_content(uuid,jsonb)', '5eef6dced30ca13c6b1354870f2e441b', '8d76caf129e0b33c6b70956ccf3be211', '98bccd1b7a5b72c049a69ce86afb12db'),
  ('staff_submit_recommendation_draft_for_review(uuid)', '3f365eacdd071abecbdf7a680e5d1775', '1a69bbfe9644efd7d8996275cc45fbf9', '010668295aab4a7ee5d466e8a6b4e464'),
  ('staff_release_recommendation_draft(uuid)', '5ddb8bc143a32a1109043b7e7cc2ef9c', 'dc4d3efb964868219c208369adb05ce6', '37eb052c70a08fb28a22231434c3597d'),
  ('staff_withdraw_recommendation_draft(uuid)', 'adb19f89b3d97167eaa8a7fa989db725', '3d65d505806b342f0e2659f618145dbd', 'cec7f6744961e4124b9081b325147b94'),
  ('staff_archive_recommendation_draft(uuid)', 'ebcc9aab425723c73db5784bc33b9ea2', '9d0f5dcbc0ecd98cedbc669552feec2f', '7435c90a98c41e03cff15f8b44e522d9')
) v(fn, nw07, cc26, nwf01)
left join pg_proc p on p.oid = to_regprocedure('public.' || v.fn);

-- 8b. State the 0025 rollback depends on (absent before 0025; present after).
select 'm0025_state' as section, to_regnamespace('nextwise_cc26_state') is not null as state_schema_present,
       case when to_regclass('nextwise_cc26_state.m0025_revoked_table_privileges') is null then null
            else (xpath('/row/n/text()', query_to_xml('select count(*) n from nextwise_cc26_state.m0025_revoked_table_privileges', false, true, '')))[1]::text::bigint end as recorded_table_privileges;

-- 9. Exposure SCOPE of the NW07 defect (COUNTS ONLY). "Session-only" = a
--    counsellor assigned to a student's Discovery Session who is NOT that
--    student's caseload counsellor. Under the original NW07 rule every such
--    assignment (approved or not, any status) opened the student's records to
--    that counsellor. These counts show what COULD have been reached; they are
--    not evidence that anything WAS read (PostgreSQL does not log reads).
select 'nw07_exposure_scope' as section, *
from (values
  ('session-only assignments (all statuses)', (case when to_regclass('public.discovery_sessions') is null then null else (xpath('/row/n/text()', query_to_xml($x$select count(*) n from public.discovery_sessions ds join public.counsellors c on c.id = ds.assigned_counsellor_id
        where not exists (select 1 from public.admin_student_meta m where m.student_user_id = ds.student_user_id and m.assigned_counsellor_id = ds.assigned_counsellor_id)$x$, false, true, '')))[1]::text::bigint end)),
  ('… of which requested/scheduled', (case when to_regclass('public.discovery_sessions') is null then null else (xpath('/row/n/text()', query_to_xml($x$select count(*) n from public.discovery_sessions ds join public.counsellors c on c.id = ds.assigned_counsellor_id
        where not exists (select 1 from public.admin_student_meta m where m.student_user_id = ds.student_user_id and m.assigned_counsellor_id = ds.assigned_counsellor_id) and ds.status in ('requested','scheduled')$x$, false, true, '')))[1]::text::bigint end)),
  ('… of which completed/cancelled/no-show (finished)', (case when to_regclass('public.discovery_sessions') is null then null else (xpath('/row/n/text()', query_to_xml($x$select count(*) n from public.discovery_sessions ds join public.counsellors c on c.id = ds.assigned_counsellor_id
        where not exists (select 1 from public.admin_student_meta m where m.student_user_id = ds.student_user_id and m.assigned_counsellor_id = ds.assigned_counsellor_id) and ds.status not in ('requested','scheduled')$x$, false, true, '')))[1]::text::bigint end)),
  ('… held by inactive counsellors', (case when to_regclass('public.discovery_sessions') is null then null else (xpath('/row/n/text()', query_to_xml($x$select count(*) n from public.discovery_sessions ds join public.counsellors c on c.id = ds.assigned_counsellor_id
        where not exists (select 1 from public.admin_student_meta m where m.student_user_id = ds.student_user_id and m.assigned_counsellor_id = ds.assigned_counsellor_id) and not c.is_active$x$, false, true, '')))[1]::text::bigint end)),
  ('… approved by an admin (only if 0023 is applied; else null)', (case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'discovery_sessions' and column_name = 'assignment_approved_at') then (xpath('/row/n/text()', query_to_xml($x$select count(*) n from public.discovery_sessions ds join public.counsellors c on c.id = ds.assigned_counsellor_id
        where not exists (select 1 from public.admin_student_meta m where m.student_user_id = ds.student_user_id and m.assigned_counsellor_id = ds.assigned_counsellor_id) and ds.assignment_approved_at is not null$x$, false, true, '')))[1]::text::bigint end)),
  ('distinct counsellors with a session-only assignment', (case when to_regclass('public.discovery_sessions') is null then null else (xpath('/row/n/text()', query_to_xml($x$select count(distinct ds.assigned_counsellor_id) n from public.discovery_sessions ds join public.counsellors c on c.id = ds.assigned_counsellor_id
        where not exists (select 1 from public.admin_student_meta m where m.student_user_id = ds.student_user_id and m.assigned_counsellor_id = ds.assigned_counsellor_id)$x$, false, true, '')))[1]::text::bigint end)),
  ('distinct students reachable only through a session assignment', (case when to_regclass('public.discovery_sessions') is null then null else (xpath('/row/n/text()', query_to_xml($x$select count(distinct ds.student_user_id) n from public.discovery_sessions ds join public.counsellors c on c.id = ds.assigned_counsellor_id
        where not exists (select 1 from public.admin_student_meta m where m.student_user_id = ds.student_user_id and m.assigned_counsellor_id = ds.assigned_counsellor_id)$x$, false, true, '')))[1]::text::bigint end)),
  ('recommendation drafts of those students', (case when to_regclass('public.recommendation_drafts') is null then null else (xpath('/row/n/text()', query_to_xml($x$select count(*) n from public.recommendation_drafts d where d.student_user_id in (select distinct ds.student_user_id from public.discovery_sessions ds join public.counsellors c on c.id = ds.assigned_counsellor_id
        where not exists (select 1 from public.admin_student_meta m where m.student_user_id = ds.student_user_id and m.assigned_counsellor_id = ds.assigned_counsellor_id))$x$, false, true, '')))[1]::text::bigint end)),
  ('recommendation draft versions of those students', (case when to_regclass('public.recommendation_draft_versions') is null then null else (xpath('/row/n/text()', query_to_xml($x$select count(*) n from public.recommendation_draft_versions v join public.recommendation_drafts d on d.id = v.draft_id where d.student_user_id in (select distinct ds.student_user_id from public.discovery_sessions ds join public.counsellors c on c.id = ds.assigned_counsellor_id
        where not exists (select 1 from public.admin_student_meta m where m.student_user_id = ds.student_user_id and m.assigned_counsellor_id = ds.assigned_counsellor_id))$x$, false, true, '')))[1]::text::bigint end)),
  ('AI-generation records of those students', (case when to_regclass('public.ai_generation_runs') is null then null else (xpath('/row/n/text()', query_to_xml($x$select count(*) n from public.ai_generation_runs r where r.student_user_id in (select distinct ds.student_user_id from public.discovery_sessions ds join public.counsellors c on c.id = ds.assigned_counsellor_id
        where not exists (select 1 from public.admin_student_meta m where m.student_user_id = ds.student_user_id and m.assigned_counsellor_id = ds.assigned_counsellor_id))$x$, false, true, '')))[1]::text::bigint end)),
  ('… of which data_class = real_student', (case when to_regclass('public.ai_generation_runs') is null then null else (xpath('/row/n/text()', query_to_xml($x$select count(*) n from public.ai_generation_runs r where r.data_class = 'real_student' and r.student_user_id in (select distinct ds.student_user_id from public.discovery_sessions ds join public.counsellors c on c.id = ds.assigned_counsellor_id
        where not exists (select 1 from public.admin_student_meta m where m.student_user_id = ds.student_user_id and m.assigned_counsellor_id = ds.assigned_counsellor_id))$x$, false, true, '')))[1]::text::bigint end)),
  ('… of which hold a stored report', (case when to_regclass('public.ai_generation_runs') is null then null else (xpath('/row/n/text()', query_to_xml($x$select count(*) n from public.ai_generation_runs r where r.report is not null and r.student_user_id in (select distinct ds.student_user_id from public.discovery_sessions ds join public.counsellors c on c.id = ds.assigned_counsellor_id
        where not exists (select 1 from public.admin_student_meta m where m.student_user_id = ds.student_user_id and m.assigned_counsellor_id = ds.assigned_counsellor_id))$x$, false, true, '')))[1]::text::bigint end)),
  ('drafts whose author is not the student''s caseload counsellor (author-only access; closed by 0025 F4)', (case when to_regclass('public.recommendation_drafts') is null then null else (xpath('/row/n/text()', query_to_xml($x$select count(*) n from public.recommendation_drafts d join public.counsellors c on c.user_id = d.created_by where not exists (select 1 from public.admin_student_meta m where m.student_user_id = d.student_user_id and m.assigned_counsellor_id = c.id)$x$, false, true, '')))[1]::text::bigint end)),
  ('drafts authored by inactive counsellors', (case when to_regclass('public.recommendation_drafts') is null then null else (xpath('/row/n/text()', query_to_xml($x$select count(*) n from public.recommendation_drafts d join public.counsellors c on c.user_id = d.created_by where not c.is_active$x$, false, true, '')))[1]::text::bigint end)),
  ('AI-generation records with data_class real_student (whole table)', (case when to_regclass('public.ai_generation_runs') is null then null else (xpath('/row/n/text()', query_to_xml($x$select count(*) n from public.ai_generation_runs where data_class = 'real_student'$x$, false, true, '')))[1]::text::bigint end))
) as e(indicator, count);

-- 10. Lock and size facts for the apply window (0023 adds a CHECK constraint
--     that scans discovery_sessions under an ACCESS EXCLUSIVE lock).
select 'apply_window' as section,
       (select count(*) from public.discovery_sessions) as discovery_sessions_rows,
       pg_size_pretty(pg_total_relation_size('public.discovery_sessions')) as discovery_sessions_size,
       (select count(*) from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid() and state <> 'idle') as other_active_sessions,
       (select count(*) from pg_locks l join pg_class c on c.oid = l.relation where c.relname in ('discovery_sessions', 'admin_student_meta', 'recommendation_drafts') and l.granted and l.pid <> pg_backend_pid()) as locks_held_on_targets;

rollback;
