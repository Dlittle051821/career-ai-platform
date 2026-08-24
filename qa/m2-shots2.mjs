import { chromium } from "playwright";
const BASE = "http://localhost:4500";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

{
  const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + "/dashboard", { waitUntil: "networkidle" });
  await page.screenshot({ path: "qa/shots/m2-dashboard.png" });
  console.log("dashboard errors:", errors);
  await page.close();
}
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + "/roadmap", { waitUntil: "networkidle" });
  await page.screenshot({ path: "qa/shots/m2-roadmap.png" });
  console.log("roadmap errors:", errors);
  await page.close();
}

await browser.close();
console.log("done");
