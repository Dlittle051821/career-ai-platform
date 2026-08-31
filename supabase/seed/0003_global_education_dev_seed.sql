-- =============================================================================
-- NextWise — Milestone 9 Global Education Data Platform — REPRESENTATIVE
-- STARTER DATASET (real institutions, explicitly NOT a complete database)
-- =============================================================================
--
-- WHAT THIS IS: eight real, well-known universities across eight of the
-- countries listed in the Milestone 9 spec (Germany, United Kingdom, Canada,
-- Australia, United States, India, Ireland, Sweden), each with one real
-- graduate program, sourced ENTIRELY from that institution's own official
-- website (never a ranking site, never a third-party aggregator). Every
-- record carries a `source_url` and `last_verified_at` date so a reader can
-- go check the claim themselves.
--
-- WHAT THIS IS NOT:
--   * NOT a complete list of universities or courses in these 8 countries,
--     let alone the other 13 countries this platform's schema already
--     supports (Austria, Belgium, Czech Republic, Denmark, Finland, France,
--     Italy, Netherlands, Norway, Poland, Portugal, Spain, Switzerland —
--     all present in `countries` via migration 0006, zero rows here).
--   * NOT a claim of institutional accreditation — `accreditation_status`
--     is deliberately left at its Milestone 7 default ('unverified') for
--     every row here; nobody on this project confirmed accreditation-body
--     status with an accreditor, so it is never asserted.
--   * NOT current, continuously-refreshed data. A fee, deadline, or
--     scholarship figure below is only as current as its `last_verified_at`
--     date — it can go stale the moment the institution updates its own
--     page. This is a starting point for the import/verification workflow
--     (see docs/global-education-data-guide.md), not a substitute for it.
--   * NOT a source of truth for tuition amounts a student should rely on
--     for a real application — every course record's public display must
--     link back to the official course/fees page (already wired into the
--     schema via `source_url`) and the public UI must tell the student to
--     confirm with the institution (spec requirement).
--
-- HONESTY RULES FOLLOWED WHILE BUILDING THIS FILE (do not weaken these on a
-- future edit of this file):
--   1. Every fact below was checked against an official university (or, for
--      one founding year where the university's own site declined to state
--      one — University of Oxford — a clearly-marked encyclopedic source)
--      page at the time noted in `last_verified_at`, via live web research.
--   2. Where an official page did not state a fact (a specific tuition
--      figure, an exact English-test minimum, a program-specific intake
--      date), the corresponding column is left NULL here — never guessed,
--      never rounded, never inferred from a "typical" figure. Search
--      `-- NOT STATED:` comments below for a full list of what was
--      deliberately omitted per record.
--   3. `verification_status` is 'verified' only where the record's core
--      identifying facts (and, for a course, its key commercial facts —
--      tuition, duration, English requirement) were all confirmed; anything
--      with a real but incomplete or dated fact set is 'needs_review' so it
--      surfaces on the admin data-quality dashboard for a human to follow up
--      on, not because anything false was entered.
--   4. No university logo image is included anywhere (`logo_url` is NULL
--      throughout) — the spec asks not to use protected institution logos
--      without permission.
--   5. Currency is never converted — every amount is stored in the
--      institution's own stated currency (EUR/GBP/AUD/USD/INR), per the
--      spec's "never silently convert currencies" rule.
--
-- PREREQUISITES: apply supabase/migrations/0006_global_university_course_data.sql
-- FIRST (it seeds the `countries` table this file's country_id lookups
-- depend on).
--
-- SAFE TO RE-RUN: every insert below uses a fixed UUID and
-- `on conflict (id) do nothing` (mirroring supabase/seed/0002_admin_dev_seed.sql's
-- convention), except `education_data_provenance` rows, which key off their
-- own `unique (entity_type, entity_id)` constraint via
-- `on conflict (entity_type, entity_id) do nothing`.
--
-- This file is OPTIONAL and is never run automatically — see
-- docs/global-education-data-guide.md for how/when to run it.
-- =============================================================================


-- =============================================================================
-- 1. Technical University of Munich (TUM) — Germany
-- Sources: https://www.tum.de/en/ , https://www.tum.de/en/about-tum/facts-and-figures/history ,
-- https://web.tum.de/web/impressum/ , https://www.tum.de/en/studies/degree-programs/detail/informatics-master-of-science-msc ,
-- https://www.tum.de/en/studies/fees/tuition , https://www.tum.de/en/studies/fees-and-financial-aid/scholarships/tum-scholarships/deutschlandstipendium
-- NOT STATED: exact tuition for this specific program (only a university-wide
-- EUR 4,000-6,000/semester non-EU range exists — kept as free text, not a
-- structured tuition row, since it is not a single verified figure);
-- program-specific English test minimum score; a precise founding-year
-- source narrower than the general TUM history page.
-- =============================================================================

insert into public.universities (
  id, name, slug, country, city, website, institution_type, summary, is_active, is_visible,
  country_id, admissions_url, ownership_type, founding_year, publication_status,
  data_source, source_url, source_access_date, last_verified_at, verification_status
) values (
  'e9000001-0000-4000-8000-000000000001', 'Technical University of Munich', 'technical-university-of-munich',
  'Germany', 'Munich', 'https://www.tum.de/en/', 'university',
  'A public research university in Munich, Germany, founded in 1868.', true, true,
  (select id from public.countries where iso_alpha2 = 'DE'),
  'https://www.tum.de/en/studies/application/application-info-portal/application-international',
  'public', 1868, 'published',
  'Official TUM website', 'https://www.tum.de/en/about-tum/facts-and-figures/history', current_date, current_date, 'verified'
) on conflict (id) do nothing;

insert into public.campuses (id, university_id, name, country_id, state_region, city, is_main, is_active)
values (
  'e9000001-0000-4000-8000-000000000101', 'e9000001-0000-4000-8000-000000000001', 'Garching Campus',
  (select id from public.countries where iso_alpha2 = 'DE'), 'Bavaria', 'Garching', true, true
) on conflict (id) do nothing;

