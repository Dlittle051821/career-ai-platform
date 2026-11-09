-- PROPOSED - DO NOT APPLY. Requires separate written approval and completed security gates (see docs/stabilization/nw-f01-s3/CC-15-REVIEW.md).
-- REVIEW ONLY. NOT APPLIED. Outside the normal migration pipeline.
-- Target approval is QA ynwzijulzksmrcwdhudv only. Never use a linked default.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
do $$ begin
  if current_user <> 'postgres' then raise exception 'Reviewed migration owner must be postgres'; end if;
end $$;


do $$
begin
 if not has_table_privilege('service_role','public.admin_audit_log','INSERT')
 or not has_table_privilege('service_role','public.signature_requests','SELECT,UPDATE')
 or not has_table_privilege('service_role','public.stamp_requests','SELECT,UPDATE')
 or not has_table_privilege('service_role','storage.objects','SELECT') then
   raise exception 'Trusted capture service table privileges require separate review';
 end if;
end $$;

-- Internal definer callers run as postgres; direct server calls use service_role.
-- INVOKER is intentional: checking current_user inside a DEFINER would be useless.
create or replace function public.record_system_audit_log(
 p_action text, p_entity_type text, p_entity_id text, p_summary text,
 p_changes jsonb default null, p_context jsonb default null
) returns uuid language plpgsql security invoker
set search_path = pg_catalog, public, pg_temp
as $$
declare v_id uuid;
begin
 if current_user not in ('postgres','service_role') then
   raise exception 'Internal audit execution required' using errcode='42501';
 end if;
 insert into public.admin_audit_log(actor_user_id,actor_role,action,entity_type,entity_id,summary,changes,context)
 values(null,'system',p_action,p_entity_type,p_entity_id,p_summary,p_changes,p_context) returning id into v_id;
 return v_id;
