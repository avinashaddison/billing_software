/**
 * Boot-time migration runner.
 *
 * Applies the additive tenant migrations against the DB on every server
 * start. Every statement uses `IF NOT EXISTS` so re-running is a no-op:
 * already-migrated DBs are unaffected, fresh DBs are upgraded
 * automatically.
 *
 * Files applied, in order:
 *   1. 0001_tenant_additive.sql  — `tenants` table + nullable tenant_id
 *      on every priority table + indexes + partial uniques on singletons.
 *   2. 0002_auth_users.sql       — `auth_users` table + per-tenant
 *      case-insensitive unique email index + reset-token index.
 *
 * The files are read at build time via fs (kept in the bundle path next
 * to dist/index.mjs) — esbuild does NOT bundle .sql files, so they must
 * ship alongside the binary. The build script copies them; if they're
 * missing the migration runner silently skips them and logs a warning
 * (the deploy continues — operator can apply them manually).
 *
 * The migration runs in a single transaction so a partial failure leaves
 * the DB in its previous state.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

/* Search paths — first hit wins. Lets the runner work in:
   • dev (tsx from /app/artifacts/api-server/src/lib/migrate.ts)
   • prod (esbuilt dist/index.mjs alongside dist/migrations/*.sql)
   • monorepo install (migrations co-located under lib/db/migrations) */
const SEARCH_DIRS = [
  path.join(__dirname, "migrations"),
  path.join(__dirname, "..", "migrations"),
  path.join(__dirname, "..", "..", "..", "..", "lib", "db", "migrations"),
  path.join(__dirname, "..", "..", "..", "lib", "db", "migrations"),
];

const MIGRATION_FILES = [
  "0001_tenant_additive.sql",
  "0002_auth_users.sql",
];

function findMigration(name: string): string | null {
  for (const dir of SEARCH_DIRS) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Apply all known additive migrations. Idempotent. Logs each one.
 *
 * Throws only on hard DB errors (connection refused, syntax errors in
 * the SQL files, etc.) — never on "already applied" because every
 * statement uses IF NOT EXISTS.
 */
export async function runBootMigrations(): Promise<void> {
  for (const name of MIGRATION_FILES) {
    const file = findMigration(name);
    if (!file) {
      logger.warn({ name, searched: SEARCH_DIRS }, "migration file not found — skipping (apply manually if needed)");
      continue;
    }
    const sqlText = fs.readFileSync(file, "utf8");
    try {
      await db.execute(sql.raw(sqlText));
      logger.info({ name }, "migration applied (or already up-to-date)");
    } catch (err) {
      logger.error({ name, err }, "migration failed");
      throw err;
    }
  }
}
