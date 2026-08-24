import { chromium } from "playwright";

const BASE = "http://localhost:4500";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

{
  const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.screenshot({ path: "qa/shots/preview-home-desktop-v2.png" });
  await page.close();
}

{
  const page = await browser.newPage({ viewport: { width: 390, height: 1600 } });
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.screenshot({ path: "qa/shots/preview-home-mobile-v2.png" });
  await page.close();
}

await browser.close();
console.log("done");
