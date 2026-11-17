// Walkthrough videos (desktop + mobile) and responsive screenshots with overflow checks, on the local stack.
const fs = require('fs'); const { BASE, launch, ctx, login, overflow } = require('./lib.cjs');
const RWTH = '/universities/rheinisch-westfaelische-technische-hochschule-aachen';
const wait = (p, ms) => p.waitForTimeout(ms);
async function scroll(p, to = null, step = 14) { await p.evaluate(async ({ to, step }) => { const end = to ?? (document.documentElement.scrollHeight - innerHeight - 700); for (let y = scrollY; y < end; y += step) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 16)); } }, { to, step }); }
const top = (p) => p.evaluate(() => scrollTo({ top: 0 }));
async function go(p, path, ms = 1400) { await p.goto(BASE + path, { waitUntil: 'networkidle' }); await wait(p, ms); }
async function part(b, name, size, user, fn) { const c = await ctx(b, { ...size, video: `walk/${name}` }); const p = await c.newPage(); if (user) await login(p, user); await fn(p); await c.close(); const f = fs.readdirSync(`walk/${name}`)[0]; fs.renameSync(`walk/${name}/${f}`, `walk/${name}.webm`); }
async function flows(b, tag, size) {
  const m = !!size.mobile;
  await part(b, `${tag}_1_free`, size, null, async (p) => {
    await go(p, '/universities'); await scroll(p, m ? 1500 : 700); await top(p); await wait(p, 500);
    await go(p, '/universities?destination=germany'); await scroll(p, null, 10); await wait(p, 600);
    await p.locator('button[aria-haspopup="dialog"]').first().scrollIntoViewIfNeeded(); await wait(p, 500);
    await p.locator('button[aria-haspopup="dialog"]').first().click(); await wait(p, 3200); await p.keyboard.press('Escape'); await wait(p, 700);
    await go(p, RWTH, 2200); await go(p, '/courses?destination=germany'); await scroll(p, null, 12); await wait(p, 800);
  });
  await part(b, `${tag}_2_verified`, size, 'verified', async (p) => {
    await go(p, '/universities', 1800); await scroll(p, m ? 2600 : 1300, 12); await top(p); await wait(p, 600);
    await p.selectOption('select[name="state"]', 'Nordrhein-Westfalen'); await p.waitForURL(/Nordrhein/); await p.waitForLoadState('networkidle'); await wait(p, 1500);
    if (!m) { await p.locator('.ud-uc').first().hover(); await wait(p, 900); }
    await p.locator('.ud-uc').first().locator('.ud-heart').scrollIntoViewIfNeeded(); await p.locator('.ud-uc').first().locator('.ud-heart').click(); await wait(p, 1800);
    await go(p, RWTH, 1800); await scroll(p, null, 9); await wait(p, 900);
    await go(p, '/saved', 2200); await go(p, '/studio', 1200); await p.locator('#ud-saved-unis').scrollIntoViewIfNeeded(); await wait(p, 2200);
    await go(p, '/courses', 1200); await p.locator('button[aria-haspopup="dialog"]').first().scrollIntoViewIfNeeded(); await p.locator('button[aria-haspopup="dialog"]').first().click(); await wait(p, 2600); await p.keyboard.press('Escape');
    await go(p, '/saved', 800); await p.locator('.ud-uc .ud-save').click(); await wait(p, 1500);
  });
  await part(b, `${tag}_3_admin`, size, 'admin', async (p) => {
    const ids = JSON.parse(fs.readFileSync('ids.json', 'utf8'));
    await go(p, `/admin/students/${ids.granted}`, 1200); await p.locator('#grant-reason').scrollIntoViewIfNeeded(); await wait(p, 1500);
    await p.goto(BASE + '/admin/education/sources', { waitUntil: 'load' }); await wait(p, 2500);
    await go(p, '/universities', 1800);
  });
}
(async () => {
  const b = await launch(); const out = [];
  await flows(b, 'desktop', { w: 1440, h: 900 });
  await flows(b, 'mobile', { w: 390, h: 844, mobile: true });
  // Responsive screenshots + overflow
  for (const [tag, size] of [['desktop', { w: 1440, h: 900 }], ['tablet', { w: 820, h: 1180, mobile: true }], ['mobile', { w: 390, h: 844, mobile: true }]]) {
    for (const [user, pages] of [[null, [['discovery', '/universities'], ['discovery_germany', '/universities?destination=germany'], ['locked_profile', RWTH], ['courses', '/courses?destination=germany']]], ['verified', [['directory', '/universities'], ['directory_filtered', '/universities?state=Nordrhein-Westfalen&category=university_of_applied_sciences'], ['profile', RWTH], ['saved', '/saved'], ['studio', '/studio']]], ['free', [['saved_locked', '/saved']]]]) {
      const c = await ctx(b, size); const p = await c.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); if (user) await login(p, user);
      for (const [name, path] of pages) { await p.goto(BASE + path, { waitUntil: 'networkidle' }); await wait(p, 500); const o = await overflow(p); await p.screenshot({ path: `resp/${tag}_${name}.png`, fullPage: true }); out.push({ tag, name, overflow: o, errors: errs.length }); console.log(tag, name, 'overflow', o, 'errors', errs.length); }
      if (!user) { await p.goto(BASE + '/universities?destination=germany', { waitUntil: 'networkidle' }); await p.locator('button[aria-haspopup="dialog"]').first().click(); await wait(p, 2500); await p.screenshot({ path: `resp/${tag}_dialog.png` }); const fit = await p.evaluate(() => { const d = document.querySelector('dialog[open]').getBoundingClientRect(); return d.left >= 0 && d.right <= innerWidth + 1 && d.top >= 0 && d.bottom <= innerHeight + 1; }); out.push({ tag, name: 'dialog fits viewport', overflow: fit ? 0 : 1, errors: 0 }); console.log(tag, 'dialog fits', fit); }
      await c.close();
    }
  }
  fs.writeFileSync('responsive-results.json', JSON.stringify(out, null, 1)); await b.close();
})().catch((e) => { console.error('CRASH', e.message); process.exit(2); });
