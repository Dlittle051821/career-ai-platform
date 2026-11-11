-- ROLLBACK for 0024_cc25_revoke_anon_internal_rpcs.sql: restores the 0011/0012
-- grants (anon and authenticated may execute again). This re-opens the defect.
-- APPLY: select set_config('nextwise.cc25_0024_rollback', 'APPROVED-QA-ynwzijulzksmrcwdhudv', false);
begin;
do $pre$
begin
  if coalesce(current_setting('nextwise.cc25_0024_rollback', true), '') not in ('APPROVED-QA-ynwzijulzksmrcwdhudv', 'LOCAL-DISPOSABLE-TEST') then
    raise exception 'CC25-0024 rollback refused: set nextwise.cc25_0024_rollback to the approved value first.';
  end if;
end
$pre$;
grant execute on function public.record_system_audit_log(text,text,text,text,jsonb,jsonb) to anon, authenticated;
grant execute on function public.set_signature_document_path(text,text,text) to anon, authenticated;
grant execute on function public.set_stamp_document_path(text,text,text) to anon, authenticated;
notify pgrst, 'reload schema';
commit;
