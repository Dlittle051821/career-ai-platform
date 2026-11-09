// Offline PostgreSQL execution only: no network, .env, remote credentials, or skipped assertions.
import {before,after,test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {createHmac} from "node:crypto";
const engine=process.env.NW_SECURITY_PGLITE_PATH;
if(!engine) throw new Error("Set NW_SECURITY_PGLITE_PATH to a temporary @electric-sql/pglite@0.5.15 package directory.");
const load=(p)=>import(pathToFileURL(path.join(engine,p)).href);
const {PGlite}=await load("dist/index.js");
const {pgcrypto}=await load("dist/contrib/pgcrypto.js");
const {pg_trgm}=await load("dist/contrib/pg_trgm.js");
let db;
const read=(p)=>readFileSync(path.resolve(p),"utf8");
const bundle="supabase/migrations-proposed/nw-f01-s3/";
const id=(n)=>"00000000-0000-4000-8000-"+String(n).padStart(12,"0");
const admin=id(1),ca=id(2),cb=id(3),sa=id(4),sb=id(5),reviewer=id(6);
const consent=id(50),agreement=id(60),version=id(61),sign=id(62),stamp=id(63);
const q=async(s,p=[]) => (await db.query(s,p)).rows;
const currentVersion=async(draftId)=>(await q("select current_version_id v from public.recommendation_drafts where id=$1",[draftId]))[0]?.v??null;
async function role(name,uid=null){
 await db.exec("reset role");await q("select set_config('request.jwt.claim.sub',$1,true)",[uid??""]);
 assert.ok(["anon","authenticated","service_role","postgres"].includes(name));
 await db.exec("set local role "+name);
}
async function isolated(fn){await db.exec("begin");try{await fn();}finally{await db.exec("rollback");}}
async function denied(fn,pattern=/permission denied|authorized|signed in|Legacy|Trusted|Internal/i){
 await db.exec("savepoint denied");let error;
 try{await fn();}catch(e){error=e;}
 await db.exec("rollback to savepoint denied");
 assert.ok(error,"Operation unexpectedly succeeded");assert.match(error.message,pattern);
}
let keys=0;
async function reserve(student=sa,cid=consent,provider="mock",key,overrides={}){
 const v=[student,key??("offline_request_"+String(++keys).padStart(6,"0")),provider,
 provider==="openai"?"offline-model":"mock-model","prompt-v1","report-v1",
 student===sa?"fictional":"real_student",cid,0,20,3,100,25,5,2,null,null];
 for(const [i,value] of Object.entries(overrides))v[Number(i)]=value;
 return (await q("select * from public.staff_reserve_ai_generation_run_v2("+v.map((_,i)=>"$"+(i+1)).join(",")+")",v))[0];
}
async function complete(run,status="failed",cost=0,report=null,response=null){
 return q("select * from public.staff_complete_ai_generation_run_v2($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
 [run,status,"offline outcome","offline-model",0,0,0,0,cost,1,1,response,report]);
}
before(async()=>{
 db=await PGlite.create({extensions:{pgcrypto,pg_trgm}});
 await db.exec([
 "create role anon noinherit;create role authenticated noinherit;create role service_role noinherit bypassrls;",
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
 for(const f of readdirSync("supabase/migrations").filter(x=>x.endsWith(".sql")).sort()){
  try{await db.exec(read("supabase/migrations/"+f));}catch(e){throw new Error("Baseline "+f+": "+e.message,{cause:e});}
 }
 for(const f of ["NW05_student_mark_section_self_entered.sql","NW06_application_tasks.sql","NW07_counsellor_studio_foundation.sql","NW09_ai_career_intelligence.sql"])
  await db.exec(read("supabase/migrations-proposed/"+f));
 for(const f of ["01_internal_rpcs.sql","02_nw09_2_replacement.sql","03_review_separation_and_grants.sql","05_payment_attempt_integrity.sql","06_payment_capture_reconciliation.sql"]){
 try{await db.exec(read(bundle+f));}catch(e){throw new Error("Package "+f+": "+e.message+" at "+e.position);}
}
 // CC-18: the GST-integrity version of the NW01 purchase fix (requires 05).
 try{await db.exec(read("supabase/migrations-proposed/NW01_fix_purchase_pricing_plan_tax_handling.sql"));}catch(e){throw new Error("Package NW01: "+e.message);}
 await q("insert into auth.users(id,email) select x,'offline-'||x||'@example.invalid' from unnest($1::uuid[]) x",[[admin,ca,cb,sa,sb,reviewer]]);
 await q("insert into public.admin_roles(user_id,role) values($1,'super_admin'),($2,'counsellor'),($3,'counsellor'),($4,'admin')",[admin,ca,cb,reviewer]);
 await q("insert into public.counsellors(id,user_id,display_name) values($1,$2,'Offline A'),($3,$4,'Offline B')",[id(20),ca,id(21),cb]);
 await q("insert into public.admin_student_meta(student_user_id,assigned_counsellor_id) values($1,$2),($3,$4)",[sa,id(20),sb,id(21)]);
 await q("insert into nextwise_security.fictional_students values($1,'offline approval',$2,now(),now()+interval '1 day')",[sa,admin]);
 await db.exec("insert into nextwise_security.ai_model_reservations values('openai','offline-model',0.4,'offline approved ceiling')");
 await q("insert into public.student_ai_processing_consents(id,student_user_id,consenting_party,method,evidence_reference,given_on,recorded_by) values($1,$2,'student','fictional_test_account','offline evidence',current_date,$3)",[consent,sa,admin]);
 await q("insert into public.agreements(id,agreement_type,student_user_id) values($1,'offline',$2)",[agreement,sa]);
 await q("insert into public.agreement_versions(id,agreement_id,version_number) values($1,$2,1)",[version,agreement]);
 await q("insert into public.signature_requests(id,agreement_id,agreement_version_id,provider_request_id,status,signer_name,signer_email) values($1,$2,$3,'offline-sign','pending','Offline','offline@example.invalid')",[sign,agreement,version]);
 await q("insert into public.stamp_requests(id,agreement_id,agreement_version_id,provider_request_id,status) values($1,$2,$3,'offline-stamp','pending')",[stamp,agreement,version]);
 await db.exec("insert into public.signature_provider_config(id,webhook_secret) values(1,'offline-fixture-secret') on conflict(id) do update set webhook_secret=excluded.webhook_secret;insert into public.stamp_provider_config(id,webhook_secret) values(1,'offline-fixture-secret') on conflict(id) do update set webhook_secret=excluded.webhook_secret;");
 await db.exec("insert into storage.buckets(id,name,public) values('signed-agreements','signed-agreements',false),('stamped-agreements','stamped-agreements',false)");
},{timeout:120000});
after(async()=>{if(db)await db.close();});
test("effective grants close internal and legacy RPCs despite broad defaults",()=>isolated(async()=>{
 const r=await q("select proname,has_function_privilege('anon',p.oid,'execute') a,has_function_privilege('authenticated',p.oid,'execute') u,has_function_privilege('service_role',p.oid,'execute') s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname in ('record_system_audit_log','set_signature_document_path','set_stamp_document_path','staff_reserve_ai_generation_run','staff_complete_ai_generation_run')");
 assert.equal(r.length,5);for(const v of r){assert.equal(v.a,false);assert.equal(v.u,false);assert.equal(v.s,!v.proname.startsWith("staff_"));}
 const v=(await q("select has_function_privilege('service_role','public.staff_get_ai_usage_summary()','execute') s"))[0];assert.equal(v.s,false);
}));
for(const who of ["anon","authenticated"])test(who+" cannot forge system audit or capture paths",()=>isolated(async()=>{
 await role(who,who==="anon"?null:sa);
 await denied(()=>q("select public.record_system_audit_log('FORGED','offline',null,'forged',null,null)"));
 for(const kind of ["signature","stamp"])await denied(()=>q("select public.set_"+kind+"_document_path('mock','offline-"+(kind==="signature"?"sign":"stamp")+"','wrong')"));
}));
test("invoker authorization rejects clients even after accidental direct grants",()=>isolated(async()=>{
 await db.exec("grant execute on function public.record_system_audit_log(text,text,text,text,jsonb,jsonb) to authenticated;grant execute on function public.set_signature_document_path(text,text,text) to authenticated");
 await role("authenticated",sa);
 await denied(()=>q("select public.record_system_audit_log('FORGED','offline',null,'forged',null,null)"),/Internal/);
 await denied(()=>q("select public.set_signature_document_path('mock','offline-sign','wrong')"),/Trusted/);
}));
for(const [kind,status,request] of [["signature","signed","offline-sign"],["stamp","completed","offline-stamp"]]){
 test(kind+": valid HMAC and internal audit survive; invalid HMAC and replay are safe",()=>isolated(async()=>{
  const body=JSON.stringify({provider:"mock",providerRequestId:request,eventType:kind+"_request."+status});
  const mac=createHmac("sha256","offline-fixture-secret").update(body).digest("hex");
  await role("anon");
  const call=(signature)=>q("select public.apply_"+kind+"_webhook_event($1,$2) result",[body,signature]);
  assert.equal((await call("invalid"))[0].result.valid,false);
  const r=(await call(mac))[0].result;assert.equal(r.valid,true);assert.equal(r.processing_status,"processed");
  assert.equal((await call(mac))[0].result.duplicate,true);
  await role("postgres");assert.ok((await q("select count(*)::int n from public.admin_audit_log where actor_role='system'"))[0].n>=2);
 }));
 test(kind+": trusted canonical capture is idempotent, rejects missing objects and tampering",()=>isolated(async()=>{
  const isSign=kind==="signature",table=isSign?"signature_requests":"stamp_requests",rid=isSign?sign:stamp,bucket=isSign?"signed-agreements":"stamped-agreements";
  await q("update public."+table+" set status=$1 where id=$2",[status,rid]);
  const good=agreement+"/"+rid+"/offline.pdf";
  await q("insert into storage.objects(bucket_id,name) values($1,$2)",[bucket,good]);
  await role("service_role");const call=(p)=>q("select public.set_"+kind+"_document_path('mock',$1,$2) result",[request,p]);
  await denied(()=>call(id(99)+"/"+rid+"/offline.pdf"),/does not belong/);
  await denied(()=>call(agreement+"/"+rid+"/missing.pdf"),/must exist/);
  assert.deepEqual((await call(good))[0],(await call(good))[0]);
  await denied(()=>call(agreement+"/"+rid+"/other.pdf"),/immutable/);
 }));
}
test("student and unassigned counsellor cannot reserve another student's run",()=>isolated(async()=>{
 await role("authenticated",sa);await denied(()=>reserve());
 await role("authenticated",cb);await denied(()=>reserve());
 await role("authenticated",ca);assert.equal((await reserve()).outcome,"reserved");
}));
test("consent is mandatory and withdrawal prevents new reservations",()=>isolated(async()=>{
 await role("authenticated",ca);await denied(()=>reserve(sa,id(99)),/valid recorded/);
 await q("select public.staff_withdraw_ai_processing_consent($1,'offline withdrawal')",[consent]);
 await denied(()=>reserve(),/valid recorded/);
}));
test("reserve-before-withdraw order retains accounting but cannot store withdrawn output",()=>isolated(async()=>{
 await role("authenticated",ca);const r=await reserve();
 await q("select public.staff_withdraw_ai_processing_consent($1,'offline withdrawal')",[consent]);
 await denied(()=>reserve(),/valid recorded/);
 await denied(()=>complete(r.run_id,"succeeded",0,{}),/withdrawn/);
 await complete(r.run_id);
}));
test("caller fictional flags cannot override trusted registry",()=>isolated(async()=>{
 await role("authenticated",admin);await denied(()=>reserve(sb,consent,"mock",undefined,{6:"fictional"}),/trusted registration/);
 await denied(()=>q("select public.staff_record_ai_processing_consent($1,'student','fictional_test_account','offline evidence',current_date,null)",[sb]),/trusted registration/);
 await role("authenticated",ca);await denied(()=>q("insert into nextwise_security.fictional_students(student_user_id) values($1)",[sb]));
}));
test("idempotency key reuse cannot disclose another student's run",()=>isolated(async()=>{
 const c2=id(51);await q("insert into public.student_ai_processing_consents(id,student_user_id,consenting_party,method,evidence_reference,given_on) values($1,$2,'student','written_confirmation','offline evidence',current_date)",[c2,sb]);
 await role("authenticated",admin);const key="offline_duplicate_key_001";await reserve(sa,consent,"mock",key);
 await denied(()=>reserve(sb,c2,"mock",key),/different request/);
}));
test("completion and linking reject demotion, non-requester and null identity",()=>isolated(async()=>{
 await role("authenticated",ca);const r=await reserve();
 await role("authenticated",cb);await denied(()=>complete(r.run_id));
 await role("postgres");await q("delete from public.admin_roles where user_id=$1",[ca]);
 await role("authenticated",ca);await denied(()=>complete(r.run_id));
 await denied(()=>q("select public.staff_link_ai_generation_run_draft($1,$2)",[r.run_id,id(99)]));
 await role("anon");await denied(()=>complete(r.run_id));
}));
test("paid failures and expiry retain a trusted reservation floor",()=>isolated(async()=>{
 await role("authenticated",ca);let r=await reserve(sa,consent,"openai");assert.equal(r.outcome,"reserved");
 await denied(()=>complete(r.run_id,"blocked"),/retain their cost/);await complete(r.run_id,"failed",0);
 let stats=(await q("select * from public.staff_get_ai_usage_summary()"))[0];assert.equal(Number(stats.paid_cost_total_usd),0.4);
 r=await reserve(sa,consent,"openai");await role("postgres");await q("update public.ai_generation_runs set created_at=now()-interval '20 minutes' where id=$1",[r.run_id]);
 await role("authenticated",ca);assert.equal((await reserve(sa,consent,"openai")).outcome,"reserved");
 stats=(await q("select * from public.staff_get_ai_usage_summary()"))[0];assert.equal(Number(stats.paid_cost_total_usd),1.2);
}));
test("missing settings and unapproved paid model fail closed",()=>isolated(async()=>{
 await db.exec("delete from nextwise_security.ai_model_reservations");await role("authenticated",ca);
 await denied(()=>reserve(sa,consent,"openai"),/approved reservation/);
 await role("postgres");await db.exec("delete from public.ai_usage_settings");await role("authenticated",ca);
 await denied(()=>reserve(),/singleton/);
}));
test("every content contributor is barred from approval; independent reviewer succeeds",()=>isolated(async()=>{
 await role("authenticated",ca);const draft=(await q("select * from public.staff_create_recommendation_draft($1,'Offline draft','career','{}')",[sa]))[0];
 await role("authenticated",admin);await q("select public.staff_update_recommendation_draft_content($1,'{\"edited\":true}')",[draft.id]);
 await q("select public.staff_submit_recommendation_draft_for_review($1)",[draft.id]);
 await denied(async()=>q("select public.staff_review_recommendation_draft($1,'approve',$2,null)",[draft.id,await currentVersion(draft.id)]),/own author/);
 await role("authenticated",reviewer);await q("select public.staff_review_recommendation_draft($1,'approve',$2,null)",[draft.id,await currentVersion(draft.id)]);
}));
test("original author loses mutation access after case reassignment",()=>isolated(async()=>{
 await role("authenticated",ca);const draft=(await q("select * from public.staff_create_recommendation_draft($1,'Offline draft','career','{}')",[sa]))[0];
 await role("postgres");await q("update public.admin_student_meta set assigned_counsellor_id=$1 where student_user_id=$2",[id(21),sa]);
 await role("authenticated",ca);await denied(()=>q("select public.staff_update_recommendation_draft_content($1,'{}')",[draft.id]));
}));
test("legacy body remains closed after accidental service-role grant",()=>isolated(async()=>{
 await db.exec("grant execute on function public.staff_complete_ai_generation_run(uuid,text,text,text,integer,integer,numeric,integer,integer,jsonb) to service_role");await role("service_role");
 await denied(()=>q("select public.staff_complete_ai_generation_run(null,null,null,null,null,null,null,null,null,null)"),/Legacy/);
}));
test("rerun preserves history; active reservations fail preflight",()=>isolated(async()=>{
 const sql=read(bundle+"02_nw09_2_replacement.sql").replace(/^begin;$/m,"").replace(/^commit;$/m,"");
 await db.exec(sql);assert.equal((await q("select count(*)::int n from public.student_ai_processing_consents"))[0].n,1);
 await role("authenticated",ca);await reserve();await role("postgres");await denied(()=>db.exec(sql),/Quiesce/);
 assert.equal((await q("select count(*)::int n from public.ai_generation_runs"))[0].n,1);
}));

test("nullable requester never authorizes a null caller, even with an accidental v2 grant",()=>isolated(async()=>{
 await role("authenticated",ca);const run=await reserve();
 await role("postgres");await q("update public.ai_generation_runs set requested_by=null where id=$1",[run.run_id]);
 await db.exec("grant execute on function public.staff_complete_ai_generation_run_v2(uuid,text,text,text,integer,integer,integer,integer,numeric,integer,integer,text,jsonb) to anon");
 await role("anon");await denied(()=>complete(run.run_id),/signed in/);
}));
test("RLS hides consent and runs from ordinary students; students cannot write consent",()=>isolated(async()=>{
 await role("authenticated",sa);
 assert.equal((await q("select count(*)::int n from public.student_ai_processing_consents"))[0].n,0);
 assert.equal((await q("select count(*)::int n from public.ai_generation_runs"))[0].n,0);
 await denied(()=>q("insert into public.student_ai_processing_consents(student_user_id) values($1)",[sa]));
}));
test("reassigned requester cannot finish the former case",()=>isolated(async()=>{
 await role("authenticated",ca);const run=await reserve();
 await role("postgres");await q("update public.admin_student_meta set assigned_counsellor_id=$1 where student_user_id=$2",[id(21),sa]);
 await role("authenticated",ca);await denied(()=>complete(run.run_id));
}));
test("optional column type drift fails before alteration or history loss",()=>isolated(async()=>{
 await db.exec("alter table public.ai_generation_runs drop constraint ai_generation_runs_detail_tokens_check;alter table public.ai_generation_runs alter column cached_input_tokens drop default;alter table public.ai_generation_runs alter column cached_input_tokens type text using cached_input_tokens::text");
 const sql=read(bundle+"02_nw09_2_replacement.sql").replace(/^begin;$/m,"").replace(/^commit;$/m,"");
 await denied(()=>db.exec(sql),/Incompatible existing/);
}));

// Sequential state/rollback checks in one in-memory connection. These are NOT
// evidence of real PostgreSQL multi-session concurrency; see REVIEW.md.
async function finalize(run,opts={}) {
 const student=opts.student??sa, cid=Object.hasOwn(opts,'consent')?opts.consent:consent;
 const provider=opts.provider??"mock",model=provider==="openai"?"offline-model":"mock-model";
 const report=opts.report??{studentProfileRef:{studentUserId:student},generation:{provider,model,dataClass:"fictional",providerResponseId:provider==="openai"?"offline-response":null}};
 const usage={model,inputTokens:123,outputTokens:45,cachedInputTokens:0,reasoningTokens:0,estimatedCostUsd:0,attempts:1,latencyMs:1,providerResponseId:provider==="openai"?"offline-response":null,...opts.usage};
 // CC-16 (F1): finalization is service-role only. The trusted server passes the
 // staff user it authenticated; by default that is the current test caller.
 const ctx=(await q("select coalesce(current_setting('request.jwt.claim.sub',true),'') s, current_user u"))[0];
 const requester=Object.hasOwn(opts,"requester")?opts.requester:(ctx.s||null);
 if(!opts.asCaller)await db.exec("set local role service_role");
 const result=(await q("select public.staff_finalize_ai_generation_run($1,$2,$3,$4,$5,$6,$7) result",
 [requester,run,student,cid,report,opts.content??{aiAssisted:true,summary:"offline content"},usage]))[0].result;
 if(!opts.asCaller){await db.exec("reset role");if(ctx.u!=="postgres")await db.exec("set local role "+ctx.u);}
 return result;
}
async function contentCounts(){return (await q("select (select count(*)::int from public.recommendation_drafts) drafts,(select count(*)::int from public.recommendation_draft_versions) versions,(select count(*)::int from public.ai_generation_runs where report is not null) reports"))[0];}
const noContent={drafts:0,versions:0,reports:0};

test("withdrawal wins: no content; paid usage, response ID and cost liability survive",()=>isolated(async()=>{
 await role("authenticated",ca);const run=await reserve(sa,consent,"openai");
 await q("select public.staff_withdraw_ai_processing_consent($1,'offline withdrawal')",[consent]);
 assert.equal((await finalize(run.run_id,{provider:"openai"})).outcome,"consent_withdrawn");
 assert.equal((await finalize(run.run_id,{provider:"openai"})).outcome,"consent_withdrawn");
 await role("postgres");assert.deepEqual(await contentCounts(),noContent);
 const r=(await q("select * from public.ai_generation_runs where id=$1",[run.run_id]))[0];
 assert.equal(r.status,"failed");assert.equal(r.input_tokens,123);assert.equal(r.provider_response_id,"offline-response");
 assert.equal(Number(r.reserved_cost_usd),0.4);assert.equal(Number(r.estimated_cost_usd),0.4);
 assert.equal((await q("select count(*)::int n from public.admin_audit_log where context->>'runId'=$1",[run.run_id]))[0].n,1);
}));
test("finalization wins: one draft/version/report/audit; withdrawal preserves it and blocks new work",()=>isolated(async()=>{
 await role("authenticated",ca);const run=await reserve();const result=await finalize(run.run_id);
 assert.equal(result.outcome,"finalized");
 await q("select public.staff_withdraw_ai_processing_consent($1,'offline withdrawal')",[consent]);
 const again=await finalize(run.run_id);assert.equal(again.outcome,"duplicate");assert.equal(again.draft_id,result.draft_id);
 await denied(()=>reserve(),/valid recorded/);
 await role("postgres");assert.deepEqual(await contentCounts(),{drafts:1,versions:1,reports:1});
 const d=(await q("select * from public.recommendation_drafts where id=$1",[result.draft_id]))[0];
 assert.equal(d.status,"draft");assert.ok(d.current_version_id);
 assert.equal((await q("select count(*)::int n from public.admin_audit_log where context->>'runId'=$1",[run.run_id]))[0].n,1);
}));
test("queued duplicate finalizations create exactly one result (single-connection serialization only)",()=>isolated(async()=>{
 await role("authenticated",ca);const run=await reserve();
 const results=await Promise.all([finalize(run.run_id),finalize(run.run_id)]);
 assert.deepEqual(results.map(r=>r.outcome).sort(),["duplicate","finalized"]);
 assert.equal(results[0].draft_id,results[1].draft_id);
 await role("postgres");assert.deepEqual(await contentCounts(),{drafts:1,versions:1,reports:1});
}));
for(const who of ["anon","student","unassigned","other-admin"])test(who+" cannot finalize another request",()=>isolated(async()=>{
 await role("authenticated",ca);const run=await reserve();
 await role(who==="anon"?"anon":"authenticated",{student:sa,unassigned:cb,"other-admin":admin}[who]);
 await denied(()=>finalize(run.run_id),/permission denied|authorized|requester|signed in/);
 await role("postgres");assert.deepEqual(await contentCounts(),noContent);
 assert.equal((await q("select status from public.ai_generation_runs where id=$1",[run.run_id]))[0].status,"reserved");
}));
test("finalization rechecks demotion and reassignment, including idempotent retries",()=>isolated(async()=>{
 await role("authenticated",ca);const run=await reserve();await finalize(run.run_id);
 await role("postgres");await q("update public.admin_student_meta set assigned_counsellor_id=$1 where student_user_id=$2",[id(21),sa]);
 await role("authenticated",ca);await denied(()=>finalize(run.run_id),/authorized/);
 await role("postgres");await q("update public.admin_student_meta set assigned_counsellor_id=$1 where student_user_id=$2",[id(20),sa]);
 await q("delete from public.admin_roles where user_id=$1",[ca]);
 await role("authenticated",ca);await denied(()=>finalize(run.run_id),/authorized/);
}));
test("student/consent arguments cannot redirect a reservation",()=>isolated(async()=>{
 await role("authenticated",ca);const run=await reserve();
 await denied(()=>finalize(run.run_id,{student:sb}),/identity mismatch/);
 await denied(()=>finalize(run.run_id,{consent:id(99)}),/identity mismatch/);
 await role("postgres");assert.deepEqual(await contentCounts(),noContent);
}));
test("report student identity mismatch fails without any partial content or budget release",()=>isolated(async()=>{
 await role("authenticated",ca);const run=await reserve(sa,consent,"openai");
 assert.equal((await finalize(run.run_id,{provider:"openai",report:{studentProfileRef:{studentUserId:sb}}})).outcome,"failed");
 await role("postgres");assert.deepEqual(await contentCounts(),noContent);
 assert.equal(Number((await q("select estimated_cost_usd from public.ai_generation_runs where id=$1",[run.run_id]))[0].estimated_cost_usd),0.4);
}));
test("missing reservation consent fails closed and retains accounted usage",()=>isolated(async()=>{
 await role("authenticated",ca);const run=await reserve();
 await role("postgres");await q("update public.ai_generation_runs set consent_id=null where id=$1",[run.run_id]);
 await role("authenticated",ca);assert.equal((await finalize(run.run_id,{consent:null})).outcome,"consent_withdrawn");
 await role("postgres");assert.deepEqual(await contentCounts(),noContent);
}));
test("failure after draft insertion rolls all content back; safe accounting/audit survive",()=>isolated(async()=>{
 await db.exec("create function nextwise_security.offline_inject_failure() returns trigger language plpgsql as $$begin raise exception 'PRIVATE offline report text';end;$$; create trigger offline_inject before insert on public.recommendation_draft_versions for each row execute function nextwise_security.offline_inject_failure()");
 await role("authenticated",ca);const run=await reserve(sa,consent,"openai");
 assert.equal((await finalize(run.run_id,{provider:"openai"})).outcome,"failed");
 await role("postgres");assert.deepEqual(await contentCounts(),noContent);
 const r=(await q("select * from public.ai_generation_runs where id=$1",[run.run_id]))[0];
 assert.equal(r.status,"failed");assert.equal(Number(r.estimated_cost_usd),0.4);assert.equal(r.draft_id,null);
 assert.doesNotMatch(JSON.stringify(await q("select * from public.admin_audit_log")),/PRIVATE|offline content/);
 assert.doesNotMatch(r.reason,/PRIVATE|offline content/);
}));
test("outer transaction rollback leaves the reserved ledger and no draft/report/audit",()=>isolated(async()=>{
 await role("authenticated",ca);const run=await reserve();await db.exec("savepoint outer_finalization");
 assert.equal((await finalize(run.run_id)).outcome,"finalized");
 await db.exec("rollback to savepoint outer_finalization");await role("postgres");
 assert.deepEqual(await contentCounts(),noContent);
 assert.equal((await q("select status from public.ai_generation_runs where id=$1",[run.run_id]))[0].status,"reserved");
 assert.equal((await q("select count(*)::int n from public.admin_audit_log where context->>'runId'=$1",[run.run_id]))[0].n,0);
}));
test("timeout/unknown provider usage keeps the reservation floor and cannot later create content",()=>isolated(async()=>{
 await role("authenticated",ca);const run=await reserve(sa,consent,"openai");await complete(run.run_id,"failed",0);
 assert.equal((await finalize(run.run_id,{provider:"openai"})).outcome,"failed");
 const stats=(await q("select * from public.staff_get_ai_usage_summary()"))[0];assert.equal(Number(stats.paid_cost_total_usd),0.4);
 await role("postgres");assert.deepEqual(await contentCounts(),noContent);
}));
test("split success and linking cannot bypass atomic finalization",()=>isolated(async()=>{
 await role("authenticated",ca);const run=await reserve();
 await denied(()=>complete(run.run_id,"succeeded",0,{}),/Atomic finalization/);
 await denied(()=>complete(run.run_id,"succeeded",0,null),/Successful generation/);
 await denied(()=>q("select public.staff_link_ai_generation_run_draft($1,$2)",[run.run_id,id(99)]),/permission denied/);
 await role("postgres");await db.exec("grant execute on function public.staff_link_ai_generation_run_draft(uuid,uuid) to authenticated");
 await role("authenticated",ca);await denied(()=>q("select public.staff_link_ai_generation_run_draft($1,$2)",[run.run_id,id(99)]),/Atomic finalization/);
 await role("postgres");assert.deepEqual(await contentCounts(),noContent);
}));
test("generic draft creation and promotion cannot introduce unbound AI content",()=>isolated(async()=>{
 await role("authenticated",ca);
 await denied(()=>q("select public.staff_create_recommendation_draft($1,'Offline AI','career','{\"aiAssisted\":true}')",[sa]),/Atomic AI finalization/);
 const draft=(await q("select * from public.staff_create_recommendation_draft($1,'Offline manual','career','{}')",[sa]))[0];
 await denied(()=>q("select public.staff_update_recommendation_draft_content($1,'{\"aiAssisted\":true}')",[draft.id]),/Atomic AI finalization/);
 await role("postgres");assert.deepEqual(await contentCounts(),{drafts:1,versions:1,reports:0});
}));
test("direct content writes and privileged finalization roles are explicitly denied",()=>isolated(async()=>{
 for(const table of ["recommendation_drafts","recommendation_draft_versions","ai_generation_runs"]){
  for(const who of ["anon","authenticated","service_role"]){
   for(const perm of ["INSERT","UPDATE","DELETE"])assert.equal((await q("select has_table_privilege($1,$2,$3) allowed",[who,"public."+table,perm]))[0].allowed,false);
  }
 }
 for(const who of ["anon","authenticated"])assert.equal((await q("select has_function_privilege($1,'public.staff_finalize_ai_generation_run(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb)','execute') allowed",[who]))[0].allowed,false);
 assert.equal((await q("select has_function_privilege('service_role','public.staff_finalize_ai_generation_run(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb)','execute') allowed"))[0].allowed,true);
 await role("authenticated",ca);
 await denied(()=>q("insert into public.recommendation_drafts(student_user_id,title) values($1,'offline direct')",[sa]),/permission denied/);
 await denied(()=>q("insert into public.recommendation_draft_versions(draft_id,version_number,content) values($1,1,'{}')",[id(99)]),/permission denied/);
}));
test("AI provenance cannot be removed, and withdrawal bars new AI-labelled versions",()=>isolated(async()=>{
 await role("authenticated",ca);const run=await reserve();const r=await finalize(run.run_id);
 await denied(()=>q("select public.staff_update_recommendation_draft_content($1,'{}')",[r.draft_id]),/provenance/);
 await q("select public.staff_withdraw_ai_processing_consent($1,'offline withdrawal')",[consent]);
 await denied(()=>q("select public.staff_update_recommendation_draft_content($1,'{\"aiAssisted\":true}')",[r.draft_id]),/Active AI consent/);
 await role("postgres");assert.deepEqual(await contentCounts(),{drafts:1,versions:1,reports:1});
}));
test("withdrawal and finalization acquire the shared lock before reading protected rows",()=>{
 const sql=read(bundle+"02_nw09_2_replacement.sql");
 for(const name of ["staff_withdraw_ai_processing_consent","staff_finalize_ai_generation_run"]){
  const qualified=name==="staff_finalize_ai_generation_run"?"nextwise_security.finalize_ai_generation_run_impl":"public."+name;
  const start=sql.indexOf("create or replace function "+qualified+"(");assert.ok(start>0,qualified);const body=sql.slice(start,sql.indexOf("\n$$;",start));
  const lock=body.indexOf("pg_advisory_xact_lock(hashtext('public.ai_generation_runs'))");assert.ok(lock>0);
  assert.ok(lock<body.indexOf("select * into"));
 }
});

test("new consent cannot retroactively authorize the withdrawn reservation",()=>isolated(async()=>{
 await role("authenticated",ca);const run=await reserve();
 await q("select public.staff_withdraw_ai_processing_consent($1,'offline withdrawal')",[consent]);
 const replacement=(await q("select * from public.staff_record_ai_processing_consent($1,'student','written_confirmation','offline evidence',current_date,null)",[sa]))[0];
 await denied(()=>finalize(run.run_id,{consent:replacement.id}),/identity mismatch/);
 assert.equal((await finalize(run.run_id)).outcome,"consent_withdrawn");
 await role("postgres");assert.deepEqual(await contentCounts(),noContent);
}));
test("reported costs above the reservation survive content failure and duplicate retries",()=>isolated(async()=>{
 await role("authenticated",ca);const run=await reserve(sa,consent,"openai");
 assert.equal((await finalize(run.run_id,{provider:"openai",content:{aiAssisted:false},usage:{estimatedCostUsd:0.8}})).outcome,"failed");
 await finalize(run.run_id,{provider:"openai",usage:{estimatedCostUsd:0}});
 const stats=(await q("select * from public.staff_get_ai_usage_summary()"))[0];assert.equal(Number(stats.paid_cost_total_usd),0.8);
 await role("postgres");assert.deepEqual(await contentCounts(),noContent);
}));
test("withdrawal rollback leaves active consent; finalization can proceed",()=>isolated(async()=>{
 await role("authenticated",ca);const run=await reserve();await db.exec("savepoint withdrawn_then_rollback");
 await q("select public.staff_withdraw_ai_processing_consent($1,'offline withdrawal')",[consent]);
 await db.exec("rollback to savepoint withdrawn_then_rollback");assert.equal((await finalize(run.run_id)).outcome,"finalized");
}));
test("finalizer body rejects a null identity even after accidental anon grant",()=>isolated(async()=>{
 await role("authenticated",ca);const run=await reserve();await role("postgres");
 await db.exec("grant execute on function public.staff_finalize_ai_generation_run(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb) to anon");
 await role("anon");await denied(()=>finalize(run.run_id,{asCaller:true,requester:ca}),/trusted server/);
 await role("postgres");assert.deepEqual(await contentCounts(),noContent);
}));
test("AI schema rerun preserves a finalized historical report and disabled split linking",()=>isolated(async()=>{
 await role("authenticated",ca);const run=await reserve();const result=await finalize(run.run_id);
 await role("postgres");const before=(await q("select report,draft_id,estimated_cost_usd from public.ai_generation_runs where id=$1",[run.run_id]))[0];
 const sql=read(bundle+"02_nw09_2_replacement.sql").replace(/^begin;$/m,"").replace(/^commit;$/m,"");await db.exec(sql);
 assert.deepEqual((await q("select report,draft_id,estimated_cost_usd from public.ai_generation_runs where id=$1",[run.run_id]))[0],before);
 assert.deepEqual(await contentCounts(),{drafts:1,versions:1,reports:1});
 await role("authenticated",ca);assert.equal((await finalize(run.run_id)).draft_id,result.draft_id);
 await denied(()=>q("select public.staff_link_ai_generation_run_draft($1,$2)",[run.run_id,result.draft_id]),/permission denied/);
}));

test("audit failure after report/version/link creation rolls every content write back",()=>isolated(async()=>{
 await db.exec("create function nextwise_security.offline_fail_success_audit() returns trigger language plpgsql as $$begin if new.action='AI-assisted career draft generated' then raise exception 'PRIVATE audit failure';end if;return new;end;$$;create trigger offline_fail_success_audit before insert on public.admin_audit_log for each row execute function nextwise_security.offline_fail_success_audit()");
 await role("authenticated",ca);const run=await reserve(sa,consent,"openai");
 assert.equal((await finalize(run.run_id,{provider:"openai"})).outcome,"failed");
 await role("postgres");assert.deepEqual(await contentCounts(),noContent);
 assert.equal(Number((await q("select estimated_cost_usd from public.ai_generation_runs where id=$1",[run.run_id]))[0].estimated_cost_usd),0.4);
 assert.equal((await q("select count(*)::int n from public.admin_audit_log where action='AI career analysis not generated'"))[0].n,1);
}));
test("demoted requester cannot finalize a reserved run or release its budget",()=>isolated(async()=>{
 await role("authenticated",ca);const run=await reserve(sa,consent,"openai");
 await role("postgres");await q("delete from public.admin_roles where user_id=$1",[ca]);
 await role("authenticated",ca);await denied(()=>finalize(run.run_id,{provider:"openai"}),/authorized/);
 await role("postgres");assert.deepEqual(await contentCounts(),noContent);
 const row=(await q("select status,reserved_cost_usd from public.ai_generation_runs where id=$1",[run.run_id]))[0];
 assert.equal(row.status,"reserved");assert.equal(Number(row.reserved_cost_usd),0.4);
}));

test("string or null AI markers cannot disguise AI content as a manual draft",()=>isolated(async()=>{
 await role("authenticated",ca);
 for(const marker of ["true",null,1])await denied(()=>q("select public.staff_create_recommendation_draft($1,'Offline disguised','career',$2)",[sa,{aiAssisted:marker}]),/Invalid AI provenance/);
 await role("postgres");assert.deepEqual(await contentCounts(),noContent);
}));

// CC-14: independent-review regressions (F2 NaN cost poisoning, F6 TRUNCATE bypassing RLS).
test("NaN costs are rejected by reserve, completion, finalization and the table constraint",()=>isolated(async()=>{
 await role("authenticated",ca);
 await denied(()=>reserve(sa,consent,"mock",undefined,{8:"NaN"}),/Invalid cost/);
 const run=await reserve();
 await denied(()=>complete(run.run_id,"failed","NaN"),/Invalid cost/);
 await denied(()=>finalize(run.run_id,{usage:{estimatedCostUsd:"NaN"}}),/Invalid usage/);
 await role("postgres");
 assert.equal((await q("select status from public.ai_generation_runs where id=$1",[run.run_id]))[0].status,"reserved");
 await denied(()=>q("update public.ai_generation_runs set estimated_cost_usd='NaN' where id=$1",[run.run_id]),/cost_not_nan/);
 const stats=(await q("select count(*)::int n from public.ai_generation_runs where estimated_cost_usd='NaN' or reserved_cost_usd='NaN'"))[0];
 assert.equal(stats.n,0);
}));
test("clients cannot TRUNCATE audit, signature, stamp, consent or AI ledger tables",()=>isolated(async()=>{
 for(const t of ["admin_audit_log","signature_requests","stamp_requests","ai_usage_settings","ai_generation_runs","student_ai_processing_consents"])
  for(const who of ["anon","authenticated"])
   assert.equal((await q("select has_table_privilege($1,$2,'TRUNCATE') allowed",[who,"public."+t]))[0].allowed,false,who+" "+t);
 await role("authenticated",ca);await denied(()=>q("truncate public.admin_audit_log"),/permission denied/);
}));

// CC-15: independent-review regressions F4 (approved version binding), F3 (write-once
// capture integrity for every writer) and F7 (pinned search_path on definer functions).
test("approval binds the reviewed version; a stale review and a changed draft cannot be released",()=>isolated(async()=>{
 await role("authenticated",ca);const draft=(await q("select * from public.staff_create_recommendation_draft($1,'Offline draft','career','{\"v\":1}')",[sa]))[0];
 const v1=await currentVersion(draft.id);
 await q("select public.staff_submit_recommendation_draft_for_review($1)",[draft.id]);
 await q("select public.staff_withdraw_recommendation_draft($1)",[draft.id]);
 await q("select public.staff_update_recommendation_draft_content($1,'{\"v\":2}')",[draft.id]);
 const v2=await currentVersion(draft.id);assert.notEqual(v1,v2);
 await q("select public.staff_submit_recommendation_draft_for_review($1)",[draft.id]);
 await role("authenticated",reviewer);
 await denied(()=>q("select public.staff_review_recommendation_draft($1,'approve',$2,null)",[draft.id,v1]),/changed since you opened it/);
 await denied(()=>q("select public.staff_review_recommendation_draft($1,'approve',null,null)",[draft.id]),/changed since you opened it/);
 const approved=(await q("select * from public.staff_review_recommendation_draft($1,'approve',$2,null)",[draft.id,v2]))[0];
 assert.equal(approved.status,"approved");assert.equal(approved.approved_version_id,v2);
 await role("postgres");await q("update public.recommendation_drafts set approved_version_id=$2 where id=$1",[draft.id,v1]);
 await role("authenticated",reviewer);await denied(()=>q("select public.staff_release_recommendation_draft($1)",[draft.id]),/no longer current/);
 await role("postgres");await q("update public.recommendation_drafts set approved_version_id=$2 where id=$1",[draft.id,v2]);
 await role("authenticated",reviewer);assert.equal((await q("select status s from public.staff_release_recommendation_draft($1)",[draft.id]))[0].s,"released_to_student");
}));
test("admins cannot forge or overwrite captured document paths or provider IDs directly",()=>isolated(async()=>{
 const good=agreement+"/"+sign+"/offline.pdf";
 await q("insert into storage.objects(bucket_id,name) values('signed-agreements',$1),('signed-agreements',$2)",[good,id(99)+"/x/forged.pdf"]);
 await role("authenticated",admin);
 await denied(()=>q("update public.signature_requests set signed_document_storage_path=$2 where id=$1",[sign,good]),/trusted capture service/);
 await denied(()=>q("update public.signature_requests set provider_request_id='req-colliding' where id=$1",[sign]),/immutable/);
 await denied(()=>q("update public.signature_requests set provider='evil' where id=$1",[sign]),/cannot be moved/);
 await denied(()=>q("update public.signature_requests set signer_email='else@example.invalid' where id=$1",[sign]),/cannot change its signer/);
 await denied(()=>q("update public.stamp_requests set provider_request_id='other' where id=$1",[stamp]),/immutable/);
 await role("service_role");
 const cap=(p)=>q("update public.signature_requests set signed_document_storage_path=$2 where id=$1",[sign,p]);
 await denied(()=>cap(good),/after completion/);                      // still 'pending'
 await role("postgres");await q("update public.signature_requests set status='signed' where id=$1",[sign]);await role("service_role");
 await denied(()=>cap(id(99)+"/x/forged.pdf"),/does not belong/);
 await denied(()=>cap(agreement+"/"+sign+"/missing.pdf"),/must exist/);
 await cap(good);
 await denied(()=>cap(null),/immutable/);
 await denied(()=>q("update public.signature_requests set status='cancelled' where id=$1",[sign]),/cannot change status/);
 await denied(()=>q("update public.signature_requests set id=$2 where id=$1",[sign,id(98)]),/immutable/);
 await denied(()=>q("delete from public.signature_requests where id=$1",[sign]),/cannot be deleted directly/);
 await role("authenticated",admin);
 await denied(()=>q("update public.signature_requests set signed_at='2020-01-01', provider_metadata='{\"evidence\":\"forged\"}' where id=$1",[sign]),/read-only/);
 await role("postgres");await q("update public.stamp_requests set provider_request_id=provider_request_id where id=$1",[stamp]);
 await role("authenticated",admin);
 await denied(()=>q("update public.stamp_requests set stamp_value=50000 where id=$1",[stamp]),/stamp terms/);
 await denied(()=>q("update public.stamp_requests set currency='USD' where id=$1",[stamp]),/stamp terms/);
 await role("service_role");
 await role("postgres");
 assert.equal((await q("select has_table_privilege('service_role','public.signature_requests','TRUNCATE') t"))[0].t,false);
 await denied(()=>q("insert into public.stamp_requests(agreement_id,agreement_version_id,provider_request_id,status) values($1,$2,'offline-stamp','pending')",[agreement,version]),/duplicate key|unique/);
 await denied(()=>q("insert into public.signature_requests(agreement_id,agreement_version_id,status,signer_name,signer_email,signed_document_storage_path) values($1,$2,'pending','x','x@example.invalid',$3)",[agreement,version,good]),/only be captured/);
 assert.equal((await q("select count(*)::int n from pg_policies where schemaname='storage' and policyname like '%can upload s%agreement documents'"))[0].n,0);
}));
test("every SECURITY DEFINER function pins a search_path ending in pg_temp",()=>isolated(async()=>{
 const r=await q(`select p.oid::regprocedure::text sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('public','nextwise_security') and p.prosecdef
  and not exists(select 1 from unnest(coalesce(p.proconfig,'{}')) c where c like 'search\\_path=%' and c like '%pg\\_temp')`);
 assert.deepEqual(r,[]);
}));

// CC-15 re-review P1 (Critical): student-created payment attempts must be for the
// exact amount due on their own payable invoice, never reuse an order, and a
// Nextwise Verified invoice can only ever be charged 199,900 INR.
test("students cannot create payment attempts for a wrong amount, a reused order or another invoice",()=>isolated(async()=>{
 const cheap=id(70),verified=id(71),other=id(72);
 await q(`insert into public.invoices(id,invoice_number,student_user_id,status,currency,subtotal_minor_units,total_minor_units) values
  ($1,'OFF-1',$4,'issued','INR',1000,1000),($2,'OFF-2',$4,'issued','INR',199900,199900),($3,'OFF-3',$5,'issued','INR',5000,5000)`,[cheap,verified,other,sa,sb]);
 await q("insert into public.pricing_purchases(student_user_id,plan_name_at_purchase,original_amount_minor_units,final_amount_minor_units,currency,invoice_id) values($1,'Nextwise Verified',199900,199900,'INR',$2)",[sa,verified]);
 await q("insert into public.invoice_line_items(invoice_id,description,unit_amount_minor_units,line_total_minor_units) values($1,'Cheap',1000,1000),($2,'Nextwise Verified',199900,199900),($3,'Other',5000,5000)",[cheap,verified,other]);
 const attempt=(inv,amount,order,key,by=sa,status="created")=>q("insert into public.payment_attempts(invoice_id,provider,provider_order_id,idempotency_key,status,amount_minor_units,currency,created_by) values($1,'razorpay',$2,$3,$5,$4,'INR',$6)",[inv,order,key,amount,status,by]);
 await role("authenticated",sa);
 await attempt(cheap,1000,"order_A","offline-key-0001");                                   // legitimate
 await denied(()=>attempt(verified,199900,"order_A","offline-key-0002"),/duplicate key|unique/); // reused order
 await denied(()=>attempt(verified,1000,"order_B","offline-key-0003"),/row-level security/);   // wrong amount
 await denied(()=>attempt(verified,199900,"order_B","offline-key-0004",sa,"captured"),/row-level security/);
 await denied(()=>attempt(verified,199900,"order_B","offline-key-0005",sb),/row-level security/); // spoofed creator
 await denied(()=>attempt(other,5000,"order_C","offline-key-0006"),/row-level security/);      // not their invoice
 await attempt(verified,199900,"order_B","offline-key-0007");                               // exact Verified amount
 await role("postgres");await q("update public.invoices set total_minor_units=235882,subtotal_minor_units=235882 where id=$1",[verified]);
 await q("delete from public.payment_attempts where invoice_id=$1",[verified]);
 await role("authenticated",sa);
 await denied(()=>attempt(verified,235882,"order_D","offline-key-0008"),/row-level security/);  // Verified overcharge
 assert.equal((await q("select has_function_privilege('anon','public.payment_attempt_insert_allowed(uuid,bigint,text,text,text,text)','execute') a"))[0].a,false);
}));

// CC-16 (F1): only the trusted server identity can submit AI results; a staff
// client cannot finalize directly, even with fabricated provider evidence.
test("an assigned counsellor cannot finalize directly with fabricated AI output",()=>isolated(async()=>{
 await role("authenticated",ca);const run=await reserve(sa,consent,"openai");
 await denied(()=>finalize(run.run_id,{asCaller:true,provider:"openai",report:{studentProfileRef:{studentUserId:sa},generation:{provider:"openai",model:"offline-model",dataClass:"fictional",providerResponseId:"resp_FABRICATED"}}}),/permission denied/);
 await role("postgres");await db.exec("grant execute on function public.staff_finalize_ai_generation_run(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb) to authenticated");
 await role("authenticated",ca);
 await denied(()=>finalize(run.run_id,{asCaller:true,provider:"openai"}),/trusted server/);
 await denied(()=>q("select nextwise_security.finalize_ai_generation_run_impl($1,$2,$3,'{}','{}','{}')",[run.run_id,sa,consent]),/permission denied/);
 await role("postgres");assert.deepEqual(await contentCounts(),noContent);
 assert.equal((await q("select status from public.ai_generation_runs where id=$1",[run.run_id]))[0].status,"reserved");
}));
test("trusted finalization is bound to the real requester and restores the caller identity",()=>isolated(async()=>{
 await role("authenticated",ca);const run=await reserve();
 await role("postgres");
 await denied(()=>finalize(run.run_id,{requester:cb}),/requester|authorized/);
 await denied(()=>finalize(run.run_id,{requester:null}),/signed in/);
 await denied(()=>finalize(run.run_id,{requester:id(99)}),/signed in/);
 assert.deepEqual(await contentCounts(),noContent);
 await db.exec("set local role service_role");
 const r=(await q("select public.staff_finalize_ai_generation_run($1,$2,$3,$4,$5,$6,$7) result",[ca,run.run_id,sa,consent,
  {studentProfileRef:{studentUserId:sa},generation:{provider:"mock",model:"mock-model",dataClass:"fictional",providerResponseId:null}},
  {aiAssisted:true,summary:"offline content"},{model:"mock-model",inputTokens:1,outputTokens:1,estimatedCostUsd:0,attempts:1,latencyMs:1}]))[0].result;
 assert.equal(r.outcome,"finalized");
 assert.equal((await q("select coalesce(current_setting('request.jwt.claim.sub',true),'') s"))[0].s,"");
 await db.exec("reset role");
 const d=(await q("select created_by from public.recommendation_drafts where id=$1",[r.draft_id]))[0];assert.equal(d.created_by,ca);
}));

// CC-16 (P1): a Razorpay authorization/capture is applied only when the gateway
// amount and currency equal the server-created payment attempt and its invoice.
test("webhook captures are reconciled against the attempt amount and currency before marking an invoice paid",()=>isolated(async()=>{
 const inv=id(80);
 await q("insert into public.payment_gateway_config(id,razorpay_webhook_secret,razorpay_key_secret) values(1,'offline-rzp-secret','offline-rzp-key') on conflict(id) do update set razorpay_webhook_secret=excluded.razorpay_webhook_secret,razorpay_key_secret=excluded.razorpay_key_secret");
 await q("insert into public.invoices(id,invoice_number,student_user_id,status,currency,subtotal_minor_units,total_minor_units) values($1,'OFF-80',$2,'issued','INR',199900,199900)",[inv,sa]);
 const attempt=(await q("insert into public.payment_attempts(invoice_id,provider,provider_order_id,idempotency_key,status,amount_minor_units,currency,created_by) values($1,'razorpay','order_V','offline-key-0080','created',199900,'INR',$2) returning id",[inv,sa]))[0].id;
 const hook=async(event,pay,amount,currency="INR")=>{
  const body=JSON.stringify({event,payload:{payment:{entity:{id:pay,order_id:"order_V",amount,currency,method:"upi"}}}});
  const sig=createHmac("sha256","offline-rzp-secret").update(body).digest("hex");
  await role("anon");const r=(await q("select public.apply_webhook_event($1,$2) r",[body,sig]))[0].r;await role("postgres");return r;
 };
 const status=async()=>(await q("select status from public.invoices where id=$1",[inv]))[0].status;
 const txns=async()=>(await q("select count(*)::int n from public.payment_transactions where payment_attempt_id=$1",[attempt]))[0].n;
 assert.equal((await hook("payment.captured","pay_1",1000)).processing_status,"failed");          // ₹10 captured
 assert.equal(await txns(),0);assert.equal(await status(),"issued");
 assert.equal((await hook("payment.captured","pay_2",199900,"USD")).processing_status,"failed");  // wrong currency
 assert.equal((await hook("payment.captured","pay_3",null)).processing_status,"failed");          // no amount
 assert.equal(await txns(),0);assert.equal(await status(),"issued");
 const ev=(await q("select diagnostic_message d from public.payment_webhook_events where processing_status='failed' order by created_at desc limit 1"))[0].d;
 assert.match(ev,/does not match the payment attempt/);
 assert.equal((await hook("payment.captured","pay_4",199900)).processing_status,"processed");     // exact
 assert.equal(await txns(),1);assert.equal(await status(),"paid");
 assert.equal((await hook("payment.captured","pay_4",199900)).duplicate,true);                   // redelivery is idempotent
 assert.equal((await hook("payment.authorized","pay_4",199900)).processing_status,"processed");  // late event cannot downgrade
 assert.equal(await txns(),1);assert.equal(await status(),"paid");
}));

// ============================================================================
// CC-18: Nextwise Verified = exactly 199,900 paise INR INCLUDING applicable GST.
// G1–G12 acceptance matrix at database level (purchase -> invoice -> pre-order
// check -> student payment attempt -> gateway capture). Every negative case
// asserts: no payable invoice, no attempt, no paid status (hence no entitlement).
// ============================================================================
const VALID_GSTIN="27AAPFU0939F1ZV";
async function gstFixture(){
 await q(`insert into public.pricing_plans(id,slug,category,internal_name,display_order,is_recommended,is_active) values
  ($1,'nextwise-verified','school_counselling','Nextwise Verified',20,false,true),
  ($2,'nextwise-essential','school_counselling','Nextwise Essential',30,false,true)`,[id(90),id(91)]);
 await q(`insert into public.pricing_plan_versions(id,plan_id,version_number,public_title,short_description,currency,amount_minor_units,payment_type,included_services,exclusions,cta_text,tax_status,status,effective_from)
  values ($1,$3,1,'Nextwise Verified','x','INR',199900,'one_time','[]','[]','Buy','tax_inclusive','published',now()-interval '1 day'),
         ($2,$4,1,'Nextwise Essential','x','INR',2499900,'one_time','[]','[]','Buy','tax_exclusive','published',now()-interval '1 day')`,[id(92),id(93),id(90),id(91)]);
 await q("insert into public.payment_gateway_config(id,razorpay_webhook_secret,razorpay_key_secret) values(1,'offline-rzp-secret','offline-rzp-key') on conflict(id) do update set razorpay_webhook_secret=excluded.razorpay_webhook_secret");
}
async function setGst(registered,gstin,rate){
 await q("update public.billing_settings set gst_registered=$1,gstin=$2,default_tax_rate_bps=$3 where id=1",[registered,gstin,rate]);
}
async function purchase(plan=id(90),extra={}){
 await role("authenticated",sa);
 const r=(await q("select public.purchase_pricing_plan($1,$2,$3) r",[plan,extra.offer??null,extra.coupon??null]))[0].r;
 await role("postgres");return r;
}
async function invoiceRow(invoice){return (await q("select status,currency,subtotal_minor_units::int s,discount_minor_units::int d,tax_minor_units::int t,total_minor_units::int tot from public.invoices where id=$1",[invoice]))[0];}
// Published versions are immutable: a catalogue change is a new, higher published version.
let versionSeq=1;
async function newVerifiedVersion(attrs){
 const v={amount:199900,currency:"INR",tax:"tax_inclusive",...attrs};
 await q("insert into public.pricing_plan_versions(plan_id,version_number,public_title,short_description,currency,amount_minor_units,payment_type,included_services,exclusions,cta_text,tax_status,status,effective_from) values($1,$2,'Nextwise Verified','x',$3,$4,'one_time','[]','[]','Buy',$5,'published',now()-interval '1 hour')",[id(90),++versionSeq,v.currency,v.amount,v.tax]);
}
async function charge(invoice,amount=199900,currency="INR"){
 await role("authenticated",sa);const r=(await q("select public.check_invoice_charge($1,$2,$3) r",[invoice,amount,currency]))[0].r;await role("postgres");return r;
}
let orderSeq=0;
async function attempt(invoice,amount=199900,order){
 await role("authenticated",sa);
 const o=order??("order_g_"+(++orderSeq));
 await q("insert into public.payment_attempts(invoice_id,provider,provider_order_id,idempotency_key,status,amount_minor_units,currency,created_by) values($1,'razorpay',$2,$3,'created',$4,'INR',$5)",[invoice,o,"gst-key-"+o,amount,sa]);
 await role("postgres");return o;
}
async function capture(order,pay,amount=199900,currency="INR"){
 const body=JSON.stringify({event:"payment.captured",payload:{payment:{entity:{id:pay,order_id:order,amount,currency,method:"upi"}}}});
 const sig=createHmac("sha256","offline-rzp-secret").update(body).digest("hex");
 await role("anon");const r=(await q("select public.apply_webhook_event($1,$2) r",[body,sig]))[0].r;await role("postgres");return r;
}
const attempts=async(invoice)=>(await q("select count(*)::int n from public.payment_attempts where invoice_id=$1",[invoice]))[0].n;
const invoicesFor=async()=>(await q("select count(*)::int n from public.invoices where student_user_id=$1",[sa]))[0].n;

test("G1 GST not registered: invoice 199,900 with zero tax, order and capture at 199,900, invoice paid",()=>isolated(async()=>{
 await gstFixture();await setGst(false,null,null);
 const r=await purchase();assert.equal(r.total_minor_units,199900);
 assert.deepEqual(await invoiceRow(r.invoice_id),{status:"issued",currency:"INR",s:199900,d:0,t:0,tot:199900});
 assert.equal(await charge(r.invoice_id),null);
 const o=await attempt(r.invoice_id);assert.equal((await capture(o,"pay_g1")).processing_status,"processed");
 assert.equal((await invoiceRow(r.invoice_id)).status,"paid");
}));
test("G2 GST registered at 18%: 199,900 gross includes 30,493 GST (net 169,407); paid at exactly 199,900",()=>isolated(async()=>{
 await gstFixture();await setGst(true,VALID_GSTIN,1800);
 const r=await purchase();const inv=await invoiceRow(r.invoice_id);
 assert.equal(inv.tot,199900);assert.equal(inv.t,30493);assert.equal(inv.tot-inv.t,169407);
 const line=(await q("select tax_rate_bps,tax_minor_units,line_total_minor_units from public.invoice_line_items where invoice_id=$1",[r.invoice_id]))[0];
 assert.deepEqual([line.tax_rate_bps,Number(line.tax_minor_units),Number(line.line_total_minor_units)],[1800,30493,199900]);
 const pp=(await q("select final_amount_minor_units::int f,tax_minor_units::int t from public.pricing_purchases where invoice_id=$1",[r.invoice_id]))[0];
 assert.deepEqual([pp.f,pp.t],[199900,30493]);
 assert.equal(await charge(r.invoice_id),null);
 const o=await attempt(r.invoice_id);assert.equal((await capture(o,"pay_g2")).processing_status,"processed");
 assert.equal((await invoiceRow(r.invoice_id)).status,"paid");
}));
test("G2b other valid GST rates use the inclusive formula (5% -> 9,519 inside 199,900)",()=>isolated(async()=>{
 await gstFixture();await setGst(true,VALID_GSTIN,500);
 const r=await purchase();const inv=await invoiceRow(r.invoice_id);
 assert.equal(inv.tot,199900);assert.equal(inv.t,Math.round(199900*500/10500));
 assert.equal(await charge(r.invoice_id),null);
}));
test("G3 an invoice issued under the old tax-on-top behaviour is never payable or reused",()=>isolated(async()=>{
 await gstFixture();await setGst(true,VALID_GSTIN,1800);
 const inv=id(94);
 await q("insert into public.invoices(id,invoice_number,student_user_id,status,currency,subtotal_minor_units,tax_minor_units,total_minor_units,pricing_plan_id) values($1,'OLD-1',$2,'issued','INR',199900,35982,235882,$3)",[inv,sa,id(90)]);
 await q("insert into public.invoice_line_items(invoice_id,description,unit_amount_minor_units,tax_rate_bps,tax_minor_units,line_total_minor_units) values($1,'Nextwise Verified',199900,1800,35982,235882)",[inv]);
 await q("insert into public.pricing_purchases(student_user_id,plan_id,plan_version_id,plan_name_at_purchase,original_amount_minor_units,tax_minor_units,final_amount_minor_units,currency,invoice_id) values($1,$2,$3,'Nextwise Verified',199900,35982,235882,'INR',$4)",[sa,id(90),id(92),inv]);
 assert.equal(await charge(inv,235882),"verified_price_mismatch");
 await denied(()=>attempt(inv,235882),/row-level security/);
 await role("authenticated",sa);await denied(()=>q("select public.purchase_pricing_plan($1)",[id(90)]),/needs review by support/);await role("postgres");
 assert.equal(await attempts(inv),0);assert.equal((await invoiceRow(inv)).status,"issued");
}));
for(const [label,registered,gstin,rate,code] of [
 ["GSTIN missing",true,null,1800,"gstin_invalid"],
 ["GSTIN malformed",true,"27AAPFU0939F1Z",1800,"gstin_invalid"],
 ["rate missing",true,VALID_GSTIN,null,"gst_rate_invalid"],
 ["rate zero",true,VALID_GSTIN,0,"gst_rate_invalid"],
 ["rate above 28%",true,VALID_GSTIN,3000,"gst_rate_invalid"],
])test("G4 registered with "+label+": no payable invoice is created (fails closed, never zero tax)",()=>isolated(async()=>{
 await gstFixture();await setGst(registered,gstin,rate);
 await role("authenticated",sa);await denied(()=>q("select public.purchase_pricing_plan($1)",[id(90)]),new RegExp("incomplete \\("+code+"\\)"));await role("postgres");
 assert.equal(await invoicesFor(),0);
}));
test("G4b billing settings missing blocks purchase; a valid invoice becomes unpayable if the configuration later breaks",()=>isolated(async()=>{
 await gstFixture();await setGst(true,VALID_GSTIN,1800);
 const r=await purchase();assert.equal(await charge(r.invoice_id),null);
 await setGst(true,null,1800);
 assert.equal(await charge(r.invoice_id),"gstin_invalid");
 await denied(()=>attempt(r.invoice_id),/row-level security/);
 await q("delete from public.billing_settings where id=1");
 assert.equal(await charge(r.invoice_id),"billing_settings_missing");
 await role("authenticated",sa);await denied(()=>q("select public.purchase_pricing_plan($1)",[id(91)]),/billing_settings_missing/);await role("postgres");
 assert.equal(await attempts(r.invoice_id),0);
}));
test("G5 Verified marked tax-exclusive (or not tax-inclusive while registered) is rejected",()=>isolated(async()=>{
 await gstFixture();await setGst(true,VALID_GSTIN,1800);
 await newVerifiedVersion({tax:"tax_exclusive"});
 await role("authenticated",sa);await denied(()=>q("select public.purchase_pricing_plan($1)",[id(90)]),/inclusive of GST/);
 await role("postgres");await newVerifiedVersion({tax:"unconfigured"});
 await role("authenticated",sa);await denied(()=>q("select public.purchase_pricing_plan($1)",[id(90)]),/tax-inclusive while GST is registered/);
 await role("postgres");assert.equal(await invoicesFor(),0);
}));
test("G6 offers or coupons on Verified are rejected; wrong catalogue price or currency is rejected",()=>isolated(async()=>{
 await gstFixture();await setGst(false,null,null);
 await role("authenticated",sa);
 await denied(()=>q("select public.purchase_pricing_plan($1,$2,null)",[id(90),id(95)]),/do not apply to Nextwise Verified/);
 await denied(()=>q("select public.purchase_pricing_plan($1,null,'SAVE10')",[id(90)]),/do not apply to Nextwise Verified/);
 await role("postgres");await newVerifiedVersion({amount:249900});
 await role("authenticated",sa);await denied(()=>q("select public.purchase_pricing_plan($1)",[id(90)]),/not correctly configured/);
 await role("postgres");await newVerifiedVersion({currency:"USD"});
 await role("authenticated",sa);await denied(()=>q("select public.purchase_pricing_plan($1)",[id(90)]),/not correctly configured/);
 await role("postgres");assert.equal(await invoicesFor(),0);
}));
test("G7 wrong attempt amount and reused order identifiers are refused",()=>isolated(async()=>{
 await gstFixture();await setGst(true,VALID_GSTIN,1800);
 const r=await purchase();
 await denied(()=>attempt(r.invoice_id,169407),/row-level security/);
 await denied(()=>attempt(r.invoice_id,235882),/row-level security/);
 assert.equal(await charge(r.invoice_id,199900,"USD"),"currency_mismatch");
 const o=await attempt(r.invoice_id);
 await role("postgres");await q("update public.payment_attempts set status='failed' where provider_order_id=$1",[o]);
 await denied(()=>attempt(r.invoice_id,199900,o),/duplicate key|unique/);
 assert.equal(await attempts(r.invoice_id),1);
}));
for(const [label,amount,currency] of [["G8 captured amount differs (₹10)",1000,"INR"],["G9 captured currency differs (USD)",199900,"USD"]])
 test(label+": capture is not applied and the invoice is not paid",()=>isolated(async()=>{
  await gstFixture();await setGst(true,VALID_GSTIN,1800);
  const r=await purchase();const o=await attempt(r.invoice_id);
  assert.equal((await capture(o,"pay_bad",amount,currency)).processing_status,"failed");
  assert.equal((await q("select count(*)::int n from public.payment_transactions t join public.payment_attempts a on a.id=t.payment_attempt_id where a.invoice_id=$1",[r.invoice_id]))[0].n,0);
  assert.equal((await invoiceRow(r.invoice_id)).status,"issued");
 }));
test("G10 duplicate capture delivery is recorded once and the invoice stays paid",()=>isolated(async()=>{
 await gstFixture();await setGst(true,VALID_GSTIN,1800);
 const r=await purchase();const o=await attempt(r.invoice_id);
 assert.equal((await capture(o,"pay_g10")).processing_status,"processed");
 assert.equal((await capture(o,"pay_g10")).duplicate,true);
 assert.equal((await q("select count(*)::int n from public.payment_transactions where provider_payment_id='pay_g10'"))[0].n,1);
 assert.equal((await invoiceRow(r.invoice_id)).status,"paid");
}));
test("G12 partial Verified charges and inconsistent invoice breakdowns are refused",()=>isolated(async()=>{
 await gstFixture();await setGst(true,VALID_GSTIN,1800);
 const r=await purchase();
 assert.equal(await charge(r.invoice_id,100000),"amount_not_due");
 await denied(()=>attempt(r.invoice_id,100000),/row-level security/);
 await q("update public.invoice_line_items set line_total_minor_units=199800 where invoice_id=$1",[r.invoice_id]);
 assert.equal(await charge(r.invoice_id),"invoice_breakdown_inconsistent");
 await q("update public.invoice_line_items set line_total_minor_units=199900,tax_minor_units=30000 where invoice_id=$1",[r.invoice_id]);
 await q("update public.invoices set tax_minor_units=30000 where id=$1",[r.invoice_id]);
 assert.equal(await charge(r.invoice_id),"verified_tax_mismatch");
 assert.equal(await attempts(r.invoice_id),0);
}));
test("other plans keep their behaviour: tax-exclusive Essential adds GST; admin invoices with their own line rates stay payable",()=>isolated(async()=>{
 await gstFixture();await setGst(true,VALID_GSTIN,1800);
 const r=await purchase(id(91));const inv=await invoiceRow(r.invoice_id);
 assert.equal(inv.tot,2499900+Math.round(2499900*0.18));
 assert.equal(await charge(r.invoice_id,inv.tot),null);
 const adm=id(96);
 await q("insert into public.invoices(id,invoice_number,student_user_id,status,currency,subtotal_minor_units,tax_minor_units,total_minor_units) values($1,'ADM-1',$2,'issued','INR',10000,500,10500)",[adm,sa]);
 await q("insert into public.invoice_line_items(invoice_id,description,unit_amount_minor_units,tax_rate_bps,tax_minor_units,line_total_minor_units) values($1,'Service',10000,500,500,10500)",[adm]);
 assert.equal(await charge(adm,10500),null);
}));
test("charge-check helpers are not callable by clients; the pre-order check exposes only the caller's own invoice",()=>isolated(async()=>{
 await gstFixture();await setGst(false,null,null);const r=await purchase();
 for(const fn of ["nw_billing_tax_config_problem()","nw_billing_gst_rate_bps()","nw_invoice_charge_problem(uuid,bigint,text,uuid)"])
  for(const who of ["anon","authenticated","service_role"])assert.equal((await q("select has_function_privilege($1,$2,'execute') a",[who,"public."+fn]))[0].a,false,who+" "+fn);
 assert.equal((await q("select has_function_privilege('anon','public.check_invoice_charge(uuid,bigint,text)','execute') a"))[0].a,false);
 await role("authenticated",sb);assert.equal((await q("select public.check_invoice_charge($1,199900,'INR') r",[r.invoice_id]))[0].r,"invoice_not_found");
 await role("anon");await denied(()=>q("select public.check_invoice_charge($1,199900,'INR')",[r.invoice_id]),/permission denied/);
}));
