import { chromium } from "playwright";

const BASE = "http://localhost:4500";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
let failures = 0;

function check(name, condition) {
  console.log(`${condition ? "PASS" : "FAIL"} — ${name}`);
  if (!condition) failures++;
}

// 1. Mobile nav open/close + keyboard accessibility
{
  const page = await browser.newPage({ viewport: { width: 375, height: 800 } });
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const menuButton = page.getByRole("button", { name: "Open menu" });
  check("mobile menu button has aria-expanded=false initially", (await menuButton.getAttribute("aria-expanded")) === "false");
  await menuButton.click();
  await page.waitForTimeout(200);
  check("mobile menu button has aria-expanded=true after click", (await menuButton.getAttribute("aria-expanded")) === "true");
  const dialog = page.locator("#mobile-nav-dialog");
  check("dialog is open", await dialog.evaluate((el) => el.open));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  check("dialog closes on Escape", !(await dialog.evaluate((el) => el.open)));
  await page.close();
}

// 2. Mobile nav closes on route selection
{
  const page = await browser.newPage({ viewport: { width: 375, height: 800 } });
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.waitForTimeout(200);
  await page.getByLabel("Mobile").getByRole("link", { name: "How It Works" }).click();
  await page.waitForURL("**/how-it-works");
  await page.waitForLoadState("networkidle");
  check("navigated to /how-it-works", page.url().endsWith("/how-it-works"));
  const dialog = page.locator("#mobile-nav-dialog");
  check("dialog closed after route change", !(await dialog.evaluate((el) => el.open)));
  await page.close();
}

// 3. FAQ accordion
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const details = page.locator("details").first();
  check("FAQ item starts closed", !(await details.evaluate((el) => el.open)));
  await details.locator("summary").click();
  check("FAQ item opens on click", await details.evaluate((el) => el.open));
  await page.close();
}

// 4. Language selector "coming soon" notice
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "ଓଡ଼ିଆ", exact: true }).first().click();
  await page.waitForTimeout(150);
  check("Odia coming-soon notice appears", (await page.getByText("coming soon").count()) > 0);
  await page.close();
}

// 5. Contact form validation + demo success
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(BASE + "/contact", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Send message" }).click();
  await page.waitForTimeout(150);
  check("shows validation errors on empty submit", (await page.locator('[role="alert"]').count()) > 0);

  await page.fill("#contact-name", "Test Student");
  await page.selectOption("#contact-role", "student");
  await page.fill("#contact-phone", "9876543210");
  await page.fill("#contact-email", "test@example.com");
  await page.fill("#contact-city", "Bhubaneswar");
  await page.fill("#contact-message", "I would like to know more about career discovery.");
  await page.check("#contact-consent");
  await page.getByRole("button", { name: "Send message" }).click();
  await page.waitForTimeout(150);
  check("shows honest demo completion message", (await page.getByText("Form preview completed").count()) > 0);
  check("demo message says not transmitted", (await page.getByText(/not transmitted/).count()) > 0);
  await page.close();
}

// 6. Book counselling form validation + demo success, values preserved on failed validation
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(BASE + "/book-counselling", { waitUntil: "networkidle" });
  await page.fill("#booking-student-name", "Priya Sahoo");
  await page.getByRole("button", { name: "Request free counselling" }).click();
  await page.waitForTimeout(150);
  check("shows validation errors on incomplete submit", (await page.locator('[role="alert"]').count()) > 0);
  check("preserves entered value after failed validation", (await page.inputValue("#booking-student-name")) === "Priya Sahoo");

  await page.fill("#booking-email", "priya@example.com");
  await page.fill("#booking-phone", "9876543210");
  await page.selectOption("#booking-education-level", "class-12");
  await page.selectOption("#booking-passing-year", { index: 1 });
  await page.fill("#booking-location", "Cuttack");
  await page.selectOption("#booking-interest", "career-discovery");
  await page.fill("#booking-goal", "I want help understanding career options after class 12.");
  await page.check("#booking-consent");
  await page.getByRole("button", { name: "Request free counselling" }).click();
  await page.waitForTimeout(150);
  check("shows honest demo completion message", (await page.getByText("Form preview completed").count()) > 0);
  await page.close();
}

// 7. Header account control (M2): logged-out shows Log in / Register links
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  check("header shows a Log in link when logged out", (await page.locator('a[href="/login"]').count()) > 0);
  check("header shows a Register link when logged out", (await page.locator('a[href="/register"]').count()) > 0);
  await page.close();
}

// 8. Trust Center shows Pending verification badges, not fabricated "Verified"
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(BASE + "/trust", { waitUntil: "networkidle" });
  const pendingCount = await page.getByText("Pending verification").count();
  const verifiedCount = await page.getByText("Verified", { exact: true }).count();
  check("Trust Center shows Pending verification badges", pendingCount > 0);
  check("Trust Center does not claim Verified anywhere", verifiedCount === 0);
  await page.close();
}

// 9. Pricing page CTA links to booking, not payment
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(BASE + "/pricing", { waitUntil: "networkidle" });
  const hrefs = await page.locator('a[href="/book-counselling"]').count();
  check("pricing CTAs link to /book-counselling", hrefs > 0);
  await page.close();
}

// 10. No href="#" anywhere on homepage
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const hashLinks = await page.locator('a[href="#"]').count();
  check("no href=\"#\" links on homepage", hashLinks === 0);
  await page.close();
}

await browser.close();
console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
