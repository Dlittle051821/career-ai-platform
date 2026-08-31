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
 *   - src/lib/education/        — Milestone 9's global university/course
 *     data platform business logic (normalization, CSV parsing + formula-
 *     injection protection, duplicate-detection scoring, data-quality
 *     rules, freshness bands, search-filter sanitization) — same "pure,
 *     framework-free" convention; nothing here talks to Supabase (that
 *     lives in src/lib/supabase/admin/education-*.ts and
 *     src/lib/supabase/education/*.ts, untested here for the same reason
 *     as src/lib/admin/ and src/lib/payments/ above).
 *   - scripts/                  — Milestone 9's education-data CLI tools
 *     (scripts/validate-education-data.ts, scripts/import-education-data.ts,
 *     scripts/lib/education-cli-shared.ts). Only their exported pure
 *     functions are exercised (CSV structural validation, the
 *     hand-maintained university/course row-mapping ports, argv/env
 *     helpers) — none of these tests open a real DB connection or read
 *     stdin; scripts/seed-education-data.ts has no pure logic worth unit
 *     testing (it is a thin `pg`-driven runner for an already-reviewed
 *     .sql file) and is intentionally not covered here.
 *   - src/config/                — the central brand configuration
 *     (src/config/site.ts) and a source-string regression guard for the
 *     CareerPath AI → NextWise rebrand (docs/branding-guide.md) — still
 *     "pure, framework-free": reading `process.env`, checking that shipped
 *     asset paths exist on disk with `node:fs`, and grepping specific
 *     source files' text for the old brand string, none of which needs a
 *     React/DOM environment. This deliberately does NOT add React
 *     component-rendering tests (e.g. for Header/Footer/Logo) — this
 *     project has never used React Testing Library/jsdom, by the same
 *     "everything else is exercised by the manual/QA checks" convention
 *     documented for the rest of this file; adding a whole new rendering
 *     test stack for one branding pass would be disproportionate. The
 *     source-string check below is this project's equivalent guardrail.
 *   - src/lib/pricing/           — Milestone 10's NextWise Pricing & Offers
 *     business logic (plan-version effective-window/benefits-approval
 *     checks, offer shape/against-plan validation, redeemability/exhaustion
 *     checks, discount/price-breakdown math, and a fixture regression
 *     covering all nine official plan prices in integer minor units) — same
 *     "pure, framework-free" convention; nothing here talks to Supabase
 *     (that lives in src/lib/supabase/pricing/ and
 *     src/lib/supabase/admin/pricing*.ts, untested here for the same reason
 *     as every other src/lib/supabase/ module). The one authoritative
 *     Postgres SECURITY DEFINER function (purchase_pricing_plan(), plus the
 *     RLS policies and the pricing_plan_versions immutability trigger)
 *     cannot be unit-tested via Vitest — see
 *     docs/nextwise-pricing-offers-guide.md §12 for how those are verified
 *     instead (manual Supabase/Razorpay test-mode walkthrough), same
 *     convention as the payments/billing SECURITY DEFINER functions noted
 *     above.
 *   - src/lib/analytics/         — Milestone 9's audit + outcome
 *     instrumentation (the event registry and the pure trackEvent()
 *     validation/sanitization logic that decides what is allowed to reach
 *     product_events) — same "pure, framework-free" convention; nothing
 *     here talks to Supabase (that lives in src/lib/supabase/analytics/
 *     and src/lib/supabase/admin/outcomes.ts, untested here for the same
 *     reason as every other src/lib/supabase/ module). RLS/trigger-level
 *     behavior (stamp_product_event, sync_student_outcome_from_
 *     application) cannot be unit-tested via Vitest — see
 *     docs/M9_TEST_REPORT.md for the manual verification appendix.
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
      "src/lib/education/**/*.test.ts",
      "src/lib/pricing/**/*.test.ts",
      "scripts/**/*.test.ts",
      "src/config/**/*.test.ts",
      "src/lib/analytics/**/*.test.ts",
    ],
  },
});
