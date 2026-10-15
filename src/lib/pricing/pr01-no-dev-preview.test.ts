import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Same "no leftover dev-only QA harness" tripwire UX10-C01 established for
 * /careers (see src/lib/careers/careers-reference-audit.test.ts) — this
 * milestone's own sandbox-only QA harness lived at
 * src/app/(site)/dev-preview/pricing/page.tsx (needed only because this
 * sandbox has no live Supabase project to screenshot the real /pricing
 * route against) and must be deleted before packaging for delivery. A real
 * database review of supabase/seed/0009_pr01_new_commercial_catalogue_seed.sql
 * makes the real /pricing page itself render this exact content — the
 * harness was never a second product surface.
 */
describe("UX10-PR01 — no leftover dev-only QA harness in the shipped source tree", () => {
  it("src/app/(site)/dev-preview must be deleted before packaging", () => {
    const devPreviewDir = path.resolve(process.cwd(), "src/app/(site)/dev-preview");
    expect(existsSync(devPreviewDir), "src/app/(site)/dev-preview must be deleted before packaging").toBe(false);
  });

  it("no stray top-level src/app/dev-preview directory either (the pre-fix location)", () => {
    const legacyDir = path.resolve(process.cwd(), "src/app/dev-preview");
    expect(existsSync(legacyDir)).toBe(false);
  });

  it("the real (site)/pricing/page.tsx is the only PricingPage implementation", () => {
    const realPage = path.resolve(process.cwd(), "src/app/(site)/pricing/page.tsx");
    expect(existsSync(realPage)).toBe(true);
  });
});
