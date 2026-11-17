// Role-based browser tests against the local stack (real auth, real database with the proposed migrations applied).
const fs = require('fs');
const { BASE, launch, ctx, login, watch, overflow } = require('./lib.cjs');
const R = []; let failed = 0;
const ok = (group, name, cond, detail = '') => { R.push({ group, name, pass: !!cond, detail: String(detail).slice(0, 200) }); if (!cond) failed++; console.log(`${cond ? 'PASS' : 'FAIL'}  [${group}] ${name}${cond ? '' : '  -> ' + String(detail).slice(0, 200)}`); };
const SENTINEL = /Universität zu Köln|Rheinisch-Westfälische|uni-koeln\.de|rwth-aachen\.de|Technische Universität Dortmund/;
const KOELN = '/universities/universitaet-zu-koeln', RWTH = '/universities/rheinisch-westfaelische-technische-hochschule-aachen';
const shot = (p, n, full = false) => p.screenshot({ path: `shots/${n}.png`, fullPage: full });

async function session(b, user, opts = {}) {
  const c = await ctx(b, opts); const p = await c.newPage(); const errs = []; watch(p, errs);
  const bodies = [];
  p.on('response', async (r) => { const ct = r.headers()['content-type'] || ''; if (r.url().startsWith(BASE) && /html|x-component/.test(ct)) { try { bodies.push(await r.text()); } catch {} } });
  if (user) await login(p, user);
  bodies.length = 0;
  return { c, p, errs, bodies };
}
async function openDialog(p) { await p.locator('button[aria-haspopup="dialog"]').first().click(); await p.waitForSelector('dialog[open]'); await p.waitForFunction(() => !document.querySelector('dialog[open] [data-checking]'), null, { timeout: 12000 }); }
const dlg = (p) => p.evaluate(() => { const d = document.querySelector('dialog[open]'); return d ? { state: d.dataset.state, title: d.querySelector('h3').textContent, links: [...d.querySelectorAll('.ud-dialog-actions a')].map((a) => a.getAttribute('href')), disabled: !!d.querySelector('.ud-dialog-actions button[disabled]'), price: (d.querySelector('.ud-price em') || {}).textContent || null, focus: document.activeElement.className } : null; });

