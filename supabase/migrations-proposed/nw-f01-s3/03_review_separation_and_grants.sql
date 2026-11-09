-- PROPOSED - DO NOT APPLY. Requires separate written approval and completed security gates (see docs/stabilization/nw-f01-s3/CC-15-REVIEW.md).
-- REVIEW ONLY. NOT APPLIED. Outside the normal migration pipeline.
-- Target approval is QA ynwzijulzksmrcwdhudv only. Never use a linked default.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
do $$ begin
  if current_user <> 'postgres' then raise exception 'Reviewed migration owner must be postgres'; end if;
end $$;

create or replace function public.staff_update_recommendation_draft_content(
  p_draft_id uuid,
  p_content jsonb
)
returns public.recommendation_drafts
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_draft public.recommendation_drafts;
  v_next_version integer;
  v_version public.recommendation_draft_versions;
begin
  if auth.uid() is null then raise exception 'Not signed in.' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtext('public.ai_generation_runs'));
  select * into v_draft from public.recommendation_drafts where id = p_draft_id for update;
  if v_draft.id is null then
    raise exception 'Recommendation draft not found.';
  end if;

  if not (
    public.is_admin_role(array['super_admin', 'admin'])
    or (public.is_admin_role(array['counsellor']) and public.counsellor_has_case_access(v_draft.student_user_id))
  ) then
    raise exception 'Not authorized to edit this recommendation draft.';
  end if;

  if v_draft.status not in ('draft', 'changes_requested') then
    raise exception 'Cannot edit a recommendation draft while it is "%"  — only draft or changes_requested.', v_draft.status;
  end if;

  select coalesce(max(version_number), 0) + 1 into v_next_version from public.recommendation_draft_versions where draft_id = p_draft_id;

  insert into public.recommendation_draft_versions (draft_id, version_number, content, authored_by)
  values (p_draft_id, v_next_version, coalesce(p_content, '{}'::jsonb), auth.uid())
  returning * into v_version;

  update public.recommendation_drafts set current_version_id = v_version.id where id = p_draft_id
  returning * into v_draft;

  return v_draft;
end;
$$;

create or replace function public.staff_submit_recommendation_draft_for_review(p_draft_id uuid)
returns public.recommendation_drafts
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_draft public.recommendation_drafts;
begin
  if auth.uid() is null then raise exception 'Not signed in.' using errcode='42501'; end if;
  select * into v_draft from public.recommendation_drafts where id = p_draft_id for update;
  if v_draft.id is null then
    raise exception 'Recommendation draft not found.';
  end if;

  if not (
    public.is_admin_role(array['super_admin', 'admin'])
    or (public.is_admin_role(array['counsellor']) and public.counsellor_has_case_access(v_draft.student_user_id))
  ) then
    raise exception 'Not authorized to submit this recommendation draft.';
  end if;

  if v_draft.status not in ('draft', 'changes_requested') then
    raise exception 'Cannot submit for review from status "%".', v_draft.status;
  end if;
  if v_draft.current_version_id is null then
    raise exception 'Cannot submit a recommendation draft with no authored content.';
  end if;

  update public.recommendation_drafts
    set status = 'submitted_for_review', submitted_at = now(), submitted_by = auth.uid()
    where id = p_draft_id
    returning * into v_draft;

  return v_draft;
end;
$$;

-- CC-15 (independent review F4): an approval names the exact version the
-- reviewer saw, and release requires that approved version to still be current.
alter table public.recommendation_drafts
  add column if not exists approved_version_id uuid references public.recommendation_draft_versions (id) on delete restrict;
-- Drafts already approved before this migration: bind their current version
-- (the best available evidence) so their release is not blocked.
update public.recommendation_drafts set approved_version_id = current_version_id
 where status = 'approved' and approved_version_id is null and current_version_id is not null;
