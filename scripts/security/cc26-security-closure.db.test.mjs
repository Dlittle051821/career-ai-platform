// CC-26 — database security cycle for 0023 revision 2, 0024, 0025 and 0026 on a
// disposable LOCAL PostgreSQL. Two database states are built from the real files:
//   base : supabase/migrations 0001-0022                (what the repository ships)
//   qa   : base + proposed NW05, NW06, NW07, NW09         (what QA is recorded to have)
// For each state:
//   1. baseline: CC-25 suite on 0023-free DB is not run here (cc25 harness does it);
//      the NW07 self-claim exposure is reproduced on the qa state before 0023
//   2. every migration refuses without its approval setting, and is atomic on a forced failure
//   3. apply 0023 r2 -> 0024 -> 0025 -> 0026; re-run each (idempotent catalog)
//   4. CC-25 suite (89 checks) and CC-26 suite must fully pass (no FAIL; NW07 checks SKIP on base)
//   5. rollback 0026 -> 0025 -> 0024 -> 0023: catalog and default ACL equal the pre-migration state
//   6. reapply: catalog equals the first application
//   7. mutation tests: each re-opened defect must be caught by the suites
// Plus: forward-path compatibility with NW-F01 (01-03, 05, 06) and NW01 in both orders.
// Plus: the patched NW07 without 0023 is caseload-only (never the session rule);
// 0023 r2 rolls back to whichever NW07 state it replaced; and every apply order
// (original NW07 -> 0023, patched NW07 -> 0023, 0023 -> patched NW07) converges.
//
//   NW_SECURITY_PG_ADMIN_URL=postgres://postgres@127.0.0.1:55433/postgres \
//   NW_SECURITY_PG_DISPOSABLE=1 node --test scripts/security/cc26-security-closure.db.test.mjs
// Optional: CC26_EVIDENCE_DIR=<dir> writes each suite run as text.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const adminUrl = process.env.NW_SECURITY_PG_ADMIN_URL;
if (!adminUrl || process.env.NW_SECURITY_PG_DISPOSABLE !== "1")
  throw new Error("Set NW_SECURITY_PG_ADMIN_URL to a disposable local PostgreSQL and NW_SECURITY_PG_DISPOSABLE=1.");
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(adminUrl).hostname))
  throw new Error("Refusing non-loopback PostgreSQL host; this test is for disposable local databases only.");

const read = (p) => readFileSync(path.resolve(p), "utf8").replace(/\r\n/g, "\n");
const P = "supabase/migrations-proposed";
const M = {
  m23: { sql: read(`${P}/cc25/0023_cc25_counsellor_identity_least_privilege.sql`), rb: read(`${P}/cc25/0023_cc25_ROLLBACK.sql`), set: "nextwise.cc25_0023_approval", rbset: "nextwise.cc25_0023_rollback" },
  m24: { sql: read(`${P}/cc25/0024_cc25_revoke_anon_internal_rpcs.sql`), rb: read(`${P}/cc25/0024_cc25_ROLLBACK.sql`), set: "nextwise.cc25_0024_approval", rbset: "nextwise.cc25_0024_rollback" },
  m25: { sql: read(`${P}/cc26/0025_cc26_inactive_counsellor_and_grant_hardening.sql`), rb: read(`${P}/cc26/0025_cc26_ROLLBACK.sql`), set: "nextwise.cc26_0025_approval", rbset: "nextwise.cc26_0025_rollback" },
  m26: { sql: read(`${P}/cc26/0026_cc26_database_checkout_gate.sql`), rb: read(`${P}/cc26/0026_cc26_ROLLBACK.sql`), set: "nextwise.cc26_0026_approval", rbset: "nextwise.cc26_0026_rollback" },
};
const ORDER = ["m23", "m24", "m25", "m26"];
const CC25_TESTS = read(`${P}/cc25/0023_cc25_rls_tests.sql`);
const CC26_TESTS = read(`${P}/cc26/cc26_security_tests.sql`);
const NW07_PATCHED = read(`${P}/NW07_counsellor_studio_foundation.sql`);
const QA_EXTRAS = ["NW05_student_mark_section_self_entered.sql", "NW06_application_tasks.sql", "NW07_counsellor_studio_foundation.sql", "NW09_ai_career_intelligence.sql"];
const evidenceDir = process.env.CC26_EVIDENCE_DIR;

