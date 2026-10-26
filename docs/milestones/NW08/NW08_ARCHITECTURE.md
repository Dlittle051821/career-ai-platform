# NW08 — Architecture

## 1. Principle: reuse, don't duplicate

Every new page composes existing, already-permission-gated data-access functions (or a small number of genuinely new, equally bounded ones). No new table. No new CRUD primitive for anything that already had one. No parallel admin product — every new route lives under the existing `/admin/**` tree, inside the existing `AdminShell`, gated by the existing `AdminPermission` matrix.

## 2. New files

| File | Purpose |
|---|---|
| `src/components/admin/CommandCentreWidgets.tsx` | Presentational-only widgets for the Command Centre: operational alerts list, dependency-free SVG/CSS revenue trend bars, dependency-free CSS conic-gradient service-delivery donut, a generic `SectionCard` reused by the CRM and Finance pages too. |
| `src/app/admin/crm/page.tsx` | NW08.3 Student CRM & Lifecycle overview. |
| `src/app/admin/applications/operations/page.tsx` | NW08.5 Application Operations overview. |
| `src/lib/supabase/admin/commercial-finance.ts` | NW08.6 `getCommercialFinanceOverview()` — the one new data-access module this milestone added, composing 4 existing tables' status columns. |
| `src/app/admin/finance/page.tsx` | NW08.6 Commercial Operations & Finance overview. |
| `docs/milestones/NW08/*` | This milestone's 14 documents. |

## 3. Modified files

| File | What changed |
|---|---|
| `src/lib/admin/analytics.ts` | +`tallyByKey`, `bucketRevenueByMonth`, `rankOperationalAlerts`, `resolveAnalyticsWindow` (all pure, all unit-tested). |
| `src/lib/admin/analytics.test.ts` | +27 new assertions across the 4 functions above. |
| `src/lib/supabase/admin/dashboard.ts` | `getAdminDashboardSummary()`: fixed the pre-existing cross-currency revenue bug (§2 of `NW08_02_COMMAND_CENTRE.md`); added `revenueTrend`, `pendingRefundsCount`, `serviceDeliveryBreakdown`, `operationalAlerts`. Same single `dashboard:read` gate as before — no permission widened. |
| `src/app/admin/page.tsx` | Redesigned Command Centre layout; 9th KPI tile; new Operational Alerts / Service Delivery / Revenue Trend sections. |
| `src/components/admin/AdminShell.tsx` | `ADMIN_NAV` items gained a `group` field (10 groups); sidebar renders grouped headers; 3 new nav items (CRM Overview, Operations, Finance Overview); badge text "Admin" → "Admin Studio". Every existing `href`/`permission` unchanged. |
| `src/lib/supabase/admin/students.ts` | +`getStudentStatusDistribution()` (`students:read`). |
| `src/lib/supabase/admin/leads.ts` | +`getLeadStageDistribution()`, +`getLeadsNeedingFollowUpCount()` (both `leads:read`). |
| `src/lib/supabase/admin/applications.ts` | `ApplicationFilters` +`assignedCounsellorId`. |
| `src/app/admin/applications/page.tsx` | Reads `assignedCounsellorId` from querystring. |
| `src/app/admin/leads/page.tsx` | Reads `assignedCounsellorId` from querystring (the underlying `listLeads()` filter already existed). |
| `src/app/admin/counsellors/page.tsx` | Workload table: +Specializations column, capacity-utilization/"Idle" flag, cross-links into the two pages above. |
| `src/lib/supabase/admin/dashboard-work-queue.ts` | +`getApplicationOperationsOverview()`, +`StaleApplication` type (`application-documents:read`). |
| `src/app/admin/analytics/page.tsx` | +"This month"/"Last month" range options, +custom from/to date inputs. |
| `src/lib/supabase/admin/analytics.ts` | `AnalyticsFilters`/`AnalyticsSummary` widened to a two-sided `DateWindow`; every date-bounded query updated; `sinceDays` kept working unchanged. |

## 4. Permission model — unchanged

No new `AdminPermission` value, no new role, no change to `ROLE_PERMISSIONS`. Every new page/function reuses an existing permission (`students:read`, `leads:read`, `application-documents:read`, `payments:read`/`invoices:read`/`refunds:read`/`pricing:read`) at the same granularity that permission already had. The one deferred proposal (a narrower "Student Relations" role) is documented, not implemented — `NW08_01_ADMIN_AUDIT.md` §8.

## 5. Dependency footprint — unchanged

No package was added to `package.json`. The Command Centre's revenue trend and service-delivery visuals are inline SVG/CSS (`conic-gradient`), not a charting library — confirmed no such dependency existed before this milestone and none was introduced.

## 6. Database footprint — zero

No migration, proposed or applied. See `NW08_DATABASE_CHANGE_PLAN.md`.
