#!/usr/bin/env node
/* Apply the additive tenant migration SQL.
   - Runs every statement inside a single transaction (already wrapped in
     BEGIN/COMMIT inside the .sql file).
   - Aborts on any error.
   - Re-runnable: every statement uses IF NOT EXISTS.
*/
import pkg from "/app/node_modules/.pnpm/pg@8.20.0/node_modules/pg/lib/index.js";
import fs from "node:fs";
const { Pool } = pkg;

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }

const sql = fs.readFileSync("/app/lib/db/migrations/0001_tenant_additive.sql", "utf8");
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    console.log("Applying /app/lib/db/migrations/0001_tenant_additive.sql ...");
    await client.query(sql);
    console.log("✓ Migration applied.");

    // Post-checks
    const verify = await client.query(`
      SELECT
        EXISTS (SELECT 1 FROM information_schema.tables
                WHERE table_schema='public' AND table_name='tenants') AS has_tenants_table,
        EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='staff_permissions'
                  AND column_name='tenant_id') AS sp_has_tenant_id,
        EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='license_status'
                  AND column_name='tenant_id') AS ls_has_tenant_id
    `);
    console.log("Post-migration verification:", verify.rows[0]);

    const idx = await client.query(`
      SELECT t.relname AS table_name, i.relname AS index_name
        FROM pg_index ix
        JOIN pg_class i ON i.oid = ix.indexrelid
        JOIN pg_class t ON t.oid = ix.indrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
       WHERE n.nspname='public'
         AND i.relname LIKE '%tenant%'
       ORDER BY t.relname, i.relname
    `);
    console.log("Tenant-related indexes:");
    for (const r of idx.rows) console.log(`  • ${r.table_name}.${r.index_name}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error("Migration failed:", e.message); process.exit(1); });
