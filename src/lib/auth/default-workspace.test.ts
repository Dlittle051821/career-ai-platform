import { describe, expect, it } from "vitest";
import { resolveDefaultWorkspacePath } from "./default-workspace";
import type { AdminRole } from "@/types/admin";

/**
 * NW01 Part B — unit coverage for the one server-authoritative "where does
 * this signed-in user land by default?" resolver, now shared by
 * LoginForm's post-sign-in redirect, middleware's AUTH_ONLY_PATHS bounce,
 * and the auth callback route. A tiny hand-rolled fake mirrors just the
 * `.from("admin_roles").select("role").eq("user_id", id).maybeSingle()`
 * chain this function actually calls — same "no live Postgres in this test
 * environment, mock the one chain used" convention as
 * src/lib/supabase/admin/applications.test.ts's own fake.
 */
function fakeSupabase(role: string | null) {
  return {
    from: (table: string) => {
      expect(table).toBe("admin_roles");
      return {
        select: (columns: string) => {
          expect(columns).toBe("role");
          return {
            eq: (column: string, value: string) => {
              expect(column).toBe("user_id");
              expect(value).toBe("user-123");
              return {
                maybeSingle: async () => ({ data: role ? { role } : null, error: null }),
              };
            },
          };
        },
      };
    },
  } as unknown as Parameters<typeof resolveDefaultWorkspacePath>[0];
}

describe("resolveDefaultWorkspacePath", () => {
  it("a user with no admin_roles row (an ordinary student) resolves to /dashboard", async () => {
    const path = await resolveDefaultWorkspacePath(fakeSupabase(null), "user-123");
    expect(path).toBe("/dashboard");
  });

  const ADMIN_ROLES: AdminRole[] = ["super_admin", "admin", "counsellor", "finance", "content_editor", "analyst"];
  for (const role of ADMIN_ROLES) {
    it(`a ${role} resolves to /admin (this codebase has no separate counsellor-only workspace route — every admin role lands inside the one shared AdminShell)`, async () => {
      const path = await resolveDefaultWorkspacePath(fakeSupabase(role), "user-123");
      expect(path).toBe("/admin");
    });
  }

  it("a stale/unrecognized role string (e.g. a role value removed from ADMIN_ROLES) is never trusted — falls back to /dashboard, never /admin", async () => {
    const path = await resolveDefaultWorkspacePath(fakeSupabase("some_removed_role"), "user-123");
    expect(path).toBe("/dashboard");
  });
});
