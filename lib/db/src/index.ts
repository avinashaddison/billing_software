import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const connectionString = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString,
  ssl: process.env.NEON_DATABASE_URL ? { rejectUnauthorized: false } : undefined,
  // Neon (free tier) suspends idle connections — recycle clients aggressively
  // so the next request gets a fresh one instead of a half-closed socket.
  idleTimeoutMillis: 30_000,
  // Keep TCP keepalives on so the pool detects a dropped connection sooner.
  keepAlive: true,
});

// IMPORTANT: pg's `Pool` re-emits client-level errors on the pool. Without
// this listener, an unexpected disconnect (Neon suspending the socket while
// idle) becomes an "unhandled error" event that crashes the Node process.
pool.on("error", (err) => {
  // eslint-disable-next-line no-console
  console.error("[db] idle client error — connection will be recycled:", err.message);
});

export const db = drizzle(pool, { schema });

export * from "./schema";
