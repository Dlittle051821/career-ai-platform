"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createCourse, updateCourse } from "@/lib/supabase/admin/courses";
import { friendlyAdminError, type ActionState } from "@/lib/admin/form-state";

export async function createCourseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let id: string;
  try {
    id = await createCourse(formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/courses");
  redirect(`/admin/courses/${id}`);
}

export async function updateCourseAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await updateCourse(id, formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${id}`);
  redirect(`/admin/courses/${id}`);
}
