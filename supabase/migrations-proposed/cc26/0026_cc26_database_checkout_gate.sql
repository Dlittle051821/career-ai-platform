-- ============================================================================
-- CC-26 0026 — Database-enforced checkout gate (payments stay OFF)
--
-- STATUS: PROPOSED. Not applied to QA or production. Needs explicit approval
-- (payments domain — approve separately from 0023/0024/0025).
--
-- DEFECT (P1, found in CC-25 suite P, confirmed in CC-26):
--   Paid checkout is "paused" only in the Next.js server action
--   (isPaidCheckoutEnabled()). The database does not know about the pause.
--   Any signed-in student can call the RPC public.purchase_pricing_plan()
--   directly through the Supabase API (no app involved) and the database
--   will, while payments are supposed to be off:
--     - issue a real invoice for the plan (₹1,999 Verified, or any active plan),
--       consuming the next number of the gap-free GST invoice series;
--     - write a pricing_purchases row (the purchase snapshot);
--     - count a redemption against any limited offer used.
--   Students can also insert payment_attempts rows on their own invoices
--   directly (0005 policy) with any amount and order id — the attempt-forgery
--   path NW-F01 05 fixes, still unapplied.
--   No money can move (no gateway order is created), but the invoice ledger
--   and offer counters can be polluted and the forgery precondition exists.
--
-- FIX
--   public.payment_launch_controls: one row, CLOSED by default. No client
--   role has any privilege on it and it has no RLS policy, so neither students
--   nor admins can open it through the API. Opening it is a deliberate SQL
--   change by the database owner after payment approval (see ACTIVATION).
--   BEFORE INSERT triggers on invoices and payment_attempts refuse a
--   student's self-checkout write while the gate is closed:
--     - invoices: when pricing_plan_id is set (self-checkout invoices) and the
--       caller is a signed-in user who is not super_admin/admin/finance;
--     - payment_attempts: any insert by a signed-in user who is not
--       super_admin/admin/finance.
--   The exception rolls back the whole RPC transaction, so the invoice
--   number, purchase snapshot and offer redemption are all undone.
--   Triggers (not a change to purchase_pricing_plan) so that the pending
--   NW01 "create or replace" of that function cannot remove the gate.
--
-- UNCHANGED: admin/finance invoice and attempt creation; server-side
-- service-role work (no user JWT); webhooks; refunds; every existing row.
--
-- ACTIVATION (NOT AUTHORIZED — payments must stay off): only after NW01, NW-F01
-- 05 and 06 are applied and verified, Razorpay test-mode checks pass and the
-- launch is approved in writing:
--   update public.payment_launch_controls
--      set student_self_checkout_enabled = true, changed_at = now(),
--          change_reference = '<written approval reference>'
--    where id = 1;
-- and set the app's paid-checkout flag. Closing again is the same statement
-- with false.
--
-- APPLY (QA only, after approval):
--   select set_config('nextwise.cc26_0026_approval', 'APPROVED-QA-ynwzijulzksmrcwdhudv', false);
--   then run this whole file in ONE execution (atomic, re-runnable).
-- ROLLBACK: 0026_cc26_ROLLBACK.sql
-- ============================================================================

begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $pre$
begin
  if coalesce(current_setting('nextwise.cc26_0026_approval', true), '')
     not in ('APPROVED-QA-ynwzijulzksmrcwdhudv', 'LOCAL-DISPOSABLE-TEST') then
    raise exception 'CC26-0026 refused: set nextwise.cc26_0026_approval to the approved value first. Production is never an approved target.';
  end if;
  if to_regclass('public.invoices') is null
     or to_regclass('public.payment_attempts') is null
     or to_regprocedure('public.purchase_pricing_plan(uuid,uuid,text)') is null
     or to_regprocedure('public.is_admin_role(text[])') is null then
    raise exception 'CC26-0026 refused: migrations 0005/0007 objects are missing.';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public'
                 and table_name = 'invoices' and column_name = 'pricing_plan_id') then
    raise exception 'CC26-0026 refused: invoices.pricing_plan_id is missing (0007).';
  end if;
end
$pre$;

create table if not exists public.payment_launch_controls (
  id smallint primary key default 1 constraint payment_launch_controls_single_row check (id = 1),
  student_self_checkout_enabled boolean not null default false,
  changed_at timestamptz not null default now(),
  change_reference text
);

