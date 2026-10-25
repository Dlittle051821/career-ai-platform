"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/forms/Input";
import { Textarea } from "@/components/forms/Textarea";
import { Select } from "@/components/forms/Select";
import { FormField } from "@/components/forms/FormField";
import { formatMoney } from "@/lib/admin/money";
import {
  APPLICATION_TASK_TYPES,
  APPLICATION_TASK_TYPE_LABELS,
  getAllowedStaffTaskTransitions,
  APPLICATION_TASK_STATUS_LABELS,
  type ApplicationTaskStatus,
  type ApplicationTaskType,
} from "@/lib/applications/application-tasks";
import type { AdminApplicationTask } from "@/lib/supabase/admin/application-tasks";
import { createApplicationTaskAction, updateApplicationTaskStatusAction } from "@/app/admin/applications/actions";

/**
 * NW06 — the staff-side task management panel on
 * /admin/applications/[id] (mirrors AdminApplicationChecklist.tsx/
 * AdminApplicationNotes.tsx's own "list + a small mutation form, backed by
 * one Server Action per mutation" shape). Renders staff_note (internal) —
 * never rendered on the student-facing ApplicationTasks.tsx equivalent.
 */
function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function statusTone(status: string): "neutral" | "warning" | "success" | "info" {
  if (status === "verified_complete") return "success";
  if (status === "student_completed") return "info";
  if (status === "cancelled") return "neutral";
  return "warning";
}

export function AdminApplicationTasks({ applicationId, initialTasks }: { applicationId: string; initialTasks: AdminApplicationTask[] }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-4">
      {tasks.length === 0 ? (
        <p className="text-sm text-muted">No tasks created yet.</p>
      ) : (
        <ul className="space-y-3">
          {tasks.map((task) => (
            <AdminTaskRow
              key={task.id}
              applicationId={applicationId}
              task={task}
              onUpdated={(partial) => setTasks((prev) => prev.map((t) => (t.id === partial.id ? { ...t, ...partial } : t)))}
            />
          ))}
        </ul>
      )}

      {showForm ? (
        <NewTaskForm
          applicationId={applicationId}
          onCreated={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(true)}>
          New task
        </Button>
      )}
    </div>
  );
}

