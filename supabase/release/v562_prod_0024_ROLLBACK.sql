-- ============================================================================
-- V5.6.2 PUBLIC LAUNCH — ROLLBACK of v562_prod_0024_revoke_anon_internal_rpcs.sql.
-- Restores the exact earlier grants (anon, authenticated and service_role EXECUTE).
-- This REOPENS the CC-25 finding; use it only if the revoke broke something.
--   set nextwise.v562_prod_0024_rollback = 'APPROVED-PROD-bwlkxunujngksibfzzfv-V562-0024-ROLLBACK';
-- ============================================================================
begin;
do $pre$
begin
  if coalesce(current_setting('nextwise.v562_prod_0024_rollback', true), '') <> 'APPROVED-PROD-bwlkxunujngksibfzzfv-V562-0024-ROLLBACK' then
    raise exception 'V562-0024 rollback refused: set nextwise.v562_prod_0024_rollback to the approved value first.';
  end if;
end
$pre$;
-- Revoke first, then grant in the original order, so the ACL matches the recorded original exactly.
revoke all on function public.record_system_audit_log(text,text,text,text,jsonb,jsonb) from anon, authenticated, service_role;
revoke all on function public.set_signature_document_path(text,text,text) from anon, authenticated, service_role;
revoke all on function public.set_stamp_document_path(text,text,text) from anon, authenticated, service_role;
grant execute on function public.record_system_audit_log(text,text,text,text,jsonb,jsonb) to anon, authenticated, service_role;
grant execute on function public.set_signature_document_path(text,text,text) to anon, authenticated, service_role;
grant execute on function public.set_stamp_document_path(text,text,text) to anon, authenticated, service_role;
do $post$
declare v_fn text;
begin
  foreach v_fn in array array['public.record_system_audit_log(text,text,text,text,jsonb,jsonb)','public.set_signature_document_path(text,text,text)','public.set_stamp_document_path(text,text,text)'] loop
    if (select coalesce(proacl::text, '') from pg_proc where oid = to_regprocedure(v_fn))
       <> '{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}' then
      raise exception 'V562-0024 rollback postcondition: % grants differ from the recorded original.', v_fn;
    end if;
  end loop;
end
$post$;
notify pgrst, 'reload schema';
commit;
