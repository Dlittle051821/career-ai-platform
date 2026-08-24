import { chromium } from "playwright";

const BASE = "http://localhost:4500";
const ROUTES = [
  "/",
  "/how-it-works",
  "/career-discovery",
  "/study-options",
  "/parents",
  "/pricing",
  "/trust",
  "/about",
  "/contact",
  "/book-counselling",
  "/privacy",
  "/terms",
  "/refund-policy",
  "/this-route-does-not-exist",
];

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
let hadProblem = false;

for (const route of ROUTES) {
  const page = await browser.newPage({ viewport: { width: 375, height: 800 } });
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(err.message));

  const response = await page.goto(BASE + route, { waitUntil: "networkidle" });
  const status = response ? response.status() : "no-response";

  // Check horizontal overflow at 320px width
  await page.setViewportSize({ width: 320, height: 800 });
  await page.waitForTimeout(150);
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  });

  const h1Count = await page.locator("h1").count();

  console.log(
    `${route.padEnd(32)} status=${status} h1=${h1Count} overflow320=${overflow} consoleErrors=${consoleErrors.length} pageErrors=${pageErrors.length}`
  );
  if (consoleErrors.length) console.log("   console:", consoleErrors.slice(0, 3));
  if (pageErrors.length) console.log("   pageerror:", pageErrors.slice(0, 3));
  if (overflow || pageErrors.length) hadProblem = true;

  await page.close();
}

await browser.close();
process.exit(hadProblem ? 1 : 0);
