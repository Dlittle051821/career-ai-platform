"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatMoney } from "@/lib/admin/money";
import {
  APPLICATION_TASK_TYPE_LABELS,
  isApplicationTaskActionableByStudent,
  isApplicationTaskOverdue,
  type ApplicationTaskStatus,
  type ApplicationTaskType,
} from "@/lib/applications/application-tasks";
import type { MyApplicationTask } from "@/lib/supabase/education/application-tasks";
import { completeApplicationTaskAction } from "@/app/(site)/applications/actions";

/**
 * NW06 — the student's own "Action required" card on /applications/[id].
 * Every task here comes from get_my_application_tasks() (via
 * listMyApplicationTasks() server-side); this component only renders and
 * lets the student mark one done — it never invents a task, a due date, or
 * a payment amount. An external_payment task is rendered with an explicit
 * disclosure that Nextwise does not collect this fee and that marking it
 * done is a self-report Nextwise staff still verify — never styled or
 * worded like a payment form.
 */
function formatDueDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function statusBadgeTone(status: string): "neutral" | "warning" | "success" | "info" {
  if (status === "verified_complete") return "success";
  if (status === "student_completed") return "info";
  if (status === "cancelled") return "neutral";
  return "warning";
}

function statusBadgeLabel(status: string, isOverdue: boolean): string {
  switch (status) {
    case "open":
      return isOverdue ? "Overdue" : "Action required";
    case "in_progress":
      return isOverdue ? "Overdue" : "In progress";
    case "student_completed":
      return "Awaiting verification";
    case "verified_complete":
      return "Verified complete";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

export function ApplicationTasks({ applicationId, initialTasks }: { applicationId: string; initialTasks: MyApplicationTask[] }) {
  const [tasks, setTasks] = useState(initialTasks);

  const actionable = tasks.filter((t) => isApplicationTaskActionableByStudent(t.status as ApplicationTaskStatus));
  const other = tasks.filter((t) => !isApplicationTaskActionableByStudent(t.status as ApplicationTaskStatus));

  if (tasks.length === 0) {
    return <p className="text-sm text-success">Nothing is waiting on you right now.</p>;
  }

  return (
    <div className="space-y-3">
      {[...actionable, ...other].map((task) => (
        <TaskRow
          key={task.id}
          applicationId={applicationId}
          task={task}
          onComplete={(updated) => setTasks((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)))}
        />
      ))}
    </div>
  );
}

function TaskRow({
  applicationId,
  task,
  onComplete,
}: {
  applicationId: string;
  task: MyApplicationTask;
  onComplete: (partial: Partial<MyApplicationTask> & { id: string }) => void;
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const status = task.status as ApplicationTaskStatus;
  const isExternalPayment = (task.taskType as ApplicationTaskType) === "external_payment";
  const isOverdue = isApplicationTaskOverdue(status, task.dueDate);
  const canAct = isApplicationTaskActionableByStudent(status) || status === "student_completed";
  const dueLabel = formatDueDate(task.dueDate);

  function handleComplete() {
    setError(null);
    startTransition(async () => {
      const result = await completeApplicationTaskAction(applicationId, task.id, { note: note.trim() || undefined });
      if (!result.success) {
        setError(result.error ?? "We couldn't update this task. Please try again.");
        return;
      }
      onComplete({ id: task.id, status: "student_completed", studentCompletedAt: new Date().toISOString(), studentNote: note.trim() || task.studentNote });
    });
  }

  return (
    <div className="rounded-[var(--radius-card,0.75rem)] border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{APPLICATION_TASK_TYPE_LABELS[task.taskType as ApplicationTaskType] ?? task.taskType}</p>
          <p className="mt-0.5 text-sm font-medium text-text">{task.title}</p>
          {task.description ? <p className="mt-1 text-sm text-text-soft">{task.description}</p> : null}
        </div>
        <Badge tone={statusBadgeTone(status)}>{statusBadgeLabel(status, isOverdue)}</Badge>
      </div>

      {dueLabel ? <p className="mt-2 text-xs text-muted">Due {dueLabel}</p> : null}

      {isExternalPayment ? (
        <div className="mt-2 space-y-1 rounded-md bg-surface-alt px-2.5 py-2 text-xs text-text">
          {task.externalPaymentPayee ? (
            <p>
              <span className="font-semibold">Pay to:</span> {task.externalPaymentPayee}
            </p>
          ) : null}
          {task.externalPaymentAmountMinorUnits != null && task.externalPaymentCurrency ? (
            <p>
              <span className="font-semibold">Amount:</span> {formatMoney(task.externalPaymentAmountMinorUnits, task.externalPaymentCurrency)}
            </p>
          ) : null}
          {task.externalPaymentReference ? (
            <p>
              <span className="font-semibold">Reference:</span> {task.externalPaymentReference}
            </p>
          ) : null}
          {task.externalPaymentInstructions ? <p className="pt-1">{task.externalPaymentInstructions}</p> : null}
          <p className="pt-1 font-medium text-text-soft">
            Nextwise does not collect this fee. Pay the university/provider directly, using the instructions above. Marking this done only tells Nextwise
            you believe you&apos;ve paid — staff will verify it separately.
          </p>
        </div>
      ) : null}

      {status === "student_completed" ? (
        <p className="mt-2 text-xs text-muted">You marked this done. Nextwise staff will verify it.</p>
      ) : null}

      {canAct && status !== "student_completed" ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={isExternalPayment ? "Optional — add a payment reference or note" : "Optional note"}
            rows={2}
            maxLength={1000}
            className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text"
          />
          <Button type="button" size="sm" onClick={handleComplete} disabled={isPending}>
            {isPending ? "Saving…" : isExternalPayment ? "I've paid this directly" : "Mark as done"}
          </Button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-1 text-sm text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
