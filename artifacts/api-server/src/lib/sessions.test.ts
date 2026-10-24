import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const scratch = vi.hoisted(() => ({ db: null as NodePgDatabase | null }));
vi.mock("@workspace/db", async () => {
  const schema = await import("../../../../lib/db/src/schema");
  return {
    ...schema,
    db: new Proxy({}, {
      get: (_, key) => {
        const value = (scratch.db as unknown as Record<PropertyKey, unknown>)[key];
        return typeof value === "function" ? value.bind(scratch.db) : value;
      },
    }),
  };
});

import { createSession } from "./sessions";

let root: string;
let pool: pg.Pool;
let started = false;
beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "shared-cart-test-sessions-"));
  execFileSync("initdb", ["-D", join(root, "data"), "-U", userInfo().username, "-A", "trust", "--no-locale"], { stdio: "ignore" });
  execFileSync("pg_ctl", ["-D", join(root, "data"), "-l", join(root, "pg.log"), "-o", `-k ${root} -h '' -p 15439`, "-w", "start"], { stdio: "ignore" });
  started = true;
  pool = new pg.Pool({ host: root, port: 15439, database: "postgres", user: userInfo().username });
  scratch.db = drizzle(pool);
  await pool.query(`CREATE TABLE auth_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id text,
    subject_kind text NOT NULL, subject_id uuid NOT NULL,
    user_agent text, ip text, created_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    last_activity_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz
  )`);
}, 30_000);

afterAll(async () => {
  if (pool) await pool.end();
  if (started) execFileSync("pg_ctl", ["-D", join(root, "data"), "-m", "immediate", "-w", "stop"], { stdio: "ignore" });
  if (root) rmSync(root, { recursive: true, force: true });
});

function account(tenantId: string | null = randomUUID()) {
  return { tenantId, subjectKind: "pin" as const, subjectId: randomUUID(), userAgent: "Chrome on shop tablet", ip: "192.0.2.1" };
}
async function activeIds(tenantId: string | null) {
  const result = await pool.query<{ id: string }>("SELECT id FROM auth_sessions WHERE tenant_id IS NOT DISTINCT FROM $1 AND revoked_at IS NULL ORDER BY id", [tenantId]);
  return result.rows.map((row) => row.id);
}

describe("login session rotation on isolated PostgreSQL", () => {
  it("keeps only the latest login active without reusing authentication ids", async () => {
    const user = account();
    const first = await createSession(user);
    const second = await createSession({ ...user, replace: { id: first, tenantId: user.tenantId } });
    const third = await createSession({ ...user, replace: { id: second, tenantId: user.tenantId } });
    expect(new Set([first, second, third]).size).toBe(3);
    expect(await activeIds(user.tenantId)).toEqual([third]);
  });

  it("retires the browser's email pre-login when PIN login completes", async () => {
    const user = account();
    const emailSession = await createSession({ ...user, subjectKind: "email", subjectId: randomUUID() });
    const pinSession = await createSession({ ...user, replace: { id: emailSession, tenantId: user.tenantId } });
    expect(await activeIds(user.tenantId)).toEqual([pinSession]);
  });

  it("does not merge two real browsers sharing an IP and user agent", async () => {
    const user = account();
    const first = await createSession(user);
    const second = await createSession(user);
    expect(await activeIds(user.tenantId)).toEqual([first, second].sort());
  });

  it("scopes replacement to the previous signed session's exact tenant", async () => {
    const user = account();
    const previous = await createSession(user);
    const other = account();
    await createSession({ ...other, replace: { id: previous, tenantId: other.tenantId } });
    expect(await activeIds(user.tenantId)).toEqual([previous]);
  });

  it("supports legacy NULL tenants without touching named tenants", async () => {
    const user = account(null);
    const previous = await createSession(user);
    const current = await createSession({ ...user, replace: { id: previous, tenantId: null } });
    expect(await activeIds(null)).toEqual([current]);
  });

  it("rolls back the new row if retiring the previous one fails", async () => {
    const user = account();
    const previous = await createSession(user);
    await expect(createSession({ ...user, replace: { id: "not-a-uuid", tenantId: user.tenantId } })).rejects.toThrow();
    expect(await activeIds(user.tenantId)).toEqual([previous]);
  });

  it("never revives a revoked authentication id", async () => {
    const user = account();
    const previous = await createSession(user);
    await pool.query("UPDATE auth_sessions SET revoked_at = now() WHERE id = $1", [previous]);
    const current = await createSession({ ...user, replace: { id: previous, tenantId: user.tenantId } });
    expect(current).not.toBe(previous);
    expect(await activeIds(user.tenantId)).toEqual([current]);
    const { rows } = await pool.query("SELECT revoked_at FROM auth_sessions WHERE id = $1", [previous]);
    expect(rows[0].revoked_at).toBeInstanceOf(Date);
  });
});
