-- ============================================================================
-- ROLLBACK for 0026_cc26_database_checkout_gate.sql
--
-- Removes the two gate triggers, their functions and payment_launch_controls.
-- CONSEQUENCE: the paused checkout is again enforced ONLY by the Next.js server
-- action; a direct purchase_pricing_plan() call can issue unpaid invoices and
-- students can insert payment_attempts directly. Payments must stay off.
--
-- APPLY: select set_config('nextwise.cc26_0026_rollback', 'APPROVED-QA-ynwzijulzksmrcwdhudv', false);
--        then run this whole file in ONE execution. Atomic and re-runnable.
-- ============================================================================

begin;
set local lock_timeout = '5s';

do $pre$
begin
  if coalesce(current_setting('nextwise.cc26_0026_rollback', true), '')
     not in ('APPROVED-QA-ynwzijulzksmrcwdhudv', 'LOCAL-DISPOSABLE-TEST') then
    raise exception 'CC26-0026 rollback refused: set nextwise.cc26_0026_rollback to the approved value first.';
  end if;
end
$pre$;

drop trigger if exists invoices_self_checkout_gate_cc26 on public.invoices;
drop trigger if exists payment_attempts_self_checkout_gate_cc26 on public.payment_attempts;
drop function if exists public.invoices_self_checkout_gate_cc26();
drop function if exists public.payment_attempts_self_checkout_gate_cc26();
drop function if exists public.student_self_checkout_open_cc26();
drop table if exists public.payment_launch_controls;

notify pgrst, 'reload schema';

commit;
