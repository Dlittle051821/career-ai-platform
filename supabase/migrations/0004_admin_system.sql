-- ============================================================================
-- Milestone 7 — Full Admin System
--
-- HOW TO RUN THIS (no SQL knowledge required):
--   1. Open your Supabase project dashboard (supabase.com/dashboard).
--   2. Click "SQL Editor" in the left sidebar.
--   3. Click "New query".
--   4. Paste the entire contents of this file.
--   5. Click "Run".
--   6. Then follow the BOOTSTRAP section at the very end of this file to
--      grant yourself the first super_admin role — this migration does NOT
--      do that automatically (see docs/admin-system-guide.md §3).
--
-- Safe to run once. Re-running is also safe — every statement is written
-- to not fail if it has already been applied (`if not exists` / `or
-- replace` / `drop policy if exists` before `create policy`), same
-- convention as 0001-0003.
--
-- This migration does not modify 0001, 0002, or 0003 in place — it only
-- ADDS new tables and ADDS new, additive RLS policies onto the existing
-- `profiles` / `student_*` tables (see §7 below). Every existing policy
-- from those earlier migrations stays exactly as it was: a student can
-- still only read/update their own row. The new admin policies are
-- additional `for select` grants layered on top for specific admin roles
-- — Postgres RLS policies for the same command are OR'd together, so this
-- can only ever widen who can read admin-relevant data, never narrow a
-- student's access to their own data. See docs/admin-system-guide.md §5
-- for the full RLS reasoning.
--
-- No service-role key is used or required anywhere in Milestone 7. Every
-- admin read/write goes through the same RLS-respecting publishable-key
-- client every other milestone uses — the role model below is what makes
-- that safe. See docs/admin-system-guide.md §2.
-- ============================================================================


-- ============================================================================
-- PART 1 — Role model
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1.1 admin_roles — one row per admin, at most one role each.
--
-- Deliberately NOT a column on `profiles`: keeping admin authorization in
-- its own table, locked down by its own tight RLS (see below), means the
-- much more permissive `profiles` policies (a student can update their own
-- `full_name`/`phone`) can never accidentally touch it. A student account
-- with no row here has no admin access at all — that is the default and
-- expected state for every account created through /register.
-- ----------------------------------------------------------------------------
create table if not exists public.admin_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_roles_role_check
    check (role in ('super_admin', 'admin', 'counsellor', 'finance', 'content_editor', 'analyst'))
);

comment on table public.admin_roles is
  'Milestone 7 — database-backed authorization. One role per admin user. NOT automatically populated on signup: every account starts with zero rows here (zero admin access) until a super_admin explicitly grants one, or (for the very first admin) it is granted manually via the BOOTSTRAP block at the end of this file. Never trust a role claimed by the browser — every admin page and mutation re-derives the caller''s role from this table via current_admin_role()/is_admin_role() below, which read auth.uid() server-side.';


-- ----------------------------------------------------------------------------
-- 1.2 Helper functions — SECURITY DEFINER so they can read admin_roles for
-- the CALLING user (auth.uid()) without recursing through admin_roles' own
-- RLS (a policy on admin_roles that itself queried admin_roles through a
-- normal, RLS-respecting read would deadlock/recurse). Each function only
-- ever answers "what is auth.uid()'s own role" — it cannot be used to read
-- or infer anyone else's role, so SECURITY DEFINER here does not leak
-- data. `set search_path = public` on every one prevents search-path
-- hijacking (a well-known SECURITY DEFINER footgun).
-- ----------------------------------------------------------------------------
create or replace function public.current_admin_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.admin_roles where user_id = auth.uid();
$$;

comment on function public.current_admin_role() is
  'Returns the calling user''s own admin role, or null if they have none. SECURITY DEFINER is safe here because it can only ever answer for auth.uid() — never an arbitrary user.';

create or replace function public.is_admin_role(allowed_roles text[])
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.admin_roles
    where user_id = auth.uid() and role = any(allowed_roles)
  );
$$;

comment on function public.is_admin_role(text[]) is
  'True if the calling user holds one of the given roles. The single building block every admin RLS policy below is written in terms of.';

create or replace function public.is_any_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.admin_roles where user_id = auth.uid());
$$;

comment on function public.is_any_admin() is
  'True if the calling user holds any admin role at all — used for reference data (universities, courses, counsellor directory) that every admin module reads regardless of role.';

-- current_counsellor_id() is created after the `counsellors` table below
-- (it queries that table) — see §2.1.


-- ----------------------------------------------------------------------------
-- 1.3 admin_roles RLS
-- ----------------------------------------------------------------------------
alter table public.admin_roles enable row level security;

drop policy if exists "Admins can read their own role, super_admins read all" on public.admin_roles;
create policy "Admins can read their own role, super_admins read all"
  on public.admin_roles
  for select
  to authenticated
  using (auth.uid() = user_id or public.is_admin_role(array['super_admin']));

