# M9 Event Taxonomy

The full event vocabulary for `public.product_events`, and the single TypeScript source of truth for it: `src/lib/analytics/events.ts` (`PRODUCT_EVENTS`). Nothing in this codebase hand-types a raw event-name string — every call site imports a name that TypeScript checks against this registry. The database's `product_events_event_name_check` CHECK constraint (`supabase/migrations/0010_product_events_and_outcomes.sql` PART 1) lists the exact same 27 names; if this file's registry ever changes, that CHECK constraint must change with it in a new, additive migration.

**Status legend** — `implemented` means a real, already-working code path in this application calls `trackEvent()`/`trackEventClient()` with that name today. `reserved` means the name exists so a future milestone (or a later pass of this one) can start firing it without a schema change — it is never inserted by any code path in this repository.

## Standard event schema

Every row in `product_events` has this shape (see the migration's table comment for the exact SQL and `M9_IMPLEMENTATION.md` for how `trackEvent()` builds it):

| Field | Type | Set by |
|---|---|---|
| `event_id` (`id`) | uuid | database default |
| `event_name` | text, CHECK-constrained | caller (validated against the registry) |
| `user_id` | uuid, nullable | **always server-stamped** from `auth.uid()` by the `stamp_product_event` trigger — never trusted from the client |
| `session_id` | text, nullable, ≤128 chars | caller, optional |
| `anonymous_id` | text, nullable, ≤128 chars | caller, optional — see "Anonymous events" below |
| `occurred_at` | timestamptz | **always server-stamped** to `now()` by the trigger |
| `source` | text, nullable | caller — which UI surface fired the event, e.g. `"career_detail_page"` |
| `path`/`feature` | text, nullable | caller — the route and product area |
| `entity_type`/`entity_id` | text / uuid, nullable | caller — what the event is about (a career, course, university, lead, application, invoice, profile) |
| `properties` | jsonb, sanitized | caller, validated/stripped by `buildEventInsert()` before it ever reaches Supabase |
| `utm_source`/`utm_medium`/`utm_campaign`/`utm_content`/`utm_term` | text, nullable | caller, mirroring `leads`' own UTM column convention |
| `created_at` | timestamptz | database default |

## Auth / account

| Event | Status | Fired from | Notes |
|---|---|---|---|
| `user_registered` | **implemented** | `RegisterForm.tsx`, on a successful `supabase.auth.signUp()` | `entityType: "profile"`, `entityId`: the new user's id. Fired for both the "session created immediately" and "check your email" branches — the account exists in `auth.users` either way. |
| `user_logged_in` | reserved | — | `LoginForm.tsx` works and could fire this trivially, but it is deliberately out of this milestone's P0 instrumentation scope. |

## Student profile

| Event | Status | Fired from | Notes |
|---|---|---|---|
| `profile_started` | reserved | — | Not in P0 scope; `profile_completed` (the transition that matters for the activation funnel) is implemented. |
| `profile_completed` | **implemented** | `recomputeCompletion()` in `src/lib/supabase/student-profile-actions.ts` | Fires exactly once, on the transition `profile_status` → `'completed'` — the previous status is read before the upsert specifically to avoid re-firing on every subsequent section edit. `properties: { completionPercent }` only. |

## Assessment / quiz — reserved, no feature exists

| Event | Status | Notes |
|---|---|---|
| `assessment_started` | reserved | No assessment/quiz UI exists. |
| `assessment_answered` | reserved | No assessment/quiz UI exists. |
| `assessment_completed` | reserved | See `career_recommendations_generated` below for the real, working equivalent. |
| `assessment_result_viewed` | reserved | No assessment/quiz UI exists. |

`/career-discovery` is an explicit, clearly-labelled marketing preview page ("This page previews how future career discovery will work. It does not run a live assessment yet.") — it computes and stores nothing, so there is no real trigger to hook these into. Wherever a funnel definition elsewhere references "Assessment Completed," the honest, working equivalent in this codebase is recommendation generation directly from the Student Digital Profile (`career_recommendations_generated`).

## Career discovery

| Event | Status | Fired from | Notes |
|---|---|---|---|
| `career_recommendations_generated` | **implemented** | `/recommendations` (`src/app/(site)/recommendations/page.tsx`), after `getRecommendations()` computes results | `properties: { careersConsidered, resultsCount }` — never career IDs or scores. |
| `career_viewed` | **implemented** | `/careers/[slug]` | `entityType: "career"`, `entityId`: career id. |
| `career_compared` | **implemented** | `/compare`, once 2–3 careers resolve and the table renders | `properties: { careerIds, count }`. |
| `career_saved` | reserved | — | `education_saved_items.entity_type` only supports `'university'`/`'course'` — there is no saved-career feature to instrument. |

## Course discovery

| Event | Status | Fired from | Notes |
|---|---|---|---|
| `course_viewed` | **implemented** | `/courses/[universitySlug]/[courseSlug]` | `entityType: "course"`. |
| `course_compared` | **implemented** | `/courses/compare`, once 2+ courses resolve | `properties: { courseIds, count }`. |
| `course_saved` | **implemented** | `saveItem("course", ...)` in `src/lib/supabase/education/saved-items.ts` | Fires only on a genuinely new insert — a repeat/idempotent save (caught as a swallowed unique-violation) never fires it twice. |
| `application_started` | **implemented** | `startApplicationFromCourse()` in `src/lib/supabase/education/applications.ts` | Fires only on the "new application row inserted" branch, never the "already applied, reuse existing row" branch. `entityType: "application"`, `entityId`: the new application's id. |

## College / university discovery

| Event | Status | Fired from | Notes |
|---|---|---|---|
| `college_viewed` | **implemented** | `/universities/[slug]` | `entityType: "university"`. |
| `college_compared` | reserved | — | No university-vs-university comparison feature exists in this codebase — only career comparison (`/compare`) and course comparison (`/courses/compare`), which fire `career_compared`/`course_compared` instead. |
| `college_saved` | **implemented** | `saveItem("university", ...)` | Same new-insert-only rule as `course_saved`. |

## Lead / conversion

| Event | Status | Fired from | Notes |
|---|---|---|---|
| `lead_created` | **implemented** | `createLead()` in `src/lib/supabase/admin/leads.ts` | Admin/counsellor-recorded — there is no public self-service lead-capture path in this codebase (see below). `properties: { priority, hasSource }` plus UTM fields — never name/email/phone. |
| `counselling_requested` | reserved | — | The public `/book-counselling` form (`BookingForm.tsx`) is an explicit Milestone-1 demo whose own on-screen copy states submitted data "was not transmitted, booked, or stored anywhere." There is no real code path to instrument until that form is wired to something real. |

## Commercial

| Event | Status | Fired from | Notes |
|---|---|---|---|
| `package_viewed` | reserved | — | Already fully covered by `pricing_analytics_events`' `plan_view` event (fired from `/pricing`) — deliberately **not** duplicated into a second `product_events` row for the same page view. See `M9_IMPLEMENTATION.md`. |
| `package_selected` | reserved | — | Already fully covered by `pricing_analytics_events`' `plan_selected` event (fired from `/pricing/checkout/[slug]`) — same reasoning. |
| `payment_started` | **implemented** | `createCheckoutSessionAction()` in `src/app/(site)/payments/actions.ts` | `entityType: "invoice"`, `properties: { currency }` — never an amount. |
| `payment_completed` | **implemented** | `verifyCheckoutAction()`, same file | Means "the browser's checkout signature was independently re-verified server-side" — checkout completion from the student's perspective. Final settlement is confirmed asynchronously by the Razorpay webhook (`apply_webhook_event`), which has no user-facing call site to instrument. `properties: { status }` (the `payment_attempts.status` string, e.g. `"authorized"`) — never an amount. |

## Outcome

| Event | Status | Notes |
|---|---|---|
| `offer_received` | reserved | Outcome-stage signals are reconstructed from `applications`/`student_outcomes` directly (see `OUT-001_OUTCOME_DATA_FOUNDATION.md`) rather than duplicated as a `product_events` row. Reserved for a future pass that wants an explicit event-stream signal here too. |
| `enrollment_confirmed` | reserved | Same reasoning as `offer_received`. |

## Example property shapes

Adapted from the milestone's own example events, to this codebase's actual entity id type (`uuid`, not a numeric or string slug):

```ts
// career_viewed
{ eventName: "career_viewed", entityType: "career", entityId: "3fae...uuid", properties: { slug: "ev-systems-engineer" } }

// course_compared
{ eventName: "course_compared", entityType: "course", entityId: "9c11...uuid", properties: { courseIds: ["9c11...", "a204..."], count: 2 } }

// payment_completed
{ eventName: "payment_completed", entityType: "invoice", entityId: "77bd...uuid", properties: { status: "authorized" } }
```
