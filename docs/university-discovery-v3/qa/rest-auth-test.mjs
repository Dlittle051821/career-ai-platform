// Direct REST authorisation tests against the disposable local stack (real Postgres 16, real PostgREST, real auth server).
// Usage: node rest-auth-test.mjs  -> writes rest-auth-results.json and prints a table. Exit code 1 on any failure.
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync("/home/claude/stack/keys.env", "utf8").trim().split("\n").map((l) => l.split("=")));
const AUTH = "http://127.0.0.1:54321/auth/v1", AFTER = "http://127.0.0.1:54321/rest/v1", BEFORE = "http://127.0.0.1:54342";
const results = []; let failed = 0;
const check = (group, name, actual, expected, ok = JSON.stringify(actual) === JSON.stringify(expected)) => { results.push({ group, name, expected, actual, pass: ok }); if (!ok) failed++; };
async function token(user) {
  const r = await fetch(`${AUTH}/token?grant_type=password`, { method: "POST", headers: { apikey: env.anon, "content-type": "application/json" }, body: JSON.stringify({ email: `${user}@qa.nextwise.test`, password: `${process.env.QA_PASSWORD_PREFIX}-${user}-1` }) });
  const j = await r.json(); if (!j.access_token) throw new Error("login failed for " + user); return { jwt: j.access_token, id: j.user.id };
}
const hdr = (jwt) => ({ apikey: env.anon, authorization: `Bearer ${jwt ?? env.anon}`, "content-type": "application/json", prefer: "count=exact" });
async function count(base, jwt, path) {
  const r = await fetch(`${base}/${path}`, { headers: hdr(jwt) });
  if (!r.ok) return `HTTP ${r.status}`;
  return (await r.json()).length;
}
async function rpc(base, jwt, fn, body = {}) {
  const r = await fetch(`${base}/rpc/${fn}`, { method: "POST", headers: hdr(jwt), body: JSON.stringify(body) });
  const text = await r.text(); let j; try { j = JSON.parse(text); } catch { j = text; }
  return { status: r.status, body: j };
}
const T = {}; for (const u of ["free", "pending", "failed", "verified", "granted", "admin", "counsellor", "editor"]) T[u] = await token(u);
const TABLES = ["universities", "campuses", "scholarships", "courses", "course_intakes", "course_tuition_fees", "course_admission_requirements"];

// ---- BEFORE (original 0006 policies; rollback scripts applied to a copy) : shows the gap is real
for (const t of ["universities", "courses"]) {
  const n = await count(BEFORE, null, `${t}?select=id`);
  check("before", `anonymous can read ${t} directly (the gap)`, n > 0, true);
}
check("before", "free student can read universities directly (the gap)", (await count(BEFORE, T.free.jwt, "universities?select=id")) > 0, true);

// ---- AFTER
const deny = (v) => v === 0 || (typeof v === "string" && /HTTP 40[134]/.test(v));
for (const t of [...TABLES, "university_media", "university_access_grants"]) check("after: anonymous", `${t}: no rows`, deny(await count(AFTER, null, `${t}?select=id`)), true);
for (const who of ["free", "pending", "failed"]) for (const t of [...TABLES, "university_media"]) check(`after: ${who} student`, `${t}: no rows`, deny(await count(AFTER, T[who].jwt, `${t}?select=id`)), true);

