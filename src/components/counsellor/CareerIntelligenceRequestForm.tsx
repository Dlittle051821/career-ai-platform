"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormField } from "@/components/forms/FormField";
import { Select } from "@/components/forms/Select";
import { Textarea } from "@/components/forms/Textarea";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { FormError } from "@/components/admin/FormError";
import { INITIAL_CAREER_ANALYSIS_STATE, type CareerAnalysisActionState } from "@/lib/career-intelligence/messages";

/**
 * NW09 — the counsellor's "prepare an AI-assisted first draft" form.
 *
 * Carries no data except a server-generated idempotency key and (for a
 * regeneration) the previous analysis and a reason. NW09.2: there is no
 * consent checkbox any more — consent must be RECORDED in the consent
 * register, and the server reads it from there. The button is rendered only
 * when every gate passes (disabledReason is null), disables itself while the
 * request is pending, and the server-side idempotency key plus the
 * database's one-analysis-in-progress rule stop duplicate paid requests. Everything else — who the caller is, whether they may see this
 * student, the provider, limits — is decided on the server. No API key,
 * provider name or model output ever reaches this component.
 */
export function CareerIntelligenceRequestForm({
  action,
  idempotencyKey,
  previousRuns,
  disabledReason,
  submitLabel = "Prepare AI-assisted first draft",
  pendingLabel = "Preparing draft…",
  paidNote = null,
}: {
  action: (prev: CareerAnalysisActionState, formData: FormData) => Promise<CareerAnalysisActionState>;
  idempotencyKey: string;
  /** Successful earlier analyses that may be regenerated (newest first). */
  previousRuns: Array<{ id: string; label: string }>;
  /** When set, the button is disabled and this explains why. */
  disabledReason: string | null;
  submitLabel?: string;
  pendingLabel?: string;
  /** Shown under the button when the request is billed (paid provider). */
  paidNote?: string | null;
}) {
  const [state, formAction] = useActionState(action, INITIAL_CAREER_ANALYSIS_STATE);
  return (
    <form action={formAction} className="space-y-4">
      <FormError error={state.error} />
      {state.notice ? (
        <p role="status" className="rounded-md border border-success/25 bg-success-light px-3 py-2 text-sm text-success">
          {state.notice}{" "}
          {state.draftId ? (
            <Link href={`/counsellor/recommendations/${state.draftId}`} className="font-semibold underline">
              Open the draft
            </Link>
          ) : null}
        </p>
      ) : null}
      {state.followUpQuestions.length > 0 ? (
        <div className="rounded-md border border-border px-3 py-2 text-sm text-text-soft">
          <p className="font-medium text-text">Questions to ask the student first</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {state.followUpQuestions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      {previousRuns.length > 0 ? (
        <>
          <FormField id="regeneratesRunId" label="Replace an earlier analysis (optional)" hint="Choose one only if the earlier draft was not useful. A reason is required and recorded.">
            <Select id="regeneratesRunId" name="regeneratesRunId" defaultValue="">
              <option value="">— New analysis —</option>
              {previousRuns.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="regenerationReason" label="Reason for regenerating" hint="Required when replacing an earlier analysis (10–500 characters).">
            <Textarea id="regenerationReason" name="regenerationReason" rows={2} maxLength={500} />
          </FormField>
        </>
      ) : null}


      {disabledReason ? <p className="text-sm text-muted">{disabledReason}</p> : null}
      {disabledReason ? null : <SubmitButton savingLabel={pendingLabel}>{submitLabel}</SubmitButton>}
      {disabledReason || !paidNote ? null : <p className="text-xs text-muted">{paidNote}</p>}
    </form>
  );
}
