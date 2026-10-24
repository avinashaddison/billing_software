import { describe, expect, it, vi } from "vitest";
import { initializeDatabase, shouldStartScheduledJobs } from "./database-startup";

function operations() {
  return {
    migrate: vi.fn(async () => {}),
    verify: vi.fn(async () => true),
    bootstrap: vi.fn(async () => {}),
  };
}

describe("live database startup protection", () => {
  it("does not run scheduled maintenance in development without an explicit opt-in", () => {
    expect(shouldStartScheduledJobs({ NODE_ENV: "development" })).toBe(false);
    expect(shouldStartScheduledJobs({ NODE_ENV: "test" })).toBe(false);
    expect(shouldStartScheduledJobs({ NODE_ENV: "development", ENABLE_DEVELOPMENT_SCHEDULERS: "true" })).toBe(true);
    expect(shouldStartScheduledJobs({ NODE_ENV: "production" })).toBe(true);
  });

  it.each(["production", "development", "test"])("only verifies by default in %s", async (mode) => {
    const ops = operations();
    await initializeDatabase(ops, { NODE_ENV: mode });
    expect(ops.verify).toHaveBeenCalledOnce();
    expect(ops.migrate).not.toHaveBeenCalled();
    expect(ops.bootstrap).not.toHaveBeenCalled();
  });

  it("does not treat arbitrary truthy strings as permission to write", async () => {
    const ops = operations();
    await initializeDatabase(ops, { RUN_DB_MIGRATIONS: "1", BOOTSTRAP_DEFAULT_OWNER: "yes" });
    expect(ops.migrate).not.toHaveBeenCalled();
    expect(ops.bootstrap).not.toHaveBeenCalled();
  });

  it("runs migrations only with the explicit opt-in, before verification", async () => {
    const order: string[] = [];
    await initializeDatabase({
      migrate: async () => { order.push("migrate"); },
      verify: async () => { order.push("verify"); },
      bootstrap: async () => { order.push("bootstrap"); },
    }, { NODE_ENV: "production", RUN_DB_MIGRATIONS: "true", BOOTSTRAP_DEFAULT_OWNER: "true" });
    expect(order).toEqual(["migrate", "verify"]);
  });

  it("only bootstraps development accounts with explicit permission", async () => {
    const ops = operations();
    await initializeDatabase(ops, { NODE_ENV: "development", BOOTSTRAP_DEFAULT_OWNER: "true" });
    expect(ops.bootstrap).toHaveBeenCalledOnce();
  });

  it("fails closed when schema verification fails, without bootstrapping", async () => {
    const ops = operations();
    ops.verify.mockRejectedValueOnce(new Error("Schema unavailable"));
    await expect(initializeDatabase(ops, { BOOTSTRAP_DEFAULT_OWNER: "true" }))
      .rejects.toThrow("Schema unavailable");
    expect(ops.bootstrap).not.toHaveBeenCalled();
  });
});
