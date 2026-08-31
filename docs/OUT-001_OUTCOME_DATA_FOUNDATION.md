# OUT-001 — Outcome Data Foundation

## 1. What is collected now

`public.student_outcomes` (`supabase/migrations/0010_product_events_and_outcomes.sql` PART 2) — **one evolving row per student**, not one row per application and not a snapshot-per-transition ledger:

| Column | Source | Owned by |
|---|---|---|
| `journey_stage`, `outcome_status` | derived from `applications` | automatic trigger (once any application exists) |
| `application_count`, `offer_count` | `count(*)` / `count(*) filter (decision_status='offer')` over the student's `applications` rows | automatic trigger |
| `final_application_id`, `final_decision_status` | the "furthest along" application row (see §5) | automatic trigger |
| `target_career_id`, `target_course_id`, `target_university_id` | admin/counsellor judgment | manual (`src/lib/supabase/admin/outcomes.ts`) |
| `destination_country` | admin/counsellor judgment | manual |
| `metadata` (jsonb) | free-form, admin-entered | manual |
| `outcome_source`, `recorded_by`, `recorded_at` | who/what last wrote the row | both paths set these differently — `system`/`null` for the trigger, `student`/`counsellor`/`admin`/`recorded_by=<uuid>` for the manual path |

`public.product_events` (same migration, PART 1) supplements this with a time-ordered stream of discrete product-usage signals (`career_viewed`, `course_viewed`, `application_started`, `payment_completed`, etc.) — see `M9_EVENT_TAXONOMY.md` for the full list.

## 2. What is collected later (deferred, not implemented now)

