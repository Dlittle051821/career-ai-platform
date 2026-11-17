-- UNI_V3 / 0003 rollback. Removes the two seeded portals only if they were never switched on or edited by an admin.
begin;
delete from public.external_search_providers
 where slug in ('hochschulkompass', 'study-in-germany') and active = false and verified_by is null;
commit;
