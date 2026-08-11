import { defineConfig } from "vitest/config";

/**
 * Unit tests for the API server's pure logic.
 *
 * Scope is deliberately limited to modules with no database import. The app
 * talks to a LIVE production database, so a test run must never be able to
 * touch real shop data — keeping the suite to pure functions makes that a
 * structural guarantee rather than a promise.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
