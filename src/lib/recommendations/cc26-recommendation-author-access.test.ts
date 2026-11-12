import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * CC-26 closure (follow-up to 387c53d). Static guards for the SQL that closes
 * the NW07 counsellor authorization defect on QA. The database behaviour is
 * proven by scripts/security/cc26-security-closure.db.test.mjs (PostgreSQL);
 * these checks run everywhere Vitest runs, including the Windows PC, and stop
 * the SQL from silently drifting away from what was tested and approved.
 *
 * Every file is read with CRLF normalised to LF (the Windows worktree is CRLF).
 */

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");
const P = "supabase/migrations-proposed";
const M0025 = read(`${P}/cc26/0025_cc26_inactive_counsellor_and_grant_hardening.sql`);
const R0025 = read(`${P}/cc26/0025_cc26_ROLLBACK.sql`);
const NW07 = read(`${P}/NW07_counsellor_studio_foundation.sql`);
const AUTHOR_CLAUSE = "v_draft.created_by = auth.uid() or public.counsellor_has_case_access(v_draft.student_user_id)";
const WRITE_RPCS = [
  "staff_update_recommendation_draft_content",
  "staff_submit_recommendation_draft_for_review",
  "staff_release_recommendation_draft",
  "staff_withdraw_recommendation_draft",
  "staff_archive_recommendation_draft",
];

function between(text: string, start: string, end: string) {
  const i = text.indexOf(start);
  expect(i, start).toBeGreaterThan(-1);
  const j = text.indexOf(end, i + start.length);
  expect(j, end).toBeGreaterThan(i);
  return text.slice(i, j + end.length);
}
const md5 = (s: string) => createHash("md5").update(s).digest("hex");
const bodyOf = (fn: string) => fn.slice(fn.indexOf("$$\n") + 2, fn.lastIndexOf("$$"));

describe("0025 F4: recommendation drafts need current case access", () => {
  const f4 = between(M0025, "-- F4. Recommendation drafts", "$f4$;\n");

  it("removes the authorship branch from both draft SELECT policies", () => {
    expect(f4).toContain('alter policy "Admins/author/case counsellor can read recommendation drafts" on public.recommendation_drafts');
    expect(f4).toContain('alter policy "Admins/author/case counsellor can read recommendation draft ver" on public.recommendation_draft_versions');
    const policies = f4.slice(f4.indexOf("alter policy"), f4.indexOf("if (select md5"));
    expect(policies).not.toContain("created_by");
    expect(policies.match(/public\.counsellor_has_case_access\(/g)).toHaveLength(2);
  });

  it.each(WRITE_RPCS)("%s: replaced only from the exact NW07 body, with case access only", (name) => {
    const original = between(NW07, `create or replace function public.${name}(`, "\n$$;");
    expect(original).toContain(AUTHOR_CLAUSE);
    const replaced = original
      .replace(`(${AUTHOR_CLAUSE})`, "public.counsellor_has_case_access(v_draft.student_user_id)")
      .replace("set search_path = public\n", "set search_path = pg_catalog, public, pg_temp\n");
    // The replacement is literally the NW07 function with two lines changed.
    expect(f4).toContain(replaced);
    expect(replaced).not.toContain("created_by = auth.uid()");
    // Guarded by the NW07 body hash and recorded with the CC-26 body hash.
    expect(f4).toContain(`'public.${name}(`);
    expect(f4).toContain(`= '${md5(bodyOf(original))}' then`);
    expect(f4).toContain(`'${name}', jsonb_build_array('${md5(bodyOf(original))}', '${md5(bodyOf(replaced))}')`);
    // The rollback restores the NW07 body only over the exact CC-26 body.
    expect(R0025).toContain(`= '${md5(bodyOf(replaced))}' then`);
    expect(R0025).toContain(original);
  });

  it("refuses drift, skips non-NW07 databases and leaves author-free bodies alone", () => {
    expect(f4).toContain("CC26-0025 F4 skipped: NW07 is not applied.");
    expect(f4).toContain("has an unexpected body that still grants access by authorship (drift)");
    expect(f4).toContain("recommendation draft policies are not in the expected state (drift)");
    expect(f4).toContain("md5(replace(prosrc, chr(13), ''))");
  });

  it("checks the result in the postconditions", () => {
    const post = between(M0025, "-- Postconditions", "$post$;");
    expect(post).toContain("a recommendation draft policy still grants access by authorship");
    expect(post).toContain("a write RPC still grants access by authorship");
  });

  it("does not touch function ACLs, comments or data (outside the replaced function bodies)", () => {
    const statements = f4
      .replace(/execute (\$f4_[a-z_]+\$)[\s\S]*?\1;/g, "")
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n");
    expect(statements).toContain("alter policy");
    expect(statements).not.toMatch(/\b(grant|revoke|comment on|insert into|update public|delete from|truncate)\b/i);
  });
});

describe("read-only QA SQL", () => {
  it.each(["cc26_qa_preflight_readonly.sql", "cc26_qa_export_readonly.sql"])("%s opens READ ONLY, ends in ROLLBACK and changes nothing", (file) => {
    const sql = read(`${P}/cc26/${file}`)
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n");
    expect(sql).toMatch(/^begin read only;$/m);
    expect(sql.trimEnd().endsWith("rollback;")).toBe(true);
    expect(sql).not.toMatch(/^\s*(insert|update|delete|truncate|create|alter|drop|grant|revoke|commit|comment)\b/im);
  });

  it("the preflight classifies the NW07 function and reports the exposure scope as counts", () => {
    const sql = read(`${P}/cc26/cc26_qa_preflight_readonly.sql`);
    expect(sql).toContain("'NW07 original (unsafe: any assignment, approved or not)'");
    expect(sql).toContain("'nw07_exposure_scope'");
    expect(sql).toContain("'f4_rpc_state'");
  });
});

describe("QA runner hash pins", () => {
  const manifest = read("docs/cc26/qa/CC26-QA-SQL-SHA256.txt");
  const pins = manifest
    .split("\n")
    .filter((line) => /^[0-9a-f]{64} {2}\S+$/.test(line))
    .map((line) => ({ hash: line.slice(0, 64), file: line.slice(66) }));
  const runner = read("docs/cc26/qa/Run-CC26-Qa.ps1");

  it("pins all twelve SQL files the runner can execute", () => {
    expect(pins).toHaveLength(12);
    for (const { file } of pins) expect(runner).toContain(path.basename(file));
  });

  it.each(pins.map((p) => [p.file, p.hash]))("%s matches its approved SHA-256", (file, hash) => {
    expect(createHash("sha256").update(read(file), "utf8").digest("hex")).toBe(hash);
  });
});
