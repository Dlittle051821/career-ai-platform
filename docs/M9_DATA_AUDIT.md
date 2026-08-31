# M9 Data Audit

Milestone 9 — Audit + Outcome Instrumentation. This is a factual inventory of what data this application already collects, where it lives, and whether it is useful for analytics/outcome tracking — the input to `M9_EVENT_TAXONOMY.md` and `OUT-001_OUTCOME_DATA_FOUNDATION.md`. Every table/field named below was verified against the actual migrations in `supabase/migrations/0001`–`0009` and the application code that reads/writes it; nothing here is a guess. No secrets, no real user data, and no actual sensitive values appear below — only field names and shapes.

Columns: **Entity/model** · **Field(s)** · **Stored in** · **Used by** · **Useful for analytics?** · **Privacy sensitivity** · **Gaps** · **Recommended action**.

## Auth / account

| Entity | Field(s) | Stored in | Used by | Analytics? | Sensitivity | Gaps | Action |
|---|---|---|---|---|---|---|---|
| Account | id, email, phone, full_name, marketing_consent, account_type, created_at | `auth.users` + `public.profiles` (`0001_profiles.sql`) | Register/login, `/profile`, admin `/admin/students` | Yes — registration count, account age | High (email/phone/name are PII) | No `user_registered`/`user_logged_in` event existed before M9 | **Done in M9**: `user_registered` fired from `RegisterForm.tsx`. `user_logged_in` reserved (P0 scope did not include it). |

## Student profile

| Entity | Field(s) | Stored in | Used by | Analytics? | Sensitivity | Gaps | Action |
|---|---|---|---|---|---|---|---|
| Profile completion | `profile_status`, `profile_completion_percent`, `onboarding_current_step` | `public.student_profiles` (`0002_student_profile.sql`) | `/profile`, `/profile/onboarding`, dashboard | Yes — the real activation-funnel signal | Medium (implies engagement level, not itself identifying) | No event fired on the `not_started`→`in_progress`→`completed` transition | **Done in M9**: `profile_completed` fires once, on the transition into `completed`, from `recomputeCompletion()`. Reuse `profile_status` directly rather than re-deriving it from events — never duplicated. |
| Profile detail sections | `student_interests`, `student_skills`, `student_career_priorities`, `student_subject_strengths`, `student_work_preferences`, `student_funding_preferences`, `student_career_goals`, `student_education`, `student_experience` | same migration | Recommendation engine | Yes, as *inputs* to recommendations, not as events | High (career goals, funding band, education history are personal) | — | Never surfaced as `properties` on any event — only aggregate counts (e.g. `careersConsidered`) are logged. |

## Assessment / quiz

| Entity | Field(s) | Stored in | Used by | Analytics? | Sensitivity | Gaps | Action |
|---|---|---|---|---|---|---|---|
| — | — | — | `/career-discovery` (static marketing preview page only) | N/A | N/A | **No assessment/quiz feature exists.** `/career-discovery`'s own on-page copy states it "does not run a live assessment yet" and computes/stores nothing. | Do **not** fire `assessment_started`/`assessment_answered`/`assessment_completed`/`assessment_result_viewed` against a fake trigger. Names are reserved in the registry for a future real implementation. Treat `/recommendations` (below) as the real, working equivalent wherever "Assessment Completed" is referenced elsewhere. |

## Career discovery

| Entity | Field(s) | Stored in | Used by | Analytics? | Sensitivity | Gaps | Action |
|---|---|---|---|---|---|---|---|
| Career catalogue | `careers`, `career_subjects`, `career_interests`, `career_skills`, `career_industries`, etc. | `public.careers*` (`0003_career_database.sql`) | `/careers`, `/careers/[slug]`, recommendation engine | Yes — view counts by career | Low (public catalogue data) | No `career_viewed` event | **Done in M9**: fired from `/careers/[slug]`. |
| Recommendation run | computed in-memory by `src/lib/recommendations` from the profile snapshot + career catalogue; nothing persisted | not stored — computed fresh every page load | `/recommendations` | Yes — recommendation runs and result counts | Medium (reveals profile-derived matching, no raw profile data in the event) | No event marking a recommendation run | **Done in M9**: `career_recommendations_generated` fires from `/recommendations` with `careersConsidered`/`resultsCount` only — no career IDs or scores in `properties`. |
| Career comparison | ad hoc, computed by `src/lib/careers/compare` from 2–3 careers picked via `?a=&b=&c=` | not stored | `/compare` | Yes | Low | No `career_compared` event | **Done in M9**: fires from `/compare` once 2–3 careers resolve and the table renders. |

