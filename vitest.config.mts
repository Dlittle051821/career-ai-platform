import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Milestone 5 test runner. Scoped deliberately narrow: the recommendation
 * engine under `src/lib/recommendations/` is the only pure, framework-free
 * logic in this codebase worth unit testing with a fast Node-based runner.
 * Everything else (pages, server actions) is exercised by the manual/QA
 * checks described in the README and `qa/` scripts — no React/DOM test
 * environment is configured here because nothing under test needs one.
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
    include: ["src/lib/recommendations/**/*.test.ts"],
  },
});
