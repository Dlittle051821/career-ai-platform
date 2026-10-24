"use server";

import { redirect } from "next/navigation";
import { createClient } from "./server";
import { resolveDefaultWorkspacePath } from "@/lib/auth/default-workspace";

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

/**
 * NW01 Part B — server-authoritative "where does this signed-in user land
 * by default?" lookup, called from `LoginForm.tsx` right after a
 * successful `supabase.auth.signInWithPassword()`.
 *
 * `LoginForm` is a client component, so it cannot query `admin_roles`
 * itself (and must not — "do not trust a role supplied by the browser").
 * By the time this Server Action runs, the browser Supabase client has
 * already set the session cookie from `signInWithPassword()`, so
 * `createClient()` here resolves the same just-authenticated user, and
 * `resolveDefaultWorkspacePath()` (src/lib/auth/default-workspace.ts) runs
 * the real, RLS-respecting `admin_roles` lookup. Falls back to
 * `"/dashboard"` if, for any reason, no user is resolved — the same safe
 * default this always had.
 */
export async function resolveMyDefaultWorkspace(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "/dashboard";
  return resolveDefaultWorkspacePath(supabase, user.id);
}