-- INSERT/UPDATE/DELETE are super_admin-only, full stop. An `admin` (not
-- super_admin) has literally no grant to write this table — this is what
-- makes "admins cannot silently promote themselves" a database-enforced
-- fact rather than an application-code convention that a bug could bypass.
drop policy if exists "Only super_admins can grant or change roles" on public.admin_roles;
create policy "Only super_admins can grant or change roles"
  on public.admin_roles
  for insert
  to authenticated
  with check (public.is_admin_role(array['super_admin']));

drop policy if exists "Only super_admins can update roles" on public.admin_roles;
create policy "Only super_admins can update roles"
  on public.admin_roles
  for update
  to authenticated
  using (public.is_admin_role(array['super_admin']))
  with check (public.is_admin_role(array['super_admin']));

drop policy if exists "Only super_admins can revoke roles" on public.admin_roles;
create policy "Only super_admins can revoke roles"
  on public.admin_roles
  for delete
  to authenticated
  using (public.is_admin_role(array['super_admin']));

-- Defense in depth: even a super_admin cannot demote/delete the LAST
-- remaining super_admin — that would permanently lock every admin out of
-- role management (nobody left with permission to grant a new one back).
create or replace function public.prevent_last_super_admin_removal()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (tg_op = 'DELETE' and old.role = 'super_admin')
     or (tg_op = 'UPDATE' and old.role = 'super_admin' and new.role <> 'super_admin') then
    if (select count(*) from public.admin_roles where role = 'super_admin' and user_id <> old.user_id) = 0 then
      raise exception 'Cannot remove the last remaining super_admin.';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists admin_roles_prevent_last_super_admin on public.admin_roles;
create trigger admin_roles_prevent_last_super_admin
  before update or delete on public.admin_roles
  for each row
  execute function public.prevent_last_super_admin_removal();

drop trigger if exists set_admin_roles_updated_at on public.admin_roles;
create trigger set_admin_roles_updated_at
  before update on public.admin_roles
  for each row
  execute function public.set_updated_at();


-- ============================================================================
-- PART 2 — Counsellors
-- ============================================================================

create table if not exists public.counsellors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  display_name text not null,
  email text,
  phone text,
  specializations text[] not null default '{}',
  regions text[] not null default '{}',
  is_active boolean not null default true,
  capacity smallint,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint counsellors_capacity_check check (capacity is null or capacity >= 0)
);
create index if not exists counsellors_user_id_idx on public.counsellors (user_id);
create index if not exists counsellors_is_active_idx on public.counsellors (is_active);

comment on table public.counsellors is
  'Milestone 7 — operational counsellor directory. `user_id` links a counsellor profile to their own admin login (nullable: a counsellor record can exist before/without a linked login). This table has no `role` column and no self-service update policy — editing your own counsellor record (display name, specializations, capacity) can never grant admin privileges; that only ever happens through admin_roles, which counsellors cannot write at all.';

create or replace function public.current_counsellor_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from public.counsellors where user_id = auth.uid();
$$;

comment on function public.current_counsellor_id() is
  'The calling user''s own counsellors.id, or null. Used to scope a counsellor''s RLS visibility to only their assigned students/leads/applications.';

alter table public.counsellors enable row level security;

drop policy if exists "Any admin can read the counsellor directory" on public.counsellors;
create policy "Any admin can read the counsellor directory"
  on public.counsellors
  for select
  to authenticated
  using (public.is_any_admin());

drop policy if exists "super_admin/admin can manage counsellors" on public.counsellors;
create policy "super_admin/admin can manage counsellors"
  on public.counsellors
  for insert
  to authenticated
  with check (public.is_admin_role(array['super_admin', 'admin']));

drop policy if exists "super_admin/admin can update counsellors" on public.counsellors;
create policy "super_admin/admin can update counsellors"
  on public.counsellors
  for update
  to authenticated
  using (public.is_admin_role(array['super_admin', 'admin']))
  with check (public.is_admin_role(array['super_admin', 'admin']));

-- No delete policy — deactivate via is_active instead of destructive delete
-- (spec: "prefer soft archive/status changes over destructive deletion").

drop trigger if exists set_counsellors_updated_at on public.counsellors;
create trigger set_counsellors_updated_at
  before update on public.counsellors
  for each row
  execute function public.set_updated_at();


-- ============================================================================
-- PART 3 — Universities & Courses
-- ============================================================================

create table if not exists public.universities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  country text,
  city text,
  website text,
  institution_type text,
  summary text,
  accreditation_status text not null default 'unverified',
  is_active boolean not null default true,
  is_visible boolean not null default false,
  internal_notes text,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint universities_institution_type_check
    check (institution_type is null or institution_type in ('university', 'college', 'institute', 'online_platform', 'other')),
  constraint universities_accreditation_status_check
    check (accreditation_status in ('unverified', 'self_reported', 'verified'))
);
create index if not exists universities_slug_idx on public.universities (slug);
create index if not exists universities_active_visible_idx on public.universities (is_active, is_visible);

