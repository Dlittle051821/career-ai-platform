-- Local-only QA seed for the disposable stack. Idempotent.
insert into public.admin_roles (user_id, role) select id, 'super_admin' from auth.users where email='admin@qa.nextwise.test' on conflict do nothing;
insert into public.admin_roles (user_id, role) select id, 'counsellor' from auth.users where email='counsellor@qa.nextwise.test' on conflict do nothing;
insert into public.admin_roles (user_id, role) select id, 'content_editor' from auth.users where email='editor@qa.nextwise.test' on conflict do nothing;

insert into public.pricing_plans (slug, category, internal_name, is_active)
values ('nextwise-verified', 'school_counselling', 'Nextwise Verified', true) on conflict (slug) do nothing;

do $$
declare v_plan uuid; v_inv uuid; r record;
begin
  select id into v_plan from public.pricing_plans where slug='nextwise-verified';
  for r in select * from (values ('verified@qa.nextwise.test','paid'), ('pending@qa.nextwise.test','issued'), ('failed@qa.nextwise.test','issued')) as t(email, st) loop
    if not exists (select 1 from public.pricing_purchases pp join auth.users u on u.id=pp.student_user_id where u.email=r.email) then
      insert into public.invoices (invoice_number, issued_at, student_user_id, status, currency, subtotal_minor_units, total_minor_units, pricing_plan_id, issue_date, paid_at)
        select 'QA-' || substr(r.email,1,4) || '-001', now(), id, r.st, 'INR', 199900, 199900, v_plan, current_date, case when r.st='paid' then now() end from auth.users where email=r.email returning id into v_inv;
      insert into public.pricing_purchases (student_user_id, plan_id, plan_name_at_purchase, original_amount_minor_units, final_amount_minor_units, currency, invoice_id)
        select id, v_plan, 'Nextwise Verified', 199900, 199900, 'INR', v_inv from auth.users where email=r.email;
      if r.email like 'failed%' then
        insert into public.payment_attempts (invoice_id, idempotency_key, status, amount_minor_units) values (v_inv, 'qa-failed-1', 'failed', 199900);
      end if;
    end if;
  end loop;
end $$;
