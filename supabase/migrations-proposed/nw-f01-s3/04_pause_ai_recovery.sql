-- PROPOSED - DO NOT APPLY. Requires separate written approval and completed security gates (see docs/stabilization/nw-f01-s3/CC-15-REVIEW.md).
-- REVIEW ONLY recovery proposal. Never run without separate QA approval.
-- Retains all tables, consent evidence, run history, v1 deny stubs and completion.
begin;
revoke all on function public.staff_reserve_ai_generation_run_v2(uuid,text,text,text,text,text,text,uuid,numeric,integer,integer,integer,numeric,integer,numeric,uuid,text)
 from public,anon,authenticated,service_role;
do $$ begin
 if has_function_privilege('authenticated','public.staff_reserve_ai_generation_run_v2(uuid,text,text,text,text,text,text,uuid,numeric,integer,integer,integer,numeric,integer,numeric,uuid,text)','execute')
 or has_function_privilege('anon','public.staff_reserve_ai_generation_run_v2(uuid,text,text,text,text,text,text,uuid,numeric,integer,integer,integer,numeric,integer,numeric,uuid,text)','execute')
 then raise exception 'Inherited reservation execution remains'; end if;
end $$;
commit;
