import { defineConfig } from "vitest/config";

/**
 * Pure/mocked tests plus real SQL against disposable local clusters only.
 * The setup file strips live credentials and rejects non-test connections
 * before pg can open a socket.
 */
export default defineConfig({
  test: {
    setupFiles: ["./test/database-safety.ts"],
    // Bound initdb/SQL fixture contention on build machines.
    maxWorkers: 2,
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    environment: "node",
  },
});
