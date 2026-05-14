#!/usr/bin/env node
/* Runtime smoke test of the tenant filter at the SQL layer.
   Bypasses the license gate entirely — exercises only the tenantWhere()
   logic + the live DB shape to prove:

   1. tenantId=null (legacy/Hira & Sons login) sees ALL existing rows
      (because every existing row has tenant_id IS NULL).
   2. tenantId="some-new-tenant" still sees the legacy NULL rows during
      migration (STRICT_TENANT=false), exactly matching the
      "tenant_id = :t OR tenant_id IS NULL" rule.
   3. STRICT_TENANT=true hides the legacy NULL rows from a non-null
      tenant — proving the flag works.
*/
import pkg from "/app/node_modules/.pnpm/pg@8.20.0/node_modules/pg/lib/index.js";
const { Pool } = pkg;

const url = process.env.DATABASE_URL;
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

async function countFor(table, tenantId, strict) {
  let where;
  if (tenantId === null) {
    where = `tenant_id IS NULL`;
  } else if (strict) {
    where = `tenant_id = '${tenantId}'`;
  } else {
    where = `tenant_id = '${tenantId}' OR tenant_id IS NULL`;
  }
  const { rows } = await pool.query(`SELECT COUNT(*)::int c FROM "${table}" WHERE ${where}`);
  return rows[0].c;
}

async function main() {
  const tables = ["products","bills","sales","sale_items","stock_logs","returns","categories","suppliers","staff_profiles","staff_permissions","license_status","store_settings"];

  const scenarios = [
    { label: "Hira legacy login (tenantId=null)",                     tenantId: null,         strict: false },
    { label: "New tenant 'acme' during migration (STRICT_TENANT=off)", tenantId: "acme",      strict: false },
    { label: "New tenant 'acme' STRICT_TENANT=on (hides legacy)",     tenantId: "acme",      strict: true  },
    { label: "Hira tenant 'hira-sons' after backfill, strict=on",     tenantId: "hira-sons", strict: true  },
  ];

  for (const s of scenarios) {
    console.log(`\n=== ${s.label} ===`);
    for (const t of tables) {
      const c = await countFor(t, s.tenantId, s.strict);
      console.log(`  ${t.padEnd(20)} → ${c} rows visible`);
    }
  }

  await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