comment on table public.universities is
  'Milestone 7 master data. `accreditation_status` defaults to ''unverified'' and must never be presented to a student as ''verified'' unless an admin has explicitly recorded and can support that (spec: avoid claiming accreditation/verification unless recorded and supported). `is_visible` is separate from `is_active` so a record can be prepared/edited (active) without yet being shown anywhere public-facing — no public page currently reads this table (see docs/admin-system-guide.md §9), so `is_visible` is forward-compatible groundwork, not live behavior yet.';

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities (id) on delete cascade,
  name text not null,
  slug text not null,
  education_level text,
  field_of_study text,
  duration_text text,
  delivery_mode text,
  campus_location text,
  intake_info text,
  tuition_amount_minor_units bigint,
  tuition_currency text not null default 'INR',
  tuition_period text,
  entry_requirements_summary text,
  application_url text,
  is_active boolean not null default true,
  is_visible boolean not null default false,
  data_quality_status text not null default 'draft',
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (university_id, slug),
  constraint courses_education_level_check
    check (education_level is null or education_level in ('undergraduate', 'postgraduate', 'diploma', 'certificate', 'doctorate', 'other')),
  constraint courses_delivery_mode_check
    check (delivery_mode is null or delivery_mode in ('on_campus', 'online', 'hybrid')),
  constraint courses_tuition_period_check
    check (tuition_period is null or tuition_period in ('per_year', 'per_semester', 'per_program', 'per_credit')),
  constraint courses_data_quality_status_check
    check (data_quality_status in ('draft', 'reviewed', 'approved')),
  constraint courses_tuition_amount_check
    check (tuition_amount_minor_units is null or tuition_amount_minor_units >= 0)
);
create index if not exists courses_university_id_idx on public.courses (university_id);
create index if not exists courses_active_visible_idx on public.courses (is_active, is_visible);

comment on table public.courses is
  'Milestone 7 master data, linked to universities. `tuition_amount_minor_units` stores tuition as an integer in the currency''s minor unit (e.g. paise for INR) — see docs/admin-system-guide.md §5 on money handling. Never invent live fees, rankings, admission guarantees, visa outcomes, or scholarship claims here: leave a field null rather than estimating.';

alter table public.universities enable row level security;
alter table public.courses enable row level security;

drop policy if exists "Any admin can read universities" on public.universities;
create policy "Any admin can read universities"
  on public.universities for select to authenticated using (public.is_any_admin());

drop policy if exists "super_admin/admin can write universities" on public.universities;
create policy "super_admin/admin can write universities"
  on public.universities for insert to authenticated with check (public.is_admin_role(array['super_admin', 'admin']));

drop policy if exists "super_admin/admin can update universities" on public.universities;
create policy "super_admin/admin can update universities"
  on public.universities for update to authenticated
  using (public.is_admin_role(array['super_admin', 'admin']))
  with check (public.is_admin_role(array['super_admin', 'admin']));

drop policy if exists "Any admin can read courses" on public.courses;
create policy "Any admin can read courses"
  on public.courses for select to authenticated using (public.is_any_admin());

drop policy if exists "super_admin/admin can write courses" on public.courses;
create policy "super_admin/admin can write courses"
  on public.courses for insert to authenticated with check (public.is_admin_role(array['super_admin', 'admin']));

drop policy if exists "super_admin/admin can update courses" on public.courses;
create policy "super_admin/admin can update courses"
  on public.courses for update to authenticated
  using (public.is_admin_role(array['super_admin', 'admin']))
  with check (public.is_admin_role(array['super_admin', 'admin']));

drop trigger if exists set_universities_updated_at on public.universities;
create trigger set_universities_updated_at before update on public.universities for each row execute function public.set_updated_at();
drop trigger if exists set_courses_updated_at on public.courses;
create trigger set_courses_updated_at before update on public.courses for each row execute function public.set_updated_at();


-- ============================================================================
-- PART 4 — Student operational metadata (admin-owned, separate from the
-- student's own self-reported M3 profile — see docs/admin-system-guide.md §6
-- for why this is a new table rather than new columns on `profiles`).
-- ============================================================================