## Course discovery

| Entity | Field(s) | Stored in | Used by | Analytics? | Sensitivity | Gaps | Action |
|---|---|---|---|---|---|---|---|
| Course catalogue | `courses`, `course_intakes`, `course_tuition_fees`, `course_admission_requirements`, `scholarships`, etc. | `public.courses*` (`0006_global_university_course_data.sql`) | `/courses`, `/courses/[universitySlug]/[courseSlug]`, `/courses/compare` | Yes | Low (public catalogue data) | No `course_viewed`/`course_compared` events | **Done in M9**: both fired. |
| Application intent | `applications.stage='inquiry'` created from a course page | `public.applications` (`0004_admin_system.sql`), reused by M9's self-service INSERT policy from `0006` PART 16 | `/courses/[universitySlug]/[courseSlug]`'s "Start application" button, `/applications` | Yes — the real activation-to-application funnel step | Medium (implies application intent, tied to a specific student/course pair) | No `application_started` event | **Done in M9**: fires from `startApplicationFromCourse()` on a genuinely new insert only (not the "already applied, reuse existing row" branch). |

## College / university

| Entity | Field(s) | Stored in | Used by | Analytics? | Sensitivity | Gaps | Action |
|---|---|---|---|---|---|---|---|
| University catalogue | `universities`, `university_campuses`, university-level scholarships | `public.universities*` (`0006_global_university_course_data.sql`) | `/universities`, `/universities/[slug]` | Yes | Low | No `college_viewed` event | **Done in M9**: fired from `/universities/[slug]`. |
| University comparison | — | — | — | N/A | N/A | **No university-vs-university comparison feature exists.** This codebase only has career comparison (`/compare`) and course comparison (`/courses/compare`). | `college_compared` reserved; `career_compared`/`course_compared` are the real, implemented equivalents. |
| Saved items | `education_saved_items(entity_type in ('university','course'), entity_id)` | `0006_global_university_course_data.sql` PART 13 | `/saved`, save buttons on course/university detail pages | Yes | Low | No `course_saved`/`college_saved` events; **no `career_saved`** — `entity_type` CHECK does not include `'career'`, so there is no saved-career feature to instrument at all | **Done in M9**: `course_saved`/`college_saved` fire from `saveItem()` on a genuinely new save. `career_saved` reserved — no underlying feature. |

## Lead / conversion

| Entity | Field(s) | Stored in | Used by | Analytics? | Sensitivity | Gaps | Action |
|---|---|---|---|---|---|---|---|
| Lead record | `full_name`, `email`, `phone`, `source`, `campaign`, `stage`, `priority`, `assigned_counsellor_id`, `utm_source`/`utm_medium`/`utm_campaign`, `landing_page`, `converted_student_user_id` | `public.leads` + `lead_status_history` (`0004_admin_system.sql`) | `/admin/leads` (admin/counsellor CRM only) | Yes — lead creation volume, source mix | High (name/email/phone) — never put these fields in `product_events.properties` | No `lead_created` event. **No public self-service lead-capture path exists at all** — RLS on `leads` grants INSERT only to `super_admin`/`admin`/(scoped)`counsellor`; there is no anonymous/authenticated-student write path. `/book-counselling`'s `BookingForm.tsx` is an explicit Milestone-1 demo whose own on-screen copy says submitted data "was not transmitted, booked, or stored anywhere." | **Done in M9**: `lead_created` fires from `createLead()` (admin/counsellor-recorded), carrying only `priority`/`hasSource`/UTM fields — never name/email/phone. `counselling_requested` reserved — no real submission path to instrument. |
| Conversion log | `event_name`, `source`/`medium`/`campaign`, `landing_page` | `public.conversion_events` (`0004_admin_system.sql` PART 10) | Admin-recorded funnel transitions | Yes, already | Low (no PII stored) | This table already exists and does the same *kind* of job as `product_events` for admin-only transitions — kept separate on purpose (see `M9_IMPLEMENTATION.md`) | No change — `product_events` is additive, not a replacement. |

