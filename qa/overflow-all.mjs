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
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];
const WIDTHS = [320, 375, 768, 1024, 1280, 1440, 1920];

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
let problems = 0;

for (const route of ROUTES) {
  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(BASE + route, { waitUntil: "networkidle" });
    const info = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    const overflow = info.scrollWidth > info.clientWidth + 1;
    if (overflow) {
      problems++;
      console.log(`OVERFLOW ${route} @ ${width}px — scrollWidth=${info.scrollWidth} clientWidth=${info.clientWidth}`);
    }
    await page.close();
  }
}

await browser.close();
console.log(problems === 0 ? "No horizontal overflow on any route/width combination." : `${problems} overflow issue(s) found.`);
process.exit(problems === 0 ? 0 : 1);
