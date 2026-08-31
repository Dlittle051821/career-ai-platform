-- ============================================================================
-- Trusted Global Course Search — provider-adapter data model
--
-- HOW TO RUN THIS (no SQL knowledge required):
--   1. Open your Supabase project dashboard (supabase.com/dashboard).
--   2. Click "SQL Editor" in the left sidebar.
--   3. Click "New query".
--   4. Paste the entire contents of this file.
--   5. Click "Run".
--   6. Then run supabase/seed/0006_trusted_course_search_seed.sql once (see
--      that file's own header) to load the trusted-provider catalogue.
--
-- Safe to run once. Re-running is also safe — every statement is written to
-- not fail if already applied (`create table if not exists` / `drop policy
-- if exists` before `create policy` / `create index if not exists`), same
-- convention as 0001-0008.
--
-- This migration does NOT modify 0001-0008 in place. It only ADDS three new
-- tables. supabase/migrations/0006_global_university_course_data.sql's
-- `public.countries`/`public.courses` tables are read (courses.education_level
-- values, countries.iso_alpha2) but never altered.
--
-- WHAT THIS FILE ADDS, IN ONE SENTENCE EACH:
--   - external_search_providers   one row per trusted official course-search
--                                  portal (DAAD, UCAS, EduCanada, ...).
--   - external_search_mappings    admin-verified subject+degree+destination
--                                  deep links / manual-search instructions
--                                  scoped to one provider.
--   - external_search_clicks      privacy-conscious, append-only outbound
--                                  click + "mapping needed" search-gap log.
--
-- DESIGN NOTE — canonical_subject_id is plain text, not a foreign key to a
-- new lookup table. The subject taxonomy (Mechanical Engineering + aliases +
-- related subjects + misspelling normalization) is deliberately hand-curated
-- TypeScript data (src/lib/education/external-search/taxonomy.ts), not a
-- database table — see that file's docblock for why (auditability,
-- exhaustive unit-testability, no fuzzy-matching library). This mirrors how
-- 0006_global_university_course_data.sql already keeps `courses.subject_area`
-- / `courses.discipline` as plain text columns rather than a separate lookup
-- table. `external_search_mappings.canonical_subject_id` stores the stable
-- taxonomy `id` slug (e.g. 'mechanical-engineering') as plain text — a
-- foreign key to a DB table would just duplicate content that already lives
-- in, and is tested from, the TypeScript source.
--
-- DESIGN NOTE — destination_country_code / providers.country_code reference
-- `public.countries.iso_alpha2`, NOT a `country_code` column. The base
-- schema's `public.countries` table (0006_global_university_course_data.sql
-- PART 1) has no `country_code` column — its ISO 3166-1 alpha-2 value is
-- named `iso_alpha2`. This migration reuses that exact existing column
-- (never adds a redundant duplicate) as the natural "country code" foreign
-- key target throughout.
--
-- SECURITY DESIGN NOTE: this migration defines exactly one new function,
-- a BEFORE INSERT trigger (stamp_external_search_click) that mirrors
-- 0007_nextwise_pricing_offers.sql's stamp_pricing_analytics_event() —
-- plain SECURITY INVOKER, no elevated privilege, only ever touches the row
-- already being inserted. No SECURITY DEFINER function is added: every
-- write here goes through the calling admin's own authenticated session
-- and RLS, exactly like every other admin-writable table in this codebase.
-- ============================================================================


-- ============================================================================
-- PART 1 — external_search_providers
-- ============================================================================

