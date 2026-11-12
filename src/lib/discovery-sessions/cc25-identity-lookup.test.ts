import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { describeDiscoverySessionStudent, RESTRICTED_STUDENT_LABEL } from "./student-identity";
import { discoverySessionWriteErrorMessage, getAssignmentApprovalState } from "./assignment-approval";

/**
 * CC-25 — counsellor identity access through the least-privilege
 * staff_discovery_session_student_identities RPC (migration 0023 CC-25),
 * plus the admin approval path. The database rules themselves are proven
 * against real PostgreSQL by scripts/security/cc25-counsellor-identity.db.test.mjs;
 * these tests pin the application side: which call is made, that nothing
 * else is read, and that the UI wording follows the database's decision.
 */

const ROOT = path.resolve(import.meta.dirname, "../../..");

const db = vi.hoisted(() => ({
  rpcCalls: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  rpcResult: null as null | ((fn: string, args: Record<string, unknown>) => { data: unknown; error: unknown }),
  profileReads: 0,
  sessions: [] as Array<Record<string, unknown>>,
  role: "counsellor",
}));

vi.mock("@/lib/supabase/admin-auth", () => ({
  requireAdminPermission: async () => ({ role: db.role }),
  requireAdminRole: async (allowed: string[]) => {
    if (!allowed.includes(db.role)) {
      const e = new Error("You do not have permission to do this.");
      e.name = "AdminAuthorizationError";
      throw e;
    }
    return { role: db.role };
  },
}));
vi.mock("@/lib/supabase/analytics/track", () => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/supabase/admin/audit", () => ({ recordAuditLog: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      db.rpcCalls.push({ fn, args });
      return db.rpcResult ? db.rpcResult(fn, args) : { data: [], error: null };
    },
    from: (table: string) => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "order", "eq", "is"]) q[m] = () => q;
      q.range = async () => ({ data: table === "discovery_sessions" ? db.sessions : [], error: null, count: db.sessions.length });
      q.maybeSingle = async () => ({ data: db.sessions[0] ?? null, error: null });
      q.in = async () => {
        if (table === "profiles") {
          db.profileReads += 1;
          return { data: [], error: null };
        }
        if (table === "counsellors") return { data: [{ id: "c-1", display_name: "Fictional Counsellor" }], error: null };
        return { data: [], error: null };
      };
      return q;
    },
  }),
}));

const session = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  student_user_id: `stu-${id}`,
  assigned_counsellor_id: "c-1",
  status: "scheduled",
  session_type: "DISCOVERY_SESSION",
  created_at: "2026-11-11T10:00:00Z",
  updated_at: "2026-11-11T10:00:00Z",
  assignment_approved_counsellor_id: "c-1",
  assignment_approved_at: "2026-11-11T11:00:00Z",
  ...extra,
});

beforeEach(() => {
  db.rpcCalls = [];
  db.rpcResult = null;
  db.profileReads = 0;
  db.sessions = [];
  db.role = "counsellor";
});

describe("staff Discovery Session loader uses the identity RPC", () => {
  it("asks the RPC by SESSION id and never reads profiles", async () => {
    db.sessions = [session("s-1"), session("s-2", { assigned_counsellor_id: null, assignment_approved_counsellor_id: null, assignment_approved_at: null, status: "requested" })];
    db.rpcResult = () => ({ data: [{ session_id: "s-1", student_user_id: "stu-s-1", full_name: "Fictional Asha", email: "asha@example.test" }], error: null });
    const { listDiscoverySessions } = await import("@/lib/supabase/admin/discovery-sessions");
    const { items } = await listDiscoverySessions();
    expect(db.rpcCalls).toEqual([{ fn: "staff_discovery_session_student_identities", args: { p_session_ids: ["s-1", "s-2"] } }]);
    expect(db.profileReads).toBe(0);
    expect(describeDiscoverySessionStudent(items[0])).toMatchObject({ name: "Fictional Asha", detail: "asha@example.test", restricted: false });
    expect(describeDiscoverySessionStudent(items[1])).toMatchObject({ name: RESTRICTED_STUDENT_LABEL, restricted: true });
  });

  it("splits large pages into batches of at most 100 ids", async () => {
    db.sessions = Array.from({ length: 230 }, (_, i) => session(`s-${i}`));
    const { listDiscoverySessions, IDENTITY_LOOKUP_BATCH_SIZE } = await import("@/lib/supabase/admin/discovery-sessions");
    await listDiscoverySessions();
    expect(IDENTITY_LOOKUP_BATCH_SIZE).toBe(100);
    expect(db.rpcCalls.map((c) => (c.args.p_session_ids as string[]).length)).toEqual([100, 100, 30]);
  });

  it("on an RPC error other than 'function missing', shows restricted and does NOT fall back to profiles", async () => {
    db.sessions = [session("s-1")];
    db.rpcResult = () => ({ data: null, error: { code: "42501", message: "Not authorized to view student details." } });
    const { listDiscoverySessions } = await import("@/lib/supabase/admin/discovery-sessions");
    const { items } = await listDiscoverySessions();
    expect(items[0].studentIdentityVisible).toBe(false);
    expect(db.profileReads).toBe(0);
  });

  it("reports the database-controlled approval of the CURRENT assignment", async () => {
    db.sessions = [
      session("approved"),
      session("claimed", { assignment_approved_counsellor_id: null, assignment_approved_at: null }),
      session("stale", { assignment_approved_counsellor_id: "c-old" }),
      session("legacy", { assignment_approved_counsellor_id: undefined, assignment_approved_at: undefined }),
    ];
    const { listDiscoverySessions } = await import("@/lib/supabase/admin/discovery-sessions");
    const { items } = await listDiscoverySessions();
    expect(items.map((s) => [s.id, s.assignmentApproved])).toEqual([
      ["approved", true],
      ["claimed", false],
      ["stale", false],
      ["legacy", null],
    ]);
  });
});

