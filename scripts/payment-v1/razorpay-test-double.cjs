#!/usr/bin/env node
/*
 * NW-PAYMENT-V1 — local Razorpay TEST DOUBLE. QA and recording only.
 *
 * Implements the slice of Razorpay's REST API that UPI checkout uses, with
 * the request validation Razorpay documents, and signs webhooks exactly the
 * way Razorpay does (X-Razorpay-Signature = hex HMAC-SHA256 of the raw body
 * with the webhook secret). It lets the end-to-end proof drive things a real
 * sandbox cannot do on demand: duplicate and out-of-order webhook delivery,
 * lost webhooks, a second payment to the same checkout, a late payment to a
 * replaced QR.
 *
 * It is never reachable from a deployment: the app only talks to it when
 * RAZORPAY_API_BASE_URL_FOR_TESTS is a localhost URL, NEXTWISE_PAYMENT_MODE
 * is `test`, the key is rzp_test_…, and VERCEL_ENV is not production
 * (src/lib/payments/upi/config.ts). A real Razorpay test-mode run with the
 * founder's test keys is still required before go-live (see
 * PAYMENT-READINESS-REPORT.md).
 *
 * Env: SIM_PORT (4010), SIM_KEY_ID, SIM_KEY_SECRET, SIM_WEBHOOK_SECRET,
 *      SIM_WEBHOOK_URL (http://127.0.0.1:3000/api/webhooks/razorpay)
 * Optional: the `qrcode` package on NODE_PATH renders a real QR image.
 */
"use strict";
const http = require("node:http");
const crypto = require("node:crypto");

let QR = null;
try {
  QR = require("qrcode");
} catch {
  QR = null;
}

const PORT = Number(process.env.SIM_PORT || 4010);
const KEY_ID = process.env.SIM_KEY_ID || "rzp_test_nwqadouble01";
const KEY_SECRET = process.env.SIM_KEY_SECRET || "qa-key-secret";
const WEBHOOK_SECRET = process.env.SIM_WEBHOOK_SECRET || "qa-webhook-secret";
const WEBHOOK_URL = process.env.SIM_WEBHOOK_URL || "http://127.0.0.1:3000/api/webhooks/razorpay";
const SELF = `http://127.0.0.1:${PORT}`;

const qrs = new Map();
const orders = new Map();
const payments = new Map();
const deliveries = []; // every webhook body sent: { id, event, body, status }

const rid = (prefix) => `${prefix}_${crypto.randomBytes(7).toString("base64").replace(/[^A-Za-z0-9]/g, "").slice(0, 14).padEnd(14, "X")}`;
const now = () => Math.floor(Date.now() / 1000);

function send(res, status, obj, headers = {}) {
  const body = typeof obj === "string" || Buffer.isBuffer(obj) ? obj : JSON.stringify(obj);
  res.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-allow-headers": "content-type", ...headers });
  res.end(body);
}
const bad = (res, description, field) => send(res, 400, { error: { code: "BAD_REQUEST_ERROR", description, field: field ?? null, source: "business", reason: "input_validation_failed" } });

function authed(req) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Basic ")) return false;
  const [id, secret] = Buffer.from(h.slice(6), "base64").toString().split(":");
  return id === KEY_ID && secret === KEY_SECRET;
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => resolve(raw));
  });
}

function paymentEntity(p) {
  return {
    id: p.id,
    entity: "payment",
    amount: p.amount,
    currency: p.currency,
    status: p.status,
    order_id: p.order_id ?? null,
    invoice_id: null,
    international: false,
    method: "upi",
    amount_refunded: 0,
    refund_status: null,
    captured: p.status === "captured",
    description: p.description ?? null,
    vpa: "success@razorpay",
    email: p.email ?? null,
    contact: null,
    notes: p.notes ?? {},
    fee: p.status === "captured" ? Math.round(p.amount * 0.02) : null,
    tax: null,
    error_code: p.status === "failed" ? "BAD_REQUEST_ERROR" : null,
    error_description: p.status === "failed" ? "Payment was declined by the UPI app (test double)." : null,
    acquirer_data: { rrn: String(100000000000 + Math.floor(Math.random() * 8e11)) },
    created_at: p.created_at,
  };
}

