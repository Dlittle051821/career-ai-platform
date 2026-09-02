-- ============================================================================
-- Milestone 11 — Electronic Stamping (F-123) + Assisted Onboarding Revision
--
-- HOW TO RUN THIS (no SQL knowledge required):
--   1. Open your Supabase project dashboard (supabase.com/dashboard).
--   2. Click "SQL Editor" in the left sidebar.
--   3. Click "New query".
--   4. Paste the entire contents of this file.
--   5. Click "Run".
--   6. Then follow the BOOTSTRAP section at the very end of this file to
--      populate the stamp webhook secret and create the two private
--      Storage buckets this migration's RLS policies expect (manual
--      dashboard steps — cannot be done from SQL).
--
-- Safe to run once. Re-running is also safe — every statement is written to
-- not fail if already applied (`if not exists` / `or replace` / `drop
-- policy if exists` before `create policy` / `add column if not exists`),
-- same convention as 0001-0011.
--
-- This migration does NOT modify 0001-0011 in place except for two
-- additive changes, both non-destructive: (1) widening product_events'
-- event_name CHECK constraint (0010 PART 1, already widened once by 0011
-- PART 9) to accept four new stamping event names — see PART 6 below; (2)
-- adding two new nullable/defaulted columns to the EXISTING
-- public.agreements table (`stamp_sign_sequence`, `stamp_status`) — every
-- existing column, constraint, RLS policy, and trigger on it is otherwise
-- untouched. public.agreement_versions (0011 PART 1) is read from and
-- referenced by foreign key only — its own immutability trigger
-- (prevent_agreement_version_mutation) already does everything this
-- milestone needs (a version locked for a stamp request is just as frozen
-- as one locked for a signature request); it is not redefined here.
--
-- GAPS THIS MILESTONE'S BRIEF ASSUMED WERE ALREADY BUILT, AND WHAT THIS
-- MIGRATION ACTUALLY DOES ABOUT EACH ONE (read this before anything else —
-- same discipline as 0011's own header):
--
--   The brief describes M11-B ("Assisted Onboarding") as reusing "the
--   existing counselling booking system." No such system exists anywhere
--   in migrations 0001-0011 — /book-counselling is a client-only
--   Milestone-1 demo that stores nothing (its own on-screen copy says so).
--   PART 8 below builds the smallest real booking table this milestone
--   actually needs — one session type, DISCOVERY_SESSION — rather than a
--   general scheduler the spec does not ask for ("only implement what M11
--   needs").
--
--   Profile field "provenance" (spec §14) is tracked at the SECTION level
--   here (see PART 9), matching how src/lib/profile/completion.ts already
--   models the Student Digital Profile (10 weighted required sections
--   across 11 tables) — not per individual column across those 11 tables,
--   which the spec's completeness model does not require and this
--   milestone does not add.
--
-- See docs/milestones/M11-electronic-stamping-assisted-onboarding.md for
-- the full design writeup.
--
-- LEGAL/COMPLIANCE NOTE: nothing in this migration, or anywhere else in
-- this milestone, encodes or implies a claim that an electronic stamp
-- captured through this system satisfies any particular jurisdiction's
-- stamp-duty requirements, or that a specific stamp-sign ORDER is legally
-- required — §5's four configurable sequences (STAMP_THEN_SIGN /
-- SIGN_THEN_STAMP / STAMP_ONLY / SIGN_ONLY) exist precisely because this
-- application makes no universal legal claim. This is technical capability
-- only, same posture as 0011's own note for electronic signatures.
-- ============================================================================


-- ============================================================================
-- PART 1 — stamp_requests
--
-- One row per e-stamping request against one agreement_versions row.
-- Modeled directly on public.signature_requests (0011 PART 2) — same
-- ownership-resolution discipline: RLS always resolves a student's read
-- access through the PARENT agreement (agreements.student_user_id), never
-- through any signer/requester-style column, because there isn't one here
-- (a stamp request has no "signer" at all).
--
-- `stamp_value`/`currency` are nullable and only ever set from a PROVIDER
-- response (create_stamp_request's own insert, or a webhook-delivered
-- 'completed' event) — never computed or guessed by this application (spec
-- §6/§3: "do not guess state-specific stamp values").
-- ============================================================================

create table if not exists public.stamp_requests (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.agreements (id) on delete cascade,
  agreement_version_id uuid not null references public.agreement_versions (id) on delete restrict,
  provider text not null default 'mock',
  provider_request_id text,
  status text not null default 'draft',
  jurisdiction text,
  state text,
  document_type text,
  stamp_value bigint,
  currency text not null default 'INR',
  requested_at timestamptz,
  processing_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  cancelled_at timestamptz,
  expired_at timestamptz,
  stamped_document_storage_path text,
  provider_metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stamp_requests_status_check check (status in ('draft', 'pending', 'processing', 'completed', 'failed', 'cancelled', 'expired')),
  constraint stamp_requests_stamp_value_check check (stamp_value is null or stamp_value >= 0)
);

create index if not exists stamp_requests_agreement_idx on public.stamp_requests (agreement_id);
create index if not exists stamp_requests_version_idx on public.stamp_requests (agreement_version_id);
create index if not exists stamp_requests_status_idx on public.stamp_requests (status);

-- "EVERY stamp request must reference an EXACT agreement version" (spec
-- §3) is enforced structurally by the not-null FK above, plus this partial
-- unique index preventing more than one non-terminal request per version
-- at a time — same pattern as signature_requests_one_active_per_version.
create unique index if not exists stamp_requests_one_active_per_version
  on public.stamp_requests (agreement_version_id)
  where status in ('draft', 'pending', 'processing');

comment on table public.stamp_requests is
  'Milestone 11-A (F-123). One row per electronic-stamping request. status: draft/pending are in-flight creation states; processing/completed/failed/expired are ONLY ever written by the verified webhook path (public.apply_stamp_webhook_event(), PART 4) — no application code path lets an admin set any of those directly, mirroring signature_requests'' "never trust a client-reported status" discipline. cancelled is the one non-terminal->terminal transition an admin can perform directly. stamp_requests_one_active_per_version prevents more than one non-terminal request existing for the same agreement_versions row at a time. Ownership for RLS is always resolved via the PARENT agreement (agreements.student_user_id) — see PART 1''s header comment.';

alter table public.stamp_requests enable row level security;

drop policy if exists "Admins/finance/assigned counsellor/owning student can read stamp requests" on public.stamp_requests;
create policy "Admins/finance/assigned counsellor/owning student can read stamp requests"
  on public.stamp_requests for select to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin', 'finance'])
    or exists (
      select 1 from public.agreements a
      where a.id = stamp_requests.agreement_id
        and (
          (public.is_admin_role(array['counsellor']) and a.counsellor_id = public.current_counsellor_id())
          or a.student_user_id = auth.uid()
        )
    )
  );