describe("admin approval goes through the audited database RPC", () => {
  it("calls admin_set_discovery_session_assignment_approval with the expected counsellor", async () => {
    db.role = "admin";
    db.rpcResult = () => ({ data: { approved: true }, error: null });
    const { setDiscoverySessionAssignmentApproval } = await import("@/lib/supabase/admin/discovery-sessions");
    await setDiscoverySessionAssignmentApproval("s-1", "c-1", true);
    expect(db.rpcCalls).toEqual([
      { fn: "admin_set_discovery_session_assignment_approval", args: { p_session_id: "s-1", p_counsellor_id: "c-1", p_approved: true } },
    ]);
  });

  it("a counsellor is refused before any database call", async () => {
    const { setDiscoverySessionAssignmentApproval } = await import("@/lib/supabase/admin/discovery-sessions");
    await expect(setDiscoverySessionAssignmentApproval("s-1", "c-1", true)).rejects.toThrow(/permission/);
    expect(db.rpcCalls).toEqual([]);
  });

  it("shows the database's own refusal (stale assignment) instead of a raw error", async () => {
    db.role = "admin";
    db.rpcResult = () => ({ data: null, error: { code: "40001", message: "This session is no longer assigned to that counsellor. Reload the page and try again." } });
    const { setDiscoverySessionAssignmentApproval } = await import("@/lib/supabase/admin/discovery-sessions");
    await expect(setDiscoverySessionAssignmentApproval("s-1", "c-1", true)).rejects.toThrow("This session is no longer assigned to that counsellor. Reload the page and try again.");
  });
});

describe("assignment approval wording", () => {
  const s = { assignedCounsellorId: "c-1", assignmentApprovedAt: null };
  it("maps every state", () => {
    expect(getAssignmentApprovalState({ ...s, assignedCounsellorId: null, assignmentApproved: null, status: "requested" })).toEqual({ kind: "unassigned" });
    expect(getAssignmentApprovalState({ ...s, assignmentApproved: true, assignmentApprovedAt: "x", status: "scheduled" })).toEqual({ kind: "approved", approvedAt: "x" });
    expect(getAssignmentApprovalState({ ...s, assignmentApproved: false, status: "requested" })).toEqual({ kind: "awaiting_approval", canApprove: true });
    expect(getAssignmentApprovalState({ ...s, assignmentApproved: false, status: "completed" })).toEqual({ kind: "awaiting_approval", canApprove: false });
    expect(getAssignmentApprovalState({ ...s, assignmentApproved: null, status: "scheduled" })).toEqual({ kind: "not_tracked" });
  });

  it("explains why details are restricted, in the database's order", () => {
    const base = { studentName: null, studentEmail: null, studentIdentityVisible: false as const };
    expect(describeDiscoverySessionStudent({ ...base, assignedCounsellorId: null }).detail).toMatch(/approved by an admin/);
    expect(describeDiscoverySessionStudent({ ...base, assignedCounsellorId: "c-1", assignmentApproved: false, status: "scheduled" }).detail).toMatch(/Waiting for an admin to approve/);
    expect(describeDiscoverySessionStudent({ ...base, assignedCounsellorId: "c-1", assignmentApproved: true, status: "completed" }).detail).toMatch(/only shown for requested or scheduled/);
    expect(describeDiscoverySessionStudent({ ...base, assignedCounsellorId: "c-1", assignmentApproved: true, status: "scheduled" }).detail).toMatch(/Ask an admin/);
  });

  it("never shows raw database text", () => {
    expect(discoverySessionWriteErrorMessage({ code: "42501", message: "This Discovery Session assignment has not been approved by an admin. You can only claim an unassigned request." })).toMatch(/^This Discovery Session assignment has not been approved/);
    expect(discoverySessionWriteErrorMessage({ code: "42501", message: 'new row violates row-level security policy for table "discovery_sessions"' })).toBe("You don't have permission to make this change.");
    expect(discoverySessionWriteErrorMessage({ code: "XX000", message: "internal: relation public.x at 0x7f" })).toBe("We couldn't save this Discovery Session. Please try again.");
    expect(discoverySessionWriteErrorMessage(null)).toBe("We couldn't save this Discovery Session. Please try again.");
  });
});

