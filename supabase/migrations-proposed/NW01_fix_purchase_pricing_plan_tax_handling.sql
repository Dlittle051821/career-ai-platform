-- ============================================================================
-- NW01 "Trust & System Integrity" — PROPOSED FIX, NOT AUTO-APPLIED.
--
-- *** FOR FOUNDER/ADMIN REVIEW ONLY. NOT EXECUTED AGAINST ANY DATABASE BY
-- *** this milestone, and deliberately placed OUTSIDE supabase/migrations/
-- *** so ordinary migration tooling (`supabase db push`, `supabase
-- *** migration up`, etc.) will never pick this up automatically. Per this
-- *** milestone's own instruction: "If an essential fix needs DB changes,
-- *** provide the proposed migration as a separately identified
-- *** approval-required artifact, not auto-executable." A human
-- *** administrator reviews this file, then — only after approving it —
-- *** copies it into supabase/migrations/ with the next sequential number
-- *** and applies it through the normal process (Supabase SQL Editor or
-- *** the CLI), exactly like every prior pricing migration in this repo.
--
-- WHAT THIS FIXES — the reported "₹1,999 became ₹2,358.82 after tax"
-- defect:
--   `public.purchase_pricing_plan()` has, since it was first introduced
--   (0007_nextwise_pricing_offers.sql PART 7, re-created unchanged by
--   0008_pricing_inclusions_and_presentation.sql to also add the
--   inclusions/presentation snapshot fields), always computed tax as a
--   flat ADDITION on top of `amount_minor_units` whenever GST is
--   configured at the business level — completely ignoring that same
--   plan version's own `tax_status` column ('unconfigured' /
--   'tax_exclusive' / 'tax_inclusive'), which IS shown to the public (see
--   PublicPricingPlanCard.tsx's TAX_WORDING). 0007's own migration
--   comment admits this was deliberate-but-incomplete: "a true
--   tax-inclusive back-calculation is deliberately not implemented."
--   The real seeded "Nextwise Verified" plan (supabase/seed/
--   0009_pr01_new_commercial_catalogue_seed.sql) is ₹1,999 with
--   `tax_status = 'unconfigured'` — once GST is configured in
--   `billing_settings` (gst_registered = true, a real gstin, and
--   default_tax_rate_bps = 1800), a purchase of that plan computes
--   199900 + round(199900 * 1800 / 10000) = 199900 + 35982 = 235882
--   paise — exactly the reported ₹2,358.82, despite the public page
--   showing no "tax will be added" warning for an unconfigured plan at
--   all (only `tax_exclusive` ever showed one), and despite this
--   product's own site-wide promise ("Every price shown is final — no
--   hidden fees.", PricingTrustStrip.tsx).
--
-- THE FIX: `tax_status` is now actually consulted.
--   - 'tax_exclusive': UNCHANGED — tax is still added on top. This is
--     the one case that was already correct, and the plan's own public
--     card already discloses it ("Applicable tax will be added at
--     checkout.").
--   - 'tax_inclusive': tax is now backed OUT of the displayed price
--     instead of added on top — the student is never charged more than
--     `amount_minor_units` (minus any discount). `tax_minor_units` on the
--     resulting invoice line is informational/accounting only.
--   - 'unconfigured': FOUNDER DECISION REQUIRED — see
--     NW01_PAYMENT_DECISIONS_AND_CONFIGURATION.md in this milestone's
--     delivery package for the full writeup. Nothing in this repository
--     establishes whether an admin leaving a plan's tax status
--     unconfigured should mean "treat as exclusive" or "treat as
--     inclusive" once GST goes live. This migration picks the
--     PROTECTIVE default — treat it exactly like 'tax_inclusive' (never
--     charge more than the displayed price) — because that is the only
--     choice consistent with what this product already tells the public
--     (no tax-will-be-added disclaimer is shown for an unconfigured
--     plan, and the site-wide "no hidden fees" promise already exists).
--     This is a deliberate, documented stopgap, NOT a resolved business
--     policy. The real, lasting fix is operational, not code: a founder
--     or admin should set an explicit `tax_status` on every live,
--     published plan version (src/app/admin/pricing/.../versions/...)
--     before GST is actually turned on in production, so no plan is
--     ever purchased while still 'unconfigured'.
--
-- This exact arithmetic (including the bps back-calculation formula) is
-- mirrored, and unit-tested, in src/lib/pricing/plan-purchase-tax.ts —
-- review that file's test suite (`npx vitest run
-- src/lib/pricing/plan-purchase-tax.test.ts`) to confirm the numbers
-- below before approving this migration.
--
-- SAFE TO APPLY — nothing else about this function changes:
--   - Signature, return shape, security definer, every validation branch
--     (offer/coupon eligibility, duplicate-checkout reuse, plan
--     availability), the invoice/line-item/purchase-row inserts, and the
--     offer-redemption-count update are copied VERBATIM from the current
--     live definition (0008's). Only the tax-computation block (originally
--     3 lines) changes, plus one new local variable (`v_taxable_base`).
--   - `create or replace function` with the identical signature —
--     applying this does not touch any existing row. It only changes
--     how a FUTURE call to this function computes tax.
--   - Does not touch any issued invoice's history (spec: "Do not mutate
--     issued invoice history") — this only affects purchases made AFTER
--     this migration is applied.
--   - Does not reseed, alter, or touch pricing_plans/pricing_plan_versions
--     data in any way — plan prices/tax_status values themselves are
--     unchanged; only how the purchase function USES tax_status changes.
--
-- VERIFY (run after applying, read-only):
--   select p.slug, v.public_title, v.tax_status, v.amount_minor_units
--   from public.pricing_plan_versions v
--   join public.pricing_plans p on p.id = v.plan_id
--   where v.status = 'published' and p.is_active = true
--   order by p.display_order;
--   -- Review every row's tax_status before enabling GST in
--   -- billing_settings — any 'unconfigured' row will purchase under the
--   -- protective (never-exceed-displayed-price) default above, which may
--   -- not be the commercially-intended treatment for that specific plan.
-- ============================================================================

create or replace function public.purchase_pricing_plan(
  p_plan_id uuid,
  p_offer_id uuid default null,
  p_coupon_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_version public.pricing_plan_versions;
  v_offer public.pricing_offers;
  v_existing_invoice_id uuid;
  v_discount_minor bigint := 0;
  v_settings public.billing_settings;
  v_gst_configured boolean;
  v_tax_rate_bps integer;
  -- NW01 Part H — new: the post-discount base tax is computed against,
  -- pulled out into its own variable since both branches below now need
  -- it (the original only needed it once, inline).
  v_taxable_base bigint;
  v_tax_minor bigint := 0;
  v_total_minor bigint;
  v_student_name text;
  v_student_email text;
  v_snapshot jsonb;
  v_invoice_id uuid;
  v_purchase_id uuid;
  v_prefix text;
  v_next bigint;
  v_invoice_number text;
  v_per_user_count integer;
  v_offer_redeem_ok uuid;
  v_inclusions jsonb;
  v_limits jsonb;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'You must be signed in to purchase a plan.';
  end if;

  -- Duplicate-checkout / idempotency guard: if this student already has an
  -- issued-but-unpaid invoice for this exact plan, hand back that SAME
  -- invoice rather than creating a second one — mirrors
  -- payment_attempts_one_active_per_invoice's "reuse, don't duplicate"
  -- pattern one level up the stack (0005_payments_billing.sql PART 5).
  select id into v_existing_invoice_id
  from public.invoices
  where student_user_id = v_uid and pricing_plan_id = p_plan_id and status in ('issued', 'partially_paid', 'overdue')
  order by created_at desc
  limit 1;

  if v_existing_invoice_id is not null then
    return jsonb_build_object('invoice_id', v_existing_invoice_id, 'reused', true);
  end if;

  if not exists (select 1 from public.pricing_plans where id = p_plan_id and is_active = true) then
    raise exception 'This plan is not currently offered.';
  end if;

  select * into v_version
  from public.pricing_plan_versions
  where plan_id = p_plan_id
    and status = 'published'
    and (effective_from is null or effective_from <= now())
    and (effective_until is null or effective_until >= now())
  order by version_number desc
  limit 1;

  if v_version.id is null then
    raise exception 'This plan is not currently available for purchase.';
  end if;

  if p_offer_id is not null or p_coupon_code is not null then
    select * into v_offer
    from public.pricing_offers
    where plan_id = p_plan_id
      and (id = p_offer_id or (p_coupon_code is not null and coupon_code = p_coupon_code))
    limit 1;

    if v_offer.id is null then
      raise exception 'This offer is not valid for this plan.';
    end if;
    if not (v_offer.is_active and v_offer.status = 'published' and now() >= v_offer.starts_at and now() <= v_offer.ends_at) then
      raise exception 'This offer is not currently active.';
    end if;
    if v_offer.max_redemptions is not null and v_offer.redemption_count >= v_offer.max_redemptions then
      raise exception 'This offer has reached its redemption limit.';
    end if;
    if v_offer.per_user_limit is not null then
      select count(*) into v_per_user_count from public.pricing_purchases where offer_id = v_offer.id and student_user_id = v_uid;
      if v_per_user_count >= v_offer.per_user_limit then
        raise exception 'You have already used this offer the maximum number of times.';
      end if;
    end if;

    if v_offer.discount_type = 'percentage' then
      v_discount_minor := round(v_version.amount_minor_units * v_offer.discount_percent_bps / 10000.0);
    else
      if v_offer.discount_currency <> v_version.currency then
        raise exception 'This offer''s currency does not match the plan''s currency.';
      end if;
      v_discount_minor := v_offer.discount_amount_minor_units;
    end if;
    -- Defensive clamp: "Fixed discount cannot exceed the eligible plan
    -- amount" / "Final price cannot be negative" — re-checked here against
    -- the CURRENT live price even though the admin form also validates this
    -- at offer-creation time, because the plan may have since been
    -- re-versioned to a lower price than when the offer was created.
    if v_discount_minor > v_version.amount_minor_units then
      v_discount_minor := v_version.amount_minor_units;
    end if;
  end if;

  select * into v_settings from public.billing_settings where id = 1;
  v_gst_configured := v_settings.gst_registered and v_settings.gstin is not null and length(trim(v_settings.gstin)) > 0;
  v_tax_rate_bps := case when v_gst_configured then v_settings.default_tax_rate_bps else null end;
  v_taxable_base := v_version.amount_minor_units - v_discount_minor;

  -- NW01 Part H fix — `tax_status` is now actually consulted (it never
  -- was before this migration). See this file's header comment for the
  -- full root-cause writeup and the founder-decision-required note on
  -- 'unconfigured'. Mirrored 1:1 in src/lib/pricing/plan-purchase-tax.ts.
  if v_tax_rate_bps is null then
    v_tax_minor := 0;
    v_total_minor := v_taxable_base;
  elsif v_version.tax_status = 'tax_exclusive' then
    -- Unchanged from before this migration: tax is an ADDITION on top of
    -- the displayed price — the only case the public page already warns
    -- about ("Applicable tax will be added at checkout.").
    v_tax_minor := round(v_taxable_base * v_tax_rate_bps / 10000.0);
    v_total_minor := v_taxable_base + v_tax_minor;
  else
    -- 'tax_inclusive', and 'unconfigured' (protective default — see
    -- header comment): the displayed/taxable-base amount is the CEILING
    -- on what the student is ever charged. Tax is backed OUT of it for
    -- the invoice line's own tax_minor_units (accounting/display only),
    -- never added on top of v_total_minor.
    v_tax_minor := round(v_taxable_base * v_tax_rate_bps / (10000.0 + v_tax_rate_bps));
    v_total_minor := v_taxable_base;
  end if;

  if v_total_minor < 0 then
    raise exception 'Computed price is invalid.';
  end if;

  select full_name, email into v_student_name, v_student_email from public.profiles where id = v_uid;

  v_snapshot := jsonb_build_object(
    'studentName', coalesce(nullif(trim(v_student_name), ''), 'Student'),
    'studentEmail', v_student_email,
    'legalEntityName', v_settings.legal_entity_name,
    'businessAddress', v_settings.business_address,
    'gstin', case when v_gst_configured then v_settings.gstin else null end,
    'gstRegisteredAtIssuance', v_gst_configured
  );

  -- Milestone 11 — ordered, active inclusions for the live version, frozen
  -- into the purchase snapshot exactly as they read right now. Never
  -- trusted from the browser; always re-derived here from the same
  -- v_version.id already resolved above.
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'title', i.title,
        'explanation', i.explanation,
        'category', i.category,
        'numericAllowance', i.numeric_allowance,
        'unit', i.unit,
        'isHighlight', i.is_highlight
      )
      order by i.display_order
    ) filter (where i.is_active),
    '[]'::jsonb
  )
  into v_inclusions
  from public.pricing_plan_inclusions i
  where i.plan_version_id = v_version.id;

  v_limits := jsonb_build_object(
    'sessionDurationNote', v_version.session_duration_note,
    'audienceLabel', v_version.audience_label,
    'universityShortlistLimit', v_version.university_shortlist_limit,
    'applicationSupportLimit', v_version.application_support_limit,
    'sopReviewRounds', v_version.sop_review_rounds,
    'scholarshipSupportNote', v_version.scholarship_support_note,
    'mockInterviewCount', v_version.mock_interview_count,
    'counsellorTier', v_version.counsellor_tier,
    'supportDurationNote', v_version.support_duration_note
  );

  v_prefix := 'INV-' || to_char(now(), 'YYYY');
  insert into public.invoice_number_sequences (prefix, last_value, updated_at)
  values (v_prefix, 1, now())
  on conflict (prefix) do update
    set last_value = public.invoice_number_sequences.last_value + 1,
        updated_at = now()
  returning last_value into v_next;
  v_invoice_number := v_prefix || '-' || lpad(v_next::text, 5, '0');

  insert into public.invoices (
    invoice_number, student_user_id, application_id, status, currency,
    subtotal_minor_units, discount_minor_units, tax_minor_units, total_minor_units,
    issue_date, due_date, internal_notes, student_notes, billing_snapshot,
    pricing_plan_id, pricing_offer_id,
    created_by, issued_by, issued_at
  ) values (
    v_invoice_number, v_uid, null, 'issued', v_version.currency,
    v_version.amount_minor_units, v_discount_minor, v_tax_minor, v_total_minor,
    current_date, null, null, null, v_snapshot,
    p_plan_id, v_offer.id,
    v_uid, v_uid, now()
  ) returning id into v_invoice_id;

  insert into public.invoice_line_items (
    invoice_id, description, quantity, unit_amount_minor_units, discount_minor_units,
    tax_rate_bps, tax_minor_units, line_total_minor_units, sort_order
  ) values (
    v_invoice_id, v_version.public_title, 1, v_version.amount_minor_units, v_discount_minor,
    v_tax_rate_bps, v_tax_minor, v_total_minor, 0
  );

  insert into public.pricing_purchases (
    student_user_id, plan_id, plan_version_id, plan_name_at_purchase, included_services_at_purchase,
    original_amount_minor_units, discount_minor_units, tax_minor_units, final_amount_minor_units, currency,
    offer_id, coupon_code_used, invoice_id,
    session_count_at_purchase, inclusions_at_purchase, presentation_limits_at_purchase
  ) values (
    v_uid, p_plan_id, v_version.id, v_version.public_title, v_version.included_services,
    v_version.amount_minor_units, v_discount_minor, v_tax_minor, v_total_minor, v_version.currency,
    v_offer.id, p_coupon_code, v_invoice_id,
    v_version.session_count, v_inclusions, v_limits
  ) returning id into v_purchase_id;

  if v_offer.id is not null then
    update public.pricing_offers
      set redemption_count = redemption_count + 1
      where id = v_offer.id and (max_redemptions is null or redemption_count < max_redemptions)
      returning id into v_offer_redeem_ok;
    if v_offer_redeem_ok is null then
      raise exception 'This offer just reached its redemption limit — please try again without the offer.';
    end if;
  end if;

  return jsonb_build_object(
    'invoice_id', v_invoice_id,
    'purchase_id', v_purchase_id,
    'reused', false,
    'total_minor_units', v_total_minor,
    'currency', v_version.currency,
    'invoice_number', v_invoice_number
  );
end;
$$;
