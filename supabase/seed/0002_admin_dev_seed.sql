-- =============================================================================
-- CareerPath AI — Milestone 7 admin system DEV-ONLY seed data
-- =============================================================================
--
-- THIS FILE IS OPTIONAL AND IS NEVER RUN AUTOMATICALLY. It exists purely to
-- give a local development database enough sample records to exercise every
-- admin module's list/detail/filter views without starting from a totally
-- empty database. Nothing in this file is real:
--
--   * Every name, email, phone number, note, and figure below is obviously
--     fictional (fictional people, fictional Indian cities, made-up amounts).
--   * No real personal information of any kind appears here.
--   * No sample payment, agreement, or conversion event here should ever be
--     described as a real transaction, a real signed agreement, or a real
--     marketing conversion — they are UI fixtures only.
--   * This is completely separate from supabase/seed/0001_careers_seed.sql
--     (the Milestone 4 career-library seed) — running one has no effect on
--     the other, and neither is required for the other to work.
--
-- WHAT THIS DOES NOT SEED, AND WHY:
--   Students, admin_student_meta, admin_student_notes, and applications all
--   require a REAL row in Supabase Auth's auth.users table (a student
--   account created through the normal registration flow at /register) —
--   plain SQL cannot safely fabricate one, since Supabase Auth owns password
--   hashing and related security state for that table. This file therefore
--   seeds every module that does NOT require a real registered account
--   (counsellors, universities, courses, leads with no student link yet,
--   unlinked payment/agreement records, content items) so you can see a
--   populated admin UI immediately. To see the Students module and a fully
--   linked application populated, register one or two real test accounts at
--   /register locally, then either wait for a lead to be manually converted
--   to that email (Leads → a lead → "Convert to student") or create an
--   application/payment/agreement from the admin UI and enter that same
--   test account's email when asked.
--
-- HOW TO RUN (dev/staging only — never against a production database):
--   Apply supabase/migrations/0004_admin_system.sql FIRST, then run this
--   file's SQL against your local/dev Supabase project (SQL Editor, or
--   `psql "$DATABASE_URL" -f supabase/seed/0002_admin_dev_seed.sql`).
--
-- SAFE TO RE-RUN: every insert below is guarded with a fixed UUID and
-- `on conflict (id) do nothing`, so running this file twice does not create
-- duplicate rows.
--
-- The admin UI is fully functional with ZERO rows from this file — every
-- list page has an honest "no records yet" empty state. This file is a
-- convenience for local development, never a requirement.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Counsellors
-- ---------------------------------------------------------------------------
insert into public.counsellors (id, user_id, display_name, email, phone, specializations, regions, is_active, capacity, internal_notes)
values
  ('a1000000-0000-4000-8000-000000000001', null, 'Ananya Rao (sample)', 'ananya.rao.sample@example.test', '+91-90000-00001', array['Engineering', 'MBA'], array['North India', 'Delhi NCR'], true, 25, 'Sample counsellor record for local development only.'),
  ('a1000000-0000-4000-8000-000000000002', null, 'Vikram Sethi (sample)', 'vikram.sethi.sample@example.test', '+91-90000-00002', array['Study abroad', 'STEM'], array['South India', 'Gulf'], true, 30, 'Sample counsellor record for local development only.')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Universities
-- ---------------------------------------------------------------------------
insert into public.universities (id, name, slug, country, city, website, institution_type, summary, accreditation_status, is_active, is_visible, internal_notes)
values
  ('a2000000-0000-4000-8000-000000000001', 'Sample Institute of Technology', 'sample-institute-of-technology', 'India', 'Pune', 'https://example.test/sit', 'university', 'A fictional sample university used only for local development and testing.', 'self_reported', true, false, 'Fictional sample data — not a real institution.'),
  ('a2000000-0000-4000-8000-000000000002', 'Northbridge Global University (sample)', 'northbridge-global-university-sample', 'United Kingdom', 'Manchester', 'https://example.test/ngu', 'university', 'A fictional sample overseas university used only for local development and testing.', 'unverified', true, false, 'Fictional sample data — not a real institution.')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Courses