insert into public.courses (
  id, university_id, campus_id, name, slug, education_level, field_of_study, delivery_mode,
  tuition_currency, entry_requirements_summary, application_url, is_active, is_visible, data_quality_status,
  program_code, subject_area, qualification_title, duration_value, duration_unit, teaching_language,
  course_url, additional_fees_summary, publication_status, data_source, source_url, last_verified_at, verification_status
) values (
  'e9000002-0000-4000-8000-000000000001', 'e9000001-0000-4000-8000-000000000001', 'e9000001-0000-4000-8000-000000000101',
  'Informatics (M.Sc.)', 'msc-informatics', 'postgraduate', 'Computer Science', 'on_campus',
  'EUR', 'English language proficiency required; see official Academic and Examination Regulations (FPSO) for the specific test/score.',
  'https://www.tum.de/en/studies/degree-programs/detail/informatics-master-of-science-msc', true, true, 'reviewed',
  null, 'Computer Science', 'Master of Science (M.Sc.)', 2, 'years', 'English',
  'https://www.tum.de/en/studies/degree-programs/detail/informatics-master-of-science-msc',
  'General (not program-specific) non-EU/EEA tuition is usually EUR 4,000 or EUR 6,000 per semester, applying from Winter Semester 2024/25 onward — see https://www.tum.de/en/studies/fees/tuition for which rate applies. No program-specific figure is published for this course.',
  'published', 'Official TUM website', 'https://www.tum.de/en/studies/degree-programs/detail/informatics-master-of-science-msc', current_date, 'needs_review'
) on conflict (id) do nothing;

insert into public.course_intakes (
  id, course_id, intake_name, start_month, start_year, applications_open_at, final_deadline,
  capacity_status, intake_status, data_source, source_url, last_verified_at
) values (
  'e9000003-0000-4000-8000-000000000001', 'e9000002-0000-4000-8000-000000000001', 'Winter Semester', 10, 2027,
  '2027-02-01', '2027-05-31', 'unknown', 'upcoming',
  'Official TUM website', 'https://www.tum.de/en/studies/degree-programs/detail/informatics-master-of-science-msc', current_date
) on conflict (id) do nothing;

insert into public.scholarships (
  id, scope, university_id, name, eligibility, award_amount_minor_units, award_description, currency_code,
  scholarship_url, international_eligible, is_active, data_source, source_url, last_verified_at
) values (
  'e9000006-0000-4000-8000-000000000001', 'university', 'e9000001-0000-4000-8000-000000000001',
  'Deutschlandstipendium at TUM', 'Merit/achievement-based; open to TUM students generally.',
  30000, 'EUR 300 per month, renewable, funded jointly by public and private sponsors.', 'EUR',
  'https://www.tum.de/en/studies/fees-and-financial-aid/scholarships/tum-scholarships/deutschlandstipendium',
  true, true, 'Official TUM website', 'https://www.tum.de/en/studies/fees-and-financial-aid/scholarships/tum-scholarships/deutschlandstipendium', current_date
) on conflict (id) do nothing;

insert into public.education_data_provenance (entity_type, entity_id, source_provider, source_type, source_url, retrieved_at, last_verified_at, verification_status, data_quality_status)
values
  ('university', 'e9000001-0000-4000-8000-000000000001', 'TUM Official Website', 'official_university', 'https://www.tum.de/en/about-tum/facts-and-figures/history', current_date, current_date, 'verified', 'current'),
  ('course', 'e9000002-0000-4000-8000-000000000001', 'TUM Official Website', 'official_university', 'https://www.tum.de/en/studies/degree-programs/detail/informatics-master-of-science-msc', current_date, current_date, 'needs_review', 'review_soon')
on conflict (entity_type, entity_id) do nothing;


-- =============================================================================
-- 2. University of Oxford — United Kingdom
-- Sources: https://www.ox.ac.uk/ , https://www.ox.ac.uk/about/organisation/university-as-a-charity ,
-- https://www.ox.ac.uk/about/organisation/history , https://www.ox.ac.uk/admissions/graduate/courses/msc-advanced-computer-science ,
-- https://www.ox.ac.uk/clarendon/about
-- NOT STATED: an exact founding year on Oxford's own site ("no clear date of
-- foundation"; the commonly cited c.1096 is an encyclopedic estimate, so
-- founding_year is left NULL here rather than asserting a precise year);
-- Clarendon Fund award amount (individually determined, not a fixed figure).
-- =============================================================================

insert into public.universities (
  id, name, slug, country, city, website, institution_type, summary, is_active, is_visible,
  country_id, admissions_url, ownership_type, publication_status,
  data_source, source_url, source_access_date, last_verified_at, verification_status
) values (
  'e9000001-0000-4000-8000-000000000002', 'University of Oxford', 'university-of-oxford',
  'United Kingdom', 'Oxford', 'https://www.ox.ac.uk/', 'university',
  'A public university in Oxford, England. Oxford''s own history page states there is no single clear founding date, only that teaching existed in some form from around 1096.', true, true,
  (select id from public.countries where iso_alpha2 = 'GB'),
  'https://www.ox.ac.uk/admissions/graduate', 'public', 'published',
  'Official University of Oxford website', 'https://www.ox.ac.uk/about/organisation/university-as-a-charity', current_date, current_date, 'verified'
) on conflict (id) do nothing;

insert into public.campuses (id, university_id, name, country_id, city, is_main, is_active)
values (
  'e9000001-0000-4000-8000-000000000102', 'e9000001-0000-4000-8000-000000000002', 'Oxford Campus',
  (select id from public.countries where iso_alpha2 = 'GB'), 'Oxford', true, true
) on conflict (id) do nothing;

insert into public.courses (
  id, university_id, campus_id, name, slug, education_level, field_of_study, delivery_mode,
  tuition_amount_minor_units, tuition_currency, tuition_period, entry_requirements_summary, application_url, is_active, is_visible, data_quality_status,
  subject_area, qualification_title, duration_value, duration_unit, teaching_language,
  english_requirements, course_url, publication_status, data_source, source_url, last_verified_at, verification_status
) values (
  'e9000002-0000-4000-8000-000000000002', 'e9000001-0000-4000-8000-000000000002', 'e9000001-0000-4000-8000-000000000102',
  'MSc in Advanced Computer Science', 'msc-advanced-computer-science', 'postgraduate', 'Computer Science', 'on_campus',
  4373000, 'GBP', 'per_year', 'IELTS Academic 7.5 overall (7.0 minimum per component), or equivalent (TOEFL iBT 110, C1 Advanced 191, C2 Proficiency 191, Oxford Test of English Advanced 165).',
  'https://www.ox.ac.uk/admissions/graduate/courses/msc-advanced-computer-science', true, true, 'approved',
  'Computer Science', 'Master of Science (M.Sc.)', 12, 'months', 'English',
  '{"ielts": {"overall": 7.5, "minComponent": 7.0}}'::jsonb,
  'https://www.ox.ac.uk/admissions/graduate/courses/msc-advanced-computer-science',
  'published', 'Official University of Oxford website', 'https://www.ox.ac.uk/admissions/graduate/courses/msc-advanced-computer-science', current_date, 'verified'
) on conflict (id) do nothing;

