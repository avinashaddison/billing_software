#!/usr/bin/env node
/* Read-only: SELECT DISTINCT tenant_id with row counts on every table
   that already has the column. No writes. */
import pkg from "/app/node_modules/.pnpm/pg@8.20.0/node_modules/pg/lib/index.js";
const { Pool } = pkg;

const TABLES_WITH_TENANT = [
  "products","bills","sales","sale_items","stock_logs","returns",
  "categories","suppliers","staff_profiles","store_settings",
];

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const out = {};
  for (const t of TABLES_WITH_TENANT) {
    const { rows } = await pool.query(
      `SELECT tenant_id, COUNT(*)::int AS c FROM "${t}" GROUP BY tenant_id ORDER BY c DESC`
    );
    out[t] = rows.map(r => ({ tenant_id: r.tenant_id, count: r.c }));
  }
  console.log(JSON.stringify(out, null, 2));
  await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
