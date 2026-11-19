-- ============================================================================
-- NW-PRICING-V3 / 0001 — three-plan active catalogue, university add-on, quotes
-- PROPOSED. NOT APPLIED TO PRODUCTION. Requires founder approval:
--   "APPROVED — DEPLOY NEXTWISE PRICING V3."
--
-- Forward-only, additive, idempotent (safe to run more than once), one transaction.
-- It never deletes a plan, version, inclusion, offer, purchase, invoice, payment,
-- agreement or audit row. Old plans are RETIRED (is_active = false): they disappear
-- from the public catalogue and can no longer be bought (purchase_pricing_plan()
-- already refuses inactive plans), while every historical row keeps pointing at them.
--
-- What it does
--   1. Allows a new plan category, 'study_abroad' (constraint widened, not narrowed).
--   2. Lets a student keep READING the plan and version rows of plans they bought,
--      even after retirement, so every entitlement resolver (Career Intelligence,
--      product entitlements, University Discovery, checkout's charge guard) keeps
--      recognising old purchases. This only adds visibility of the student's own
--      purchased rows; no existing policy is changed or removed.
--   3. Creates pricing_plan_addons: per plan VERSION, the included quantity and the
--      unit price of an add-on (here: additional university application assistance).
--      Tied to the version, so it is versioned and frozen exactly like the price.
--   4. Creates pricing_quotes plus create_pricing_quote(): a server-computed,
--      versioned quote. The database recalculates everything from published rows;
--      no amount is ever accepted from a client.
--   5. Publishes: Nextwise Verified v-next (same ₹1,999, same tax_status, new scope),
--      Nextwise Study Abroad Lite (₹44,999, 5 universities, +₹7,999 each),
--      Nextwise Study Abroad Premium (₹74,999, 10 universities, +₹7,999 each).
--   6. Retires every other plan from the active catalogue.
--
-- Tax: Lite, Premium and the add-on are created with tax_status = 'unconfigured',
-- like every plan today. Online payment stays switched off (launch mode + the
-- checkout charge guard) until GST treatment is signed off. See the release report.
--
-- Rollback: see 0001_three_plan_catalogue_ROLLBACK.sql (restores the previous
-- active flags from the snapshot table written in step 0; leaves new rows in place,
-- retired, so nothing that may already reference them is broken).
-- ============================================================================
begin;

-- 0. Snapshot of the catalogue state before this migration (once only) -------
create table if not exists public.pricing_v3_catalogue_snapshot (
  plan_id uuid primary key,
  slug text not null,
  was_active boolean not null,
  was_recommended boolean not null,
  current_version_id uuid,
  taken_at timestamptz not null default now()
);
comment on table public.pricing_v3_catalogue_snapshot is
  'NW-PRICING-V3: the catalogue''s active flags immediately before 0001 ran, for reconciliation and rollback. Written once; never updated.';
alter table public.pricing_v3_catalogue_snapshot enable row level security;
drop policy if exists "finance/admin can read the pricing v3 snapshot" on public.pricing_v3_catalogue_snapshot;
create policy "finance/admin can read the pricing v3 snapshot" on public.pricing_v3_catalogue_snapshot
  for select to authenticated using (public.is_admin_role(array['super_admin', 'admin', 'finance', 'analyst']));

insert into public.pricing_v3_catalogue_snapshot (plan_id, slug, was_active, was_recommended, current_version_id)
select p.id, p.slug, p.is_active, p.is_recommended, p.current_version_id
from public.pricing_plans p
where not exists (select 1 from public.pricing_v3_catalogue_snapshot)
on conflict (plan_id) do nothing;

-- 1. Category ----------------------------------------------------------------
alter table public.pricing_plans drop constraint if exists pricing_plans_category_check;
alter table public.pricing_plans add constraint pricing_plans_category_check
  check (category in ('school_counselling', 'class_11_counselling', 'class_12_counselling', 'bachelor_abroad', 'master_abroad', 'study_abroad'));

-- 2. Purchasers keep seeing what they bought ---------------------------------
drop policy if exists "Students can read plans they purchased" on public.pricing_plans;
create policy "Students can read plans they purchased"
  on public.pricing_plans for select to authenticated
  using (exists (select 1 from public.pricing_purchases pp where pp.plan_id = pricing_plans.id and pp.student_user_id = auth.uid()));

drop policy if exists "Students can read plan versions they purchased" on public.pricing_plan_versions;
create policy "Students can read plan versions they purchased"
  on public.pricing_plan_versions for select to authenticated
  using (exists (select 1 from public.pricing_purchases pp where pp.plan_version_id = pricing_plan_versions.id and pp.student_user_id = auth.uid()));

-- 3. Add-ons -------------------------------------------------------------------
create table if not exists public.pricing_plan_addons (
  id uuid primary key default gen_random_uuid(),
  plan_version_id uuid not null references public.pricing_plan_versions (id) on delete restrict,
  addon_key text not null,
  public_label text not null,
  included_quantity integer not null,
  unit_amount_minor_units bigint not null,
  currency text not null default 'INR',
  max_additional_quantity integer,
  tax_status text not null default 'unconfigured',
  created_at timestamptz not null default now(),
  unique (plan_version_id, addon_key),
  constraint pricing_plan_addons_key_check check (addon_key in ('additional_university')),
  constraint pricing_plan_addons_included_check check (included_quantity >= 0),
  constraint pricing_plan_addons_unit_check check (unit_amount_minor_units > 0),
  constraint pricing_plan_addons_max_check check (max_additional_quantity is null or max_additional_quantity >= 0),
  constraint pricing_plan_addons_tax_check check (tax_status in ('unconfigured', 'tax_exclusive', 'tax_inclusive'))
);
comment on table public.pricing_plan_addons is
  'NW-PRICING-V3: an add-on sold with a plan version (additional university application assistance). Keyed to the VERSION, so it is versioned with the price and frozen once that version is published. max_additional_quantity is the configured operational limit (null = no configured limit).';
alter table public.pricing_plan_addons enable row level security;

create or replace function public.prevent_pricing_addon_mutation()
returns trigger language plpgsql as $$
begin
  if exists (select 1 from public.pricing_plan_versions v where v.id = coalesce(old.plan_version_id, new.plan_version_id) and v.status <> 'draft') then
    raise exception 'Add-ons of a published or archived plan version are immutable — create a new plan version instead.';
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists prevent_pricing_plan_addons_mutation on public.pricing_plan_addons;
create trigger prevent_pricing_plan_addons_mutation before update or delete on public.pricing_plan_addons
  for each row execute function public.prevent_pricing_addon_mutation();

drop policy if exists "Anyone can read add-ons of live plan versions" on public.pricing_plan_addons;
create policy "Anyone can read add-ons of live plan versions"
  on public.pricing_plan_addons for select to anon, authenticated
  using (exists (
    select 1 from public.pricing_plan_versions v join public.pricing_plans p on p.id = v.plan_id
    where v.id = pricing_plan_addons.plan_version_id and v.status = 'published'
      and (v.effective_from is null or v.effective_from <= now())
      and (v.effective_until is null or v.effective_until >= now())
      and p.is_active = true));
drop policy if exists "finance/admin/analyst can read all add-ons" on public.pricing_plan_addons;
create policy "finance/admin/analyst can read all add-ons" on public.pricing_plan_addons
  for select to authenticated using (public.is_admin_role(array['super_admin', 'admin', 'finance', 'analyst']));
drop policy if exists "finance/admin can create add-ons on draft versions" on public.pricing_plan_addons;
create policy "finance/admin can create add-ons on draft versions" on public.pricing_plan_addons
  for insert to authenticated
  with check (public.is_admin_role(array['super_admin', 'admin', 'finance'])
    and exists (select 1 from public.pricing_plan_versions v where v.id = plan_version_id and v.status = 'draft'));

-- 4. Quotes --------------------------------------------------------------------
create table if not exists public.pricing_quotes (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null references public.pricing_plans (id) on delete restrict,
  plan_version_id uuid not null references public.pricing_plan_versions (id) on delete restrict,
  addon_id uuid references public.pricing_plan_addons (id) on delete restrict,
  plan_slug_at_quote text not null,
  plan_name_at_quote text not null,
  currency text not null,
  base_amount_minor_units bigint not null,
  included_universities integer,
  additional_universities integer not null default 0,
  addon_unit_amount_minor_units bigint,
  addon_amount_minor_units bigint not null default 0,
  total_amount_minor_units bigint not null,
  plan_tax_status text not null,
  addon_tax_status text,
  status text not null default 'open',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint pricing_quotes_status_check check (status in ('open', 'superseded', 'expired', 'converted')),
  constraint pricing_quotes_amounts_check check (
    base_amount_minor_units >= 0 and addon_amount_minor_units >= 0 and additional_universities >= 0
    and total_amount_minor_units = base_amount_minor_units + addon_amount_minor_units
    and addon_amount_minor_units = additional_universities * coalesce(addon_unit_amount_minor_units, 0))
);
create unique index if not exists pricing_quotes_one_open_per_student on public.pricing_quotes (student_user_id) where status = 'open';
create index if not exists pricing_quotes_student_idx on public.pricing_quotes (student_user_id, created_at desc);
comment on table public.pricing_quotes is
  'NW-PRICING-V3: a server-computed, versioned package quote (plan version + additional universities). Written only by create_pricing_quote(), which recalculates from published catalogue rows. A quote is not an invoice, grants nothing, and is not payable until checkout for it is approved and built. One open quote per student; a new one supersedes it.';
alter table public.pricing_quotes enable row level security;
drop policy if exists "Students can read their own quotes" on public.pricing_quotes;
create policy "Students can read their own quotes" on public.pricing_quotes
  for select to authenticated using (auth.uid() = student_user_id);
drop policy if exists "finance/admin/analyst can read all quotes" on public.pricing_quotes;
create policy "finance/admin/analyst can read all quotes" on public.pricing_quotes
  for select to authenticated using (public.is_admin_role(array['super_admin', 'admin', 'finance', 'analyst']));
-- no insert/update/delete policy: only the SECURITY DEFINER function below writes.

create or replace function public.create_pricing_quote(p_plan_slug text, p_additional_universities integer default 0)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_plan public.pricing_plans;
  v_version public.pricing_plan_versions;
  v_addon public.pricing_plan_addons;
  v_extra integer := coalesce(p_additional_universities, 0);
  v_addon_amount bigint := 0;
  v_quote public.pricing_quotes;
begin
  if v_uid is null then raise exception 'You must be signed in to save a package.'; end if;
  if v_extra < 0 then raise exception 'The number of additional universities cannot be negative.'; end if;

  select * into v_plan from public.pricing_plans where slug = p_plan_slug and is_active = true;
  if not found then raise exception 'This package is not currently offered.'; end if;

  select * into v_version from public.pricing_plan_versions
  where plan_id = v_plan.id and status = 'published'
    and (effective_from is null or effective_from <= now()) and (effective_until is null or effective_until >= now())
  order by version_number desc limit 1;
  if not found then raise exception 'This package is not currently available.'; end if;

  select * into v_addon from public.pricing_plan_addons where plan_version_id = v_version.id and addon_key = 'additional_university';
  if v_extra > 0 then
    if not found then raise exception 'Additional universities are not available with this package.'; end if;
    if v_addon.max_additional_quantity is not null and v_extra > v_addon.max_additional_quantity then
      raise exception 'At most % additional universities can be added to this package.', v_addon.max_additional_quantity;
    end if;
    if v_addon.currency <> v_version.currency then raise exception 'Add-on currency does not match the package.'; end if;
    v_addon_amount := v_extra::bigint * v_addon.unit_amount_minor_units;
  end if;

  -- one quote at a time per student; concurrent calls queue here
  perform pg_advisory_xact_lock(hashtextextended('pricing_quote:' || v_uid::text, 0));
  update public.pricing_quotes set status = 'superseded' where student_user_id = v_uid and status = 'open';

  insert into public.pricing_quotes (
    student_user_id, plan_id, plan_version_id, addon_id, plan_slug_at_quote, plan_name_at_quote, currency,
    base_amount_minor_units, included_universities, additional_universities, addon_unit_amount_minor_units,
    addon_amount_minor_units, total_amount_minor_units, plan_tax_status, addon_tax_status, expires_at)
  values (
    v_uid, v_plan.id, v_version.id, case when v_addon.id is not null then v_addon.id end, v_plan.slug, v_version.public_title, v_version.currency,
    v_version.amount_minor_units, v_addon.included_quantity, v_extra, v_addon.unit_amount_minor_units,
    v_addon_amount, v_version.amount_minor_units + v_addon_amount, v_version.tax_status, v_addon.tax_status, now() + interval '30 days')
  returning * into v_quote;

  return jsonb_build_object(
    'id', v_quote.id, 'planSlug', v_quote.plan_slug_at_quote, 'planName', v_quote.plan_name_at_quote,
    'planVersionId', v_quote.plan_version_id, 'currency', v_quote.currency,
    'baseAmountMinorUnits', v_quote.base_amount_minor_units, 'includedUniversities', v_quote.included_universities,
    'additionalUniversities', v_quote.additional_universities, 'addonUnitAmountMinorUnits', v_quote.addon_unit_amount_minor_units,
    'addonAmountMinorUnits', v_quote.addon_amount_minor_units, 'totalAmountMinorUnits', v_quote.total_amount_minor_units,
    'expiresAt', v_quote.expires_at);
end;
$$;
revoke all on function public.create_pricing_quote(text, integer) from public, anon;
grant execute on function public.create_pricing_quote(text, integer) to authenticated;
comment on function public.create_pricing_quote(text, integer) is
  'NW-PRICING-V3: saves the signed-in student''s package choice as a quote. Every amount is read from the published plan version and its add-on; the caller supplies only the plan slug and a whole number of additional universities. Creates no invoice, purchase or entitlement.';

-- 5. The three plans -----------------------------------------------------------
create or replace function pg_temp.nw_v3_publish(
  p_slug text, p_category text, p_internal text, p_order int, p_recommended boolean,
  p_title text, p_short text, p_amount bigint, p_tax text, p_cta text,
  p_inclusions jsonb, p_addon_included int, p_addon_unit bigint)
returns void language plpgsql as $$
declare
  v_plan public.pricing_plans;
  v_version_id uuid;
  v_next int;
  v_old uuid;
  i jsonb;
  n int := 0;
begin
  insert into public.pricing_plans (slug, category, internal_name, display_order, is_recommended, is_active)
  values (p_slug, p_category, p_internal, p_order, p_recommended, true)
  on conflict (slug) do update set display_order = excluded.display_order, is_recommended = excluded.is_recommended, is_active = true
  returning * into v_plan;

  -- already published with exactly this title, price and scope? then nothing to do (idempotent re-run)
  if exists (
    select 1 from public.pricing_plan_versions v
    where v.plan_id = v_plan.id and v.status = 'published' and v.public_title = p_title
      and v.amount_minor_units = p_amount and v.cta_text is not distinct from p_cta
      and (select count(*) from public.pricing_plan_inclusions x where x.plan_version_id = v.id) = jsonb_array_length(p_inclusions)
  ) then
    update public.pricing_plans set current_version_id = (
      select v.id from public.pricing_plan_versions v where v.plan_id = v_plan.id and v.status = 'published' order by v.version_number desc limit 1)
    where id = v_plan.id;
    return;
  end if;

  select coalesce(max(version_number), 0) + 1 into v_next from public.pricing_plan_versions where plan_id = v_plan.id;
  insert into public.pricing_plan_versions (plan_id, version_number, public_title, short_description, currency, amount_minor_units, cta_text, tax_status, status, effective_from)
  values (v_plan.id, v_next, p_title, p_short, 'INR', p_amount, p_cta, p_tax, 'draft', now())
  returning id into v_version_id;

  for i in select * from jsonb_array_elements(p_inclusions) loop
    n := n + 1;
    insert into public.pricing_plan_inclusions (plan_version_id, display_order, title, category, numeric_allowance, unit, is_highlight)
    values (v_version_id, n * 10, i->>'t', i->>'c', nullif(i->>'n', '')::numeric, i->>'u', coalesce((i->>'h')::boolean, false));
  end loop;

  if p_addon_unit is not null then
    insert into public.pricing_plan_addons (plan_version_id, addon_key, public_label, included_quantity, unit_amount_minor_units, currency, tax_status)
    values (v_version_id, 'additional_university', 'Additional university application assistance', p_addon_included, p_addon_unit, 'INR', 'unconfigured');
  end if;

  -- archive the previous published version(s); history keeps pointing at them
  for v_old in select id from public.pricing_plan_versions where plan_id = v_plan.id and status = 'published' loop
    update public.pricing_plan_versions set status = 'archived' where id = v_old;
  end loop;
  update public.pricing_plan_versions set status = 'published' where id = v_version_id;
  update public.pricing_plans set current_version_id = v_version_id where id = v_plan.id;
end;
$$;

-- Verified keeps its slug (every existing purchase and capability keys off it), its price and its tax_status.
do $$
declare v_tax text;
begin
  select v.tax_status into v_tax from public.pricing_plan_versions v join public.pricing_plans p on p.id = v.plan_id
  where p.slug = 'nextwise-verified' and v.status = 'published' order by v.version_number desc limit 1;
  perform pg_temp.nw_v3_publish(
    'nextwise-verified', 'school_counselling', 'Nextwise Verified', 10, false,
    'Nextwise Verified', 'For students who need clarity before choosing their next direction.', 199900, coalesce(v_tax, 'unconfigured'),
    'Choose Verified',
    '[
      {"c":"Career and education guidance","t":"Full Nextwise Career Intelligence report","h":true},
      {"c":"Career and education guidance","t":"Career-path clarification if you are unsure of your direction"},
      {"c":"Career and education guidance","t":"Academic profile and eligibility screening","h":true},
      {"c":"Career and education guidance","t":"Education-pathway assessment"},
      {"c":"Career and education guidance","t":"Suitable education and career directions identified"},
      {"c":"Course and university guidance","t":"Limited counsellor-assisted university and course exploration"},
      {"c":"Course and university guidance","t":"Up to three researched course or programme recommendations","n":"3","u":"programmes","h":true},
      {"c":"Course and university guidance","t":"Admission requirements review"},
      {"c":"Course and university guidance","t":"Admission eligibility and skill-gap checklist"},
      {"c":"Course and university guidance","t":"Qualification and prerequisite guidance"},
      {"c":"Financial and opportunity screening","t":"Study-cost and affordability snapshot"},
      {"c":"Financial and opportunity screening","t":"Initial scholarship-opportunity screening"},
      {"c":"Financial and opportunity screening","t":"Official information sources for further research"},
      {"c":"Expert support","t":"One short expert clarification session","n":"1","u":"session","h":true},
      {"c":"Expert support","t":"One revision of your recommendation or guidance","n":"1","u":"revision"},
      {"c":"Expert support","t":"A practical next-step roadmap"},
      {"c":"Expert support","t":"Official source links supporting each recommendation"}
    ]'::jsonb, null, null);
end $$;

select pg_temp.nw_v3_publish(
  'study-abroad-lite', 'study_abroad', 'Nextwise Study Abroad Lite', 20, false,
  'Nextwise Study Abroad Lite', 'Structured study-abroad support, from profile review to settling in.', 4499900, 'unconfigured',
  'Choose Lite',
  '[
    {"c":"Dedicated counselling and strategy","t":"Detailed academic and professional profile evaluation"},
    {"c":"Dedicated counselling and strategy","t":"Senior dedicated counsellor","h":true},
    {"c":"Dedicated counselling and strategy","t":"Admission-readiness and admission-chance review (a qualitative assessment, not a guaranteed probability)"},
    {"c":"Dedicated counselling and strategy","t":"Country and course selection guidance"},
    {"c":"Dedicated counselling and strategy","t":"Balanced university shortlist of up to five institutions","n":"5","u":"universities"},
    {"c":"Dedicated counselling and strategy","t":"Guidance on suitability, eligibility and likely application requirements"},
    {"c":"CV, SOP and application documents","t":"CV creation where needed, and professional CV polishing"},
    {"c":"CV, SOP and application documents","t":"Complete Statement of Purpose (SOP) support","h":true},
    {"c":"CV, SOP and application documents","t":"Essay and supplementary application guidance"},
    {"c":"CV, SOP and application documents","t":"Letter of Recommendation (LOR) assistance"},
    {"c":"CV, SOP and application documents","t":"Application documentation guidance"},
    {"c":"CV, SOP and application documents","t":"Portfolio and presentation support where applicable"},
    {"c":"CV, SOP and application documents","t":"Offer-letter strategy and document coordination where appropriate"},
    {"c":"University applications","t":"Application assistance for up to five universities","n":"5","u":"universities","h":true},
    {"c":"University applications","t":"Application requirements checklist"},
    {"c":"University applications","t":"Application guidance and coordination"},
    {"c":"University applications","t":"Application deadline tracking"},
    {"c":"University applications","t":"Document review before submission"},
    {"c":"University applications","t":"Guidance on applicable scholarship opportunities"},
    {"c":"University applications","t":"Mentor sessions (number set out in your agreement)"},
    {"c":"Digital tools","t":"Nextwise student features, including saved universities and your shortlist where available"},
    {"c":"Offers, visa and pre-departure","t":"Offer-selection support"},
    {"c":"Offers, visa and pre-departure","t":"Scholarship and affordability guidance"},
    {"c":"Offers, visa and pre-departure","t":"Visa document guidance","h":true},
    {"c":"Offers, visa and pre-departure","t":"Education-loan information and coordination"},
    {"c":"Offers, visa and pre-departure","t":"Accommodation-search guidance"},
    {"c":"Offers, visa and pre-departure","t":"Pre-departure planning"},
    {"c":"Offers, visa and pre-departure","t":"Settling-in guidance for up to six months after you move","n":"6","u":"months"}
  ]'::jsonb, 5, 799900);

select pg_temp.nw_v3_publish(
  'study-abroad-premium', 'study_abroad', 'Nextwise Study Abroad Premium', 30, true,
  'Nextwise Study Abroad Premium', 'Comprehensive study-abroad planning with deeper strategy and priority support.', 7499900, 'unconfigured',
  'Choose Premium',
  '[
    {"c":"Comprehensive counselling and strategy","t":"Senior dedicated counsellor"},
    {"c":"Comprehensive counselling and strategy","t":"Comprehensive academic and professional profile assessment"},
    {"c":"Comprehensive counselling and strategy","t":"Detailed university-admission and application strategy","h":true},
    {"c":"Comprehensive counselling and strategy","t":"Profile-building and improvement plan"},
    {"c":"Comprehensive counselling and strategy","t":"Country and course selection guidance"},
    {"c":"Comprehensive counselling and strategy","t":"Balanced university shortlist of up to ten institutions","n":"10","u":"universities"},
    {"c":"Comprehensive counselling and strategy","t":"Detailed admission-readiness review and gap identification"},
    {"c":"Full application and document support","t":"Application assistance for up to ten universities","n":"10","u":"universities","h":true},
    {"c":"Full application and document support","t":"Complete SOP development and guidance, with up to three review rounds","n":"3","u":"review rounds"},
    {"c":"Full application and document support","t":"Professional CV creation, development and assessment"},
    {"c":"Full application and document support","t":"LOR strategy and recommendation-letter assistance"},
    {"c":"Full application and document support","t":"Essay and supplementary question review"},
    {"c":"Full application and document support","t":"Application document quality assurance"},
    {"c":"Full application and document support","t":"Deadline and submission tracking"},
    {"c":"Full application and document support","t":"Portfolio guidance where applicable"},
    {"c":"Scholarships and interviews","t":"Scholarship-application assistance for up to five opportunities","n":"5","u":"scholarships","h":true},
    {"c":"Scholarships and interviews","t":"Scholarship eligibility screening and document support"},
    {"c":"Scholarships and interviews","t":"Up to three mock interviews, with preparation and feedback","n":"3","u":"mock interviews","h":true},
    {"c":"Scholarships and interviews","t":"Profile presentation guidance where applicable"},
    {"c":"Mentor support","t":"All mentor sessions included in Lite, plus two more","n":"2","u":"additional sessions"},
    {"c":"Offer, finance and visa support","t":"University-offer, scholarship and total-cost comparison"},
    {"c":"Offer, finance and visa support","t":"Visa documentation guidance and coordination"},
    {"c":"Offer, finance and visa support","t":"Education-loan coordination"},
    {"c":"Offer, finance and visa support","t":"Accommodation and pre-departure guidance"},
    {"c":"Offer, finance and visa support","t":"Settling-in guidance within the programme scope"},
    {"c":"Family and priority support","t":"Parent progress meeting"},
    {"c":"Family and priority support","t":"Priority email and WhatsApp support for up to twelve months (working hours, not 24/7)","n":"12","u":"months","h":true},
    {"c":"Family and priority support","t":"Extra guidance at key application and admission milestones"}
  ]'::jsonb, 10, 799900);

-- 6. Retire everything else from the active catalogue ---------------------------
update public.pricing_plans set is_active = false, is_recommended = false
where slug not in ('nextwise-verified', 'study-abroad-lite', 'study-abroad-premium') and is_active = true;

-- 7. Checks: abort the whole transaction if the result is not exactly right ---------
do $$
declare v_active int; v_bad int;
begin
  select count(*) into v_active from public.pricing_plans where is_active;
  if v_active <> 3 then raise exception 'NW-PRICING-V3 check failed: % active plans, expected 3', v_active; end if;
  select count(*) into v_bad from (
    select p.slug, v.amount_minor_units from public.pricing_plans p join public.pricing_plan_versions v on v.id = p.current_version_id
    where p.is_active and v.status = 'published') x
  where (slug, amount_minor_units) not in (('nextwise-verified', 199900), ('study-abroad-lite', 4499900), ('study-abroad-premium', 7499900));
  if v_bad <> 0 then raise exception 'NW-PRICING-V3 check failed: an active plan has an unexpected price'; end if;
  if (select count(*) from public.pricing_plan_addons a join public.pricing_plans p on p.current_version_id = a.plan_version_id
      where a.unit_amount_minor_units = 799900 and ((p.slug = 'study-abroad-lite' and a.included_quantity = 5) or (p.slug = 'study-abroad-premium' and a.included_quantity = 10))) <> 2
  then raise exception 'NW-PRICING-V3 check failed: university add-ons not configured as expected'; end if;
  if exists (select 1 from public.pricing_plan_addons a join public.pricing_plans p on p.current_version_id = a.plan_version_id where p.slug = 'nextwise-verified')
  then raise exception 'NW-PRICING-V3 check failed: Verified must not offer additional universities'; end if;
end $$;

commit;