drop policy if exists "super_admin/admin can create stamp requests" on public.stamp_requests;
create policy "super_admin/admin can create stamp requests"
  on public.stamp_requests for insert to authenticated
  with check (public.is_admin_role(array['super_admin', 'admin']));

drop policy if exists "super_admin/admin can update stamp requests" on public.stamp_requests;
create policy "super_admin/admin can update stamp requests"
  on public.stamp_requests for update to authenticated
  using (public.is_admin_role(array['super_admin', 'admin']))
  with check (public.is_admin_role(array['super_admin', 'admin']));

-- No delete policy for anyone — same "cancel, never delete" discipline as
-- signature_requests. The webhook route carries no session (same as the
-- signature webhook) — its sole write path is
-- public.apply_stamp_webhook_event() (PART 4).

drop trigger if exists set_stamp_requests_updated_at on public.stamp_requests;
create trigger set_stamp_requests_updated_at before update on public.stamp_requests for each row execute function public.set_updated_at();


-- ============================================================================
-- PART 2 — agreements.stamp_sign_sequence + agreements.stamp_status
--
-- ADDITIVE columns on the EXISTING public.agreements table (0004 PART 8) —
-- every existing column/constraint/RLS policy/trigger on it is otherwise
-- untouched, same discipline as 0011's header comment for this same table.
--
-- `stamp_sign_sequence`: spec §5 — "Do NOT hard-code one universal legal
-- order." Nullable (default null = "not configured", the honest default —
-- an admin must explicitly choose a sequence before stamping/signing UI
-- treats either as required). Set once per agreement via the existing
-- AgreementForm, same place `agreement_type`/`status` are already edited.
--
-- `stamp_status`: coarse three-value mirror of agreements.signature_status
-- (0004 PART 8), kept in sync by a trigger exactly like
-- sync_agreement_signature_status() (0011 PART 3) — gives the admin
-- agreement list/detail a "Show: ... stamp status" field (spec §4) without
-- joining stamp_requests every time.
-- ============================================================================

