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
  "0003_tenant_expiry.sql",
  "0004_audit_events.sql",
  // "0005_clear_orphan_offers.sql" — REMOVED. This SQL was NOT idempotent
  //   in the presence of regular sale prices (not tied to Today's Deals):
  //   it nulled sale_price on every cold-start for any product with
  //   is_today_deal=false. On Render's free tier every spin-up wiped
  //   sale prices that the merchant had just set. Disabled permanently.
  "0006_bill_customer_name.sql",
  "0007_bill_receivables.sql",
  "0008_sale_items_custom.sql",
  "0009_supplier_payments.sql",
  "0010_per_tenant_unique.sql",
  "0011_perf_indexes.sql",
  "0012_bill_payments.sql",
  "0013_auth_sessions.sql",
  "0014_report_accuracy.sql",
  "0015_platform_settings.sql",
  "0016_tenant_telegram.sql",
  "0017_admin_control.sql",
  "0018_api_keys.sql",
  "0019_held_bills.sql",
  "0020_active_carts.sql",
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
  /* Ledger of already-applied migrations. Previously EVERY file ran on EVERY
     boot; several do whole-table backfills, so cold starts re-scanned the
     entire bills/sale_items history each time. The ledger lets us skip files
     that already ran. Safe to introduce on an existing DB: every migration is
     idempotent, so the first boot after this change re-runs them once, records
     them, and later boots skip. Any ledger failure falls back to run-all —
     never LESS safe than before, just occasionally slower.

     Migrations are append-only (new files, never edited in place), so keying
     the ledger by filename is sufficient — no content hashing needed. */
  let applied = new Set<string>();
  try {
    await db.execute(sql.raw(
      "CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    ));
    const rows = await db.execute(sql.raw("SELECT name FROM _migrations"));
    for (const r of rows.rows as { name: string }[]) applied.add(r.name);
  } catch (err) {
    logger.warn({ err }, "migration ledger unavailable — running all migrations (idempotent)");
    applied = new Set();
  }

  for (const name of MIGRATION_FILES) {
    if (applied.has(name)) continue;

    const file = findMigration(name);
    if (!file) {
      logger.warn({ name, searched: SEARCH_DIRS }, "migration file not found — skipping (apply manually if needed)");
      continue;
    }
    const sqlText = fs.readFileSync(file, "utf8");
    /* DNS/connection to the DB host is often not ready in the first seconds
       after boot (observed as getaddrinfo ENOTFOUND on the Neon pooler while
       the same host resolves fine moments later). Without a retry the whole
       runner aborts on the FIRST file and every later migration is skipped
       for the lifetime of the process. */
    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await db.execute(sql.raw(sqlText));
        /* Record success so we skip this file next boot. Best-effort: if the
           insert fails, the worst case is we re-run the (idempotent) file. */
        try {
          await db.execute(sql`INSERT INTO _migrations (name) VALUES (${name}) ON CONFLICT (name) DO NOTHING`);
        } catch (err) {
          logger.warn({ name, err }, "migration applied but ledger insert failed — will re-run next boot");
        }
        logger.info({ name }, "migration applied (or already up-to-date)");
        break;
      } catch (err) {
        if (attempt === MAX_ATTEMPTS) {
          logger.error({ name, err }, "migration failed");
          throw err;
        }
        logger.warn({ name, attempt }, "migration attempt failed — retrying in 3s");
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }
}
