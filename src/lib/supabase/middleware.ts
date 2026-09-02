import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";
import type { Database } from "@/types/database";

const PROTECTED_PATHS = [
  "/dashboard",
  "/roadmap",
  "/profile",
  "/recommendations",
  "/admin",
  "/payments",
  "/pay",
  "/saved",
  "/applications",
  "/pricing/checkout",
  // Milestone 10 (F-122) — student-facing "My Agreements" detail pages.
  "/agreements",
  // Milestone 11-B — the Assisted Onboarding choice screen and the real
  // (authenticated) Discovery Session booking flow.
  "/welcome",
  "/discovery-session",
];
const AUTH_ONLY_PATHS = ["/login", "/register"];

/**
 * Runs on every request (see middleware.ts at the project root).
 *
 * Two jobs, both required for Supabase SSR auth to work correctly on
 * Next.js App Router:
 *
 * 1. Refresh the session. Supabase access tokens are short-lived; this
 *    call transparently refreshes an expiring token and re-issues the
 *    session cookie so the user is never unexpectedly logged out mid-visit.
 * 2. Gate protected/auth-only routes server-side, before any page markup
 *    renders — this is what prevents a flash of protected content for a
 *    logged-out user (a client-side-only check can't do this).
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const { url, publishableKey } = getSupabaseEnv();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: do not add logic between createServerClient and this call.
  // getUser() revalidates the token with Supabase; a stale/expired token
  // is treated as logged-out, which is what makes route protection reliable.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isProtected = PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isAuthOnly = AUTH_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (isProtected && !user) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (isAuthOnly && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Milestone 7 — /admin is in PROTECTED_PATHS above, so a logged-out
  // visitor is already redirected to /login before ever reaching admin
  // markup. Whether a LOGGED-IN visitor actually holds an admin role is
  // deliberately NOT checked here: that would mean an extra database round
  // trip on every single /admin/* navigation. Instead src/app/admin/layout.tsx
  // (a Server Component that runs before any admin page renders) does that
  // check once per navigation via getCurrentAdmin() and renders an
  // access-denied state inline for a signed-in-but-unauthorized user —
  // same "before any markup renders" guarantee, one fewer query on the hot
  // path. RLS on every table is the enforcement backstop either way.

  // IMPORTANT: `supabaseResponse` must be returned as-is (or a new response
  // built from it, copying its cookies) so the refreshed session cookie
  // actually reaches the browser. Returning a plain NextResponse.next()
  // here would silently drop the refreshed session.
  return supabaseResponse;
}