function qrEntity(q) {
  return {
    id: q.id,
    entity: "qr_code",
    created_at: q.created_at,
    name: q.name,
    usage: q.usage,
    type: q.type,
    image_url: q.image_url,
    payment_amount: q.payment_amount,
    status: q.status,
    description: q.description,
    fixed_amount: q.fixed_amount,
    payments_amount_received: q.payments_amount_received,
    payments_count_received: q.payments_count_received,
    notes: q.notes,
    customer_id: null,
    close_by: q.close_by,
    closed_at: q.closed_at ?? null,
    close_reason: q.close_reason ?? null,
  };
}

async function deliver(event, payload, opts = {}) {
  const body = JSON.stringify({ entity: "event", account_id: "acc_TESTDOUBLE0001", event, contains: Object.keys(payload), payload, created_at: now() });
  const record = { id: deliveries.length, event, body, status: null };
  deliveries.push(record);
  if (opts.withhold) return record;
  await post(record);
  return record;
}

async function post(record) {
  const signature = crypto.createHmac("sha256", WEBHOOK_SECRET).update(record.body).digest("hex");
  try {
    const r = await fetch(WEBHOOK_URL, { method: "POST", headers: { "content-type": "application/json", "x-razorpay-signature": signature, "x-razorpay-event-id": `evt_${record.id}` }, body: record.body });
    record.status = r.status;
    record.response = await r.text();
  } catch (e) {
    record.status = "network_error";
  }
  return record;
}

function payQr(q, { amount, withhold }) {
  const p = { id: rid("pay"), amount: amount ?? q.payment_amount, currency: "INR", status: "captured", order_id: null, notes: {}, created_at: now(), qr_id: q.id };
  payments.set(p.id, p);
  q.payments_amount_received += p.amount;
  q.payments_count_received += 1;
  if (q.usage === "single_use") {
    q.status = "closed";
    q.close_reason = "paid";
    q.closed_at = now();
  }
  return deliver("qr_code.credited", { payment: { entity: paymentEntity(p) }, qr_code: { entity: qrEntity(q) } }, { withhold }).then((d) => ({ payment: paymentEntity(p), delivery: d.id, webhookStatus: d.status }));
}

