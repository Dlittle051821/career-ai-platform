# M9 Implementation — Audit + Outcome Instrumentation

## Architecture

```
src/lib/analytics/events.ts        pure — the event registry (PRODUCT_EVENTS)
src/lib/analytics/track.ts         pure — validation/sanitization (buildEventInsert)
src/lib/supabase/analytics/track.ts        I/O — server trackEvent() (RSC/Server Actions)
src/lib/supabase/analytics/track-client.ts I/O — browser trackEventClient() (Client Components)
src/lib/supabase/admin/outcomes.ts         I/O — manual admin/counsellor student_outcomes writes + reads
supabase/migrations/0010_product_events_and_outcomes.sql
```

This mirrors the pure-vs-I/O split already established everywhere else in this codebase (`src/lib/pricing/` vs `src/lib/supabase/pricing/`, `src/lib/admin/` vs `src/lib/supabase/admin/`). `src/lib/analytics/**` talks to nothing but plain data — no Supabase import — which is what makes it Vitest-testable under this project's node-only, no-jsdom convention.

## Database changes

One additive migration, `0010_product_events_and_outcomes.sql`, following the exact conventions of `0007`/`0008`/`0009`: idempotent `create table if not exists`, `drop policy if exists` before `create policy`, `comment on table/function`, PART numbering, a verification-query appendix (not auto-run). `0001`–`0009` are untouched.

- **`public.product_events`** — modeled directly on `pricing_analytics_events` (`0007` PART 5): `event_name` CHECK-constrained to the exact 27-name vocabulary in `src/lib/analytics/events.ts`; `user_id`/`occurred_at` unconditionally server-stamped by a `BEFORE INSERT` trigger (`stamp_product_event`) from `auth.uid()`/`now()`; RLS `INSERT` open to `anon, authenticated` with `check (true)` (the CHECK constraint is the real gate, same reasoning `pricing_analytics_events`'s own policy documents); `SELECT` restricted to `super_admin`/`admin`/`analyst`; no update/delete (append-only). Four indexes only: `(event_name)`, `(user_id)`, `(created_at)`, `(entity_type, entity_id)`.
- **`public.student_outcomes`** — one evolving row per student (`unique(student_user_id)`), not one row per application and not one row per stage transition. `journey_stage`/`outcome_status` share one CHECK-constrained vocabulary; `final_application_id` references `public.applications` instead of duplicating its `course_id`/`university_id`. Kept current automatically for the application-derived fields by a trigger on `applications` (`sync_student_outcome_from_application`, `SECURITY DEFINER`); a separate manual path (`src/lib/supabase/admin/outcomes.ts`) covers the fields the trigger never touches. RLS: student reads their own row; `super_admin`/`admin`/`analyst` read all; `counsellor` reads/writes their assigned students' rows (matching `admin_student_notes`' exact role set and scoping mechanism); `super_admin`/`admin` write any row. No delete policy. See `OUT-001_OUTCOME_DATA_FOUNDATION.md` for the full design rationale.

`src/types/database.ts` gained hand-written `ProductEventsRow`/`StudentOutcomesRow` types and their `Tables[...]` entries, matching the file's existing convention (it is hand-maintained to look like `supabase gen types` output, not actually generated).

## Event flow

1. A page/Server Action/Client Component builds a `TrackEventInput` (event name from the registry, optional `entityType`/`entityId`/`source`/`path`/`feature`/`properties`/`utm`).
2. `buildEventInsert()` (pure) validates the event name against `IMPLEMENTED_EVENT_NAMES` — an unknown or `reserved` name is rejected outright (`{ ok: false }`), logged as a dev warning, and never reaches Supabase. Every other problem (oversized/malformed `properties`, a non-uuid `entityId`, an overlong string field) is *sanitized*, not rejected — see "Validation and sanitization" below.
3. `trackEvent()` (server) / `trackEventClient()` (browser) call `supabase.from("product_events").insert(...)` inside a `try`/`catch`, on top of a Supabase client whose own `{ error }` is also checked (not thrown) — either failure path is logged and swallowed, never surfaced to the caller.
4. Every call site uses `void trackEvent(...)` (or leaves the promise unawaited) — this function's returned promise **never rejects**, so a call site is never a `try`/`catch` around analytics.
5. The database trigger stamps `user_id`/`occurred_at` unconditionally, ignoring whatever the client sent.