drop function if exists public.staff_review_recommendation_draft(uuid, text, text);
create or replace function public.staff_review_recommendation_draft(
  p_draft_id uuid,
  p_decision text,
  p_expected_version_id uuid,
  p_review_notes text default null
)
returns public.recommendation_drafts
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_draft public.recommendation_drafts;
begin
  if auth.uid() is null then raise exception 'Not signed in.' using errcode='42501'; end if;
  if p_decision is null or p_decision not in ('approve', 'request_changes') then
    raise exception 'Invalid review decision.';
  end if;

  select * into v_draft from public.recommendation_drafts where id = p_draft_id for update;
  if v_draft.id is null then
    raise exception 'Recommendation draft not found.';
  end if;

  if v_draft.created_by = auth.uid() or exists(
    select 1 from public.recommendation_draft_versions where draft_id=p_draft_id and authored_by=auth.uid()
  ) then
    raise exception 'A recommendation draft cannot be reviewed by its own author.';
  end if;

  if not (
    public.is_admin_role(array['super_admin', 'admin'])
    or (public.is_admin_role(array['counsellor']) and public.counsellor_has_case_access(v_draft.student_user_id))
  ) then
    raise exception 'Not authorized to review this recommendation draft.';
  end if;

  if v_draft.status <> 'submitted_for_review' then
    raise exception 'Cannot review a recommendation draft from status "%" — it must be submitted_for_review.', v_draft.status;
  end if;
  if p_expected_version_id is null or v_draft.current_version_id is null
     or p_expected_version_id is distinct from v_draft.current_version_id then
    raise exception 'This draft changed since you opened it. Reload the page and review the current version.';
  end if;

  if p_decision = 'request_changes' and (p_review_notes is null or length(trim(p_review_notes)) = 0) then
    raise exception 'Review notes are required when requesting changes.';
  end if;
  if p_review_notes is not null and length(p_review_notes) > 4000 then
    raise exception 'Review notes are too long (4000 characters max).';
  end if;

  if p_decision = 'approve' then
    update public.recommendation_drafts
      set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid(),
          approved_at = now(), approved_by = auth.uid(), review_notes = p_review_notes,
          approved_version_id = v_draft.current_version_id
      where id = p_draft_id
      returning * into v_draft;
  else
    update public.recommendation_drafts
      set status = 'changes_requested', reviewed_at = now(), reviewed_by = auth.uid(), review_notes = p_review_notes,
          approved_version_id = null
      where id = p_draft_id
      returning * into v_draft;
  end if;

  return v_draft;
end;
$$;

create or replace function public.staff_release_recommendation_draft(p_draft_id uuid)
returns public.recommendation_drafts
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_draft public.recommendation_drafts;
begin
  if auth.uid() is null then raise exception 'Not signed in.' using errcode='42501'; end if;
  select * into v_draft from public.recommendation_drafts where id = p_draft_id for update;
  if v_draft.id is null then
    raise exception 'Recommendation draft not found.';
  end if;

  if not (
    public.is_admin_role(array['super_admin', 'admin'])
    or (public.is_admin_role(array['counsellor']) and public.counsellor_has_case_access(v_draft.student_user_id))
  ) then
    raise exception 'Not authorized to release this recommendation draft.';
  end if;

  if v_draft.status <> 'approved' then
    raise exception 'Cannot release a recommendation draft from status "%" — it must be approved first.', v_draft.status;
  end if;
  if v_draft.approved_version_id is null or v_draft.approved_version_id is distinct from v_draft.current_version_id then
    raise exception 'The approved version is no longer current. It must be reviewed again before release.';
  end if;

  update public.recommendation_drafts
    set status = 'released_to_student', released_at = now(), released_by = auth.uid()
    where id = p_draft_id
    returning * into v_draft;

  return v_draft;
end;
$$;

create or replace function public.staff_withdraw_recommendation_draft(p_draft_id uuid)
returns public.recommendation_drafts
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_draft public.recommendation_drafts;
begin
  if auth.uid() is null then raise exception 'Not signed in.' using errcode='42501'; end if;
  select * into v_draft from public.recommendation_drafts where id = p_draft_id for update;
  if v_draft.id is null then
    raise exception 'Recommendation draft not found.';
  end if;

  if not (
    public.is_admin_role(array['super_admin', 'admin'])
    or (public.is_admin_role(array['counsellor']) and public.counsellor_has_case_access(v_draft.student_user_id))
  ) then
    raise exception 'Not authorized to withdraw this recommendation draft.';
  end if;

  if v_draft.status <> 'submitted_for_review' then
    raise exception 'Cannot withdraw a recommendation draft from status "%".', v_draft.status;
  end if;

  update public.recommendation_drafts set status = 'draft' where id = p_draft_id returning * into v_draft;
  return v_draft;
end;
$$;