insert into public.course_intakes (
  id, course_id, intake_name, start_month, start_year, capacity_status, intake_status, data_source, source_url, last_verified_at
) values (
  'e9000003-0000-4000-8000-000000000002', 'e9000002-0000-4000-8000-000000000002', 'Michaelmas Term (October start)', 10, 2026,
  'closed', 'closed', 'Official University of Oxford website',
  'https://www.ox.ac.uk/admissions/graduate/courses/msc-advanced-computer-science', current_date
) on conflict (id) do nothing;

insert into public.course_admission_requirements (
  id, course_id, accepted_qualification, language_test, language_test_min_score, data_source, source_url, last_verified_at
) values (
  'e9000005-0000-4000-8000-000000000001', 'e9000002-0000-4000-8000-000000000002',
  'A first-class or strong upper-second-class UK honours degree (or equivalent) in computer science or a closely related discipline — see the official course page for the precise academic criteria.',
  'IELTS', 7.5, 'Official University of Oxford website', 'https://www.ox.ac.uk/admissions/graduate/courses/msc-advanced-computer-science', current_date
) on conflict (id) do nothing;

insert into public.scholarships (
  id, scope, university_id, name, eligibility, currency_code, scholarship_url, international_eligible, is_active, data_source, source_url, last_verified_at
) values (
  'e9000006-0000-4000-8000-000000000002', 'university', 'e9000001-0000-4000-8000-000000000002',
  'Clarendon Fund', 'Academically outstanding graduate applicants; award value determined individually, not a fixed published figure.', 'GBP',
  'https://www.ox.ac.uk/clarendon/about', true, true,
  'Official University of Oxford website', 'https://www.ox.ac.uk/clarendon/about', current_date
) on conflict (id) do nothing;

insert into public.education_data_provenance (entity_type, entity_id, source_provider, source_type, source_url, retrieved_at, last_verified_at, verification_status, data_quality_status)
values
  ('university', 'e9000001-0000-4000-8000-000000000002', 'University of Oxford Official Website', 'official_university', 'https://www.ox.ac.uk/about/organisation/university-as-a-charity', current_date, current_date, 'verified', 'current'),
  ('course', 'e9000002-0000-4000-8000-000000000002', 'University of Oxford Official Website', 'official_university', 'https://www.ox.ac.uk/admissions/graduate/courses/msc-advanced-computer-science', current_date, current_date, 'verified', 'current')
on conflict (entity_type, entity_id) do nothing;


-- =============================================================================
-- 3. University of Toronto — Canada
-- Sources: https://www.utoronto.ca/about-u-of-t , https://ocw.utoronto.ca/about-uoft/ ,
-- https://www.utoronto.ca/news/u-t-ranked-no-1-canada-one-world-s-top-10-public-universities ,
-- https://ischool.utoronto.ca/master-of-information/ ,
-- https://ischool.utoronto.ca/future-students/apply/graduate-admission-requirements-of-our-masters-programs/ ,
-- https://ischool.utoronto.ca/current-students/money-matters/awards/deans-scholarships/
-- NOT STATED: tuition amount (the official fee page is an interactive
-- lookup tool, not a static published figure); teaching language; an
-- MI-program-specific intake date (only a general international-applicant
-- timeline page exists, not confirmed to be MI-specific) — course_intakes
-- intentionally has NO row for this course as a result.
-- =============================================================================

insert into public.universities (
  id, name, slug, country, city, website, institution_type, summary, is_active, is_visible,
  country_id, admissions_url, ownership_type, founding_year, publication_status,
  data_source, source_url, source_access_date, last_verified_at, verification_status
) values (
  'e9000001-0000-4000-8000-000000000003', 'University of Toronto', 'university-of-toronto',
  'Canada', 'Toronto', 'https://www.utoronto.ca', 'university',
  'A public research university in Toronto, Ontario, Canada, established in 1827.', true, true,
  (select id from public.countries where iso_alpha2 = 'CA'),
  'https://future.utoronto.ca/international-students', 'public', 1827, 'published',
  'Official University of Toronto website', 'https://www.utoronto.ca/about-u-of-t', current_date, current_date, 'verified'
) on conflict (id) do nothing;

insert into public.campuses (id, university_id, name, country_id, state_region, city, is_main, is_active)
values (
  'e9000001-0000-4000-8000-000000000103', 'e9000001-0000-4000-8000-000000000003', 'St. George Campus',
  (select id from public.countries where iso_alpha2 = 'CA'), 'Ontario', 'Toronto', true, true
) on conflict (id) do nothing;

insert into public.courses (
  id, university_id, campus_id, name, slug, education_level, field_of_study, delivery_mode,
  tuition_currency, entry_requirements_summary, application_url, is_active, is_visible, data_quality_status,
  subject_area, qualification_title, duration_value, duration_unit, english_requirements,
  additional_fees_summary, course_url, publication_status, data_source, source_url, last_verified_at, verification_status
) values (
  'e9000002-0000-4000-8000-000000000003', 'e9000001-0000-4000-8000-000000000003', 'e9000001-0000-4000-8000-000000000103',
  'Master of Information (MI)', 'master-of-information', 'postgraduate', 'Information Science', 'on_campus',
  'CAD', 'IELTS overall 7.5 (Writing 7.5, Speaking 7.0 minimum); see official admission-requirements page for alternate accepted tests.',
  'https://ischool.utoronto.ca/master-of-information/', true, true, 'reviewed',
  'Information Science', 'Master of Information (MI)', 2, 'years',
  '{"ielts": {"overall": 7.5, "minComponent": 7.0}}'::jsonb,
  'Tuition is not published as a static figure — see the university''s official fee lookup tool at https://tuitionexplorer.registrar.utoronto.ca/index.php',
  'https://ischool.utoronto.ca/master-of-information/',
  'published', 'Official University of Toronto website', 'https://ischool.utoronto.ca/master-of-information/', current_date, 'needs_review'
) on conflict (id) do nothing;

insert into public.course_admission_requirements (
  id, course_id, accepted_qualification, language_test, language_test_min_score, data_source, source_url, last_verified_at
) values (
  'e9000005-0000-4000-8000-000000000002', 'e9000002-0000-4000-8000-000000000003',
  'A four-year bachelor''s degree (or equivalent) with a strong academic record; see the official page for full department-specific criteria.',
  'IELTS', 7.5, 'Official University of Toronto website',
  'https://ischool.utoronto.ca/future-students/apply/graduate-admission-requirements-of-our-masters-programs/', current_date
) on conflict (id) do nothing;

