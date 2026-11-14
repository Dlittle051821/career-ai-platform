-- ============================================================================
-- V5.6.2 PUBLIC LAUNCH — production application of CC-25 0024
-- (revoke the public key's EXECUTE on three internal functions).
--
-- NOT APPLIED. Run only after ALL of these, in this order:
--   1. the read-only inspection (v562_prod_inspection_readonly.sql) shows DB-1 FAIL
--      for exactly these three functions;
--   2. a production backup taken and confirmed restorable;
--   3. the owner's separate written approval for THIS file (SHA-256 in the runbook).
--
-- Same statements as supabase/migrations-proposed/cc25/0024_cc25_revoke_anon_internal_rpcs.sql
-- (tested in CC-25: 89/89, rollback exact). That file refuses production by design;
-- this one accepts ONLY the production approval value below, and refuses on any drift.
--
-- What it changes: three GRANTs. It changes no data, table, policy or function body.
-- The website never calls these functions with the public key; the server calls them
-- with the service role, which keeps EXECUTE.
-- Rollback: v562_prod_0024_ROLLBACK.sql restores the exact earlier grants.
--
-- To run (SQL editor, production, as postgres), first execute, in the same session:
--   set nextwise.v562_prod_0024_approval = 'APPROVED-PROD-bwlkxunujngksibfzzfv-V562-0024';
-- ============================================================================
begin;
set local lock_timeout = '5s';
do $pre$
declare
  v_expected_acl constant text := '{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}';
  r record;
begin
  if coalesce(current_setting('nextwise.v562_prod_0024_approval', true), '') <> 'APPROVED-PROD-bwlkxunujngksibfzzfv-V562-0024' then
    raise exception 'V562-0024 refused: set nextwise.v562_prod_0024_approval to the approved value first.';
  end if;
  for r in
    select v.sig, v.md5, p.oid, md5(replace(p.prosrc, chr(13), '')) as body, coalesce(p.proacl::text, '(default)') as acl, pg_get_userbyid(p.proowner) as owner
    from (values
      ('public.record_system_audit_log(text,text,text,text,jsonb,jsonb)', 'b65ec656dd3b67dcb89e751d96675f0c'),
      ('public.set_signature_document_path(text,text,text)', '5d2c39a74d7c7649e0eaf7f0e5efe818'),
      ('public.set_stamp_document_path(text,text,text)', 'ac7cccdb43a36d8c65b1c3153c616d94')
    ) v(sig, md5)
    left join pg_proc p on p.oid = to_regprocedure(v.sig)
  loop
    if r.oid is null then raise exception 'V562-0024 refused (drift): % is missing.', r.sig; end if;
    if r.body <> r.md5 then raise exception 'V562-0024 refused (drift): % body is %, expected %.', r.sig, r.body, r.md5; end if;
    if r.acl <> v_expected_acl then raise exception 'V562-0024 refused (drift): % grants are %, expected %.', r.sig, r.acl, v_expected_acl; end if;
    if r.owner <> 'postgres' then raise exception 'V562-0024 refused (drift): % owner is %.', r.sig, r.owner; end if;
  end loop;
end
$pre$;
revoke execute on function public.record_system_audit_log(text,text,text,text,jsonb,jsonb) from public, anon, authenticated;
revoke execute on function public.set_signature_document_path(text,text,text) from public, anon, authenticated;
revoke execute on function public.set_stamp_document_path(text,text,text) from public, anon, authenticated;
grant execute on function public.record_system_audit_log(text,text,text,text,jsonb,jsonb) to service_role;
grant execute on function public.set_signature_document_path(text,text,text) to service_role;
grant execute on function public.set_stamp_document_path(text,text,text) to service_role;
do $post$
declare v_fn text; v_role text;
begin
  foreach v_fn in array array['public.record_system_audit_log(text,text,text,text,jsonb,jsonb)','public.set_signature_document_path(text,text,text)','public.set_stamp_document_path(text,text,text)'] loop
    foreach v_role in array array['anon','authenticated'] loop
      if has_function_privilege(v_role, v_fn, 'execute') then
        raise exception 'V562-0024 postcondition: % can still execute %', v_role, v_fn;
      end if;
    end loop;
    if not has_function_privilege('service_role', v_fn, 'execute') then
      raise exception 'V562-0024 postcondition: service_role lost execute on %', v_fn;
    end if;
  end loop;
end
$post$;
notify pgrst, 'reload schema';
commit;