describe("CC-25 static guards", () => {
  // CC-26: normalise line endings (CRLF on Windows) — the assertions match "\n"-terminated SQL text.
  const migration = readFileSync(path.join(ROOT, "supabase/migrations-proposed/cc25/0023_cc25_counsellor_identity_least_privilege.sql"), "utf8").replace(/\r\n/g, "\n");

  // CC-26 revision 2: section 7b (only where NW07 is applied) re-creates
  // NW07's profiles policy as the exact 0004 caseload-only rule. The guard is
  // therefore "no profiles policy that grants anything beyond the caseload",
  // checked on every profiles policy the file can create, plus the original
  // statement-level grant checks (now also covering grants issued via EXECUTE).
  it("the migration never widens profiles (any profiles policy is the 0004 caseload-only rule) and grants nothing to anon", () => {
    const profilePolicies = migration.match(/create\s+policy[^;]*?on\s+public\.profiles[\s\S]*?\n\s*\)\s*(?:\$sql\$|;)/gi) ?? [];
    expect(profilePolicies.length).toBe(1);
    for (const policy of profilePolicies) {
      expect(policy).toMatch(/"Admins\/assigned counsellor can read student profiles \(m7\)"/);
      expect(policy).toMatch(/m\.student_user_id = profiles\.id and m\.assigned_counsellor_id = public\.current_counsellor_id\(\)/);
      expect(policy).not.toMatch(/discovery_sessions|counsellor_has_case_access|counsellor_has_active_session_for_student|counsellor_has_approved_session/);
    }
    const sectionStart = migration.indexOf("-- 7b. NW07 compatibility");
    expect(sectionStart).toBeGreaterThan(-1);
    expect(migration.search(/create\s+policy[^;]*?on\s+public\.profiles/i)).toBeGreaterThan(sectionStart);
    // Statement-level: no GRANT statement names anon or PUBLIC as a grantee.
    const grants = migration.match(/^\s*grant\b[^;]*;/gim) ?? [];
    expect(grants.length).toBeGreaterThan(0);
    for (const g of grants) expect(g).not.toMatch(/\bto\b[^;]*\b(anon|public)\b/i);
    const executedGrants = migration.match(/execute\s+'grant\b[^']*'/gi) ?? [];
    expect(executedGrants.length).toBeGreaterThan(0);
    for (const g of executedGrants) expect(g).not.toMatch(/\bto\b[^']*\b(anon|public)\b/i);
    expect(migration).toMatch(/drop policy if exists "Assigned DS counsellor can read student profile \(cc24\)" on public\.profiles;/);
  });

  // CC-26 revision 2: an empty search_path still searches the session's
  // temporary schema first for table and type names; every definer now pins
  // a search_path with pg_temp LAST (PostgreSQL's documented safe form).
  it("every CC-25 SECURITY DEFINER function pins search_path with pg_temp last (no empty search_path)", () => {
    expect(migration).not.toMatch(/set search_path = ''/);
    const definers = migration.match(/create or replace function[\s\S]*?\$fn\$;/gi) ?? [];
    expect(definers.length).toBe(6);
    for (const fn of definers) {
      if (/security definer/i.test(fn)) expect(fn).toMatch(/set search_path = pg_catalog, pg_temp\n/);
    }
    const caseAccess = migration.slice(migration.indexOf("create or replace function public.counsellor_has_case_access"));
    expect(caseAccess).toMatch(/^create or replace function public\.counsellor_has_case_access\(p_student_user_id uuid\)[\s\S]*?security definer\s+set search_path = pg_catalog, public, pg_temp\n/);
  });

  it("the migration and the RLS tests refuse to run without an explicit non-production approval", () => {
    expect(migration).toMatch(/APPROVED-QA-ynwzijulzksmrcwdhudv/);
    expect(migration).not.toMatch(/bwlkxunujngksibfzzfv/);
    const tests = readFileSync(path.join(ROOT, "supabase/migrations-proposed/cc25/0023_cc25_rls_tests.sql"), "utf8");
    expect(tests).toMatch(/CC25 tests refused/);
    expect(tests.trimEnd().endsWith("rollback;")).toBe(true);
  });

  it("the rejected CC-24 proposal is marked as rejected and is not in supabase/migrations", () => {
    expect(existsSync(path.join(ROOT, "supabase/migrations-proposed/cc24/REJECTED.md"))).toBe(true);
    expect(readdirSync(path.join(ROOT, "supabase/migrations")).some((f) => f.startsWith("0023"))).toBe(false);
  });

  it("application code never writes the approval columns or uses the service role for Discovery Sessions", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = path.join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push(p);
      }
    };
    walk(path.join(ROOT, "src"));
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      expect(src, file).not.toMatch(/\.(update|insert|upsert)\(\s*\{[^}]*assignment_approved_/);
    }
    const loader = readFileSync(path.join(ROOT, "src/lib/supabase/admin/discovery-sessions.ts"), "utf8");
    expect(loader).not.toMatch(/service-role|getServiceRoleClient|SERVICE_ROLE/);
  });
});
