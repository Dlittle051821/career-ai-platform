"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { commitImportBatch, validateImportBatch } from "@/lib/supabase/admin/education-imports";
import { friendlyAdminError, type ActionState } from "@/lib/admin/form-state";
import { IMPORT_DUPLICATE_STRATEGIES, IMPORT_ENTITY_TYPES, type ImportDuplicateStrategy, type ImportEntityType } from "@/types/education";

/**
 * Step 1 of the import pipeline (see src/lib/supabase/admin/education-imports.ts
 * for the full two-step design): reads the uploaded file straight out of
 * FormData, turns it into text server-side, and hands it to
 * validateImportBatch — which parses/validates the CSV and writes per-row
 * results but never touches universities/courses/etc. On success this
 * redirects to the batch's detail page, which is where the actual "confirm
 * and apply" step (commitImportBatchAction below) lives.
 */
export async function createImportBatchAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const entityTypeRaw = String(formData.get("entityType") ?? "");
  const duplicateStrategyRaw = String(formData.get("duplicateStrategy") ?? "");
  const file = formData.get("file");

  if (!(IMPORT_ENTITY_TYPES as readonly string[]).includes(entityTypeRaw)) {
    return { error: "Choose what kind of data this file contains." };
  }
  if (!(IMPORT_DUPLICATE_STRATEGIES as readonly string[]).includes(duplicateStrategyRaw)) {
    return { error: "Choose how duplicate records should be handled." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a CSV file to upload." };
  }
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return { error: "Please upload a .csv file." };
  }

  let csvText: string;
  try {
    csvText = await file.text();
  } catch {
    return { error: "The file could not be read. Please try again." };
  }

  let batchId: string;
  try {
    const result = await validateImportBatch({
      entityType: entityTypeRaw as ImportEntityType,
      fileName: file.name,
      csvText,
      duplicateStrategy: duplicateStrategyRaw as ImportDuplicateStrategy,
    });
    batchId = result.batchId;
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }

  revalidatePath("/admin/education/imports");
  redirect(`/admin/education/imports/${batchId}`);
}

/**
 * Step 2: applies a previously-validated batch. Stays on the batch detail
 * page (no redirect) so the admin sees the updated status/counts in place —
 * same "workflow action, no redirect" pattern as
 * src/app/admin/universities/actions.ts's publish/archive actions. The
 * "confirm" field is a plain "yes"/absent string built client-side by
 * CommitImportForm from a required checkbox; commitImportBatch itself
 * still enforces confirm === true server-side regardless of what the UI
 * sends.
 */
export async function commitImportBatchAction(batchId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const confirmed = formData.get("confirm") === "yes";
  try {
    await commitImportBatch(batchId, confirmed);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/education/imports");
  revalidatePath(`/admin/education/imports/${batchId}`);
  return { error: null };
}
