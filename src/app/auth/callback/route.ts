import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const safeNext = next.startsWith("/") ? next : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  // Missing/invalid/expired code — send them somewhere that explains it
  // rather than a confusing blank error.
  const failureRoute = safeNext === "/reset-password" ? "/reset-password" : "/login";
  return NextResponse.redirect(`${origin}${failureRoute}?authError=1`);
}
