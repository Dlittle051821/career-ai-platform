import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";
import { resolveDefaultWorkspacePath } from "@/lib/auth/default-workspace";

/**
 * Single callback route for every Supabase email link: signup
 * confirmation and password recovery both redirect here (see
 * `emailRedirectTo` / `redirectTo` in RegisterForm.tsx and
 * ForgotPasswordForm.tsx). Google OAuth would also land here in a future
 * milestone — not implemented yet, see README "Not implemented".
 *
 * Supabase's modern (PKCE) email links carry a `?code=...` query param.
 * Exchanging it here, server-side, sets the session cookie before the
 * browser ever sees a page — which is what lets /reset-password load with
 * an already-valid session instead of needing its own token-parsing logic.
 *
 * UX10-DS02 — `next` now goes through the shared `getSafeRedirectPath()`
 * validator (src/lib/auth/safe-redirect.ts) instead of this route's own
 * inline `next.startsWith("/")` check, which accepted unsafe
 * protocol-relative values like `//evil.example`. Behavior for every
 * already-safe value (e.g. `/welcome`, `/discovery-session/book`) is
 * unchanged.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // NW01 Part B — this fallback only ever fires when `next` is absent or
  // unsafe; both real flows that land here (RegisterForm's email
  // confirmation and ForgotPasswordForm's recovery link) always supply an
  // explicit, already-safe `next` ("/welcome"/"/reset-password"), so this
  // is a rare defense-in-depth path, not the common case — kept
  // role-aware anyway for consistency with LoginForm's own fallback (see
  // src/lib/auth/default-workspace.ts).
  const rawNext = searchParams.get("next");
  const safeNext = getSafeRedirectPath(rawNext, "");

  if (code) {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const destination = safeNext || (user ? await resolveDefaultWorkspacePath(supabase, user.id) : "/dashboard");
      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  // Missing/invalid/expired code — send them somewhere that explains it
  // rather than a confusing blank error.
  const failureRoute = safeNext === "/reset-password" ? "/reset-password" : "/login";
  return NextResponse.redirect(`${origin}${failureRoute}?authError=1`);
}
