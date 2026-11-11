-- ============================================================================
-- CC-25 0024 (OPTIONAL STOPGAP) — remove anonymous/student EXECUTE from three
-- internal SECURITY DEFINER functions created in 0011/0012.
--
-- STATUS: PROPOSED. Separate approval from 0023. Not applied anywhere.
-- Superseded by supabase/migrations-proposed/nw-f01-s3/01_internal_rpcs.sql
-- (which also hardens their bodies) when that package is approved; applying
-- both is safe in either order.
--
-- DEFECT (pre-existing since 0011/0012; reproduced on the local stack in
-- CC-25, evidence/probe-anon-definer-rpcs.txt):
--   - record_system_audit_log(): any anonymous caller can write an
--     admin_audit_log row with actor_role = 'system' (forged audit trail).
--   - set_signature_document_path() / set_stamp_document_path(): any
--     anonymous caller can repoint a signed/stamped document's storage path
--     if they know the provider request id (no caller check in the body).
-- The application calls the two path functions only with the service role
-- (src/lib/storage/verified-document-path.ts) and never calls
-- record_system_audit_log directly; it is used inside owner-run webhook
-- functions, which keep working (the owner always holds EXECUTE).
--
-- APPLY (QA only, after approval):
--   select set_config('nextwise.cc25_0024_approval', 'APPROVED-QA-ynwzijulzksmrcwdhudv', false);
-- ROLLBACK: 0024_cc25_ROLLBACK.sql
-- ============================================================================
begin;
set local lock_timeout = '5s';

do $pre$
begin
  if coalesce(current_setting('nextwise.cc25_0024_approval', true), '') not in ('APPROVED-QA-ynwzijulzksmrcwdhudv', 'LOCAL-DISPOSABLE-TEST') then
    raise exception 'CC25-0024 refused: set nextwise.cc25_0024_approval to the approved value first. Production is never an approved target.';
  end if;
  if to_regprocedure('public.record_system_audit_log(text,text,text,text,jsonb,jsonb)') is null
     or to_regprocedure('public.set_signature_document_path(text,text,text)') is null
     or to_regprocedure('public.set_stamp_document_path(text,text,text)') is null then
    raise exception 'CC25-0024 refused: migrations 0011/0012 are not present.';
  end if;
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
        raise exception 'CC25-0024 postcondition: % can still execute %', v_role, v_fn;
      end if;
    end loop;
    if not has_function_privilege('service_role', v_fn, 'execute') then
      raise exception 'CC25-0024 postcondition: service_role lost EXECUTE on %', v_fn;
    end if;
  end loop;
end
$post$;

notify pgrst, 'reload schema';
commit;
