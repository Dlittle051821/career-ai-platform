"use server";

import { redirect } from "next/navigation";
import { createClient } from "./server";

/**
 * Server Action for logging out. Called directly as a <form action={logout}>
 * in AccountMenu — no client-side Supabase call needed, so it works even
 * before the browser client has hydrated, and it can't be triggered twice
 * by a double-click the way a plain onClick handler could.
 */
export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