create table if not exists public.admin_student_meta (
  student_user_id uuid primary key references auth.users (id) on delete cascade,
  status text not null default 'prospect',
  assigned_counsellor_id uuid references public.counsellors (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_student_meta_status_check
    check (status in ('prospect', 'active', 'inactive', 'archived'))
);
create index if not exists admin_student_meta_counsellor_idx on public.admin_student_meta (assigned_counsellor_id);
create index if not exists admin_student_meta_status_idx on public.admin_student_meta (status);

comment on table public.admin_student_meta is
  'Milestone 7 — admin-managed operational status + counsellor assignment for a student. Deliberately separate from `student_profiles` (Milestone 3, self-reported): this table is never written by the student themselves, and admin-side scoping (which counsellor sees which student) is anchored on `assigned_counsellor_id` here, not on anything in the student''s own profile.';

create table if not exists public.admin_student_notes (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references auth.users (id) on delete cascade,
  author_user_id uuid references auth.users (id) on delete set null,
  note text not null,
  created_at timestamptz not null default now()
);
create index if not exists admin_student_notes_student_idx on public.admin_student_notes (student_user_id);

comment on table public.admin_student_notes is
  'Milestone 7 — internal admin notes about a student, never shown to the student. Append-only by design (no update/delete policy): correct a note by adding a new one, so the record of who said what and when is never silently rewritten.';

alter table public.admin_student_meta enable row level security;
alter table public.admin_student_notes enable row level security;

drop policy if exists "Admins/assigned counsellor can read student meta" on public.admin_student_meta;
create policy "Admins/assigned counsellor can read student meta"
  on public.admin_student_meta for select to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin', 'analyst'])
    or (public.is_admin_role(array['counsellor']) and assigned_counsellor_id = public.current_counsellor_id())
  );

drop policy if exists "Admins can insert student meta" on public.admin_student_meta;
create policy "Admins can insert student meta"
  on public.admin_student_meta for insert to authenticated
  with check (public.is_admin_role(array['super_admin', 'admin']));

drop policy if exists "Admins/assigned counsellor can update student meta" on public.admin_student_meta;
create policy "Admins/assigned counsellor can update student meta"
  on public.admin_student_meta for update to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin'])
    or (public.is_admin_role(array['counsellor']) and assigned_counsellor_id = public.current_counsellor_id())
  )
  with check (
    public.is_admin_role(array['super_admin', 'admin'])
    or (public.is_admin_role(array['counsellor']) and assigned_counsellor_id = public.current_counsellor_id())
  );

drop policy if exists "Admins/assigned counsellor can read student notes" on public.admin_student_notes;
create policy "Admins/assigned counsellor can read student notes"
  on public.admin_student_notes for select to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin'])
    or (
      public.is_admin_role(array['counsellor'])
      and exists (
        select 1 from public.admin_student_meta m
        where m.student_user_id = admin_student_notes.student_user_id
          and m.assigned_counsellor_id = public.current_counsellor_id()
      )
    )
  );

drop policy if exists "Admins/assigned counsellor can add student notes" on public.admin_student_notes;
create policy "Admins/assigned counsellor can add student notes"
  on public.admin_student_notes for insert to authenticated
  with check (
    author_user_id = auth.uid()
    and (
      public.is_admin_role(array['super_admin', 'admin'])
      or (
        public.is_admin_role(array['counsellor'])
        and exists (
          select 1 from public.admin_student_meta m
          where m.student_user_id = admin_student_notes.student_user_id
            and m.assigned_counsellor_id = public.current_counsellor_id()
        )
      )
    )
  );

drop trigger if exists set_admin_student_meta_updated_at on public.admin_student_meta;
create trigger set_admin_student_meta_updated_at before update on public.admin_student_meta for each row execute function public.set_updated_at();


-- ============================================================================
-- PART 5 — Leads (lightweight CRM)
-- ============================================================================

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  source text,
  campaign text,
  stage text not null default 'new',
  priority text not null default 'medium',
  assigned_counsellor_id uuid references public.counsellors (id) on delete set null,
  next_follow_up_date date,
  last_contact_date date,
  consent_marketing boolean not null default false,
  notes text,
  converted_student_user_id uuid references auth.users (id) on delete set null,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  landing_page text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_stage_check check (stage in ('new', 'contacted', 'qualified', 'nurturing', 'converted', 'lost')),
  constraint leads_priority_check check (priority in ('low', 'medium', 'high')),
  constraint leads_contact_check check (email is not null or phone is not null)
);
create index if not exists leads_stage_idx on public.leads (stage);
create index if not exists leads_counsellor_idx on public.leads (assigned_counsellor_id);
create index if not exists leads_follow_up_idx on public.leads (next_follow_up_date);

comment on table public.leads is
  'Milestone 7 lightweight CRM pipeline. `priority` is a deterministic, admin-set enum (low/medium/high) — not an opaque computed lead score (spec: only include a score if deterministic and documented, and this app does not compute one). `converted_student_user_id` links a lead to the real registered student account once one exists.';

create table if not exists public.lead_status_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  from_stage text,
  to_stage text not null,
  changed_by uuid references auth.users (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists lead_status_history_lead_idx on public.lead_status_history (lead_id);

alter table public.leads enable row level security;
alter table public.lead_status_history enable row level security;

drop policy if exists "Admins/assigned counsellor/analyst can read leads" on public.leads;
create policy "Admins/assigned counsellor/analyst can read leads"
  on public.leads for select to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin', 'analyst'])
    or (public.is_admin_role(array['counsellor']) and assigned_counsellor_id = public.current_counsellor_id())
  );