create or replace function public.staff_archive_recommendation_draft(p_draft_id uuid)
returns public.recommendation_drafts
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_draft public.recommendation_drafts;
begin
  if auth.uid() is null then raise exception 'Not signed in.' using errcode='42501'; end if;
  select * into v_draft from public.recommendation_drafts where id = p_draft_id for update;
  if v_draft.id is null then
    raise exception 'Recommendation draft not found.';
  end if;

  if not (
    public.is_admin_role(array['super_admin', 'admin'])
    or (public.is_admin_role(array['counsellor']) and public.counsellor_has_case_access(v_draft.student_user_id))
  ) then
    raise exception 'Not authorized to archive this recommendation draft.';
  end if;

  if v_draft.status not in ('approved', 'released_to_student') then
    raise exception 'Cannot archive a recommendation draft from status "%".', v_draft.status;
  end if;

  update public.recommendation_drafts set status = 'archived', archived_at = now(), archived_by = auth.uid() where id = p_draft_id
    returning * into v_draft;
  return v_draft;
end;
$$;

revoke all on function public.student_mark_section_self_entered(text) from public,anon,authenticated,service_role;
grant execute on function public.student_mark_section_self_entered(text) to authenticated;

revoke all on function public.counsellor_has_case_access(uuid) from public,anon,authenticated,service_role;
grant execute on function public.counsellor_has_case_access(uuid) to authenticated;

revoke all on function public.staff_create_recommendation_draft(uuid, text, text, jsonb) from public,anon,authenticated,service_role;
grant execute on function public.staff_create_recommendation_draft(uuid, text, text, jsonb) to authenticated;

revoke all on function public.staff_update_recommendation_draft_content(uuid, jsonb) from public,anon,authenticated,service_role;
grant execute on function public.staff_update_recommendation_draft_content(uuid, jsonb) to authenticated;

revoke all on function public.staff_submit_recommendation_draft_for_review(uuid) from public,anon,authenticated,service_role;
grant execute on function public.staff_submit_recommendation_draft_for_review(uuid) to authenticated;

revoke all on function public.staff_review_recommendation_draft(uuid, text, uuid, text) from public,anon,authenticated,service_role;
grant execute on function public.staff_review_recommendation_draft(uuid, text, uuid, text) to authenticated;

revoke all on function public.staff_release_recommendation_draft(uuid) from public,anon,authenticated,service_role;
grant execute on function public.staff_release_recommendation_draft(uuid) to authenticated;

revoke all on function public.staff_withdraw_recommendation_draft(uuid) from public,anon,authenticated,service_role;
grant execute on function public.staff_withdraw_recommendation_draft(uuid) to authenticated;

revoke all on function public.staff_archive_recommendation_draft(uuid) from public,anon,authenticated,service_role;
grant execute on function public.staff_archive_recommendation_draft(uuid) to authenticated;

revoke all on function public.get_my_recommendation_reports() from public,anon,authenticated,service_role;
grant execute on function public.get_my_recommendation_reports() to authenticated;