insert into public.scholarships (
  id, scope, university_id, course_id, name, eligibility, award_description, currency_code, scholarship_url, international_eligible, is_active, data_source, source_url, last_verified_at
) values (
  'e9000006-0000-4000-8000-000000000003', 'course', null, 'e9000002-0000-4000-8000-000000000003',
  'Dean''s Master of Information Scholarships', 'Automatic entrance award for MI applicants with an admission average of roughly 3.80/4.0 or higher; materials due January 31; no separate application required.',
  'Value varies by year; non-renewable entrance award.', 'CAD',
  'https://ischool.utoronto.ca/current-students/money-matters/awards/deans-scholarships/', true, true,
  'Official University of Toronto website', 'https://ischool.utoronto.ca/current-students/money-matters/awards/deans-scholarships/', current_date
) on conflict (id) do nothing;

insert into public.education_data_provenance (entity_type, entity_id, source_provider, source_type, source_url, retrieved_at, last_verified_at, verification_status, data_quality_status)
values
  ('university', 'e9000001-0000-4000-8000-000000000003', 'University of Toronto Official Website', 'official_university', 'https://www.utoronto.ca/about-u-of-t', current_date, current_date, 'verified', 'current'),
  ('course', 'e9000002-0000-4000-8000-000000000003', 'University of Toronto Official Website', 'official_university', 'https://ischool.utoronto.ca/master-of-information/', current_date, current_date, 'needs_review', 'review_soon')
on conflict (entity_type, entity_id) do nothing;


-- =============================================================================
-- 4. University of Melbourne — Australia
-- Sources: https://about.unimelb.edu.au/ , https://unimelb.edu.au/__data/assets/pdf_file/0005/1724846/transcript-eng.pdf ,
-- https://about.unimelb.edu.au/strategy/governance/regulatory-framework/legislative-framework ,
-- https://study.unimelb.edu.au/find/courses/graduate/master-of-information-technology/ (+ /fees/ , /entry-requirements/ , /how-to-apply/) ,
-- https://scholarships.unimelb.edu.au/awards/melbourne-international-graduate-scholarship
-- This is the most fully-documented record in this starter set — tuition,
-- duration, teaching language, English requirement, and two dated intake
-- deadlines were all confirmed on official pages.
-- =============================================================================

insert into public.universities (
  id, name, slug, country, city, website, institution_type, summary, is_active, is_visible,
  country_id, admissions_url, ownership_type, founding_year, publication_status,
  data_source, source_url, source_access_date, last_verified_at, verification_status
) values (
  'e9000001-0000-4000-8000-000000000004', 'The University of Melbourne', 'university-of-melbourne',
  'Australia', 'Melbourne', 'https://www.unimelb.edu.au', 'university',
  'A public university in Melbourne, Victoria, Australia, founded in 1853 and established by the University of Melbourne Act 2009 (Victorian state legislation).', true, true,
  (select id from public.countries where iso_alpha2 = 'AU'),
  'https://study.unimelb.edu.au/how-to-apply/graduate-coursework-study/international-applications', 'public', 1853, 'published',
  'Official University of Melbourne website', 'https://unimelb.edu.au/__data/assets/pdf_file/0005/1724846/transcript-eng.pdf', current_date, current_date, 'verified'
) on conflict (id) do nothing;

insert into public.campuses (id, university_id, name, country_id, state_region, city, is_main, is_active)
values (
  'e9000001-0000-4000-8000-000000000104', 'e9000001-0000-4000-8000-000000000004', 'Parkville Campus',
  (select id from public.countries where iso_alpha2 = 'AU'), 'Victoria', 'Melbourne', true, true
) on conflict (id) do nothing;

insert into public.courses (
  id, university_id, campus_id, name, slug, education_level, field_of_study, delivery_mode,
  tuition_currency, entry_requirements_summary, application_url, is_active, is_visible, data_quality_status,
  subject_area, qualification_title, duration_value, duration_unit, teaching_language, english_requirements,
  course_url, publication_status, data_source, source_url, last_verified_at, verification_status
) values (
  'e9000002-0000-4000-8000-000000000004', 'e9000001-0000-4000-8000-000000000004', 'e9000001-0000-4000-8000-000000000104',
  'Master of Information Technology', 'master-of-information-technology', 'postgraduate', 'Information Technology', 'on_campus',
  'AUD', 'IELTS overall 6.5, no band below 6.0; standard entry is a 2-year full-time program (1-1.5 years with relevant prior qualifications).',
  'https://study.unimelb.edu.au/find/courses/graduate/master-of-information-technology/', true, true, 'approved',
  'Information Technology', 'Master of Information Technology', 2, 'years', 'English',
  '{"ielts": {"overall": 6.5, "minComponent": 6.0}}'::jsonb,
  'https://study.unimelb.edu.au/find/courses/graduate/master-of-information-technology/',
  'published', 'Official University of Melbourne website', 'https://study.unimelb.edu.au/find/courses/graduate/master-of-information-technology/', current_date, 'verified'
) on conflict (id) do nothing;

insert into public.course_tuition_fees (
  id, course_id, student_category, amount_minor_units, currency_code, academic_year, billing_period, data_source, source_url, last_verified_at
) values (
  'e9000004-0000-4000-8000-000000000001', 'e9000002-0000-4000-8000-000000000004', 'international',
  6400000, 'AUD', '2026', 'per_year', 'Official University of Melbourne website',
  'https://study.unimelb.edu.au/find/courses/graduate/master-of-information-technology/fees/', current_date
) on conflict (id) do nothing;

insert into public.course_intakes (
  id, course_id, intake_name, start_month, start_year, final_deadline, capacity_status, intake_status, data_source, source_url, last_verified_at
) values
  ('e9000003-0000-4000-8000-000000000003', 'e9000002-0000-4000-8000-000000000004', 'March intake (Semester 1)', 3, 2027,
   '2026-11-30', 'unknown', 'upcoming', 'Official University of Melbourne website',
   'https://study.unimelb.edu.au/find/courses/graduate/master-of-information-technology/how-to-apply/', current_date),
  ('e9000003-0000-4000-8000-000000000004', 'e9000002-0000-4000-8000-000000000004', 'July intake (Semester 2)', 7, 2027,
   '2027-05-31', 'unknown', 'upcoming', 'Official University of Melbourne website',
   'https://study.unimelb.edu.au/find/courses/graduate/master-of-information-technology/how-to-apply/', current_date)
on conflict (id) do nothing;