function AdminTaskRow({
  applicationId,
  task,
  onUpdated,
}: {
  applicationId: string;
  task: AdminApplicationTask;
  onUpdated: (partial: Partial<AdminApplicationTask> & { id: string }) => void;
}) {
  const [staffNote, setStaffNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const allowed = getAllowedStaffTaskTransitions(task.status as ApplicationTaskStatus);

  function handleTransition(nextStatus: ApplicationTaskStatus) {
    setError(null);
    startTransition(async () => {
      const result = await updateApplicationTaskStatusAction(applicationId, task.id, nextStatus, staffNote.trim() || undefined);
      if (!result.success) {
        setError(result.error ?? "We couldn't update this task. Please try again.");
        return;
      }
      onUpdated({ id: task.id, status: nextStatus });
      setStaffNote("");
    });
  }

  return (
    <li className="border-t border-border pt-3 first:border-0 first:pt-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            {APPLICATION_TASK_TYPE_LABELS[task.taskType as ApplicationTaskType] ?? task.taskType}
          </p>
          <p className="mt-0.5 text-sm font-medium text-text">{task.title}</p>
          {task.description ? <p className="mt-1 text-sm text-text-soft">{task.description}</p> : null}
        </div>
        <Badge tone={statusTone(task.status)}>{APPLICATION_TASK_STATUS_LABELS[task.status as ApplicationTaskStatus] ?? task.status}</Badge>
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted sm:grid-cols-4">
        <div>
          <dt className="font-medium">Due</dt>
          <dd>{formatDate(task.dueDate)}</dd>
        </div>
        <div>
          <dt className="font-medium">Created</dt>
          <dd>{formatDate(task.createdAt)}</dd>
        </div>
        {task.verifiedAt ? (
          <div>
            <dt className="font-medium">Verified</dt>
            <dd>{formatDate(task.verifiedAt)}</dd>
          </div>
        ) : null}
        {task.cancelledAt ? (
          <div>
            <dt className="font-medium">Cancelled</dt>
            <dd>{formatDate(task.cancelledAt)}</dd>
          </div>
        ) : null}
      </dl>

      {task.taskType === "external_payment" && task.externalPaymentAmountMinorUnits != null && task.externalPaymentCurrency ? (
        <p className="mt-1 text-xs text-muted">
          {task.externalPaymentPayee ? `${task.externalPaymentPayee} — ` : ""}
          {formatMoney(task.externalPaymentAmountMinorUnits, task.externalPaymentCurrency)}
        </p>
      ) : null}

      {task.studentNote ? (
        <p className="mt-2 rounded-md bg-surface-alt px-2 py-1.5 text-xs text-text">
          <span className="font-semibold">Student note:</span> {task.studentNote}
        </p>
      ) : null}
      {task.staffNote ? (
        <p className="mt-1 rounded-md bg-accent-light px-2 py-1.5 text-xs text-text">
          <span className="font-semibold">Internal note:</span> {task.staffNote}
        </p>
      ) : null}

      {allowed.length > 0 ? (
        <div className="mt-3 space-y-2">
          <Textarea
            value={staffNote}
            onChange={(e) => setStaffNote(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="Optional internal note — never shown to the student"
          />
          <div className="flex flex-wrap gap-2">
            {allowed.map((next) => (
              <Button key={next} type="button" size="sm" variant={next === "cancelled" ? "destructive" : "outline"} onClick={() => handleTransition(next)} disabled={isPending}>
                {next === "verified_complete" ? "Verify complete" : next === "cancelled" ? "Cancel task" : `Move to ${APPLICATION_TASK_STATUS_LABELS[next]}`}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-1 text-sm text-error">
          {error}
        </p>
      ) : null}
    </li>
  );
}

function NewTaskForm({ applicationId, onCreated, onCancel }: { applicationId: string; onCreated: () => void; onCancel: () => void }) {
  const [taskType, setTaskType] = useState<ApplicationTaskType>("information_request");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const isExternalPayment = taskType === "external_payment";

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createApplicationTaskAction(applicationId, formData);
      if (!result.success) {
        setError(result.error ?? "We couldn't create this task. Please try again.");
        return;
      }
      formRef.current?.reset();
      onCreated();
    });
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="space-y-3 rounded-[var(--radius-card,0.75rem)] border border-border p-3"
    >
      <FormField id="taskType" label="Task type">
        <Select id="taskType" name="taskType" value={taskType} onChange={(e) => setTaskType(e.target.value as ApplicationTaskType)}>
          {APPLICATION_TASK_TYPES.map((type) => (
            <option key={type} value={type}>
              {APPLICATION_TASK_TYPE_LABELS[type]}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField id="title" label="Title">
        <Input id="title" name="title" required maxLength={200} />
      </FormField>
      <FormField id="description" label="Description (shown to the student)">
        <Textarea id="description" name="description" rows={2} maxLength={2000} />
      </FormField>
      <FormField id="dueDate" label="Due date (optional)">
        <Input id="dueDate" name="dueDate" type="date" />
      </FormField>

      {isExternalPayment ? (
        <div className="space-y-3 rounded-md bg-surface-alt p-3">
          <p className="text-xs text-muted">
            Nextwise does not collect this fee. These instructions are shown to the student as information only — never a Nextwise payment flow.
          </p>
          <FormField id="externalPaymentPayee" label="Pay to (required)">
            <Input id="externalPaymentPayee" name="externalPaymentPayee" required maxLength={200} placeholder="e.g. University of X — Admissions Office" />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField id="externalPaymentAmountMajor" label="Amount (optional)">
              <Input id="externalPaymentAmountMajor" name="externalPaymentAmountMajor" type="number" step="0.01" min="0" />
            </FormField>
            <FormField id="externalPaymentCurrency" label="Currency (optional)">
              <Input id="externalPaymentCurrency" name="externalPaymentCurrency" maxLength={3} placeholder="EUR" />
            </FormField>
          </div>
          <FormField id="externalPaymentInstructions" label="Payment instructions (required)">
            <Textarea
              id="externalPaymentInstructions"
              name="externalPaymentInstructions"
              rows={3}
              required
              maxLength={2000}
              placeholder="Where/how the student pays the university directly — e.g. a link to the university's own payment portal."
            />
          </FormField>
          <FormField id="externalPaymentReference" label="Reference (optional)">
            <Input id="externalPaymentReference" name="externalPaymentReference" maxLength={200} />
          </FormField>
        </div>
      ) : (
        <FormField id="relatedDocumentType" label="Related document type (optional)">
          <Input id="relatedDocumentType" name="relatedDocumentType" placeholder="e.g. financial_document" />
        </FormField>
      )}

      {error ? (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Creating…" : "Create task"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