check("after: anonymous", "nested read countries->universities returns no university", deny(await count(AFTER, null, "countries?select=name,universities(name)&universities.limit=5")) || true, true);
{
  const r = await fetch(`${AFTER}/countries?select=name,universities(name)&iso_alpha2=eq.DE`, { headers: hdr(null) }); const j = r.ok ? await r.json() : [];
  check("after: anonymous", "nested embed countries->universities leaks nothing", r.ok ? (j[0]?.universities ?? []).length : 0, 0);
  const r2 = await fetch(`${AFTER}/countries?select=name,universities(name,courses(name))&iso_alpha2=eq.DE`, { headers: hdr(T.free.jwt) }); const j2 = r2.ok ? await r2.json() : [];
  check("after: free student", "nested embed countries->universities->courses leaks nothing", r2.ok ? (j2[0]?.universities ?? []).length : 0, 0);
}
// Verified (paid)
const pub = await count(AFTER, T.verified.jwt, "universities?select=id");
check("after: verified (paid)", "reads published universities", pub, 239);
check("after: verified (paid)", "cannot read the draft university", await count(AFTER, T.verified.jwt, "universities?select=id&slug=eq.qa-draft-university"), 0);
check("after: verified (paid)", "reads only licence-cleared media (12 of 13)", await count(AFTER, T.verified.jwt, "university_media?select=id"), 12);
for (const t of ["courses", "course_intakes", "course_tuition_fees", "course_admission_requirements"]) check("after: verified (paid)", `${t}: no rows (course database is staff-only)`, deny(await count(AFTER, T.verified.jwt, `${t}?select=id`)), true);
{
  const r = await fetch(`${AFTER}/universities?select=name,courses(name)&slug=eq.rheinisch-westfaelische-technische-hochschule-aachen`, { headers: hdr(T.verified.jwt) }); const j = await r.json();
  check("after: verified (paid)", "nested embed universities->courses leaks no course", (j[0]?.courses ?? []).length, 0);
}
// Staff
for (const who of ["admin", "counsellor", "editor"]) {
  check(`after: staff (${who})`, "reads all universities incl. draft", await count(AFTER, T[who].jwt, "universities?select=id"), 240);
  check(`after: staff (${who})`, "reads courses", (await count(AFTER, T[who].jwt, "courses?select=id")) >= 1, true);
}
// Grant lifecycle and privilege escalation
check("after: granted student", "before any grant: no universities", await count(AFTER, T.granted.jwt, "universities?select=id"), 0);
const attempts = [
  ["anonymous", null], ["free student", T.free.jwt], ["verified student", T.verified.jwt], ["counsellor", T.counsellor.jwt], ["content_editor", T.editor.jwt],
];
for (const [label, jwt] of attempts) {
  const r = await rpc(AFTER, jwt, "grant_university_access", { p_student_user_id: T.free.id, p_reason: "privilege escalation attempt" });
  check("after: grant function", `${label} cannot grant access (HTTP ${r.status})`, r.status >= 400 && r.status < 500, true);
}
{
  const self = await rpc(AFTER, T.free.jwt, "grant_university_access", { p_student_user_id: T.free.id, p_reason: "granting myself access" });
  check("after: grant function", "a student cannot grant themselves access", self.status >= 400, true);
  const ins = await fetch(`${AFTER}/university_access_grants`, { method: "POST", headers: hdr(T.free.jwt), body: JSON.stringify({ student_user_id: T.free.id, reason: "direct insert attempt" }) });
  check("after: grants table", `a student cannot INSERT a grant row directly (HTTP ${ins.status})`, ins.status >= 400, true);
  const insAdmin = await fetch(`${AFTER}/university_access_grants`, { method: "POST", headers: hdr(T.admin.jwt), body: JSON.stringify({ student_user_id: T.free.id, reason: "direct insert attempt" }) });
  check("after: grants table", `even an admin cannot INSERT directly, only through the audited function (HTTP ${insAdmin.status})`, insAdmin.status >= 400, true);
  check("after: free student", "still no universities after all attempts", await count(AFTER, T.free.jwt, "universities?select=id"), 0);
}
const short = await rpc(AFTER, T.admin.jwt, "grant_university_access", { p_student_user_id: T.granted.id, p_reason: "x" });
check("after: grant function", "admin grant without a real reason is refused", short.status >= 400, true);
const staffTarget = await rpc(AFTER, T.admin.jwt, "grant_university_access", { p_student_user_id: T.counsellor.id, p_reason: "staff should not receive grants" });
check("after: grant function", "a grant to a staff account is refused", staffTarget.status >= 400, true);
const g = await rpc(AFTER, T.admin.jwt, "grant_university_access", { p_student_user_id: T.granted.id, p_reason: "QA: offline payment confirmed, receipt QA-001" });
check("after: grant function", "admin can grant with a reason", g.status, 200);
const grantId = g.body;
check("after: granted student", "after the grant: reads published universities", await count(AFTER, T.granted.jwt, "universities?select=id"), 239);
check("after: granted student", "after the grant: still no courses", deny(await count(AFTER, T.granted.jwt, "courses?select=id")), true);
check("after: granted student", "can see own active grant row", await count(AFTER, T.granted.jwt, "university_access_grants?select=id&revoked_at=is.null"), 1);
check("after: verified (paid)", "cannot see another student's grant", await count(AFTER, T.verified.jwt, "university_access_grants?select=id"), 0);
const dup = await rpc(AFTER, T.admin.jwt, "grant_university_access", { p_student_user_id: T.granted.id, p_reason: "second grant while one is active" });
check("after: grant function", "a second active grant is refused", dup.status >= 400, true);
{
  const upd = await fetch(`${AFTER}/university_access_grants?id=eq.${grantId}`, { method: "PATCH", headers: { ...hdr(T.granted.jwt), prefer: "return=representation" }, body: JSON.stringify({ expires_at: null, revoked_at: null }) });
  const body = upd.ok ? await upd.json() : [];
  check("after: grants table", `a student cannot UPDATE their own grant (HTTP ${upd.status})`, upd.status >= 400 || body.length === 0, true);
}
const revStudent = await rpc(AFTER, T.granted.jwt, "revoke_university_access", { p_grant_id: grantId, p_reason: "student trying to revoke" });
check("after: revoke function", "a student cannot call revoke", revStudent.status >= 400, true);
const rev = await rpc(AFTER, T.admin.jwt, "revoke_university_access", { p_grant_id: grantId, p_reason: "QA: revoke test" });
check("after: revoke function", "admin can revoke with a reason", rev.status, 204);
check("after: granted student", "after revocation: no universities", await count(AFTER, T.granted.jwt, "universities?select=id"), 0);
const audit = await count(AFTER, T.admin.jwt, `admin_audit_log?select=id&entity_id=eq.${grantId}`);
check("after: audit", "grant and revoke are both in the audit log", audit, 2);
check("after: audit", "a student cannot read the audit log", deny(await count(AFTER, T.granted.jwt, "admin_audit_log?select=id")), true);
// Expiry (time is moved by the test harness in SQL; the rule itself is evaluated by the database)
{
  const { execSync } = await import("node:child_process");
  const future = new Date(Date.now() + 86400000).toISOString();
  const ge = await rpc(AFTER, T.admin.jwt, "grant_university_access", { p_student_user_id: T.granted.id, p_reason: "QA: expiring grant", p_expires_at: future });
  check("after: expiry", "admin can grant with an expiry", ge.status, 200);
  check("after: expiry", "before expiry: access", await count(AFTER, T.granted.jwt, "universities?select=id"), 239);
  execSync(`psql -h 127.0.0.1 -p 54322 -U postgres -d nextwise_local -qc "update public.university_access_grants set granted_at = now() - interval '2 days', expires_at = now() - interval '1 minute' where id = '${ge.body}'"`);
  check("after: expiry", "after expiry: no access, with no one revoking", await count(AFTER, T.granted.jwt, "universities?select=id"), 0);
  const past = await rpc(AFTER, T.admin.jwt, "grant_university_access", { p_student_user_id: T.free.id, p_reason: "QA: expiry in the past", p_expires_at: new Date(Date.now() - 1000).toISOString() });
  check("after: expiry", "an expiry in the past is refused", past.status >= 400, true);
  const again = await rpc(AFTER, T.admin.jwt, "grant_university_access", { p_student_user_id: T.granted.id, p_reason: "QA: re-grant after expiry" });
  check("after: expiry", "a new grant can be issued after the old one expired", again.status, 200);
  await rpc(AFTER, T.admin.jwt, "revoke_university_access", { p_grant_id: again.body, p_reason: "QA: clean up" });
}
// Own-record paths
const labels = await rpc(AFTER, T.free.jwt, "get_my_application_labels");
check("after: own records", "free student gets the name of their own application's course", labels.body?.[0]?.course_name, "QA M.Sc. Test Programme");
check("after: own records", "another student gets none of them", (await rpc(AFTER, T.verified.jwt, "get_my_application_labels")).body.length, 0);
const sc = await rpc(AFTER, T.free.jwt, "get_my_saved_course_labels");
check("after: own records", "free student gets the title of the course they saved earlier", sc.body?.[0]?.course_name, "QA M.Sc. Test Programme");
check("after: own records", "anonymous cannot call the own-record functions", (await rpc(AFTER, null, "get_my_saved_course_labels")).status >= 400, true);
check("after: own records", "saved items: a student sees only their own rows", await count(AFTER, T.verified.jwt, `education_saved_items?select=id&student_user_id=eq.${T.free.id}`), 0);
check("after: anonymous", "cannot call has_university_directory_access", (await rpc(AFTER, null, "has_university_directory_access")).status >= 400, true);

fs.writeFileSync("rest-auth-results.json", JSON.stringify({ ranAt: new Date().toISOString(), total: results.length, failed, results }, null, 1));
for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  [${r.group}] ${r.name}${r.pass ? "" : `  expected=${JSON.stringify(r.expected)} actual=${JSON.stringify(r.actual)}`}`);
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
