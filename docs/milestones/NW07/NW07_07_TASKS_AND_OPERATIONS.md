# NW07.7 — Counsellor Tasks and Operations

## 1. Scope

A cross-case view of a counsellor's own open operational work, drawing on the existing NW06 Application Tasks system — deliberately "extend minimally," per `NW07_01_AUDIT.md`'s own recommendation, rather than building a second task-management system for case-scoped (no-application) work.

## 2. What was built

- `listMyOpenStaffApplicationTasks()` (`src/lib/supabase/admin/application-tasks.ts`) — a new cross-application staff read: every task in `open`/`in_progress`/`student_completed` status, relying entirely on `application_tasks`'s own existing RLS scoping (a counsellor sees only tasks on their own assigned applications; an admin sees every open task). No new table, no new RPC — one new query function alongside the existing per-application ones.
- `src/app/counsellor/tasks/page.tsx` — the "Tasks" queue: title, status (with an overdue flag via `isApplicationTaskOverdue()`), due date, and a link to the full application. Deliberately **read-only** — completing, verifying, or cancelling a task stays on the existing Application Workflow (`/admin/applications/[id]`'s own `AdminApplicationTasks` component); this page is the "what's outstanding across my whole caseload" view the brief asks for, not a duplicate action surface.
- Surfaced on the dashboard (`/counsellor`) as the "Operational Tasks" panel, and in the nav as "Tasks."

## 3. Case-scoped (no-application) tasks — considered, not built

`NW07_01_AUDIT.md` flagged that `application_tasks` is scoped to an `application_id` — there is no way today to create an operational task against a student case that doesn't yet have an application (e.g. "follow up on Discovery Session notes before next call"). The audit's own recommendation was to extend the existing system minimally in a future stage rather than build a second task table now, and that recommendation stands: no code was written for this in NW07.7. Any future extension should be judged against the same RLS-scoping and RPC-only-write conventions `application_tasks` already established, not a fresh design.

## 4. Verification

`npx tsc --noEmit` and `npx eslint` clean. No new pure logic was introduced — `isApplicationTaskOverdue()`/`isApplicationTaskStatus()`/`APPLICATION_TASK_STATUS_LABELS` are all pre-existing, already covered by `application-tasks.test.ts`.
