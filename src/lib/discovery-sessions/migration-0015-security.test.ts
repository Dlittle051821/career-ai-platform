import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regression guard for 0015_discovery_session_duplicate_booking_guard.sql —
 * a static check against the actual migration SQL text (this project has no
 * database in its Vitest setup), mirroring
 * src/lib/discovery-sessions/migration-security.test.ts and
 * src/lib/discovery-sessions/migration-0014-security.test.ts exactly. What
 * this test DOES catch: someone loosening or dropping the partial unique
 * index without touching this file. It is not a substitute for running the
 * verification queries in the migration's own footer against a real
 * database after applying it.
 */

const MIGRATION_PATH = path.resolve(process.cwd(), "supabase/migrations/0015_discovery_session_duplicate_booking_guard.sql");
const sql = readFileSync(MIGRATION_PATH, "utf8");

describe("0015_discovery_session_duplicate_booking_guard.sql — security invariants (M11-B)", () => {
  it("does not create or alter any table, column, or policy — a new index only", () => {
    expect(sql).not.toMatch(/create table/i);
    expect(sql).not.toMatch(/alter table/i);
    expect(sql).not.toMatch(/create policy/i);
    expect(sql).not.toMatch(/drop policy/i);
  });

  it("adds a partial unique index on discovery_sessions scoped to student_user_id, active statuses only", () => {
    expect(sql).toMatch(
      /create unique index if not exists discovery_sessions_one_active_per_student\s*\n\s*on public\.discovery_sessions \(student_user_id\)\s*\n\s*where status in \('requested', 'scheduled'\);/
    );
  });

  it("is idempotent — uses IF NOT EXISTS, never a bare CREATE UNIQUE INDEX", () => {
    expect(sql).not.toMatch(/create unique index discovery_sessions_one_active_per_student/);
  });

  it("does not scope the guard to terminal statuses (completed/cancelled/no_show would defeat its own purpose)", () => {
    const indexDef = sql.match(/create unique index if not exists discovery_sessions_one_active_per_student[\s\S]*?;/)?.[0] ?? "";
    expect(indexDef).not.toMatch(/completed|cancelled|no_show/);
  });
});
