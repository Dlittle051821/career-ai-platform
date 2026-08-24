import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:4302";
fs.mkdirSync("qa/shots", { recursive: true });

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const widths = [320, 375, 768, 1024, 1280, 1440];
const routes = ["/", "/pricing", "/trust"];

for (const route of routes) {
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(BASE + route, { waitUntil: "networkidle" });
    const name = route === "/" ? "home" : route.replace("/", "");
    await page.screenshot({ path: `qa/shots/${name}-${width}.png`, fullPage: true });
    await page.close();
  }
}

await browser.close();
console.log("done");
