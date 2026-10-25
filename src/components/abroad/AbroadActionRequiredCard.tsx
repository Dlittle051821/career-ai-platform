import Link from "next/link";
import { ListTodo } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatMoney } from "@/lib/admin/money";
import { APPLICATION_TASK_TYPE_LABELS, isApplicationTaskType, type ApplicationTaskType } from "@/lib/applications/application-tasks";
import type { MyOpenApplicationTaskSummary } from "@/lib/supabase/education/application-tasks";

function formatDueDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * NW06.2/NW06.6 — the Abroad dashboard's cross-application "Action
 * required" panel. `tasks` is listMyOpenApplicationTasks()'s own result,
 * already Abroad-filtered by the page (intersected against the student's
 * own Abroad application ids) — this component never fetches or invents a
 * task. Read-only: acting on a task (marking it done, adding a note)
 * happens on the owning application's own /applications/[id] page via
 * ApplicationTasks.tsx, reached through this row's own link, never here.
 */
export function AbroadActionRequiredCard({
  tasks,
  applicationLabelById,
}: {
  tasks: MyOpenApplicationTaskSummary[];
  applicationLabelById: Map<string, string>;
}) {
  return (
    <section aria-labelledby="action-required-heading" className="rounded-[1.5rem] border border-border bg-surface p-5 shadow-soft">
      <div className="flex items-center gap-2">
        <ListTodo aria-hidden="true" className="h-4 w-4 text-warning" />
        <h2 id="action-required-heading" className="text-base font-semibold text-text">
          Action required
        </h2>
      </div>

      {tasks.length === 0 ? (
        <p className="mt-3 text-sm text-success">Nothing is waiting on you across your Abroad applications.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {tasks.map((task) => {
            const typeLabel = isApplicationTaskType(task.taskType) ? APPLICATION_TASK_TYPE_LABELS[task.taskType as ApplicationTaskType] : task.taskType;
            const dueLabel = formatDueDate(task.dueDate);
            const isAwaitingVerification = task.status === "student_completed";
            return (
              <li key={task.id} className="border-t border-border pt-3 text-sm first:border-0 first:pt-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">{typeLabel}</p>
                    <Link href={`/applications/${task.applicationId}`} className="font-medium text-text hover:underline">
                      {task.title}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-muted">{applicationLabelById.get(task.applicationId) ?? "Application"}</p>
                  </div>
                  <Badge tone={isAwaitingVerification ? "info" : "warning"} className="shrink-0">
                    {isAwaitingVerification ? "Awaiting verification" : "Action required"}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted">
                  {dueLabel ? <span>Due {dueLabel}</span> : null}
                  {task.externalPaymentAmountMinorUnits != null && task.externalPaymentCurrency ? (
                    <span>{formatMoney(task.externalPaymentAmountMinorUnits, task.externalPaymentCurrency)} — pay the university/provider directly</span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