comment on table public.payment_launch_controls is
  'CC-26 — database-side launch switch for student self-checkout. One row. CLOSED (false) by default. No client role has any privilege and there is no RLS policy, so it can only be changed by the database owner with an approved SQL statement (see 0026 ACTIVATION).';

insert into public.payment_launch_controls (id, student_self_checkout_enabled, change_reference)
values (1, false, 'CC-26 0026 initial state: closed')
on conflict (id) do nothing;

alter table public.payment_launch_controls enable row level security;
revoke all on table public.payment_launch_controls from public, anon, authenticated, service_role;

create or replace function public.student_self_checkout_open_cc26()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, pg_temp
as $fn$
  select coalesce((select c.student_self_checkout_enabled from public.payment_launch_controls c where c.id = 1), false);
$fn$;

comment on function public.student_self_checkout_open_cc26() is
  'CC-26 — true only when the owner has opened student self-checkout in payment_launch_controls. Missing row = closed.';

create or replace function public.invoices_self_checkout_gate_cc26()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $fn$
begin
  if new.pricing_plan_id is null                         -- not a self-checkout invoice
     or auth.uid() is null                                -- server / owner context, no user JWT
     or public.is_admin_role(array['super_admin', 'admin', 'finance'])
     or public.student_self_checkout_open_cc26() then
    return new;
  end if;
  raise exception 'Online checkout is not open yet. You have not been charged.' using errcode = '42501';
end
$fn$;

comment on function public.invoices_self_checkout_gate_cc26() is
  'CC-26 — BEFORE INSERT on invoices: refuses a self-checkout invoice (pricing_plan_id set) created by a signed-in non-finance user while student self-checkout is closed.';

create or replace function public.payment_attempts_self_checkout_gate_cc26()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $fn$
begin
  if auth.uid() is null
     or public.is_admin_role(array['super_admin', 'admin', 'finance'])
     or public.student_self_checkout_open_cc26() then
    return new;
  end if;
  raise exception 'Online payment is not open yet. You have not been charged.' using errcode = '42501';
end
$fn$;

comment on function public.payment_attempts_self_checkout_gate_cc26() is
  'CC-26 — BEFORE INSERT on payment_attempts: refuses attempts created by a signed-in non-finance user while student self-checkout is closed.';

drop trigger if exists invoices_self_checkout_gate_cc26 on public.invoices;
create trigger invoices_self_checkout_gate_cc26
  before insert on public.invoices
  for each row execute function public.invoices_self_checkout_gate_cc26();

drop trigger if exists payment_attempts_self_checkout_gate_cc26 on public.payment_attempts;
create trigger payment_attempts_self_checkout_gate_cc26
  before insert on public.payment_attempts
  for each row execute function public.payment_attempts_self_checkout_gate_cc26();

revoke all on function public.student_self_checkout_open_cc26() from public, anon, authenticated, service_role;
revoke all on function public.invoices_self_checkout_gate_cc26() from public, anon, authenticated, service_role;
revoke all on function public.payment_attempts_self_checkout_gate_cc26() from public, anon, authenticated, service_role;

do $post$
declare
  v_fn text;
begin
  if (select count(*) from pg_trigger where not tgisinternal and tgenabled = 'O'
      and tgname in ('invoices_self_checkout_gate_cc26', 'payment_attempts_self_checkout_gate_cc26')) <> 2 then
    raise exception 'CC26-0026 postcondition: gate triggers missing or disabled';
  end if;
  if exists (select 1 from public.payment_launch_controls where id = 1 and student_self_checkout_enabled)
     and coalesce(current_setting('nextwise.cc26_0026_allow_open_gate', true), '') <> 'yes' then
    raise exception 'CC26-0026 postcondition: the checkout gate is OPEN; 0026 must leave it closed';
  end if;
  foreach v_fn in array array['public.student_self_checkout_open_cc26()',
                              'public.invoices_self_checkout_gate_cc26()',
                              'public.payment_attempts_self_checkout_gate_cc26()'] loop
    if has_function_privilege('anon', v_fn, 'execute') or has_function_privilege('authenticated', v_fn, 'execute') then
      raise exception 'CC26-0026 postcondition: a client role can execute %', v_fn;
    end if;
  end loop;
  if has_table_privilege('anon', 'public.payment_launch_controls', 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated', 'public.payment_launch_controls', 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'CC26-0026 postcondition: a client role has privileges on payment_launch_controls';
  end if;
end
$post$;

notify pgrst, 'reload schema';

commit;