end;
$$;
revoke all on function public.record_system_audit_log(text,text,text,text,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.record_system_audit_log(text,text,text,text,jsonb,jsonb) to service_role;

create or replace function public.set_signature_document_path(p_provider text,p_provider_request_id text,p_storage_path text)
returns jsonb language plpgsql security invoker
set search_path = pg_catalog, public, pg_temp
as $$
declare v_row public.signature_requests; v_prefix text; v_filename text;
begin
 if current_user not in ('postgres','service_role') then
   raise exception 'Trusted document capture required' using errcode='42501';
 end if;
 if p_provider is null or p_provider_request_id is null or p_storage_path is null then
   raise exception 'Missing document capture parameters';
 end if;
 select * into v_row from public.signature_requests
 where provider=p_provider and provider_request_id=p_provider_request_id for update;
 if not found or v_row.status <> 'signed' then raise exception 'No completed provider request'; end if;
 v_prefix := v_row.agreement_id::text || '/' || v_row.id::text || '/';
 v_filename := substr(p_storage_path,length(v_prefix)+1);
 if left(p_storage_path,length(v_prefix)) <> v_prefix
    or v_filename !~ '^[A-Za-z0-9_][A-Za-z0-9._-]{0,199}$'
    or v_filename in ('.','..') then
   raise exception 'Document path does not belong to this request';
 end if;
 if v_row.signed_document_storage_path is not null and v_row.signed_document_storage_path <> p_storage_path then
   raise exception 'Captured document path is immutable';
 end if;
 if not exists(select 1 from storage.objects where bucket_id='signed-agreements' and name=p_storage_path) then
   raise exception 'Captured object must exist in the private bucket';
 end if;
 update public.signature_requests set signed_document_storage_path=p_storage_path where id=v_row.id;
 return jsonb_build_object('signature_request_id',v_row.id);
end;
$$;
revoke all on function public.set_signature_document_path(text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.set_signature_document_path(text,text,text) to service_role;

create or replace function public.set_stamp_document_path(p_provider text,p_provider_request_id text,p_storage_path text)
returns jsonb language plpgsql security invoker
set search_path = pg_catalog, public, pg_temp
as $$
declare v_row public.stamp_requests; v_prefix text; v_filename text;
begin
 if current_user not in ('postgres','service_role') then
   raise exception 'Trusted document capture required' using errcode='42501';
 end if;
 if p_provider is null or p_provider_request_id is null or p_storage_path is null then
   raise exception 'Missing document capture parameters';
 end if;
 select * into v_row from public.stamp_requests
 where provider=p_provider and provider_request_id=p_provider_request_id for update;
 if not found or v_row.status <> 'completed' then raise exception 'No completed provider request'; end if;
 v_prefix := v_row.agreement_id::text || '/' || v_row.id::text || '/';
 v_filename := substr(p_storage_path,length(v_prefix)+1);
 if left(p_storage_path,length(v_prefix)) <> v_prefix
    or v_filename !~ '^[A-Za-z0-9_][A-Za-z0-9._-]{0,199}$'
    or v_filename in ('.','..') then
   raise exception 'Document path does not belong to this request';
 end if;
 if v_row.stamped_document_storage_path is not null and v_row.stamped_document_storage_path <> p_storage_path then
   raise exception 'Captured document path is immutable';
 end if;
 if not exists(select 1 from storage.objects where bucket_id='stamped-agreements' and name=p_storage_path) then
   raise exception 'Captured object must exist in the private bucket';
 end if;
 update public.stamp_requests set stamped_document_storage_path=p_storage_path where id=v_row.id;
 return jsonb_build_object('stamp_request_id',v_row.id);
end;
$$;
revoke all on function public.set_stamp_document_path(text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.set_stamp_document_path(text,text,text) to service_role;

-- CC-15 (independent review F3): enforce document-path and provider-ID
-- integrity for EVERY writer, including admins with table UPDATE through RLS.
-- A captured path is canonical (<agreement>/<request>/<file>), points at an
-- existing private-bucket object and is write-once. A provider request ID may
-- be set once (null -> value) and never changed. Duplicates fail closed.
do $$ begin
 if exists(select 1 from public.signature_requests where provider_request_id is not null
           group by provider, provider_request_id having count(*) > 1)
 or exists(select 1 from public.stamp_requests where provider_request_id is not null
           group by provider, provider_request_id having count(*) > 1) then
   raise exception 'Resolve duplicate provider request IDs before migration';
 end if;
end $$;
create unique index if not exists signature_requests_provider_request_unique
 on public.signature_requests (provider, provider_request_id) where provider_request_id is not null;
create unique index if not exists stamp_requests_provider_request_unique
 on public.stamp_requests (provider, provider_request_id) where provider_request_id is not null;

create schema if not exists nextwise_security authorization postgres;
revoke all on schema nextwise_security from public, anon, authenticated, service_role;
-- SECURITY INVOKER on purpose: current_user must be the real writer's role.
create or replace function nextwise_security.guard_document_capture()
returns trigger language plpgsql security invoker
set search_path = pg_catalog, public, pg_temp as $$
declare v_old text; v_new text; v_bucket text; v_done text; v_prefix text; v_file text; v_bound boolean;
begin
 -- Branches (not AND/OR) so each table only ever evaluates its own columns.
 if tg_table_name = 'signature_requests' then
   v_bucket := 'signed-agreements'; v_done := 'signed';
   if tg_op <> 'DELETE' then v_new := new.signed_document_storage_path; end if;
   if tg_op <> 'INSERT' then v_old := old.signed_document_storage_path; end if;
 else
   v_bucket := 'stamped-agreements'; v_done := 'completed';
   if tg_op <> 'DELETE' then v_new := new.stamped_document_storage_path; end if;
   if tg_op <> 'INSERT' then v_old := old.stamped_document_storage_path; end if;
 end if;

 if tg_op = 'INSERT' then
   if v_new is not null then
     raise exception 'A document path can only be captured after completion' using errcode = '42501';
   end if;
   return new;
 end if;

 if tg_op = 'DELETE' then
   -- A captured record cannot be deleted directly (re-review D4). Deleting the
   -- parent agreement still cascades: that is a deliberate parent-level decision.
   if v_old is not null and pg_trigger_depth() <= 1 then
     raise exception 'A request with a captured document cannot be deleted directly' using errcode = '42501';
   end if;
   return old;
 end if;

 -- UPDATE
 if new.id is distinct from old.id then
   raise exception 'Request id is immutable' using errcode = '42501';
 end if;
 if old.provider_request_id is not null and new.provider_request_id is distinct from old.provider_request_id then
   raise exception 'Provider request ID is immutable once set' using errcode = '42501';
 end if;
 -- Once bound to a provider request or a captured document, the request's
 -- identity cannot be re-pointed (re-review D1). A deleted signer account may
 -- still clear signer_user_id (FK ON DELETE SET NULL).
 v_bound := old.provider_request_id is not null or v_old is not null;
 if v_bound then
   if new.provider is distinct from old.provider or new.agreement_id is distinct from old.agreement_id
      or new.agreement_version_id is distinct from old.agreement_version_id then
     raise exception 'A bound request cannot be moved to another provider, agreement or version' using errcode = '42501';
   end if;
   if tg_table_name = 'signature_requests' then
     if new.signer_name is distinct from old.signer_name or new.signer_email is distinct from old.signer_email
        or (new.signer_user_id is distinct from old.signer_user_id and new.signer_user_id is not null) then
       raise exception 'A bound signature request cannot change its signer' using errcode = '42501';
     end if;
   else
     -- The stamp's legal terms are part of what the provider request certifies (re-review N2).
     if new.stamp_value is distinct from old.stamp_value or new.currency is distinct from old.currency
        or new.state is distinct from old.state or new.jurisdiction is distinct from old.jurisdiction
        or new.document_type is distinct from old.document_type then
       raise exception 'A bound stamp request cannot change its stamp terms' using errcode = '42501';
     end if;
   end if;
 end if;
 if v_old is not null then
   if v_new is distinct from v_old then
     raise exception 'Captured document path is immutable' using errcode = '42501';
   end if;
   if new.status is distinct from old.status then
     raise exception 'A request with a captured document cannot change status' using errcode = '42501';
   end if;
   -- Outside the trusted server roles, a captured record is fully read-only,
   -- including its evidence timestamps and provider metadata (re-review N3).
   -- A deleted signer account may still clear signer_user_id.
   if current_user not in ('postgres', 'service_role')
      and (to_jsonb(new) - 'updated_at' - 'signer_user_id') is distinct from (to_jsonb(old) - 'updated_at' - 'signer_user_id') then
     raise exception 'A request with a captured document is read-only' using errcode = '42501';
   end if;
   return new;
 end if;
 if v_new is null then return new; end if;

 -- New capture: only the trusted capture path (definer RPC owned by postgres,
 -- or the service role), only after completion, canonical and existing (D2).
 if current_user not in ('postgres', 'service_role') then
   raise exception 'Documents can only be captured by the trusted capture service' using errcode = '42501';
 end if;
 if new.status is distinct from v_done then
   raise exception 'A document path can only be captured after completion' using errcode = '42501';
 end if;
 v_prefix := new.agreement_id::text || '/' || new.id::text || '/';
 v_file := substr(v_new, length(v_prefix) + 1);
 if left(v_new, length(v_prefix)) <> v_prefix or v_file !~ '^[A-Za-z0-9_][A-Za-z0-9._-]{0,199}$' then
   raise exception 'Document path does not belong to this request' using errcode = '42501';
 end if;
 if not exists(select 1 from storage.objects where bucket_id = v_bucket and name = v_new) then
   raise exception 'Captured object must exist in the private bucket' using errcode = '42501';
 end if;
 return new;
end;
$$;
revoke all on function nextwise_security.guard_document_capture() from public, anon, authenticated, service_role;
drop trigger if exists nw_f01_guard_signature_capture on public.signature_requests;
create trigger nw_f01_guard_signature_capture before insert or update or delete on public.signature_requests
 for each row execute function nextwise_security.guard_document_capture();
drop trigger if exists nw_f01_guard_stamp_capture on public.stamp_requests;
create trigger nw_f01_guard_stamp_capture before insert or update or delete on public.stamp_requests
 for each row execute function nextwise_security.guard_document_capture();
revoke truncate on public.signature_requests, public.stamp_requests from service_role;
-- Only the server-side capture (service role) uploads into the private result
-- buckets; admins never upload a "signed"/"stamped" result by hand (D2).
drop policy if exists "super_admin/admin can upload signed agreement documents" on storage.objects;
drop policy if exists "super_admin/admin can upload stamped agreement documents" on storage.objects;

-- Reject inherited exposure too, rather than silently assuming REVOKE was enough.
do $$
declare s text;
begin
 foreach s in array array[
 'public.record_system_audit_log(text,text,text,text,jsonb,jsonb)',
 'public.set_signature_document_path(text,text,text)',
 'public.set_stamp_document_path(text,text,text)'
 ] loop
   if has_function_privilege('anon',s,'execute') or has_function_privilege('authenticated',s,'execute') then
     raise exception 'Inherited client execution remains on %',s;
   end if;
 end loop;
end $$;
commit;
