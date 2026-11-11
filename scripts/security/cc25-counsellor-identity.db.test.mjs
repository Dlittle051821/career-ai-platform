// CC-25 — database security cycle for counsellor identity access, on a disposable LOCAL PostgreSQL.
//
// Builds a fresh database from the real supabase/migrations 0001-0022, then runs:
//   1. baseline security tests        (the [CC25] checks must FAIL: they reproduce the defects)
//   2. apply the revised 0023          (refused without the approval setting; atomic on forced failure)
//   3. post-migration tests           (every check must PASS)
//   4. rollback                       (catalog must equal the pre-migration catalog exactly)
//   5. rollback verification          (results must equal the baseline results)
//   6. reapply + idempotent re-run    (catalog stable)
//   7. final security tests           (every check must PASS; no fixture data left behind)
//
//   NW_SECURITY_PG_ADMIN_URL=postgres://postgres@127.0.0.1:55433/postgres \
//   NW_SECURITY_PG_DISPOSABLE=1 node --test scripts/security/cc25-counsellor-identity.db.test.mjs
//
// Optional: CC25_EVIDENCE_DIR=<dir> writes each step's results as JSON.
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const adminUrl = process.env.NW_SECURITY_PG_ADMIN_URL;
if (!adminUrl || process.env.NW_SECURITY_PG_DISPOSABLE !== "1")
  throw new Error("Set NW_SECURITY_PG_ADMIN_URL to a disposable local PostgreSQL and NW_SECURITY_PG_DISPOSABLE=1.");
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(adminUrl).hostname))
  throw new Error("Refusing non-loopback PostgreSQL host; this test is for disposable local databases only.");

const DIR = "supabase/migrations-proposed/cc25";
const read = (p) => readFileSync(path.resolve(p), "utf8").replace(/\r\n/g, "\n");
const MIGRATION = read(`${DIR}/0023_cc25_counsellor_identity_least_privilege.sql`);
const ROLLBACK = read(`${DIR}/0023_cc25_ROLLBACK.sql`);
const TESTS = read(`${DIR}/0023_cc25_rls_tests.sql`);
const evidenceDir = process.env.CC25_EVIDENCE_DIR;
const dbName = `cc25_identity_${process.pid}`;