async function handleApi(req, res, url, raw) {
  if (!authed(req)) return send(res, 401, { error: { code: "BAD_REQUEST_ERROR", description: "The api key provided is invalid" } });
  let body = {};
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      return bad(res, "Invalid JSON");
    }
  }
  const path = url.pathname.replace(/^\/v1/, "");
  let m;

  if (req.method === "POST" && path === "/payments/qr_codes") {
    if (body.type !== "upi_qr") return bad(res, "type is invalid", "type");
    if (!["single_use", "multiple_use"].includes(body.usage)) return bad(res, "usage is invalid", "usage");
    if (body.fixed_amount === true && !(Number.isInteger(body.payment_amount) && body.payment_amount >= 100)) return bad(res, "payment_amount must be at least 100", "payment_amount");
    if (body.close_by !== undefined && (body.close_by < now() + 120 || body.close_by > now() + 7200 * 12)) return bad(res, "close_by should be at least 2 minutes after current time", "close_by");
    if (body.notes && Object.keys(body.notes).length > 15) return bad(res, "notes can have at most 15 keys", "notes");
    const id = rid("qr");
    const q = {
      id,
      created_at: now(),
      name: body.name ?? null,
      usage: body.usage,
      type: body.type,
      image_url: `${SELF}/qr/${id}.png`,
      payment_amount: body.payment_amount,
      status: "active",
      description: body.description ?? null,
      fixed_amount: !!body.fixed_amount,
      payments_amount_received: 0,
      payments_count_received: 0,
      notes: body.notes ?? {},
      close_by: body.close_by ?? now() + 7200,
    };
    qrs.set(id, q);
    return send(res, 200, qrEntity(q));
  }
  if ((m = path.match(/^\/payments\/qr_codes\/(qr_[A-Za-z0-9]+)\/close$/)) && req.method === "POST") {
    const q = qrs.get(m[1]);
    if (!q) return bad(res, "The id provided does not exist");
    if (q.status === "closed") return bad(res, "Qr code is already closed");
    q.status = "closed";
    q.close_reason = "on_demand";
    q.closed_at = now();
    deliver("qr_code.closed", { qr_code: { entity: qrEntity(q) } });
    return send(res, 200, qrEntity(q));
  }
  if ((m = path.match(/^\/payments\/qr_codes\/(qr_[A-Za-z0-9]+)\/payments$/)) && req.method === "GET") {
    if (!qrs.has(m[1])) return bad(res, "The id provided does not exist");
    const items = [...payments.values()].filter((p) => p.qr_id === m[1]).map(paymentEntity);
    return send(res, 200, { entity: "collection", count: items.length, items });
  }
  if ((m = path.match(/^\/payments\/qr_codes\/(qr_[A-Za-z0-9]+)$/)) && req.method === "GET") {
    const q = qrs.get(m[1]);
    return q ? send(res, 200, qrEntity(q)) : bad(res, "The id provided does not exist");
  }
  if (req.method === "POST" && path === "/orders") {
    if (!(Number.isInteger(body.amount) && body.amount >= 100)) return bad(res, "The amount must be atleast INR 1.00", "amount");
    if (body.currency !== "INR") return bad(res, "Currency is not supported", "currency");
    const o = { id: rid("order"), entity: "order", amount: body.amount, amount_paid: 0, amount_due: body.amount, currency: body.currency, receipt: body.receipt ?? null, status: "created", attempts: 0, notes: body.notes ?? {}, created_at: now(), payment_capture: body.payment_capture !== false };
    orders.set(o.id, o);
    return send(res, 200, o);
  }
  if ((m = path.match(/^\/orders\/(order_[A-Za-z0-9]+)\/payments$/)) && req.method === "GET") {
    if (!orders.has(m[1])) return bad(res, "The id provided does not exist");
    const items = [...payments.values()].filter((p) => p.order_id === m[1]).map(paymentEntity);
    return send(res, 200, { entity: "collection", count: items.length, items });
  }
  if ((m = path.match(/^\/payments\/(pay_[A-Za-z0-9]+)\/capture$/)) && req.method === "POST") {
    const p = payments.get(m[1]);
    if (!p) return bad(res, "The id provided does not exist");
    if (p.status === "captured") return bad(res, "This payment has already been captured");
    if (p.status !== "authorized") return bad(res, "Only payments which have been authorized and not yet captured can be captured");
    if (Number(body.amount) !== p.amount) return bad(res, "Capture amount must be equal to the amount authorized", "amount");
    p.status = "captured";
    const o = orders.get(p.order_id);
    if (o) {
      o.status = "paid";
      o.amount_paid = p.amount;
      o.amount_due = 0;
    }
    deliver("payment.captured", { payment: { entity: paymentEntity(p) } });
    return send(res, 200, paymentEntity(p));
  }
  if ((m = path.match(/^\/payments\/(pay_[A-Za-z0-9]+)$/)) && req.method === "GET") {
    const p = payments.get(m[1]);
    return p ? send(res, 200, paymentEntity(p)) : bad(res, "The id provided does not exist");
  }
  return send(res, 404, { error: { code: "BAD_REQUEST_ERROR", description: "The requested URL was not found on the server." } });
}