// NW07 as it was before CC-26 (the state recorded on QA): the patched file with
// PART 1 replaced by the original text kept in this test as a fixture.
const NW07_ORIGINAL_PART1 = read("scripts/security/fixtures/NW07_part1_original.sql");
// A function definition exactly as the NW07 file creates it (PART 2+ are unchanged by CC-26).
function nw07Function(name) {
  const start = NW07_PATCHED.indexOf(`create or replace function public.${name}(`);
  assert.ok(start > 0, name);
  return NW07_PATCHED.slice(start, NW07_PATCHED.indexOf("\n$$;", start) + 4);
}
// counsellor_has_case_access as found on QA by read-only inspection (2026-11-12).
const QA_UNSAFE_CASE_ACCESS = `create or replace function public.counsellor_has_case_access(p_student_user_id uuid) returns boolean language sql stable security definer set search_path to 'public' as $function$
  select exists (select 1 from public.admin_student_meta m where m.student_user_id = p_student_user_id and m.assigned_counsellor_id = public.current_counsellor_id())
    or exists (select 1 from public.discovery_sessions ds where ds.student_user_id = p_student_user_id and ds.assigned_counsellor_id = public.current_counsellor_id());
$function$`;
function nw07Original() {
  const start = NW07_PATCHED.indexOf("do $nw07$\n");
  const end = NW07_PATCHED.indexOf("end\n$nw07$;") + "end\n$nw07$;".length;
  assert.ok(start > 0 && end > start, "patched NW07 PART 1 markers not found");
  return NW07_PATCHED.slice(0, start) + NW07_ORIGINAL_PART1 + NW07_PATCHED.slice(end);
}

const CATALOG = `
with ns as (select oid, nspname from pg_namespace where nspname in ('public','auth'))
select jsonb_build_object(
 'relations',(select jsonb_agg(v order by v::text) from (select jsonb_build_array(ns.nspname,c.relname,c.relkind,c.relrowsecurity,c.relacl::text) v
   from pg_class c join ns on ns.oid=c.relnamespace where c.relkind in ('r','v','m','p','S')) q),
 'columns',(select jsonb_agg(v order by v::text) from (select jsonb_build_array(ns.nspname,c.relname,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid),a.attacl::text) v
   from pg_attribute a join pg_class c on c.oid=a.attrelid join ns on ns.oid=c.relnamespace left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
   where a.attnum>0 and not a.attisdropped and c.relkind in ('r','v','m','p')) q),
 'constraints',(select jsonb_agg(v order by v::text) from (select jsonb_build_array(ns.nspname,c.relname,k.conname,pg_get_constraintdef(k.oid)) v
   from pg_constraint k join pg_class c on c.oid=k.conrelid join ns on ns.oid=c.relnamespace) q),
 'indexes',(select jsonb_agg(v order by v::text) from (select jsonb_build_array(t.relname,i.relname,pg_get_indexdef(i.oid)) v
   from pg_class i join pg_index x on x.indexrelid=i.oid join pg_class t on t.oid=x.indrelid join ns on ns.oid=i.relnamespace) q),
 'triggers',(select jsonb_agg(v order by v::text) from (select jsonb_build_array(c.relname,t.tgname,pg_get_triggerdef(t.oid),t.tgenabled) v
   from pg_trigger t join pg_class c on c.oid=t.tgrelid join ns on ns.oid=c.relnamespace where not t.tgisinternal) q),
 'policies',(select jsonb_agg(v order by v::text) from (select jsonb_build_array(schemaname,tablename,policyname,cmd,roles::text,qual,with_check) v
   from pg_policies where schemaname in ('public','auth')) q),
 'functions',(select jsonb_agg(v order by v::text) from (select jsonb_build_array(ns.nspname,p.proname,pg_get_function_identity_arguments(p.oid),md5(p.prosrc),p.prosecdef,p.proconfig::text,p.proacl::text,p.provolatile) v
   from pg_proc p join ns on ns.oid=p.pronamespace) q),
 'default_acl',(select jsonb_agg(v order by v::text) from (select jsonb_build_array(d.defaclrole::regrole::text,d.defaclnamespace::regnamespace::text,d.defaclobjtype,d.defaclacl::text) v
   from pg_default_acl d) q)
) fp`;

