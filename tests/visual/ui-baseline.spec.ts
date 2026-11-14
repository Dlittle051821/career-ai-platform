/**
 * NEXTWISE UI/UX BASELINE V5.6.3 — visual checkpoints.
 *
 * Every checkpoint runs on a virtual clock (page.clock), so the opening
 * animation, the N choreography and the scene transitions are captured at
 * exactly the same moment on every run. Fonts and images are awaited before
 * the clock starts. Tolerances are per checkpoint and were calibrated on the
 * canonical build (docs/UI-UX-CANONICAL-BASELINE.md §5): they absorb
 * anti-aliasing only, and stay far below any real layout, colour or asset change.
 *
 * A failure means the branch looks different from the approved V5.6.3 design.
 * Fix the branch. Refreshing the reference images (--update-snapshots) is a
 * baseline change that needs the owner's approval.
 */
import { expect, test, type Page } from "@playwright/test";

const START = new Date("2026-11-14T10:00:00+05:30");

/** VISUAL_CALIBRATE=1 reports every pixel difference (tolerance 0); used only to measure run-to-run noise. */
const tol = (ratio: number) => (process.env.VISUAL_CALIBRATE ? { maxDiffPixels: 0 } : { maxDiffPixelRatio: ratio });

/** Waits (in real time; the virtual clock stays paused) until every image in or near the viewport has loaded and decoded. */
async function settleImages(page: Page) {
  await page.evaluate(async () => {
    const near = (i: HTMLImageElement) => {
      const r = i.getBoundingClientRect();
      return r.bottom > -innerHeight && r.top < innerHeight * 2;
    };
    await Promise.all(
      [...document.images]
        .filter((i) => i.loading !== "lazy" || near(i))
        .map((i) => (i.complete ? i.decode().catch(() => {}) : new Promise((r) => { i.onload = i.onerror = r; }))),
    );
  });
  await page.waitForTimeout(300);
}

/**
 * Load a page on a PAUSED virtual clock (page.clock.install alone lets time flow; pauseAt stops it),
 * with fonts, images and hydration complete before any virtual time passes. The homepage reports
 * hydration through data-v54-ready.
 */
async function open(page: Page, path: string) {
  await page.clock.install({ time: START });
  await page.clock.pauseAt(new Date(START.getTime() + 1000));
  await page.goto(path, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  if (path === "/") await page.locator('[data-v54-ready="true"]').waitFor({ state: "attached" });
  else await page.waitForTimeout(800);
  await settleImages(page);
}

/**
 * Moves the homepage story one chapter forward with one wheel gesture, the way a visitor does,
 * and lets the timed transition finish. (Key presses are not used: the chapter controller
 * compares the real event timestamp with its start time, which a virtual clock cannot move.)
 * The pointer then rests in a fixed corner so pointer-reactive scenes settle the same way every run.
 */
async function nextChapter(page: Page) {
  const vp = page.viewportSize()!;
  await page.mouse.move(Math.round(vp.width / 2), Math.round(vp.height / 2));
  const from = await page.evaluate(() => scrollY);
  let moved = false;
  for (let attempt = 0; attempt < 4 && !moved; attempt++) {
    // The gesture detector groups wheel events by their real timestamps, so separate gestures by real time.
    await page.waitForTimeout(450);
    await page.mouse.wheel(0, 300);
    await page.clock.runFor(3000);
    moved = (await page.evaluate(() => scrollY)) > from + 50;
  }
  if (!moved) throw new Error("the homepage story did not move to the next chapter");
  await page.mouse.move(1, vp.height - 1);
  await settleImages(page);
  await page.clock.runFor(2000);
}

/** Masks only content that is not part of the design (none today); kept explicit so any future mask is reviewed. */
const NO_MASK: never[] = [];

test.describe("homepage (approved V5.6.3 choreography)", () => {
  test("opening animation: the original N at 1.2 s", async ({ page }) => {
    await open(page, "/");
    await page.clock.runFor(1200);
    await expect(page).toHaveScreenshot("home-01-intro-n-1200ms.png", { ...tol(0.005), mask: NO_MASK });
  });

  test("hero at rest after the opening animation", async ({ page }) => {
    await open(page, "/");
    await page.clock.runFor(6000);
    await expect(page.locator("h1").first()).toContainText("Too many choices.");
    await expect(page).toHaveScreenshot("home-02-hero.png", { ...tol(0.005) });
  });

  test("scene 2: Two Pathways", async ({ page }) => {
    await open(page, "/");
    await page.clock.runFor(6000);
    await nextChapter(page);
    await expect(page.locator(".tp562")).toBeVisible();
    await expect(page).toHaveScreenshot("home-03-two-pathways.png", { ...tol(0.005) });
  });

  test("scene 3: Career Intelligence, N alignment and the three career tabs", async ({ page }) => {
    await open(page, "/");
    await page.clock.runFor(6000);
    await nextChapter(page);
    await nextChapter(page);
    const tabs = page.getByRole("tab");
    await expect(tabs).toHaveText([/Robotics/, /Climate & Energy/, /Space Systems/]);
    await expect(page).toHaveScreenshot("home-04-career-intelligence-robotics.png", { ...tol(0.005) });
    for (const [name, file] of [
      [/Climate & Energy/, "home-05-career-intelligence-energy.png"],
      [/Space Systems/, "home-06-career-intelligence-space.png"],
    ] as const) {
      await tabs.filter({ hasText: name }).click();
      await page.clock.runFor(1500);
      await expect(tabs.filter({ hasText: name })).toHaveAttribute("aria-selected", "true");
      await expect(page).toHaveScreenshot(file, { ...tol(0.005) });
    }
  });
});

test.describe("shared UI", () => {
  test("global header and page hero on How It Works", async ({ page }) => {
    await open(page, "/how-it-works");
    await page.clock.runFor(2000);
    await expect(page).toHaveScreenshot("page-01-how-it-works-hero.png", { ...tol(0.001) });
    // The header alone, strictly: logo, Home item, menu labels, Log in / Sign up. Zero noise was measured here,
    // so even a same-size logo or colour swap (about 1 % of the header) fails.
    await expect(page.locator("header.nwh").first()).toHaveScreenshot("page-01b-header-strict.png", { ...tol(0.001) });
  });

  test("global header and page hero on Contact", async ({ page }) => {
    await open(page, "/contact");
    await page.clock.runFor(2000);
    await expect(page).toHaveScreenshot("page-02-contact-hero.png", { ...tol(0.001) });
  });

  test("navigation: phone menu open (Home first) / desktop Explore menu open", async ({ page }, info) => {
    await open(page, "/how-it-works");
    await page.clock.runFor(2000);
    if (info.project.name === "desktop-1440") {
      await page.getByRole("button", { name: /^Explore/ }).first().click();
    } else {
      await page.getByRole("button", { name: /menu/i }).first().click();
    }
    await page.clock.runFor(1000);
    await expect(page).toHaveScreenshot("nav-01-menu-open.png", { ...tol(0.001) });
  });
});
