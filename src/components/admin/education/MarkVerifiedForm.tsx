"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { FormError } from "@/components/admin/FormError";
import { INITIAL_ACTION_STATE } from "@/lib/admin/form-state";
import { markProvenanceVerifiedAction } from "@/app/admin/education/sources/actions";
import type { EducationDataProvenance } from "@/types/education";

/**
 * Per-row "mark verified" quick action on the sources list. Round-trips
 * every existing field of the record as hidden inputs (upsertProvenanceRecord
 * replaces the whole row, see its docblock on
 * src/lib/supabase/admin/education-sources.ts) and only overrides
 * verificationStatus and lastVerifiedAt — so this never quietly clears a
 * source URL, provider, or import batch link an import already set. Only
 * ever fires when the record is not already verified, and only ever sets
 * verificationStatus to "verified" — it never fabricates any other claim.
 */
export function MarkVerifiedForm({ record }: { record: EducationDataProvenance }) {
  const [state, formAction] = useActionState(markProvenanceVerifiedAction, INITIAL_ACTION_STATE);

  if (record.verificationStatus === "verified") {
    return <span className="text-xs text-muted">—</span>;
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <input type="hidden" name="entityType" value={record.entityType} />
      <input type="hidden" name="entityId" value={record.entityId} />
      <input type="hidden" name="sourceProvider" value={record.sourceProvider ?? ""} />
      <input type="hidden" name="sourceType" value={record.sourceType} />
      <input type="hidden" name="sourceUrl" value={record.sourceUrl ?? ""} />
      <input type="hidden" name="sourceRecordId" value={record.sourceRecordId ?? ""} />
      <input type="hidden" name="retrievedAt" value={record.retrievedAt ?? ""} />
      <input type="hidden" name="lastVerifiedAt" value={today} />
      <input type="hidden" name="verificationStatus" value="verified" />
      <input type="hidden" name="dataQualityStatus" value={record.dataQualityStatus} />
      <SubmitButton savingLabel="Marking…">Mark verified</SubmitButton>
      <FormError error={state.error} />
    </form>
  );
}