const clients = [];
async function connect(name) {
  const u = new URL(adminUrl);
  u.pathname = "/" + name;
  const c = new pg.Client({ connectionString: u.href });
  c.on("error", () => {});
  await c.connect();
  clients.push(c);
  return c;
}
async function admin(sql) {
  const a = new pg.Client({ connectionString: adminUrl });
  await a.connect();
  try { await a.query(sql); } finally { await a.end(); }
}
after(async () => { for (const c of clients) await c.end().catch(() => {}); });

async function buildDatabase(name, extras) {
  await admin(`drop database if exists ${name} with (force)`);
  await admin(`create database ${name}`);
  const c = await connect(name);
  await c.query(`do $$begin
    if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin noinherit; end if;
    if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin noinherit; end if;
    if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin noinherit bypassrls; end if;
  end$$;`);
  await c.query([
    "create extension if not exists pgcrypto; create extension if not exists pg_trgm;",
    "create schema auth; create schema storage;",
    "create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');",
    "create function auth.uid() returns uuid language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;",
    "grant usage on schema auth, storage, public to anon, authenticated, service_role;",
    "grant execute on function auth.uid() to anon, authenticated, service_role;",
    "create table storage.buckets(id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);",
    "create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid, owner_id text, metadata jsonb, created_at timestamptz default now(), updated_at timestamptz default now(), unique(bucket_id, name));",
    "alter table storage.objects enable row level security; grant all on all tables in schema storage to service_role;",
    "alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;",
    "alter default privileges in schema public grant all on tables to anon, authenticated, service_role;",
  ].join("\n"));
  const migrations = readdirSync("supabase/migrations").filter((x) => x.endsWith(".sql")).sort();
  assert.equal(migrations.length, 22, "expected exactly migrations 0001-0022");
  for (const f of migrations) await c.query(read("supabase/migrations/" + f));
  for (const f of extras) {
    if (f === "NW07_counsellor_studio_foundation.sql") await c.query(nw07Original());
    else if (f === "NW07_PATCHED") await c.query(NW07_PATCHED);
    else await c.query(read(`${P}/${f}`));
  }
  return c;
}

const fingerprint = async (c) => JSON.stringify((await c.query(CATALOG)).rows[0].fp);

async function apply(c, key, approved = true) {
  await c.query("select set_config($1,$2,false)", [M[key].set, approved ? "LOCAL-DISPOSABLE-TEST" : ""]);
  try { await c.query(M[key].sql); } catch (e) { await c.query("rollback").catch(() => {}); throw e; }
}
async function rollback(c, key) {
  await c.query("select set_config($1,'LOCAL-DISPOSABLE-TEST',false)", [M[key].rbset]);
  try { await c.query(M[key].rb); } catch (e) { await c.query("rollback").catch(() => {}); throw e; }
}

async function suite(c, label, sql, setting, prefix) {
  const notices = [];
  const onNotice = (n) => notices.push(n.message);
  c.on("notice", onNotice);
  let error = null;
  try {
    await c.query("select set_config($1,'LOCAL-DISPOSABLE-TEST',false)", [setting]);
    await c.query(sql);
  } catch (e) {
    error = e;
    await c.query("rollback").catch(() => {});
  } finally {
    c.off("notice", onNotice);
  }
  const re = new RegExp(`^${prefix}\\|(PASS|FAIL|SKIP|INFO)\\|`);
  const results = notices.filter((m) => re.test(m)).map((m) => {
    const [, status, id, name, detail] = m.split("|");
    return { id, status, name, detail: detail ?? null };
  });
  if (evidenceDir) {
    mkdirSync(evidenceDir, { recursive: true });
    writeFileSync(path.join(evidenceDir, `${label}.txt`),
      results.map((r) => `${r.status} ${r.id} ${r.name}${r.detail ? " | " + r.detail : ""}`).join("\n") + `\nerror: ${error?.message ?? "none"}\n`);
  }
  return { error, results, fails: results.filter((r) => r.status === "FAIL").map((r) => r.id) };
}
const cc25 = (c, label) => suite(c, label, CC25_TESTS, "nextwise.cc25_test_target", "CC25");
const cc26 = (c, label) => suite(c, label, CC26_TESTS, "nextwise.cc26_test_target", "CC26");