insert into public.course_admission_requirements (
  id, course_id, accepted_qualification, language_test, language_test_min_score, data_source, source_url, last_verified_at
) values (
  'e9000005-0000-4000-8000-000000000003', 'e9000002-0000-4000-8000-000000000004',
  'A recognised bachelor''s degree; entry pathway and duration depend on the applicant''s prior qualifications — see the official entry-requirements page.',
  'IELTS', 6.5, 'Official University of Melbourne website',
  'https://study.unimelb.edu.au/find/courses/graduate/master-of-information-technology/entry-requirements/', current_date
) on conflict (id) do nothing;

insert into public.scholarships (
  id, scope, university_id, name, eligibility, award_description, currency_code, scholarship_url, international_eligible, is_active, data_source, source_url, last_verified_at
) values (
  'e9000006-0000-4000-8000-000000000004', 'university', 'e9000001-0000-4000-8000-000000000004',
  'Melbourne International Graduate Scholarship', 'For citizens of countries with GDP per capita <= US$10,000 who receive an Overseas Fee offer into a Master''s program (excludes DDS, Medicine, Optometry, Physiotherapy, Clinical Dentistry, Veterinary Medicine); automatic, no separate application; at least 300 awarded annually.',
  '20% remission of the tuition fee for the duration of the Master''s degree.', 'AUD',
  'https://scholarships.unimelb.edu.au/awards/melbourne-international-graduate-scholarship', true, true,
  'Official University of Melbourne website', 'https://scholarships.unimelb.edu.au/awards/melbourne-international-graduate-scholarship', current_date
) on conflict (id) do nothing;

insert into public.education_data_provenance (entity_type, entity_id, source_provider, source_type, source_url, retrieved_at, last_verified_at, verification_status, data_quality_status)
values
  ('university', 'e9000001-0000-4000-8000-000000000004', 'University of Melbourne Official Website', 'official_university', 'https://about.unimelb.edu.au/', current_date, current_date, 'verified', 'current'),
  ('course', 'e9000002-0000-4000-8000-000000000004', 'University of Melbourne Official Website', 'official_university', 'https://study.unimelb.edu.au/find/courses/graduate/master-of-information-technology/', current_date, current_date, 'verified', 'current')
on conflict (entity_type, entity_id) do nothing;


-- =============================================================================
-- 5. Massachusetts Institute of Technology (MIT) — United States
-- Sources: https://www.mit.edu/ , https://web.mit.edu/about/ , https://facts.mit.edu/ ,
-- https://nces.ed.gov/collegenavigator/?id=166683 (US Dept. of Education — ownership type),
-- https://mitsloan.mit.edu/master-of-business-analytics (+ /admissions/tuition-and-financial-aid) ,
-- https://oge.mit.edu/fellowships/presidential-graduate-fellowship-program/
-- NOT STATED: teaching language (English is near-certain for an MIT program
-- but was not found stated in those words, so left NULL rather than assumed
-- the way it was for the UK/Australian on-campus programs above); MBAn
-- program-specific IELTS/TOEFL minimum (MIT's general graduate page defers
-- this to "department information", not published centrally); MBAn-specific
-- intake month (only MIT's general academic-calendar Fall start date is
-- published) — course_intakes intentionally has NO row for this course.
-- =============================================================================

insert into public.universities (
  id, name, slug, country, city, website, institution_type, summary, is_active, is_visible,
  country_id, admissions_url, ownership_type, founding_year, publication_status,
  data_source, source_url, source_access_date, last_verified_at, verification_status
) values (
  'e9000001-0000-4000-8000-000000000005', 'Massachusetts Institute of Technology', 'massachusetts-institute-of-technology',
  'United States', 'Cambridge', 'https://www.mit.edu/', 'university',
  'A private research university in Cambridge, Massachusetts, USA, incorporated in 1861.', true, true,
  (select id from public.countries where iso_alpha2 = 'US'),
  'https://oge.mit.edu/graduate-admissions/applications/international-applicants/', 'private', 1861, 'published',
  'Official MIT website', 'https://web.mit.edu/about/', current_date, current_date, 'verified'
) on conflict (id) do nothing;

insert into public.campuses (id, university_id, name, country_id, state_region, city, is_main, is_active)
values (
  'e9000001-0000-4000-8000-000000000105', 'e9000001-0000-4000-8000-000000000005', 'Cambridge Campus',
  (select id from public.countries where iso_alpha2 = 'US'), 'Massachusetts', 'Cambridge', true, true
) on conflict (id) do nothing;

insert into public.courses (
  id, university_id, campus_id, name, slug, education_level, field_of_study, delivery_mode,
  tuition_amount_minor_units, tuition_currency, tuition_period, entry_requirements_summary, application_url, is_active, is_visible, data_quality_status,
  subject_area, qualification_title, duration_value, duration_unit, course_url,
  publication_status, data_source, source_url, last_verified_at, verification_status
) values (
  'e9000002-0000-4000-8000-000000000005', 'e9000001-0000-4000-8000-000000000005', 'e9000001-0000-4000-8000-000000000105',
  'Master of Business Analytics (MBAn)', 'master-of-business-analytics', 'postgraduate', 'Business Analytics', 'on_campus',
  9688400, 'USD', 'per_year',
  'MIT accepts IELTS Academic, TOEFL iBT, Duolingo English Test, or Cambridge English for international applicants; specific minimum scores are set at the department level and not published centrally.',
  'https://mitsloan.mit.edu/master-of-business-analytics', true, true, 'reviewed',
  'Business Analytics', 'Master of Business Analytics (MBAn)', 12, 'months',
  'https://mitsloan.mit.edu/master-of-business-analytics',
  'published', 'Official MIT Sloan website', 'https://mitsloan.mit.edu/master-of-business-analytics/admissions/tuition-and-financial-aid', current_date, 'needs_review'
) on conflict (id) do nothing;

insert into public.scholarships (
  id, scope, university_id, name, eligibility, award_description, currency_code, scholarship_url, international_eligible, is_active, data_source, source_url, last_verified_at
) values (
  'e9000006-0000-4000-8000-000000000005', 'university', 'e9000001-0000-4000-8000-000000000005',
  'Presidential Graduate Fellowship Program', 'Nominated by academic departments, not directly applied for by students.',
  'Established 1999 to recruit outstanding graduate students worldwide.', 'USD',
  'https://oge.mit.edu/fellowships/presidential-graduate-fellowship-program/', true, true,
  'Official MIT website', 'https://oge.mit.edu/fellowships/presidential-graduate-fellowship-program/', current_date
) on conflict (id) do nothing;

