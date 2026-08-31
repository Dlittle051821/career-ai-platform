"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { FormError } from "@/components/admin/FormError";
import type { ScanActionState } from "@/app/admin/education/duplicates/actions";

type BoundScanAction = (prevState: ScanActionState, formData: FormData) => Promise<ScanActionState>;

const INITIAL_SCAN_STATE: ScanActionState = { error: null };

/**
 * One "Scan for duplicates" button, bound to a specific entity type by the
 * page. Stays on the page (no redirect) and reports the new-candidate
 * count inline — same "return { error: null, ...extra }" shape as
 * PublicationWorkflowCard's WorkflowActionForm, extended with a success
 * message.
 */
export function DuplicateScanForm({ action, label }: { action: BoundScanAction; label: string }) {
  const [state, formAction] = useActionState(action, INITIAL_SCAN_STATE);
  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <SubmitButton savingLabel="Scanning…">{label}</SubmitButton>
      <FormError error={state.error} />
      {!state.error && state.message ? <p className="text-sm text-success">{state.message}</p> : null}
    </form>
  );
}
