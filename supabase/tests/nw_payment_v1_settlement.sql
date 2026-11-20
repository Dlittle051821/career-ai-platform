-- NW-PAYMENT-V1 settlement proof (QA replica). Runs in one transaction and
-- ROLLS BACK, so it leaves no data behind. Requires 0001_upi_checkout.sql.
-- Usage: psql ... -v ON_ERROR_STOP=1 -v student=<auth.users id> -f nw_payment_v1_settlement.sql
\set QUIET on
begin;
update public.payment_gateway_config set razorpay_key_secret = 'qa-key-secret', razorpay_webhook_secret = 'qa-webhook-secret' where id = 1;
update public.payment_upi_settings set upi_checkout_enabled = true, gateway_mode = 'test' where id = 1;
create temp table t (k text primary key, v text);
grant all on t to authenticated;
insert into t values ('student', :'student');

-- helpers (superuser side): sign like Razorpay / like our server
create function pg_temp.wh(body text) returns jsonb language sql as $$ select public.apply_webhook_event(body, encode(extensions.hmac(body, 'qa-webhook-secret', 'sha256'), 'hex')) $$;
create function pg_temp.rec(body text) returns jsonb language sql as $$ select public.apply_upi_gateway_record(body, encode(extensions.hmac(body, 'qa-key-secret', 'sha256'), 'hex')) $$;
create function pg_temp.credited(qr text, pay text, amount bigint, cur text default 'INR') returns text language sql as $$
  select jsonb_build_object('entity','event','event','qr_code.credited','created_at', extract(epoch from now())::bigint,
    'payload', jsonb_build_object(
      'payment', jsonb_build_object('entity', jsonb_build_object('id', pay, 'entity','payment','amount', amount,'currency', cur,'status','captured','order_id', null,'method','upi','captured', true,'vpa','student@okbank')),
      'qr_code', jsonb_build_object('entity', jsonb_build_object('id', qr, 'status','closed','close_reason','paid','payment_amount', amount, 'usage','single_use','fixed_amount', true))))::text $$;

-- 1. student: quote → draft invoice
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'student', 'role', 'authenticated')::text, true);
insert into t select 'quote', (public.create_pricing_quote('study-abroad-lite', 2) ->> 'id');
select (public.start_quote_checkout((select v from t where k='quote')::uuid)) as r \gset
insert into t values ('invoice', (:'r'::jsonb) ->> 'invoice_id');
do $$ declare r jsonb; begin
  r := public.start_quote_checkout((select v from t where k='quote')::uuid);
  assert (r ->> 'reused')::boolean, 'second start_quote_checkout must reuse the invoice';
  assert (r ->> 'total_minor_units')::bigint = 4499900 + 2 * (select unit_amount_minor_units from pricing_plan_addons a join pricing_quotes q on q.addon_id = a.id where q.id = (select v from t where k='quote')::uuid), 'total = base + 2 × add-on';
end $$;
-- a student cannot read the draft invoice through RLS, and cannot call settlement
do $$ begin
  assert (select invoice_number from public.invoices where id = (select v from t where k='invoice')::uuid) is null, 'draft invoice carries no number before payment';
  begin
    insert into public.payment_attempts (invoice_id, provider, idempotency_key, status, amount_minor_units, currency, channel)
    values ((select v from t where k='invoice')::uuid, 'razorpay', 'forged-1', 'created', 100, 'INR', 'upi_checkout');
    assert false, 'student must not create a checkout attempt directly';
  exception when others then assert sqlerrm like 'Payment attempts for online checkout%', sqlerrm; end;
  begin perform public.nw_upi_settle_payment(gen_random_uuid(), '{}'::jsonb, 'x'); assert false, 'settlement must not be callable';
  exception when insufficient_privilege then null; end;
  begin perform public.apply_upi_gateway_record('{"type":"payments_observed"}', 'forged'); assert false, 'forged record must fail';
  exception when others then assert sqlerrm like 'Invalid gateway record signature%', sqlerrm; end;
end $$;
-- attempt: created once, reused on refresh
insert into t select 'attempt', public.prepare_upi_attempt((select v from t where k='invoice')::uuid, 'upi_qr') ->> 'attempt_id';
reset role;

-- 2. server attaches the gateway QR (attested)
select pg_temp.rec(jsonb_build_object('type','qr_created','ts', extract(epoch from now())::bigint, 'attempt_id', (select v from t where k='attempt'),
  'qr_id','qr_TEST000000001','image_url','https://rzp.io/i/qrtest','close_by', extract(epoch from now() + interval '15 minutes')::bigint,
  'amount', (select amount_minor_units from payment_attempts where id = (select v from t where k='attempt')::uuid), 'currency','INR','fixed_amount', true,'usage','single_use')::text) is not null as attached \gset
set local role authenticated;
do $$ declare r jsonb; begin
  r := public.prepare_upi_attempt((select v from t where k='invoice')::uuid, 'upi_qr');
  assert (r ->> 'reused')::boolean and (r ->> 'attempt_id') = (select v from t where k='attempt'), 'refresh must reuse the live QR attempt: ' || r::text;
