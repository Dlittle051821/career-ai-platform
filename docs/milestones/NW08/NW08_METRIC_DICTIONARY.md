# NW08 — Metric Dictionary

Every metric NW08 shows anywhere in Admin Studio (Command Centre, Student CRM, Counsellor & Team, Application Operations, Commercial & Finance, Analytics), what it actually means, where it comes from, and what it deliberately excludes. This document exists because the NW08 brief specifically asked for one — no prior milestone produced a metric dictionary, and `docs/admin-system-guide.md` §11 (the pre-existing metric-definitions doc) is extended, not replaced, by this one.

**Timezone convention:** every date boundary computed by NW08 (revenue trend months, the analytics custom/calendar-month filter) is in **UTC**. "This month"/"last month" mean the UTC calendar month, not IST or any viewer's local timezone. This is a deliberate, disclosed simplification — Nextwise's existing data model stores `created_at`/`updated_at` as UTC timestamps and no prior milestone introduced a per-admin or per-business timezone preference, so introducing one now (and having only half the admin surface honor it) would create more confusion than it resolves. If a future milestone adds a real business timezone setting, every date-boundary function this milestone introduced (`bucketRevenueByMonth`, `resolveAnalyticsWindow`) takes `now`/`monthsBack` as explicit parameters specifically so that change can be made in one place.

## Command Centre (`/admin`)

| Metric | Definition | Source |
|---|---|---|
| Total students | Count of `profiles` rows where `account_type = 'student'`. Every registered account, regardless of activity. | `getAdminDashboardSummary()` |
| Active students | Count of `admin_student_meta` rows where `status = 'active'`. | same |
| New leads | Count of `leads` where `stage = 'new'`. | same |
| Leads needing follow-up | Count of `leads` where `next_follow_up_date <= today` AND `stage NOT IN (converted, lost)`. "Today" uses the server's own UTC date. | same |
| Active applications | Count of `applications` where `stage` is one of the 7 non-terminal stages (`inquiry`…`offer_received`). | same |
| Upcoming deadlines (14d) | Count of `applications` where `next_action_date` is set and falls within `[today, today+14d]`. | same |
| Pending payments | Count of `payments` where `status = 'pending'`. | same |
| Recorded revenue (paid) | Sum of `payments.amount_minor_units` where `status = 'paid'`, **grouped by `currency`** — never summed across currencies. One figure per currency actually recorded. | same (fixed in NW08.2 — see `NW08_02_COMMAND_CENTRE.md` §2 for the bug this replaced) |
| Pending refund cases | Count of `refunds` where `status IN (requested, under_review, approved, processing)` — i.e. not yet `processed`/`failed`/`rejected`/`cancelled`. This is a case count, never a money amount, and is distinct from `Payment.refundStatus` (see Commercial & Finance below). | same |
| Revenue trend | Trailing 6 UTC calendar months of `recordedRevenue`, bucketed by month and grouped by currency, zero-filled for a month with no paid revenue. | `bucketRevenueByMonth()` |
| Service delivery breakdown | Distribution of students across `student_outcomes.outcome_status` (the Milestone 9 journey-stage column: not_started → exploring → … → enrolled/not_enrolled/deferred/unknown). Not a new stage model — reuses the one real, already-tracked column. | `getAdminDashboardSummary()`, reusing the same column `getOutcomeStatusDistribution()` reads |
| Operational alerts | Five independent, real exception counts (leads overdue for follow-up; applications with an overdue next action; invoices with `status = overdue`; refunds in `requested`/`under_review`; refunds in `processing`), filtered to non-zero and ranked critical→warning→info. Never a fabricated or illustrative count. | `rankOperationalAlerts()` |

## Student CRM & Lifecycle (`/admin/crm`)