-- ---------------------------------------------------------------------------
insert into public.courses (
  id, university_id, name, slug, education_level, field_of_study, duration_text, delivery_mode, campus_location,
  intake_info, tuition_amount_minor_units, tuition_currency, tuition_period, entry_requirements_summary,
  application_url, is_active, is_visible, data_quality_status, internal_notes
)
values
  (
    'a3000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001',
    'B.Tech in Computer Science (sample)', 'btech-computer-science-sample', 'bachelor', 'Computer Science', '4 years',
    'on_campus', 'Pune main campus', 'Fall 2027 (sample)', 60000000, 'INR', 'per_year',
    'Sample entry requirement text — fictional, for development only.', 'https://example.test/sit/apply',
    true, false, 'draft', 'Fictional sample data.'
  ),
  (
    'a3000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000002',
    'MSc Data Science (sample)', 'msc-data-science-sample', 'master', 'Data Science', '1 year',
    'on_campus', 'Manchester campus', 'Fall 2027 (sample)', 2200000, 'GBP', 'per_program',
    'Sample entry requirement text — fictional, for development only.', 'https://example.test/ngu/apply',
    true, false, 'draft', 'Fictional sample data.'
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Leads (no student link — these are prospects, not registered accounts)
-- ---------------------------------------------------------------------------
insert into public.leads (
  id, full_name, email, phone, source, campaign, stage, priority, assigned_counsellor_id,
  next_follow_up_date, last_contact_date, consent_marketing, notes, utm_source, utm_medium, utm_campaign, landing_page
)
values
  (
    'a4000000-0000-4000-8000-000000000001', 'Priya Sharma (sample lead)', 'priya.sharma.sample@example.test', '+91-90000-10001',
    'website', 'sample-campaign', 'new', 'medium', 'a1000000-0000-4000-8000-000000000001',
    current_date + interval '3 days', current_date - interval '1 day', true,
    'Fictional sample lead for local development only.', 'google', 'cpc', 'sample-campaign', '/careers'
  ),
  (
    'a4000000-0000-4000-8000-000000000002', 'Rahul Mehta (sample lead)', 'rahul.mehta.sample@example.test', '+91-90000-10002',
    'referral', null, 'contacted', 'high', 'a1000000-0000-4000-8000-000000000002',
    current_date + interval '5 days', current_date - interval '2 days', false,
    'Fictional sample lead for local development only.', null, null, null, '/'
  ),
  (
    'a4000000-0000-4000-8000-000000000003', 'Sana Iqbal (sample lead)', 'sana.iqbal.sample@example.test', null,
    'event', 'sample-fair-2027', 'qualified', 'low', null,
    null, current_date - interval '10 days', true,
    'Fictional sample lead for local development only.', 'facebook', 'social', 'sample-fair-2027', '/pricing'
  )
on conflict (id) do nothing;

insert into public.lead_status_history (id, lead_id, from_stage, to_stage, changed_by, note)
values
  ('a5000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001', null, 'new', null, 'Seeded initial stage (sample data).'),
  ('a5000000-0000-4000-8000-000000000002', 'a4000000-0000-4000-8000-000000000002', null, 'new', null, 'Seeded initial stage (sample data).'),
  ('a5000000-0000-4000-8000-000000000003', 'a4000000-0000-4000-8000-000000000002', 'new', 'contacted', null, 'Seeded stage change (sample data).'),
  ('a5000000-0000-4000-8000-000000000004', 'a4000000-0000-4000-8000-000000000003', null, 'new', null, 'Seeded initial stage (sample data).'),
  ('a5000000-0000-4000-8000-000000000005', 'a4000000-0000-4000-8000-000000000003', 'new', 'qualified', null, 'Seeded stage change (sample data).')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Payments (unlinked to any student — demonstrates the module without a
-- real registered account; NOT a real transaction of any kind)
-- ---------------------------------------------------------------------------
insert into public.payments (
  id, student_user_id, application_id, invoice_reference, amount_minor_units, currency, payment_type,
  payment_method_label, status, due_date, paid_date, external_transaction_reference, refund_status,
  refund_amount_minor_units, internal_notes, created_by
)
values
  (
    'a6000000-0000-4000-8000-000000000001', null, null, 'SAMPLE-INV-0001', 150000, 'INR', 'counselling fee',
    'Bank transfer (sample)', 'pending', current_date + interval '7 days', null, null, 'none', null,
    'Fictional sample payment record — tracking only, not a real transaction.', null
  ),
  (
    'a6000000-0000-4000-8000-000000000002', null, null, 'SAMPLE-INV-0002', 500000, 'INR', 'application fee',
    'UPI (sample)', 'paid', current_date - interval '5 days', current_date - interval '4 days', 'SAMPLE-TXN-0002', 'none', null,
    'Fictional sample payment record — tracking only, not a real transaction.', null
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Agreements (linked to a sample counsellor and university only)
-- ---------------------------------------------------------------------------
insert into public.agreements (
  id, agreement_type, student_user_id, lead_id, counsellor_id, university_id, version, status,
  effective_date, expiry_date, document_reference_url, signature_status, internal_notes
)
values
  (
    'a7000000-0000-4000-8000-000000000001', 'Counselling service agreement (sample)', null, null,
    'a1000000-0000-4000-8000-000000000001', null, 'v1.0', 'draft', null, null, null, 'not_started',
    'Fictional sample agreement — no e-signature capability, no document actually stored.'
  ),
  (
    'a7000000-0000-4000-8000-000000000002', 'University partnership agreement (sample)', null, null,
    null, 'a2000000-0000-4000-8000-000000000001', 'v2.1', 'sent', current_date - interval '30 days', current_date + interval '335 days',
    'https://example.test/sample-agreement-reference', 'pending_signature',
    'Fictional sample agreement — no e-signature capability, no document actually stored.'
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Content items — a couple of draft/published samples
-- ---------------------------------------------------------------------------
insert into public.content_items (id, content_type, slug, content_key, locale, title, body, status, sort_order, published_at, editor_user_id)
values
  (
    'a8000000-0000-4000-8000-000000000001', 'faq', 'sample-faq-refunds', 'faq.refunds', 'en',
    'What is the refund policy? (sample)',
    'This is a fictional sample FAQ answer used only for local development. Replace or remove before any real use.',
    'draft', 0, null, null
  ),
  (
    'a8000000-0000-4000-8000-000000000002', 'announcement', 'sample-announcement-launch', 'announcement.launch', 'en',
    'Sample announcement',
    'This is a fictional sample announcement body used only for local development. Replace or remove before any real use.',
    'published', 0, now(), null
  )
on conflict (id) do nothing;
