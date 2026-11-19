-- ============================================================================
-- NW-PRICING-V3 / 0001 ROLLBACK — PROPOSED. Restores the catalogue's active and
-- recommended flags exactly as they were before 0001 (from pricing_v3_catalogue_snapshot).
--
-- Deliberately NOT undone, because rows may already reference them and nothing is
-- ever deleted:
--   * study-abroad-lite / study-abroad-premium rows are kept but retired (inactive);
--   * the new Nextwise Verified version stays published (same ₹1,999 and tax_status;
--     published versions are immutable and an archived version cannot be re-published
--     by design). Its predecessor stays archived with all its purchases intact;
--   * pricing_plan_addons, pricing_quotes, create_pricing_quote() and the
--     "Students can read plans/versions they purchased" policies stay. They are inert
--     without active V3 plans; the policies only ever widen a student's view to rows
--     they already bought. Drop them by hand only if no quote exists.
-- Run the application's previous release together with this rollback.
-- ============================================================================
begin;
do $$
begin
  if not exists (select 1 from public.pricing_v3_catalogue_snapshot) then
    raise exception 'No pre-V3 snapshot found; nothing to roll back.';
  end if;
end $$;

update public.pricing_plans p
set is_active = s.was_active, is_recommended = s.was_recommended
from public.pricing_v3_catalogue_snapshot s
where s.plan_id = p.id;

update public.pricing_plans set is_active = false, is_recommended = false
where slug in ('study-abroad-lite', 'study-abroad-premium')
  and id not in (select plan_id from public.pricing_v3_catalogue_snapshot);

update public.pricing_quotes set status = 'expired' where status = 'open';
commit;