drop policy if exists "Admins/counsellor can create leads" on public.leads;
create policy "Admins/counsellor can create leads"
  on public.leads for insert to authenticated
  with check (
    public.is_admin_role(array['super_admin', 'admin'])
    or (public.is_admin_role(array['counsellor']) and (assigned_counsellor_id is null or assigned_counsellor_id = public.current_counsellor_id()))
  );

drop policy if exists "Admins/assigned counsellor can update leads" on public.leads;
create policy "Admins/assigned counsellor can update leads"
  on public.leads for update to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin'])
    or (public.is_admin_role(array['counsellor']) and assigned_counsellor_id = public.current_counsellor_id())
  )
  with check (
    public.is_admin_role(array['super_admin', 'admin'])
    or (public.is_admin_role(array['counsellor']) and assigned_counsellor_id = public.current_counsellor_id())
  );

drop policy if exists "Lead history follows lead visibility (read)" on public.lead_status_history;
create policy "Lead history follows lead visibility (read)"
  on public.lead_status_history for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_status_history.lead_id));

drop policy if exists "Lead history follows lead visibility (insert)" on public.lead_status_history;
create policy "Lead history follows lead visibility (insert)"
  on public.lead_status_history for insert to authenticated
  with check (changed_by = auth.uid() and exists (select 1 from public.leads l where l.id = lead_status_history.lead_id));

drop trigger if exists set_leads_updated_at on public.leads;
create trigger set_leads_updated_at before update on public.leads for each row execute function public.set_updated_at();


-- ============================================================================
-- PART 6 — Applications
-- ============================================================================

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references auth.users (id) on delete cascade,
  university_id uuid references public.universities (id) on delete set null,
  course_id uuid references public.courses (id) on delete set null,
  assigned_counsellor_id uuid references public.counsellors (id) on delete set null,
  stage text not null default 'inquiry',
  intake text,
  submission_date date,
  decision_status text not null default 'pending',
  offer_type text,
  deadlines jsonb not null default '[]'::jsonb,
  next_action text,
  next_action_date date,
  last_contact_date date,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint applications_stage_check check (
    stage in ('inquiry', 'preparing', 'submitted', 'under_review', 'interview', 'decision_pending', 'offer_received', 'enrolled', 'rejected', 'withdrawn')
  ),
  constraint applications_decision_status_check
    check (decision_status in ('pending', 'offer', 'waitlist', 'rejected', 'deferred'))
);
create index if not exists applications_student_idx on public.applications (student_user_id);
create index if not exists applications_university_idx on public.applications (university_id);
create index if not exists applications_counsellor_idx on public.applications (assigned_counsellor_id);
create index if not exists applications_stage_idx on public.applications (stage);

comment on table public.applications is
  'Milestone 7. `deadlines` is a small JSON array of {label, dueDate} — a lightweight structure chosen over a child table for M7''s scope (documented in docs/admin-system-guide.md §5). Tracking here is CareerPath AI''s own record of a student''s application, not a live integration with any university''s system — never represent it as one (spec requirement).';

create table if not exists public.application_status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references auth.users (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists application_status_history_app_idx on public.application_status_history (application_id);

alter table public.applications enable row level security;
alter table public.application_status_history enable row level security;

drop policy if exists "Admins/assigned counsellor/finance/analyst can read applications" on public.applications;
create policy "Admins/assigned counsellor/finance/analyst can read applications"
  on public.applications for select to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin', 'finance', 'analyst'])
    or (public.is_admin_role(array['counsellor']) and assigned_counsellor_id = public.current_counsellor_id())
  );

drop policy if exists "Admins/counsellor can create applications" on public.applications;
create policy "Admins/counsellor can create applications"
  on public.applications for insert to authenticated
  with check (
    public.is_admin_role(array['super_admin', 'admin'])
    or (public.is_admin_role(array['counsellor']) and (assigned_counsellor_id is null or assigned_counsellor_id = public.current_counsellor_id()))
  );

drop policy if exists "Admins/assigned counsellor can update applications" on public.applications;
create policy "Admins/assigned counsellor can update applications"
  on public.applications for update to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin'])
    or (public.is_admin_role(array['counsellor']) and assigned_counsellor_id = public.current_counsellor_id())
  )
  with check (
    public.is_admin_role(array['super_admin', 'admin'])
    or (public.is_admin_role(array['counsellor']) and assigned_counsellor_id = public.current_counsellor_id())
  );

drop policy if exists "Application history follows application visibility (read)" on public.application_status_history;
create policy "Application history follows application visibility (read)"
  on public.application_status_history for select to authenticated
  using (exists (select 1 from public.applications a where a.id = application_status_history.application_id));

