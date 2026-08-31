-- ============================================================================
-- Milestone 10 — Electronic Signature Integration (F-122)
--
-- HOW TO RUN THIS (no SQL knowledge required):
--   1. Open your Supabase project dashboard (supabase.com/dashboard).
--   2. Click "SQL Editor" in the left sidebar.
--   3. Click "New query".
--   4. Paste the entire contents of this file.
--   5. Click "Run".
--   6. Then follow the BOOTSTRAP section at the very end of this file to
--      populate the webhook secret this migration stores server-side, and
--      create the private Storage bucket for signed documents (a manual
--      dashboard step — cannot be done from SQL).
--
-- Safe to run once. Re-running is also safe — every statement is written to
-- not fail if already applied (`if not exists` / `or replace` / `drop
-- policy if exists` before `create policy`), same convention as 0001-0010.
--
-- This migration does NOT modify 0001-0010 in place. public.agreements
-- (0004_admin_system.sql PART 8) is read from and referenced by foreign key
-- only — every existing column, constraint, RLS policy, and trigger on it
-- is untouched. The ONE additive change to an existing table is widening
-- product_events' event_name CHECK constraint (0010 PART 1) to accept five
-- new signature event names — see PART 9 below.
--
-- GAPS THIS MILESTONE'S SPEC ASSUMED WERE ALREADY BUILT, AND WHAT THIS
-- MIGRATION ACTUALLY DOES ABOUT EACH ONE (read this before anything else):
--
--   "F-121 agreement version locking" does not exist as a real feature
--   anywhere in this codebase — public.agreements has only a free-text
--   `version` column, never enforced as immutable. This migration BUILDS a
--   real one from scratch (PART 1-2 below), copied directly from this
--   codebase's own actual precedent for immutable versioning:
--   public.pricing_plan_versions' prevent_pricing_version_mutation()
--   trigger (0007_nextwise_pricing_offers.sql PART 2.1).
--
--   "F-190 email/notification system" does not exist anywhere in this
--   codebase — there is no mailer, no sendEmail(), nothing. This milestone
--   does NOT build one. src/lib/notifications/notifier.ts ships a
--   LoggingNotifier that safely logs instead of sending real email — every
--   "notification" this milestone fires is, honestly, a structured log
--   line today. See docs/milestones/M10-electronic-signature.md "Known
--   limitations" for exactly where a real provider (Resend/SendGrid/SES)
--   plugs in later.
--
--   There is no Supabase Storage usage anywhere in this codebase before
--   this migration. PART 8 below adds RLS policies on storage.objects for
--   a bucket named 'signed-agreements' — but the BUCKET ITSELF must be
--   created manually in the Supabase dashboard as PRIVATE (Storage ->
--   New bucket -> uncheck "Public bucket"); this cannot be done from a SQL
--   migration. See the BOOTSTRAP section.
--
--   There is no student-facing agreement/signature view anywhere in this
--   codebase before this milestone. src/app/(site)/agreements/[id]/page.tsx
--   and a "My Agreements" dashboard section are new, genuinely new UI
--   surface added alongside this migration.
--
-- WHAT THIS MIGRATION ADDS, IN ONE SENTENCE EACH:
--   - agreement_versions          immutable-once-locked content snapshots
--                                  of an agreement, one-to-many under
--                                  public.agreements. "Editing a locked
--                                  version" is creating a new version row,
--                                  never mutating the old one — exactly
--                                  pricing_plan_versions' own rule.
--   - signature_requests           one row per e-signature request sent to
--                                  a signer for one agreement_versions row.
--                                  Status is provider-driven
--                                  (draft/pending/sent/viewed/signed/
--                                  declined/cancelled/expired/failed); the
--                                  four provider-confirmed states
--                                  (viewed/signed/declined/expired) are
--                                  application-code-only reachable through
--                                  the verified webhook path — see PART 6.
--   - signature_webhook_events     append-only idempotency ledger for
--                                  every verified signature-provider
--                                  webhook delivery — modeled directly on
--                                  public.payment_webhook_events
--                                  (0005_payments_billing.sql PART 8).
--   - signature_provider_config    server-side-only copy of the webhook
--                                  HMAC secret, used exclusively by
--                                  apply_signature_webhook_event() to
--                                  independently re-derive the webhook
--                                  signature — modeled directly on
--                                  public.payment_gateway_config
--                                  (0005_payments_billing.sql PART 2).
--   - public.create_signature_request()        atomically locks a draft
--                                  agreement_versions row and inserts its
--                                  signature_requests row in one
--                                  statement — SECURITY INVOKER, fully
--                                  RLS-respecting, exists only for
--                                  atomicity.
--   - public.apply_signature_webhook_event()   the one and only path a
--                                  verified provider webhook delivery can
--                                  use to change a signature_requests row's
--                                  status — SECURITY DEFINER, mirrors
--                                  public.apply_webhook_event() exactly.
--   - public.set_signature_document_path()     narrow SECURITY DEFINER
--                                  helper the webhook route calls, after
--                                  it has uploaded the signed document
--                                  bytes to Storage, to record where they
--                                  live.
--   - public.record_system_audit_log()         a narrow SECURITY DEFINER
--                                  sibling of public.record_admin_audit_log()
--                                  (0004_admin_system.sql PART 11) for the
--                                  one case that function cannot handle:
--                                  an audit entry written from a webhook
--                                  delivery that carries no admin session
--                                  at all. Writes to the SAME
--                                  admin_audit_log table — never a second
--                                  audit table. Not reachable by any client
--                                  role; only ever called from inside
--                                  another SECURITY DEFINER function's body
--                                  in this same migration.
--
-- See docs/milestones/M10-electronic-signature.md for the full design
-- writeup, including the provider-abstraction architecture and exactly how
-- a real e-signature provider (DocuSign/Dropbox Sign/Adobe Sign/Zoho Sign)
-- would be plugged in later.
--
-- LEGAL/COMPLIANCE NOTE: nothing in this migration, or anywhere else in
-- this milestone, encodes or implies a claim that an electronic signature
-- captured through this system is legally valid in any particular
-- jurisdiction. This is technical capability only.
-- ============================================================================


