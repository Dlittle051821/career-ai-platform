"use client";

import { useActionState, useState } from "react";
import { FormField } from "@/components/forms/FormField";
import { Select } from "@/components/forms/Select";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { FormError } from "@/components/admin/FormError";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/admin/form-state";
import {
  IMPORT_DUPLICATE_STRATEGY_HINTS,
  IMPORT_DUPLICATE_STRATEGY_LABELS,
  IMPORT_ENTITY_TYPE_LABELS,
} from "@/lib/admin/education-import-labels";
import { IMPORT_DUPLICATE_STRATEGIES, IMPORT_ENTITY_TYPES, type ImportDuplicateStrategy } from "@/types/education";

/**
 * Upload form for step 1 of the import pipeline (see
 * src/app/admin/education/imports/actions.ts's createImportBatchAction).
 * The file itself is never parsed in the browser — it's posted as-is
 * inside the form's FormData and the Server Action calls `.text()` on it
 * server-side before handing the CSV text to validateImportBatch. The
 * `.csv` extension check here is a client-side nicety only; the real
 * validation (headers, encoding, row-level parsing) all happens server-side.
 */
export function ImportUploadForm({
  action,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  const [duplicateStrategy, setDuplicateStrategy] = useState<ImportDuplicateStrategy>("review");
  const [fileError, setFileError] = useState<string | null>(null);

  return (
    <form action={formAction} className="space-y-5" encType="multipart/form-data">
      <FormError error={state.error} />

      <FormField id="entityType" label="Data type" required hint="What kind of records this CSV contains.">
        <Select id="entityType" name="entityType" required defaultValue="">
          <option value="" disabled>
            Select a data type
          </option>
          {IMPORT_ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {IMPORT_ENTITY_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField id="duplicateStrategy" label="Duplicate handling" required hint={IMPORT_DUPLICATE_STRATEGY_HINTS[duplicateStrategy]}>
        <Select
          id="duplicateStrategy"
          name="duplicateStrategy"
          required
          value={duplicateStrategy}
          onChange={(e) => setDuplicateStrategy(e.target.value as ImportDuplicateStrategy)}
        >
          {IMPORT_DUPLICATE_STRATEGIES.map((s) => (
            <option key={s} value={s}>
              {IMPORT_DUPLICATE_STRATEGY_LABELS[s]}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField id="file" label="CSV file" required hint="Must be a .csv file, up to 10MB. See docs/import-templates/ in the repo for the expected columns per data type." error={fileError ?? undefined}>
        <input
          id="file"
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
          onChange={(e) => {
            const file = e.target.files?.[0];
            setFileError(file && !file.name.toLowerCase().endsWith(".csv") ? "Please choose a .csv file." : null);
          }}
          className="block w-full rounded-[var(--radius-control)] border border-border-strong bg-surface px-3.5 py-2.5 text-[15px] text-text file:mr-4 file:rounded-[var(--radius-control)] file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
        />
      </FormField>

      <p className="text-xs text-muted">
        This only reads the file you choose here — it never fetches data from the web. Uploading validates and
        previews the file; nothing is written to universities, courses, or any other live record until you review
        the results and explicitly confirm the import on the next screen.
      </p>

      <SubmitButton savingLabel="Validating…">Upload and validate</SubmitButton>
    </form>
  );
}
