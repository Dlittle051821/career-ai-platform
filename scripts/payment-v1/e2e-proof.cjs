#!/usr/bin/env node
/*
 * NW-PAYMENT-V1 — end-to-end exactly-once proof (QA replica + Razorpay test double).
 * Drives the real app in a real browser and checks the database after every scenario:
 * one verified payment => exactly one paid invoice, one receipt, one active purchase,
 * even when the browser is closed, Razorpay redelivers a webhook, deliveries race,
 * the webhook is lost, a second payment arrives, or a payment reaches a replaced QR.
 * Env: APP (http://localhost:3000), SIM (http://127.0.0.1:4010), PGURL, QA_EMAIL, QA_PASSWORD, CRON_SECRET
 */
"use strict";
const { chromium } = require("playwright");
const { execFileSync } = require("node:child_process");

const APP = process.env.APP || "http://localhost:3000";
const SIM = process.env.SIM || "http://127.0.0.1:4010";
const PG = ["-h", "127.0.0.1", "-p", "54322", "-U", "postgres", "-d", "postgres", "-Atq", "-F", "|"];
const EMAIL = process.env.QA_EMAIL;
const PASSWORD = process.env.QA_PASSWORD;
const results = [];

const sql = (q) => execFileSync("psql", [...PG, "-c", q], { env: { ...process.env, PGPASSWORD: "postgres" } }).toString().trim();
const sim = async (path, body) => (await fetch(SIM + path, body === undefined ? {} : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

/** The full ledger for one quote, read straight from the database. */
function ledger(quoteId) {
  const [inv] = sql(`select count(*) filter (where true), count(*) filter (where status='paid'), max(invoice_number), max(status), max(settled_transaction_id::text) from invoices where pricing_quote_id='${quoteId}'`).split("\n");
  const [n, paid, number, status, settled] = inv.split("|");
  const txns = sql(`select pt.provider_payment_id, pt.status, coalesce(pt.review_reason,''), pt.amount_minor_units from payment_transactions pt join payment_attempts pa on pa.id=pt.payment_attempt_id join invoices i on i.id=pa.invoice_id where i.pricing_quote_id='${quoteId}' order by pt.created_at`).split("\n").filter(Boolean).map((l) => l.split("|"));
  const receipts = txns.filter((t) => ["captured", "refunded", "partially_refunded"].includes(t[1]) && !t[2]);
  const purchases = sql(`select count(*) from pricing_purchases where pricing_quote_id='${quoteId}'`);
  const entitled = sql(`select count(*) from pricing_purchases pp join invoices i on i.id=pp.invoice_id where pp.pricing_quote_id='${quoteId}' and i.status='paid'`);
  return { invoices: +n, paidInvoices: +paid, number, status, settled, txns, receipts: receipts.length, purchases: +purchases, entitled: +entitled };
}
function exactlyOnce(label, quoteId, extra = {}) {
  const l = ledger(quoteId);
  const ok = l.invoices === 1 && l.paidInvoices === 1 && l.receipts === 1 && l.purchases === 1 && l.entitled === 1 && /^INV-\d{4}-\d{5}$/.test(l.number || "");
  check(`${label}: exactly one paid invoice, one receipt, one active entitlement`, ok, `invoice ${l.number} ${l.status}; transactions ${l.txns.map((t) => `${t[0]}:${t[1]}${t[2] ? `(${t[2]})` : ""}`).join(", ")}${extra.note ? `; ${extra.note}` : ""}`);
  return l;
}

async function signIn(ctx) {
  const p = await ctx.newPage();
  await p.goto(`${APP}/login`);
  await p.fill("input[type=email]", EMAIL);
  await p.fill("input[type=password]", PASSWORD);
  await p.click("button[type=submit]");
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
  await p.close();
}

async function openCheckout(ctx, plan, extra) {
  const p = await ctx.newPage();
  await p.goto(`${APP}/checkout/start?plan=${plan}${extra ? `&extra=${extra}` : ""}`);
  await p.waitForURL(/\/checkout\/[0-9a-f-]{36}$/, { timeout: 30000 });
  const quoteId = p.url().split("/").pop();
  await p.waitForSelector("#nwp-qr-img", { timeout: 30000 });
  const qrId = sql(`select pa.provider_qr_id from payment_attempts pa join invoices i on i.id=pa.invoice_id where i.pricing_quote_id='${quoteId}' and pa.status in ('created','pending') order by pa.created_at desc limit 1`);
  return { p, quoteId, qrId };
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await signIn(ctx);
  const seqBefore = +sql(`select coalesce(max(last_value),0) from invoice_number_sequences where prefix='INV-'||to_char(now(),'YYYY')`);

  // 1. Student pays, browser is CLOSED before confirmation; only the webhook arrives.
  {
    const { p, quoteId, qrId } = await openCheckout(ctx, "study-abroad-lite", 2);
    const amount = +sql(`select amount_minor_units from payment_attempts where provider_qr_id='${qrId}'`);
    check("1. QR is single-use, fixed-amount, for the server-priced total", amount === 4499900 + 2 * 799900, `qr ${qrId} amount ${amount}`);
    await p.close(); // browser tab closed before paying completes
    const pay = await sim("/__sim/pay-qr", { qr_id: qrId });
    check("1. Signed qr_code.credited webhook accepted", pay.webhookStatus === 200, `payment ${pay.payment.id}`);
    exactlyOnce("1. Browser closed, webhook only", quoteId);

    // 2. Razorpay retries the same webhook 5× in sequence, then 6× concurrently
    const r1 = await sim("/__sim/redeliver", { delivery: pay.delivery, times: 5 });
    const r2 = await sim("/__sim/redeliver-parallel", { delivery: pay.delivery, times: 6 });
    check("2. Every redelivery answered 200 (Razorpay stops retrying)", [...r1.statuses, ...r2.statuses].every((s) => s === 200), `${r1.statuses.length + r2.statuses.length} redeliveries`);
    exactlyOnce("2. After 11 webhook redeliveries (6 concurrent)", quoteId);

    // 3. Student reopens the checkout later: server-rendered confirmation from the paid invoice
    const p2 = await ctx.newPage();
    await p2.goto(`${APP}/checkout/${quoteId}`);
    const okTitle = await p2.locator("#nwp-ok-title").count();
    const facts = okTitle ? await p2.locator(".nwp-facts").innerText() : "";
    check("3. Returning student sees confirmation with invoice number", okTitle === 1 && facts.includes(ledger(quoteId).number), facts.split("\n").slice(8, 10).join(" "));
    const pdf = await p2.request.get(`${APP}/payments/${sql(`select id from invoices where pricing_quote_id='${quoteId}'`)}/pdf`);
    const tx = sql(`select settled_transaction_id from invoices where pricing_quote_id='${quoteId}'`);
    const rc = await p2.request.get(`${APP}/payments/${sql(`select id from invoices where pricing_quote_id='${quoteId}'`)}/receipts/${tx}`);
    const pdfBody = await pdf.body();
    const rcBody = await rc.body();
    check("3. Invoice PDF and receipt PDF download for the owner", pdf.status() === 200 && pdfBody.slice(0, 4).toString() === "%PDF" && rc.status() === 200 && rcBody.slice(0, 4).toString() === "%PDF", `invoice ${pdfBody.length} B, receipt ${rcBody.length} B`);
    require("node:fs").writeFileSync("/tmp/claude-0/pay1-qa/proof-invoice.pdf", pdfBody);
    require("node:fs").writeFileSync("/tmp/claude-0/pay1-qa/proof-receipt.pdf", rcBody);
    // another student cannot read them (anonymous context)
    const anon = await browser.newContext();
    const ap = await anon.newPage();
    const ar = await ap.request.get(`${APP}/payments/${sql(`select id from invoices where pricing_quote_id='${quoteId}'`)}/pdf`, { maxRedirects: 0 });
    check("3. Invoice PDF is not available without the owner's session", ar.status() !== 200 || !(await ar.body()).slice(0, 4).toString().startsWith("%PDF"), `anonymous status ${ar.status()}`);
    await anon.close();
    await p2.goto(`${APP}/studio/plan`);
    const planText = await p2.locator(".nws-page").innerText();
    check("3. Student Studio shows the plan Active with services unlocked", planText.includes("Active") && planText.includes("Unlocked") && planText.includes("7 universities"), "My Plan & Services");
    await p2.screenshot({ path: "/tmp/claude-0/pay1-qa/proof-studio-plan.png", fullPage: true });

    // 4. A SECOND real payment to the same checkout (forced: the QR is already closed after payment)
    const second = await sim("/__sim/pay-qr", { qr_id: qrId, force: true });
    const l = ledger(quoteId);
    const held = l.txns.find((t) => t[0] === second.payment.id);
    check("4. A second payment is held for refund, never a second invoice or receipt", held && held[2] === "duplicate_payment" && l.invoices === 1 && l.receipts === 1, `second payment ${second.payment.id} → ${held ? held[2] : "missing"}`);
    await p2.close();
  }

  // 5. Webhook LOST and browser closed: scheduled reconciliation settles it from Razorpay's API
  {
    const { p, quoteId, qrId } = await openCheckout(ctx, "study-abroad-premium", 0);
    await p.close();
    await sim("/__sim/pay-qr", { qr_id: qrId, withhold_webhook: true });
    check("5. Before reconciliation nothing is granted", ledger(quoteId).paidInvoices === 0, "webhook withheld");
    const res = await fetch(`${APP}/api/payments/upi/reconcile`, { method: "POST", headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    const body = await res.json();
    check("5. Reconciliation endpoint ran", res.status === 200, JSON.stringify(body));
    exactlyOnce("5. Lost webhook + closed browser, settled by reconciliation", quoteId);
    const again = await fetch(`${APP}/api/payments/upi/reconcile`, { method: "POST", headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    await again.json();
    exactlyOnce("5. Reconciliation run twice", quoteId);
    const unauth = await fetch(`${APP}/api/payments/upi/reconcile`, { method: "POST", headers: { authorization: "Bearer wrong" } });
    check("5. Reconciliation refuses a wrong secret", unauth.status === 401, `status ${unauth.status}`);
    // the withheld webhook finally arrives late
    const st = await sim("/__sim/state");
    const late = st.deliveries.filter((d) => d.event === "qr_code.credited" && d.status === null).pop();
    const lr = await sim("/__sim/redeliver", { delivery: late.id, times: 1 });
    check("5. The late webhook is accepted and changes nothing", lr.statuses[0] === 200, `delivery ${late.id}`);
    exactlyOnce("5. After the late webhook", quoteId);
  }

  // 6. Refresh reuses the QR; expiry → new QR; a payment to the replaced QR is held
  {
    const { p, quoteId, qrId } = await openCheckout(ctx, "nextwise-verified", 0);
    check("6. Verified is exactly ₹1,999", +sql(`select amount_minor_units from payment_attempts where provider_qr_id='${qrId}'`) === 199900, "199900 paise");
    await p.reload();
    await p.waitForSelector("#nwp-qr-img");
    const qrAfter = sql(`select provider_qr_id from payment_attempts pa join invoices i on i.id=pa.invoice_id where i.pricing_quote_id='${quoteId}' and pa.status in ('created','pending')`);
    check("6. Refreshing the page reuses the same QR", qrAfter === qrId, qrAfter);
    sql(`update payment_attempts set expires_at = now() - interval '1 second' where provider_qr_id='${qrId}'`);
    await p.reload();
    await p.waitForSelector("#nwp-newqr", { timeout: 15000 });
    await p.click("#nwp-newqr");
    await p.waitForFunction((old) => { const i = document.querySelector("#nwp-qr-img"); return i && !i.getAttribute("src").includes(old); }, qrId, { timeout: 20000 });
    const qrNew = sql(`select provider_qr_id from payment_attempts pa join invoices i on i.id=pa.invoice_id where i.pricing_quote_id='${quoteId}' and pa.status in ('created','pending')`);
    const oldClosed = (await sim("/__sim/state")).qrs.find((q) => q.id === qrId);
    check("6. Expired QR replaced by a new one; the old one closed at the gateway", qrNew && qrNew !== qrId && oldClosed.status === "closed", `${qrId} → ${qrNew}`);
    // A real UPI app refuses a closed QR, but if money still reaches the replaced QR (forced here) it is a
    // genuine payment of the exact amount for this same, still-unpaid checkout: it settles it, and any
    // further payment for the checkout is held as a duplicate for refund.
    const lateOld = await sim("/__sim/pay-qr", { qr_id: qrId, force: true });
    await p.waitForSelector("#nwp-ok-title", { timeout: 30000 });
    const l1 = ledger(quoteId);
    check("6. Money reaching the replaced QR settles this unpaid checkout once", l1.paidInvoices === 1 && l1.txns.length === 1 && l1.txns[0][0] === lateOld.payment.id, l1.number);
    await sim("/__sim/pay-qr", { qr_id: qrNew });
    const l2 = ledger(quoteId);
    const dup = l2.txns.find((t) => t[0] !== lateOld.payment.id);
    check("6. A further payment to the new QR is held as a duplicate for refund", dup && dup[2] === "duplicate_payment", dup ? dup.join(" ") : "");
    exactlyOnce("6. Replaced QR + new QR both paid", quoteId);
    await p.close();
  }

  // 7. Mobile: UPI Intent through Razorpay Checkout (UPI only); a failure, then a retry
  {
    const m = await browser.newContext({ ...require("playwright").devices["iPhone 13"] });
    for (const c of await ctx.cookies()) await m.addCookies([c]);
    const p = await m.newPage();
    await p.goto(`${APP}/checkout/start?plan=study-abroad-lite&extra=1`);
    await p.waitForURL(/\/checkout\/[0-9a-f-]{36}$/);
    const quoteId = p.url().split("/").pop();
    await p.click("#nwp-paybar-btn");
    await p.waitForSelector("#rzp-td-fail", { timeout: 20000 });
    await p.click("#rzp-td-fail");
    await p.waitForSelector("#nwp-retry", { timeout: 20000 });
    check("7. A declined UPI payment shows the failed state, nothing granted", ledger(quoteId).paidInvoices === 0, "payment.failed");
    await p.click("#nwp-retry");
    await p.waitForSelector("#rzp-td-pay", { timeout: 20000 });
    await p.click("#rzp-td-pay");
    await p.waitForSelector("#nwp-ok-title", { timeout: 40000 });
    exactlyOnce("7. Mobile UPI Intent after one failure", quoteId, { note: "payment.authorized + payment.captured webhooks" });
    await m.close();
  }

  // 8. Invoice numbers: one consumed per paid checkout, none for abandoned ones
  const seqAfter = +sql(`select coalesce(max(last_value),0) from invoice_number_sequences where prefix='INV-'||to_char(now(),'YYYY')`);
  check("8. Exactly four invoice numbers consumed for four paid checkouts", seqAfter - seqBefore === 4, `${seqBefore} → ${seqAfter}`);

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  require("node:fs").writeFileSync("/tmp/claude-0/pay1-qa/e2e-proof-results.json", JSON.stringify({ at: new Date().toISOString(), passed: results.length - failed.length, failed: failed.length, results }, null, 2));
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error("ERROR", e);
  process.exit(2);
});
