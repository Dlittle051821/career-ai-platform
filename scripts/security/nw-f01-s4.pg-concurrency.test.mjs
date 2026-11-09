// Real multi-session PostgreSQL concurrency checks for the NW-F01 S4 finalizer.
// Disposable LOCAL databases only: the script creates and drops its own database
// and refuses any non-loopback host. The server must run with track_commit_timestamp=on. It never reads .env files or remote credentials.
//
//   NW_SECURITY_PG_ADMIN_URL=postgres://postgres@localhost:54329/postgres \
//   NW_SECURITY_PG_DISPOSABLE=1 node --test scripts/security/nw-f01-s4.pg-concurrency.test.mjs
import {before,after,test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import path from "node:path";
import pg from "pg";

const adminUrl=process.env.NW_SECURITY_PG_ADMIN_URL;
if(!adminUrl||process.env.NW_SECURITY_PG_DISPOSABLE!=="1")
 throw new Error("Set NW_SECURITY_PG_ADMIN_URL to a disposable local PostgreSQL and NW_SECURITY_PG_DISPOSABLE=1.");
const parsed=new URL(adminUrl);
if(!["localhost","127.0.0.1","[::1]"].includes(parsed.hostname))
 throw new Error("Refusing non-loopback PostgreSQL host; this suite is for disposable local databases only.");
const dbName="nw_f01_s4_concurrency_"+process.pid;
const dbUrl=new URL(adminUrl);dbUrl.pathname="/"+dbName;

const read=(p)=>readFileSync(path.resolve(p),"utf8");
const bundle="supabase/migrations-proposed/nw-f01-s3/";
const id=(n)=>"00000000-0000-4000-8000-"+String(n).padStart(12,"0");
const admin=id(1),ca=id(2),cb=id(3),sa=id(4),consent=id(50);
const sessions=[];
let root;

async function connect(uid=null){
 const c=new pg.Client({connectionString:dbUrl.href});await c.connect();sessions.push(c);
 c.backendPid=(await c.query("select pg_backend_pid() p")).rows[0].p;
 c.uid=uid;
 if(uid){await c.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);await c.query("set role authenticated");}
 return c;
}
const pid=async(c)=>c.backendPid;
async function waitBlockedBy(waiter,holder){
 const w=await pid(waiter),h=await pid(holder);
 for(let i=0;i<200;i++){
  const r=await root.query("select $2::int = any(pg_blocking_pids($1)) blocked",[w,h]);
  if(r.rows[0].blocked)return;
  await new Promise(res=>setTimeout(res,25));
 }
 throw new Error("Waiter never blocked on holder");
}
let keys=0;
let limits=[20,3,100,25,5,2];
async function reserve(c,provider="mock",key){
 const v=[sa,key??("pg_request_"+process.pid+"_"+String(++keys).padStart(6,"0")),provider,
 provider==="openai"?"offline-model":"mock-model","prompt-v1","report-v1","fictional",consent,0,...limits,null,null];
 return (await c.query("select * from public.staff_reserve_ai_generation_run_v2("+v.map((_,i)=>"$"+(i+1)).join(",")+")",v)).rows[0];
}
// CC-16 (F1): the trusted server finalizes as service_role on behalf of the
// session's authenticated staff user. Queries on one client run in order, so
// the role switch, the (possibly blocked) call and the switch back stay paired.
function finalize(c,run,provider="mock"){
 const model=provider==="openai"?"offline-model":"mock-model",resp=provider==="openai"?"pg-response":null;
 c.query("set role service_role").catch(()=>{});
 const call=c.query("select public.staff_finalize_ai_generation_run($1,$2,$3,$4,$5,$6,$7) result",[c.uid,run,sa,consent,
  {studentProfileRef:{studentUserId:sa},generation:{provider,model,dataClass:"fictional",providerResponseId:resp}},
  {aiAssisted:true,summary:"pg content"},
  {model,inputTokens:123,outputTokens:45,cachedInputTokens:0,reasoningTokens:0,estimatedCostUsd:0,attempts:1,latencyMs:1,providerResponseId:resp}
 ]).then(r=>r.rows[0].result);
 c.query("set role authenticated").catch(()=>{});
 return call;
}
const withdraw=(c)=>c.query("select public.staff_withdraw_ai_processing_consent($1,'pg withdrawal')",[consent]);
async function counts(){return (await root.query("select (select count(*)::int from public.recommendation_drafts) drafts,(select count(*)::int from public.recommendation_draft_versions) versions,(select count(*)::int from public.ai_generation_runs where report is not null) reports")).rows[0];}
async function resetState(){
 await root.query("delete from public.ai_generation_runs");
 await root.query("update public.recommendation_drafts set current_version_id=null");
 await root.query("delete from public.recommendation_draft_versions");
 await root.query("delete from public.recommendation_drafts");
 await root.query("update public.student_ai_processing_consents set withdrawn_at=null,withdrawn_by=null,withdrawal_reason=null where id=$1",[consent]);
}

