"use server";

import { revalidatePath } from "next/cache";
import { setDiscoverySessionAssignmentApproval, updateDiscoverySession } from "@/lib/supabase/admin/discovery-sessions";
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

/** CC-25 — approve or revoke the current counsellor assignment (admins only; enforced in the database). */
export async function setAssignmentApprovalAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const counsellorId = String(formData.get("counsellorId") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim();
  if (decision !== "approve" && decision !== "revoke") return { error: "Choose approve or revoke." };
  try {
    await setDiscoverySessionAssignmentApproval(id, counsellorId, decision === "approve");
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/discovery-sessions");
  revalidatePath(`/admin/discovery-sessions/${id}`);
  return { error: null };
}
