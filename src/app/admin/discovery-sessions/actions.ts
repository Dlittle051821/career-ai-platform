"use server";

import { revalidatePath } from "next/cache";
import { updateDiscoverySession } from "@/lib/supabase/admin/discovery-sessions";
import { friendlyAdminError, type ActionState } from "@/lib/admin/form-state";

export async function updateDiscoverySessionAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await updateDiscoverySession(id, formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/discovery-sessions");
  revalidatePath(`/admin/discovery-sessions/${id}`);
  return { error: null };
}
