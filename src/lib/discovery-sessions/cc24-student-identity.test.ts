import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { describeDiscoverySessionStudent, RESTRICTED_STUDENT_LABEL, UNNAMED_STUDENT_LABEL } from "./student-identity";

/**
 * CC-24 — regression for CC-23 F11's misleading display: a profile the
 * viewer may not read (RLS returned no row) rendered as "Unnamed student",
 * so a missing permission looked like missing data. The access fix itself
 * is the approval-gated migration 0023; this only makes the UI honest and
 * never widens access.
 */

const base = { studentName: null, studentEmail: null, assignedCounsellorId: null };

describe("describeDiscoverySessionStudent", () => {
  it("shows the real name and email when visible", () => {
    expect(describeDiscoverySessionStudent({ ...base, studentName: "Fictional Asha", studentEmail: "asha@example.test", studentIdentityVisible: true })).toEqual({
      name: "Fictional Asha",
      detail: "asha@example.test",
      restricted: false,
    });
  });

  it("says 'Unnamed student' only when the profile is readable but has no name", () => {
    expect(describeDiscoverySessionStudent({ ...base, studentName: "   ", studentIdentityVisible: true })).toMatchObject({ name: UNNAMED_STUDENT_LABEL, detail: "No email on file" });
  });

  it("says details are restricted when RLS hid the profile — unassigned request", () => {
    const r = describeDiscoverySessionStudent({ ...base, studentIdentityVisible: false });
    expect(r).toMatchObject({ name: RESTRICTED_STUDENT_LABEL, restricted: true });
    expect(r.detail).toMatch(/once this request is assigned to you/);
  });

  it("says details are restricted, and to ask an admin, when assigned but still hidden", () => {
    const r = describeDiscoverySessionStudent({ ...base, assignedCounsellorId: "c-1", studentIdentityVisible: false });
    expect(r.name).toBe(RESTRICTED_STUDENT_LABEL);
    expect(r.detail).toMatch(/Ask an admin/);
  });

  it("treats an unset flag (the student's own views) as visible", () => {
    expect(describeDiscoverySessionStudent({ ...base, studentName: "Me" }).name).toBe("Me");
  });
});

// The real admin loader, with only auth and Supabase replaced. The fake
// `profiles` query returns only the profiles "RLS" lets this viewer read.
const db = vi.hoisted(() => ({ readableProfiles: [] as Array<{ id: string; full_name: string | null; email: string | null }> }));

vi.mock("@/lib/supabase/admin-auth", () => ({ requireAdminPermission: async () => ({ role: "counsellor" }) }));
vi.mock("@/lib/supabase/analytics/track", () => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      const sessions = [
        { id: "s-assigned", student_user_id: "stu-a", assigned_counsellor_id: "c-1", status: "scheduled", session_type: "DISCOVERY_SESSION", created_at: "2026-11-11T10:00:00Z", updated_at: "2026-11-11T10:00:00Z" },
        { id: "s-open", student_user_id: "stu-b", assigned_counsellor_id: null, status: "requested", session_type: "DISCOVERY_SESSION", created_at: "2026-11-11T10:00:00Z", updated_at: "2026-11-11T10:00:00Z" },
      ];
      const q: Record<string, unknown> = {};
      for (const m of ["select", "order", "eq", "is"]) q[m] = () => q;
      q.range = async () => ({ data: table === "discovery_sessions" ? sessions : [], error: null, count: sessions.length });
      q.in = async (_col: string, ids: string[]) => {
        if (table === "profiles") return { data: db.readableProfiles.filter((p) => ids.includes(p.id)), error: null };
        if (table === "counsellors") return { data: [{ id: "c-1", display_name: "Fictional Counsellor" }], error: null };
        return { data: [], error: null };
      };
      return q;
    },
  }),
}));

describe("listDiscoverySessions marks hidden profiles instead of inventing 'Unnamed student'", () => {
  it("without the 0023 policy: both students are restricted, not unnamed", async () => {
    db.readableProfiles = [];
    const { listDiscoverySessions } = await import("@/lib/supabase/admin/discovery-sessions");
    const { items } = await listDiscoverySessions();
    expect(items.map((s) => [s.id, s.studentIdentityVisible, describeDiscoverySessionStudent(s).name])).toEqual([
      ["s-assigned", false, RESTRICTED_STUDENT_LABEL],
      ["s-open", false, RESTRICTED_STUDENT_LABEL],
    ]);
  });

  it("with the assigned student's profile readable: real name for that one only", async () => {
    db.readableProfiles = [{ id: "stu-a", full_name: "Fictional Asha", email: "asha@example.test" }];
    const { listDiscoverySessions } = await import("@/lib/supabase/admin/discovery-sessions");
    const { items } = await listDiscoverySessions();
    expect(describeDiscoverySessionStudent(items[0])).toMatchObject({ name: "Fictional Asha", detail: "asha@example.test" });
    expect(describeDiscoverySessionStudent(items[1]).name).toBe(RESTRICTED_STUDENT_LABEL);
  });

  it("a readable profile with no name is still 'Unnamed student'", async () => {
    db.readableProfiles = [{ id: "stu-a", full_name: null, email: null }];
    const { listDiscoverySessions } = await import("@/lib/supabase/admin/discovery-sessions");
    const { items } = await listDiscoverySessions();
    expect(describeDiscoverySessionStudent(items[0]).name).toBe(UNNAMED_STUDENT_LABEL);
  });
});

describe("every staff Discovery Session screen uses the shared label", () => {
  const APP = path.resolve(import.meta.dirname, "../../app");
  const screens = [
    "counsellor/page.tsx",
    "counsellor/discovery-sessions/page.tsx",
    "counsellor/discovery-sessions/[id]/page.tsx",
    "counsellor/discovery-sessions/[id]/workspace/page.tsx",
    "admin/discovery-sessions/page.tsx",
    "admin/discovery-sessions/[id]/page.tsx",
    "admin/discovery-sessions/[id]/workspace/page.tsx",
  ];
  it.each(screens)("%s", (screen) => {
    const src = readFileSync(path.join(APP, screen), "utf8");
    expect(src).toContain("describeDiscoverySessionStudent(");
    expect(src).not.toMatch(/studentName \?\? "Unnamed student"/);
  });
});
