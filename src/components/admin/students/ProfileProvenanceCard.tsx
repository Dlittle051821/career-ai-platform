"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/forms/Select";
import { Textarea } from "@/components/forms/Textarea";
import { FormField } from "@/components/forms/FormField";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { FormError } from "@/components/admin/FormError";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/admin/form-state";
import type { SectionProvenance } from "@/types/profile-provenance";

export interface ProfileProvenanceSectionRow {
  key: string;
  label: string;
  weight: number;
  required: boolean;
  complete: boolean;
  provenance: SectionProvenance;
}

type SetProvenanceAction = (prevState: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Milestone 11-C1 — per-section completeness (from the existing
 * src/lib/profile/completion.ts calculation, unchanged) shown alongside
 * each section's provenance. This card is entirely metadata-on-top: it
 * never shows or edits the student's actual self-reported answers — see
 * docs/admin-system-guide.md §4 ("/admin/students is deliberately
 * read-only for student-reported data").
 */
export function ProfileProvenanceCard({
  sections,
  completionPercent,
  canWrite,
  hasCounsellorId,
  action,
}: {
  sections: ProfileProvenanceSectionRow[];
  completionPercent: number;
  canWrite: boolean;
  hasCounsellorId: boolean;
  action: SetProvenanceAction;
}) {
  return (
    <Card className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-primary">Student Digital Profile</h2>
        <span className="text-sm text-muted">{completionPercent}% complete</span>
      </div>
      <p className="mt-1 text-xs text-muted">
        Self-reported by the student, section by section. A counsellor can record that they entered a section on the
        student&apos;s behalf, or verify a section&apos;s accuracy — never edit the underlying answers here.
      </p>

      <ul className="mt-4 divide-y divide-border">
        {sections.map((section) => (
          // Keyed on the provenance row's own updatedAt (not just the
          // section key) so a successful save — which changes updatedAt
          // via revalidatePath's fresh server fetch — remounts this row
          // with fresh useState defaults, closing its inline form
          // automatically without reaching for a setState-in-effect.
          <SectionRow
            key={`${section.key}:${section.provenance.updatedAt ?? "new"}`}
            section={section}
            canWrite={canWrite}
            hasCounsellorId={hasCounsellorId}
            action={action}
          />
        ))}
      </ul>
    </Card>
  );
}

function SectionRow({
  section,
  canWrite,
  hasCounsellorId,
  action,
}: {
  section: ProfileProvenanceSectionRow;
  canWrite: boolean;
  hasCounsellorId: boolean;
  action: SetProvenanceAction;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  const p = section.provenance;

  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          {section.complete ? (
            <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          ) : (
            <Circle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
          )}
          <div>
            <p className="text-sm font-medium text-text">
              {section.label}
              <span className="ml-1.5 text-xs font-normal text-muted">({section.weight}% weight)</span>
            </p>
            {p.provenance !== "SELF_ENTERED" && (
              <p className="mt-0.5 text-xs text-muted">
                {p.provenance === "COUNSELLOR_VERIFIED" && p.verifiedByCounsellorName
                  ? `Verified by ${p.verifiedByCounsellorName}${p.verifiedAt ? ` on ${new Date(p.verifiedAt).toLocaleDateString("en-IN")}` : ""}`
                  : p.updatedAt
                    ? `Last updated ${new Date(p.updatedAt).toLocaleDateString("en-IN")}`
                    : null}
                {p.note ? ` — "${p.note}"` : ""}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={p.provenance.toLowerCase()} />
          {canWrite && !editing && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
              Update
            </Button>
          )}
        </div>
      </div>

      {canWrite && editing && (
        <form action={formAction} className="mt-3 space-y-3 rounded-[var(--radius-control)] border border-border bg-surface-alt p-3.5">
          <input type="hidden" name="sectionKey" value={section.key} />
          <FormError error={state.error} />
          <FormField id={`provenance-${section.key}`} label="Provenance">
            <Select id={`provenance-${section.key}`} name="provenance" defaultValue="COUNSELLOR_ENTERED">
              <option value="COUNSELLOR_ENTERED">Entered by counsellor</option>
              {hasCounsellorId && <option value="COUNSELLOR_VERIFIED">Verified by counsellor</option>}
            </Select>
          </FormField>
          {!hasCounsellorId && (
            <p className="text-xs text-muted">
              Only signed in as a linked counsellor can a section be marked &quot;Verified&quot; — your account can still record
              &quot;Entered by counsellor&quot;.
            </p>
          )}
          <FormField id={`note-${section.key}`} label="Note" hint="Shown to other staff only, never to the student.">
            <Textarea id={`note-${section.key}`} name="note" rows={2} defaultValue={p.note ?? ""} />
          </FormField>
          <div className="flex items-center gap-2">
            <SubmitButton>Save</SubmitButton>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </li>
  );
}
