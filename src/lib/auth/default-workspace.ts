import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { isKnownAdminRole } from "@/lib/admin/permissions";

/**
 * NW01 Part B "Role-aware login & workspace routing".
 *
 * Confirmed defect before this milestone: `LoginForm.tsx` always redirected
 * a freshly-signed-in user to `/dashboard` (unless an explicit `?next=`
 * was present), and `src/lib/supabase/middleware.ts`'s `AUTH_ONLY_PATHS`
 * bounce did the same for an already-authenticated visitor who re-opened
 * `/login` or `/register`. Both were role-blind: an admin, finance,
 * content-editor, analyst, or counsellor account landed on the STUDENT
 * dashboard every time, because neither call site ever asked "does this
 * user hold an admin_roles row at all?"
 *
 * This file is the one, server-authoritative answer to "where should this
 * signed-in user land by default?" — used by both call sites above instead
 * of each hand-rolling (or re-hardcoding) its own guess.
 *
 * Deliberately NOT built on `getCurrentAdmin()` (src/lib/supabase/
 * admin-auth.ts): that module is marked `import "server-only"`, which is
 * safe inside a Server Component/Server Action but not guaranteed inside
 * `middleware.ts` (Next.js Middleware is not a Server Component — depending
 * on build target it may run on the Edge runtime, and `server-only`'s
 * contract is about client-bundle exclusion, not about which server
 * runtime is hosting the call). To avoid coupling a new runtime assumption
 * onto a security-critical file, this helper instead accepts an
 * already-constructed Supabase client (the caller's own — middleware
 * already builds one per request for `getUser()`; a Server Action builds
 * its own via `createClient()`) and runs the exact same `admin_roles`
 * lookup `getCurrentAdmin()` runs, including the same
 * `isKnownAdminRole()` guard against a stale/garbage role string. This is
 * a read-only, RLS-respecting query — the "Admins can read their own role"
 * policy in `supabase/migrations/0004_admin_system.sql` already allows any
 * signed-in user to read their own `admin_roles` row, which is exactly (and
 * only) what this does.
 *
 * Per the milestone brief: every admin-ish role (super_admin, admin,
 * finance, content_editor, analyst, counsellor) resolves to `/admin` —
 * confirmed by reading `src/app/admin/layout.tsx` (every one of those
 * roles passes its `getCurrentAdmin()` check and renders inside the one
 * shared `AdminShell`; there is no separate counsellor-only workspace route
 * in this codebase today) and `AdminShell.tsx` (which already shows/hides
 * module links per-role via `permittedReadModules()`). A user with no
 * `admin_roles` row at all (every ordinary student) resolves to
 * `/dashboard`, unchanged from today's behavior for students.
 *
 * "Do not trust a role supplied by the browser" (spec) — this function
 * only ever accepts a Supabase client + a user id already authenticated by
 * that same client's own session; it never accepts a role value as an
 * input.
 */
export async function resolveDefaultWorkspacePath(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<string> {
  const { data: roleRow } = await supabase
    .from("admin_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (roleRow && isKnownAdminRole(roleRow.role)) {
    return "/admin";
  }

  return "/dashboard";
}
