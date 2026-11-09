// Rehearsal of the assembled NW09_2_ATOMIC_01-03.sql on a disposable LOCAL PostgreSQL.
// Proves: all-or-nothing behaviour under forced failure (catalog + data unchanged),
// successful application with explicit EXECUTE grants, preservation of existing data and
// unrelated schema, and fail-closed guards (approval setting, owner, prerequisites, drift).
//
//   NW_SECURITY_PG_ADMIN_URL=postgres://postgres@localhost:54329/postgres \
//   NW_SECURITY_PG_DISPOSABLE=1 node --test scripts/security/nw-f01-s4.migration-rehearsal.test.mjs
import {before,after,test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import path from "node:path";
import pg from "pg";
import {assemble,ARTIFACT,APPROVAL_SETTING} from "./assemble-nw09-2-atomic.mjs";

const adminUrl=process.env.NW_SECURITY_PG_ADMIN_URL;
if(!adminUrl||process.env.NW_SECURITY_PG_DISPOSABLE!=="1")
 throw new Error("Set NW_SECURITY_PG_ADMIN_URL to a disposable local PostgreSQL and NW_SECURITY_PG_DISPOSABLE=1.");
if(!["localhost","127.0.0.1","[::1]"].includes(new URL(adminUrl).hostname))
 throw new Error("Refusing non-loopback PostgreSQL host; this rehearsal is for disposable local databases only.");

const read=(p)=>readFileSync(path.resolve(p),"utf8");
const id=(n)=>"00000000-0000-4000-8000-"+String(n).padStart(12,"0");
const admin=id(1),ca=id(2),sa=id(4),sb=id(5);
const artifact=read(ARTIFACT).replace(/\r\n/g,"\n");
const databases=[];

// Catalog fingerprint of every non-system schema: relations, columns, constraints,
// indexes, triggers, policies, functions (body hash, definer, config, owner, ACL),
// table/column ACLs, schema ACLs and default privileges. OID-independent.
const CATALOG=`
with ns as (select oid,nspname from pg_namespace where nspname not like 'pg\\_%' and nspname<>'information_schema')
select jsonb_build_object(
 'schemas',(select jsonb_agg(v order by v::text) from (select jsonb_build_array(n.nspname,pg_get_userbyid(n.nspowner),n.nspacl::text) v from pg_namespace n join ns using(oid)) q),
 'relations',(select jsonb_agg(v order by v::text) from (select jsonb_build_array(ns.nspname,c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner),c.relacl::text) v
   from pg_class c join ns on ns.oid=c.relnamespace where c.relkind in ('r','v','m','p','S','f')) q),
 'columns',(select jsonb_agg(v order by v::text) from (select jsonb_build_array(ns.nspname,c.relname,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid),a.attacl::text) v
   from pg_attribute a join pg_class c on c.oid=a.attrelid join ns on ns.oid=c.relnamespace left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
   where a.attnum>0 and not a.attisdropped and c.relkind in ('r','v','m','p')) q),
 'constraints',(select jsonb_agg(v order by v::text) from (select jsonb_build_array(ns.nspname,c.relname,k.conname,pg_get_constraintdef(k.oid)) v
   from pg_constraint k join pg_class c on c.oid=k.conrelid join ns on ns.oid=c.relnamespace) q),
 'indexes',(select jsonb_agg(v order by v::text) from (select jsonb_build_array(ns.nspname,t.relname,i.relname,pg_get_indexdef(i.oid)) v
   from pg_class i join pg_index x on x.indexrelid=i.oid join pg_class t on t.oid=x.indrelid join ns on ns.oid=i.relnamespace where i.relkind='i') q),
 'triggers',(select jsonb_agg(v order by v::text) from (select jsonb_build_array(ns.nspname,c.relname,t.tgname,pg_get_triggerdef(t.oid),t.tgenabled) v
   from pg_trigger t join pg_class c on c.oid=t.tgrelid join ns on ns.oid=c.relnamespace where not t.tgisinternal) q),
 'policies',(select jsonb_agg(v order by v::text) from (select jsonb_build_array(schemaname,tablename,policyname,cmd,roles::text,qual,with_check) v
   from pg_policies where schemaname in (select nspname from ns)) q),
 'functions',(select jsonb_agg(v order by v::text) from (select jsonb_build_array(ns.nspname,p.proname,pg_get_function_identity_arguments(p.oid),md5(p.prosrc),p.prosecdef,p.proconfig::text,pg_get_userbyid(p.proowner),p.proacl::text,p.provolatile) v
   from pg_proc p join ns on ns.oid=p.pronamespace) q),
 'default_acl',(select jsonb_agg(v order by v::text) from (select jsonb_build_array(pg_get_userbyid(defaclrole),defaclnamespace::regnamespace::text,defaclobjtype,defaclacl::text) v from pg_default_acl) q)
) fp`;
// Row-level fingerprint of every ordinary table in public, auth, storage, nextwise_security.
async function dataFingerprint(c,{exclude=[]}={}){
 const tables=(await c.query(`select format('%I.%I',n.nspname,c.relname) t from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where c.relkind='r' and n.nspname in ('public','auth','storage','nextwise_security') order by 1`)).rows.map(r=>r.t);
 const out={};
 for(const t of tables){if(exclude.includes(t))continue;
  out[t]=(await c.query(`select count(*)::int n,coalesce(md5(string_agg(x::text,'|' order by x::text)),'') h from ${t} x`)).rows[0];}
 return out;
}
const catalog=async(c)=>(await c.query(CATALOG)).rows[0].fp;

async function freshDatabase(tag){
 const name="nw_f01_rehearsal_"+tag+"_"+process.pid;databases.push(name);
 const a=new pg.Client({connectionString:adminUrl});await a.connect();await a.query("create database "+name);await a.end();
const u=new URL(adminUrl);u.pathname="/"+name;const c=new pg.Client({connectionString:u.href});c.on("error",()=>{});await c.connect();
 await c.query(`do $$begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin noinherit; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin noinherit; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin noinherit bypassrls; end if;
 end$$;`);
 await c.query([
 "create extension if not exists pgcrypto;create extension if not exists pg_trgm;",
 "create schema auth;create schema storage;",
 "create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');",
 "create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;",
 "grant usage on schema auth,storage,public to anon,authenticated,service_role;",
 "grant execute on function auth.uid() to anon,authenticated,service_role;",
 "create table storage.buckets(id text primary key,name text,public boolean default false,file_size_limit bigint,allowed_mime_types text[]);",
 "create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,owner uuid,owner_id text,metadata jsonb,created_at timestamptz default now(),updated_at timestamptz default now(),unique(bucket_id,name));",
 "alter table storage.objects enable row level security;grant all on all tables in schema storage to service_role;",
 // Supabase-like broad defaults: the migration must close these explicitly.
 "alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;",
 "alter default privileges in schema public grant all on tables to anon,authenticated,service_role;"
 ].join("\n"));
 for(const f of readdirSync("supabase/migrations").filter(x=>x.endsWith(".sql")).sort())await c.query(read("supabase/migrations/"+f));
 for(const f of ["NW05_student_mark_section_self_entered.sql","NW06_application_tasks.sql","NW07_counsellor_studio_foundation.sql","NW09_ai_career_intelligence.sql"])
  await c.query(read("supabase/migrations-proposed/"+f));
 // Synthetic pre-existing history that the migration must preserve (fictional only).
 await c.query("insert into auth.users(id,email) select x,'rehearsal-'||x||'@example.invalid' from unnest($1::uuid[]) x",[[admin,ca,sa,sb]]);
 await c.query("insert into public.admin_roles(user_id,role) values($1,'super_admin'),($2,'counsellor')",[admin,ca]);
 await c.query("insert into public.counsellors(id,user_id,display_name) values($1,$2,'Rehearsal A')",[id(20),ca]);
 await c.query("insert into public.admin_student_meta(student_user_id,assigned_counsellor_id) values($1,$2),($3,$2)",[sa,id(20),sb]);
 await c.query("select set_config('request.jwt.claim.sub',$1,false)",[ca]);await c.query("set role authenticated");
 const draft=(await c.query("select * from public.staff_create_recommendation_draft($1,'Legacy manual draft','career','{\"note\":\"pre-existing\"}')",[sa])).rows[0];
 await c.query("reset role");
 await c.query(`insert into public.ai_generation_runs(student_user_id,requested_by,requested_by_role,idempotency_key,provider,model,prompt_version,report_schema_version,data_class,status,reason,input_tokens,output_tokens,reserved_cost_usd,estimated_cost_usd,attempts,latency_ms,consent_confirmed,draft_id,report,created_at,completed_at) values
  ($1,$2,'counsellor','legacy_history_success_01','mock','mock-model','prompt-v1','report-v1','fictional','succeeded',null,100,50,0,0,1,10,true,$3,'{"legacy":true}',now()-interval '3 days',now()-interval '3 days'),
  ($1,$2,'counsellor','legacy_history_failure_01','openai','gpt-legacy','prompt-v1','report-v1','fictional','failed','legacy provider timeout',200,0,0.4,0.4,2,900,true,null,null,now()-interval '2 days',now()-interval '2 days'),
  ($4,$2,'counsellor','legacy_history_blocked_01','mock','mock-model','prompt-v1','report-v1','real_student','blocked','legacy limit',0,0,0,0,0,0,true,null,null,now()-interval '1 day',now()-interval '1 day')`,[sa,ca,draft.id,sb]);
 await c.query("update public.ai_usage_settings set per_staff_daily=7,monthly_budget_usd=12.5 where id=1");
 await c.query("insert into public.admin_audit_log(actor_role,action,entity_type,summary) values('system','REHEARSAL_PRE_EXISTING','rehearsal','pre-existing audit row')");
 return c;
}
// Runs the artifact the way an operator would: one batch, opt-in setting first.
async function apply(c,sql,{approval="REHEARSAL-LOCAL-ONLY"}={}){
 if(approval!==null)await c.query("select set_config($1,$2,false)",[APPROVAL_SETTING,approval]);
 else await c.query("select set_config($1,'',false)",[APPROVAL_SETTING]);
 try{await c.query(sql);return null;}
 catch(e){await c.query("rollback").catch(()=>{});return e;}
}
const FORCED="do $$ begin raise exception 'REHEARSAL FORCED FAILURE'; end $$;";
// Function replacers: a string replacement would turn "$$" into "$".
const failAt=(marker)=>{assert.ok(artifact.includes(marker));return artifact.replace(marker,()=>FORCED+"\n"+marker);};
const preservedTables=["public.ai_usage_settings","public.recommendation_drafts","public.recommendation_draft_versions","public.admin_audit_log","public.admin_roles","public.admin_student_meta","auth.users"];

let db;
before(async()=>{db=await freshDatabase("main");},{timeout:180000});
after(async()=>{
 if(db)await db.end();
 const a=new pg.Client({connectionString:adminUrl});await a.connect();
 for(const n of databases)await a.query("drop database if exists "+n+" with (force)");await a.end();
});

test("artifact is exactly the reviewed sources with a single outer transaction",()=>{
 assert.equal(artifact,assemble());
 assert.equal((artifact.match(/^begin;$/gim)??[]).length,1);assert.equal((artifact.match(/^commit;$/gim)??[]).length,1);
 assert.doesNotMatch(artifact,/===== BEGIN (NW09_2_openai_live_pilot|04_pause_ai_recovery)/);
});
for(const [label,mutate] of [
 ["immediately before COMMIT (after every postcondition passed)",()=>failAt("-- @@REHEARSAL_FAILPOINT@@")],
 ["between 02 and 03 (partial schema in flight)",()=>failAt("-- ===== BEGIN 03_review_separation_and_grants.sql =====")],
 ["between 01 and 02",()=>failAt("-- ===== BEGIN 02_nw09_2_replacement.sql =====")],
]){
 test("forced failure "+label+" leaves catalog and data byte-identical",async()=>{
  const cat=await catalog(db),data=await dataFingerprint(db);
  const err=await apply(db,mutate());
  assert.ok(err);assert.match(err.message,/REHEARSAL FORCED FAILURE/);
  assert.deepEqual(await catalog(db),cat);assert.deepEqual(await dataFingerprint(db),data);
  assert.equal((await db.query("select to_regclass('public.student_ai_processing_consents') t")).rows[0].t,null);
 });
}
test("fail-closed guards: missing approval setting and non-owner role change nothing",async()=>{
 const cat=await catalog(db);
 const e1=await apply(db,artifact,{approval:null});assert.match(e1.message,/approval reference/);
 await db.query("create role rehearsal_operator login");await db.query("grant create on database "+db.database+" to rehearsal_operator");
 await db.query("set role rehearsal_operator");const e2=await apply(db,artifact);await db.query("reset role");
 assert.match(e2.message,/owner must be postgres/);
 await db.query("revoke create on database "+db.database+" from rehearsal_operator");await db.query("drop role rehearsal_operator");
 assert.deepEqual(await catalog(db),cat);
});
test("prerequisites missing (no NW07/NW09) fails before any change",async()=>{
 const name="nw_f01_rehearsal_bare_"+process.pid;databases.push(name);
 const a=new pg.Client({connectionString:adminUrl});await a.connect();await a.query("create database "+name);await a.end();
 const u=new URL(adminUrl);u.pathname="/"+name;const c=new pg.Client({connectionString:u.href});await c.connect();
 const cat=await catalog(c);const err=await apply(c,artifact);
 assert.match(err.message,/Prerequisites missing/);assert.deepEqual(await catalog(c),cat);await c.end();
});
test("active reservation blocks the migration atomically (quiesce precondition)",async()=>{
 await db.query(`insert into public.ai_generation_runs(student_user_id,requested_by,idempotency_key,provider,model,prompt_version,report_schema_version,data_class,consent_confirmed)
  values($1,$2,'rehearsal_in_flight_0001','mock','mock-model','prompt-v1','report-v1','fictional',true)`,[sa,ca]);
 const cat=await catalog(db),data=await dataFingerprint(db);
 const err=await apply(db,artifact);assert.match(err.message,/Quiesce|reserv/i);
 assert.deepEqual(await catalog(db),cat);assert.deepEqual(await dataFingerprint(db),data);
 await db.query("delete from public.ai_generation_runs where idempotency_key='rehearsal_in_flight_0001'");
});
test("successful application: explicit grants, preserved data, unrelated schema unchanged",async()=>{
 const cat=await catalog(db);
 const runsBefore=(await db.query("select id,idempotency_key,status,provider,data_class,input_tokens,output_tokens,reserved_cost_usd,estimated_cost_usd,draft_id,report,created_at,completed_at from public.ai_generation_runs order by idempotency_key")).rows;
 const dataBefore=await dataFingerprint(db,{exclude:["public.ai_generation_runs","public.admin_audit_log"]});
 const draftsSql="select to_jsonb(d)-'approved_version_id' r from public.recommendation_drafts d order by id";
 const draftsBefore=(await db.query(draftsSql)).rows;
 const auditBefore=(await db.query("select id,action,summary,created_at from public.admin_audit_log order by id")).rows;
 const err=await apply(db,artifact);assert.equal(err,null,err?.message);
 const after_=await catalog(db);
 const delta={};
 for(const k of Object.keys(after_)){const b=new Set((cat[k]??[]).map(x=>JSON.stringify(x))),a=new Set((after_[k]??[]).map(x=>JSON.stringify(x)));
  delta[k]={added:[...a].filter(x=>!b.has(x)).length,removed:[...b].filter(x=>!a.has(x)).length};}
 console.log("# catalog delta (rows added/removed per category): "+JSON.stringify(delta));
 // Existing data preserved.
 assert.deepEqual((await db.query("select id,idempotency_key,status,provider,data_class,input_tokens,output_tokens,reserved_cost_usd,estimated_cost_usd,draft_id,report,created_at,completed_at from public.ai_generation_runs order by idempotency_key")).rows,runsBefore);
 const dataAfter=await dataFingerprint(db,{exclude:["public.ai_generation_runs","public.admin_audit_log"]});
 for(const t of preservedTables.filter(t=>t!=="public.admin_audit_log")){
  if(t==="public.ai_usage_settings")continue; // gains NW09.2 columns; checked below
  if(t==="public.recommendation_drafts")continue; // gains approved_version_id (CC-15); compared below
  assert.deepEqual(dataAfter[t],dataBefore[t],t+" rows changed");
 }
 assert.deepEqual((await db.query(draftsSql)).rows,draftsBefore,"recommendation_drafts original columns changed");
 const s=(await db.query("select per_staff_daily,monthly_budget_usd,real_student_processing_approved from public.ai_usage_settings where id=1")).rows[0];
 assert.equal(s.per_staff_daily,7);assert.equal(Number(s.monthly_budget_usd),12.5);assert.notEqual(s.real_student_processing_approved,true);
 const auditAfter=(await db.query("select id,action,summary,created_at from public.admin_audit_log where id = any($1::uuid[]) order by id",[auditBefore.map(r=>r.id)])).rows;
 assert.deepEqual(auditAfter,auditBefore);
 // Unrelated schema unchanged: every relation outside the reviewed set is identical.
 const reviewed=new Set(["ai_generation_runs","ai_usage_settings","recommendation_drafts","recommendation_draft_versions","student_ai_processing_consents","fictional_students","ai_model_reservations","admin_audit_log","signature_requests","stamp_requests"]);
 const strip=(rows,col=1)=>(rows??[]).filter(r=>!reviewed.has(r[col])&&r[0]!=="nextwise_security");
 // CC-15 (re-review D2) intentionally drops exactly these two admin upload policies.
 const DROPPED=["super_admin/admin can upload signed agreement documents","super_admin/admin can upload stamped agreement documents"];
 assert.equal((after_.policies??[]).filter(r=>DROPPED.includes(r[2])).length,0,"admin result-bucket upload policies must be gone");
 assert.equal((cat.policies??[]).filter(r=>DROPPED.includes(r[2])).length,2);
 const keepPolicies=(rows)=>(rows??[]).filter(r=>!DROPPED.includes(r[2]));
 for(const k of ["relations","columns","constraints","indexes","policies","triggers"]){
  const pick=k==="policies"?keepPolicies:(x)=>x;
  assert.deepEqual(strip(pick(after_[k])),strip(pick(cat[k])),k+" changed outside the reviewed set");
 }
 const touched=new Set([...artifact.matchAll(/create or replace function\s+([a-z_]+)\.([a-z_0-9]+)\s*\(/gi)].map(m=>m[1]+"."+m[2]));
 const fnStrip=(rows)=>(rows??[]).filter(r=>!touched.has(r[0]+"."+r[1]));
 const changedFns=fnStrip(after_.functions).filter(r=>!fnStrip(cat.functions).some(b=>JSON.stringify(b)===JSON.stringify(r)));
 console.log("# functions outside the CREATE OR REPLACE set whose ACL/config changed: "+JSON.stringify(changedFns.map(r=>r[0]+"."+r[1])));
 // Outside the replaced set, only two kinds of change are allowed: the CC-15 (F7)
 // pinned search_path, and an EXECUTE ACL change the artifact names explicitly.
 // Body hash, SECURITY DEFINER flag, owner and volatility must be identical.
 const PINNED=['{"search_path=pg_catalog, extensions, public, pg_temp"}','{"search_path=pg_catalog, public, pg_temp"}'];
 for(const r of changedFns){
  const b=cat.functions.find(x=>x[0]===r[0]&&x[1]===r[1]&&x[2]===r[2]);
  assert.ok(b,"function appeared outside the reviewed set: "+r[0]+"."+r[1]);
  assert.deepEqual([r[3],r[4],r[6],r[8]],[b[3],b[4],b[6],b[8]],"body/definer/owner/volatility changed: "+r[1]);
  if(r[5]!==b[5])assert.ok(PINNED.includes(r[5]),"unexpected config change: "+r[1]+" -> "+r[5]);
  if(r[7]!==b[7])assert.ok(artifact.includes(r[1]),"unexpected ACL change: "+r[1]);
 }
 // Explicit EXECUTE grants on every reviewed RPC.
 const expect={
  "public.record_system_audit_log(text,text,text,text,jsonb,jsonb)":{anon:false,authenticated:false,service_role:true},
  "public.set_signature_document_path(text,text,text)":{anon:false,authenticated:false,service_role:true},
  "public.set_stamp_document_path(text,text,text)":{anon:false,authenticated:false,service_role:true},
  "public.staff_reserve_ai_generation_run(uuid,text,text,text,text,text,text,boolean,numeric,integer,integer,integer,numeric,uuid,text)":null,
  "public.staff_finalize_ai_generation_run(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb)":{anon:false,authenticated:false,service_role:true},
  "public.staff_withdraw_ai_processing_consent(uuid,text)":{anon:false,authenticated:true,service_role:false},
  "public.staff_link_ai_generation_run_draft(uuid,uuid)":{anon:false,authenticated:false,service_role:false},
  "public.staff_review_recommendation_draft(uuid,text,uuid,text)":{anon:false,authenticated:true,service_role:false},
 };
 const fnRows=(await db.query(`select p.oid::regprocedure::text sig,has_function_privilege('anon',p.oid,'execute') anon,has_function_privilege('authenticated',p.oid,'execute') authenticated,
  has_function_privilege('service_role',p.oid,'execute') service_role,has_function_privilege('public',p.oid,'execute') pub
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'staff\\_%ai%' or p.proname in ('record_system_audit_log','set_signature_document_path','set_stamp_document_path','staff_review_recommendation_draft'))`)).rows;
 const bySig=Object.fromEntries(fnRows.map(r=>[(r.sig.startsWith("public.")?r.sig:"public."+r.sig).replace(/ /g,""),r]));
 for(const [sig,want] of Object.entries(expect)){
  const key=sig.replace(/ /g,"");const r=Object.entries(bySig).find(([k])=>k===key||(want===null&&k.startsWith(key.split("(")[0]+"(")))?.[1];
  assert.ok(r,"missing function "+sig);
  if(want===null){assert.equal(r.anon||r.authenticated||r.service_role,false,sig+" legacy reachable");continue;}
  for(const role of ["anon","authenticated","service_role"])assert.equal(r[role],want[role],sig+" "+role);
 }
 for(const r of fnRows)assert.equal(r.pub,false,r.sig+" executable by PUBLIC");
 // Every SECURITY DEFINER function in the reviewed schemas pins its search_path.
 const loose=(await db.query(`select p.oid::regprocedure::text sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('public','nextwise_security') and p.prosecdef and not exists(select 1 from unnest(coalesce(p.proconfig,'{}')) x where x like 'search\\_path=%' and x like '%pg\\_temp')`)).rows;
 assert.deepEqual(loose,[]);
 // RLS on all reviewed tables.
 const rls=(await db.query(`select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname = any($1)`,[["ai_generation_runs","ai_usage_settings","recommendation_drafts","recommendation_draft_versions","student_ai_processing_consents"]])).rows;
 assert.equal(rls.length,5);for(const r of rls)assert.equal(r.relrowsecurity,true,r.relname);
 assert.equal((await db.query("select count(*)::int n from nextwise_security.fictional_students")).rows[0].n,0);
 assert.equal((await db.query("select count(*)::int n from nextwise_security.ai_model_reservations")).rows[0].n,0);
});
test("re-running the committed artifact is idempotent or fails closed without change",async()=>{
 const cat=await catalog(db),data=await dataFingerprint(db);
 const err=await apply(db,artifact);
 if(err){assert.deepEqual(await catalog(db),cat);}
 else{assert.deepEqual(await catalog(db),cat);}
 assert.deepEqual(await dataFingerprint(db,{exclude:["public.admin_audit_log"]}),Object.fromEntries(Object.entries(data).filter(([k])=>k!=="public.admin_audit_log")));
 console.log("# rerun outcome: "+(err?"failed closed: "+err.message:"idempotent success"));
});
test("05 payment-integrity migration: atomic under forced failure, then applies and reruns cleanly",async()=>{
 const sql05=read("supabase/migrations-proposed/nw-f01-s3/05_payment_attempt_integrity.sql").replace(/\r\n/g,"\n");
 assert.equal((sql05.match(/^begin;$/gim)??[]).length,1);assert.equal((sql05.match(/^commit;$/gim)??[]).length,1);
 const cat=await catalog(db),data=await dataFingerprint(db);
 const forced=sql05.replace(/^commit;$/m,()=>"do $$ begin raise exception 'REHEARSAL FORCED FAILURE'; end $$;\ncommit;");
 const err=await apply(db,forced);assert.match(err.message,/REHEARSAL FORCED FAILURE/);
 assert.deepEqual(await catalog(db),cat);assert.deepEqual(await dataFingerprint(db),data);
 assert.equal(await apply(db,sql05),null);
 const after1=await catalog(db);
 assert.equal(await apply(db,sql05),null);
 assert.deepEqual(await catalog(db),after1);
 assert.deepEqual(await dataFingerprint(db),data);
 const pol=(await db.query("select with_check from pg_policies where tablename='payment_attempts' and policyname='Students can create payment attempts on their own invoices'")).rows[0];
 assert.match(pol.with_check,/payment_attempt_insert_allowed/);
});
test("06 capture-reconciliation migration: requires 05, atomic under forced failure, applies and reruns cleanly",async()=>{
 const sql06=read("supabase/migrations-proposed/nw-f01-s3/06_payment_capture_reconciliation.sql").replace(/\r\n/g,"\n");
 assert.equal((sql06.match(/^begin;$/gim)??[]).length,1);assert.equal((sql06.match(/^commit;$/gim)??[]).length,1);
 const cat=await catalog(db),data=await dataFingerprint(db);
 const forced=sql06.replace(/^commit;$/m,()=>"do $$ begin raise exception 'REHEARSAL FORCED FAILURE'; end $$;\ncommit;");
 const err=await apply(db,forced);assert.match(err.message,/REHEARSAL FORCED FAILURE/);
 assert.deepEqual(await catalog(db),cat);assert.deepEqual(await dataFingerprint(db),data);
 assert.equal(await apply(db,sql06),null);
 const after1=await catalog(db);
 assert.equal(await apply(db,sql06),null);assert.deepEqual(await catalog(db),after1);
 assert.deepEqual(await dataFingerprint(db),data);
 const fn=(await db.query("select prosrc,proconfig::text cfg,has_function_privilege('anon',oid,'execute') anon from pg_proc where oid='public.apply_webhook_event(text,text)'::regprocedure")).rows[0];
 assert.match(fn.prosrc,/Gateway amount\/currency does not match/);assert.match(fn.cfg,/pg_temp/);assert.equal(fn.anon,true);
});
test("NW01 (CC-18 GST integrity) refuses without 05, is atomic under forced failure, applies and reruns cleanly",async()=>{
 const sqlNw01=read("supabase/migrations-proposed/NW01_fix_purchase_pricing_plan_tax_handling.sql").replace(/\r\n/g,"\n");
 assert.equal((sqlNw01.match(/^begin;$/gim)??[]).length,1);assert.equal((sqlNw01.match(/^commit;$/gim)??[]).length,1);
 // Dependency guard: a fresh database without 05 must refuse and change nothing.
 const bare=await freshDatabase("nw01dep");const bareCat=await catalog(bare);
 const depErr=await apply(bare,sqlNw01);assert.match(depErr.message,/Apply 05_payment_attempt_integrity/);
 assert.deepEqual(await catalog(bare),bareCat);await bare.end();
 const cat=await catalog(db),data=await dataFingerprint(db);
 const forced=sqlNw01.replace(/^commit;$/m,()=>"do $$ begin raise exception 'REHEARSAL FORCED FAILURE'; end $$;\ncommit;");
 const err=await apply(db,forced);assert.match(err.message,/REHEARSAL FORCED FAILURE/);
 assert.deepEqual(await catalog(db),cat);assert.deepEqual(await dataFingerprint(db),data);
 assert.equal(await apply(db,sqlNw01),null);
 const after1=await catalog(db);
 assert.equal(await apply(db,sqlNw01),null);assert.deepEqual(await catalog(db),after1);
 assert.deepEqual(await dataFingerprint(db),data);
 const fn=(await db.query("select prosrc,proconfig::text cfg,has_function_privilege('authenticated',oid,'execute') auth from pg_proc where oid='public.purchase_pricing_plan(uuid,uuid,text)'::regprocedure")).rows[0];
 assert.match(fn.prosrc,/nw_billing_tax_config_problem/);assert.match(fn.cfg,/pg_temp/);assert.equal(fn.auth,true);
});
