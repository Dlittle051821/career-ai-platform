/**
 * NEXTWISE UI/UX BASELINE V5.6.3 — deterministic visual regression.
 *
 * Compares key homepage scenes and shared-UI surfaces with the approved reference
 * images in tests/visual/__baseline__/, captured from the canonical commit
 * 893d816 (tag nextwise-ui-v563-approved). See docs/UI-UX-CANONICAL-BASELINE.md.
 *
 *   npm run build && npm run verify:visual        (needs: npx playwright install chromium)
 *
 * The reference images are rendered by Linux Chromium (the CI runner). Font
 * rasterisation differs on Windows and macOS, so run this suite in CI or in Linux.
 * Never refresh the images to make a failing branch pass: a refresh is a baseline
 * change and needs the owner's approval (docs/UI-UX-DEVELOPMENT-PROTOCOL.md §6).
 */
import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.VISUAL_PORT ?? 3100);

export default defineConfig({
  testDir: "tests/visual",
  snapshotPathTemplate: "tests/visual/__baseline__/{arg}-{projectName}{ext}",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: "tests/visual/report", open: "never" }]],
  outputDir: "tests/visual/results",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    browserName: "chromium",
    colorScheme: "light",
    locale: "en-GB",
    timezoneId: "Asia/Kolkata",
    deviceScaleFactor: 1,
  },
  // CSS animations and transitions run on the compositor clock, which page.clock cannot pause:
  // "disabled" settles finite ones and stops infinite ones, so each checkpoint is reproducible.
  expect: { toHaveScreenshot: { animations: "disabled", caret: "hide", scale: "css" } },
  projects: [
    { name: "desktop-1440", use: { viewport: { width: 1440, height: 900 } } },
    { name: "tablet-768", use: { viewport: { width: 768, height: 1024 } } },
    { name: "mobile-390", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
