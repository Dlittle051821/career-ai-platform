import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { AdminTable, Td } from "@/components/admin/AdminTable";
import { EmptyState } from "@/components/admin/EmptyState";
import { listMyOpenStaffApplicationTasks } from "@/lib/supabase/admin/application-tasks";
import { isApplicationTaskStatus, isApplicationTaskOverdue, APPLICATION_TASK_STATUS_LABELS } from "@/lib/applications/application-tasks";

export const metadata: Metadata = { title: "Tasks" };

/**
 * NW07.7 — Counsellor Tasks and Operations. A read-only queue over
 * listMyOpenStaffApplicationTasks() (RLS-scoped to the viewer's own
 * assigned applications; an admin sees every open task) — per
 * NW07_01_AUDIT.md's "extend minimally" decision, this deliberately does
 * NOT build a second task-management system. Completing, verifying, or
 * cancelling a task stays on the existing Application Workflow
 * (`/admin/applications/[id]`'s own AdminApplicationTasks component) — this
 * page is the cross-case "what's outstanding" view the brief asks for, not
 * a duplicate action surface.
 */
export default async function CounsellorTasksPage() {
  const tasks = await listMyOpenStaffApplicationTasks();
  const now = new Date();

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Counsellor Studio</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">Tasks</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Open application tasks across your caseload. Open the application to complete, verify, or cancel a task —
          this page is a queue, not a second place to act on one.
        </p>
      </div>

      {tasks.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="Nothing outstanding" description="An open task on one of your assigned applications will appear here." />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            {tasks.length} open task{tasks.length === 1 ? "" : "s"}
          </p>
          <AdminTable headers={["Task", "Status", "Due", ""]}>
            {tasks.map((t) => {
              const overdue = isApplicationTaskStatus(t.status) && isApplicationTaskOverdue(t.status, t.dueDate, now);
              return (
                <tr key={t.id} className="hover:bg-surface-alt/50">
                  <Td className="font-medium text-text">{t.title}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      {isApplicationTaskStatus(t.status) ? <Badge tone={overdue ? "error" : "neutral"}>{APPLICATION_TASK_STATUS_LABELS[t.status]}</Badge> : null}
                      {overdue ? <ShieldAlert aria-hidden="true" className="h-3.5 w-3.5 text-error" /> : null}
                    </div>
                  </Td>
                  <Td className="text-text-soft">{t.dueDate ? new Date(t.dueDate).toLocaleDateString("en-IN") : "No due date"}</Td>
                  <Td>
                    <Link href={`/admin/applications/${t.applicationId}`} className="text-sm font-semibold text-secondary-dark hover:text-primary">
                      Open application
                    </Link>
                  </Td>
                </tr>
              );
            })}
          </AdminTable>
        </>
      )}
    </div>
  );
}