// Reproduce the NW07 self-claim exposure before 0023 (qa state only).
async function nw07SelfClaimExposes(c) {
  await c.query("begin");
  try {
    await c.query(`insert into auth.users (id, email) values ('0c26ee00-0000-4000-8000-0000000000c1','probe.c1@example.test'),('0c26ee00-0000-4000-8000-000000000501','probe.s1@example.test')`);
    await c.query(`insert into public.profiles (id, full_name, email) values ('0c26ee00-0000-4000-8000-000000000501','Fictional Probe','probe.s1@example.test') on conflict (id) do update set full_name = excluded.full_name`);
    await c.query(`insert into public.student_profiles (user_id, city) values ('0c26ee00-0000-4000-8000-000000000501','Fictional City') on conflict (user_id) do update set city = excluded.city`);
    await c.query(`insert into public.admin_roles (user_id, role) values ('0c26ee00-0000-4000-8000-0000000000c1','counsellor')`);
    await c.query(`insert into public.counsellors (id, user_id, display_name) values ('0c26ee00-0000-4000-8000-0000000001c1','0c26ee00-0000-4000-8000-0000000000c1','Fictional Probe Counsellor')`);
    await c.query(`insert into public.discovery_sessions (id, student_user_id, status) values ('0c26ee00-0000-4000-8000-000000000d01','0c26ee00-0000-4000-8000-000000000501','requested')`);
    await c.query(`select set_config('request.jwt.claim.sub','0c26ee00-0000-4000-8000-0000000000c1',true)`);
    await c.query("set local role authenticated");
    await c.query(`update public.discovery_sessions set assigned_counsellor_id = public.current_counsellor_id() where id = '0c26ee00-0000-4000-8000-000000000d01'`);
    const r = await c.query(`select (select count(*) from public.student_profiles where user_id = '0c26ee00-0000-4000-8000-000000000501')::int n`);
    return r.rows[0].n === 1;
  } finally {
    await c.query("rollback");
  }
}