## Validation and sanitization (`src/lib/analytics/track.ts`)

- **Rejected outright** (the one thing that drops the whole event): an `eventName` that is not in `IMPLEMENTED_EVENT_NAMES` — firing a reserved or unknown name is always a call-site bug, never something worth silently proceeding past.
- **Sanitized, never rejected** (a single bad field never takes down an otherwise-valid event):
  - `properties` must be a plain object — an array, string, or anything else becomes `{}`.
  - Any property key matching a denylist pattern (`password`, `token`, `secret`, `ssn`, `aadhaar`, `passport`, `credit[_-]?card`, `card[_-]?number`, `cvv`, `address`, a key ending in `note`/`notes`, `ip_address`, or containing `auth`) is dropped — matched on the key name, not the value, since a value can't be meaningfully sanitized without knowing what it represents.
  - String property values are truncated to 300 characters; only primitive-only arrays are kept (capped at 20 items); nested objects/functions are dropped.
  - At most 20 property keys; if the sanitized object is still over 4000 bytes of JSON, it is replaced with `{}` entirely.
  - `entityId` must match a uuid shape or it becomes `null`.
  - `source`/`path`/`feature`/`entityType`/`session_id`/`anonymous_id`/UTM fields are trimmed and length-clamped (matching the database's own `CHECK` length constraints), never rejected.

This design is deliberate: an analytics client bug (a stray long string, an accidentally-nested object) should never be the reason a real, otherwise-valid event silently vanishes from the log.

## Session / anonymous-id handling

`product_events.anonymous_id` and `TrackEventInput.anonymousId` exist and are wired end-to-end, but **no page in this codebase currently generates or passes an anonymous id** — this is a documented-but-not-yet-wired capability, not a broken one. The one existing precedent for a pre-login session token in this codebase, `pricing_analytics_events.session_ref` (`src/lib/supabase/pricing/analytics.ts`), was checked directly: its own three call sites (`/pricing`, `/pricing/checkout/[slug]`, the checkout Server Action) never actually pass a `sessionRef` either — the field exists on that table too but nothing generates one. Since there is no existing convention anywhere in this codebase to reuse, M9 does not invent a new one. Every M9 event today either carries a real `user_id` (server-stamped from `auth.uid()`) or is genuinely anonymous with `anonymous_id: null` — honestly reflecting the current state, e.g. `career_viewed`/`course_viewed`/`college_viewed` on public pages are reachable pre-login and correctly record `user_id: null, anonymous_id: null` for a signed-out visitor.

## Attribution / UTM handling

`product_events.utm_source/utm_medium/utm_campaign/utm_content/utm_term` mirror `leads`' own UTM column convention exactly. Only `lead_created` currently populates them (from the lead record's own UTM fields, when an admin/counsellor recorded them). No page reads `?utm_*=` query params into an event today — that would require wiring UTM capture into the public pages themselves, out of this milestone's scope (no fake/invented attribution).

## Privacy decisions

- No third-party analytics dependency — everything is first-party, in this application's own Postgres database. `product_events` is designed so an external tool (a data warehouse export, or eventually a dedicated analytics platform) *could* be pointed at it later, but nothing in this milestone integrates one.
- No passwords, tokens, full addresses, payment credentials, private counselling notes, or unnecessary free text ever reach `properties` — enforced both by the denylist sanitizer above and, as a design discipline, by every call site only ever passing small, deliberately-chosen fields (counts, ids, enum-like strings).
- No amounts anywhere in `product_events` (`payment_started`/`payment_completed` carry `currency`/`status` only) — the ledger (`invoices`, `payment_transactions`) stays the one authoritative source for money, exactly like `pricing_analytics_events` already established for the pricing funnel.
- No public/unauthenticated read access — `SELECT` on both new tables is admin/analyst/counsellor-scoped only; anonymous/authenticated write access exists only because *recording your own product usage* is not a privileged act (same reasoning `pricing_analytics_events` documents).
- No noisy low-value events — no `button_hovered`, `navbar_opened`, scroll tracking, or mouse movement anywhere in the registry.
- No invasive fingerprinting — `anonymous_id` (when eventually wired) is meant to be a random, non-identifying, per-session token, never a device fingerprint, cookie-matched identity graph, or IP-derived value.

## Why `package_viewed`/`package_selected` are not duplicated