drop policy if exists "Application history follows application visibility (insert)" on public.application_status_history;
create policy "Application history follows application visibility (insert)"
  on public.application_status_history for insert to authenticated
  with check (changed_by = auth.uid() and exists (select 1 from public.applications a where a.id = application_status_history.application_id));

drop trigger if exists set_applications_updated_at on public.applications;
create trigger set_applications_updated_at before update on public.applications for each row execute function public.set_updated_at();


-- ============================================================================
-- PART 7 — Payments (operational tracking only — see docs/admin-system-guide.md
-- §7 for the explicit "this is not a payment processor" limitation)
-- ============================================================================

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid references auth.users (id) on delete set null,
  application_id uuid references public.applications (id) on delete set null,
  invoice_reference text,
  amount_minor_units bigint not null,
  currency text not null default 'INR',
  payment_type text,
  payment_method_label text,
  status text not null default 'pending',
  due_date date,
  paid_date date,
  external_transaction_reference text,
  refund_status text not null default 'none',
  refund_amount_minor_units bigint,
  internal_notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_amount_check check (amount_minor_units >= 0),
  constraint payments_refund_amount_check check (refund_amount_minor_units is null or refund_amount_minor_units >= 0),
  constraint payments_status_check check (status in ('pending', 'paid', 'failed', 'refunded', 'partially_refunded', 'cancelled')),
  constraint payments_refund_status_check check (refund_status in ('none', 'requested', 'partial', 'full'))
);
create index if not exists payments_student_idx on public.payments (student_user_id);
create index if not exists payments_application_idx on public.payments (application_id);
create index if not exists payments_status_idx on public.payments (status);

comment on table public.payments is
  'Milestone 7 — OPERATIONAL PAYMENT TRACKING ONLY. This table records that a payment happened or is expected; it does not process, capture, or move money, and no code path anywhere reads or writes card numbers, CVVs, bank passwords, or any other payment credential. `amount_minor_units`/`refund_amount_minor_units` are integers in the currency''s smallest unit (e.g. paise for INR) — never a float. A row existing with status=''paid'' means an admin recorded that a payment was received, not that this system processed it. Write access is restricted to super_admin/admin/finance; every status or amount change is written to admin_audit_log by the server action that performs it (see src/lib/supabase/admin/payments.ts).';

alter table public.payments enable row level security;

drop policy if exists "super_admin/admin/finance/analyst can read payments" on public.payments;
create policy "super_admin/admin/finance/analyst can read payments"
  on public.payments for select to authenticated
  using (public.is_admin_role(array['super_admin', 'admin', 'finance', 'analyst']));

drop policy if exists "super_admin/admin/finance can create payments" on public.payments;
create policy "super_admin/admin/finance can create payments"
  on public.payments for insert to authenticated
  with check (public.is_admin_role(array['super_admin', 'admin', 'finance']));

drop policy if exists "super_admin/admin/finance can update payments" on public.payments;
create policy "super_admin/admin/finance can update payments"
  on public.payments for update to authenticated
  using (public.is_admin_role(array['super_admin', 'admin', 'finance']))
  with check (public.is_admin_role(array['super_admin', 'admin', 'finance']));

drop trigger if exists set_payments_updated_at on public.payments;
create trigger set_payments_updated_at before update on public.payments for each row execute function public.set_updated_at();


-- ============================================================================
-- PART 8 — Agreements
-- ============================================================================

create table if not exists public.agreements (
  id uuid primary key default gen_random_uuid(),
  agreement_type text not null,
  student_user_id uuid references auth.users (id) on delete set null,
  lead_id uuid references public.leads (id) on delete set null,
  counsellor_id uuid references public.counsellors (id) on delete set null,
  university_id uuid references public.universities (id) on delete set null,
  version text,
  status text not null default 'draft',
  effective_date date,
  expiry_date date,
  document_reference_url text,
  signature_status text not null default 'not_started',
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agreements_status_check check (status in ('draft', 'sent', 'signed', 'declined', 'expired', 'cancelled')),
  constraint agreements_signature_status_check check (signature_status in ('not_started', 'pending_signature', 'signed')),
  constraint agreements_party_check check (student_user_id is not null or lead_id is not null or counsellor_id is not null or university_id is not null)
);
create index if not exists agreements_student_idx on public.agreements (student_user_id);
create index if not exists agreements_counsellor_idx on public.agreements (counsellor_id);

comment on table public.agreements is
  'Milestone 7. There is no e-signature provider in this project — `signature_status` is tracked manually by an admin, never automated, and `document_reference_url` is a reference/placeholder field only (spec: do not store uploaded legal documents unless secure storage + authorization + retention is fully implemented — out of scope for M7).';

alter table public.agreements enable row level security;

drop policy if exists "Admins/finance/assigned counsellor can read agreements" on public.agreements;
create policy "Admins/finance/assigned counsellor can read agreements"
  on public.agreements for select to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin', 'finance'])
    or (public.is_admin_role(array['counsellor']) and counsellor_id = public.current_counsellor_id())
  );