async function handleControl(req, res, url, raw) {
  const body = raw ? JSON.parse(raw) : {};
  const path = url.pathname;
  if (path === "/__sim/state") return send(res, 200, { qrs: [...qrs.values()].map(qrEntity), orders: [...orders.values()], payments: [...payments.values()].map(paymentEntity), deliveries: deliveries.map(({ body: _b, ...d }) => d) });
  if (path === "/__sim/latest-qr") {
    const q = [...qrs.values()].filter((x) => x.status === "active").sort((a, b) => b.created_at - a.created_at)[0];
    return q ? send(res, 200, qrEntity(q)) : send(res, 404, { error: "no active qr" });
  }
  if (path === "/__sim/pay-qr") {
    const q = qrs.get(body.qr_id) ?? [...qrs.values()].filter((x) => x.status === "active").sort((a, b) => b.created_at - a.created_at)[0];
    if (!q) return send(res, 404, { error: "no such qr" });
    if (q.status !== "active" && !body.force) return send(res, 409, { error: "qr is closed — a real UPI app would refuse to pay it" });
    return send(res, 200, await payQr(q, { amount: body.amount, withhold: !!body.withhold_webhook }));
  }
  if (path === "/__sim/pay-order") {
    const o = orders.get(body.order_id);
    if (!o) return send(res, 404, { error: "no such order" });
    const outcome = body.outcome || "captured";
    const p = { id: rid("pay"), amount: o.amount, currency: o.currency, status: outcome === "failed" ? "failed" : outcome === "authorized" || !o.payment_capture ? "authorized" : "captured", order_id: o.id, notes: body.notes ?? {}, created_at: now() };
    payments.set(p.id, p);
    o.attempts += 1;
    if (p.status === "captured") {
      o.status = "paid";
      o.amount_paid = p.amount;
      o.amount_due = 0;
    }
    const events = p.status === "failed" ? ["payment.failed"] : p.status === "authorized" ? ["payment.authorized"] : ["payment.authorized", "payment.captured"];
    const delivered = [];
    for (const ev of events) {
      const pe = paymentEntity({ ...p, status: ev === "payment.authorized" ? "authorized" : p.status });
      delivered.push((await deliver(ev, { payment: { entity: pe } }, { withhold: !!body.withhold_webhook })).id);
    }
    const signature = crypto.createHmac("sha256", KEY_SECRET).update(`${o.id}|${p.id}`).digest("hex");
    return send(res, 200, { razorpay_payment_id: p.id, razorpay_order_id: o.id, razorpay_signature: signature, status: p.status, deliveries: delivered });
  }
  if (path === "/__sim/redeliver") {
    const d = deliveries[body.delivery];
    if (!d) return send(res, 404, { error: "no such delivery" });
    const times = Math.max(1, Math.min(10, body.times || 1));
    const statuses = [];
    for (let i = 0; i < times; i += 1) statuses.push((await post(d)).status);
    return send(res, 200, { statuses });
  }
  if (path === "/__sim/redeliver-parallel") {
    const d = deliveries[body.delivery];
    if (!d) return send(res, 404, { error: "no such delivery" });
    const results = await Promise.all(Array.from({ length: Math.min(10, body.times || 5) }, () => post({ ...d })));
    return send(res, 200, { statuses: results.map((r) => r.status) });
  }
  return send(res, 404, { error: "unknown control" });
}