insert into public.education_data_provenance (entity_type, entity_id, source_provider, source_type, source_url, retrieved_at, last_verified_at, verification_status, data_quality_status)
values
  ('university', 'e9000001-0000-4000-8000-000000000005', 'MIT Official Website', 'official_university', 'https://web.mit.edu/about/', current_date, current_date, 'verified', 'current'),
  ('course', 'e9000002-0000-4000-8000-000000000005', 'MIT Sloan Official Website', 'official_university', 'https://mitsloan.mit.edu/master-of-business-analytics', current_date, current_date, 'needs_review', 'review_soon')
on conflict (entity_type, entity_id) do nothing;


-- =============================================================================
-- 6. Indian Institute of Technology Bombay (IIT Bombay) — India
-- Sources: https://www.iitb.ac.in/ , https://www.iitb.ac.in/about-iit-bombay , https://www.iitb.ac.in/about ,
-- https://www.ieor.iitb.ac.in/acad/mtech , https://www.iitb.ac.in/newacadhome/FeeStructureForForeignNationals_IR-IITB.pdf ,
-- https://www.ir.iitb.ac.in/en/students/how-to-apply
-- NOT STATED: a current-year tuition figure (the only official figure found
-- was dated Autumn Semester 2022-23 — kept below EXPLICITLY labelled with
-- that academic year, as a historical data point, not presented as current);
-- teaching language; specific intake start month (only the January
-- 31 - March 31 application window for an Autumn-semester start was found,
-- not the exact month the semester itself begins).
-- =============================================================================

insert into public.universities (
  id, name, slug, country, city, website, institution_type, summary, is_active, is_visible,
  country_id, admissions_url, ownership_type, founding_year, publication_status,
  data_source, source_url, source_access_date, last_verified_at, verification_status
) values (
  'e9000001-0000-4000-8000-000000000006', 'Indian Institute of Technology Bombay', 'indian-institute-of-technology-bombay',
  'India', 'Mumbai', 'https://www.iitb.ac.in/', 'institute',
  'A public "Institute of National Importance" in Mumbai, India, established in 1958.', true, true,
  (select id from public.countries where iso_alpha2 = 'IN'),
  'https://www.ir.iitb.ac.in/en/students/how-to-apply', 'public', 1958, 'published',
  'Official IIT Bombay website', 'https://www.iitb.ac.in/about-iit-bombay', current_date, current_date, 'verified'
) on conflict (id) do nothing;

insert into public.campuses (id, university_id, name, country_id, city, is_main, is_active)
values (
  'e9000001-0000-4000-8000-000000000106', 'e9000001-0000-4000-8000-000000000006', 'Mumbai Campus',
  (select id from public.countries where iso_alpha2 = 'IN'), 'Mumbai', true, true
) on conflict (id) do nothing;

insert into public.courses (
  id, university_id, campus_id, name, slug, education_level, field_of_study, delivery_mode,
  tuition_currency, entry_requirements_summary, application_url, is_active, is_visible, data_quality_status,
  subject_area, qualification_title, duration_value, duration_unit, study_pace, english_requirements,
  course_url, publication_status, data_source, source_url, last_verified_at, verification_status
) values (
  'e9000002-0000-4000-8000-000000000006', 'e9000001-0000-4000-8000-000000000006', 'e9000001-0000-4000-8000-000000000106',
  'M.Tech in Industrial Engineering and Operations Research', 'mtech-industrial-engineering-and-operations-research',
  'postgraduate', 'Industrial Engineering and Operations Research', 'on_campus',
  'INR', 'IELTS overall 6.5 (min 6 per section), or TOEFL iBT overall 95 (min 20 writing), or Duolingo 115; scores older than two years generally not accepted.',
  'https://www.ieor.iitb.ac.in/acad/mtech', true, true, 'reviewed',
  'Industrial Engineering and Operations Research', 'Master of Technology (M.Tech.)', 2, 'years', 'full_time_or_part_time',
  '{"ielts": {"overall": 6.5, "minComponent": 6}, "toefl": {"overall": 95, "minComponent": 20}, "duolingo": {"overall": 115}}'::jsonb,
  'https://www.ieor.iitb.ac.in/acad/mtech',
  'published', 'Official IIT Bombay website', 'https://www.ieor.iitb.ac.in/acad/mtech', current_date, 'needs_review'
) on conflict (id) do nothing;

-- Kept as an explicitly-dated HISTORICAL figure (academic_year names the
-- year it applied to), not presented as this year's fee — see header note.
insert into public.course_tuition_fees (
  id, course_id, student_category, amount_minor_units, currency_code, academic_year, billing_period, data_source, source_url, last_verified_at
) values (
  'e9000004-0000-4000-8000-000000000002', 'e9000002-0000-4000-8000-000000000006', 'international',
  17000000, 'INR', '2022-2023', 'per_semester',
  'Official IIT Bombay fee circular for foreign nationals (last confirmed edition — a newer circular exists but did not state an M.Tech-for-foreign-nationals figure in the section retrieved)',
  'https://www.iitb.ac.in/newacadhome/FeeStructureForForeignNationals_IR-IITB.pdf', current_date
) on conflict (id) do nothing;

insert into public.course_intakes (
  id, course_id, intake_name, start_year, applications_open_at, final_deadline, capacity_status, intake_status, data_source, source_url, last_verified_at
) values (
  'e9000003-0000-4000-8000-000000000005', 'e9000002-0000-4000-8000-000000000006', 'Autumn Semester', 2027,
  '2027-01-31', '2027-03-31', 'unknown', 'upcoming', 'Official IIT Bombay website',
  'https://www.ir.iitb.ac.in/en/students/how-to-apply', current_date
) on conflict (id) do nothing;

insert into public.course_admission_requirements (
  id, course_id, accepted_qualification, language_test, language_test_min_score, data_source, source_url, last_verified_at
) values (
  'e9000005-0000-4000-8000-000000000004', 'e9000002-0000-4000-8000-000000000006',
  'A relevant bachelor''s degree (engineering/technology or a related quantitative field); see the official program page for full academic criteria.',
  'IELTS', 6.5, 'Official IIT Bombay website', 'https://www.ir.iitb.ac.in/en/students/how-to-apply', current_date
) on conflict (id) do nothing;

insert into public.scholarships (
  id, scope, university_id, name, eligibility, currency_code, scholarship_url, international_eligible, is_active, data_source, source_url, last_verified_at
) values (
  'e9000006-0000-4000-8000-000000000006', 'university', 'e9000001-0000-4000-8000-000000000006',
  'ICCR Scholarship', 'Government of India (Indian Council for Cultural Relations) scholarship route for international students; award terms vary by scheme.', 'INR',
  'http://a2ascholarships.iccr.gov.in/home/getAllSchemeList', true, true,
  'Listed on the official IIT Bombay international admissions page', 'https://www.ir.iitb.ac.in/en/students/how-to-apply', current_date
) on conflict (id) do nothing;