- **`offer_received`/`enrollment_confirmed` as explicit `product_events` rows.** The current design reconstructs these moments from `applications`/`student_outcomes` instead (§5, §6) — a future pass could additionally log them as discrete events if a use case (e.g. a real-time notification, or an event-stream-only reporting tool) needs them independent of querying `student_outcomes`' current state.
- **Fine-grained outcome history.** `student_outcomes` deliberately holds only current state. A full history of *every* `journey_stage`/`outcome_status` transition a student ever passed through is not stored as a dedicated table — it is reconstructed on demand from `application_status_history` + `lead_status_history` (both already exist, Milestone 7) plus `product_events` going forward. If a genuine reporting need for pre-computed history ever emerges, an additive `student_outcome_history` table (one row per transition, mirroring `application_status_history`'s own shape) is the natural next step — not implemented now.
- **A `counselling_requested`-driven pre-application journey stage.** Since there is no real lead-capture submission path yet (`M9_EVENT_TAXONOMY.md`), `exploring`/`shortlisted` journey stages currently have no automatic trigger and must be set manually.
- **Outcome-intelligence features** — see §6.

## 3. How outcomes connect to recommendations / courses / colleges / applications / counselling

- **Recommendations**: not directly linked. `career_recommendations_generated` (a `product_events` row) records that a recommendation run happened and how many results it produced — it does not write to `student_outcomes`. An admin/counsellor may later set `target_career_id` on a student's outcome row informed by what a student was recommended, but that is a human judgment call, never an automatic write from the recommendation engine (which computes fresh, unpersisted results on every page load — there is nothing to "link" to).
- **Courses / colleges (universities)**: `target_course_id`/`target_university_id` are nullable FKs a counsellor/admin sets by hand (§1) — deliberately *not* auto-populated from `course_viewed`/`college_viewed` events, since a student viewing a course is a much weaker signal than a counsellor's actual read of their intent.
- **Applications**: the primary, authoritative connection. `final_application_id` references `public.applications` directly — `student_outcomes` never copies that table's `course_id`/`university_id`/`stage`/`decision_status`; a query joins through `final_application_id` to get them. See §5 for exactly how `journey_stage`/`outcome_status`/`application_count`/`offer_count` are derived.
- **Counselling**: `outcome_source='counsellor'` plus `recorded_by=<counsellor's user id>` records *when a counsellor's own judgment*, not the automatic applications sync, produced the current state — visible to admins reviewing data quality/provenance (§4). The counsellor RLS scoping matches `admin_student_notes`/`admin_student_meta` exactly (assigned via `admin_student_meta.assigned_counsellor_id = current_counsellor_id()`).

## 4. Data source / reliability — `outcome_source`

Five values, `('student', 'counsellor', 'admin', 'system', 'integration')`:

- **`system`** — set only by the `sync_student_outcome_from_application()` trigger. Reliability: high for the fields it owns (it is a deterministic function of `applications`), but it only ever reflects what `applications` says — if a real-world outcome hasn't been entered into `applications` yet, the system-derived state simply hasn't caught up.
- **`admin`** / **`counsellor`** — set by the manual write path, distinguishing an admin's vs. a counsellor's judgment. Reliability: as good as the human who entered it: `recorded_by` gives admins a specific person to ask if a value looks wrong.
- **`student`** — reserved for a possible future self-report path (e.g. a student marking their own enrollment) — no such path exists yet in this milestone; nothing writes `outcome_source='student'` today.
- **`integration`** — reserved for a possible future data feed from a university/application-portal integration — explicitly out of scope for this milestone (no such integration exists).

`outcome_source` is a **coarse category**; `recorded_by` is a **specific identity** (nullable — `null` exactly when `outcome_source='system'`). The two are separate columns on purpose: an admin auditing "why does this student show as enrolled?" needs both "a human said so" (category) and "which human" (identity) without conflating them.

## 5. Student journey stages — the exact mapping

`journey_stage` and `outcome_status` deliberately share one controlled vocabulary (`not_started`, `exploring`, `shortlisted`, `application_started`, `application_submitted`, `offer_received`, `accepted`, `enrolled`, `not_enrolled`, `deferred`, `unknown`) but answer two different questions:

- **`journey_stage`** — *where is the student right now* in the funnel (discovery → shortlisting → application → decision → enrollment). Intended to move forward as the student progresses.
- **`outcome_status`** — *what is the resolved/terminal classification* of that journey once (and if) it reaches a conclusion. Stays `unknown` while still in progress.

Two columns, not one, because "an application was rejected" is a fact about `outcome_status` (`not_enrolled`) that should not silently regress `journey_stage` back to an earlier funnel position — the student *did* reach `application_submitted`, and a dashboard funnel view needs that fact preserved even after the outcome resolves negatively.

**Automatic mapping** (`sync_student_outcome_from_application()`, run against the single "best" application — the furthest-along by a fixed rank, ties broken by most recently updated):

| `applications.stage` | → `journey_stage` | `outcome_status` (also considers `decision_status`) |
|---|---|---|
| `inquiry`, `preparing` | `application_started` | `unknown` |
| `submitted`, `under_review`, `interview`, `decision_pending` | `application_submitted` | `unknown` (or `offer_received`/`deferred` if `decision_status` says so) |
| `offer_received` | `offer_received` | `offer_received` |
| `enrolled` | `enrolled` | `enrolled` |
| `rejected`, `withdrawn` | `application_submitted` *(funnel position preserved)* | `not_enrolled` |

Acknowledged simplification: a student with several `applications` rows is represented by only their single furthest-along one. A rejection on that furthest-along application does not pull `journey_stage` back down to reflect a different, still-active application — the row shows the *best* outcome reached across all applications, not a per-application breakdown (that breakdown is always available directly from `applications` itself via `student_user_id`).

**Manual-only stages** (never set by the trigger): `not_started` (the default before any row exists), `exploring`, `shortlisted`, `accepted` (an admin/counsellor recording "offer accepted" ahead of the `applications.stage` actually flipping to `enrolled`). Because the trigger overwrites `journey_stage`/`outcome_status` the next time *any* of the student's applications changes, a manually-set value in this range is only stable **before** an application exists for that student — this is called out explicitly so nobody is surprised when a hand-entered `shortlisted` value later gets overwritten by `application_started` the moment a real application is created. That is the correct, intended behavior: application data is authoritative once it exists.

## 6. Future outcome-intelligence possibilities (explicitly NOT implemented now)

- Predictive "likelihood to enroll" scoring from `product_events` engagement patterns — no scoring model of any kind exists in this milestone (matches the spec's explicit "no advanced AI/recommendation-engine redesign" boundary).
- Cohort/cross-student outcome benchmarking (e.g. "students who viewed 5+ courses convert at X% vs. 1-2 courses at Y%") — the raw data (`product_events` + `student_outcomes`) supports this kind of query being written later, but no dashboard or pre-computed aggregate for it exists now.
- Automatic `target_career_id`/`target_course_id`/`target_university_id` inference from browsing behavior — deliberately left as a human (admin/counsellor) judgment call, not an algorithm, in this milestone.
- A `student` or `integration` `outcome_source` write path (self-reported enrollment confirmation; a university/portal data feed) — the column value is reserved and ready, no code path produces it yet.
- Time-series/history views of `journey_stage` transitions — see §2's note on a possible future `student_outcome_history` table.

None of the above is implemented in Milestone 9. This document exists so a future milestone that wants any of them starts from an accurate picture of what already exists, rather than re-deriving it.
