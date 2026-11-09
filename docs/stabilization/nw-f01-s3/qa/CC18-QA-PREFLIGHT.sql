-- NEXTWISE CC-18 — Supabase QA PREFLIGHT (READ-ONLY). NOT AUTHORIZED UNTIL APPROVED.
-- Target: QA project ynwzijulzksmrcwdhudv ONLY. Never production bwlkxunujngksibfzzfv.
-- Run with Run-QaPreflight.ps1 (explicit QA host/user guard, password never printed),
-- or: psql "<QA session-pooler URI>" -v ON_ERROR_STOP=1 -X -f CC18-QA-PREFLIGHT.sql
-- Everything runs in ONE read-only transaction that is rolled back. Results contain
-- only catalogue facts, counts and booleans: no student, payment or provider IDs.
\set ON_ERROR_STOP on
\pset pager off
begin transaction isolation level repeatable read read only;
set local statement_timeout = '30s';

\echo '== P1 identity (expect: postgres | postgres | read_only=on). Host/user were checked by the runner before connecting.'
select current_database() as database, current_user as role, current_setting('transaction_read_only') as read_only,
       split_part(version(), ' ', 2) as postgres_version;

\echo '== P3 schema/RPC compatibility (expect every present_* = t and every absent_* = t before migration)'
select
  to_regclass('public.recommendation_drafts') is not null              as present_nw07_drafts,
  to_regprocedure('public.counsellor_has_case_access(uuid)') is not null as present_nw07_case_access,
  to_regclass('public.ai_generation_runs') is not null                 as present_nw09_runs,
  to_regclass('public.ai_usage_settings') is not null                  as present_nw09_settings,
  to_regprocedure('public.staff_reserve_ai_generation_run(uuid,text,text,text,text,text,text,boolean,numeric,integer,integer,integer,numeric,uuid,text)') is not null as present_nw09_v1_reserve,
  to_regclass('public.billing_settings') is not null                   as present_billing_settings,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='invoices' and column_name='pricing_plan_id') as present_invoices_pricing_plan_id,
  to_regprocedure('public.apply_webhook_event(text,text)') is not null as present_razorpay_webhook,
  to_regprocedure('public.finalize_refund(uuid,text,text)') is not null as present_m13_refunds,
  to_regprocedure('public.purchase_pricing_plan(uuid,uuid,text)') is not null as present_purchase_rpc,
  to_regclass('public.signature_requests') is not null and to_regclass('public.stamp_requests') is not null as present_signature_stamp,
  to_regclass('public.student_ai_processing_consents') is null          as absent_nw09_2_consents,
  to_regprocedure('public.check_invoice_charge(uuid,bigint,text)') is null as absent_cc18_charge_check,
  to_regclass('public.payment_attempts_provider_order_unique') is null  as absent_05_unique_index;

\echo '== P4 auth.uid() binding required by F1 (expect definition reads request.jwt.claim.sub FIRST, and bound_uid = the test UUID)'
select pg_get_functiondef('auth.uid()'::regprocedure) as auth_uid_definition;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000f1', true) as bound_claim,
       auth.uid() as bound_uid;   -- expect 00000000-0000-4000-8000-0000000000f1 (transaction-local; rolled back)

\echo '== P5 reserved AI runs (expect reserved_runs = 0; otherwise quiesce before migration)'
select count(*) filter (where status = 'reserved') as reserved_runs,
       count(*) as total_runs
from public.ai_generation_runs;

\echo '== P6-P8 duplicate operational identifiers — COUNTS ONLY, never the identifiers (expect all 0)'
select
  (select count(*) from (select 1 from public.payment_attempts where provider_order_id is not null
                         group by provider, provider_order_id having count(*) > 1) d) as duplicate_payment_order_groups,
  (select count(*) from (select 1 from public.signature_requests where provider_request_id is not null
                         group by provider, provider_request_id having count(*) > 1) d) as duplicate_signature_request_groups,
  (select count(*) from (select 1 from public.stamp_requests where provider_request_id is not null
                         group by provider, provider_request_id having count(*) > 1) d) as duplicate_stamp_request_groups;

\echo '== P9 definer ownership (expect non_postgres_definers = 0) and extensions (expect pgcrypto and pg_trgm present; note schema)'
select count(*) as non_postgres_definers
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef and pg_get_userbyid(p.proowner) <> 'postgres';
select extname, extnamespace::regnamespace as schema from pg_extension where extname in ('pgcrypto', 'pg_trgm') order by 1;

\echo '== P10 private result buckets (expect two rows with public = f before integration tests; zero rows means create them later, privately)'
select id, public from storage.buckets where id in ('signed-agreements', 'stamped-agreements') order by id;

\echo '== P11 billing tax configuration — booleans only, GSTIN never printed'
select gst_registered,
       gstin is not null and length(trim(gstin)) > 0                                   as gstin_present,
       coalesce(upper(trim(gstin)) ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$', false) as gstin_well_formed,
       default_tax_rate_bps,
       case when not gst_registered then 'not registered: Verified = 199900 with 0 tax'
            when gstin is null or default_tax_rate_bps is null or default_tax_rate_bps not between 1 and 2800
              then 'INCOMPLETE: CC-18 will block checkout until fixed'
            else 'registered and complete' end                                          as cc18_assessment
from public.billing_settings where id = 1;
select count(*) as billing_settings_rows from public.billing_settings;   -- expect 1

\echo '== P12 Nextwise Verified catalogue (expect active plan, latest published version 199900 INR; tax_status must be tax_inclusive if GST is registered)'
select p.is_active, v.version_number, v.status, v.currency, v.amount_minor_units, v.tax_status
from public.pricing_plans p
left join lateral (select * from public.pricing_plan_versions x where x.plan_id = p.id and x.status = 'published'
                   order by x.version_number desc limit 1) v on true
where p.slug = 'nextwise-verified';

\echo '== P13 existing unpaid Verified invoices whose total is not 199900 (expect 0; each one needs finance review/void before checkout)'
select count(*) as unpaid_verified_invoices_not_1999
from public.invoices i join public.pricing_plans p on p.id = i.pricing_plan_id
where p.slug = 'nextwise-verified' and i.status in ('issued', 'partially_paid', 'overdue') and i.total_minor_units <> 199900;

rollback;
\echo '== Preflight complete. Transaction rolled back; nothing was written.'