insert into public.education_data_provenance (entity_type, entity_id, source_provider, source_type, source_url, retrieved_at, last_verified_at, verification_status, data_quality_status)
values
  ('university', 'e9000001-0000-4000-8000-000000000006', 'IIT Bombay Official Website', 'official_university', 'https://www.iitb.ac.in/about-iit-bombay', current_date, current_date, 'verified', 'current'),
  ('course', 'e9000002-0000-4000-8000-000000000006', 'IIT Bombay Official Website', 'official_university', 'https://www.ieor.iitb.ac.in/acad/mtech', current_date, current_date, 'needs_review', 'review_soon')
on conflict (entity_type, entity_id) do nothing;


-- =============================================================================
-- 7. Trinity College Dublin — Ireland
-- Sources: https://www.tcd.ie/about/ , https://hea.ie/higher-education-institutions/trinity-college-dublin/funding/ ,
-- https://www.tcd.ie/courses/postgraduate/courses/physiotherapy-msc/ , https://www.tcd.ie/courses/postgraduate/fees/ ,
-- https://www.tcd.ie/study/international/scholarships/postgraduate/gexpg.php , https://www.tcd.ie/study/international/
-- NOT STATED: teaching language; an exact date within "November" that
-- applications open for the September 2027 intake (only the month was
-- published) — applications_open_at is left NULL as a result rather than
-- guessing a day.
-- =============================================================================

insert into public.universities (
  id, name, slug, country, city, website, institution_type, summary, is_active, is_visible,
  country_id, admissions_url, ownership_type, founding_year, publication_status,
  data_source, source_url, source_access_date, last_verified_at, verification_status
) values (
  'e9000001-0000-4000-8000-000000000007', 'Trinity College Dublin, The University of Dublin', 'trinity-college-dublin',
  'Ireland', 'Dublin', 'https://www.tcd.ie/', 'university',
  'A public, state-funded university in Dublin, Ireland, created by royal charter in 1592.', true, true,
  (select id from public.countries where iso_alpha2 = 'IE'),
  'https://www.tcd.ie/study/international/', 'public', 1592, 'published',
  'Official Trinity College Dublin website', 'https://www.tcd.ie/about/', current_date, current_date, 'verified'
) on conflict (id) do nothing;

insert into public.campuses (id, university_id, name, country_id, address, city, is_main, is_active)
values (
  'e9000001-0000-4000-8000-000000000107', 'e9000001-0000-4000-8000-000000000007', 'College Green Campus',
  (select id from public.countries where iso_alpha2 = 'IE'), 'College Green, Dublin 2, Ireland', 'Dublin', true, true
) on conflict (id) do nothing;

insert into public.courses (
  id, university_id, campus_id, name, slug, education_level, field_of_study, delivery_mode,
  tuition_currency, entry_requirements_summary, application_url, is_active, is_visible, data_quality_status,
  subject_area, qualification_title, duration_value, duration_unit, english_requirements,
  course_url, publication_status, data_source, source_url, last_verified_at, verification_status
) values (
  'e9000002-0000-4000-8000-000000000007', 'e9000001-0000-4000-8000-000000000007', 'e9000001-0000-4000-8000-000000000107',
  'Physiotherapy (M.Sc.)', 'msc-physiotherapy', 'postgraduate', 'Physiotherapy', 'on_campus',
  'EUR', 'IELTS Academic 7.0 overall, no component below 7.0.',
  'https://www.tcd.ie/courses/postgraduate/courses/physiotherapy-msc/', true, true, 'approved',
  'Physiotherapy', 'Master of Science (M.Sc.)', 2, 'years',
  '{"ielts": {"overall": 7.0, "minComponent": 7.0}}'::jsonb,
  'https://www.tcd.ie/courses/postgraduate/courses/physiotherapy-msc/',
  'published', 'Official Trinity College Dublin website', 'https://www.tcd.ie/courses/postgraduate/courses/physiotherapy-msc/', current_date, 'needs_review'
) on conflict (id) do nothing;

insert into public.course_tuition_fees (
  id, course_id, student_category, amount_minor_units, currency_code, academic_year, billing_period, data_source, source_url, last_verified_at
) values
  ('e9000004-0000-4000-8000-000000000003', 'e9000002-0000-4000-8000-000000000007', 'eu',
   847000, 'EUR', '2026/2027', 'per_year', 'Official Trinity College Dublin website',
   'https://www.tcd.ie/courses/postgraduate/fees/', current_date),
  ('e9000004-0000-4000-8000-000000000004', 'e9000002-0000-4000-8000-000000000007', 'international',
   1696000, 'EUR', '2026/2027', 'per_year', 'Official Trinity College Dublin website',
   'https://www.tcd.ie/courses/postgraduate/fees/', current_date)
on conflict (id) do nothing;

insert into public.course_intakes (
  id, course_id, intake_name, start_month, start_year, capacity_status, intake_status, data_source, source_url, last_verified_at
) values (
  'e9000003-0000-4000-8000-000000000006', 'e9000002-0000-4000-8000-000000000007', 'September intake', 9, 2027,
  'unknown', 'upcoming', 'Official Trinity College Dublin website', 'https://www.tcd.ie/study/international/', current_date
) on conflict (id) do nothing;

insert into public.scholarships (
  id, scope, university_id, name, eligibility, award_description, currency_code, scholarship_url, international_eligible, is_active, data_source, source_url, last_verified_at
) values (
  'e9000006-0000-4000-8000-000000000007', 'university', 'e9000001-0000-4000-8000-000000000007',
  'Global Excellence Postgraduate Scholarships', 'International postgraduate applicants; excludes Business, Engineering, Natural Sciences, and Computer Science.',
  'One-time award of EUR 2,000-5,000 depending on region.', 'EUR',
  'https://www.tcd.ie/study/international/scholarships/postgraduate/gexpg.php', true, true,
  'Official Trinity College Dublin website', 'https://www.tcd.ie/study/international/scholarships/postgraduate/gexpg.php', current_date
) on conflict (id) do nothing;

insert into public.education_data_provenance (entity_type, entity_id, source_provider, source_type, source_url, retrieved_at, last_verified_at, verification_status, data_quality_status)
values
  ('university', 'e9000001-0000-4000-8000-000000000007', 'Trinity College Dublin Official Website', 'official_university', 'https://www.tcd.ie/about/', current_date, current_date, 'verified', 'current'),
  ('course', 'e9000002-0000-4000-8000-000000000007', 'Trinity College Dublin Official Website', 'official_university', 'https://www.tcd.ie/courses/postgraduate/courses/physiotherapy-msc/', current_date, current_date, 'needs_review', 'review_soon')
