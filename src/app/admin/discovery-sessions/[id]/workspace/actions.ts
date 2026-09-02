"use server";

import { revalidatePath } from "next/cache";
import { saveDiscoverySessionWorkspace } from "@/lib/supabase/admin/discovery-session-workspace";
import { getDiscoverySessionById } from "@/lib/supabase/admin/discovery-sessions";
import { friendlyAdminError, type ActionState } from "@/lib/admin/form-state";
import { AdminValidationError } from "@/lib/admin/form-state";

export async function saveDiscoverySessionWorkspaceAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const session = await getDiscoverySessionById(id);
    if (!session) throw new AdminValidationError("Discovery Session not found.");
    await saveDiscoverySessionWorkspace(id, session.status, formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath(`/admin/discovery-sessions/${id}`);
  revalidatePath(`/admin/discovery-sessions/${id}/workspace`);
  return { error: null };
}
