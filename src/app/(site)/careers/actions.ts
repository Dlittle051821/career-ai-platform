"use server";

import { revalidatePath } from "next/cache";
import { listSavedCareerIds, setCareerSaved, type SaveCareerStatus } from "@/lib/supabase/career-explorer";

/**
 * Career Explorer V5 — save or remove one career for whoever is signed in.
 * setCareerSaved() resolves the student from the session and re-checks it on
 * every call (a Server Action can be invoked directly), so this stays a thin
 * wrapper: do it, refresh /saved, and report the new total for the header.
 */
export async function toggleSaveCareerAction(careerId: string, saved: boolean): Promise<{ status: SaveCareerStatus; total: number }> {
  const result = await setCareerSaved(careerId, saved === true);
  if (result.status !== "saved" && result.status !== "removed") return { status: result.status, total: 0 };
  revalidatePath("/saved");
  const ids = await listSavedCareerIds();
  return { status: result.status, total: ids.length };
}