before(async()=>{
 const a=new pg.Client({connectionString:adminUrl});await a.connect();
 await a.query("create database "+dbName);await a.end();
 root=new pg.Client({connectionString:dbUrl.href});await root.connect();
 if((await root.query("show track_commit_timestamp")).rows[0].track_commit_timestamp!=="on")throw new Error("Start the disposable server with track_commit_timestamp=on.");
 await root.query(`do $$begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin noinherit; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin noinherit; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin noinherit bypassrls; end if;
 end$$;`);
 await root.query([
 "create extension if not exists pgcrypto;create extension if not exists pg_trgm;",
 "create schema auth;create schema storage;",
 "create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');",
 "create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;",
 "grant usage on schema auth,storage,public to anon,authenticated,service_role;",
 "grant execute on function auth.uid() to anon,authenticated,service_role;",
 "create table storage.buckets(id text primary key,name text,public boolean default false,file_size_limit bigint,allowed_mime_types text[]);",
 "create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,owner uuid,owner_id text,metadata jsonb,created_at timestamptz default now(),updated_at timestamptz default now(),unique(bucket_id,name));",
 "alter table storage.objects enable row level security;grant all on all tables in schema storage to service_role;",
 "alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;",
 "alter default privileges in schema public grant all on tables to anon,authenticated,service_role;"
 ].join("\n"));
 for(const f of readdirSync("supabase/migrations").filter(x=>x.endsWith(".sql")).sort())
  try{await root.query(read("supabase/migrations/"+f));}catch(e){throw new Error("Baseline "+f+": "+e.message,{cause:e});}
 for(const f of ["NW05_student_mark_section_self_entered.sql","NW06_application_tasks.sql","NW07_counsellor_studio_foundation.sql","NW09_ai_career_intelligence.sql"])
  await root.query(read("supabase/migrations-proposed/"+f));
 for(const f of ["01_internal_rpcs.sql","02_nw09_2_replacement.sql","03_review_separation_and_grants.sql"])
  try{await root.query(read(bundle+f));}catch(e){throw new Error("Package "+f+": "+e.message,{cause:e});}
 await root.query("grant connect on database "+dbName+" to authenticated");
 await root.query("insert into auth.users(id,email) select x,'pg-'||x||'@example.invalid' from unnest($1::uuid[]) x",[[admin,ca,cb,sa]]);
 await root.query("insert into public.admin_roles(user_id,role) values($1,'super_admin'),($2,'counsellor'),($3,'counsellor')",[admin,ca,cb]);
 await root.query("insert into public.counsellors(id,user_id,display_name) values($1,$2,'PG A'),($3,$4,'PG B')",[id(20),ca,id(21),cb]);
 await root.query("insert into public.admin_student_meta(student_user_id,assigned_counsellor_id) values($1,$2)",[sa,id(20)]);
 await root.query("insert into nextwise_security.fictional_students values($1,'pg approval',$2,now(),now()+interval '1 day')",[sa,admin]);
 await root.query("insert into nextwise_security.ai_model_reservations values('openai','offline-model',0.4,'pg approved ceiling')");
 await root.query("insert into public.student_ai_processing_consents(id,student_user_id,consenting_party,method,evidence_reference,given_on,recorded_by) values($1,$2,'student','fictional_test_account','pg evidence',current_date,$3)",[consent,sa,admin]);
},{timeout:180000});
after(async()=>{
 for(const c of sessions)await c.end().catch(()=>{});
 if(root)await root.end();
 const a=new pg.Client({connectionString:adminUrl});await a.connect();
 await a.query("drop database if exists "+dbName+" with (force)");await a.end();
});