async function lockedRole(b, user, expectState) {
  const g = user || 'anonymous'; const s = await session(b, user); const { p } = s;
  await p.goto(BASE + '/universities', { waitUntil: 'networkidle' });
  ok(g, '/universities shows six destinations, no directory cards', (await p.locator('.ud-dest').count()) === 6 && (await p.locator('.ud-uc').count()) === 0);
  await p.goto(BASE + '/universities?destination=germany', { waitUntil: 'networkidle' });
  ok(g, 'Germany shows official portals incl. Hochschulkompass and Study in Germany', /Hochschulkompass/.test(await p.content()) && /Study in Germany/.test(await p.content()), await p.locator('.ud-res h3').allInnerTexts());
  const hrefs = await p.locator('.ud-res a.ud-btn').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  ok(g, 'portal links leave through the validated /go redirect', hrefs.length >= 2 && hrefs.every((h) => h.startsWith('/go/course-search/')), hrefs);
  await openDialog(p); const d = await dlg(p);
  ok(g, `dialog state is ${expectState}`, d.state === expectState, JSON.stringify(d));
  ok(g, 'dialog offers no directory link and no checkout link', !d.links.includes('/universities') && !d.links.some((l) => l.includes('/pricing/checkout')), d.links);
  if (['anonymous', 'signed_in_free'].includes(expectState)) ok(g, 'dialog price is ₹1,999 (never ₹2,358)', d.price === '₹1,999' && !/2,358/.test(await p.content()), d.price);
  if (expectState === 'signed_in_free') ok(g, 'purchase action is disabled', d.disabled);
  ok(g, 'focus moves into the dialog', /ud-dialog-close/.test(d.focus), d.focus);
  await shot(p, `dialog_${g}`);
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  ok(g, 'Escape closes the dialog and returns focus to its trigger', await p.evaluate(() => !document.querySelector('dialog[open]') && document.activeElement.getAttribute('aria-haspopup') === 'dialog'));
  const r = await p.goto(BASE + KOELN, { waitUntil: 'networkidle' });
  ok(g, 'university profile URL shows the locked preview (HTTP 200, no record)', r.status() === 200 && (await p.locator('.ud-locked').count()) === 1 && (await p.locator('.ud-pf-hero').count()) === 0);
  await p.goto(BASE + '/universities/this-does-not-exist', { waitUntil: 'networkidle' });
  ok(g, 'an unknown slug looks identical (existence is not revealed)', (await p.locator('.ud-locked').count()) === 1);
  await p.goto(BASE + '/universities?q=Köln&state=Nordrhein-Westfalen&category=university', { waitUntil: 'networkidle' });
  ok(g, 'directory filters in the URL return nothing', (await p.locator('.ud-uc').count()) === 0);
  await p.goto(BASE + '/courses/compare?ids=x', { waitUntil: 'networkidle' });
  ok(g, 'course comparison redirects with an explanation', /moved=compare/.test(p.url()) && (await p.locator('.ud-moved').count()) === 1, p.url());
  await p.goto(BASE + '/courses/rheinisch-westfaelische-technische-hochschule-aachen/qa-msc-test', { waitUntil: 'networkidle' });
  ok(g, 'course detail redirects with an explanation', /moved=course/.test(p.url()) && (await p.locator('.ud-moved').count()) === 1, p.url());
  await p.goto(BASE + '/sitemap.xml'); ok(g, 'sitemap lists no university or course record', !/\/universities\/|\/courses\//.test(await p.content()));
  const leak = s.bodies.find((t) => SENTINEL.test(t));
  ok(g, 'no university record in any HTML or RSC payload', !leak, leak ? leak.match(SENTINEL)[0] : '');
  ok(g, 'no console or page errors', s.errs.length === 0, s.errs[0]);
  return s;
}

(async () => {
  const b = await launch();
  // 1 Anonymous
  let s = await lockedRole(b, null, 'anonymous');
  let r = await s.p.goto(BASE + '/saved'); ok('anonymous', '/saved redirects to login with the return path', /\/login\?next=%2Fsaved/.test(s.p.url()), s.p.url());
  await s.p.goto(BASE + '/admin/students'); ok('anonymous', '/admin redirects to login', /\/login/.test(s.p.url()), s.p.url());
  await s.c.close();

  // 2 Free student (has one saved university, one saved course and one application from before)
  s = await lockedRole(b, 'free', 'signed_in_free'); let p = s.p;
  await p.goto(BASE + '/saved', { waitUntil: 'networkidle' });
  ok('free', '/saved: shortlist kept but locked, no record shown', (await p.locator('.ud-lockrow').count()) === 1 && /shortlist of 1 university is safe/.test(await p.locator('.ud-lockrow').innerText()) && (await p.locator('.ud-uc').count()) === 0);
  await shot(p, 'saved_locked_free');
  await p.goto(BASE + '/saved?tab=courses', { waitUntil: 'networkidle' });
  ok('free', 'saved courses: title kept with official link, not a dead internal page', /QA M\.Sc\. Test Programme/.test(await p.content()) && (await p.locator('.ud-list a[target="_blank"]').count()) === 1);
  await shot(p, 'saved_courses_free');
  await p.goto(BASE + '/applications', { waitUntil: 'networkidle' });
  ok('free', 'existing application still shows its course and university', /QA M\.Sc\. Test Programme/.test(await p.content()), p.url());
  await p.goto(BASE + '/studio', { waitUntil: 'networkidle' });
  ok('free', 'Studio shows the locked saved-universities panel', (await p.locator('#ud-saved-unis').count()) === 1 && (await p.locator('.ud-panel .ud-lockrow').count()) === 1);
  await shot(p, 'studio_free', true);
  await p.goto(BASE + '/admin/students', { waitUntil: 'networkidle' });
  ok('free', 'a student cannot open the admin console', !/\/admin\/students$/.test(p.url()) || /not authori|permission|denied/i.test(await p.content()), p.url());
  // Session expiry while the page is open
  await p.goto(BASE + '/universities?destination=germany', { waitUntil: 'networkidle' });
  await s.c.clearCookies(); await openDialog(p); let d = await dlg(p);
  ok('expired session', 'dialog says the session has ended and offers login with the return path', d.state === 'session_expired' && d.links[0].startsWith('/login?next='), JSON.stringify(d));
  await shot(p, 'dialog_session_expired'); await p.keyboard.press('Escape');
  await p.goto(BASE + '/saved'); ok('expired session', 'a protected page sends the visitor to login', /\/login\?next=%2Fsaved/.test(p.url()), p.url());
  await s.c.close();
  // Network failure
  s = await session(b, 'free'); p = s.p; await p.goto(BASE + '/universities?destination=germany', { waitUntil: 'networkidle' });
  await s.c.setOffline(true); await p.locator('button[aria-haspopup="dialog"]').first().click(); await p.waitForSelector('dialog[open][data-state="error"]', { timeout: 15000 }).catch(() => {});
  d = await dlg(p); ok('network error', 'dialog reports the failure with a retry, not a loading state', d.state === 'error' && !d.links.includes('/universities'), JSON.stringify(d));
  await shot(p, 'dialog_network_error');
  await s.c.setOffline(false); await p.locator('dialog[open] .ud-dialog-actions button').click(); await p.waitForSelector('dialog[open][data-state="signed_in_free"]', { timeout: 15000 }).catch(() => {});
  ok('network error', 'Try again recovers to the real state', (await dlg(p)).state === 'signed_in_free'); await s.c.close();

  // 3 Payment pending / 4 failed
  s = await lockedRole(b, 'pending', 'payment_pending'); await s.c.close();
  s = await lockedRole(b, 'failed', 'payment_failed'); await s.c.close();

  // 5 Verified (paid)
  s = await session(b, 'verified'); p = s.p;
  await p.goto(BASE + '/universities', { waitUntil: 'networkidle' });
  ok('verified', 'directory shows 12 photo-led cards of 239', (await p.locator('.ud-uc').count()) === 12 && /of 239/.test(await p.locator('.ud-count').innerText()));
  ok('verified', 'verified records with photographs come first', (await p.locator('.ud-uc').first().locator('.ud-uc-im img').count()) === 1);
  ok('verified', 'every photograph shows its credit', (await p.locator('.ud-uc-im img').count()) === (await p.locator('.ud-uc-im .ud-credit').count()));
  await shot(p, 'directory_desktop'); await shot(p, 'directory_desktop_full', true);
  const pick = async (name, value) => { await Promise.all([p.waitForURL((u) => decodeURIComponent(u.search.replace(/\+/g,' ')).includes(`${name}=${value}`), { timeout: 15000 }), p.selectOption(`select[name="${name}"]`, value)]); await p.waitForLoadState('networkidle'); };
  const total = async () => Number(((await p.locator('.ud-count b').nth(1).innerText().catch(() => '0')) || '0').replace(/\D/g, ''));
  await pick('state', 'Nordrhein-Westfalen'); const nrw = await total(); ok('verified', 'state filter: Nordrhein-Westfalen', nrw > 20 && nrw < 45, nrw);
  await pick('category', 'university_of_applied_sciences'); const haw = await total(); ok('verified', 'adding Hochschule/UAS narrows the result', haw > 5 && haw < nrw, haw);
  ok('verified', 'every card in the result is a Hochschule in NRW', (await p.locator('.ud-uc-ty').allInnerTexts()).every((t) => /Hochschule/.test(t)) && (await p.locator('.ud-uc-lc').allInnerTexts()).every((t) => /Nordrhein-Westfalen/.test(t)));
  await pick('area', 'engineering'); const eng = await total(); ok('verified', 'adding study area narrows again', eng > 0 && eng <= haw, eng);
  ok('verified', 'active filters are shown as removable chips', (await p.locator('.ud-chip').count()) >= 4);
  await shot(p, 'directory_filtered');
  await p.goBack({ waitUntil: 'networkidle' }); await p.waitForTimeout(1200); ok('verified', 'browser Back restores the previous filter set', !/area=engineering/.test(p.url()) && (await total()) === haw, p.url());
  await p.goForward({ waitUntil: 'networkidle' }); ok('verified', 'browser Forward re-applies it', /area=engineering/.test(p.url()) && (await total()) === eng);
  await p.goto(BASE + '/universities?q=' + encodeURIComponent('Köln'), { waitUntil: 'networkidle' }); ok('verified', 'search by name finds Köln institutions', (await total()) >= 3 && /Köln/.test(await p.locator('.ud-uc h3').first().innerText()), await total());
  await p.goto(BASE + '/universities?city=Aachen', { waitUntil: 'networkidle' }); ok('verified', 'city filter: Aachen', (await total()) === 2, await total());
  await p.goto(BASE + '/universities?ownership=private', { waitUntil: 'networkidle' }); ok('verified', 'a filter with no match shows the empty state with a clear action', (await p.locator('.ud-state').count()) === 1 && /No universities match/.test(await p.locator('.ud-state').innerText()));
  await shot(p, 'directory_empty');
  await p.goto(BASE + "/universities?category=%27%3B+drop+table&sort=evil&page=-4&country=1", { waitUntil: 'networkidle' }); ok('verified', 'crafted filter values are ignored, not applied', (await total()) === 239);
  await p.goto(BASE + '/universities?page=2', { waitUntil: 'networkidle' }); ok('verified', 'pagination: page 2 shows 13–24', /13–24/.test(await p.locator('.ud-count').innerText()));
  await p.goto(BASE + '/universities?page=999', { waitUntil: 'networkidle' }); ok('verified', 'a page past the end shows a state, not an error', (await p.locator('.ud-state').count()) === 1);
  // save / remove
  await p.goto(BASE + '/universities', { waitUntil: 'networkidle' });
  const first = p.locator('.ud-uc').first(); const firstName = await first.locator('h3').innerText();
  await first.locator('.ud-heart').click(); await p.waitForFunction(() => document.querySelector('.ud-uc .ud-heart').getAttribute('aria-pressed') === 'true' && !document.querySelector('.ud-uc .ud-heart').disabled);
  ok('verified', 'saving turns the heart and the Save button to the saved state together', (await first.locator('.ud-save').getAttribute('aria-pressed')) === 'true' && /Saved/.test(await first.locator('.ud-save').innerText()));
  await shot(p, 'directory_saved');
  await p.reload({ waitUntil: 'networkidle' }); ok('verified', 'the saved state and count persist after reload', (await p.locator('.ud-uc').first().locator('.ud-heart').getAttribute('aria-pressed')) === 'true' && /1 saved/.test(await p.locator('.ud-svp').innerText()));
  await p.goto(BASE + '/saved', { waitUntil: 'networkidle' }); ok('verified', 'Saved items lists it with thumbnail and details', (await p.locator('.ud-uc').count()) === 1 && (await p.locator('.ud-uc h3').innerText()) === firstName);
  await shot(p, 'saved_verified');
  await p.goto(BASE + '/studio', { waitUntil: 'networkidle' }); ok('verified', 'Studio shows the saved university with quick access', (await p.locator('.ud-mini').count()) === 1 && (await p.locator('.ud-mini').getAttribute('href')).startsWith('/universities/'));
  await shot(p, 'studio_verified', true);
  await p.goto(BASE + '/saved', { waitUntil: 'networkidle' }); await p.locator('.ud-uc .ud-save').click(); await p.waitForFunction(() => document.querySelector('.ud-uc .ud-save').getAttribute('aria-pressed') === 'false');
  await p.waitForTimeout(1500); await p.reload({ waitUntil: 'networkidle' }); ok('verified', 'removing empties the list and shows the empty state', (await p.locator('.ud-uc').count()) === 0 && /No universities saved yet/.test(await p.content()));
  await shot(p, 'saved_empty');
  // profile
  r = await p.goto(BASE + RWTH, { waitUntil: 'networkidle' });
  ok('verified', 'profile: hero photo with credit, category, location', r.status() === 200 && (await p.locator('.ud-pf-hero > img').count()) === 1 && /Nima j72/.test(await p.locator('.ud-pf-hero .ud-credit').innerText()) && /Aachen, Nordrhein-Westfalen, Germany/.test(await p.locator('.ud-pf-loc').innerText()));
  ok('verified', 'profile: gallery of 5 photographs, each credited', (await p.locator('.ud-th').count()) === 5);
  await p.locator('.ud-th').nth(1).click(); ok('verified', 'gallery: choosing a thumbnail changes the main photograph and its credit', /Aleph/.test(await p.locator('.ud-gm figcaption').innerText()));
  ok('verified', 'profile: highlight carries its source link', (await p.locator('.ud-sc small a[href^="https://"]').count()) >= 1);
  ok('verified', 'profile: rankings name provider and year and are labelled as subject rankings', /QS World University Rankings by Subject · 2026/.test(await p.locator('.ud-rk', { hasText: 'Subject rankings' }).innerText()) && /=39|=53/.test(await p.locator('.ud-rk', { hasText: 'Subject rankings' }).innerText()));
  ok('verified', 'profile: sticky actions present (save, official website, guidance)', (await p.locator('.ud-stk .ud-save').count()) === 1 && (await p.locator('.ud-stk a').count()) === 2);
  await p.locator('.ud-pf-acts .ud-save').click(); await p.waitForFunction(() => document.querySelector('.ud-stk .ud-save').getAttribute('aria-pressed') === 'true');
  ok('verified', 'profile: saving in the hero also updates the sticky bar', true);
  await p.locator('.ud-stk .ud-save').click(); await p.waitForFunction(() => document.querySelector('.ud-pf-acts .ud-save').getAttribute('aria-pressed') === 'false');
  for (const y of [0, 900, 1800, 2700, 3600]) { await p.evaluate((v) => window.scrollTo(0, v), y); await p.waitForTimeout(250); }
  await p.evaluate(() => window.scrollTo(0, 0)); await shot(p, 'profile_desktop'); await shot(p, 'profile_desktop_full', true);
  r = await p.goto(BASE + KOELN, { waitUntil: 'networkidle' }); ok('verified', 'profile without rankings shows none (nothing invented)', (await p.locator('#ud-pf-rankings').count()) === 0 && (await p.locator('.ud-sc').count()) === 1);
  r = await p.goto(BASE + '/universities/hochschule-duesseldorf', { waitUntil: 'networkidle' }); ok('verified', 'unverified profile: marked as not verified, neutral hero, no rankings or highlights', (await p.locator('.ud-pf-hero[data-plain]').count()) === 1 && /hasn't verified/.test(await p.content()) && (await p.locator('.ud-sc').count()) === 0, p.url());
  await shot(p, 'profile_unverified');
  r = await p.goto(BASE + '/universities/qa-draft-university'); ok('verified', 'a draft university answers 404', r.status() === 404, r.status());
  r = await p.goto(BASE + '/universities/nope-nope'); ok('verified', 'an unknown university answers 404', r.status() === 404, r.status());
  await p.goto(BASE + '/courses', { waitUntil: 'networkidle' }); ok('verified', 'Course Explorer shows official portals only, even when Verified', (await p.locator('.ud-dest').count()) === 6);
  await p.goto(BASE + '/courses/compare', { waitUntil: 'networkidle' }); ok('verified', 'course comparison is not available to a Verified student', /moved=compare/.test(p.url()));
  ok('verified', 'no console or page errors', s.errs.length === 0, s.errs[0]); await s.c.close();

  // 6 Admin: grant and revoke through the console
  const granted = JSON.parse(fs.readFileSync('ids.json', 'utf8')).granted;
  let g = await session(b, 'granted'); await g.p.goto(BASE + '/universities', { waitUntil: 'networkidle' });
  ok('admin grant', 'before the grant the student sees no directory', (await g.p.locator('.ud-uc').count()) === 0);
  s = await session(b, 'admin'); p = s.p;
  await p.goto(BASE + '/universities', { waitUntil: 'networkidle' }); ok('admin', 'admin sees the directory as staff, without student save controls', (await p.locator('.ud-uc').count()) === 12 && (await p.locator('.ud-heart').count()) === 0 && /Staff access/.test(await p.content()));
  await p.goto(BASE + '/admin/universities', { waitUntil: 'networkidle' }); ok('admin', 'admin university management still loads', /admin\/universities/.test(p.url()) && (await p.locator('table, [role="table"]').count()) >= 1, p.url());
  await p.goto(BASE + '/admin/courses', { waitUntil: 'networkidle' }); ok('admin', 'admin course management still loads', /admin\/courses/.test(p.url()) && /QA M\.Sc\. Test Programme/.test(await p.content()));
  await p.goto(BASE + '/admin/education/sources', { waitUntil: 'load' }); ok('admin', 'trusted sources page lists Hochschulkompass and Study in Germany', (await p.locator('[data-portal="Hochschulkompass"]').count()) === 1 && (await p.locator('[data-portal="Study in Germany"]').count()) === 1 && /Shown to students/.test(await p.locator('[data-portal="Hochschulkompass"]').innerText()));
  await shot(p, 'admin_sources', true);
  await p.goto(BASE + '/courses', { waitUntil: 'networkidle' }); ok('admin', 'admin keeps the internal course list', /QA M\.Sc\. Test Programme/.test(await p.content()));
  await p.goto(BASE + `/admin/students/${granted}`, { waitUntil: 'networkidle' });
  ok('admin grant', 'student page shows the access card with scope wording', /Verified university access/.test(await p.content()) && /does not grant course records/.test(await p.content()));
  await p.click('button:has-text("Grant Verified university access")'); await p.waitForTimeout(600);
  ok('admin grant', 'granting without a reason is refused in the browser', (await p.locator('button:has-text("Revoke access")').count()) === 0);
  await p.fill('#grant-reason', 'QA browser test: paid offline, receipt QA-0002'); await p.click('button:has-text("Grant Verified university access")');
  await p.waitForSelector('button:has-text("Revoke access")', { timeout: 15000 });
  ok('admin grant', 'grant recorded with reason, time and granted-by', /QA browser test: paid offline/.test(await p.content()) && /Granted .* by QA admin/.test(await p.locator('ul.space-y-3').first().innerText()), await p.locator('ul.space-y-3').first().innerText());
  await shot(p, 'admin_grant', true);
  await g.p.goto(BASE + '/universities', { waitUntil: 'networkidle' });
  ok('admin grant', 'the student now sees the directory, labelled as granted by the team', (await g.p.locator('.ud-uc').count()) === 12 && /granted by the Nextwise team/.test(await g.p.content()));
  await g.p.locator('.ud-uc').first().locator('.ud-heart').click(); await g.p.waitForFunction(() => document.querySelector('.ud-uc .ud-heart').getAttribute('aria-pressed') === 'true' && !document.querySelector('.ud-uc .ud-heart').disabled);
  await g.p.goto(BASE + '/courses', { waitUntil: 'networkidle' }); await openDialog(g.p); d = await dlg(g.p);
  ok('admin grant', 'dialog state: access granted by admin', d.state === 'verified_by_grant' && d.links[0] === '/universities', JSON.stringify(d)); await shot(g.p, 'dialog_verified_by_grant'); await g.p.keyboard.press('Escape');
  await p.fill('#revoke-reason', 'QA browser test: revoke'); await p.click('button:has-text("Revoke access")'); await p.waitForSelector('button:has-text("Grant Verified university access")', { timeout: 15000 });
  ok('admin grant', 'revocation recorded with reason and revoked-by', /Revoked .* by QA admin: QA browser test: revoke/.test(await p.content()));
  await g.p.goto(BASE + '/universities', { waitUntil: 'networkidle' }); ok('admin grant', 'after revocation the student is locked out again', (await g.p.locator('.ud-uc').count()) === 0);
  await g.p.goto(BASE + RWTH, { waitUntil: 'networkidle' }); ok('admin grant', 'and profiles are locked again', (await g.p.locator('.ud-locked').count()) === 1);
  await g.p.goto(BASE + '/saved', { waitUntil: 'networkidle' }); ok('admin grant', 'the shortlist made while Verified is kept and shown as locked', /shortlist of 1 university is safe/.test(await g.p.locator('main').innerText()));
  await p.goto(BASE + '/admin/audit-log', { waitUntil: 'networkidle' }); ok('admin grant', 'audit log shows the grant and the revocation', /university_access_granted|Granted Verified university directory access/i.test(await p.content()) && /Revoked Verified university directory access|university_access_revoked/i.test(await p.content()));
  await shot(p, 'admin_audit');
  ok('admin', 'no console or page errors', s.errs.length === 0, s.errs[0]); await s.c.close(); await g.c.close();
  // counsellor cannot see or use the grant card
  s = await session(b, 'counsellor'); await s.p.goto(BASE + `/admin/students/${granted}`, { waitUntil: 'networkidle' });
  ok('counsellor', 'a counsellor does not get the grant controls', !/Grant Verified university access/.test(await s.p.content())); await s.c.close();

  fs.writeFileSync('browser-qa-results.json', JSON.stringify({ ranAt: new Date().toISOString(), total: R.length, failed, results: R }, null, 1));
  console.log(`\n${R.length - failed}/${R.length} passed`); await b.close(); process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('CRASH', e.stack.split('\n').slice(0, 4).join('\n')); fs.writeFileSync('browser-qa-results.json', JSON.stringify({ crashed: e.message, results: R }, null, 1)); process.exit(2); });