for (const state of ["base", "qa"]) {
  const dbName = `cc26_closure_${state}_${process.pid}`;
  test(`[${state}] CC-26 migration cycle`, async (t) => {
    const db = await buildDatabase(dbName, state === "qa" ? QA_EXTRAS : []);
    const pre = await fingerprint(db);

    if (state === "qa") {
      await t.test("baseline: an unapproved self-claim exposes the Student Digital Profile (defect reproduced)", async () => {
        assert.equal(await nw07SelfClaimExposes(db), true);
      });
    }

    await t.test("every migration refuses without its approval setting; catalog unchanged", async () => {
      for (const key of ORDER) {
        await assert.rejects(apply(db, key, false), /refused/);
        assert.equal(await fingerprint(db), pre);
      }
    });

    await t.test("forced failure inside 0023 leaves the catalog unchanged (atomic)", async () => {
      const broken = M.m23.sql.replace("-- 8. Postconditions", "select 1/0;\n-- 8. Postconditions");
      assert.notEqual(broken, M.m23.sql);
      await db.query("select set_config($1,'LOCAL-DISPOSABLE-TEST',false)", [M.m23.set]);
      await assert.rejects(db.query(broken), /division by zero/);
      await db.query("rollback").catch(() => {});
      assert.equal(await fingerprint(db), pre);
    });

    let applied;
    await t.test("apply 0023 r2, 0024, 0025, 0026 in order; each re-run is idempotent", async () => {
      for (const key of ORDER) {
        await apply(db, key);
        const once = await fingerprint(db);
        await apply(db, key);
        assert.equal(await fingerprint(db), once, `${key} re-run changed the catalog`);
      }
      applied = await fingerprint(db);
      assert.notEqual(applied, pre);
    });

    await t.test("CC-25 suite: all 89 checks pass", async () => {
      const r = await cc25(db, `${state}-cc25-after`);
      assert.equal(r.error, null, r.error?.message);
      assert.equal(r.results.filter((x) => x.status === "PASS").length, 89);
    });

    await t.test("CC-26 suite: no failures (NW07 checks SKIP only on base)", async () => {
      const r = await cc26(db, `${state}-cc26-after`);
      assert.equal(r.error, null, r.error?.message);
      assert.deepEqual(r.fails, []);
      const skips = r.results.filter((x) => x.status === "SKIP").length;
      assert.equal(skips, state === "base" ? 35 : 0);
      assert.equal(r.results.filter((x) => x.status === "PASS").length, state === "base" ? 40 : 76);
    });

    await t.test("mutation tests: each re-opened defect is caught", async () => {
      const mutants = [
        { id: "MU1", sql: "create or replace function public.current_counsellor_id() returns uuid language sql security definer stable set search_path = public as $$ select id from public.counsellors where user_id = auth.uid(); $$", expect: "I01" },
        { id: "MU2", sql: "drop trigger invoices_self_checkout_gate_cc26 on public.invoices", expect: "P01" },
        { id: "MU3", sql: "drop trigger payment_attempts_self_checkout_gate_cc26 on public.payment_attempts", expect: "P03" },
        { id: "MU4", sql: "grant truncate on public.admin_audit_log to authenticated", expect: "G01" },
        { id: "MU5", sql: "grant execute on function public.record_system_audit_log(text,text,text,text,jsonb,jsonb) to anon", expect: "R01" },
        { id: "MU6", sql: `alter policy "Admins/counsellors can read discovery sessions" on public.discovery_sessions using (public.is_admin_role(array['super_admin','admin']) or (public.is_admin_role(array['counsellor']) and (assigned_counsellor_id is null or assigned_counsellor_id = public.current_counsellor_id())))`, expect: "I06" },
      ];
      if (state === "qa")
        mutants.push(
          { id: "MU7", sql: "create or replace function public.counsellor_has_case_access(p_student_user_id uuid) returns boolean language sql security definer stable set search_path = '' as $$ select exists (select 1 from public.discovery_sessions ds where ds.student_user_id = p_student_user_id and ds.assigned_counsellor_id = public.current_counsellor_id()) $$", expect: "N05" },
          // The exact definition found on QA (original NW07): caseload OR any assignment, approved or not.
          { id: "MU8", sql: QA_UNSAFE_CASE_ACCESS, expect: ["N05", "N14", "N15", "N16", "N32"] },
          // Authorship again grants read access to drafts (pre-F4 policy).
          { id: "MU9", sql: `alter policy "Admins/author/case counsellor can read recommendation drafts" on public.recommendation_drafts using (public.is_admin_role(array['super_admin','admin']) or (public.is_admin_role(array['counsellor']) and (created_by = auth.uid() or public.counsellor_has_case_access(student_user_id))))`, expect: ["N26", "N30"] },
          // Authorship again grants write access (pre-F4 NW07 RPC body).
          { id: "MU10", sql: nw07Function("staff_update_recommendation_draft_content"), expect: ["N27", "N34"] },
          // The session helper stops requiring admin approval.
          { id: "MU11", sql: "create or replace function public.counsellor_has_active_session_for_student(p_student_user_id uuid) returns boolean language sql stable security definer set search_path = pg_catalog, pg_temp as $$ select auth.uid() is not null and exists (select 1 from public.discovery_sessions s join public.counsellors c on c.id = s.assigned_counsellor_id where s.student_user_id = p_student_user_id and c.user_id = auth.uid() and c.is_active and s.status in ('requested', 'scheduled')) $$", expect: ["N05", "N14", "N24"] },
          // The session helper stops requiring an active (requested/scheduled) session.
          { id: "MU12", sql: "create or replace function public.counsellor_has_active_session_for_student(p_student_user_id uuid) returns boolean language sql stable security definer set search_path = pg_catalog, pg_temp as $$ select auth.uid() is not null and exists (select 1 from public.discovery_sessions s join public.counsellors c on c.id = s.assigned_counsellor_id where s.student_user_id = p_student_user_id and c.user_id = auth.uid() and c.is_active and s.assignment_approved_counsellor_id = s.assigned_counsellor_id and s.assignment_approved_at is not null) $$", expect: ["N10", "N29"] },
        );
      for (const m of mutants) {
        await db.query("begin");
        await db.query(m.sql);
        const notices = [];
        const on = (n) => notices.push(n.message);
        db.on("notice", on);
        await db.query("select set_config('nextwise.cc26_test_target','LOCAL-DISPOSABLE-TEST',true)");
        // run the suite body inside a savepoint so the mutant stays in effect
        const body = CC26_TESTS.replace(/^begin;\s*$/m, "savepoint cc26_suite;").replace(/^rollback;\s*$/m, "rollback to savepoint cc26_suite;");
        await db.query(body).catch(() => {});
        db.off("notice", on);
        await db.query("rollback");
        const failed = notices.filter((x) => x.startsWith("CC26|FAIL|")).map((x) => x.split("|")[2]);
        for (const id of [m.expect].flat())
          assert.ok(failed.includes(id), `${m.id} not caught: expected ${id} to fail, failures were [${failed}]`);
      }
      assert.equal(await fingerprint(db), applied, "mutation tests left a trace");
    });

    await t.test("rollback 0026 -> 0025 -> 0024 -> 0023 restores the exact pre-migration catalog and default ACL", async () => {
      for (const key of [...ORDER].reverse()) await rollback(db, key);
      assert.equal(await fingerprint(db), pre);
    });

    await t.test("reapply equals the first application", async () => {
      for (const key of ORDER) await apply(db, key);
      assert.equal(await fingerprint(db), applied);
    });

    if (state === "qa") {
      await t.test("after reapply the self-claim no longer exposes anything", async () => {
        assert.equal(await nw07SelfClaimExposes(db), false);
      });
    }
  });
}

