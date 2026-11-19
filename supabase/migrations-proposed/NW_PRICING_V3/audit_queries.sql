-- NW-PRICING-V3 — read-only audit queries. Run in the Supabase SQL editor (as an admin)
-- BEFORE and AFTER 0001, and keep both outputs with the release record.

-- A. Catalogue: every plan, its live version, price, tax status, and whether it is public
select p.slug, p.category, p.is_active, p.is_recommended, p.display_order,
       v.version_number, v.status as version_status, v.amount_minor_units, v.tax_status
from public.pricing_plans p
left join public.pricing_plan_versions v on v.id = p.current_version_id
order by p.is_active desc, p.display_order, p.slug;

-- B. References per plan: who would be affected by retiring it
select p.slug, p.is_active,
       (select count(*) from public.pricing_purchases pp where pp.plan_id = p.id) as purchases,
       (select count(*) from public.pricing_purchases pp join public.invoices i on i.id = pp.invoice_id where pp.plan_id = p.id and i.status = 'paid') as paid_purchases,
       (select count(*) from public.invoices i where i.pricing_plan_id = p.id) as invoices,
       (select count(*) from public.pricing_offers o where o.plan_id = p.id) as offers,
       (select count(*) from public.pricing_analytics_events e where e.plan_id = p.id) as analytics_events
from public.pricing_plans p
order by purchases desc, p.slug;

-- C. Open invoices on plans that will be retired (these stay payable through the existing flow)
select i.invoice_number, i.status, i.total_minor_units, p.slug
from public.invoices i join public.pricing_purchases pp on pp.invoice_id = i.id join public.pricing_plans p on p.id = pp.plan_id
where i.status in ('issued', 'partially_paid', 'overdue')
  and p.slug not in ('nextwise-verified', 'study-abroad-lite', 'study-abroad-premium');

-- D. Integrity after 0001: no purchase or invoice lost its plan
select count(*) as purchases_without_plan from public.pricing_purchases where plan_id is null;
select count(*) as invoices_with_missing_plan from public.invoices i
where i.pricing_plan_id is not null and not exists (select 1 from public.pricing_plans p where p.id = i.pricing_plan_id);

-- E. Exactly three active plans, at the approved prices, with the add-on configured
select p.slug, v.amount_minor_units, a.included_quantity, a.unit_amount_minor_units, a.max_additional_quantity
from public.pricing_plans p
join public.pricing_plan_versions v on v.id = p.current_version_id
left join public.pricing_plan_addons a on a.plan_version_id = v.id and a.addon_key = 'additional_university'
where p.is_active order by p.display_order;

-- F. Before vs after
select s.slug, s.was_active, p.is_active as now_active
from public.pricing_v3_catalogue_snapshot s join public.pricing_plans p on p.id = s.plan_id
order by s.slug;
