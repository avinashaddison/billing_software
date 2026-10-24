import { describe, expect, it } from "vitest";
import pg from "pg";

describe("test database connection guard", () => {
  it("rejects remote connections before any network access", async () => {
    const client = new pg.Client({ host: "example.invalid" });
    await expect(client.connect()).rejects.toThrow("Test database safety");
  });

  it("also blocks pool queries using the default application connection", async () => {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    try {
      await expect(pool.query("SELECT 1")).rejects.toThrow("Test database safety");
    } finally {
      await pool.end();
    }
  });

  it("rejects unapproved local sockets as well as TCP hosts", async () => {
    const client = new pg.Client({ host: "/tmp/not-an-isolated-test" });
    await expect(client.connect()).rejects.toThrow("Test database safety");
  });
});
