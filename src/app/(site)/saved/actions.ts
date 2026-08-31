"use server";

import { revalidatePath } from "next/cache";
import { removeSavedItem } from "@/lib/supabase/education/saved-items";
import type { SavedItemEntityType } from "@/types/education";

/**
 * Removes one saved university/course for the currently logged-in student.
 * Bound with `.bind(null, entityType, entityId)` to a plain `<form
 * action={...}>` per item (see RemoveSavedButton.tsx) — mirrors the
 * bound-server-action-per-row pattern used throughout src/app/admin (e.g.
 * DuplicateCandidateCard's onReject/onMerge). removeSavedItem() already
 * re-checks auth and is idempotent (see saved-items.ts's docblock), so this
 * stays a thin wrapper: perform the removal, then revalidate /saved so the
 * list reflects it immediately.
 */
export async function removeSavedItemAction(entityType: SavedItemEntityType, entityId: string): Promise<void> {
  await removeSavedItem(entityType, entityId);
  revalidatePath("/saved");
}
