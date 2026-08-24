import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";
import type { Database } from "@/types/database";

/**
 * Server-side Supabase client for Server Components, Server Actions, and
 * Route Handlers. Reads/writes the session through Next.js's cookie store
 * so the browser and server always agree on who's signed in.
 *
 * Server Components can read cookies but not write them — calling
 * `cookie.set()` there throws. That's expected and harmless: the
 * middleware (see middleware.ts at the project root) is what actually
 * refreshes and persists the session cookie on every request, so a
 * failed write from a Server Component is safely ignored here.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabaseEnv();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component — the middleware refreshes the
          // session instead. Safe to ignore.
        }
      },
    },
  });
}