test("NW07: patched file is safe without 0023, rolls back correctly and converges", async (t) => {
  const QA_PATCHED = ["NW05_student_mark_section_self_entered.sql", "NW06_application_tasks.sql", "NW07_PATCHED", "NW09_ai_career_intelligence.sql"];
  const z = await buildDatabase(`cc26_nw07_z_${process.pid}`, QA_PATCHED);
  const zPre = await fingerprint(z);
  await t.test("patched NW07 without 0023: case access is caseload-only and a self-claim exposes nothing", async () => {
    const body = (await z.query("select prosrc from pg_proc where oid = 'public.counsellor_has_case_access(uuid)'::regprocedure")).rows[0].prosrc;
    assert.doesNotMatch(body, /discovery_sessions/);
    assert.equal(await nw07SelfClaimExposes(z), false);
    const raw = (await z.query(`select count(*)::int n from pg_policies where schemaname = 'public' and tablename <> 'discovery_sessions'
      and coalesce(qual, '') || coalesce(with_check, '') like '%discovery_sessions%' and tablename not in
      ('discovery_session_workspace','student_profile_section_provenance','student_recommendation_verifications')`)).rows[0].n;
    assert.equal(raw, 0, "the patched NW07 must not add any Discovery Session basis");
  });
  await t.test("0023 on top of the patched NW07, then its rollback, restores the caseload-only state exactly", async () => {
    await apply(z, "m23");
    // Only 0023 is applied here, so only the NW07 checks are in scope, and the
    // four that need 0025 (F1 deactivation, F4 authorship) must still fail.
    const r = await cc26(z, "nw07-patched-then-0023-cc26");
    assert.deepEqual(r.fails.filter((id) => id.startsWith("N")), ["N26", "N27", "N30", "N34"]);
    assert.equal(r.results.filter((x) => x.id.startsWith("N") && x.status === "PASS").length, 31);
    await rollback(z, "m23");
    assert.equal(await fingerprint(z), zPre);
  });
  const x = await buildDatabase(`cc26_nw07_x_${process.pid}`, QA_EXTRAS.slice(0, 2));
  await apply(x, "m23");
  await x.query(NW07_PATCHED);
  await x.query(read(`${P}/NW09_ai_career_intelligence.sql`));
  const y = await buildDatabase(`cc26_nw07_y_${process.pid}`, QA_EXTRAS);
  await apply(y, "m23");
  await apply(z, "m23");
  await t.test("all three apply orders give the identical catalog", async () => {
    const fx = await fingerprint(x);
    assert.equal(fx, await fingerprint(y), "0023 -> patched NW07  vs  original NW07 -> 0023");
    assert.equal(fx, await fingerprint(z), "0023 -> patched NW07  vs  patched NW07 -> 0023");
  });
  await t.test("rolling back 0023 when NW07 came after it leaves the safe caseload-only state", async () => {
    await rollback(x, "m23");
    const body = (await x.query("select prosrc from pg_proc where oid = 'public.counsellor_has_case_access(uuid)'::regprocedure")).rows[0].prosrc;
    assert.doesNotMatch(body, /discovery_sessions/);
    assert.equal(await nw07SelfClaimExposes(x), false);
  });
});