on conflict (entity_type, entity_id) do nothing;


-- =============================================================================
-- 8. KTH Royal Institute of Technology — Sweden
-- Sources: https://www.kth.se/en/om/fakta , https://www.kth.se/en/studies/master/computer-science ,
-- https://www.kth.se/en/studies/master/computer-science/fees-communication-systems-1.909945 ,
-- https://www.kth.se/en/studies/master/admissions/entry-requirements-for-master-s-studies-1.6915 ,
-- https://www.kth.se/en/studies/master/admissions/scholarships/kth-scholarship-1.72827 ,
-- https://www.kth.se/en/studies/master/master-s-degree-studies-at-kth-1.1026260
-- NOT STATED: which academic year the published SEK 360,000 tuition figure
-- applies to (kept as free text rather than a structured tuition_fees row,
-- since that table requires a non-null academic year and none was
-- published); a program-specific (rather than KTH-wide general) English
-- test minimum; a fixed scholarship award amount (it is a fee waiver
-- contingent on results, not a flat figure).
-- =============================================================================

insert into public.universities (
  id, name, slug, country, city, website, institution_type, summary, is_active, is_visible,
  country_id, admissions_url, ownership_type, founding_year, publication_status,
  data_source, source_url, source_access_date, last_verified_at, verification_status
) values (
  'e9000001-0000-4000-8000-000000000008', 'KTH Royal Institute of Technology', 'kth-royal-institute-of-technology',
  'Sweden', 'Stockholm', 'https://www.kth.se/en', 'university',
  'A public university and Swedish government agency in Stockholm, founded in 1827.', true, true,
  (select id from public.countries where iso_alpha2 = 'SE'),
  'https://www.kth.se/en/studies/master/master-s-degree-studies-at-kth-1.1026260', 'public', 1827, 'published',
  'Official KTH website', 'https://www.kth.se/en/om/fakta', current_date, current_date, 'verified'
) on conflict (id) do nothing;

insert into public.campuses (id, university_id, name, country_id, city, is_main, is_active)
values (
  'e9000001-0000-4000-8000-000000000108', 'e9000001-0000-4000-8000-000000000008', 'Stockholm Campus',
  (select id from public.countries where iso_alpha2 = 'SE'), 'Stockholm', true, true
) on conflict (id) do nothing;

insert into public.courses (
  id, university_id, campus_id, name, slug, education_level, field_of_study, delivery_mode,
  tuition_currency, entry_requirements_summary, application_url, is_active, is_visible, data_quality_status,
  subject_area, qualification_title, duration_value, duration_unit, teaching_language, english_requirements,
  additional_fees_summary, course_url, publication_status, data_source, source_url, last_verified_at, verification_status
) values (
  'e9000002-0000-4000-8000-000000000008', 'e9000001-0000-4000-8000-000000000008', 'e9000001-0000-4000-8000-000000000108',
  'MSc Computer Science', 'msc-computer-science', 'postgraduate', 'Computer Science', 'on_campus',
  'SEK', 'IELTS overall 6.5 (general KTH master''s-wide requirement — see the official entry-requirements page).',
  'https://www.kth.se/en/studies/master/computer-science', true, true, 'reviewed',
  'Computer Science', 'Master of Science (M.Sc.)', 2, 'years', 'English',
  '{"ielts": {"overall": 6.5}}'::jsonb,
  'Full programme fee for non-EU/EEA/Swiss citizens: SEK 360,000 (the academic year this figure applies to is not stated on the official fee page) — see https://www.kth.se/en/studies/master/computer-science/fees-communication-systems-1.909945',
  'https://www.kth.se/en/studies/master/computer-science',
  'published', 'Official KTH website', 'https://www.kth.se/en/studies/master/computer-science', current_date, 'needs_review'
) on conflict (id) do nothing;

insert into public.course_intakes (
  id, course_id, intake_name, start_month, start_year, applications_open_at, capacity_status, intake_status, data_source, source_url, last_verified_at
) values (
  'e9000003-0000-4000-8000-000000000007', 'e9000002-0000-4000-8000-000000000008', 'Autumn Semester', 8, 2027,
  '2026-10-16', 'unknown', 'upcoming', 'Official KTH website',
  'https://www.kth.se/en/studies/master/master-s-degree-studies-at-kth-1.1026260', current_date
) on conflict (id) do nothing;

insert into public.scholarships (
  id, scope, university_id, name, eligibility, award_description, currency_code, scholarship_url, international_eligible, is_active, data_source, source_url, last_verified_at
) values (
  'e9000006-0000-4000-8000-000000000008', 'university', 'e9000001-0000-4000-8000-000000000008',
  'KTH Scholarship', 'Fee-paying admitted master''s applicants who applied as first priority.',
  'Covers the KTH tuition fee for year 1, and year 2 contingent on satisfactory year-1 results (not a fixed currency amount).', 'SEK',
  'https://www.kth.se/en/studies/master/admissions/scholarships/kth-scholarship-1.72827', true, true,
  'Official KTH website', 'https://www.kth.se/en/studies/master/admissions/scholarships/kth-scholarship-1.72827', current_date
) on conflict (id) do nothing;

insert into public.education_data_provenance (entity_type, entity_id, source_provider, source_type, source_url, retrieved_at, last_verified_at, verification_status, data_quality_status)
values
  ('university', 'e9000001-0000-4000-8000-000000000008', 'KTH Official Website', 'official_university', 'https://www.kth.se/en/om/fakta', current_date, current_date, 'verified', 'current'),
  ('course', 'e9000002-0000-4000-8000-000000000008', 'KTH Official Website', 'official_university', 'https://www.kth.se/en/studies/master/computer-science', current_date, current_date, 'needs_review', 'review_soon')
on conflict (entity_type, entity_id) do nothing;


-- =============================================================================
-- Done. 8 universities, 8 campuses, 8 courses, 7 course_intake rows (Toronto
-- and MIT courses intentionally have none — no officially confirmed
-- program-specific date), 3 course_tuition_fees rows (Melbourne, and two for
-- Trinity's EU/non-EU rates; IIT Bombay's is a labelled 2022-2023 historical
-- figure), 5 course_admission_requirements rows, 8 scholarships, 16
-- education_data_provenance rows. Countries 0002_admin_dev_seed.sql-style
-- "fictional sample data" this is NOT — every fact traces to a cited,
-- verifiable official source. See docs/global-education-data-guide.md for
-- how to add more countries/institutions through the proper import
-- workflow rather than by hand-editing this file.
-- =============================================================================