drop policy if exists "super_admin/admin can write agreements" on public.agreements;
create policy "super_admin/admin can write agreements"
  on public.agreements for insert to authenticated
  with check (public.is_admin_role(array['super_admin', 'admin']));

drop policy if exists "super_admin/admin can update agreements" on public.agreements;
create policy "super_admin/admin can update agreements"
  on public.agreements for update to authenticated
  using (public.is_admin_role(array['super_admin', 'admin']))
  with check (public.is_admin_role(array['super_admin', 'admin']));

drop trigger if exists set_agreements_updated_at on public.agreements;
create trigger set_agreements_updated_at before update on public.agreements for each row execute function public.set_updated_at();


-- ============================================================================
-- PART 9 — Content management (structured/plain-text only — never raw HTML)
-- ============================================================================

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  content_type text not null,
  slug text not null,
  content_key text,
  locale text not null default 'en',
  title text not null,
  body text not null default '',
  status text not null default 'draft',
  sort_order integer not null default 0,
  published_at timestamptz,
  editor_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (content_type, slug, locale),
  constraint content_items_type_check check (content_type in ('faq', 'announcement', 'page_block')),
  constraint content_items_status_check check (status in ('draft', 'published', 'archived'))
);
create index if not exists content_items_type_status_idx on public.content_items (content_type, status);

comment on table public.content_items is
  'Milestone 7 CMS. `body` is stored and must always be rendered as plain text (line breaks only, no HTML interpretation) — see src/lib/admin/content.ts renderSafeContentBody(). No public page reads this table yet in M7 (see docs/admin-system-guide.md §9): existing typed/static site copy is left exactly as-is until a future milestone explicitly wires a page to read published rows here, so this ships as a safe, fully-functional admin module with zero risk to the current public site.';

alter table public.content_items enable row level security;

drop policy if exists "Anyone can read published content" on public.content_items;
create policy "Anyone can read published content"
  on public.content_items for select to anon, authenticated
  using (status = 'published');

drop policy if exists "content_editor/admin can read all content" on public.content_items;
create policy "content_editor/admin can read all content"
  on public.content_items for select to authenticated
  using (public.is_admin_role(array['super_admin', 'admin', 'content_editor']));

drop policy if exists "content_editor/admin can write content" on public.content_items;
create policy "content_editor/admin can write content"
  on public.content_items for insert to authenticated
  with check (public.is_admin_role(array['super_admin', 'admin', 'content_editor']));

drop policy if exists "content_editor/admin can update content" on public.content_items;
create policy "content_editor/admin can update content"
  on public.content_items for update to authenticated
  using (public.is_admin_role(array['super_admin', 'admin', 'content_editor']))
  with check (public.is_admin_role(array['super_admin', 'admin', 'content_editor']));

drop trigger if exists set_content_items_updated_at on public.content_items;
create trigger set_content_items_updated_at before update on public.content_items for each row execute function public.set_updated_at();


-- ============================================================================
-- PART 10 — Conversion tracking (first-party, operational — see
-- docs/admin-system-guide.md §10 for the privacy limitations)
-- ============================================================================

create table if not exists public.conversion_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads (id) on delete set null,
  student_user_id uuid references auth.users (id) on delete set null,
  event_name text not null,
  source text,
  medium text,
  campaign text,
  landing_page text,
  referral_label text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists conversion_events_lead_idx on public.conversion_events (lead_id);
create index if not exists conversion_events_event_name_idx on public.conversion_events (event_name);
create index if not exists conversion_events_occurred_at_idx on public.conversion_events (occurred_at);

comment on table public.conversion_events is
  'Milestone 7 — first-party funnel-transition log, written only by authenticated admin sessions performing a real action (e.g. a lead moving to "converted"). Never a public/anonymous tracking beacon: there is no unauthenticated write path, no fingerprinting, no raw IP storage, and `occurred_at` is always server-set (default now()), never a client-supplied timestamp — so a browser cannot forge when an event happened.';

alter table public.conversion_events enable row level security;

drop policy if exists "super_admin/admin/analyst can read conversion events" on public.conversion_events;
create policy "super_admin/admin/analyst can read conversion events"
  on public.conversion_events for select to authenticated
  using (public.is_admin_role(array['super_admin', 'admin', 'analyst']));

drop policy if exists "Any admin can record a conversion event" on public.conversion_events;
create policy "Any admin can record a conversion event"
  on public.conversion_events for insert to authenticated
  with check (public.is_any_admin());


-- ============================================================================
-- PART 11 — Audit log
-- ============================================================================

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id text,
  summary text not null,
  changes jsonb,
  context jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_entity_idx on public.admin_audit_log (entity_type, entity_id);
create index if not exists admin_audit_log_actor_idx on public.admin_audit_log (actor_user_id);
create index if not exists admin_audit_log_created_at_idx on public.admin_audit_log (created_at);