## Commercial

| Entity | Field(s) | Stored in | Used by | Analytics? | Sensitivity | Gaps | Action |
|---|---|---|---|---|---|---|---|
| Pricing funnel | `event_type in ('plan_view','plan_selected','checkout_started')`, `plan_id`, `offer_id`, `session_ref` | `public.pricing_analytics_events` (`0007_nextwise_pricing_offers.sql` PART 5) | `/pricing`, `/pricing/checkout/[slug]` | Yes, already | Low (no amounts, no payment data) | **Already fully instrumented** — `plan_view`/`plan_selected` are this codebase's real equivalent of `package_viewed`/`package_selected` | Deliberately **not** duplicated into `product_events` — see `M9_IMPLEMENTATION.md` for the decision. |
| Checkout / payments | `invoices`, `payment_attempts`, `payment_transactions` | `public.invoices*` (`0005_payments_billing.sql`) | `/payments`, `/payments/[invoiceId]` | Yes — the authoritative money ledger | Very high (financial) — never mirror amounts into `product_events.properties` | No `payment_started`/`payment_completed` event | **Done in M9**: both fire from `src/app/(site)/payments/actions.ts`, carrying only `currency`/`status` — never an amount. The ledger (`invoices.status='paid'`) stays the one source of truth for revenue. |
| Pricing plans/purchases | `pricing_plans`, `pricing_plan_versions`, `pricing_purchases` | `0007`/`0008` | `/pricing`, admin pricing | Yes, already (via `pricing_analytics_events` + the ledger) | High (purchase history) | — | No change. |

## Admission delivery / outcome

| Entity | Field(s) | Stored in | Used by | Analytics? | Sensitivity | Gaps | Action |
|---|---|---|---|---|---|---|---|
| Application lifecycle | `stage`, `decision_status`, `offer_type`, `submission_date` + full `application_status_history` | `public.applications` + `application_status_history` (`0004_admin_system.sql`) | `/admin/applications`, `/applications`, course "Start application" | Yes — this is the authoritative outcome signal | High (admissions outcome tied to a specific student) | No single, current-state "where is this student in their journey" summary existed before M9 | **Done in M9**: `public.student_outcomes` (new table) is kept in sync automatically from this table by a trigger — see `OUT-001_OUTCOME_DATA_FOUNDATION.md`. Nothing here is duplicated; `student_outcomes.final_application_id` references this table instead. |
| Lead conversion | `leads.converted_student_user_id`, `lead_status_history` | `0004_admin_system.sql` | `/admin/leads` | Yes | High | — | Referenced, not duplicated, by the outcome model's funnel-reconstruction queries. |

## Counselling / case management

| Entity | Field(s) | Stored in | Used by | Analytics? | Sensitivity | Gaps | Action |
|---|---|---|---|---|---|---|---|
| Counsellor directory + assignment | `counsellors`, `admin_student_meta.assigned_counsellor_id` | `0004_admin_system.sql` | `/admin/counsellors`, `/admin/students` | Operational, not event-worthy | Medium | — | No new event — counsellor workload is already computed live by `listCounsellorWorkload()`. |
| Student notes | `admin_student_notes.note` (free text) | `0004_admin_system.sql` | `/admin/students/[id]` | **No** | Very high (private counselling notes — explicitly out of scope for `product_events.properties`, per the milestone's own privacy rule) | — | Never referenced by any event's `properties`. |

## Admin

| Entity | Field(s) | Stored in | Used by | Analytics? | Sensitivity | Gaps | Action |
|---|---|---|---|---|---|---|---|
| Admin roles | `admin_roles.role`, `is_admin_role()` | `0004_admin_system.sql` | Every admin RLS policy | N/A (authorization, not analytics) | High | — | `product_events`/`student_outcomes` SELECT policies reuse `is_admin_role(array['super_admin','admin','analyst'])` exactly, per existing convention. |
| Audit log | `admin_audit_log` | `0004_admin_system.sql` | `/admin/audit-log` | Different purpose (who-changed-what, not product usage) | High | — | Kept separate from `product_events` — see `M9_IMPLEMENTATION.md`. |