test("withdrawal commits first while finalizer waits: consent_withdrawn, no content, cost retained",async()=>{
 await resetState();const t1=await connect(ca),t2=await connect(ca);
 const run=await reserve(t1,"openai");
 await t1.query("begin");await withdraw(t1);
 await t2.query("begin");const pending=finalize(t2,run.run_id,"openai");
 await waitBlockedBy(t2,t1);await t1.query("commit");
 assert.equal((await pending).outcome,"consent_withdrawn");await t2.query("commit");
 assert.deepEqual(await counts(),{drafts:0,versions:0,reports:0});
 const r=(await root.query("select status,estimated_cost_usd,provider_response_id from public.ai_generation_runs where id=$1",[run.run_id])).rows[0];
 assert.equal(r.status,"failed");assert.equal(Number(r.estimated_cost_usd),0.4);assert.equal(r.provider_response_id,"pg-response");
});
test("finalization commits first while withdrawal waits: one result, withdrawal then blocks new work",async()=>{
 await resetState();const t1=await connect(ca),t2=await connect(ca);
 const run=await reserve(t1);
 await t1.query("begin");const done=await finalize(t1,run.run_id);assert.equal(done.outcome,"finalized");
 await t2.query("begin");const pending=withdraw(t2);
 await waitBlockedBy(t2,t1);await t1.query("commit");await pending;await t2.query("commit");
 assert.deepEqual(await counts(),{drafts:1,versions:1,reports:1});
 await assert.rejects(()=>reserve(t1),/valid recorded/);
 assert.equal((await finalize(t1,run.run_id)).outcome,"duplicate");
});
test("withdrawal rolls back while finalizer waits: finalizer proceeds",async()=>{
 await resetState();const t1=await connect(ca),t2=await connect(ca);
 const run=await reserve(t1);
 await t1.query("begin");await withdraw(t1);
 const pending=finalize(t2,run.run_id);await waitBlockedBy(t2,t1);await t1.query("rollback");
 assert.equal((await pending).outcome,"finalized");assert.deepEqual(await counts(),{drafts:1,versions:1,reports:1});
});
test("duplicate finalization in two sessions: exactly one draft, same draft id",async()=>{
 await resetState();const t1=await connect(ca),t2=await connect(ca);
 const run=await reserve(t1);
 await t1.query("begin");const first=await finalize(t1,run.run_id);
 const pending=finalize(t2,run.run_id);await waitBlockedBy(t2,t1);await t1.query("commit");
 const second=await pending;
 assert.equal(first.outcome,"finalized");assert.equal(second.outcome,"duplicate");assert.equal(second.draft_id,first.draft_id);
 assert.deepEqual(await counts(),{drafts:1,versions:1,reports:1});
});
test("first finalizer aborts: waiting retry finalizes exactly once",async()=>{
 await resetState();const t1=await connect(ca),t2=await connect(ca);
 const run=await reserve(t1);
 await t1.query("begin");assert.equal((await finalize(t1,run.run_id)).outcome,"finalized");
 const pending=finalize(t2,run.run_id);await waitBlockedBy(t2,t1);await t1.query("rollback");
 assert.equal((await pending).outcome,"finalized");assert.deepEqual(await counts(),{drafts:1,versions:1,reports:1});
});
test("finalization aborts while withdrawal waits: withdrawal commits and later finalization stores nothing",async()=>{
 await resetState();const t1=await connect(ca),t2=await connect(ca);
 const run=await reserve(t1,"openai");
 await t1.query("begin");assert.equal((await finalize(t1,run.run_id,"openai")).outcome,"finalized");
 const pending=withdraw(t2);await waitBlockedBy(t2,t1);await t1.query("rollback");await pending;
 const r=(await root.query("select status,reserved_cost_usd from public.ai_generation_runs where id=$1",[run.run_id])).rows[0];
 assert.equal(r.status,"reserved");assert.equal(Number(r.reserved_cost_usd),0.4);
 assert.equal((await finalize(t1,run.run_id,"openai")).outcome,"consent_withdrawn");
 assert.deepEqual(await counts(),{drafts:0,versions:0,reports:0});
});
test("case reassignment committed while the finalizer waits is enforced after the lock",async()=>{
 await resetState();const t1=await connect(ca),holder=await connect(null),changer=await connect(null);
 const run=await reserve(t1);
 await holder.query("begin");await holder.query("select pg_advisory_xact_lock(hashtext('public.ai_generation_runs'))");
 const pending=finalize(t1,run.run_id).then(()=>null,e=>e);await waitBlockedBy(t1,holder);
 await changer.query("update public.admin_student_meta set assigned_counsellor_id=$1 where student_user_id=$2",[id(21),sa]);
 await holder.query("commit");
 const err=await pending;
 await root.query("update public.admin_student_meta set assigned_counsellor_id=$1 where student_user_id=$2",[id(20),sa]);
 assert.ok(err,"reassigned requester finalized");assert.match(err.message,/authorized/);
 assert.deepEqual(await counts(),{drafts:0,versions:0,reports:0});
});
test("REPEATABLE READ finalizer racing a withdrawal fails safe with 40001 and no content",async()=>{
 await resetState();const t1=await connect(ca),t2=await connect(ca);
 const run=await reserve(t1);
 await t2.query("begin isolation level repeatable read");await t2.query("select count(*) from public.ai_generation_runs");
 await t1.query("begin");await withdraw(t1);
 const pending=finalize(t2,run.run_id).then(()=>null,e=>e);
 await waitBlockedBy(t2,t1);await t1.query("commit");
 const err=await pending;assert.ok(err,"finalizer unexpectedly succeeded");assert.equal(err.code,"40001");
 await t2.query("rollback");
 assert.deepEqual(await counts(),{drafts:0,versions:0,reports:0});
 assert.equal((await finalize(t2,run.run_id)).outcome,"consent_withdrawn");
});
test("parallel reservations with the same idempotency key create one run",async()=>{
 await resetState();const t1=await connect(ca),t2=await connect(ca);
 const key="pg_parallel_key_"+process.pid;
 await t1.query("begin");const a=await reserve(t1,"mock",key);
 const pending=reserve(t2,"mock",key);await waitBlockedBy(t2,t1);await t1.query("commit");
 const b=await pending;assert.equal(b.run_id,a.run_id);
 assert.equal((await root.query("select count(*)::int n from public.ai_generation_runs")).rows[0].n,1);
});
test("mixed concurrent workload produces no deadlocks and no unauthorized content",async()=>{
 await resetState();
 await root.query("update public.ai_usage_settings set per_staff_daily=500,per_student_daily=50,global_daily=5000,monthly_budget_usd=10000,paid_max_runs=1000,paid_total_budget_usd=1000");
 limits=[500,50,5000,10000,1000,1000];
 const workers=await Promise.all(Array.from({length:8},()=>connect(ca)));
 const lockers=await Promise.all(Array.from({length:8},()=>connect(null)));
 const manual=(await workers[0].query("select * from public.staff_create_recommendation_draft($1,'PG manual','career','{}')",[sa])).rows[0];
 const errors=[],outcomes={};let finalizedDraft=null;
 const tally=(o)=>{outcomes[o]=(outcomes[o]??0)+1;};
 const ops=[
  async(c)=>{const r=await reserve(c);tally("reserve:"+r.outcome);if(r.outcome!=="reserved")return;const f=await finalize(c,r.run_id);tally(f.outcome);if(f.draft_id)finalizedDraft=f.draft_id;},
  async(c)=>{await c.query("select public.staff_update_recommendation_draft_content($1,$2)",[manual.id,{n:Math.random()}]);tally("manual_update");},
  async(c)=>{const r=await reserve(c,"openai");tally("reserve:"+r.outcome);if(r.outcome!=="reserved")return;await c.query("begin");const f=await finalize(c,r.run_id,"openai");await c.query("select pg_sleep(0.005)");await c.query("commit");tally(f.outcome);},
  // Same lock the NW07 lifecycle RPCs take (draft FOR UPDATE without the advisory lock).
  async(c,w)=>{const l=lockers[w],d=finalizedDraft??manual.id;await l.query("begin");await l.query("select id from public.recommendation_drafts where id=$1 for update",[d]);await l.query("select pg_sleep(0.005)");await l.query("commit");tally("lifecycle_lock");},
  async(c)=>{if(!finalizedDraft)return;await c.query("select public.staff_update_recommendation_draft_content($1,$2)",[finalizedDraft,{aiAssisted:true,n:Math.random()}]);tally("ai_update");},
 ];
 let withdrawn=false;
 await Promise.all(workers.map(async(c,w)=>{
  for(let i=0;i<40;i++){
   if(w===0&&i===30&&!withdrawn){await withdraw(c);withdrawn=true;tally("withdrawn");continue;}
   try{await ops[(w+i)%ops.length](c,w);}
   catch(e){await c.query("rollback").catch(()=>{});await lockers[w].query("rollback").catch(()=>{});
    if(e.code==="40P01"||!/valid recorded|already in progress|Active AI consent|limit/i.test(e.message))errors.push(e.code+" "+e.message);
    else tally("expected_denial");}
  }
 }));
 limits=[20,3,100,25,5,2];
 console.log("# mixed workload outcomes "+JSON.stringify(outcomes));
 assert.deepEqual(errors,[]);
 assert.ok((outcomes.finalized??0)>0,"workload never finalized");
 const bad=(await root.query(`select count(*)::int n from public.ai_generation_runs r join public.student_ai_processing_consents c on c.id=r.consent_id
  where r.status='succeeded' and c.withdrawn_at is not null and r.created_at>c.withdrawn_at`)).rows[0].n;
 assert.equal(bad,0);
 const orphan=(await root.query(`select count(*)::int n from public.recommendation_draft_versions v where v.content->'aiAssisted'='true'::jsonb
  and not exists(select 1 from public.ai_generation_runs r where r.draft_id=v.draft_id and r.status='succeeded')`)).rows[0].n;
 assert.equal(orphan,0);
 // Commit order, not transaction-start timestamps, decides Invariants 1/2. Requires track_commit_timestamp=on.
 const late=(await root.query(`select v.id,v.created_at,c.withdrawn_at,pg_xact_commit_timestamp(v.xmin) version_commit,pg_xact_commit_timestamp(c.xmin) withdrawal_commit
  from public.recommendation_draft_versions v join public.ai_generation_runs r on r.draft_id=v.draft_id and r.status='succeeded'
  join public.student_ai_processing_consents c on c.id=r.consent_id where v.content->'aiAssisted'='true'::jsonb and c.withdrawn_at is not null
  and pg_xact_commit_timestamp(v.xmin)>pg_xact_commit_timestamp(c.xmin)`)).rows;
 if(late.length)console.log("# late AI versions "+JSON.stringify(late));
 const startOrder=(await root.query(`select count(*)::int n from public.recommendation_draft_versions v join public.ai_generation_runs r on r.draft_id=v.draft_id
  join public.student_ai_processing_consents c on c.id=r.consent_id where v.content->'aiAssisted'='true'::jsonb and c.withdrawn_at is not null and v.created_at>c.withdrawn_at`)).rows[0].n;
 console.log("# versions whose transaction START followed the withdrawal START (informational) "+startOrder);
 assert.deepEqual(late,[]);
 const reserved=(await root.query("select count(*)::int n from public.ai_generation_runs where status='reserved'")).rows[0].n;
 assert.equal(reserved,0);
});
