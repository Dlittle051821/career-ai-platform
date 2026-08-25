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
 * (plus label/characteristic helpers those tests exercise indirectly)
 */
export default defineConfig({
  resolve: {
    // Mirrors tsconfig.json's "@/*" -> "./src/*" path alias — Next.js
    // resolves this itself via the TypeScript compiler; Vitest needs it
    // spelled out explicitly since it doesn't go through Next's build.
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/lib/recommendations/**/*.test.ts", "src/lib/careers/**/*.test.ts"],
  },
});
