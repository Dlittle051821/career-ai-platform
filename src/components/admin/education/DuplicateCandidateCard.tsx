"use client";

import { useActionState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { FormField } from "@/components/forms/FormField";
import { Textarea } from "@/components/forms/Textarea";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { FormError } from "@/components/admin/FormError";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/admin/form-state";
import type { EducationDuplicateCandidate } from "@/types/education";

type BoundResolveAction = (prevState: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * One pending duplicate candidate: the two entities side by side, the
 * match score and per-field signals that produced it, and two independent
 * resolution forms (reject / merge) — kept as two separate <form>s rather
 * than one form with two submit buttons, per the task's "simplest" option.
 * `onReject`/`onMerge` arrive already bound to this candidate's id (see
 * PublicationWorkflowCard for the same bound-action-as-prop pattern).
 */
export function DuplicateCandidateCard({
  candidate,
  onReject,
  onMerge,
}: {
  candidate: EducationDuplicateCandidate;
  onReject: BoundResolveAction;
  onMerge: BoundResolveAction;
}) {
  const [rejectState, rejectAction] = useActionState(onReject, INITIAL_ACTION_STATE);
  const [mergeState, mergeAction] = useActionState(onMerge, INITIAL_ACTION_STATE);

  const primaryLabel = candidate.primaryEntityName ?? candidate.primaryEntityId;
  const candidateLabel = candidate.candidateEntityName ?? candidate.candidateEntityId;
  const matchPercent = Math.round(candidate.matchScore * 100);

  return (
    <Card className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge tone="accent">{candidate.entityType === "university" ? "University" : "Course"}</Badge>
        <Badge tone={matchPercent >= 90 ? "error" : "warning"}>{matchPercent}% match</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-[var(--radius-control)] border border-border p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Primary</p>
          <p className="mt-1 font-medium text-text">{primaryLabel}</p>
        </div>
        <div className="rounded-[var(--radius-control)] border border-border p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Candidate</p>
          <p className="mt-1 font-medium text-text">{candidateLabel}</p>
        </div>
      </div>

      {candidate.matchSignals.length > 0 ? (
        <div className="overflow-x-auto rounded-[var(--radius-control)] border border-border">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-alt text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <th scope="col" className="px-3 py-2">Field</th>
                <th scope="col" className="px-3 py-2">Primary value</th>
                <th scope="col" className="px-3 py-2">Candidate value</th>
                <th scope="col" className="px-3 py-2">Weight</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              {candidate.matchSignals.map((signal, i) => (
                <tr key={`${signal.field}-${i}`}>
                  <td className="px-3 py-2 font-medium text-text">{signal.field}</td>
                  <td className="px-3 py-2 text-text-soft">{signal.primaryValue ?? "—"}</td>
                  <td className="px-3 py-2 text-text-soft">{signal.candidateValue ?? "—"}</td>
                  <td className="px-3 py-2 text-text-soft">{signal.weight}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="grid gap-6 border-t border-border pt-5 sm:grid-cols-2">
        <form action={mergeAction} className="space-y-3">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-text-soft">Merge — which record survives?</legend>
            <label className="flex items-center gap-2 text-sm text-text-soft">
              <input
                type="radio"
                name="survivorEntityId"
                value={candidate.primaryEntityId}
                defaultChecked
                className="h-4 w-4 shrink-0 accent-secondary"
              />
              Keep &ldquo;{primaryLabel}&rdquo;
            </label>
            <label className="flex items-center gap-2 text-sm text-text-soft">
              <input
                type="radio"
                name="survivorEntityId"
                value={candidate.candidateEntityId}
                className="h-4 w-4 shrink-0 accent-secondary"
              />
              Keep &ldquo;{candidateLabel}&rdquo;
            </label>
          </fieldset>
          <FormField id={`merge-notes-${candidate.id}`} label="Notes">
            <Textarea id={`merge-notes-${candidate.id}`} name="notes" rows={2} placeholder="Optional — recorded with the resolution" />
          </FormField>
          <FormError error={mergeState.error} />
          <SubmitButton savingLabel="Merging…">Merge</SubmitButton>
        </form>

        <form action={rejectAction} className="space-y-3">
          <p className="text-sm font-medium text-text-soft">Not a duplicate</p>
          <FormField id={`reject-notes-${candidate.id}`} label="Notes">
            <Textarea id={`reject-notes-${candidate.id}`} name="notes" rows={2} placeholder="Optional — recorded with the resolution" />
          </FormField>
          <FormError error={rejectState.error} />
          <SubmitButton savingLabel="Rejecting…">Reject as not a duplicate</SubmitButton>
        </form>
      </div>
    </Card>
  );
}
