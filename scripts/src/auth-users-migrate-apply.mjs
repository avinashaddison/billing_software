#!/usr/bin/env node
/* Apply 0002_auth_users.sql to the live DB.
   Idempotent (every statement uses IF NOT EXISTS).
   Single transaction. */
import pkg from "/app/node_modules/.pnpm/pg@8.20.0/node_modules/pg/lib/index.js";
import fs from "node:fs";
const { Pool } = pkg;

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }

const sql = fs.readFileSync("/app/lib/db/migrations/0002_auth_users.sql", "utf8");
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

async function main() {
  const c = await pool.connect();
  try {
    console.log("Applying 0002_auth_users.sql ...");
    await c.query(sql);
    console.log("✓ Migration applied.");

    const v = await c.query(`
      SELECT
        EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='auth_users') AS has_table,
        (SELECT COUNT(*)::int FROM information_schema.columns
          WHERE table_schema='public' AND table_name='auth_users') AS col_count;
    `);
    console.log("Post-check:", v.rows[0]);

    const idx = await c.query(`
      SELECT indexname, indexdef
        FROM pg_indexes
       WHERE schemaname='public' AND tablename='auth_users'
       ORDER BY indexname
    `);
    console.log("Indexes on auth_users:");
    for (const r of idx.rows) console.log(`  • ${r.indexname}\n      ${r.indexdef}`);
  } finally {
    c.release();
    await pool.end();
  }
}
main().catch(e => { console.error("Migration failed:", e.message); process.exit(1); });