comment on table public.admin_audit_log is
  'Milestone 7 audit trail. Append-only: there is no update/delete RLS policy for anyone, and no insert policy either — the only way a row is ever created is through record_admin_audit_log() below, which forces actor_user_id to auth.uid() (a caller cannot forge acting as someone else) and stamps created_at server-side. Never record passwords, tokens, full payment credentials, or other secrets in `changes`/`context` — see src/lib/admin/audit.ts for the redaction helper every caller goes through.';

alter table public.admin_audit_log enable row level security;

drop policy if exists "super_admin/admin can read the audit log" on public.admin_audit_log;
create policy "super_admin/admin can read the audit log"
  on public.admin_audit_log for select to authenticated
  using (public.is_admin_role(array['super_admin', 'admin']));

-- Deliberately no insert/update/delete policy for `authenticated` — see
-- record_admin_audit_log() below, which is the only write path (it runs
-- as SECURITY DEFINER and so does not need a permissive RLS policy).

create or replace function public.record_admin_audit_log(
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
  v_role text;
  v_id uuid;
begin
  v_role := public.current_admin_role();
  if v_role is null then
    raise exception 'Only an authenticated admin can write an audit log entry.';
  end if;

  insert into public.admin_audit_log (actor_user_id, actor_role, action, entity_type, entity_id, summary, changes, context)
  values (auth.uid(), v_role, p_action, p_entity_type, p_entity_id, p_summary, p_changes, p_context)
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.record_admin_audit_log(text, text, text, text, jsonb, jsonb) is
  'The only way to write to admin_audit_log. Raises if the caller has no admin role; always stamps actor_user_id = auth.uid() and actor_role = the caller''s real current role, so a client cannot forge either. Called from src/lib/admin/audit.ts, never directly from a table insert.';


-- ============================================================================
-- PART 12 — Additive admin-read policies on existing Milestone 2/3 tables
--
-- Every policy below is a NEW `for select` grant. None of them touch,
-- replace, or narrow the existing "auth.uid() = id/user_id" policies from
-- 0001_profiles.sql / 0002_student_profile.sql — those are untouched.
-- Postgres evaluates all policies for the same command with OR, so a
-- student's own access is completely unaffected; this only adds admin
-- visibility on top; counsellor visibility here scoped strictly to their
-- own assigned students via admin_student_meta.
-- ============================================================================

drop policy if exists "Admins/assigned counsellor can read student profiles (m7)" on public.profiles;
create policy "Admins/assigned counsellor can read student profiles (m7)"
  on public.profiles for select to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin', 'analyst'])
    or (
      public.is_admin_role(array['counsellor'])
      and exists (
        select 1 from public.admin_student_meta m
        where m.student_user_id = profiles.id and m.assigned_counsellor_id = public.current_counsellor_id()
      )
    )
  );

do $$
declare
  t text;
begin
  foreach t in array array[
    'student_profiles', 'student_education', 'student_subject_strengths', 'student_interests',
    'student_skills', 'student_work_preferences', 'student_career_priorities', 'student_career_goals',
    'student_study_preferences', 'student_funding_preferences', 'student_experience'
  ]
  loop
    execute format(
      'drop policy if exists "Admins/assigned counsellor can read %1$s (m7)" on public.%1$s',
      t
    );
    execute format(
      $f$create policy "Admins/assigned counsellor can read %1$s (m7)"
        on public.%1$s for select to authenticated
        using (
          public.is_admin_role(array['super_admin', 'admin', 'analyst'])
          or (
            public.is_admin_role(array['counsellor'])
            and exists (
              select 1 from public.admin_student_meta m
              where m.student_user_id = %1$s.user_id and m.assigned_counsellor_id = public.current_counsellor_id()
            )
          )
        )$f$,
      t
    );
  end loop;
end $$;

comment on table public.admin_student_meta is
  'Milestone 7 — admin-managed operational status + counsellor assignment for a student. Deliberately separate from `student_profiles` (Milestone 3, self-reported): this table is never written by the student themselves, and admin-side scoping (which counsellor sees which student) is anchored on `assigned_counsellor_id` here — every read policy added to profiles/student_* tables above joins against this table, never the other way around.';


-- ============================================================================
-- BOOTSTRAP — grant the first super_admin (run manually, once)
--
-- Do NOT uncomment and run this until you have registered a normal account
-- through /register with the email address you want to be the first
-- super_admin. This migration deliberately does not do this automatically
-- (spec requirement: do not auto-promote the first registered account).
--
-- Replace 'you@example.com' below, then run just this one statement in the
-- SQL Editor:
--
-- insert into public.admin_roles (user_id, role, granted_by)
-- select id, 'super_admin', id from auth.users where email = 'you@example.com'
-- on conflict (user_id) do update set role = 'super_admin', updated_at = now();
--
-- Verify it worked:
-- select user_id, role, granted_at from public.admin_roles;
-- ============================================================================
