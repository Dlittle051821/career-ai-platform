const { chromium } = require('/home/claude/render/node_modules/playwright-core');
const BASE = 'http://127.0.0.1:3100';
const PW = (u) => `${process.env.QA_PASSWORD_PREFIX}-${u}-1`; // local disposable accounts only; set QA_PASSWORD_PREFIX to match your seed script
async function launch() { return chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] }); }
async function ctx(browser, { w = 1440, h = 900, mobile = false, video = null } = {}) {
  const c = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile, reducedMotion: video ? 'no-preference' : 'reduce', recordVideo: video ? { dir: video, size: { width: w, height: h } } : undefined });
  return c;
}
async function login(page, user) {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name="email"]', `${user}@qa.nextwise.test`);
  await page.fill('input[name="password"]', PW(user));
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }), page.click('button[type="submit"]')]);
}
function watch(page, errs) { page.on('response', (r) => { if (r.status() === 404 && !/does-not-exist|qa-draft|nope-nope/.test(r.url())) errs.push('404: ' + r.url()); }); page.on('pageerror', (e) => errs.push('pageerror: ' + e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/status of 404/.test(m.text())) errs.push('console: ' + m.text().slice(0, 200)); }); }
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
module.exports = { BASE, launch, ctx, login, watch, overflow };
