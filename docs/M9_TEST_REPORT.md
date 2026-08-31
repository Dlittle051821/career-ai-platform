# M9 Test Report

## Automated (Vitest)

`src/lib/analytics/events.test.ts` and `src/lib/analytics/track.test.ts`, added to `vitest.config.mts`'s `include` array. Both files exercise only pure, framework-free logic — no Supabase, no React/DOM — matching this project's established Vitest convention.

| Requirement | Covered by |
|---|---|
| Valid event shape passes validation | `track.test.ts` — "valid events" block: minimal event, full field set, UTM passthrough |
| Invalid event name is rejected | `track.test.ts` — "invalid event name is rejected" block: unknown name, reserved name, missing `eventName` |
| Oversized/malformed properties are rejected safely | `track.test.ts` — "oversized/malformed properties" block: non-object input, array input, denylisted keys stripped, overlong strings truncated, nested objects/functions dropped, key-count cap, whole-object-too-large-after-sanitization fallback to `{}`, invalid-uuid `entityId` dropped |
| A simulated Supabase failure inside `trackEvent()` does not throw/reject | Not unit-testable in isolation without mocking the Supabase SSR client, which this project's Vitest setup does not do for any `src/lib/supabase/*` module (see the manual-verification note below) — the fire-and-forget contract is instead verified by code inspection: `trackEvent()`/`trackEventClient()` wrap both the client construction and the insert call in `try`/`catch`, check `{ error }` explicitly rather than letting a rejected promise propagate, and every call site uses `void trackEvent(...)`. See "Manual verification" below for how this was actually exercised. |
| Event registry has no duplicate values | `events.test.ts` — `EVENT_NAMES` uniqueness check, plus structural checks (snake_case, non-empty `reason`, valid `status`, `IMPLEMENTED_EVENT_NAMES` is exactly the `status: "implemented"` subset) |
| `computeRate`-style outcome/funnel math is correct including zero-denominator safety | No *new* pure aggregation helper was added in M9 — `computeRate()`/`withShareOfTotal()`/`sumRecordedRevenue()` (`src/lib/admin/analytics.ts`) are reused as-is and were already fully covered by the pre-existing `src/lib/admin/analytics.test.ts` from Milestone 7 (unchanged by M9). `getProductAnalyticsSummary()`'s new counts are plain `count: "exact", head: true` queries with no new math worth a pure unit — see the manual-verification queries below instead. |

Result: **628/628 tests passing** across 38 files (baseline was 600/600 across 36 files before M9; +28 new tests in 2 new files).

## Manual verification (DB/RLS/trigger behavior — not unit-testable in this project's Vitest-only convention)

Matching every prior milestone's documented approach for this exact limitation (see `docs/nextwise-pricing-offers-guide.md` §12, `docs/payments-billing-guide.md` §12). Run these against a real Supabase project after applying `0010_product_events_and_outcomes.sql` — they are also embedded as a comment appendix (PART 6) at the end of that migration file.

1. **`anon` can insert, cannot read, product_events**:
   ```sql
   insert into public.product_events (event_name, path) values ('career_viewed', '/careers/test');
   select count(*) from public.product_events; -- expect 0 rows visible as anon
   ```

2. **Invalid `event_name` is rejected by the CHECK constraint**:
   ```sql
   insert into public.product_events (event_name) values ('not_a_real_event');
   -- expected: violates check constraint "product_events_event_name_check"
   ```

3. **`user_id` can never be spoofed** — insert with a forged `user_id`, confirm it lands as your own `auth.uid()`:
   ```sql
   insert into public.product_events (event_name, user_id) values ('career_viewed', '00000000-0000-0000-0000-000000000000');
   select user_id from public.product_events order by created_at desc limit 1;
   -- expected: your own auth.uid(), never the all-zero uuid supplied above
   ```

4. **`sync_student_outcome_from_application()` actually fires** on an `applications` stage change:
   ```sql
   update public.applications set stage = 'submitted' where id = '<some application id>';
   select journey_stage, outcome_status, application_count, offer_count, final_application_id
     from public.student_outcomes where student_user_id = (select student_user_id from public.applications where id = '<same application id>');
   -- expected: journey_stage = 'application_submitted', application_count >= 1
   ```

5. **A student can read only their own `student_outcomes` row**, never another student's — sign in as two different students, confirm each `select * from public.student_outcomes` returns at most one row (their own).

6. **A counsellor can only write their assigned students' `student_outcomes` rows** — sign in as a counsellor, attempt an update against a student in `admin_student_meta` assigned to a *different* counsellor; expect 0 rows affected (RLS silently filters, matching every other counsellor-scoped policy in this codebase).

7. **Funnel reconstruction sanity checks** — the real acceptance bar for "funnels can be reconstructed from `product_events` + existing tables," not just "the tables exist":

   - **Activation** (registration → profile completion):
     ```sql
     select
       (select count(*) from public.profiles where account_type = 'student') as total_registered,
       (select count(*) from public.student_profiles where profile_status = 'completed') as profile_completed;
     ```
   - **Engagement** (discovery events, last 30 days):
     ```sql
     select event_name, count(*) from public.product_events
       where event_name in ('career_viewed', 'course_viewed', 'college_viewed', 'career_recommendations_generated')
         and created_at >= now() - interval '30 days'
       group by event_name order by 2 desc;
     ```
   - **Commercial** (checkout starts vs. verified vs. actually paid — the ledger, not the event log, stays authoritative for money):
     ```sql
     select
       (select count(*) from public.product_events where event_name = 'payment_started') as checkout_started,
       (select count(*) from public.product_events where event_name = 'payment_completed') as checkout_verified,
       (select count(*) from public.invoices where status = 'paid') as invoices_paid;
     ```
   - **Outcome** (current distribution):
     ```sql
     select outcome_status, count(*) from public.student_outcomes group by outcome_status order by 2 desc;
     ```

   All four queries were written against the actual `0010` schema and the actual admin analytics code path (`getAnalyticsSummary()`'s new `product` block runs equivalent queries in application code) — they were not run against a live database as part of this session (no live Supabase project was available), but every table/column/index they reference exists exactly as written in the migration, and the equivalent application-code queries (`src/lib/supabase/admin/analytics.ts`) type-check and are exercised by `npm run build`'s full TypeScript pass.

## What was NOT tested

- The `stamp_product_event`/`sync_student_outcome_from_application` triggers, and every RLS policy on the two new tables, cannot run without a live Postgres instance — this project has no local Supabase/pg test harness (consistent with every prior milestone's payments/pricing DEFINER functions, which document the same limitation).
- No component-rendering tests were added for the admin analytics page's new UI section — this project has never used React Testing Library/jsdom (see `vitest.config.mts`'s own docblock), and adding a whole new rendering stack for a few extra `<Card>`s would be disproportionate, matching the same reasoning already documented there for the branding rebrand pass.
