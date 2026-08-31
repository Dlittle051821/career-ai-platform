"use client";

import { useActionState } from "react";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/forms/Checkbox";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { FormError } from "@/components/admin/FormError";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/admin/form-state";

type BoundCommitAction = (prevState: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * The "apply to the live database" step, only rendered while a batch's
 * status is "validated" (see [id]/page.tsx). The checkbox is a plain
 * name="confirm" value="yes" field — unchecked, nothing is submitted for
 * it — and is `required`, so the browser blocks submission until it's
 * checked. That's a UX nicety only: the real enforcement is server-side,
 * both in commitImportBatchAction (which reads formData.get("confirm"))
 * and in commitImportBatch itself, which throws unless confirm === true.
 * Stacked with ConfirmSubmitButton's own two-click confirmation, since
 * this write is irreversible from this screen.
 */
export function CommitImportForm({
  action,
  successfulRecords,
  totalRecords,
}: {
  action: BoundCommitAction;
  successfulRecords: number;
  totalRecords: number;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);

  return (
    <Card className="space-y-4 border-warning/30">
      <div>
        <h2 className="text-lg font-semibold text-primary">Confirm and apply import</h2>
        <p className="mt-1 text-sm text-muted">
          This writes {successfulRecords} of {totalRecords} validated row{totalRecords === 1 ? "" : "s"} to the live
          database. Rows still showing an error are always skipped; rows flagged as duplicates for review are left
          untouched for an admin to resolve manually.
        </p>
      </div>
      <form action={formAction} className="space-y-4">
        <FormError error={state.error} />
        <p className="rounded-[var(--radius-control)] border border-warning/30 bg-warning-light px-3.5 py-2.5 text-xs text-warning">
          This is a real write to the live database, not another preview. Review the row results below before
          confirming — this cannot be undone from this screen.
        </p>
        <Checkbox id="confirm-apply" name="confirm" value="yes" required label="I understand this will write to the live database." />
        <ConfirmSubmitButton confirmLabel="Click again to apply import" savingLabel="Applying import…">
          Confirm and apply import
        </ConfirmSubmitButton>
      </form>
    </Card>
  );
}
