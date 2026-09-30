"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/forms/Input";
import { Select } from "@/components/forms/Select";
import { Textarea } from "@/components/forms/Textarea";
import { Badge } from "@/components/ui/Badge";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { FormError } from "@/components/admin/FormError";
import { INITIAL_ACTION_STATE } from "@/lib/admin/form-state";
import { recordApplicationSubmissionAction } from "@/app/admin/applications/actions";
import { APPLICATION_SUBMISSION_METHODS, APPLICATION_SUBMISSION_METHOD_LABELS } from "@/lib/applications/application-submission";
import type { ApplicationSubmissionReadiness } from "@/lib/applications/application-submission";
import type { ApplicationReadinessBlocker } from "@/lib/applications/application-readiness";
import type { ApplicationSubmission } from "@/types/admin";
import { APPLICATION_DOCUMENT_TYPE_LABELS, type ApplicationDocumentType } from "@/lib/applications/application-documents";

export interface AdminApplicationSubmissionPanelDocument {
  documentType: ApplicationDocumentType | string;
  originalFilename: string;
}

/**
 * Milestone 19 — the "Submission preparation" section on
 * /admin/applications/[id]. Organized exactly per the task's own recommended
 * structure: readiness -> pack preview -> record-submission form (only when
 * eligible and not yet submitted) -> submission details/history (once
 * recorded).
 *
 * The button and every piece of copy here deliberately say "Record" —
 * never "Submit" — because Nextwise never submits anything to a university
 * itself (task's own explicit instruction: "must never imply Nextwise
 * automatically submitted something when staff only marked preparation
 * complete"). This form only exists to let staff record that they ALREADY
 * performed a manual external submission.
 */
export function AdminApplicationSubmissionPanel({
  applicationId,
  canWrite,
  readiness,
  underlyingBlockers,
  documentPack,
  existingSubmission,
  submissionDocuments,
}: {
  applicationId: string;
  canWrite: boolean;
  readiness: ApplicationSubmissionReadiness;
  underlyingBlockers: ApplicationReadinessBlocker[];
  documentPack: AdminApplicationSubmissionPanelDocument[];
  existingSubmission: ApplicationSubmission | null;
  submissionDocuments: AdminApplicationSubmissionPanelDocument[];
}) {
  const boundAction = recordApplicationSubmissionAction.bind(null, applicationId);
  const [state, formAction] = useActionState(boundAction, INITIAL_ACTION_STATE);

  if (existingSubmission) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="success">Recorded submitted</Badge>
          <span className="text-xs text-muted">{new Date(existingSubmission.submittedAt).toLocaleString("en-IN")}</span>
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Method</dt>
            <dd className="mt-0.5 text-text">{APPLICATION_SUBMISSION_METHOD_LABELS[existingSubmission.submissionMethod as keyof typeof APPLICATION_SUBMISSION_METHOD_LABELS] ?? existingSubmission.submissionMethod}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Platform / portal</dt>
            <dd className="mt-0.5 text-text">{existingSubmission.platformName ?? "Not specified"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Application reference</dt>
            <dd className="mt-0.5 text-text">{existingSubmission.externalReference ?? "Not yet added"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Recorded by</dt>
            <dd className="mt-0.5 text-text">{existingSubmission.submittedByName ?? "Unknown staff member"}</dd>
          </div>
          {existingSubmission.externalUrl ? (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">Submission URL</dt>
              <dd className="mt-0.5 break-all text-text">{existingSubmission.externalUrl}</dd>
            </div>
          ) : null}
          {existingSubmission.internalNote ? (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">Internal note (staff only)</dt>
              <dd className="mt-0.5 whitespace-pre-wrap rounded-md bg-surface-alt px-2 py-1.5 text-xs text-text-soft">{existingSubmission.internalNote}</dd>
            </div>
          ) : null}
        </dl>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Documents included in this submission</p>
          {submissionDocuments.length === 0 ? (
            <p className="mt-1 text-sm text-muted">No document snapshot recorded.</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {submissionDocuments.map((d) => (
                <li key={d.originalFilename + d.documentType} className="text-sm text-text-soft">
                  {APPLICATION_DOCUMENT_TYPE_LABELS[d.documentType as ApplicationDocumentType] ?? d.documentType} — {d.originalFilename}
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="text-xs text-muted">
          This record reflects the documents and details captured at the moment of submission — it will not change even if the student later replaces a
          document.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={readiness.isReady ? "success" : "warning"}>{readiness.isReady ? "Ready for external submission" : "Not yet ready"}</Badge>
      </div>

      {!readiness.isReady ? (
        <ul className="space-y-1 text-xs text-muted">
          {readiness.blockers.map((b) => (
            <li key={b.reason}>• {b.message}</li>
          ))}
          {underlyingBlockers.map((b) => (
            <li key={`m18-${b.reason}`}>• {b.message}</li>
          ))}
        </ul>
      ) : null}

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Documents that will be included</p>
        {documentPack.length === 0 ? (
          <p className="mt-1 text-sm text-muted">No accepted documents yet.</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {documentPack.map((d) => (
              <li key={d.originalFilename + d.documentType} className="text-sm text-text-soft">
                {APPLICATION_DOCUMENT_TYPE_LABELS[d.documentType as ApplicationDocumentType] ?? d.documentType} — {d.originalFilename}
              </li>
            ))}
          </ul>
        )}
      </div>

      {canWrite && readiness.isReady ? (
        <form action={formAction} className="space-y-4 border-t border-border pt-4">
          <FormError error={state.error} />
          <p className="text-sm text-text-soft">
            Use this only after the application has ALREADY been submitted to the university/platform outside Nextwise. This records that manual action —
            it does not submit anything itself.
          </p>
          <FormField id="submissionMethod" label="Submission method" required>
            <Select id="submissionMethod" name="submissionMethod" required defaultValue="">
              <option value="" disabled>
                — Choose a method —
              </option>
              {APPLICATION_SUBMISSION_METHODS.map((method) => (
                <option key={method} value={method}>
                  {APPLICATION_SUBMISSION_METHOD_LABELS[method]}
                </option>
              ))}
            </Select>
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="platformName" label="Platform / portal name">
              <Input id="platformName" name="platformName" maxLength={200} placeholder="e.g. Common App" />
            </FormField>
            <FormField id="externalReference" label="Application reference">
              <Input id="externalReference" name="externalReference" maxLength={200} placeholder="e.g. APP-2026-00123" />
            </FormField>
          </div>
          <FormField id="externalUrl" label="Submission URL" hint="A link to the submitted application, if useful. Never a page requiring login credentials to be stored here.">
            <Input id="externalUrl" name="externalUrl" type="url" maxLength={500} placeholder="https://" />
          </FormField>
          <FormField id="internalNote" label="Internal note (staff only)" hint="Never visible to the student. Never store portal passwords or credentials here.">
            <Textarea id="internalNote" name="internalNote" rows={3} maxLength={2000} />
          </FormField>
          <SubmitButton savingLabel="Recording…">Record submitted application</SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
