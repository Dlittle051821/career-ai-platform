"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { updateBillingSettings } from "@/lib/supabase/admin/billing-settings";
import { friendlyAdminError, type ActionState } from "@/lib/admin/form-state";

export async function updateBillingSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await updateBillingSettings(formData);
  } catch (error) {
    return { error: friendlyAdminError(error) };
  }
  revalidatePath("/admin/billing-settings");
  redirect("/admin/billing-settings?saved=1");
}