create table if not exists public.external_search_providers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  -- Nullable: a small number of providers are not scoped to one destination
  -- country (Erasmus Mundus Joint Masters is "Europe-wide").
  country_code text references public.countries (iso_alpha2) on delete set null,
  region text,
  provider_type text not null default 'course_search',
  official_domain text not null,
  base_url text not null,
  fallback_url text,
  strategy text not null,
  description text,
  warning_text text,
  warning_effective_at date,
  warning_review_at date,
  language text,
  -- Defaults to FALSE: a provider seeded from only a bare domain (spec:
  -- "verify... before activation") must never be live for a student until
  -- an admin has actually verified it — see PART 4's safety review and
  -- supabase/seed/0006_trusted_course_search_seed.sql's provider-by-provider
  -- active/inactive decisions.
  active boolean not null default false,
  last_verified_at date,
  verified_by uuid references auth.users (id) on delete set null,
  -- Empty array = usable for every canonical degree level. A non-empty
  -- array restricts this provider to ONLY those levels — the actual
  -- enforcement mechanism behind "Do not show Erasmus Mundus as a normal
  -- Bachelor's search provider" (src/lib/education/external-search/adapter.ts
  -- reads this column, not a hardcoded provider slug check).
  supported_degree_levels text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_search_providers_type_check
    check (provider_type in ('course_search', 'institution_verification', 'joint_programme')),
  constraint external_search_providers_strategy_check
    check (strategy in ('verified_deep_link', 'query_parameter_search', 'official_landing_page', 'manual_search_instructions')),
  -- Basic domain-shape guard (defense in depth alongside the application-
  -- layer check in src/lib/education/external-search/url-validation.ts) —
  -- lowercase, dot-separated labels, no scheme/path/whitespace.
  constraint external_search_providers_domain_format_check
    check (official_domain = lower(official_domain) and official_domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'),
  constraint external_search_providers_base_url_https_check check (base_url ~ '^https://'),
  constraint external_search_providers_fallback_url_https_check check (fallback_url is null or fallback_url ~ '^https://'),
  constraint external_search_providers_warning_dates_check
    check (warning_effective_at is null or warning_review_at is null or warning_review_at >= warning_effective_at),
  constraint external_search_providers_supported_degree_levels_check
    check (supported_degree_levels <@ array['bachelors', 'masters', 'doctorate', 'diploma_certificate', 'other']::text[])
);

create index if not exists external_search_providers_country_idx on public.external_search_providers (country_code);
create index if not exists external_search_providers_active_idx on public.external_search_providers (active);
create index if not exists external_search_providers_strategy_idx on public.external_search_providers (strategy);

comment on table public.external_search_providers is
  'Trusted Global Course Search — one row per officially-run course-search/verification portal a student can be pointed to. `active = false` is the seeded default for every provider whose spec entry gave only a bare domain ("verify... before activation") — see the seed file for exactly which providers were left inactive pending real human verification. Never delete a row here; deactivate instead (no delete RLS policy is defined below).';

comment on column public.external_search_providers.country_code is
  'References public.countries.iso_alpha2 (NOT a "country_code" column — the base schema names this field iso_alpha2; see this file''s header note). Null for a provider not scoped to one destination country (e.g. Erasmus Mundus).';

comment on column public.external_search_providers.supported_degree_levels is
  'Canonical degree-level ids from src/lib/education/external-search/taxonomy.ts''s CANONICAL_DEGREE_LEVELS. Empty = no restriction. Erasmus Mundus is seeded as [''masters''] only.';

alter table public.external_search_providers enable row level security;

drop policy if exists "Anyone can read active trusted-search providers" on public.external_search_providers;
create policy "Anyone can read active trusted-search providers"
  on public.external_search_providers for select to anon, authenticated
  using (active = true);

drop policy if exists "super_admin/admin/analyst can read all trusted-search providers" on public.external_search_providers;
create policy "super_admin/admin/analyst can read all trusted-search providers"
  on public.external_search_providers for select to authenticated
  using (public.is_admin_role(array['super_admin', 'admin', 'analyst']));

drop policy if exists "super_admin/admin can create trusted-search providers" on public.external_search_providers;
create policy "super_admin/admin can create trusted-search providers"
  on public.external_search_providers for insert to authenticated
  with check (public.is_admin_role(array['super_admin', 'admin']));

drop policy if exists "super_admin/admin can update trusted-search providers" on public.external_search_providers;
create policy "super_admin/admin can update trusted-search providers"
  on public.external_search_providers for update to authenticated
  using (public.is_admin_role(array['super_admin', 'admin']))
  with check (public.is_admin_role(array['super_admin', 'admin']));

-- Deliberately no delete policy for anyone — a provider that should stop
-- being offered is deactivated (active = false), never deleted, so any
-- historical external_search_clicks/external_search_mappings row can always
-- be traced back to what provider it referred to.

drop trigger if exists set_external_search_providers_updated_at on public.external_search_providers;
create trigger set_external_search_providers_updated_at before update on public.external_search_providers for each row execute function public.set_updated_at();


-- ============================================================================
-- PART 2 — external_search_mappings
-- ============================================================================

