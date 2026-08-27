"use server";

import { revalidatePath } from "next/cache";
import { updateStudentMeta, addStudentNote } from "@/lib/supabase/admin/students";
import { friendlyAdminError, type ActionState } from "@/lib/admin/form-state";
import type { AdminStudentStatus } from "@/types/admin";

export async function updateStudentStatusAction(studentUserId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const status = String(formData.get("status") ?? "") as AdminStudentStatus;
  try {
    await updateStudentMeta(studentUserId, { status });
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath(`/admin/students/${studentUserId}`);
  revalidatePath("/admin/students");
  return { error: null };
}

export async function assignCounsellorAction(studentUserId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = String(formData.get("assignedCounsellorId") ?? "").trim();
  try {
    await updateStudentMeta(studentUserId, { assignedCounsellorId: raw || null });
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath(`/admin/students/${studentUserId}`);
  revalidatePath("/admin/students");
  return { error: null };
}

export async function addStudentNoteAction(studentUserId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await addStudentNote(studentUserId, formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath(`/admin/students/${studentUserId}`);
  return { error: null };
}