| Metric | Definition | Source |
|---|---|---|
| Lead stage distribution | Count of `leads` per `stage` value (6 stages). | `getLeadStageDistribution()` |
| Student status distribution | Count of students per `AdminStudentStatus` (4 values). "Prospect" = total registered students minus everyone with an explicit non-prospect `admin_student_meta.status` row — the SAME rule `listStudents()`'s own `status=prospect` filter uses, so this count and that filter can never disagree. | `getStudentStatusDistribution()` |
| Leads converted to students | The `converted` slice of the lead stage distribution above. Converting a lead sets `leads.stage = 'converted'` and links `converted_student_user_id` — it does not by itself mean the resulting student has purchased anything (see Commercial & Finance's purchase/payment distinction). | same |

## Counsellor & Team (`/admin/counsellors?view=workload`)

| Metric | Definition | Source |
|---|---|---|
| Assigned students/leads/applications | Per-counsellor counts from `admin_student_meta`/`leads`/`applications` assignment joins — current snapshot, not time-scoped. | `listCounsellorWorkload()` |
| "Over capacity" | `assignedStudentCount + assignedLeadCount + assignedApplicationCount > capacity` for a counsellor whose `capacity` is set. A counsellor with no `capacity` set is never flagged either way (there is nothing to compare against — shown as "—", never treated as 0 or unlimited). | computed in `src/app/admin/counsellors/page.tsx` from the above |
| "Idle" | Zero assigned students, leads, AND applications. | same |

## Application Operations (`/admin/applications/operations`)

| Metric | Definition | Source |
|---|---|---|
| Exception distribution | A bounded scan (`scanLimit = 200`, oldest-`updated_at`-first) of applications in a non-terminal stage, each classified into one of 6 work-queue buckets (`needs_action`, `waiting_on_student`, `ready_for_submission`, `awaiting_university`, `no_action`, `closed`) via the existing `getNextOperationalAction()` rules engine. **This is a bounded sample, not a platform-wide total** — the page states the exact scan size and count scanned. | `getApplicationOperationsOverview()` |
| Stale cases | Within that same scanned set, applications not updated in 14+ days. `daysSinceUpdate` is computed at fetch time, server-side. | same |

## Commercial Operations & Finance (`/admin/finance`)

| Metric | Definition | Source | Distinct from |
|---|---|---|---|
| Active plans / offers | Count of `pricing_plans`/`pricing_offers` where `is_active = true`. A count of sellable things, never a sales total. | `getCommercialFinanceOverview()` | — |
| Payment status distribution | Count of `payments` per `PaymentStatus` (6 values: pending/paid/failed/refunded/partially_refunded/cancelled). Only `paid` is ever treated as revenue anywhere in this codebase (`sumRecordedRevenue()`'s own filter). | same | A `pending` payment is not revenue; a `failed` payment is not a completed transaction. |
| Invoice status distribution | Count of `invoices` per `InvoiceStatus` (8 values, including `overdue`/`partially_paid`/`void`). An invoice's status is independent of any one `Payment` row's own status — an invoice can be `partially_paid` while individual payment attempts against it show `failed`. | same | An invoice is a billing document, not a payment attempt. |
| Refund status distribution | Count of the standalone `refunds` table's own 8-value lifecycle (`requested → under_review → approved → processing → processed | failed`, plus `rejected`/`cancelled`). | same | **Not** `Payment.refundStatus` (a separate, coarser 4-value field — `none/requested/partial/full` — living directly on a payment record). A `requested` or `under_review` refund case is never money that has left the business; only `processed` is. See `NW08_01_ADMIN_AUDIT.md` §6. |

**The GST/checkout-calculation risk** disclosed in an earlier milestone remains open. Nothing in this dictionary, or in any NW08 page, computes a price or a tax total — every figure above counts or sums already-recorded rows.

## Analytics (`/admin/analytics`)

Unchanged definitions (see `docs/admin-system-guide.md` §11) for: lead-to-student conversion rate, application offer rate, lead funnel, application stage distribution, payment status distribution, recorded revenue by currency, counsellor workload, top lead sources/universities, and the Milestone 9 product/outcome block. **New in NW08.7:** the time window these are all scoped to can now be "this month"/"last month" (UTC calendar months) or an explicit custom `from`/`to` date pair, in addition to the pre-existing "trailing N days"/"all time" options — see `resolveAnalyticsWindow()`. A custom `to` date is inclusive of that whole day. `MIN_RELIABLE_SAMPLE_SIZE = 5` still governs when a percentage is shown with a "small sample" caveat rather than as a confident figure — unchanged by NW08.

## What every metric above explicitly does NOT do

None of them count a lead as a student, a shortlist as a submission, a pending payment as revenue, a refund request as a completed refund, an assigned case as completed work, or an illustrative mockup number (1,482 leads / 892 active students / 386 applications / SGD 128,450 — all from the NW08 approved mockup) as real data. Every one of the mockup's numbers was checked against this codebase during NW08.1–NW08.7 and confirmed to appear nowhere in `src/`.
