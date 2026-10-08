/**
 * Financial SQL verification, isolated from all real shop rows. Two TEMP
 * tables shadow the public coupon tables on one connection. Everything is
 * rolled back, including the fixture rows and temporary DDL.
 */
import assert from "node:assert/strict";
import { pool } from "@workspace/db";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { lookupCoupon, redeemCoupon } from "../lib/coupons";

async function main() {
  const client = await pool.connect();
  const dialect = new PgDialect();
  const execute = async (query: SQL) => {
    const compiled = dialect.sqlToQuery(query);
    return client.query(compiled.sql, compiled.params);
  };
  try {
    await client.query("BEGIN");
    await client.query(
      "CREATE TEMP TABLE coupons (LIKE public.coupons INCLUDING ALL) ON COMMIT DROP",
    );
    await client.query(
      "CREATE TEMP TABLE coupon_redemptions (LIKE public.coupon_redemptions INCLUDING ALL) ON COMMIT DROP",
    );
    await client.query("SET LOCAL search_path = pg_temp");
    // Never proceed unless BOTH target tables are private temporary relations.
    const tables =
      await client.query(`SELECT c.relname,c.relpersistence FROM pg_class c
      WHERE c.oid IN ('coupons'::regclass,'coupon_redemptions'::regclass)`);
    assert.equal(tables.rows.length, 2);
    assert.ok(tables.rows.every((row) => row.relpersistence === "t"));
    await client.query(`INSERT INTO coupons(code,tenant_id,discount_type,discount_value,max_uses)
      VALUES ('TM-SQL-LIMIT','fixture-shop','percent',10,2),
             ('TM-SQL-ROLLBACK','fixture-shop','amount',5,1)`);
    const preview = await lookupCoupon(
      execute,
      "fixture-shop",
      "tm-sql-limit",
      "0000000001",
    );
    assert.equal(preview.usedCount, 0);
    const first = await lookupCoupon(
      execute,
      "fixture-shop",
      preview.code,
      "0000000001",
      true,
    );
    await redeemCoupon(
      execute,
      "fixture-shop",
      first,
      "0000000001",
      "00000000-0000-0000-0000-000000000051",
      10,
    );
    await assert.rejects(
      lookupCoupon(execute, "fixture-shop", first.code, "0000000001", true),
      /already used/,
    );
    const second = await lookupCoupon(
      execute,
      "fixture-shop",
      first.code,
      "0000000002",
      true,
    );
    assert.equal(second.usedCount, 1);
    await redeemCoupon(
      execute,
      "fixture-shop",
      second,
      "0000000002",
      "00000000-0000-0000-0000-000000000052",
      10,
    );
    await assert.rejects(
      lookupCoupon(execute, "fixture-shop", first.code, "0000000003", true),
      /usage limit/,
    );
    await assert.rejects(
      lookupCoupon(execute, "other-shop", first.code, "0000000003", true),
      /not found/,
    );

    await client.query("SAVEPOINT refused_bill");
    const failed = await lookupCoupon(
      execute,
      "fixture-shop",
      "TM-SQL-ROLLBACK",
      "0000000003",
      true,
    );
    await redeemCoupon(
      execute,
      "fixture-shop",
      failed,
      "0000000003",
      "00000000-0000-0000-0000-000000000053",
      5,
    );
    await client.query("ROLLBACK TO SAVEPOINT refused_bill");
    const restored = await lookupCoupon(
      execute,
      "fixture-shop",
      failed.code,
      "0000000003",
      true,
    );
    assert.equal(restored.usedCount, 0);
    assert.equal(restored.remainingUses, 1);
    await client.query(
      "UPDATE coupons SET is_active = false WHERE code = 'TM-SQL-ROLLBACK'",
    );
    await assert.rejects(
      lookupCoupon(execute, "fixture-shop", failed.code, "0000000003", true),
      /disabled/,
    );
    await client.query(
      "UPDATE coupons SET is_active = true, expires_at = clock_timestamp() - interval '1 day' WHERE code = 'TM-SQL-ROLLBACK'",
    );
    await assert.rejects(
      lookupCoupon(execute, "fixture-shop", failed.code, "0000000003", true),
      /expired/,
    );
    console.log(
      "Coupon SQL smoke passed: usage limits, once per phone, isolation, disable/expiry and rollback. Only temporary tables used.",
    );
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    client.release();
    await pool.end();
  }
}
main().catch(() => {
  console.error("Coupon SQL smoke failed; no fixture changes were committed.");
  process.exitCode = 1;
});