// OID-independent catalog fingerprint of public/auth: relations, columns, constraints,
// indexes, triggers, policies, functions (body hash, definer, config, ACL), table ACLs.
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
   from pg_proc p join ns on ns.oid=p.pronamespace) q)
) fp`;

async function dataFingerprint(c) {
  const tables = (await c.query(`select format('%I.%I',n.nspname,c.relname) t from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where c.relkind='r' and n.nspname in ('public','auth') order by 1`)).rows.map((r) => r.t);
  const out = {};
  for (const t of tables)
    out[t] = (await c.query(`select count(*)::int n, coalesce(md5(string_agg(x::text,'|' order by x::text)),'') h from ${t} x`)).rows[0];
  return out;
}

let db;
async function connect(name) {
  const u = new URL(adminUrl);
  u.pathname = "/" + name;
  const c = new pg.Client({ connectionString: u.href });
  c.on("error", () => {});
  await c.connect();
  return c;
}

async function freshDatabase() {
  const a = new pg.Client({ connectionString: adminUrl });
  await a.connect();
  await a.query(`drop database if exists ${dbName} with (force)`);
  await a.query(`create database ${dbName}`);
  await a.end();
  const c = await connect(dbName);
  await c.query(`do $$begin
    if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin noinherit; end if;
    if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin noinherit; end if;
    if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin noinherit bypassrls; end if;
  end$$;`);
  await c.query([
    "create extension if not exists pgcrypto; create extension if not exists pg_trgm;",
    "create schema auth; create schema storage;",
    "create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');",
    // Supabase's auth.uid(): request.jwt.claim.sub first, then the claims JSON.
    "create function auth.uid() returns uuid language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;",
    "grant usage on schema auth, storage, public to anon, authenticated, service_role;",
    "grant execute on function auth.uid() to anon, authenticated, service_role;",
    "create table storage.buckets(id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);",
    "create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid, owner_id text, metadata jsonb, created_at timestamptz default now(), updated_at timestamptz default now(), unique(bucket_id, name));",
    "alter table storage.objects enable row level security; grant all on all tables in schema storage to service_role;",
    // Supabase-like broad defaults: the migration must close these explicitly.
    "alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;",
    "alter default privileges in schema public grant all on tables to anon, authenticated, service_role;",
  ].join("\n"));
  const migrations = readdirSync("supabase/migrations").filter((x) => x.endsWith(".sql")).sort();
  assert.equal(migrations.length, 22, "expected exactly migrations 0001-0022");
  for (const f of migrations) await c.query(read("supabase/migrations/" + f));
  return c;
}

async function runSuite(label) {
  const notices = [];
  const onNotice = (n) => notices.push(n.message);
  db.on("notice", onNotice);
  let error = null;
  try {
    await db.query("select set_config('nextwise.cc25_test_target','LOCAL-DISPOSABLE-TEST',false)");
    await db.query(TESTS);
  } catch (e) {
    error = e;
    await db.query("rollback").catch(() => {});
  } finally {
    db.off("notice", onNotice);
  }
  const results = notices
    .filter((m) => /^CC25\|(PASS|FAIL)\|/.test(m))
    .map((m) => {
      const [, status, id, name, detail] = m.split("|");
      return { id, status, name, detail: detail ?? null };
    });
  if (evidenceDir) {
    mkdirSync(evidenceDir, { recursive: true });
    writeFileSync(path.join(evidenceDir, `${label}.json`), JSON.stringify({ label, error: error?.message ?? null, results }, null, 2));
    writeFileSync(path.join(evidenceDir, `${label}.txt`), results.map((r) => `${r.status} ${r.id} ${r.name}${r.detail ? " | " + r.detail : ""}`).join("\n") + "\n");
  }
  return { error, results };
}

async function applySql(sql, setting, value) {
  await db.query("select set_config($1,$2,false)", [setting, value]);
  try {
    await db.query(sql);
    return null;
  } catch (e) {
    await db.query("rollback").catch(() => {});
    return e;
  } finally {
    await db.query("select set_config($1,'',false)", [setting]);
  }
}
const applyMigration = (sql = MIGRATION, value = "LOCAL-DISPOSABLE-TEST") => applySql(sql, "nextwise.cc25_0023_approval", value);
const applyRollback = () => applySql(ROLLBACK, "nextwise.cc25_0023_rollback", "LOCAL-DISPOSABLE-TEST");
const catalog = async () => (await db.query(CATALOG)).rows[0].fp;
const byId = (results) => Object.fromEntries(results.map((r) => [r.id, r.status]));

let preCatalog, preData, baseline;

before(async () => { db = await freshDatabase(); }, { timeout: 240000 });
after(async () => {
  if (db) await db.end();
  const a = new pg.Client({ connectionString: adminUrl });
  await a.connect();
  await a.query(`drop database if exists ${dbName} with (force)`);
  await a.end();
});

test("1. baseline: the [CC25] checks fail (defects reproduced), every other check passes", async () => {
  preCatalog = await catalog();
  preData = await dataFingerprint(db);
  baseline = await runSuite("1-baseline");
  assert.ok(baseline.error, "the suite must exit with an error on the unmigrated baseline");
  assert.ok(baseline.results.length >= 80, `expected the full suite, got ${baseline.results.length} checks`);
  for (const r of baseline.results) {
    if (r.name.startsWith("[CC25]")) assert.equal(r.status, "FAIL", `${r.id} should reproduce a defect on the baseline`);
    else assert.equal(r.status, "PASS", `${r.id} (${r.name}) must already pass on the baseline: ${r.detail}`);
  }
  assert.deepEqual(await dataFingerprint(db), preData, "the suite must leave no data behind");
});

test("2a. the migration is refused without the approval setting and changes nothing", async () => {
  for (const value of ["", "APPROVED-PRODUCTION", "yes"]) {
    const err = await applyMigration(MIGRATION, value);
    assert.ok(err);
    assert.match(err.message, /CC25-0023 refused/);
    assert.deepEqual(await catalog(), preCatalog);
  }
});

test("2b. a forced failure before COMMIT leaves the catalog and data byte-identical", async () => {
  // Function replacer: a string replacement would turn "$$" into "$".
  const forced = MIGRATION.replace(/\ncommit;\s*$/, () => "\ndo $$ begin raise exception 'CC25 FORCED FAILURE'; end $$;\ncommit;\n");
  assert.notEqual(forced, MIGRATION);
  const err = await applyMigration(forced);
  assert.ok(err);
  assert.match(err.message, /CC25 FORCED FAILURE/);
  assert.deepEqual(await catalog(), preCatalog);
  assert.deepEqual(await dataFingerprint(db), preData);
});

test("2c/3. migration applies; every security check passes", async () => {
  assert.equal(await applyMigration(), null);
  const post = await runSuite("3-post-migration");
  assert.equal(post.error, null, post.error?.message);
  const failed = post.results.filter((r) => r.status !== "PASS");
  assert.deepEqual(failed, []);
  assert.equal(post.results.length, baseline.results.length);
  assert.deepEqual(await dataFingerprint(db), preData, "the suite must leave no data behind");
});

test("4/5. rollback restores the exact pre-migration catalog and the baseline behaviour", async () => {
  assert.equal(await applyRollback(), null);
  assert.deepEqual(await catalog(), preCatalog);
  const rb = await runSuite("5-after-rollback");
  assert.ok(rb.error);
  assert.deepEqual(byId(rb.results), byId(baseline.results));
  assert.equal(await applyRollback(), null, "rollback must be re-runnable");
  assert.deepEqual(await catalog(), preCatalog);
});

test("6/7. reapply, idempotent re-run, final security tests", async () => {
  assert.equal(await applyMigration(), null);
  const once = await catalog();
  assert.equal(await applyMigration(), null, "the migration must be re-runnable");
  assert.deepEqual(await catalog(), once);
  const final = await runSuite("7-final");
  assert.equal(final.error, null, final.error?.message);
  assert.deepEqual(final.results.filter((r) => r.status !== "PASS"), []);
  assert.deepEqual(await dataFingerprint(db), preData);
});

// Mutation check: the suite must catch a weakened implementation, not just pass.
const MUTANTS = [
  ["identity RPC ignores the session status", "          and s.status in ('requested', 'scheduled')\n          and exists (select 1 from public.counsellors c where c.id = v_cid and c.is_active)", "          and exists (select 1 from public.counsellors c where c.id = v_cid and c.is_active)", ["I04"]],
  ["identity RPC ignores the approval", "          and s.assignment_approved_counsellor_id = v_cid\n          and s.assignment_approved_at is not null\n          and s.status in ('requested', 'scheduled')", "          and s.status in ('requested', 'scheduled')", ["I03"]],
  ["guard trigger does not lock student_user_id", "  if new.id is distinct from old.id or new.student_user_id is distinct from old.student_user_id then", "  if new.id is distinct from old.id then", ["A01", "M08"]],
  ["provenance helper ignores the status", "      and s.assignment_approved_at is not null\n      and s.status in ('requested', 'scheduled')\n  );", "      and s.assignment_approved_at is not null\n  );", ["V03", "V04"]],
];
for (const [label, from, to, mustFail] of MUTANTS) {
  test(`8. mutation "${label}" is detected by the suite`, async () => {
    assert.ok(MIGRATION.includes(from), `mutation anchor missing for ${label}`);
    assert.equal(await applyRollback(), null);
    assert.equal(await applyMigration(MIGRATION.replace(from, () => to)), null);
    const res = await runSuite(`8-mutant-${label.replace(/\W+/g, "-")}`);
    assert.ok(res.error, "the suite must fail on a weakened implementation");
    const status = byId(res.results);
    for (const id of mustFail) assert.equal(status[id], "FAIL", `${id} should catch: ${label}`);
    assert.equal(await applyRollback(), null);
    assert.equal(await applyMigration(), null);
  });
}

// Optional stopgap 0024: anonymous/student EXECUTE removed from three internal definer RPCs.
const STOPGAP = read(`${DIR}/0024_cc25_revoke_anon_internal_rpcs.sql`);
const STOPGAP_ROLLBACK = read(`${DIR}/0024_cc25_ROLLBACK.sql`);
const INTERNAL = ["public.record_system_audit_log(text,text,text,text,jsonb,jsonb)", "public.set_signature_document_path(text,text,text)", "public.set_stamp_document_path(text,text,text)"];
const privileges = async () =>
  (await db.query(`select f, r, has_function_privilege(r, f, 'execute') ok from unnest($1::text[]) f, unnest(array['anon','authenticated','service_role']) r order by 1, 2`, [INTERNAL])).rows
    .map((x) => `${x.f}|${x.r}|${x.ok}`);
async function tryAs(role, sql) {
  await db.query("begin");
  try { await db.query(`set local role ${role}`); await db.query(sql); return "ok"; }
  catch (e) { return e.code; }
  finally { await db.query("rollback"); }
}
test("9. stopgap 0024: anon and students lose EXECUTE, service_role keeps it, rollback restores the grants", async () => {
  const before = await privileges();
  assert.ok(before.includes(`${INTERNAL[0]}|anon|true`), "baseline: anon can forge system audit entries (defect reproduced)");
  assert.equal(await tryAs("anon", "select public.record_system_audit_log('CC25_PROBE','probe',null,'probe')"), "ok");
  const refused = await applySql(STOPGAP, "nextwise.cc25_0024_approval", "");
  assert.match(refused?.message ?? "", /CC25-0024 refused/);
  assert.equal(await applySql(STOPGAP, "nextwise.cc25_0024_approval", "LOCAL-DISPOSABLE-TEST"), null);
  const after = await privileges();
  for (const f of INTERNAL) {
    assert.ok(after.includes(`${f}|anon|false`) && after.includes(`${f}|authenticated|false`) && after.includes(`${f}|service_role|true`), f);
  }
  assert.equal(await tryAs("anon", "select public.record_system_audit_log('CC25_PROBE','probe',null,'probe')"), "42501");
  assert.equal(await tryAs("authenticated", "select public.set_signature_document_path('x','y','z')"), "42501");
  assert.equal(await tryAs("service_role", "select public.record_system_audit_log('CC25_PROBE','probe',null,'probe')"), "ok");
  assert.equal(await applySql(STOPGAP, "nextwise.cc25_0024_approval", "LOCAL-DISPOSABLE-TEST"), null, "re-runnable");
  assert.equal(await applySql(STOPGAP_ROLLBACK, "nextwise.cc25_0024_rollback", "LOCAL-DISPOSABLE-TEST"), null);
  assert.deepEqual(await privileges(), before);
  assert.equal(await applySql(STOPGAP, "nextwise.cc25_0024_approval", "LOCAL-DISPOSABLE-TEST"), null);
  // 0023 is unaffected by 0024
  const suite = await runSuite("9-final-with-0024");
  assert.equal(suite.error, null, suite.error?.message);
});
