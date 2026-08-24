import { chromium } from "playwright";
const BASE = "http://localhost:4500";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(BASE + "/register", { waitUntil: "networkidle" });
  await page.screenshot({ path: "qa/shots/m2-register.png" });
  await page.close();
}
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.screenshot({ path: "qa/shots/m2-login.png" });
  await page.close();
}
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 500 } });
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  await page.screenshot({ path: "qa/shots/m2-header-loggedout.png" });
  await page.close();
}
{
  const page = await browser.newPage({ viewport: { width: 390, height: 1200 } });
  await page.goto(BASE + "/register", { waitUntil: "networkidle" });
  await page.screenshot({ path: "qa/shots/m2-register-mobile.png" });
  await page.close();
}

await browser.close();
console.log("done");
