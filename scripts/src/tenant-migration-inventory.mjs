#!/usr/bin/env node
/* Read-only DB inventory for the multi-tenant migration pre-flight check.
   - Lists every table in the public schema
   - For each priority table: lists columns + row count
   - Checks whether tenant_id is already present on any table
   - Reports indexes on tenant_id columns
   Performs ZERO writes. */

import pkg from "/app/node_modules/.pnpm/pg@8.20.0/node_modules/pg/lib/index.js";
const { Pool } = pkg;

const PRIORITY_TABLES = [
  "tenants",
  "products", "bills", "sales", "sale_items", "stock_logs", "returns",
  "categories", "suppliers", "staff_profiles", "staff_permissions",
  "license_status", "store_settings",
];

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }

const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

async function main() {
  const out = {};

  // 1. all tables in public schema
  const { rows: tables } = await pool.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND table_type='BASE TABLE'
     ORDER BY table_name`
  );
  out.tables = tables.map(r => r.table_name);

  // 2. existing tenant_id columns across all tables
  const { rows: tenantCols } = await pool.query(
    `SELECT table_name, data_type, is_nullable
       FROM information_schema.columns
      WHERE table_schema='public' AND column_name='tenant_id'
      ORDER BY table_name`
  );
  out.existing_tenant_id_columns = tenantCols;

  // 3. per-priority-table column list + row count
  out.priority_tables = {};
  for (const t of PRIORITY_TABLES) {
    if (!out.tables.includes(t)) {
      out.priority_tables[t] = { exists: false };
      continue;
    }
    const { rows: cols } = await pool.query(
      `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1
        ORDER BY ordinal_position`,
      [t]
    );
    let rowCount = null;
    try {
      const { rows } = await pool.query(`SELECT count(*)::int AS c FROM "${t}"`);
      rowCount = rows[0].c;
    } catch (e) { rowCount = `ERR: ${e.message}`; }
    out.priority_tables[t] = {
      exists: true,
      row_count: rowCount,
      has_tenant_id: cols.some(c => c.column_name === "tenant_id"),
      columns: cols.map(c => `${c.column_name} ${c.data_type}${c.is_nullable==='NO'?' NOT NULL':''}${c.column_default?` DEFAULT ${c.column_default}`:''}`),
    };
  }

  // 4. unique constraints worth knowing about
  const { rows: uniques } = await pool.query(
    `SELECT t.relname AS table_name, i.relname AS index_name,
            pg_get_indexdef(ix.indexrelid) AS definition, ix.indisunique
       FROM pg_index ix
       JOIN pg_class i ON i.oid = ix.indexrelid
       JOIN pg_class t ON t.oid = ix.indrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname='public' AND ix.indisunique
        AND t.relname = ANY($1)
      ORDER BY t.relname, i.relname`,
    [PRIORITY_TABLES]
  );
  out.unique_indexes = uniques.map(r => `${r.table_name}: ${r.definition}`);

  console.log(JSON.stringify(out, null, 2));
  await pool.end();
}

main().catch(e => { console.error("Inventory failed:", e.message); process.exit(1); });
