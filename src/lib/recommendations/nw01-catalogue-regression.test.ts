import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { DIMENSION_WEIGHTS } from "./weights";

/**
 * NW01 Part I "Career Catalogue & Launch-Country Regression Protection".
 *
 * The career catalogue (26 families / 31 industries / 100 careers, all
 * active + approved) was already recovered before this milestone began —
 * this milestone's own brief is explicit: "Do not reseed the career
 * database. Do not rerun supabase/seed/0001_careers_seed.sql. Do not
 * change the recommendation engine's scoring logic or weaken
 * career-publication RLS policies. Only verify catalogue consistency and
 * provide regression protection."
 *
 * This file adds exactly that — regression protection, not a fresh
 * verification of live data (there is no live Supabase instance in this
 * sandbox to query row counts against). It locks three things any future
 * change could silently break without a human noticing:
 *
 * 1. The recommendation engine's scoring weights (src/lib/recommendations/
 *    weights.ts) are unchanged from this milestone's own audited values.
 *    This is NOT a judgment that these are the "right" weights — it is a
 *    tripwire: if a future edit changes them, this test fails and the
 *    change becomes a deliberate, reviewed decision instead of an
 *    accidental side effect of something else.
 * 2. The real RLS policy that gates which `careers` rows are even visible
 *    to a student (`is_active = true AND data_quality_status =
 *    'approved'` — supabase/migrations/0003_career_database.sql) still
 *    contains that exact condition, so a future migration can't silently
 *    loosen "which careers get recommended" without this test catching it.
 * 3. Nothing under `src/` ever references the original seed file by path —
 *    i.e. no application code path exists that could rerun it.
 */
function read(relativePath: string): string {
  return readFileSync(relativePath, "utf8");
}

describe("NW01 Part I — recommendation engine scoring weights are locked (catch accidental changes)", () => {
  it("DIMENSION_WEIGHTS matches the exact values audited for this milestone", () => {
    expect(DIMENSION_WEIGHTS).toEqual({
      subjects: 18,
      interests: 18,
      skills: 14,
      workPreferences: 10,
      careerPriorities: 14,
      careerHeuristics: 10,
      education: 12,
      mobility: 4,
    });
  });
});

describe("NW01 Part I — career-publication RLS is not weakened", () => {
  it("the real 'Public can read approved careers' policy still requires BOTH is_active and data_quality_status = 'approved'", () => {
    const migration = read("supabase/migrations/0003_career_database.sql");
    expect(migration).toContain('create policy "Public can read approved careers" on public.careers');
    expect(migration).toContain("using (is_active = true and data_quality_status = 'approved')");
  });
});

describe("NW01 Part I — the original seed file is never re-executed by application code", () => {
  it("no file under src/ references supabase/seed/0001_careers_seed.sql by path", () => {
    // A simple, deliberately broad grep-equivalent: if this ever matches,
    // something under src/ is pointing at the seed file, which this
    // milestone's own brief says must never be rerun. `grep` exits 1 (no
    // matches) on a clean tree — that is the expected, passing case, so a
    // thrown error from execFileSync (exit code 1) is caught and treated
    // as "nothing found", not a test failure; only an actual match (exit
    // 0, with output) fails the assertion below.
    let output = "";
    try {
      output = execFileSync(
        "grep",
        ["-rl", "--exclude=nw01-catalogue-regression.test.ts", "0001_careers_seed", "src"],
        { encoding: "utf8" }
      );
    } catch {
      output = "";
    }
    expect(output.trim()).toBe("");
  });
});