revoke all on function public.get_my_recommendation_report_content(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_my_recommendation_report_content(uuid) to authenticated;

revoke all on function public.staff_link_ai_generation_run_draft(uuid, uuid) from public,anon,authenticated,service_role;

revoke all on function public.admin_purge_ai_generation_reports(integer) from public,anon,authenticated,service_role;
grant execute on function public.admin_purge_ai_generation_reports(integer) to authenticated;

do $$ begin
 if has_function_privilege('anon','public.student_mark_section_self_entered(text)','execute') or has_function_privilege('service_role','public.student_mark_section_self_entered(text)','execute') or not has_function_privilege('authenticated','public.student_mark_section_self_entered(text)','execute') then raise exception 'Unexpected effective permission on reviewed RPC'; end if;
 if has_function_privilege('anon','public.counsellor_has_case_access(uuid)','execute') or has_function_privilege('service_role','public.counsellor_has_case_access(uuid)','execute') or not has_function_privilege('authenticated','public.counsellor_has_case_access(uuid)','execute') then raise exception 'Unexpected effective permission on reviewed RPC'; end if;
 if has_function_privilege('anon','public.staff_create_recommendation_draft(uuid, text, text, jsonb)','execute') or has_function_privilege('service_role','public.staff_create_recommendation_draft(uuid, text, text, jsonb)','execute') or not has_function_privilege('authenticated','public.staff_create_recommendation_draft(uuid, text, text, jsonb)','execute') then raise exception 'Unexpected effective permission on reviewed RPC'; end if;
 if has_function_privilege('anon','public.staff_update_recommendation_draft_content(uuid, jsonb)','execute') or has_function_privilege('service_role','public.staff_update_recommendation_draft_content(uuid, jsonb)','execute') or not has_function_privilege('authenticated','public.staff_update_recommendation_draft_content(uuid, jsonb)','execute') then raise exception 'Unexpected effective permission on reviewed RPC'; end if;
 if has_function_privilege('anon','public.staff_submit_recommendation_draft_for_review(uuid)','execute') or has_function_privilege('service_role','public.staff_submit_recommendation_draft_for_review(uuid)','execute') or not has_function_privilege('authenticated','public.staff_submit_recommendation_draft_for_review(uuid)','execute') then raise exception 'Unexpected effective permission on reviewed RPC'; end if;
 if has_function_privilege('anon','public.staff_review_recommendation_draft(uuid, text, uuid, text)','execute') or has_function_privilege('service_role','public.staff_review_recommendation_draft(uuid, text, uuid, text)','execute') or not has_function_privilege('authenticated','public.staff_review_recommendation_draft(uuid, text, uuid, text)','execute') then raise exception 'Unexpected effective permission on reviewed RPC'; end if;
 if has_function_privilege('anon','public.staff_release_recommendation_draft(uuid)','execute') or has_function_privilege('service_role','public.staff_release_recommendation_draft(uuid)','execute') or not has_function_privilege('authenticated','public.staff_release_recommendation_draft(uuid)','execute') then raise exception 'Unexpected effective permission on reviewed RPC'; end if;
 if has_function_privilege('anon','public.staff_withdraw_recommendation_draft(uuid)','execute') or has_function_privilege('service_role','public.staff_withdraw_recommendation_draft(uuid)','execute') or not has_function_privilege('authenticated','public.staff_withdraw_recommendation_draft(uuid)','execute') then raise exception 'Unexpected effective permission on reviewed RPC'; end if;
 if has_function_privilege('anon','public.staff_archive_recommendation_draft(uuid)','execute') or has_function_privilege('service_role','public.staff_archive_recommendation_draft(uuid)','execute') or not has_function_privilege('authenticated','public.staff_archive_recommendation_draft(uuid)','execute') then raise exception 'Unexpected effective permission on reviewed RPC'; end if;
 if has_function_privilege('anon','public.get_my_recommendation_reports()','execute') or has_function_privilege('service_role','public.get_my_recommendation_reports()','execute') or not has_function_privilege('authenticated','public.get_my_recommendation_reports()','execute') then raise exception 'Unexpected effective permission on reviewed RPC'; end if;
 if has_function_privilege('anon','public.get_my_recommendation_report_content(uuid)','execute') or has_function_privilege('service_role','public.get_my_recommendation_report_content(uuid)','execute') or not has_function_privilege('authenticated','public.get_my_recommendation_report_content(uuid)','execute') then raise exception 'Unexpected effective permission on reviewed RPC'; end if;
 if has_function_privilege('anon','public.staff_link_ai_generation_run_draft(uuid, uuid)','execute') or has_function_privilege('service_role','public.staff_link_ai_generation_run_draft(uuid, uuid)','execute') or has_function_privilege('authenticated','public.staff_link_ai_generation_run_draft(uuid, uuid)','execute') then raise exception 'Unexpected effective permission on reviewed RPC'; end if;
 if has_function_privilege('anon','public.admin_purge_ai_generation_reports(integer)','execute') or has_function_privilege('service_role','public.admin_purge_ai_generation_reports(integer)','execute') or not has_function_privilege('authenticated','public.admin_purge_ai_generation_reports(integer)','execute') then raise exception 'Unexpected effective permission on reviewed RPC'; end if;
end $$;

alter function public.student_mark_section_self_entered(text) set search_path = pg_catalog,public,pg_temp;
alter function public.counsellor_has_case_access(uuid) set search_path = pg_catalog,public,pg_temp;
alter function public.staff_create_recommendation_draft(uuid,text,text,jsonb) set search_path = pg_catalog,public,pg_temp;
alter function public.get_my_recommendation_reports() set search_path = pg_catalog,public,pg_temp;
alter function public.get_my_recommendation_report_content(uuid) set search_path = pg_catalog,public,pg_temp;
alter function public.admin_purge_ai_generation_reports(integer) set search_path = pg_catalog,public,pg_temp;

-- AI-labelled versions require a successfully finalized run for this draft.
-- Clients cannot manufacture this binding: split linking is closed and the
-- finalizer creates its own fresh draft. Historical rows are left untouched.
create or replace function nextwise_security.guard_ai_draft_content()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare v_student uuid; v_consent uuid; v_row public.student_ai_processing_consents;
begin
 if new.content ? 'aiAssisted' and jsonb_typeof(new.content->'aiAssisted') is distinct from 'boolean' then
   raise exception 'Invalid AI provenance marker';
 end if;
 if new.content->'aiAssisted' = 'true'::jsonb or exists(
   select 1 from public.recommendation_draft_versions where draft_id=new.draft_id and content->'aiAssisted'='true'::jsonb
 ) then
   perform pg_advisory_xact_lock(hashtext('public.ai_generation_runs'));
   if new.content->'aiAssisted' is distinct from 'true'::jsonb then raise exception 'AI provenance must be preserved'; end if;
   select d.student_user_id,r.consent_id into v_student,v_consent
   from public.recommendation_drafts d join public.ai_generation_runs r on r.draft_id=d.id
   where d.id=new.draft_id and r.student_user_id=d.student_user_id and r.status='succeeded';
   if not found then raise exception 'Atomic AI finalization required for AI draft content' using errcode='42501'; end if;
   perform nextwise_security.assert_staff_case(v_student);
   select * into v_row from public.student_ai_processing_consents where id=v_consent for update;
   if not found or v_row.student_user_id is distinct from v_student or v_row.withdrawn_at is not null then
     raise exception 'Active AI consent required for new AI draft content';
   end if;
 end if;
 return new;
end;
$$;
revoke all on function nextwise_security.guard_ai_draft_content() from public,anon,authenticated,service_role;
drop trigger if exists nw_f01_guard_ai_draft_content on public.recommendation_draft_versions;
create trigger nw_f01_guard_ai_draft_content before insert on public.recommendation_draft_versions
 for each row execute function nextwise_security.guard_ai_draft_content();
revoke insert,update,delete,truncate,references,trigger on public.recommendation_drafts,public.recommendation_draft_versions
 from public,anon,authenticated,service_role;
revoke insert,update,delete,truncate,references,trigger on public.ai_generation_runs from service_role;
-- CC-14 (independent review F6): TRUNCATE bypasses RLS; clients never need it.
revoke truncate,references,trigger on public.admin_audit_log,public.signature_requests,public.stamp_requests,
 public.ai_usage_settings,public.ai_generation_runs,public.student_ai_processing_consents
 from public,anon,authenticated;
do $$
declare t text; r text;
begin
 foreach t in array array['recommendation_drafts','recommendation_draft_versions','ai_generation_runs'] loop
   foreach r in array array['anon','authenticated','service_role'] loop
     if has_table_privilege(r,'public.'||t,'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER')
     or has_any_column_privilege(r,'public.'||t,'INSERT,UPDATE') then
       raise exception 'Unexpected direct content write privileges';
     end if;
   end loop;
 end loop;
 foreach t in array array['admin_audit_log','signature_requests','stamp_requests','ai_usage_settings','ai_generation_runs','student_ai_processing_consents'] loop
   foreach r in array array['anon','authenticated'] loop
     if has_table_privilege(r,'public.'||t,'TRUNCATE,TRIGGER,REFERENCES') then
       raise exception 'Unexpected TRUNCATE/TRIGGER/REFERENCES privilege';
     end if;
   end loop;
 end loop;
end $$;

-- CC-15 (independent review F7): every SECURITY DEFINER function in public and
-- nextwise_security gets an explicit search_path that ends in pg_temp, so a
-- session's temporary objects can never shadow tables or functions they use.
-- `extensions` is listed because Supabase installs pgcrypto (hmac/digest) there;
-- a schema that does not exist is ignored. It precedes public so a function created
-- in public can never shadow hmac/digest (re-review S1). Extension-owned functions are skipped.
do $$
declare f record;
begin
 for f in
   select p.oid::regprocedure as sig
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public','nextwise_security') and p.prosecdef
     and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')
     and not exists(select 1 from unnest(coalesce(p.proconfig,'{}')) c where c like 'search\_path=%' and c like '%pg\_temp')
 loop
   execute format('alter function %s set search_path = pg_catalog, extensions, public, pg_temp', f.sig);
 end loop;
 if exists(
   select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public','nextwise_security') and p.prosecdef
     and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')
     and not exists(select 1 from unnest(coalesce(p.proconfig,'{}')) c where c like 'search\_path=%' and c like '%pg\_temp')
 ) then
   raise exception 'A SECURITY DEFINER function still lacks a pinned search_path ending in pg_temp';
 end if;
end $$;

commit;