-- ============================================================================
-- PART 1 — agreement_versions (immutable-once-locked content snapshots)
--
-- "A version is freely editable while in draft, and once it's attached to
-- a signature request (locked/sent), every content column is frozen —
-- editing means creating a new version row, never mutating the old one."
-- Copied directly from public.pricing_plan_versions'
-- prevent_pricing_version_mutation() trigger (0007_nextwise_pricing_
-- offers.sql PART 2.1) — see PART 1.1 below for the equivalent trigger
-- here.
--
-- STORAGE DESIGN DECISION: this table holds `content_reference_url`, a
-- manually-typed reference URL — the exact same convention
-- public.agreements.document_reference_url already established
-- (0004_admin_system.sql: "a reference/placeholder field only... do not
-- store uploaded legal documents unless secure storage + authorization +
-- retention is fully implemented"). This migration DOES fully implement
-- secure storage — but only for the SIGNED OUTCOME of a signature request
-- (signature_requests.signed_document_storage_path, PART 2 + PART 8,
-- backed by a real private Supabase Storage bucket with RLS). The
-- UNSIGNED draft content an admin sends for signature is deliberately kept
-- at the same "reference URL only" honesty level as the existing
-- `agreements` table — this migration does not add a second, parallel
-- unsigned-document upload feature that the spec did not ask for.
-- ============================================================================

create table if not exists public.agreement_versions (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.agreements (id) on delete cascade,
  version_number integer not null,
  content_reference_url text,
  content_notes text,
  status text not null default 'draft',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agreement_id, version_number),
  constraint agreement_versions_status_check check (status in ('draft', 'locked', 'superseded')),
  constraint agreement_versions_content_url_format_check check (content_reference_url is null or content_reference_url ~* '^https?://')
);

create index if not exists agreement_versions_agreement_idx on public.agreement_versions (agreement_id);
create index if not exists agreement_versions_status_idx on public.agreement_versions (status);

comment on table public.agreement_versions is
  'Milestone 10 (F-122). One row per content revision of a public.agreements row. status: ''draft'' (freely editable) -> ''locked'' (attached to an active/sent signature_requests row, now immutable — see PART 1.1''s trigger) -> ''superseded'' (a newer version now exists / this one was abandoned). `content_reference_url` mirrors agreements.document_reference_url''s existing "manually-typed reference, not real document storage" convention (see this migration''s header comment for why) — the actual signed OUTPUT of a completed signature request is stored for real, in a private Storage bucket, on signature_requests.signed_document_storage_path instead.';

alter table public.agreement_versions enable row level security;

drop policy if exists "Admins/finance/assigned counsellor/owning student can read agreement versions" on public.agreement_versions;
create policy "Admins/finance/assigned counsellor/owning student can read agreement versions"
  on public.agreement_versions for select to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin', 'finance'])
    or exists (
      select 1 from public.agreements a
      where a.id = agreement_versions.agreement_id
        and (
          (public.is_admin_role(array['counsellor']) and a.counsellor_id = public.current_counsellor_id())
          or a.student_user_id = auth.uid()
        )
    )
  );

drop policy if exists "super_admin/admin can create agreement versions" on public.agreement_versions;
create policy "super_admin/admin can create agreement versions"
  on public.agreement_versions for insert to authenticated
  with check (public.is_admin_role(array['super_admin', 'admin']));

drop policy if exists "super_admin/admin can update agreement versions" on public.agreement_versions;
create policy "super_admin/admin can update agreement versions"
  on public.agreement_versions for update to authenticated
  using (public.is_admin_role(array['super_admin', 'admin']))
  with check (public.is_admin_role(array['super_admin', 'admin']));

-- No delete policy for anyone — a version that should stop being used is
-- superseded, never deleted, so signature_requests.agreement_version_id
-- (on delete restrict, PART 2) can never be left dangling and a signed
-- request's exact content at signing time is always traceable.

drop trigger if exists set_agreement_versions_updated_at on public.agreement_versions;
create trigger set_agreement_versions_updated_at before update on public.agreement_versions for each row execute function public.set_updated_at();


-- ----------------------------------------------------------------------------
-- PART 1.1 — Immutability trigger, copied from
-- public.prevent_pricing_version_mutation() (0007 PART 2.1) with the
-- equivalent status graph for this table: draft -> locked, draft ->
-- superseded (an admin abandons a draft in favor of a newer one without
-- ever sending it), locked -> superseded (a newer version supersedes a
-- version that was already sent for signature, e.g. after cancel-old +
-- send-new). Nothing ever moves backward to draft.
-- ----------------------------------------------------------------------------

create or replace function public.prevent_agreement_version_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'draft' then
    return new; -- freely editable while still a draft
  end if;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'draft' and new.status in ('locked', 'superseded'))
      or (old.status = 'locked' and new.status = 'superseded')
    ) then
      raise exception 'Agreement versions cannot move from status "%" to "%" — create a new version instead.', old.status, new.status;
    end if;
  end if;

  if new.agreement_id is distinct from old.agreement_id
    or new.version_number is distinct from old.version_number
    or new.content_reference_url is distinct from old.content_reference_url
    or new.content_notes is distinct from old.content_notes
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
  then
    raise exception 'A locked or superseded agreement version is immutable — create a new version instead of editing this one.';
  end if;

  return new;
end;
$$;

comment on function public.prevent_agreement_version_mutation() is
  'BEFORE UPDATE guard on agreement_versions, copied from public.prevent_pricing_version_mutation() (0007_nextwise_pricing_offers.sql PART 2.1). Once a row leaves status=''draft'', every column is frozen except the status transitions draft->locked, draft->superseded, and locked->superseded. SECURITY INVOKER (the default) is correct here for the same reason the pricing equivalent is: it only ever inspects OLD/NEW of the row already being written and grants no elevated access.';

drop trigger if exists prevent_agreement_versions_mutation on public.agreement_versions;
create trigger prevent_agreement_versions_mutation
  before update on public.agreement_versions
  for each row execute function public.prevent_agreement_version_mutation();


