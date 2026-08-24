import { chromium } from "playwright";

const BASE = "http://localhost:4500";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
let failures = 0;
function check(name, cond) {
  console.log(`${cond ? "PASS" : "FAIL"} — ${name}`);
  if (!cond) failures++;
}

// 1. Logged-out /dashboard redirects to /login?next=/dashboard
{
  const page = await browser.newPage();
  await page.goto(BASE + "/dashboard", { waitUntil: "networkidle" });
  check("logged-out /dashboard redirects to /login", page.url().includes("/login"));
  check("redirect preserves next=/dashboard", page.url().includes("next=%2Fdashboard") || page.url().includes("next=/dashboard"));
  await page.close();
}

// 2. Logged-out /roadmap redirects to /login
{
  const page = await browser.newPage();
  await page.goto(BASE + "/roadmap", { waitUntil: "networkidle" });
  check("logged-out /roadmap redirects to /login", page.url().includes("/login"));
  await page.close();
}

// 3. /login and /register load normally (not redirected) when logged out
for (const route of ["/login", "/register", "/forgot-password", "/reset-password"]) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  const resp = await page.goto(BASE + route, { waitUntil: "networkidle" });
  check(`${route} loads with 200`, resp.status() === 200);
  check(`${route} has exactly one h1`, (await page.locator("h1").count()) === 1);
  check(`${route} has no console/page errors`, errors.length === 0);
  if (errors.length) console.log("   errors:", errors);
  await page.close();
}

// 4. Register form client-side validation (empty submit shows errors, no network call needed)
{
  const page = await browser.newPage();
  await page.goto(BASE + "/register", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForTimeout(150);
  const alertCount = await page.locator('[role="alert"]').count();
  check("register: empty submit shows validation errors", alertCount > 0);
  await page.close();
}

// 5. Login form client-side validation
{
  const page = await browser.newPage();
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForTimeout(150);
  const alertCount = await page.locator('[role="alert"]').count();
  check("login: empty submit shows validation errors", alertCount > 0);
  await page.close();
}

// 6. Register: filled form with placeholder Supabase creds -> friendly network error (not raw JSON/crash)
{
  const page = await browser.newPage();
  await page.goto(BASE + "/register", { waitUntil: "networkidle" });
  await page.fill("#register-name", "Test Student");
  await page.fill("#register-email", "test@example.com");
  await page.fill("#register-phone", "9876543210");
  await page.fill("#register-password", "Passw0rd123");
  await page.check("#register-terms");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForTimeout(2500);
  const bodyText = await page.locator("body").innerText();
  check("register: no raw JSON/exception leaked to UI", !/TypeError|at Object\.|stack trace|\{"error"/.test(bodyText));
  const hasFriendlyError = await page.locator('[role="alert"]').count();
  check("register: shows a friendly alert on network failure", hasFriendlyError > 0);
  await page.close();
}

// 7. Header shows Log in / Register when logged out (desktop)
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  check("header shows Log in link", (await page.locator('a[href="/login"]').count()) > 0);
  check("header shows Register link", (await page.locator('a[href="/register"]').count()) > 0);
  await page.close();
}

await browser.close();
console.log(failures === 0 ? "\nALL M2 CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