alter table public.agreements add column if not exists stamp_sign_sequence text;
alter table public.agreements add column if not exists stamp_status text not null default 'not_started';

alter table public.agreements drop constraint if exists agreements_stamp_sign_sequence_check;
alter table public.agreements add constraint agreements_stamp_sign_sequence_check
  check (stamp_sign_sequence is null or stamp_sign_sequence in ('STAMP_THEN_SIGN', 'SIGN_THEN_STAMP', 'STAMP_ONLY', 'SIGN_ONLY'));

alter table public.agreements drop constraint if exists agreements_stamp_status_check;
alter table public.agreements add constraint agreements_stamp_status_check
  check (stamp_status in ('not_started', 'pending_stamp', 'stamped'));

comment on column public.agreements.stamp_sign_sequence is
  'Milestone 11-A. Null = electronic stamping is not configured for this agreement (the UI must show exactly that, never assume an order — spec §5). One of STAMP_THEN_SIGN/SIGN_THEN_STAMP/STAMP_ONLY/SIGN_ONLY once an admin sets it via the agreement form.';
comment on column public.agreements.stamp_status is
  'Milestone 11-A. Coarse mirror of the current stamp_requests row''s status, kept in sync by public.sync_agreement_stamp_status() (PART 3) — same three-value vocabulary and same "never trust a client-reported status" posture as the pre-existing signature_status column.';


-- ----------------------------------------------------------------------------
-- PART 2.1 — sync_agreement_stamp_status(): keeps agreements.stamp_status in
-- sync with the current stamp_requests row, at the DATABASE layer. Mapping:
--   completed                          -> 'stamped'
--   cancelled                          -> 'not_started'
--   draft/pending/processing/failed/
--   expired                            -> 'pending_stamp'
-- Mirrors public.sync_agreement_signature_status() (0011 PART 3) exactly.
-- ----------------------------------------------------------------------------

create or replace function public.sync_agreement_stamp_status()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
declare
  v_mapped text;
begin
  v_mapped := case
    when new.status = 'completed' then 'stamped'
    when new.status = 'cancelled' then 'not_started'
    else 'pending_stamp'
  end;

  update public.agreements
    set stamp_status = v_mapped
    where id = new.agreement_id and stamp_status is distinct from v_mapped;

  return new;
end;
$$;

comment on function public.sync_agreement_stamp_status() is
  'AFTER INSERT OR UPDATE trigger on stamp_requests: collapses the detailed stamp_requests.status into agreements.stamp_status''s coarse three-value vocabulary. SECURITY DEFINER so it works identically regardless of which write path fired it (admin RLS-respecting write, or apply_stamp_webhook_event()''s elevated write).';

drop trigger if exists sync_agreement_stamp_status on public.stamp_requests;
create trigger sync_agreement_stamp_status
  after insert or update on public.stamp_requests
  for each row execute function public.sync_agreement_stamp_status();

revoke execute on function public.sync_agreement_stamp_status() from public;


-- ============================================================================
-- PART 3 — create_stamp_request(): atomically locks the target
-- agreement_versions row (if it is still a draft — a version already
-- locked by an earlier signature request is left exactly as-is, since it
-- is already immutable) and inserts the (status='pending') stamp_requests
-- row in one statement, same atomicity rationale as
-- public.create_signature_request() (0011 PART 2.1).
--
-- SECURITY INVOKER (the default), NOT DEFINER — same reasoning as
-- create_signature_request(): exists purely for atomicity, grants no
-- privilege the caller does not already have via agreement_versions/
-- stamp_requests' own RLS (only super_admin/admin can UPDATE
-- agreement_versions or INSERT stamp_requests). `for update` row-locks the
-- version for the duration of this call, so two concurrent "Request
-- E-Stamp" clicks against the same version can never both succeed.
-- ============================================================================

