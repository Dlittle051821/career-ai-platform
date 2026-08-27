import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Test runner for this project's pure, framework-free logic — no
 * React/DOM environment is configured because nothing under test needs
 * one; everything else (pages, server actions) is exercised by the
 * manual/QA checks described in the README and `qa/` scripts. Currently
 * covers:
 *   - src/lib/recommendations/  — Milestone 5's scoring engine
 *   - src/lib/careers/          — Milestone 6's comparison-matrix builder
 *   - src/lib/admin/            — Milestone 7's admin business logic
 *     (permissions, money, status transitions, analytics, audit helpers,
 *     content safety, pagination) — deliberately pure, same convention as
 *     the two directories above; nothing in src/lib/admin/ talks to
 *     Supabase (that lives in src/lib/supabase/admin/, untested here for
 *     the same reason src/lib/supabase/careers.ts etc. always have been).
 *   - src/lib/payments/         — Milestone 8's payments/billing business
 *     logic (invoice math, invoice status derivation, GST gating, payment
 *     link tokens, billing snapshot, and RazorpayGateway's local signature
 *     pre-checks) — same "pure, framework-free" convention; nothing in
 *     src/lib/payments/ talks to Supabase (that lives in
 *     src/lib/supabase/admin/ and src/lib/supabase/payments/, untested
 *     here for the same reason as src/lib/admin/ above), and the two
 *     authoritative Postgres SECURITY DEFINER functions
 *     (verify_checkout_payment/apply_webhook_event) cannot be unit-tested
 *     via Vitest at all — see docs/payments-billing-guide.md §12 for how
 *     those are verified instead (manual Razorpay test-mode walkthrough).
 * (plus label/characteristic helpers those tests exercise indirectly)
 */
export default defineConfig({
  resolve: {
    alias: {
      // Mirrors tsconfig.json's "@/*" -> "./src/*" path alias — Next.js
      // resolves this itself via the TypeScript compiler; Vitest needs it
      // spelled out explicitly since it doesn't go through Next's build.
      "@": path.resolve(import.meta.dirname, "./src"),
      // `server-only` throws unless resolved under Next.js's "react-server"
      // export condition (which marks the empty.js no-op instead of the
      // throwing index.js) — Vitest doesn't set that condition, so a couple
      // of src/lib/payments/*.ts modules under test (tokens.ts,
      // providers/razorpay.ts) that import "server-only" as a defense-in-
      // depth client-bundle guard would otherwise throw on import here even
      // though nothing about their actual logic is Next.js-specific. Alias
      // it to the package's own no-op build in tests only — production
      // builds are untouched and still get the real client-import guard.
      "server-only": path.resolve(import.meta.dirname, "./node_modules/server-only/empty.js"),
    },
  },
  test: {
    environment: "node",
    include: [
      "src/lib/recommendations/**/*.test.ts",
      "src/lib/careers/**/*.test.ts",
      "src/lib/admin/**/*.test.ts",
      "src/lib/payments/**/*.test.ts",
    ],
  },
});