end $$;
reset role;

-- 3. a payment of the WRONG amount is rejected and writes nothing
do $$ declare r jsonb; amt bigint := (select amount_minor_units from payment_attempts where id = (select v from t where k='attempt')::uuid); begin
  r := pg_temp.wh(pg_temp.credited('qr_TEST000000001', 'pay_WRONGAMT0001', amt - 100));
  assert r ->> 'processing_status' = 'failed', 'mismatch must be recorded as failed: ' || r::text;
  assert not exists (select 1 from payment_transactions where provider_payment_id = 'pay_WRONGAMT0001'), 'mismatch must write no transaction';
  assert (select status from invoices where id = (select v from t where k='invoice')::uuid) = 'draft', 'mismatch must not settle';
  r := pg_temp.wh(pg_temp.credited('qr_TEST000000001', 'pay_WRONGCUR0001', amt, 'USD'));
  assert r ->> 'processing_status' = 'failed', 'currency mismatch must fail';
end $$;

-- 4. the real payment: signed qr_code.credited settles exactly once
do $$ declare r jsonb; body text; amt bigint := (select amount_minor_units from payment_attempts where id = (select v from t where k='attempt')::uuid); inv invoices; begin
  body := pg_temp.credited('qr_TEST000000001', 'pay_GOOD00000001', amt);
  r := pg_temp.wh(body);
  assert r ->> 'processing_status' = 'processed', r::text;
  select * into inv from invoices where id = (select v from t where k='invoice')::uuid;
  assert inv.status = 'paid' and inv.invoice_number like 'INV-____-_____' and inv.paid_at is not null and inv.settled_transaction_id is not null, 'invoice must be paid + numbered: ' || row_to_json(inv)::text;
  insert into t values ('number', inv.invoice_number);
  -- Razorpay retries the identical delivery
  r := pg_temp.wh(body);
  assert (r ->> 'duplicate')::boolean, 'identical redelivery must be a duplicate';
  -- an equivalent but not byte-identical delivery (re-serialised) is also harmless
  r := pg_temp.wh(body || ' ');
  assert r ->> 'processing_status' = 'processed', r::text;
  -- a late out-of-order payment.failed for the same payment can never downgrade it
  r := pg_temp.wh(jsonb_build_object('event','payment.failed','payload', jsonb_build_object('payment', jsonb_build_object('entity', jsonb_build_object('id','pay_GOOD00000001','amount', amt,'currency','INR','status','failed','order_id', null))))::text);
  -- server reconciliation sees the same payment again
  perform pg_temp.rec(jsonb_build_object('type','payments_observed','ts', extract(epoch from now())::bigint,'attempt_id',(select v from t where k='attempt'),
    'payments', jsonb_build_array(jsonb_build_object('id','pay_GOOD00000001','amount', amt,'currency','INR','status','captured','captured', true,'method','upi')))::text);
  select * into inv from invoices where id = (select v from t where k='invoice')::uuid;
  assert inv.status = 'paid' and inv.invoice_number = (select v from t where k='number'), 'replays must not change the invoice';
  assert (select count(*) from payment_transactions pt join payment_attempts pa on pa.id = pt.payment_attempt_id where pa.invoice_id = inv.id) = 1, 'exactly one transaction';
  assert (select status from payment_transactions where provider_payment_id = 'pay_GOOD00000001') = 'captured', 'captured never downgraded';
  assert (select last_value from invoice_number_sequences where prefix = 'INV-' || to_char(now(),'YYYY')) = substring(inv.invoice_number from 10)::bigint, 'exactly one number consumed';
end $$;

-- 5. a second real payment for the same checkout (scan twice / two phones) is held for refund, not settled
do $$ declare r jsonb; amt bigint := (select amount_minor_units from payment_attempts where id = (select v from t where k='attempt')::uuid); begin
  r := pg_temp.rec(jsonb_build_object('type','payments_observed','ts', extract(epoch from now())::bigint,'attempt_id',(select v from t where k='attempt'),
    'payments', jsonb_build_array(jsonb_build_object('id','pay_SECOND000001','amount', amt,'currency','INR','status','captured','captured', true,'method','upi')))::text);
  assert r #>> '{outcomes,0,review_reason}' = 'duplicate_payment', r::text;
  assert (select invoice_number from invoices where id = (select v from t where k='invoice')::uuid) = (select v from t where k='number'), 'no second number';
  assert (select count(*) from invoices where pricing_quote_id = (select v from t where k='quote')::uuid) = 1, 'one invoice per quote';
end $$;