create or replace function public.create_stamp_request(
  p_agreement_version_id uuid,
  p_jurisdiction text default null,
  p_state text default null,
  p_document_type text default null,
  p_provider text default 'mock'
)
returns public.stamp_requests
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_version public.agreement_versions;
  v_request public.stamp_requests;
begin
  select * into v_version from public.agreement_versions where id = p_agreement_version_id for update;
  if v_version.id is null then
    raise exception 'Agreement version not found.';
  end if;
  if v_version.status = 'superseded' then
    raise exception 'This agreement version has been superseded — select the current version instead.';
  end if;

  if v_version.status = 'draft' then
    update public.agreement_versions set status = 'locked' where id = v_version.id;
  end if;

  insert into public.stamp_requests (
    agreement_id, agreement_version_id, provider, jurisdiction, state, document_type, status, requested_at, created_by
  ) values (
    v_version.agreement_id, v_version.id, coalesce(nullif(trim(p_provider), ''), 'mock'), nullif(trim(p_jurisdiction), ''), nullif(trim(p_state), ''), nullif(trim(p_document_type), ''), 'pending', now(), auth.uid()
  )
  returning * into v_request;

  return v_request;
end;
$$;

comment on function public.create_stamp_request(uuid, text, text, text, text) is
  'Atomically locks a draft agreement_versions row (leaving an already-locked one, e.g. from a prior signature request, untouched) and inserts its (status=''pending'') stamp_requests row in one statement. SECURITY INVOKER — fully subject to agreement_versions/stamp_requests'' own RLS. Called from src/lib/supabase/admin/stamping.ts requestStamp(), which then calls the provider adapter and records its response in a second, ordinary single-row UPDATE.';

revoke execute on function public.create_stamp_request(uuid, text, text, text, text) from public;
grant execute on function public.create_stamp_request(uuid, text, text, text, text) to authenticated;


-- ============================================================================
-- PART 4 — stamp_webhook_events (idempotency ledger), stamp_provider_config
-- (server-side-only webhook secret), and apply_stamp_webhook_event() (the
-- one entry point for verified stamp-provider webhook deliveries).
--
-- All three modeled directly on their signature-request equivalents (0011
-- PARTs 4/5/6) — same shapes, same idempotency guard, same
-- independent-HMAC-re-verification discipline, same "only move forward"
-- out-of-order protection, same non-raising failure branches (so a
-- SIGNATURE_WEBHOOK_FAILED-style audit entry is never rolled back by its
-- own function's exception — see 0011 PART 6's own comment for the full
-- rationale, which applies identically here).
-- ============================================================================

create table if not exists public.stamp_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'mock',
  event_id text not null,
  event_type text not null,
  processing_status text not null default 'received',
  related_stamp_request_id uuid references public.stamp_requests (id) on delete set null,
  related_agreement_id uuid references public.agreements (id) on delete set null,
  diagnostic_message text,
  payload_summary jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint stamp_webhook_events_processing_status_check check (processing_status in ('received', 'processed', 'ignored', 'failed')),
  constraint stamp_webhook_events_provider_event_unique unique (provider, event_id)
);

create index if not exists stamp_webhook_events_type_idx on public.stamp_webhook_events (event_type);
create index if not exists stamp_webhook_events_created_at_idx on public.stamp_webhook_events (created_at);
create index if not exists stamp_webhook_events_request_idx on public.stamp_webhook_events (related_stamp_request_id);

comment on table public.stamp_webhook_events is
  'Milestone 11-A — append-only ledger of every stamp-provider webhook delivery this system has verified and accepted for processing, modeled directly on public.signature_webhook_events. `event_id` is a SHA-256 fingerprint of the raw, signature-verified request body — stamp_webhook_events_provider_event_unique is the actual duplicate-delivery guard.';

alter table public.stamp_webhook_events enable row level security;

drop policy if exists "super_admin/admin can read stamp webhook events" on public.stamp_webhook_events;
create policy "super_admin/admin can read stamp webhook events"
  on public.stamp_webhook_events for select to authenticated
  using (public.is_admin_role(array['super_admin', 'admin']));

-- Deliberately no insert/update/delete policy for any client role — the
-- only write path is public.apply_stamp_webhook_event() below.