// Forward path on QA: the pending NW-F01 package (NW09.2 atomic 01-03, 05, 06)
// and NW01 must coexist with the CC-26 set in either order.
const NWF01 = [
  { sql: read(`${P}/nw-f01-s3/NW09_2_ATOMIC_01-03.sql`), set: "nextwise.nw09_2_atomic_approval", value: "LOCAL-DISPOSABLE-TEST" },
  { sql: read(`${P}/nw-f01-s3/05_payment_attempt_integrity.sql`) },
  { sql: read(`${P}/nw-f01-s3/06_payment_capture_reconciliation.sql`) },
  { sql: read(`${P}/NW01_fix_purchase_pricing_plan_tax_handling.sql`) },
];
async function applyNwf01(c) {
  for (const f of NWF01) {
    if (f.set) await c.query("select set_config($1,$2,false)", [f.set, f.value]);
    await c.query(f.sql);
  }
}
const unpinnedDefiners = `select count(*)::int n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public','nextwise_security') and p.prosecdef
    and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search\\_path=%' and c like '%pg\\_temp')`;

test("forward path: CC-26 set and NW-F01 + NW01 in either order", async (t) => {
  const a = await buildDatabase(`cc26_fwd_a_${process.pid}`, QA_EXTRAS);
  for (const key of ORDER) await apply(a, key);
  await applyNwf01(a);
  const b = await buildDatabase(`cc26_fwd_b_${process.pid}`, QA_EXTRAS);
  await applyNwf01(b);
  for (const key of ORDER) await apply(b, key);
  await t.test("both orders give the identical catalog", async () => {
    assert.equal(await fingerprint(a), await fingerprint(b));
  });
  for (const [label, db] of [["a", a], ["b", b]]) {
    await t.test(`order ${label}: CC-25 (89) and CC-26 (76) suites pass`, async () => {
      const r25 = await cc25(db, `fwd-${label}-cc25`);
      assert.equal(r25.error, null, r25.error?.message);
      assert.equal(r25.results.filter((x) => x.status === "PASS").length, 89);
      const r26 = await cc26(db, `fwd-${label}-cc26`);
      assert.equal(r26.error, null, r26.error?.message);
      assert.deepEqual(r26.fails, []);
      assert.equal(r26.results.filter((x) => x.status === "PASS").length, 76);
      const p11 = r26.results.find((x) => x.id === "P11");
      assert.match(p11.detail, /total_minor_units=199900 \(tax-inclusive: correct\)/, "with NW01 the GST-registered total must be exactly ₹1,999");
    });
    await t.test(`order ${label}: every SECURITY DEFINER function stays pinned with pg_temp last (NW-F01 F7)`, async () => {
      assert.equal((await db.query(unpinnedDefiners)).rows[0].n, 0);
    });
  }
  await t.test("rolling back the CC-26 set after NW-F01 keeps F7 (no unpinned definer)", async () => {
    for (const key of [...ORDER].reverse()) await rollback(a, key);
    assert.equal((await a.query(unpinnedDefiners)).rows[0].n, 0);
  });
});