create table if not exists public.external_search_mappings (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.external_search_providers (id) on delete cascade,
  -- Stable slug from src/lib/education/external-search/taxonomy.ts's
  -- SUBJECT_TAXONOMY (e.g. 'mechanical-engineering') — see this file's
  -- header note for why this is plain text, not a foreign key.
  canonical_subject_id text not null,
  degree_level text not null,
  destination_country_code text not null references public.countries (iso_alpha2),
  verified_url text,
  -- Admin-facing documentation ONLY (e.g. "fos[0]=96,subjectGroup[0]=56")
  -- — never read back into a URL-building function. See adapter.ts's
  -- header comment for why this distinction matters.
  provider_subject_code text,
  provider_degree_code text,
  search_term text,
  manual_instructions text,
  mapping_status text not null default 'draft',
  last_verified_at date,
  verified_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_search_mappings_degree_level_check
    check (degree_level in ('bachelors', 'masters', 'doctorate', 'diploma_certificate', 'other')),
  constraint external_search_mappings_status_check
    check (mapping_status in ('draft', 'verified', 'active', 'archived')),
  constraint external_search_mappings_subject_id_format_check
    check (canonical_subject_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint external_search_mappings_verified_url_https_check
    check (verified_url is null or verified_url ~ '^https://'),
  -- An 'active' mapping must carry something actually useful to a student —
  -- either a genuine deep link OR reviewed manual-search instructions (the
  -- UCAS "search for 'Mechanical Engineering'; select Undergraduate" example
  -- is exactly this second case: mapping_status='active', verified_url=null,
  -- manual_instructions set). This is a real, enforced, pre-publish safety
  -- gate — an admin cannot activate an empty mapping — not just a display
  -- convention. Whether an active mapping's verified_url specifically is
  -- also present is what src/lib/education/external-search/adapter.ts uses
  -- to decide between a true filtered deep link and a manual-instructions
  -- result; see that file's docblock.
  constraint external_search_mappings_active_requires_content_check
    check (mapping_status <> 'active' or verified_url is not null or manual_instructions is not null)
);

create index if not exists external_search_mappings_provider_idx on public.external_search_mappings (provider_id);
create index if not exists external_search_mappings_subject_idx on public.external_search_mappings (canonical_subject_id);
create index if not exists external_search_mappings_destination_idx on public.external_search_mappings (destination_country_code);
create index if not exists external_search_mappings_status_idx on public.external_search_mappings (mapping_status);

-- The spec's required uniqueness constraint: at most one ACTIVE mapping per
-- (provider, destination, subject, degree) combination. Deliberately a
-- PARTIAL unique index (only mapping_status = 'active') so an admin can
-- freely keep multiple draft/superseded rows around while iterating on a
-- verification, and only the single live one is constrained.
create unique index if not exists external_search_mappings_one_active_per_combination
  on public.external_search_mappings (provider_id, destination_country_code, canonical_subject_id, degree_level)
  where mapping_status = 'active';

comment on table public.external_search_mappings is
  'Trusted Global Course Search — admin-verified subject+degree+destination mappings for one provider. Only mapping_status=''active'' rows are ever surfaced to a student as a filtered deep link (see external_search_mappings_active_requires_url_check and the RLS policy below) — everything else (draft/verified/archived) is admin-visible only. Exactly one row in this whole table is seeded as strategy=verified_deep_link-eligible at install time: Germany + Bachelor''s + Mechanical Engineering -> the DAAD International Programmes URL given verbatim in the client specification. Every other combination is manual_search_instructions or has no mapping row at all — see supabase/seed/0006_trusted_course_search_seed.sql and PROVIDER-MATRIX.md.';

alter table public.external_search_mappings enable row level security;

drop policy if exists "Anyone can read active mappings of active providers" on public.external_search_mappings;
create policy "Anyone can read active mappings of active providers"
  on public.external_search_mappings for select to anon, authenticated
  using (
    mapping_status = 'active'
    and exists (select 1 from public.external_search_providers p where p.id = external_search_mappings.provider_id and p.active = true)
  );

drop policy if exists "super_admin/admin/analyst can read all mappings" on public.external_search_mappings;
create policy "super_admin/admin/analyst can read all mappings"
  on public.external_search_mappings for select to authenticated
  using (public.is_admin_role(array['super_admin', 'admin', 'analyst']));

drop policy if exists "super_admin/admin can create mappings" on public.external_search_mappings;
create policy "super_admin/admin can create mappings"
  on public.external_search_mappings for insert to authenticated
  with check (public.is_admin_role(array['super_admin', 'admin']));

drop policy if exists "super_admin/admin can update mappings" on public.external_search_mappings;
create policy "super_admin/admin can update mappings"
  on public.external_search_mappings for update to authenticated
  using (public.is_admin_role(array['super_admin', 'admin']))
  with check (public.is_admin_role(array['super_admin', 'admin']));

-- No delete policy — a mapping that should stop being offered is archived
-- (mapping_status = 'archived'), never deleted, so external_search_clicks
-- rows always keep a valid mapping_id to look back on.

drop trigger if exists set_external_search_mappings_updated_at on public.external_search_mappings;
create trigger set_external_search_mappings_updated_at before update on public.external_search_mappings for each row execute function public.set_updated_at();


-- ============================================================================
-- PART 3 — external_search_clicks (privacy-conscious, append-only)
--
-- Deliberately separate from public.pricing_analytics_events — same
-- narrow-CHECK-constrained, server-stamped-timestamp/user pattern (mirrors
-- 0007_nextwise_pricing_offers.sql PART 5 exactly), but its own table since
-- it tracks a functionally different funnel (outbound course-search clicks,
-- not the pricing page). `event_type = 'mapping_needed'` doubles as the
-- spec's "Record an anonymized 'mapping needed' event" / search-gap
-- reporting signal — one narrow table, not two, since the two event kinds
-- share every other column.
-- ============================================================================

create table if not exists public.external_search_clicks (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.external_search_providers (id) on delete cascade,
  -- Null for a landing-page-only click with no specific mapping (e.g. the
  -- provider's own "Open official course search" button with no filters
  -- applied yet), and always null for a mapping_needed event (by
  -- definition, no active mapping existed).
  mapping_id uuid references public.external_search_mappings (id) on delete set null,
  canonical_subject_id text,
  degree_level text,
  destination_country_code text references public.countries (iso_alpha2) on delete set null,
  source_page text not null default 'courses_search',
  event_type text not null default 'click',
  -- Server-stamped by stamp_external_search_click() below — whatever a
  -- client sends for these two columns is unconditionally overwritten.
  user_id uuid references auth.users (id) on delete set null,
  session_ref text,
  occurred_at timestamptz not null default now(),
  constraint external_search_clicks_event_type_check check (event_type in ('click', 'mapping_needed')),
  constraint external_search_clicks_degree_level_check
    check (degree_level is null or degree_level in ('bachelors', 'masters', 'doctorate', 'diploma_certificate', 'other')),
  constraint external_search_clicks_subject_id_format_check
    check (canonical_subject_id is null or canonical_subject_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint external_search_clicks_source_page_check
    check (source_page in ('courses_search', 'course_detail', 'admin_test_link')),
  constraint external_search_clicks_session_ref_length_check check (session_ref is null or length(session_ref) <= 64),
  -- A mapping_needed event has, by definition, no active mapping to point
  -- to — enforced here, not just by convention in application code.
  constraint external_search_clicks_mapping_needed_has_no_mapping_check
    check (event_type <> 'mapping_needed' or mapping_id is null)
);

create index if not exists external_search_clicks_provider_idx on public.external_search_clicks (provider_id);
create index if not exists external_search_clicks_mapping_idx on public.external_search_clicks (mapping_id);
create index if not exists external_search_clicks_event_type_idx on public.external_search_clicks (event_type);
create index if not exists external_search_clicks_occurred_at_idx on public.external_search_clicks (occurred_at);
create index if not exists external_search_clicks_gap_lookup_idx
  on public.external_search_clicks (destination_country_code, canonical_subject_id, degree_level)
  where event_type = 'mapping_needed';

comment on table public.external_search_clicks is
  'Trusted Global Course Search — append-only, privacy-conscious log of outbound provider clicks (event_type=''click'') and search-gap signals (event_type=''mapping_needed'', recorded when a search combination resolved to a landing page/manual instructions rather than a genuine filtered deep link). Never stores a raw free-text destination or an arbitrary client-supplied URL — canonical_subject_id/degree_level/destination_country_code are always the NORMALIZED taxonomy values, and provider_id/mapping_id are always foreign keys to already-validated rows, never a client-typed string. user_id and occurred_at are always server-stamped from auth.uid()/now() by the trigger below, mirroring public.stamp_pricing_analytics_event() (0007_nextwise_pricing_offers.sql) exactly. session_ref is reserved for a future non-identifying, consent-gated session token — as of this migration nothing in the codebase yet generates one (see src/lib/supabase/pricing/analytics.ts''s identical, currently-unused sessionRef parameter), so it is always null today; this table is shaped to accept one without a further migration once/if a consent-gated session-ref generator is added.';

alter table public.external_search_clicks enable row level security;

drop policy if exists "Anyone can record an outbound course-search click" on public.external_search_clicks;
create policy "Anyone can record an outbound course-search click"
  on public.external_search_clicks for insert to anon, authenticated
  with check (true);
-- The CHECK constraints above are the real restriction on what can ever
-- land in this table (event_type, canonical_subject_id/degree_level shape,
-- source_page, the mapping_needed-has-no-mapping rule, and every FK) — this
-- policy only decides who may attempt an insert at all (anyone, since
-- recording a click is not a privileged act, same posture as
-- pricing_analytics_events).

drop policy if exists "super_admin/admin/analyst can read outbound clicks" on public.external_search_clicks;
create policy "super_admin/admin/analyst can read outbound clicks"
  on public.external_search_clicks for select to authenticated
  using (public.is_admin_role(array['super_admin', 'admin', 'analyst']));

-- No update/delete policy for anyone — append-only, same as
-- pricing_analytics_events/admin_audit_log.

create or replace function public.stamp_external_search_click()
returns trigger
language plpgsql
as $$
begin
  new.user_id := auth.uid();
  new.occurred_at := now();
  return new;
end;
$$;

comment on function public.stamp_external_search_click() is
  'BEFORE INSERT trigger on external_search_clicks: unconditionally overwrites user_id with auth.uid() (null for an anonymous visitor) and occurred_at with now(), regardless of whatever the client sent in either column — mirrors public.stamp_pricing_analytics_event() (0007_nextwise_pricing_offers.sql PART 5) exactly, including its SECURITY INVOKER reasoning (no elevated privilege needed or granted).';

drop trigger if exists stamp_external_search_click on public.external_search_clicks;
create trigger stamp_external_search_click
  before insert on public.external_search_clicks
  for each row execute function public.stamp_external_search_click();

revoke execute on function public.stamp_external_search_click() from public;
-- Trigger functions do not need an explicit EXECUTE grant to fire as part
-- of an INSERT (Postgres invokes a trigger function directly) — this
-- revoke only closes off calling it directly as a standalone RPC, matching
-- the same discipline 0007's stamp_pricing_analytics_event() follows.


-- ============================================================================
-- PART 4 — Verification queries (run manually after applying this migration
-- and the seed file; not executed automatically). Same pattern as
-- 0007_nextwise_pricing_offers.sql PART 8 / 0005_payments_billing.sql PART 11.
--
-- 1) A signed-out (anon) client should see ONLY active providers and ONLY
--    active mappings of active providers:
--
-- select count(*) from public.external_search_providers where active = false; -- expect 0 as anon
-- select count(*) from public.external_search_mappings where mapping_status <> 'active'; -- expect 0 as anon
--
-- 2) Anon/authenticated should be able to insert a click, but never read one:
--
-- insert into public.external_search_clicks (provider_id, event_type, source_page)
--   values ('<any existing provider id>', 'click', 'courses_search'); -- expect success as anon
-- select count(*) from public.external_search_clicks; -- expect 0 rows visible as anon (RLS, not an empty table)
--
-- 3) Confirm user_id/occurred_at cannot be forged by the client:
--
-- insert into public.external_search_clicks (provider_id, event_type, source_page, user_id, occurred_at)
--   values ('<any existing provider id>', 'click', 'courses_search', '00000000-0000-0000-0000-000000000000', '2000-01-01')
--   returning user_id, occurred_at;
-- -- expected: user_id is auth.uid() of the actual caller (or null if anon), NOT the spoofed uuid;
-- -- occurred_at is close to "now", NOT 2000-01-01.
--
-- 4) Confirm the one-active-mapping-per-combination constraint actually
--    blocks a duplicate, as an admin:
--
-- insert into public.external_search_mappings
--   (provider_id, canonical_subject_id, degree_level, destination_country_code, verified_url, mapping_status)
--   select provider_id, canonical_subject_id, degree_level, destination_country_code, verified_url, 'active'
--   from public.external_search_mappings where mapping_status = 'active' limit 1;
-- -- expected: raises a unique-violation on external_search_mappings_one_active_per_combination
-- ============================================================================