const CHECKOUT_JS = `/* Razorpay Standard Checkout — LOCAL TEST DOUBLE (not Razorpay's script). */
(function(){
  function Razorpay(o){ this.o=o; }
  Razorpay.prototype.on=function(){ return this; };
  Razorpay.prototype.open=function(){
    var o=this.o, d=document, wrap=d.createElement('div');
    wrap.id='rzp-test-double';
    wrap.setAttribute('role','dialog'); wrap.setAttribute('aria-label','Razorpay test checkout');
    wrap.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(10,14,40,.55);display:flex;align-items:flex-end;justify-content:center;font-family:system-ui,sans-serif';
    var rupees=(o.amount/100).toLocaleString('en-IN');
    wrap.innerHTML='<div style="background:#fff;width:100%;max-width:420px;border-radius:18px 18px 0 0;padding:20px 20px 28px;box-shadow:0 -10px 40px rgba(0,0,0,.25)">'+
      '<div style="font-size:11px;color:#b45309;background:#fef3c7;border-radius:6px;padding:4px 8px;display:inline-block">TEST DOUBLE · no real money</div>'+
      '<div style="margin-top:12px;font-weight:600;font-size:16px">'+(o.name||'')+'</div>'+
      '<div style="color:#555;font-size:13px">'+(o.description||'')+'</div>'+
      '<div style="font-size:26px;font-weight:700;margin:14px 0">&#8377;'+rupees+'</div>'+
      '<div style="font-size:13px;color:#333;margin-bottom:10px">Pay using any UPI app</div>'+
      '<button id="rzp-td-pay" style="width:100%;padding:14px;border:0;border-radius:10px;background:#2b59ff;color:#fff;font-size:15px;font-weight:600">Open UPI app &amp; approve</button>'+
      '<button id="rzp-td-fail" style="width:100%;margin-top:8px;padding:12px;border:1px solid #ddd;border-radius:10px;background:#fff;color:#a11;font-size:14px">Decline in UPI app</button>'+
      '<button id="rzp-td-close" style="width:100%;margin-top:8px;padding:10px;border:0;background:none;color:#555;font-size:13px">Cancel</button></div>';
    d.body.appendChild(wrap);
    function done(){ wrap.remove(); }
    function pay(outcome){
      fetch('${SELF}/__sim/pay-order',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({order_id:o.order_id,outcome:outcome,notes:o.notes||{}})})
        .then(function(r){return r.json();}).then(function(r){ done();
          if(r.status==='failed'){ if(o.modal&&o.modal.ondismiss) o.modal.ondismiss({reason:'payment_failed'}); return; }
          o.handler && o.handler({razorpay_payment_id:r.razorpay_payment_id,razorpay_order_id:r.razorpay_order_id,razorpay_signature:r.razorpay_signature}); });
    }
    d.getElementById('rzp-td-pay').onclick=function(){ this.textContent='Waiting for UPI app…'; setTimeout(function(){pay('captured');},1200); };
    d.getElementById('rzp-td-fail').onclick=function(){ pay('failed'); };
    d.getElementById('rzp-td-close').onclick=function(){ done(); if(o.modal&&o.modal.ondismiss) o.modal.ondismiss(); };
  };
  window.Razorpay=Razorpay;
})();`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, SELF);
  if (req.method === "OPTIONS") return send(res, 204, "", { "access-control-allow-methods": "GET,POST" });
  const raw = await readBody(req);
  try {
    if (url.pathname === "/checkout.js") {
      res.writeHead(200, { "content-type": "application/javascript", "access-control-allow-origin": "*" });
      return res.end(CHECKOUT_JS);
    }
    const qrImg = url.pathname.match(/^\/qr\/(qr_[A-Za-z0-9]+)\.png$/);
    if (qrImg) {
      const q = qrs.get(qrImg[1]);
      if (!q) return send(res, 404, { error: "no such qr" });
      const upi = `upi://pay?pa=nextwise.test@razorpay&pn=Nextwise%20(TEST)&am=${(q.payment_amount / 100).toFixed(2)}&cu=INR&tr=${q.id}&tn=TEST%20DOUBLE`;
      if (QR) {
        const png = await QR.toBuffer(upi, { type: "png", width: 520, margin: 1, errorCorrectionLevel: "M", color: { dark: "#0b1033", light: "#ffffff" } });
        res.writeHead(200, { "content-type": "image/png", "cache-control": "no-store" });
        return res.end(png);
      }
      res.writeHead(200, { "content-type": "image/svg+xml" });
      return res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="260" height="260"><rect width="260" height="260" fill="#fff"/><text x="20" y="130" font-size="14">TEST QR ${q.id}</text></svg>`);
    }
    if (url.pathname.startsWith("/__sim/")) return await handleControl(req, res, url, raw);
    if (url.pathname.startsWith("/v1/")) return await handleApi(req, res, url, raw);
    return send(res, 404, { error: "not found" });
  } catch (e) {
    return send(res, 500, { error: String(e && e.message) });
  }
});

server.listen(PORT, "127.0.0.1", () => console.log(`[razorpay-test-double] listening on ${SELF} (key ${KEY_ID}); webhooks → ${WEBHOOK_URL}`));