`pricing_analytics_events` (Milestone 10, `0007` PART 5) already logs `plan_view`/`plan_selected` from exactly the pages `package_viewed`/`package_selected` would cover (`/pricing`, `/pricing/checkout/[slug]`). Firing a second, near-identical `product_events` row for the same page view would create two, slightly-differently-shaped sources of truth for the same funnel step with no benefit — a classic "avoid obviously-duplicated events" case. `trackEvent()` was deliberately **not** made the shared underlying primitive for `pricing_analytics_events` either: that table's own trigger/RLS/comment already fully documents its own narrower, already-reviewed design, and rewriting a working, tested Milestone-10 system to route through a new Milestone-9 primitive is exactly the kind of out-of-scope change M9 should not make. The two tables coexist by design; `M9_EVENT_TAXONOMY.md` documents the equivalence.

## Outcome model, in one paragraph

`student_outcomes` is deliberately one evolving row per student, not a snapshot-per-transition ledger — fine-grained history already exists in `application_status_history`/`lead_status_history` (Milestone 7) and, going forward, in `product_events` itself, so duplicating that as a second history mechanism inside `student_outcomes` would be redundant. The columns that `applications` already tracks authoritatively (`application_count`, `offer_count`, `final_decision_status`, `final_application_id`, and the derived `journey_stage`/`outcome_status`) are kept in sync automatically by a database trigger the moment any of a student's `applications` rows change — no application-code call site is required for that part. The columns `applications` has no opinion on (`target_career_id`/`target_course_id`/`target_university_id`/`destination_country`/`metadata`, and the pre-application `journey_stage` values `not_started`/`exploring`/`shortlisted`) are set only through the manual admin/counsellor path in `src/lib/supabase/admin/outcomes.ts`. Full design rationale, the exact stage-mapping logic, and what is explicitly *not* implemented: `OUT-001_OUTCOME_DATA_FOUNDATION.md`.

## How a future developer adds a new event

1. Add an entry to `PRODUCT_EVENTS` in `src/lib/analytics/events.ts` — pick a `category`, set `status: "reserved"` until a real call site exists, and write an honest one-sentence `reason`.
2. Add the same name to the `check (event_name in (...))` list in a **new, additive migration** (never edit `0010` after it ships) — `alter table public.product_events drop constraint product_events_event_name_check, add constraint product_events_event_name_check check (event_name in (...))`.
3. When the real feature exists, flip `status` to `"implemented"`, update `reason` to say where it fires, and call `trackEvent(...)`/`trackEventClient(...)` from that real code path — always `void`'d or otherwise fire-and-forget, always with the smallest honest `properties` payload.
4. Update `docs/M9_EVENT_TAXONOMY.md`'s table for that event.
5. Add a case to `src/lib/analytics/track.test.ts` if the new event has any interesting validation shape, and re-run `npm test`.

## Environment variables

None — `trackEvent()`/`trackEventClient()` reuse the exact same Supabase server/browser clients (`src/lib/supabase/server.ts`/`client.ts`) every other module in this codebase already uses; no new env var was introduced.

## Admin analytics

`src/lib/admin/analytics.ts` (pure math) is unchanged — `computeRate()`/`withShareOfTotal()`/`sumRecordedRevenue()` are reused as-is, per the milestone's explicit instruction to extend rather than replace. `src/lib/supabase/admin/analytics.ts` gained a `ProductAnalyticsSummary` block (`getAnalyticsSummary()`'s new `product` field): total student accounts, new registrations, profile-completion count/rate, one `count: "exact", head: true` query per **implemented** event name only (never a reserved one — that would always report a misleading zero), invoices-paid count, and the `student_outcomes` status distribution. `/admin/analytics` gained one new section rendering these — kept intentionally minimal (a few stat cards and two plain lists, reusing the page's existing time-range filter) rather than new charts/visualizations, per the milestone's own "data collection is more important than visualization" instruction. Richer time-series charts are explicitly deferred.

## Dev-only sample-event seed

Not added. A seed here would either need to fabricate believable-looking `product_events`/`student_outcomes` rows tied to fake users (risking confusion with real data, and adding a `0007_*` seed file whose only purpose is cosmetic dashboard testing) or be so trivially small it adds little value. Given "if useful" in the spec and the actual risk/benefit here, this was skipped — the admin analytics page already renders correctly with zero rows (every count safely defaults to `0`, every rate to `isReliable: false`), which is the more important thing to have verified.
