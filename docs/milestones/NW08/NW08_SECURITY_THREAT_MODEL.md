# NW08 — Security Threat Model

## 1. Scope

NW08 added zero database changes (see `NW08_DATABASE_CHANGE_PLAN.md`) — every risk below is an application-layer question: did any new page, function, or querystring parameter widen what a role can see or do beyond what it could already see or do before this milestone. STRIDE, applied to the actual additions.

## 2. Spoofing / identity

No new authentication path. Every new page calls `getCurrentAdmin()` (server-resolved from the session, never a client-supplied value) exactly as every pre-existing admin page does. `getCommercialFinanceOverview(role)` takes a `role` parameter from the caller, but never trusts it alone — each section additionally calls `requireAdminPermission()`, which re-derives the role from the current session server-side before running its query (see that function's own docblock). No RPC or query anywhere in NW08 accepts a caller-supplied "acting as" identity.

## 3. Tampering

NW08 added no write path at all — every new function (`getStudentStatusDistribution`, `getLeadStageDistribution`, `getLeadsNeedingFollowUpCount`, `getApplicationOperationsOverview`, `getCommercialFinanceOverview`) is read-only. The one filter addition (`assignedCounsellorId` on `listLeads()`/`listApplications()`) is a `.eq()` equality filter passed through the Supabase client (parameterized, not string-interpolated SQL) — not a new injection surface, and it narrows the result set, it does not widen it.

## 4. Repudiation

Not applicable — nothing in NW08 writes an auditable action. The existing `admin_audit_log` surface (already read by the Command Centre's "recent activity" card) is unchanged.

## 5. Information disclosure — the one real question this milestone had to answer

**Risk: does a new cross-link or overview page let a role see data it couldn't see before?**

- The `assignedCounsellorId` querystring filter on `/admin/leads` and `/admin/applications`: this narrows an already-permitted result set (any role with `leads:read`/`applications:read` could already see every row matching their own existing RLS scope by paging through the unfiltered list) — it does not add a way to see a ROW that wasn't already visible. A counsellor who could already see every lead (if that's how this codebase's RLS scopes `counsellor`) can filter to one counsellor's leads either way; a counsellor who could only ever see their own leads (if RLS scopes it that way) still only ever gets their own leads back regardless of what `assignedCounsellorId` value is passed, because RLS — not this application-layer filter — is the real boundary, same as every other filter on these two pages (`stage`, `status`, `q`). This milestone did not change that boundary in either direction.
- `/admin/crm`, `/admin/finance`, `/admin/applications/operations`: each is a pure composition of counts a role could already query individually via the existing list pages (e.g. `/admin/students?status=prospect`'s own total). None of the 3 new pages exposes a count or row a role's existing permission set could not already derive from pages that existed before NW08. Each section checks its own specific permission (`students:read`/`leads:read` for CRM; `pricing:read`/`payments:read`/`invoices:read`/`refunds:read` independently for Finance; `application-documents:read` for Operations) and is omitted — not shown empty, not errored — when absent.
- `ServiceDeliveryDonut`/the Command Centre's new widgets render only aggregate counts (never a named student list) — no new per-student PII is exposed on the dashboard that a role with `dashboard:read` couldn't already see in the existing "Applications needing your attention" widget.

## 6. Denial of service

Every new query is a bounded `count: "exact", head: true` or a narrow column-only select, same discipline as every pre-existing query in this codebase. `getApplicationOperationsOverview()`'s scan is explicitly capped at `scanLimit = 200` (vs. the dashboard widget's `scanLimit = 40`) — larger because an operations view legitimately needs a wider sample than a 5-item dashboard widget, but still a small, fixed, disclosed constant, never "all open applications." `bucketRevenueByMonth()`'s query window is capped to `REVENUE_TREND_MONTHS = 6` calendar months.

## 7. Elevation of privilege

No new permission, no new role, no widened `ROLE_PERMISSIONS` entry. The one role-model question the brief raised (a narrower "Student Relations" role) was deliberately NOT implemented — see `NW08_01_ADMIN_AUDIT.md` §8 — so there is no new, narrower permission boundary to get wrong either.

## 8. Known limitations carried over, unchanged by NW08

The pre-existing GST/checkout-calculation risk remains open and untouched (NW08.6 touches no checkout code). NW07's proposed migration remains unapplied; nothing NW08 built depends on it. No live, authenticated browser pass was possible in this sandbox (no reachable Supabase project) — see `NW08_08_QA_REPORT.md` §3 for the same disclosed limitation every prior milestone in this session has carried, and the manual-verification steps for a real staging environment.

## 9. Conclusion

NW08 is, from a security standpoint, a strictly additive, read-only milestone: new pages compose existing, already-correctly-scoped reads; the one new filter narrows rather than widens a result set; and no new write, role, or migration was introduced. The one real accuracy fix this milestone made (the cross-currency revenue bug — `NW08_02_COMMAND_CENTRE.md` §2) is a correctness improvement, not a security regression it introduced — the bug predates NW08.