-- ============================================================================
-- PART 2 — signature_requests
--
-- One row per e-signature request sent to one signer for one
-- agreement_versions row. `signer_user_id` is nullable — a signer may have
-- no NextWise account at all (e.g. a parent/guardian, or an external
-- university/counsellor party) — so it is NEVER the authoritative
-- ownership anchor for RLS. AUTHORITATIVE OWNERSHIP DECISION (read this —
-- it is genuinely IDOR-relevant): a student's read access to a
-- signature_requests row is always resolved through the PARENT
-- agreement's `agreements.student_user_id`, joined via `agreement_id`,
-- never through `signer_user_id` directly. `signer_user_id`, when set, is
-- purely descriptive metadata ("this NextWise account happens to be the
-- named signer") — it is never checked by any RLS policy in this
-- migration. This means: a signature request whose signer is a parent/
-- guardian (no matching signer_user_id) is still correctly visible to the
-- STUDENT the underlying agreement belongs to, which is the actually
-- useful behavior ("show my agreements and their signature status on my
-- dashboard") — see src/app/(site)/agreements/[id]/page.tsx and
-- src/lib/supabase/agreements/my-agreements.ts, both of which additionally
-- re-check `student_user_id = auth.uid()` explicitly server-side on top of
-- this RLS policy (this codebase''s "RLS is the floor, not the only
-- check" discipline — see e.g. public.purchase_pricing_plan()''s own
-- explicit auth.uid() scoping, 0007 PART 7).
-- ============================================================================

create table if not exists public.signature_requests (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.agreements (id) on delete cascade,
  agreement_version_id uuid not null references public.agreement_versions (id) on delete restrict,
  provider text not null default 'mock',
  provider_request_id text,
  status text not null default 'draft',
  signer_user_id uuid references auth.users (id) on delete set null,
  signer_name text not null,
  signer_email text not null,
  requested_at timestamptz,
  sent_at timestamptz,
  viewed_at timestamptz,
  signed_at timestamptz,
  declined_at timestamptz,
  cancelled_at timestamptz,
  expired_at timestamptz,
  signed_document_storage_path text,
  provider_metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint signature_requests_status_check check (status in ('draft', 'pending', 'sent', 'viewed', 'signed', 'declined', 'cancelled', 'expired', 'failed')),
  constraint signature_requests_signer_email_format_check check (signer_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint signature_requests_signer_name_not_blank_check check (length(trim(signer_name)) > 0)
);

create index if not exists signature_requests_agreement_idx on public.signature_requests (agreement_id);
create index if not exists signature_requests_version_idx on public.signature_requests (agreement_version_id);
create index if not exists signature_requests_status_idx on public.signature_requests (status);
create index if not exists signature_requests_signer_user_idx on public.signature_requests (signer_user_id);

-- The actual "no duplicate active signature request for one version" guard
-- — a partial unique index, enforced at the database level regardless of
-- whether application code remembers to check first (src/lib/signatures/
-- rules.ts also checks this up front, for a friendly error message, but
-- THIS is what makes it impossible to violate even under a race).
create unique index if not exists signature_requests_one_active_per_version
  on public.signature_requests (agreement_version_id)
  where status in ('draft', 'pending', 'sent', 'viewed');

comment on table public.signature_requests is
  'Milestone 10 (F-122). One row per e-signature request. status is provider-driven: draft/pending/sent are the in-flight creation states; viewed/signed/declined/expired are ONLY ever written by the verified webhook path (public.apply_signature_webhook_event(), PART 6) — no application code path lets an admin set any of those four directly, because a signature outcome is a fact the PROVIDER reports, never something this application (or a browser) gets to assert on its own ("never trust a client-reported signature status" — spec). cancelled is the one non-terminal->terminal transition an admin CAN perform directly (explicit "Cancel Request" action, gated by agreements:write, only from a non-terminal status, never after signed) via the normal RLS-respecting write path below. signature_requests_one_active_per_version prevents more than one non-terminal request existing for the same agreement_versions row at a time. Ownership for RLS is always resolved via the PARENT agreement (agreements.student_user_id), never via signer_user_id — see this PART''s header comment for the full IDOR-relevant reasoning.';

alter table public.signature_requests enable row level security;

drop policy if exists "Admins/finance/assigned counsellor/owning student can read signature requests" on public.signature_requests;
create policy "Admins/finance/assigned counsellor/owning student can read signature requests"
  on public.signature_requests for select to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin', 'finance'])
    or exists (
      select 1 from public.agreements a
      where a.id = signature_requests.agreement_id
        and (
          (public.is_admin_role(array['counsellor']) and a.counsellor_id = public.current_counsellor_id())
          or a.student_user_id = auth.uid()
        )
    )
  );

drop policy if exists "super_admin/admin can create signature requests" on public.signature_requests;
create policy "super_admin/admin can create signature requests"
  on public.signature_requests for insert to authenticated
  with check (public.is_admin_role(array['super_admin', 'admin']));

drop policy if exists "super_admin/admin can update signature requests" on public.signature_requests;
create policy "super_admin/admin can update signature requests"
  on public.signature_requests for update to authenticated
  using (public.is_admin_role(array['super_admin', 'admin']))
  with check (public.is_admin_role(array['super_admin', 'admin']));

-- No delete policy for anyone — a request that should stop being active is
-- cancelled, never deleted, so its full history (who was asked to sign
-- what, and what happened) is always retained.
--
-- The webhook route carries NO Supabase session at all (same as
-- src/app/api/webhooks/razorpay/route.ts) — it cannot use this INSERT/
-- UPDATE policy (there is no `authenticated` role to satisfy it). Its sole
-- write path is public.apply_signature_webhook_event() (PART 6), a
-- SECURITY DEFINER function that independently re-verifies the provider's
-- webhook signature before writing anything — see that function's own
-- comment for the full rationale, mirroring public.apply_webhook_event()
-- (0005_payments_billing.sql PART 8) exactly.

drop trigger if exists set_signature_requests_updated_at on public.signature_requests;
create trigger set_signature_requests_updated_at before update on public.signature_requests for each row execute function public.set_updated_at();


-- ----------------------------------------------------------------------------
-- PART 2.1 — create_signature_request(): atomically locks a draft
-- agreement_versions row and inserts its signature_requests row in one
-- statement, so "Send for Signature" can never partially apply (a version
-- locked with no request, or a request against a version that never got
-- locked) even if the calling admin session's connection drops between
-- two separate client calls.
--
-- SECURITY INVOKER (the default), NOT DEFINER: this still needs to go
-- through agreement_versions/signature_requests' own RLS exactly as a
-- plain client-side UPDATE + INSERT would — it exists purely for
-- atomicity, not to grant any privilege the caller doesn't already have
-- (only super_admin/admin can UPDATE agreement_versions or INSERT
-- signature_requests, same as everywhere else in this migration). `for
-- update` row-locks the version for the duration of this call, so two
-- concurrent "Send for Signature" clicks against the SAME draft version
-- can never both succeed (the second sees status already 'locked' and
-- raises) — on top of, not instead of, signature_requests_one_active_
-- per_version's own database-level guarantee.
-- ----------------------------------------------------------------------------

create or replace function public.create_signature_request(
  p_agreement_version_id uuid,
  p_signer_name text,
  p_signer_email text,
  p_provider text default 'mock'
)
returns public.signature_requests
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_version public.agreement_versions;
  v_request public.signature_requests;
begin
  select * into v_version from public.agreement_versions where id = p_agreement_version_id for update;
  if v_version.id is null then
    raise exception 'Agreement version not found.';
  end if;
  if v_version.status <> 'draft' then
    raise exception 'Agreement version must be in draft status to send for signature (current status: %).', v_version.status;
  end if;
  if p_signer_name is null or length(trim(p_signer_name)) = 0 then
    raise exception 'Signer name is required.';
  end if;
  if p_signer_email is null or p_signer_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'A valid signer email is required.';
  end if;

  update public.agreement_versions set status = 'locked' where id = v_version.id;

  insert into public.signature_requests (
    agreement_id, agreement_version_id, provider, signer_name, signer_email, status, requested_at, created_by
  ) values (
    v_version.agreement_id, v_version.id, coalesce(nullif(trim(p_provider), ''), 'mock'), trim(p_signer_name), lower(trim(p_signer_email)), 'pending', now(), auth.uid()
  )
  returning * into v_request;

  return v_request;
end;
$$;

comment on function public.create_signature_request(uuid, text, text, text) is
  'Atomically locks a draft agreement_versions row and inserts its (status=''pending'') signature_requests row in one statement. SECURITY INVOKER — fully subject to agreement_versions/signature_requests'' own RLS, exists only for atomicity (see this PART''s header comment), grants no privilege the caller does not already have via those tables'' normal super_admin/admin-only write policies. Called from src/lib/supabase/admin/signatures.ts sendForSignature(), which then calls the provider adapter and, in a second, ordinary single-row UPDATE, records the provider''s response (provider_request_id, and status moving to ''sent'' if the provider confirms delivery synchronously).';

revoke execute on function public.create_signature_request(uuid, text, text, text) from public;
grant execute on function public.create_signature_request(uuid, text, text, text) to authenticated;


-- ============================================================================
-- PART 3 — Keep agreements.signature_status in sync with the current
-- signature_requests row, at the DATABASE layer (not trusted to
-- application code) — "a DB trigger is more robust against bypassing the
-- app layer, matching this codebase's general preference for DB-enforced
-- invariants over application-trusted ones" (spec).
--
-- public.agreements.signature_status only has three coarse values
-- (not_started/pending_signature/signed — 0004_admin_system.sql PART 8,
-- untouched by this migration). The real, detailed state lives on
-- signature_requests.status; this trigger is only responsible for
-- collapsing that detail into the existing coarse column. Mapping:
--   signed                                   -> 'signed'
--   cancelled                                -> 'not_started' (the process
--                                                was called off; nothing is
--                                                pending until a new
--                                                request is sent)
--   draft/pending/sent/viewed/declined/
--   expired/failed                           -> 'pending_signature' (a
--                                                process is or was in
--                                                flight and needs
--                                                attention/follow-up)
-- ============================================================================

create or replace function public.sync_agreement_signature_status()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
declare
  v_mapped text;
begin
  v_mapped := case
    when new.status = 'signed' then 'signed'
    when new.status = 'cancelled' then 'not_started'
    else 'pending_signature'
  end;

  update public.agreements
    set signature_status = v_mapped
    where id = new.agreement_id and signature_status is distinct from v_mapped;

  return new;
end;
$$;

comment on function public.sync_agreement_signature_status() is
  'AFTER INSERT OR UPDATE trigger on signature_requests: collapses the detailed signature_requests.status into agreements.signature_status''s existing coarse three-value vocabulary (see this PART''s header comment for the exact mapping). SECURITY DEFINER so it works identically regardless of which write path fired it (a direct admin RLS-respecting write, or public.apply_signature_webhook_event()''s elevated write) — updating agreements is otherwise restricted to super_admin/admin by that table''s own RLS (0004_admin_system.sql PART 8), which a webhook delivery could never satisfy on its own.';

drop trigger if exists sync_agreement_signature_status on public.signature_requests;
create trigger sync_agreement_signature_status
  after insert or update on public.signature_requests
  for each row execute function public.sync_agreement_signature_status();

revoke execute on function public.sync_agreement_signature_status() from public;


-- ============================================================================
-- PART 4 — signature_webhook_events (idempotency ledger)
--
-- Modeled directly on public.payment_webhook_events
-- (0005_payments_billing.sql PART 8) — same shape, same
-- unique(provider, event_id) idempotency guard, same append-only,
-- admin-readable-only posture.
-- ============================================================================

create table if not exists public.signature_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'mock',
  event_id text not null,
  event_type text not null,
  processing_status text not null default 'received',
  related_signature_request_id uuid references public.signature_requests (id) on delete set null,
  related_agreement_id uuid references public.agreements (id) on delete set null,
  diagnostic_message text,
  payload_summary jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint signature_webhook_events_processing_status_check check (processing_status in ('received', 'processed', 'ignored', 'failed')),
  constraint signature_webhook_events_provider_event_unique unique (provider, event_id)
);

create index if not exists signature_webhook_events_type_idx on public.signature_webhook_events (event_type);
create index if not exists signature_webhook_events_created_at_idx on public.signature_webhook_events (created_at);
create index if not exists signature_webhook_events_request_idx on public.signature_webhook_events (related_signature_request_id);

comment on table public.signature_webhook_events is
  'Milestone 10 — append-only ledger of every signature-provider webhook delivery this system has verified and accepted for processing, modeled directly on public.payment_webhook_events. `event_id` is a deterministic fingerprint (SHA-256 hex of the raw, signature-verified request body — see PART 6''s apply_signature_webhook_event()), NOT a header a provider is guaranteed to send; signature_webhook_events_provider_event_unique is the actual duplicate-delivery guard.';

alter table public.signature_webhook_events enable row level security;

drop policy if exists "super_admin/admin can read signature webhook events" on public.signature_webhook_events;
create policy "super_admin/admin can read signature webhook events"
  on public.signature_webhook_events for select to authenticated
  using (public.is_admin_role(array['super_admin', 'admin']));

-- Deliberately no insert/update/delete policy for any client role — the
-- only write path is public.apply_signature_webhook_event() (PART 6),
-- SECURITY DEFINER, same as payment_webhook_events' own equivalent note.


-- ============================================================================
-- PART 5 — signature_provider_config (server-side-only webhook secret)
--
-- Modeled directly on public.payment_gateway_config
-- (0005_payments_billing.sql PART 2): RLS enabled with NO policies for any
-- role — unreachable via the normal Supabase client/dashboard-as-API,
-- only readable from inside a SECURITY DEFINER function body. Populated
-- manually — see BOOTSTRAP at the end of this file.
-- ============================================================================

create table if not exists public.signature_provider_config (
  id integer primary key default 1,
  webhook_secret text,
  updated_at timestamptz not null default now(),
  constraint signature_provider_config_singleton_check check (id = 1)
);

comment on table public.signature_provider_config is
  'Milestone 10 — server-side-only copy of the signature-provider webhook HMAC secret (same value as the SIGNATURE_WEBHOOK_SECRET environment variable — see docs/milestones/M10-electronic-signature.md for why both exist, mirroring public.payment_gateway_config/RAZORPAY_WEBHOOK_SECRET''s established precedent). RLS is enabled with NO policies for any role — this table is intentionally unreachable via the normal Supabase client, only via apply_signature_webhook_event() below. Populated manually, see this migration''s BOOTSTRAP section.';

alter table public.signature_provider_config enable row level security;
-- No policies at all, for any role — see comment above.

insert into public.signature_provider_config (id, webhook_secret)
values (1, null)
on conflict (id) do nothing;

drop trigger if exists set_signature_provider_config_updated_at on public.signature_provider_config;
create trigger set_signature_provider_config_updated_at before update on public.signature_provider_config for each row execute function public.set_updated_at();


-- ============================================================================
-- PART 6 — apply_signature_webhook_event(): the one entry point for
-- verified signature-provider webhook deliveries.
--
-- Mirrors public.apply_webhook_event() (0005_payments_billing.sql PART 8)
-- exactly in structure: independently re-verifies the webhook HMAC
-- signature against signature_provider_config before trusting anything in
-- the body (the verification IS the authorization — this function is
-- granted to `anon` because the webhook route carries no session at all,
-- same as apply_webhook_event()); idempotent via
-- signature_webhook_events_provider_event_unique (a SHA-256 fingerprint of
-- the verified raw body); "only move forward" status-rank logic prevents a
-- late/out-of-order event from downgrading an already-further-along
-- request.
--
-- WHY THIS SIGNATURE SCHEME (not deferring to src/lib/signatures/
-- provider.ts entirely): this codebase''s provider abstraction
-- (src/lib/signatures/provider.ts) is intentionally generic so a future
-- real e-signature provider can be plugged in without touching business
-- logic — but a SQL function cannot execute arbitrary provider-specific
-- verification code. HMAC-SHA256 is the verification scheme this
-- application''s OWN webhook endpoint uses (documented in
-- docs/milestones/M10-electronic-signature.md as the "NextWise webhook
-- envelope") — the same widely-supported scheme DocuSign Connect, Dropbox
-- Sign, and most providers offer as a configurable HMAC secret. A real
-- provider integration''s adapter is responsible for either (a) configuring
-- that provider to sign with a shared secret matching this scheme, or (b)
-- an application-layer bridge that re-signs a verified provider payload
-- into this envelope before forwarding it here — either way, this
-- function''s OWN verification never trusts an unverified client, matching
-- apply_webhook_event()''s core guarantee.
-- ============================================================================

create or replace function public.apply_signature_webhook_event(
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
  v_request public.signature_requests;
  v_suffix text;
  v_new_status text;
  v_rank_old integer;
  v_rank_new integer;
  v_diagnostic text := null;
  v_processing_status text := 'ignored';
  v_action text;
  v_timestamp_col text;
begin
  -- NOTE ON FAILURE HANDLING BELOW: every failure branch in this section
  -- RETURNS a {valid: false, ...} jsonb value instead of RAISE-ing an
  -- exception. This is a deliberate departure from public.apply_webhook_
  -- event()'s raise-on-invalid-signature style (0005_payments_billing.sql
  -- PART 8): a RAISE EXCEPTION aborts and rolls back the ENTIRE calling
  -- transaction, including this function's own record_system_audit_log()
  -- insert a few lines above it — so a raise here would silently discard
  -- the very SIGNATURE_WEBHOOK_FAILED audit entry it just wrote. Returning
  -- normally lets that insert commit; src/app/api/webhooks/signature/
  -- route.ts checks the returned `valid` field and maps it to the
  -- appropriate HTTP status itself (400 for a bad signature/body, 503 for
  -- "not configured").
  if p_raw_body is null or p_signature is null then
    return jsonb_build_object('valid', false, 'reason', 'missing_body_or_signature');
  end if;

  select webhook_secret into v_secret from public.signature_provider_config where id = 1;
  if v_secret is null or length(trim(v_secret)) = 0 then
    perform public.record_system_audit_log(
      'SIGNATURE_WEBHOOK_FAILED', 'signature_webhook', null,
      'Rejected a signature webhook delivery — no webhook secret configured.',
      null, jsonb_build_object('reason', 'not_configured')
    );
    return jsonb_build_object('valid', false, 'reason', 'not_configured');
  end if;

  v_expected := encode(hmac(p_raw_body, v_secret, 'sha256'), 'hex');
  if v_expected <> p_signature then
    perform public.record_system_audit_log(
      'SIGNATURE_WEBHOOK_FAILED', 'signature_webhook', null,
      'Rejected a signature webhook delivery — invalid signature.',
      null, jsonb_build_object('reason', 'invalid_signature')
    );
    return jsonb_build_object('valid', false, 'reason', 'invalid_signature');
  end if;

  begin
    v_body := p_raw_body::jsonb;
  exception when others then
    perform public.record_system_audit_log(
      'SIGNATURE_WEBHOOK_FAILED', 'signature_webhook', null,
      'Rejected a signature webhook delivery — body was not valid JSON.',
      null, jsonb_build_object('reason', 'invalid_json')
    );
    return jsonb_build_object('valid', false, 'reason', 'invalid_json');
  end;

  v_event_type := v_body ->> 'eventType';
  v_provider := coalesce(v_body ->> 'provider', 'mock');
  v_provider_request_id := v_body ->> 'providerRequestId';
  v_metadata := coalesce(v_body -> 'metadata', '{}'::jsonb);

  -- Idempotency: reserve this event_id first (fingerprint of the verified
  -- raw body). If it already exists, this is a duplicate delivery —
  -- return immediately without touching any other table.
  v_fingerprint := encode(digest(p_raw_body, 'sha256'), 'hex');
  insert into public.signature_webhook_events (provider, event_id, event_type, processing_status)
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
    from public.signature_requests
    where provider = v_provider and provider_request_id = v_provider_request_id;

    if v_request.id is null then
      v_diagnostic := 'No matching signature_requests row for this provider_request_id — event ignored.';
    else
      -- 'signature_request.<suffix>' -> <suffix> is the new status.
      v_suffix := nullif(split_part(v_event_type, '.', 2), '');
      v_new_status := case v_suffix
        when 'sent' then 'sent'
        when 'viewed' then 'viewed'
        when 'signed' then 'signed'
        when 'declined' then 'declined'
        when 'cancelled' then 'cancelled'
        when 'expired' then 'expired'
        when 'failed' then 'failed'
        else null
      end;

      if v_new_status is null then
        v_diagnostic := format('Unrecognized event type "%s" — recorded, not processed.', v_event_type);
      else
        -- "Only move forward": rank each status by how far along the
        -- signing journey it represents, and refuse to let a late/
        -- out-of-order event move a request backward. Terminal states
        -- (signed/declined/cancelled/expired/failed) never move again.
        v_rank_old := case v_request.status
          when 'draft' then 0 when 'pending' then 1 when 'sent' then 2 when 'viewed' then 3
          when 'signed' then 9 when 'declined' then 9 when 'cancelled' then 9 when 'expired' then 9 when 'failed' then 9
          else 0
        end;
        v_rank_new := case v_new_status
          when 'sent' then 2 when 'viewed' then 3
          when 'signed' then 9 when 'declined' then 9 when 'cancelled' then 9 when 'expired' then 9 when 'failed' then 9
          else 0
        end;

        if v_rank_old >= 9 then
          v_diagnostic := format('Signature request %s is already in a terminal state (%s) — event ignored.', v_request.id, v_request.status);
        elsif v_rank_new < v_rank_old then
          v_diagnostic := format('Stale/out-of-order event (%s after %s) — ignored.', v_new_status, v_request.status);
        else
          v_timestamp_col := case v_new_status
            when 'sent' then 'sent_at' when 'viewed' then 'viewed_at' when 'signed' then 'signed_at'
            when 'declined' then 'declined_at' when 'cancelled' then 'cancelled_at' when 'expired' then 'expired_at'
            else null
          end;

          update public.signature_requests
            set status = v_new_status,
                sent_at = case when v_new_status = 'sent' then coalesce(sent_at, now()) else sent_at end,
                viewed_at = case when v_new_status = 'viewed' then coalesce(viewed_at, now()) else viewed_at end,
                signed_at = case when v_new_status = 'signed' then coalesce(signed_at, now()) else signed_at end,
                declined_at = case when v_new_status = 'declined' then coalesce(declined_at, now()) else declined_at end,
                cancelled_at = case when v_new_status = 'cancelled' then coalesce(cancelled_at, now()) else cancelled_at end,
                expired_at = case when v_new_status = 'expired' then coalesce(expired_at, now()) else expired_at end,
                provider_metadata = provider_metadata || v_metadata
            where id = v_request.id
            returning * into v_request;

          v_processing_status := 'processed';

          v_action := case v_new_status
            when 'sent' then 'SIGNATURE_REQUEST_SENT'
            when 'viewed' then 'SIGNATURE_REQUEST_VIEWED'
            when 'signed' then 'SIGNATURE_REQUEST_SIGNED'
            when 'declined' then 'SIGNATURE_REQUEST_DECLINED'
            when 'cancelled' then 'SIGNATURE_REQUEST_CANCELLED'
            when 'expired' then 'SIGNATURE_REQUEST_EXPIRED'
            when 'failed' then 'SIGNATURE_REQUEST_FAILED'
          end;
          perform public.record_system_audit_log(
            v_action, 'signature_request', v_request.id::text,
            format('Signature request moved to "%s" via verified %s webhook.', v_new_status, v_provider),
            null,
            jsonb_build_object('provider', v_provider, 'provider_request_id', v_provider_request_id, 'agreement_id', v_request.agreement_id, 'agreement_version_id', v_request.agreement_version_id)
          );
        end if;
      end if;
    end if;
  end if;

  update public.signature_webhook_events
    set processing_status = v_processing_status,
        related_signature_request_id = v_request.id,
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
    'signature_request_id', v_request.id,
    'agreement_id', v_request.agreement_id,
    'status', v_request.status,
    'provider', v_provider,
    'provider_request_id', v_provider_request_id
  );
end;
$$;

comment on function public.apply_signature_webhook_event(text, text) is
  'The only entry point for signature-provider webhook deliveries. Independently re-verifies the webhook HMAC-SHA256 signature against signature_provider_config before trusting any field in the body. Idempotent via signature_webhook_events_provider_event_unique (a SHA-256 fingerprint of the verified raw body). Only ever moves a signature_requests row FORWARD through draft/pending/sent/viewed/signed|declined|cancelled|expired|failed — a stale/out-of-order/duplicate event is recorded but never applied. Every successful status change, and every rejected-signature/malformed-body failure, is also written to admin_audit_log via record_system_audit_log() (actor_role=''system''). Returns `{valid: false, reason: ...}` rather than raising on a verification failure — see this function body''s own leading comment for why (a raised exception would roll back the very audit-log insert it just made); the calling route handler is what actually maps `valid: false` to an HTTP 400/503.';


-- ============================================================================
-- PART 6.1 — set_signature_document_path(): narrow helper the webhook
-- route calls AFTER it has uploaded the signed document bytes to Storage
-- (Storage upload is a Node-side operation — see src/app/api/webhooks/
-- signature/route.ts — this function only records where the result
-- landed). SECURITY DEFINER for the same reason as PART 6: the webhook
-- route carries no session, and only super_admin/admin can normally
-- UPDATE signature_requests.
-- ============================================================================

create or replace function public.set_signature_document_path(
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

  update public.signature_requests
    set signed_document_storage_path = p_storage_path
    where provider = p_provider and provider_request_id = p_provider_request_id and status = 'signed'
    returning id into v_id;

  if v_id is null then
    raise exception 'No signed signature_requests row found for this provider/provider_request_id.';
  end if;

  return jsonb_build_object('signature_request_id', v_id);
end;
$$;

comment on function public.set_signature_document_path(text, text, text) is
  'Records where the signed document bytes were uploaded in Storage, for a signature_requests row that is already status=''signed''. Only ever called by src/app/api/webhooks/signature/route.ts, right after it uploads the bytes returned by the provider adapter''s getSignedDocument() — never accepts or trusts a status change itself (the row must already be ''signed'', set only via apply_signature_webhook_event()).';


-- ============================================================================
-- PART 6.2 — record_system_audit_log(): the one way a call with NO admin
-- session (a verified webhook delivery) can still write to admin_audit_log
-- (0004_admin_system.sql PART 11). Writes to the EXACT SAME table
-- record_admin_audit_log() does — never a second audit table.
-- record_admin_audit_log() itself cannot be used here because it requires
-- public.current_admin_role() to be non-null (i.e. a real signed-in admin
-- session), which a webhook delivery never has.
-- ============================================================================

create or replace function public.record_system_audit_log(
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_summary text,
  p_changes jsonb default null,
  p_context jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.admin_audit_log (actor_user_id, actor_role, action, entity_type, entity_id, summary, changes, context)
  values (null, 'system', p_action, p_entity_type, p_entity_id, p_summary, p_changes, p_context)
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.record_system_audit_log(text, text, text, text, jsonb, jsonb) is
  'System-actor sibling of public.record_admin_audit_log() (0004_admin_system.sql PART 11) for audit entries that originate from a verified webhook delivery, not a signed-in admin session — actor_user_id is always null and actor_role is always the literal string ''system'', never forgeable as a real admin. NOT reachable by any client role (see the REVOKE in PART 6.3, and note there is deliberately no GRANT to anon or authenticated either) — Postgres lets a SECURITY DEFINER function call another function owned by the same role without a separate EXECUTE grant, which is the only way this is ever invoked (from inside apply_signature_webhook_event(), PART 6).';


-- ----------------------------------------------------------------------------
-- PART 6.3 — Explicit function execution privileges (same discipline as
-- 0005_payments_billing.sql PART 10 / 0007_nextwise_pricing_offers.sql
-- PART 7.1 apply to their own functions).
-- ----------------------------------------------------------------------------

revoke execute on function public.apply_signature_webhook_event(text, text) from public;
revoke execute on function public.set_signature_document_path(text, text, text) from public;
revoke execute on function public.record_system_audit_log(text, text, text, text, jsonb, jsonb) from public;
revoke execute on function public.prevent_agreement_version_mutation() from public;

-- Called only from src/app/api/webhooks/signature/route.ts, which carries
-- no Supabase session at all — there is no unauthenticated signature
-- webhook processing path other than these two functions' own independent
-- verification (apply_signature_webhook_event's HMAC check;
-- set_signature_document_path's requirement that a matching row already
-- be status='signed', which only apply_signature_webhook_event can have
-- set).
grant execute on function public.apply_signature_webhook_event(text, text) to anon;
grant execute on function public.set_signature_document_path(text, text, text) to anon;

-- record_system_audit_log() deliberately has NO grant to anon or
-- authenticated — see its own comment above.


-- ============================================================================
-- PART 7 — Extend admin_audit_log usage (via the EXISTING
-- record_admin_audit_log() / src/lib/admin/audit.ts path) for every
-- ADMIN-INITIATED event in the spec's audit list. This migration does not
-- add any new table or function for these — application code
-- (src/lib/supabase/admin/signatures.ts) calls the exact same
-- recordAuditLog() wrapper every other admin module already uses, with
-- actions AGREEMENT_VERSION_CREATED / SIGNATURE_REQUEST_CREATED (whose
-- summary also records that it locked the version it was created against)
-- / SIGNATURE_REQUEST_RESENT / SIGNATURE_REQUEST_CANCELLED. The
-- provider-driven events
-- (SIGNATURE_REQUEST_SENT/_VIEWED/_SIGNED/_DECLINED/_EXPIRED/_FAILED and
-- SIGNATURE_WEBHOOK_FAILED) are written by PART 6/6.2 above instead, since
-- they originate from the webhook, not an admin session. Documented here,
-- in one place, so the full audit vocabulary for this milestone is
-- findable without hunting across two files.
-- ============================================================================


-- ============================================================================
-- PART 8 — Storage RLS for the private 'signed-agreements' bucket.
--
-- THE BUCKET ITSELF MUST BE CREATED MANUALLY — see BOOTSTRAP at the end of
-- this file. These policies are safe to apply before the bucket exists
-- (they are just permission rules keyed on bucket_id, a plain text
-- comparison) and take effect the moment it does.
--
-- Path convention (enforced by src/lib/storage/signed-documents.ts, the
-- only code path that ever uploads into this bucket): every object's
-- `name` is `<agreement_id>/<signature_request_id>/<filename>`. Every
-- policy below re-derives ownership from that path by joining back to
-- signature_requests/agreements — never from storage.objects.owner or any
-- other Storage-native identity concept, since the actual authorization
-- boundary (who may see WHICH student's signed agreement) is exactly the
-- same one signature_requests/agreements' own RLS already expresses.
--
-- No public/anon read policy exists here at all — a private bucket with
-- no public SELECT policy for `anon` means a raw object URL is never
-- fetchable without a short-lived signed URL generated server-side (see
-- src/lib/storage/signed-documents.ts createSignedDownloadUrl()), which
-- itself still requires the generating request to satisfy one of the
-- SELECT policies below.
-- ============================================================================

drop policy if exists "super_admin/admin can upload signed agreement documents" on storage.objects;
create policy "super_admin/admin can upload signed agreement documents"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'signed-agreements'
    and public.is_admin_role(array['super_admin', 'admin'])
  );

drop policy if exists "Admins/finance/assigned counsellor/owning student can read signed agreement documents" on storage.objects;
create policy "Admins/finance/assigned counsellor/owning student can read signed agreement documents"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'signed-agreements'
    and (
      public.is_admin_role(array['super_admin', 'admin', 'finance'])
      or (
        -- Guard the ::uuid cast behind a regex match first — a malformed
        -- object name (never produced by src/lib/storage/signed-documents.ts,
        -- but RLS `using` clauses must not error on unexpected input, or
        -- the whole query aborts instead of just excluding that one row)
        -- must short-circuit to "no match" rather than raise.
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

-- Deliberately no update/delete policy for anyone — a signed document, once
-- stored, is never overwritten or removed through the application; it is
-- append-only, matching the immutable-artifact posture of everything else
-- in this migration.


-- ============================================================================
-- PART 9 — Widen product_events.event_name (0010_product_events_and_
-- outcomes.sql PART 1) to accept the five signature product events this
-- milestone's spec lists. The ONLY additive touch this migration makes to
-- an existing table's constraint — every previously-accepted name stays
-- accepted; nothing is removed or renamed. Must be kept in sync with
-- src/lib/analytics/events.ts''s PRODUCT_EVENTS registry, same discipline
-- 0010''s own header comment already documents.
-- ============================================================================

alter table public.product_events drop constraint if exists product_events_event_name_check;
alter table public.product_events add constraint product_events_event_name_check check (event_name in (
  -- Auth / account
  'user_registered',
  'user_logged_in',
  -- Student profile
  'profile_started',
  'profile_completed',
  -- Assessment / quiz — RESERVED, never fired: no assessment/quiz UI
  -- exists in this codebase yet. See docs/M9_EVENT_TAXONOMY.md.
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
  'agreement_signature_cancelled'
));


-- ============================================================================
-- PART 10 — Verification queries (run manually after applying this
-- migration; not executed automatically by this file). Same pattern as
-- 0005_payments_billing.sql PART 11 / 0007 PART 8.
--
-- 1) `anon` should be able to execute the two webhook-facing functions;
--    `authenticated`/PUBLIC should not be able to reach
--    record_system_audit_log at all:
--
-- select
--   has_function_privilege('anon', 'public.apply_signature_webhook_event(text,text)', 'execute') as anon_can_webhook,
--   has_function_privilege('anon', 'public.set_signature_document_path(text,text,text)', 'execute') as anon_can_set_path,
--   has_function_privilege('authenticated', 'public.record_system_audit_log(text,text,text,text,jsonb,jsonb)', 'execute') as authenticated_can_system_log,
--   has_function_privilege('anon', 'public.record_system_audit_log(text,text,text,text,jsonb,jsonb)', 'execute') as anon_can_system_log;
-- -- expected: true, true, false, false
--
-- 2) The immutability trigger blocks a mutation on a locked version, as a
--    super_admin:
--
-- update public.agreement_versions set content_reference_url = 'https://example.com/tampered'
--   where status = 'locked' limit 1;
-- -- expected: raises "A locked or superseded agreement version is
-- -- immutable — create a new version instead of editing this one."
--
-- 3) The partial unique index blocks a second active request for the same
--    version:
--
-- insert into public.signature_requests (agreement_id, agreement_version_id, signer_name, signer_email, status)
--   select agreement_id, agreement_version_id, signer_name, signer_email, 'pending'
--   from public.signature_requests where status in ('sent', 'pending', 'viewed') limit 1;
-- -- expected: raises a unique-constraint violation on
-- -- signature_requests_one_active_per_version
--
-- 4) A signed-out (anon) client should see zero rows on every new table:
--
-- select count(*) from public.agreement_versions;      -- expect 0 as anon
-- select count(*) from public.signature_requests;       -- expect 0 as anon
-- select count(*) from public.signature_webhook_events; -- expect 0 as anon
-- select count(*) from public.signature_provider_config; -- expect 0 as anon (no policy at all)
--
-- 5) An invalid webhook signature is rejected without touching
--    signature_requests, but IS recorded to admin_audit_log (run as anon,
--    after BOOTSTRAP step 1 below):
--
-- select public.apply_signature_webhook_event('{"eventType":"signature_request.signed"}', 'not-the-real-signature');
-- -- expected: returns {"valid": false, "reason": "invalid_signature"}
-- select action, entity_type, actor_role from public.admin_audit_log where action = 'SIGNATURE_WEBHOOK_FAILED' order by created_at desc limit 1;
-- -- expected: one row, actor_role = 'system'
-- ============================================================================


-- ============================================================================
-- BOOTSTRAP — manual steps required after applying this migration
--
-- 1) Set the webhook secret. Choose a long random string, put it in your
--    deployment's SIGNATURE_WEBHOOK_SECRET environment variable, AND run
--    this statement with the SAME value (this table cannot be populated
--    any other way — it has no client-reachable write policy):
--
-- update public.signature_provider_config set webhook_secret = 'paste-the-same-value-as-SIGNATURE_WEBHOOK_SECRET-here' where id = 1;
--
--    Local/dev note: if you leave this unset, src/lib/signatures/config.ts
--    falls back to a fixed, clearly-labeled development-only secret
--    (NEVER used when NODE_ENV=production) so the mock provider's full
--    request -> webhook loop still works out of the box for local testing
--    — see that file's own comment.
--
-- 2) Create the private Storage bucket (Supabase dashboard -> Storage ->
--    New bucket):
--      Name: signed-agreements
--      Public bucket: UNCHECKED (must stay private — PART 8's RLS
--        policies are the only way in, and they only work against a
--        private bucket; a public bucket bypasses them entirely)
--    This cannot be done from SQL — Supabase Storage buckets are created
--    through the Storage API/dashboard, not a migration.
-- ============================================================================