create table if not exists public.stamp_provider_config (
  id integer primary key default 1,
  webhook_secret text,
  updated_at timestamptz not null default now(),
  constraint stamp_provider_config_singleton_check check (id = 1)
);

comment on table public.stamp_provider_config is
  'Milestone 11-A — server-side-only copy of the stamp-provider webhook HMAC secret (same value as the STAMP_WEBHOOK_SECRET environment variable), modeled on public.signature_provider_config. RLS enabled with NO policies for any role — unreachable via the normal Supabase client, only via apply_stamp_webhook_event() below. Populated manually, see this migration''s BOOTSTRAP section.';

alter table public.stamp_provider_config enable row level security;
-- No policies at all, for any role — see comment above.

insert into public.stamp_provider_config (id, webhook_secret)
values (1, null)
on conflict (id) do nothing;

drop trigger if exists set_stamp_provider_config_updated_at on public.stamp_provider_config;
create trigger set_stamp_provider_config_updated_at before update on public.stamp_provider_config for each row execute function public.set_updated_at();


create or replace function public.apply_stamp_webhook_event(
  p_raw_body text,
  p_signature text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
  v_expected text;
  v_body jsonb;
  v_event_type text;
  v_provider text;
  v_provider_request_id text;
  v_metadata jsonb;
  v_fingerprint text;
  v_webhook_event_id uuid;
  v_request public.stamp_requests;
  v_suffix text;
  v_new_status text;
  v_rank_old integer;
  v_rank_new integer;
  v_diagnostic text := null;
  v_processing_status text := 'ignored';
  v_action text;
  v_stamp_value bigint;
  v_currency text;
begin
  -- See 0011 PART 6's own comment for why every failure branch here
  -- RETURNS a {valid: false, ...} jsonb value instead of RAISE-ing — a
  -- raised exception would roll back this function's own
  -- STAMP_WEBHOOK_FAILED audit-log insert.
  if p_raw_body is null or p_signature is null then
    return jsonb_build_object('valid', false, 'reason', 'missing_body_or_signature');
  end if;

  select webhook_secret into v_secret from public.stamp_provider_config where id = 1;
  if v_secret is null or length(trim(v_secret)) = 0 then
    perform public.record_system_audit_log(
      'STAMP_WEBHOOK_FAILED', 'stamp_webhook', null,
      'Rejected a stamp webhook delivery — no webhook secret configured.',
      null, jsonb_build_object('reason', 'not_configured')
    );
    return jsonb_build_object('valid', false, 'reason', 'not_configured');
  end if;

  v_expected := encode(hmac(p_raw_body, v_secret, 'sha256'), 'hex');
  if v_expected <> p_signature then
    perform public.record_system_audit_log(
      'STAMP_WEBHOOK_FAILED', 'stamp_webhook', null,
      'Rejected a stamp webhook delivery — invalid signature.',
      null, jsonb_build_object('reason', 'invalid_signature')
    );
    return jsonb_build_object('valid', false, 'reason', 'invalid_signature');
  end if;

  begin
    v_body := p_raw_body::jsonb;
  exception when others then
    perform public.record_system_audit_log(
      'STAMP_WEBHOOK_FAILED', 'stamp_webhook', null,
      'Rejected a stamp webhook delivery — body was not valid JSON.',
      null, jsonb_build_object('reason', 'invalid_json')
    );
    return jsonb_build_object('valid', false, 'reason', 'invalid_json');
  end;

  v_event_type := v_body ->> 'eventType';
  v_provider := coalesce(v_body ->> 'provider', 'mock');
  v_provider_request_id := v_body ->> 'providerRequestId';
  v_metadata := coalesce(v_body -> 'metadata', '{}'::jsonb);

  v_fingerprint := encode(digest(p_raw_body, 'sha256'), 'hex');
  insert into public.stamp_webhook_events (provider, event_id, event_type, processing_status)
  values (v_provider, v_fingerprint, coalesce(v_event_type, 'unknown'), 'received')
  on conflict (provider, event_id) do nothing
  returning id into v_webhook_event_id;

  if v_webhook_event_id is null then
    return jsonb_build_object('valid', true, 'duplicate', true, 'event_type', v_event_type);
  end if;

  if v_provider_request_id is null or v_event_type is null then
    v_diagnostic := 'Missing eventType or providerRequestId in payload.';
  else
    select * into v_request
    from public.stamp_requests
    where provider = v_provider and provider_request_id = v_provider_request_id;

    if v_request.id is null then
      v_diagnostic := 'No matching stamp_requests row for this provider_request_id — event ignored.';
    else
      -- 'stamp_request.<suffix>' -> <suffix> is the new status.
      v_suffix := nullif(split_part(v_event_type, '.', 2), '');
      v_new_status := case v_suffix
        when 'processing' then 'processing'
        when 'completed' then 'completed'
        when 'failed' then 'failed'
        when 'cancelled' then 'cancelled'
        when 'expired' then 'expired'
        else null
      end;

      if v_new_status is null then
        v_diagnostic := format('Unrecognized event type "%s" — recorded, not processed.', v_event_type);
      else
        v_rank_old := case v_request.status
          when 'draft' then 0 when 'pending' then 1 when 'processing' then 2
          when 'completed' then 9 when 'failed' then 9 when 'cancelled' then 9 when 'expired' then 9
          else 0
        end;
        v_rank_new := case v_new_status
          when 'processing' then 2
          when 'completed' then 9 when 'failed' then 9 when 'cancelled' then 9 when 'expired' then 9
          else 0
        end;

        if v_rank_old >= 9 then
          v_diagnostic := format('Stamp request %s is already in a terminal state (%s) — event ignored.', v_request.id, v_request.status);
        elsif v_rank_new < v_rank_old then
          v_diagnostic := format('Stale/out-of-order event (%s after %s) — ignored.', v_new_status, v_request.status);
        else
          v_stamp_value := nullif(v_metadata ->> 'stampValue', '')::bigint;
          v_currency := nullif(v_metadata ->> 'currency', '');

          update public.stamp_requests
            set status = v_new_status,
                processing_at = case when v_new_status = 'processing' then coalesce(processing_at, now()) else processing_at end,
                completed_at = case when v_new_status = 'completed' then coalesce(completed_at, now()) else completed_at end,
                failed_at = case when v_new_status = 'failed' then coalesce(failed_at, now()) else failed_at end,
                expired_at = case when v_new_status = 'expired' then coalesce(expired_at, now()) else expired_at end,
                stamp_value = case when v_new_status = 'completed' and v_stamp_value is not null then v_stamp_value else stamp_value end,
                currency = coalesce(v_currency, currency),
                provider_metadata = provider_metadata || v_metadata
            where id = v_request.id
            returning * into v_request;

          v_processing_status := 'processed';

          v_action := case v_new_status
            when 'processing' then 'STAMP_PROCESSING'
            when 'completed' then 'STAMP_COMPLETED'
            when 'failed' then 'STAMP_FAILED'
            when 'cancelled' then 'STAMP_CANCELLED'
            when 'expired' then 'STAMP_EXPIRED'
          end;
          perform public.record_system_audit_log(
            v_action, 'stamp_request', v_request.id::text,
            format('Stamp request moved to "%s" via verified %s webhook.', v_new_status, v_provider),
            null,
            jsonb_build_object('provider', v_provider, 'provider_request_id', v_provider_request_id, 'agreement_id', v_request.agreement_id, 'agreement_version_id', v_request.agreement_version_id)
          );
        end if;
      end if;
    end if;
  end if;

  update public.stamp_webhook_events
    set processing_status = v_processing_status,
        related_stamp_request_id = v_request.id,
        related_agreement_id = v_request.agreement_id,
        diagnostic_message = v_diagnostic,
        payload_summary = jsonb_build_object('event_type', v_event_type, 'provider', v_provider, 'provider_request_id', v_provider_request_id),
        processed_at = now()
    where id = v_webhook_event_id;

  return jsonb_build_object(
    'valid', true,
    'duplicate', false,
    'event_type', v_event_type,
    'processing_status', v_processing_status,
    'stamp_request_id', v_request.id,
    'agreement_id', v_request.agreement_id,
    'status', v_request.status,
    'provider', v_provider,
    'provider_request_id', v_provider_request_id
  );
end;
$$;

comment on function public.apply_stamp_webhook_event(text, text) is
  'The only entry point for stamp-provider webhook deliveries. Independently re-verifies the webhook HMAC-SHA256 signature against stamp_provider_config before trusting any field in the body. Idempotent via stamp_webhook_events_provider_event_unique. Only ever moves a stamp_requests row FORWARD through draft/pending/processing/completed|failed|cancelled|expired. Every successful status change, and every rejected-signature/malformed-body failure, is also written to admin_audit_log via public.record_system_audit_log() (0011 PART 6.2 — reused as-is, not redefined here).';


create or replace function public.set_stamp_document_path(
  p_provider text,
  p_provider_request_id text,
  p_storage_path text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_provider is null or p_provider_request_id is null or p_storage_path is null or length(trim(p_storage_path)) = 0 then
    raise exception 'Missing provider, provider_request_id, or storage path.';
  end if;

  update public.stamp_requests
    set stamped_document_storage_path = p_storage_path
    where provider = p_provider and provider_request_id = p_provider_request_id and status = 'completed'
    returning id into v_id;

  if v_id is null then
    raise exception 'No completed stamp_requests row found for this provider/provider_request_id.';
  end if;

  return jsonb_build_object('stamp_request_id', v_id);
end;
$$;

comment on function public.set_stamp_document_path(text, text, text) is
  'Records where the stamped document bytes were uploaded in Storage, for a stamp_requests row that is already status=''completed''. Only ever called by src/app/api/webhooks/stamp/route.ts, mirroring public.set_signature_document_path() (0011 PART 6.1).';


revoke execute on function public.apply_stamp_webhook_event(text, text) from public;
revoke execute on function public.set_stamp_document_path(text, text, text) from public;

-- Called only from src/app/api/webhooks/stamp/route.ts, which carries no
-- Supabase session at all — same posture as the signature webhook's grants.
grant execute on function public.apply_stamp_webhook_event(text, text) to anon;
grant execute on function public.set_stamp_document_path(text, text, text) to anon;


-- ============================================================================
-- PART 5 — Storage RLS for the private 'stamped-agreements' bucket.
--
-- THE BUCKET ITSELF MUST BE CREATED MANUALLY — see BOOTSTRAP. Mirrors
-- 0011 PART 8 exactly, for stamp_requests instead of signature_requests.
-- Path convention (enforced by src/lib/storage/stamped-documents.ts):
-- `<agreement_id>/<stamp_request_id>/<filename>`.
-- ============================================================================

drop policy if exists "super_admin/admin can upload stamped agreement documents" on storage.objects;
create policy "super_admin/admin can upload stamped agreement documents"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'stamped-agreements'
    and public.is_admin_role(array['super_admin', 'admin'])
  );

drop policy if exists "Admins/finance/assigned counsellor/owning student can read stamped agreement documents" on storage.objects;
create policy "Admins/finance/assigned counsellor/owning student can read stamped agreement documents"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'stamped-agreements'
    and (
      public.is_admin_role(array['super_admin', 'admin', 'finance'])
      or (
        split_part(storage.objects.name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        and exists (
          select 1 from public.agreements a
          where a.id = (split_part(storage.objects.name, '/', 1))::uuid
            and (
              (public.is_admin_role(array['counsellor']) and a.counsellor_id = public.current_counsellor_id())
              or a.student_user_id = auth.uid()
            )
        )
      )
    )
  );

-- Deliberately no update/delete policy — append-only, same as the signed
-- agreements bucket.


-- ============================================================================
-- PART 6 — Widen product_events.event_name for this milestone's stamping
-- funnel events. Additive only — every previously-accepted name (0010 PART
-- 1, widened once already by 0011 PART 9) stays accepted. Must be kept in
-- sync with src/lib/analytics/events.ts's PRODUCT_EVENTS registry. Widened
-- once, for the whole of Milestone 11 (stamping + onboarding + profile/
-- recommendation-readiness, spec §23) rather than twice, since all of it
-- ships in this one migration file.
-- ============================================================================

alter table public.product_events drop constraint if exists product_events_event_name_check;
alter table public.product_events add constraint product_events_event_name_check check (event_name in (
  -- Auth / account
  'user_registered',
  'user_logged_in',
  -- Student profile
  'profile_started',
  'profile_completed',
  -- Assessment / quiz — RESERVED, never fired.
  'assessment_started',
  'assessment_answered',
  'assessment_completed',
  'assessment_result_viewed',
  -- Career discovery
  'career_recommendations_generated',
  'career_viewed',
  'career_compared',
  'career_saved',
  -- Course discovery
  'course_viewed',
  'course_compared',
  'course_saved',
  'application_started',
  -- College / university discovery
  'college_viewed',
  'college_compared',
  'college_saved',
  -- Lead / conversion
  'lead_created',
  'counselling_requested',
  -- Commercial
  'package_viewed',
  'package_selected',
  'payment_started',
  'payment_completed',
  -- Outcome
  'offer_received',
  'enrollment_confirmed',
  -- Milestone 10 (F-122) — Electronic Signature Integration
  'agreement_signature_requested',
  'agreement_signature_viewed',
  'agreement_signature_completed',
  'agreement_signature_declined',
  'agreement_signature_cancelled',
  -- Milestone 11-A (F-123) — Electronic Stamping
  'agreement_stamp_requested',
  'agreement_stamp_completed',
  'agreement_stamp_failed',
  'agreement_stamp_cancelled',
  -- Milestone 11-B — Assisted Onboarding Revision
  'onboarding_choice_viewed',
  'onboarding_discovery_selected',
  'onboarding_self_profile_selected',
  'discovery_session_booked',
  'discovery_session_started',
  'discovery_session_completed',
  -- Milestone 11-C — Profile verification + recommendation readiness
  'profile_field_counsellor_updated',
  'profile_field_counsellor_verified',
  'profile_completeness_changed',
  'recommendation_readiness_changed',
  'recommendations_unlocked',
  'personal_strategy_cta_viewed',
  'personal_strategy_selected'
));

-- ============================================================================
-- PART 7 — Verification queries (run manually after applying this
-- migration; not executed automatically). Same pattern as 0011 PART 10.
--
-- 1) anon can execute the two stamp webhook-facing functions:
--
-- select
--   has_function_privilege('anon', 'public.apply_stamp_webhook_event(text,text)', 'execute') as anon_can_webhook,
--   has_function_privilege('anon', 'public.set_stamp_document_path(text,text,text)', 'execute') as anon_can_set_path;
-- -- expected: true, true
--
-- 2) The partial unique index blocks a second active stamp request for the
--    same version:
--
-- insert into public.stamp_requests (agreement_id, agreement_version_id, status)
--   select agreement_id, agreement_version_id, 'pending'
--   from public.stamp_requests where status in ('draft','pending','processing') limit 1;
-- -- expected: raises a unique-constraint violation on
-- -- stamp_requests_one_active_per_version
--
-- 3) A signed-out (anon) client sees zero rows on every new table:
--
-- select count(*) from public.stamp_requests;        -- expect 0 as anon
-- select count(*) from public.stamp_webhook_events;   -- expect 0 as anon
-- select count(*) from public.stamp_provider_config;  -- expect 0 as anon
--
-- 4) An invalid webhook signature is rejected without touching
--    stamp_requests, but IS recorded to admin_audit_log:
--
-- select public.apply_stamp_webhook_event('{"eventType":"stamp_request.completed"}', 'not-the-real-signature');
-- -- expected: {"valid": false, "reason": "invalid_signature"}
-- select action, entity_type, actor_role from public.admin_audit_log where action = 'STAMP_WEBHOOK_FAILED' order by created_at desc limit 1;
-- -- expected: one row, actor_role = 'system'
-- ============================================================================


-- ============================================================================
-- BOOTSTRAP — manual steps required after applying this migration
--
-- 1) Set the stamp webhook secret. Choose a long random string, put it in
--    your deployment's STAMP_WEBHOOK_SECRET environment variable, AND run
--    this statement with the SAME value:
--
-- update public.stamp_provider_config set webhook_secret = 'paste-the-same-value-as-STAMP_WEBHOOK_SECRET-here' where id = 1;
--
--    Local/dev note: if left unset, src/lib/stamping/config.ts falls back
--    to a fixed, clearly-labeled development-only secret (NEVER used when
--    NODE_ENV=production), same as the signature milestone's own fallback.
--
-- 2) Create the private Storage bucket (Supabase dashboard -> Storage ->
--    New bucket):
--      Name: stamped-agreements
--      Public bucket: UNCHECKED
--    This cannot be done from SQL.
-- ============================================================================