-- 6. the student now sees: one paid invoice, one settling transaction, one entitlement purchase
set local role authenticated;
do $$ begin
  assert (select count(*) from public.invoices where pricing_quote_id = (select v from t where k='quote')::uuid and status = 'paid') = 1, 'student sees one paid invoice';
  assert (select count(*) from public.pricing_purchases where pricing_quote_id = (select v from t where k='quote')::uuid) = 1, 'one purchase';
  assert (select total_universities_at_purchase from public.pricing_purchases where pricing_quote_id = (select v from t where k='quote')::uuid)
       = (select included_universities + 2 from pricing_quotes where id = (select v from t where k='quote')::uuid), 'coverage frozen on purchase';
  assert (select (public.get_quote_checkout_state((select v from t where k='quote')::uuid) #>> '{invoice,status}')) = 'paid', 'state RPC';
  assert (select status from public.pricing_quotes where id = (select v from t where k='quote')::uuid) = 'converted', 'quote converted';
end $$;
reset role;

-- 7. refunding the duplicate does not touch the paid invoice (recompute excludes review money)
do $$ declare tx uuid := (select id from payment_transactions where provider_payment_id = 'pay_SECOND000001'); begin
  insert into refunds (payment_transaction_id, invoice_id, amount_minor_units, status, reason, initiated_by, finalized_at)
  values (tx, (select v from t where k='invoice')::uuid, (select amount_minor_units from payment_transactions where id = tx), 'processed', 'Duplicate payment', (select v::uuid from t where k='student'), now());
  perform recompute_invoice_status((select v from t where k='invoice')::uuid);
  assert (select status from invoices where id = (select v from t where k='invoice')::uuid) = 'paid', 'duplicate refund must not unpay the invoice';
end $$;

-- 8. a new checkout voids an unpaid older one; a late payment to the old QR is held, never settled
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'student', 'role', 'authenticated')::text, true);
insert into t select 'quote2', (public.create_pricing_quote('nextwise-verified', 0) ->> 'id');
insert into t select 'invoice2', public.start_quote_checkout((select v from t where k='quote2')::uuid) ->> 'invoice_id';
insert into t select 'attempt2', public.prepare_upi_attempt((select v from t where k='invoice2')::uuid, 'upi_qr') ->> 'attempt_id';
reset role;
select pg_temp.rec(jsonb_build_object('type','qr_created','ts', extract(epoch from now())::bigint, 'attempt_id', (select v from t where k='attempt2'),
  'qr_id','qr_TEST000000002','image_url','https://rzp.io/i/qr2','close_by', extract(epoch from now() + interval '15 minutes')::bigint,
  'amount', 199900, 'currency','INR','fixed_amount', true,'usage','single_use')::text) is not null as attached2 \gset
set local role authenticated;
insert into t select 'quote3', (public.create_pricing_quote('nextwise-verified', 0) ->> 'id');
insert into t select 'invoice3', public.start_quote_checkout((select v from t where k='quote3')::uuid) ->> 'invoice_id';
reset role;
do $$ declare r jsonb; begin
  assert (select voided_at is not null and status = 'draft' from invoices where id = (select v from t where k='invoice2')::uuid), 'older unpaid checkout superseded';
  assert (select status from payment_attempts where id = (select v from t where k='attempt2')::uuid) = 'cancelled', 'its attempt cancelled';
  assert (select amount_minor_units from payment_attempts where id = (select v from t where k='attempt2')::uuid) = 199900, 'Verified is exactly ₹1,999';
  r := pg_temp.wh(pg_temp.credited('qr_TEST000000002', 'pay_LATE00000001', 199900));
  assert (select review_reason from payment_transactions where provider_payment_id = 'pay_LATE00000001') = 'payment_on_inactive_invoice', 'late payment held: ' || r::text;
  assert (select invoice_number from invoices where id = (select v from t where k='invoice2')::uuid) is null, 'superseded invoice never numbered';
  assert (select status from invoices where id = (select v from t where k='invoice3')::uuid) = 'draft', 'new checkout untouched';
end $$;

-- 9. unknown QR id → held, nothing written; signature forgery → rejected
do $$ declare r jsonb; begin
  r := pg_temp.wh(pg_temp.credited('qr_UNKNOWN0000001', 'pay_UNKNOWN00001', 199900));
  assert r ->> 'processing_status' = 'failed' and not exists (select 1 from payment_transactions where provider_payment_id = 'pay_UNKNOWN00001'), r::text;
  begin perform public.apply_webhook_event(pg_temp.credited('qr_TEST000000002', 'pay_FORGED000001', 199900), 'deadbeef'); assert false;
  exception when others then assert sqlerrm = 'Invalid webhook signature.', sqlerrm; end;
end $$;

-- 10. live mode refuses to bill while tax/issuer are unconfigured
update public.payment_upi_settings set gateway_mode = 'live' where id = 1;
set local role authenticated;
do $$ begin
  begin perform public.start_quote_checkout((public.create_pricing_quote('nextwise-verified', 0) ->> 'id')::uuid); assert false, 'live must refuse';
  exception when others then assert sqlerrm like 'Online payment is not ready yet%', sqlerrm; end;
end $$;
reset role;

\echo 'NW-PAYMENT-V1 settlement proof: ALL ASSERTIONS PASSED'
rollback;
